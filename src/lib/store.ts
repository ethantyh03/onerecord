/**
 * Tesseract sandbox store: every piece of mutable demo state, persisted per visitor in localStorage.
 *
 * SSR-safe for the Next.js App Router:
 * - On the server there is no storage, so persistence is disabled and the store holds an empty, un-hydrated
 *   initial state (no seed is built server-side).
 * - In the browser the store hydrates synchronously from localStorage at module load. A first visit, a
 *   corrupted payload, an unreadable shape or an old version all reseed via buildSeed(nowIso()).
 * - Render gates should use useHasHydrated(), which is false on the server and during hydration.
 */
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type PersistStorage, type StateStorage, type StorageValue } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  AppConfig,
  AppNotification,
  ApprovalStep,
  AuditEvent,
  CountryCode,
  DomainConfig,
  DtwFile,
  DuplicateDecision,
  FieldValue,
  MdmRequest,
  Person,
  PurchaseRequest,
  RequestStatus,
  SapRecord,
} from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { DEFAULT_CONFIG, cloneDefaultConfig } from "@/config/default-config";
import { SYSTEM_ACTOR_ID } from "@/config/people";
import {
  applyExtension,
  approvalNotifications,
  buildSeed,
  entitiesOf,
  knownSapCodes,
  maskedSnapshot,
  nextRequestNumber,
  recordName,
  requestTitle,
  sapFieldsFor,
  unblockField,
  type AuditDraft,
  type SeedData,
} from "@/lib/seed";
import { validateRequest } from "@/lib/engine/conditions";
import { activateNext, applyDecision, buildRoute, expectedCompletion, isFinalStatus, MDM_STAGE_ID, newlyActivated } from "@/lib/engine/routing";
import { slaTick, type SodSkip } from "@/lib/engine/sla";
import { appendAudit } from "@/lib/engine/audit";
import { assignSapCode } from "@/lib/engine/codes";
import { buildDtwFiles } from "@/lib/engine/dtw";
import { normalizeName, tokenSetRatio } from "@/lib/engine/dedupe";
import { segregationCheck } from "@/lib/engine/routing";

// =============================================================================================
// Types
// =============================================================================================

export const STORAGE_KEY = "tesseract-sandbox-v1";
/** Bump whenever the persisted shape or the seed changes: every visitor is then reseeded. */
export const SANDBOX_VERSION = 2;

function hashToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

const BUILD_ID = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BUILD_ID) || "";
/** zustand persist version: SANDBOX_VERSION, combined with NEXT_PUBLIC_BUILD_ID when set (each deploy reseeds). */
export const STORAGE_VERSION = BUILD_ID ? SANDBOX_VERSION * 1_000_000 + hashToInt(BUILD_ID) : SANDBOX_VERSION;

/** The simulated clock starts here at seed: Wed 28 Oct 2026 09:00 SGT. */
export const SIM_BASE_ISO = "2026-10-28T01:00:00.000Z";
export const SIM_BASE_MS = Date.parse(SIM_BASE_ISO);

/** First id for requests raised in the demo; seeded ids stay below it. */
export const FIRST_ADHOC_REQUEST_NUMBER = 1100;

/** Set by markCreatedInSap when it releases blocked PRs (Regional Pulse animates before -> after). */
export interface LastUnblock {
  beforeSgd: number;
  afterSgd: number;
  /** simulated ISO time of the release */
  at: string;
  requestId: string;
}

/** Simulated now in ms: simBaseMs + real time elapsed since seeding + fast-forward offset. */
export function simNowMs(
  s: { simBaseMs?: number; seededAtRealMs?: number; clockOffsetMs?: number },
  realNowMs: number = Date.now(),
): number {
  const offset = typeof s.clockOffsetMs === "number" && Number.isFinite(s.clockOffsetMs) ? s.clockOffsetMs : 0;
  if (typeof s.simBaseMs !== "number" || typeof s.seededAtRealMs !== "number" || !Number.isFinite(s.simBaseMs) || !Number.isFinite(s.seededAtRealMs)) {
    return realNowMs + offset;
  }
  return s.simBaseMs + (realNowMs - s.seededAtRealMs) + offset;
}

/** Persisted sandbox data. */
export interface SandboxData extends SeedData {
  personaId: string;
  /** Simulated clock offset (fast-forward), in ms. */
  clockOffsetMs: number;
  config: AppConfig;
  /** Next request number (REQ-{idCounter}). */
  idCounter: number;
  /** SAP codes reserved by a generated DTW file, keyed by request id, until the record is created. */
  reservedCodes: Record<string, string>;
  /** Simulated clock origin (ms): 09:00 SGT Wed 28 Oct 2026 at seed. */
  simBaseMs: number;
  /** Real Date.now() when the sandbox was seeded. */
  seededAtRealMs: number;
  /** Last release of stuck demand by markCreatedInSap (null until one happens). */
  lastUnblock: LastUnblock | null;
}

export interface ActionResult {
  ok: boolean;
  /** Why nothing happened. */
  reason?: string;
  /** Same text as reason (kept for older callers). */
  error?: string;
}

export interface CreateInSapResult {
  ok: boolean;
  reason?: string;
  record?: SapRecord;
}

export interface SandboxActions {
  setPersona(id: string): void;
  /** Simulated "now" (real time + fast-forward offset). */
  nowIso(): string;
  /** New draft owned by the current persona; returns the request id. Throws for an unknown request type. */
  createDraft(domainId: string, initial?: Record<string, FieldValue>): string;
  /** Patch a draft (or a needs_info request). aiKeys marks fields filled by paste-to-fill. */
  updateDraft(id: string, patch: Record<string, FieldValue>, aiKeys?: string[]): void;
  setDuplicateDecision(id: string, d: DuplicateDecision | undefined): void;
  /** Validate → route → activate → notify. */
  submitRequest(id: string): { ok: boolean; errors: Record<string, string> };
  /**
   * No-op (ok: false + reason) when the step is not pending/question (double click, stale tab) or when segregation of
   * duties blocks the current persona (requestor / requestor's delegate; finance approver on the MDM step).
   */
  approveStep(requestId: string, stepId: string, comment?: string): ActionResult;
  rejectStep(requestId: string, stepId: string, comment: string): ActionResult;
  /** Pauses the step's SLA clock and sends the question to the requestor. */
  askQuestion(requestId: string, stepId: string, text: string): ActionResult;
  /** Returns the step to the SAME approver; paused time is excluded from the SLA. */
  answerQuestion(requestId: string, stepId: string, answer: string): ActionResult;
  /** Advance the simulated clock and run the SLA check (reminders, escalations). fastForward(0) just runs the check. */
  fastForward(hours: number): { reminders: number; escalations: number };
  /** delegateId set → out of office (pending and upcoming steps move to the delegate); null → back in office. */
  setOutOfOffice(personId: string, delegateId: string | null): void;
  logSensitiveReveal(requestId: string, fieldKey: string): void;
  /** DTW files for a request at MDM review (or already created). First call reserves the SAP code and is audited. */
  generateDtw(requestId: string): DtwFile[];
  /**
   * Creates the SAP B1 record (or, for "extend", updates the existing BP and keeps its code), releases blocked PRs,
   * records lastUnblock and notifies the requestor. Never throws: { ok: false, reason } when not at MDM review or
   * when the current persona approved the request's finance step. Already created -> { ok: true, record }.
   */
  markCreatedInSap(requestId: string): CreateInSapResult;
  markNotificationRead(id: string): void;
  /** Marks the current persona's notifications read (optionally one channel). */
  markAllNotificationsRead(channel?: AppNotification["channel"]): void;
  /** Withdraw a draft or an in-flight request. */
  cancelRequest(id: string, reason?: string): ActionResult;
  /** Saves a new config version; in-flight requests keep the route they started with. */
  updateConfig(next: AppConfig, summary: string): void;
  /** Fresh seed, sim clock back to 09:00 SGT Wed 28 Oct 2026, Amy as persona. */
  resetSandbox(): void;
}

export type SandboxState = SandboxData & SandboxActions & { hydrated: boolean };
/** Alias used by the plan. */
export type State = SandboxState;

// =============================================================================================
// Helpers
// =============================================================================================

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const OPEN_STATUSES: ReadonlySet<RequestStatus> = new Set<RequestStatus>(["in_approval", "needs_info", "mdm_review"]);
const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRIES.map((c) => c.code));

const isBlank = (v: FieldValue | undefined) => v === null || v === undefined || String(v).trim() === "";

/**
 * Fresh sandbox data for a visitor. The seed is built relative to the simulated base time
 * (default 09:00 SGT Wed 28 Oct 2026) and the clock then runs at real speed from realNowMs.
 */
export function freshSandboxData(simBaseIso: string = SIM_BASE_ISO, realNowMs: number = Date.now()): SandboxData {
  const config = cloneDefaultConfig();
  // Go-live is ~13 weeks before the sim start so the configuration history lines up with the seeded requests.
  const goLive = new Date(Date.parse(simBaseIso) - 92 * DAY_MS).toISOString().slice(0, 10) + "T01:00:00.000Z";
  config.history = config.history.map((h, i) => (i === 0 ? { ...h, at: goLive } : h));
  const seed = buildSeed(simBaseIso, config);
  return {
    personaId: "amy",
    clockOffsetMs: 0,
    config,
    ...seed,
    idCounter: Math.max(FIRST_ADHOC_REQUEST_NUMBER, nextRequestNumber(seed.requests)),
    reservedCodes: {},
    simBaseMs: Date.parse(simBaseIso),
    seededAtRealMs: realNowMs,
    lastUnblock: null,
  };
}

/** A fresh seeded snapshot (data only, no actions), e.g. as the base for a demo scene. */
export function getSeedSnapshot(): SandboxData {
  return freshSandboxData();
}

/** Same record name: normalised equality, or token-set ratio >= 0.9 when both names have >= 3 words. */
export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a ?? "");
  const nb = normalizeName(b ?? "");
  if (!na || !nb) return false;
  if (na === nb) return true;
  const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
  if (Math.min(words(na), words(nb)) < 3) return false;
  return tokenSetRatio(na, nb) >= 0.9;
}

function blockedSgd(prs: PurchaseRequest[]): number {
  return prs.reduce((a, p) => (p.status === "blocked" ? a + p.sgd : a), 0);
}

const sgdText = (n: number) => `S$${Math.round(n).toLocaleString("en-SG")}`;

function withAudit(chain: AuditEvent[], drafts: AuditDraft[]): AuditEvent[] {
  let next = chain;
  for (const d of drafts) next = appendAudit(next, d);
  return next;
}

function mkNotification(n: Omit<AppNotification, "id" | "read"> & { read?: boolean }): AppNotification {
  return { read: false, ...n, id: `ntf-${nanoid(10)}` };
}

function personName(config: AppConfig, id: string | undefined): string {
  if (!id) return "Someone";
  if (id === SYSTEM_ACTOR_ID) return "Tesseract automation";
  return config.people.find((p) => p.id === id)?.name ?? id;
}

function domainNoun(domain: DomainConfig | undefined): string {
  switch (domain?.sapObject) {
    case "oItems":
      return "item";
    case "oProfitCenter":
      return "cost centre";
    case "oBusinessPartners":
      return domain.codePrefix === "V" ? "vendor" : "customer";
    default:
      return "record";
  }
}

/** Why a person was passed over for an escalation, e.g. "Rachel Koh already holds Finance Director — credit limit above S$50k". */
function sodSkipText(config: AppConfig, req: MdmRequest, k: SodSkip): string {
  const who = personName(config, k.id);
  if (k.reason === "requestor") return `${who} raised ${req.id}`;
  if (k.reason === "requestor_delegate") return `${who} is ${personName(config, req.requestorId)}'s delegate`;
  const verb = k.stepStatus === "approved" ? "approved" : k.stepStatus === "rejected" ? "rejected" : "holds";
  return `${who} already ${verb} ${k.stepLabel ?? "another step on this request"}`;
}

function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Status of an open request from its steps. */
function openStatus(steps: ApprovalStep[]): RequestStatus {
  if (steps.some((s) => s.status === "question")) return "needs_info";
  const business = steps.filter((s) => s.stageId !== MDM_STAGE_ID);
  return business.every((s) => isFinalStatus(s.status)) ? "mdm_review" : "in_approval";
}

function deriveEntity(data: Record<string, FieldValue>, fallback: string): string {
  for (const k of ["entity", "extendToEntity"]) if (!isBlank(data[k])) return String(data[k]).trim();
  return fallback;
}

function deriveCountry(data: Record<string, FieldValue>, fallback: CountryCode): CountryCode {
  const direct = String(data.country ?? "").trim().toUpperCase();
  if (COUNTRY_SET.has(direct)) return direct as CountryCode;
  const fromCode = /^C-(SG|MY|TH|VN|MM)-/i.exec(String(data.existingCode ?? "").trim())?.[1]?.toUpperCase();
  if (fromCode) return fromCode as CountryCode;
  const firstMarket = String(data.countries ?? "").split(",")[0]?.trim().toUpperCase();
  if (firstMarket && COUNTRY_SET.has(firstMarket)) return firstMarket as CountryCode;
  return fallback;
}

function fail(reason: string): ActionResult {
  return { ok: false, reason, error: reason };
}

/** Extra context buildDtwFiles needs: for an extension, the entities the existing BP record already has. */
export function dtwOptionsFor(
  s: Pick<SandboxData, "sapRecords">,
  req: MdmRequest,
  domain: DomainConfig,
  code: string,
): { existingEntities?: string[] } | undefined {
  if (domain.id !== "extend") return undefined;
  return { existingEntities: entitiesOf(s.sapRecords.find((r) => r.code === code)) };
}

/** Replace one request in the list. */
function replaceRequest(list: MdmRequest[], next: MdmRequest): MdmRequest[] {
  return list.map((r) => (r.id === next.id ? next : r));
}

// =============================================================================================
// Persistence
// =============================================================================================

const PERSISTED_KEYS = [
  "personaId",
  "clockOffsetMs",
  "config",
  "requests",
  "prs",
  "audit",
  "notifications",
  "sapRecords",
  "idCounter",
  "reservedCodes",
  "simBaseMs",
  "seededAtRealMs",
  "lastUnblock",
] as const satisfies readonly (keyof SandboxData)[];

function partialize(s: SandboxState): SandboxData {
  const out = {} as Record<string, unknown>;
  for (const k of PERSISTED_KEYS) out[k] = s[k];
  return out as unknown as SandboxData;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Structural check of a persisted payload; anything that fails is replaced by a fresh seed. */
export function isValidSandboxData(v: unknown): v is SandboxData {
  if (!isObj(v)) return false;
  for (const k of ["requests", "prs", "audit", "notifications", "sapRecords"]) if (!Array.isArray(v[k])) return false;
  if (typeof v.personaId !== "string") return false;
  if (typeof v.clockOffsetMs !== "number" || !Number.isFinite(v.clockOffsetMs)) return false;
  if (typeof v.idCounter !== "number" || !Number.isFinite(v.idCounter)) return false;
  if (typeof v.simBaseMs !== "number" || !Number.isFinite(v.simBaseMs)) return false;
  if (typeof v.seededAtRealMs !== "number" || !Number.isFinite(v.seededAtRealMs)) return false;
  const c = v.config;
  if (!isObj(c) || typeof c.version !== "number" || !isObj(c.sla)) return false;
  for (const k of ["domains", "businessUnits", "people", "history"]) if (!Array.isArray(c[k])) return false;
  if ((c.domains as unknown[]).length === 0 || (c.people as unknown[]).length === 0) return false;
  const reqOk = (r: unknown) =>
    isObj(r) && typeof r.id === "string" && typeof r.domainId === "string" && typeof r.status === "string" && Array.isArray(r.steps) && isObj(r.data) && Array.isArray(r.blockedPrIds);
  if (!(v.requests as unknown[]).every(reqOk)) return false;
  const prOk = (p: unknown) => isObj(p) && typeof p.id === "string" && typeof p.status === "string" && typeof p.sgd === "number";
  if (!(v.prs as unknown[]).every(prOk)) return false;
  const evOk = (e: unknown) => isObj(e) && typeof e.seq === "number" && typeof e.hash === "string";
  if (!(v.audit as unknown[]).every(evOk)) return false;
  return true;
}

/** In-memory Storage stand-in when the browser blocks localStorage (privacy modes, disabled site data). */
function memoryStorage(): StateStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/** localStorage in the browser (probed), a memory fallback if it's blocked; throws on the server so persistence is off. */
function browserStorage(): StateStorage {
  if (typeof window === "undefined") throw new Error("No browser storage during server rendering");
  try {
    const ls = window.localStorage;
    const probe = "__tesseract_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

/** createJSONStorage(() => localStorage), hardened: unparsable JSON reads as empty (and is cleared), write failures never throw. */
function hardenedJsonStorage(): PersistStorage<SandboxData> | undefined {
  const inner = createJSONStorage<SandboxData>(() => browserStorage());
  if (!inner) return undefined;
  return {
    getItem: (name) => {
      try {
        return inner.getItem(name) as StorageValue<SandboxData> | null;
      } catch {
        try {
          inner.removeItem(name);
        } catch {
          /* storage unavailable: nothing to clear */
        }
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        inner.setItem(name, value);
      } catch {
        /* quota exceeded or storage revoked: keep working in memory */
      }
    },
    removeItem: (name) => {
      try {
        inner.removeItem(name);
      } catch {
        /* storage unavailable */
      }
    },
  };
}

/** Set when hydration produced a fresh seed that still needs writing to storage. */
let pendingPersist = false;
/** Assigned once the store exists (hydration runs synchronously inside create()). */
let storeApi: { getState(): SandboxState; setState(p: Partial<SandboxState>): void } | null = null;

function finishHydration(state: SandboxState | undefined, error: unknown) {
  if (!storeApi) return; // first, synchronous hydration: completed right after create()
  if (error || !state?.hydrated) {
    pendingPersist = false;
    storeApi.setState({ ...freshSandboxData(), hydrated: true });
    return;
  }
  if (pendingPersist) {
    pendingPersist = false;
    storeApi.setState({});
  }
}

// =============================================================================================
// Store
// =============================================================================================

const INITIAL_DATA: SandboxData = {
  personaId: "amy",
  clockOffsetMs: 0,
  config: DEFAULT_CONFIG,
  requests: [],
  prs: [],
  audit: [],
  notifications: [],
  sapRecords: [],
  idCounter: FIRST_ADHOC_REQUEST_NUMBER,
  reservedCodes: {},
  simBaseMs: SIM_BASE_MS,
  seededAtRealMs: 0,
  lastUnblock: null,
};

export const useSandbox = create<SandboxState>()(
  persist(
    (set, get) => {
      const now = () => new Date(simNowMs(get())).toISOString();
      const actor = () => get().personaId;
      const findReq = (id: string) => get().requests.find((r) => r.id === id);
      const domainOf = (id: string) => get().config.domains.find((d) => d.id === id);

      return {
        ...INITIAL_DATA,
        hydrated: false,

        setPersona(id) {
          if (get().config.people.some((p) => p.id === id)) set({ personaId: id });
        },

        nowIso: now,

        createDraft(domainId, initial = {}) {
          const s = get();
          const domain = domainOf(domainId);
          if (!domain) throw new Error(`Unknown request type "${domainId}"`);
          const person = s.config.people.find((p) => p.id === s.personaId) ?? s.config.people[0];
          const buIds = new Set(s.config.businessUnits.map((b) => b.id));
          const data: Record<string, FieldValue> = {};
          for (const f of domain.fields) {
            if (f.type === "country") data[f.key] = person.country;
            if (f.type === "entity" && buIds.has(person.entity)) data[f.key] = person.entity;
          }
          Object.assign(data, initial);
          const id = `REQ-${s.idCounter}`;
          const at = now();
          const req: MdmRequest = {
            id,
            domainId: domain.id,
            title: requestTitle(domain, data),
            requestorId: person.id,
            entity: deriveEntity(data, person.entity),
            country: deriveCountry(data, person.country),
            createdAt: at,
            status: "draft",
            data,
            configVersion: s.config.version,
            steps: [],
            blockedPrIds: [],
          };
          set({ requests: [...s.requests, req], idCounter: s.idCounter + 1 });
          return id;
        },

        updateDraft(id, patch, aiKeys) {
          const s = get();
          const req = findReq(id);
          if (!req || (req.status !== "draft" && req.status !== "needs_info")) return;
          const domain = domainOf(req.domainId);
          const data = { ...req.data, ...patch };
          const ai = new Set(req.aiFilledKeys ?? []);
          const aiNow = new Set(aiKeys ?? []);
          for (const k of Object.keys(patch)) if (!aiNow.has(k)) ai.delete(k);
          for (const k of aiNow) ai.add(k);
          const next: MdmRequest = {
            ...req,
            data,
            title: requestTitle(domain, data),
            entity: deriveEntity(data, req.entity),
            country: deriveCountry(data, req.country),
          };
          if (ai.size) next.aiFilledKeys = [...ai];
          else delete next.aiFilledKeys;

          const drafts: AuditDraft[] = [];
          const at = now();
          if (aiNow.size) {
            const labels = [...aiNow].map((k) => domain?.fields.find((f) => f.key === k)?.label ?? k);
            drafts.push({
              requestId: id,
              at,
              actorId: actor(),
              action: "ai_prefill",
              detail: `Paste-to-fill populated ${aiNow.size} field${aiNow.size === 1 ? "" : "s"}: ${labels.join(", ")}`,
            });
          }
          if (req.status === "needs_info") {
            const changed = Object.keys(patch).filter((k) => String(req.data[k] ?? "") !== String(patch[k] ?? ""));
            if (changed.length) {
              drafts.push({
                requestId: id,
                at,
                actorId: actor(),
                action: "field_updated",
                detail: `Updated ${changed.map((k) => domain?.fields.find((f) => f.key === k)?.label ?? k).join(", ")}`,
                before: maskedSnapshot(domain, req.data, changed),
                after: maskedSnapshot(domain, data, changed),
              });
            }
          }
          set({ requests: replaceRequest(s.requests, next), audit: withAudit(s.audit, drafts) });
        },

        setDuplicateDecision(id, d) {
          const s = get();
          const req = findReq(id);
          if (!req || req.status !== "draft") return;
          const next: MdmRequest = { ...req };
          if (d) next.duplicateDecision = { ...d, reasons: [...d.reasons] };
          else delete next.duplicateDecision;
          set({ requests: replaceRequest(s.requests, next) });
        },

        submitRequest(id) {
          const s = get();
          const req = findReq(id);
          if (!req) return { ok: false, errors: { _form: "Request not found" } };
          if (req.status !== "draft") return { ok: false, errors: { _form: `${req.id} has already been submitted` } };
          const domain = domainOf(req.domainId);
          if (!domain || !domain.enabled) return { ok: false, errors: { _form: "This request type is no longer available" } };

          const errors = { ...validateRequest(domain, req.data).errors };
          const dd = req.duplicateDecision;
          if (dd?.choice === "override" && isBlank(dd.justification ?? null)) {
            errors.duplicateJustification = "Explain why this is not a duplicate of the existing record";
          }
          if (dd?.choice === "use_existing") {
            errors._form = `Use the existing record ${dd.matchCode} instead of creating a new one`;
          }
          if (Object.keys(errors).length) return { ok: false, errors };

          const at = now();
          const bu = s.config.businessUnits.find((b) => b.id === req.entity);
          // Segregation of duties: a step that would land on the requestor (or their delegate) goes to their manager, else MDM.
          const requestor = s.config.people.find((p) => p.id === req.requestorId);
          const conflicted = new Set([req.requestorId, ...(requestor?.delegateId ? [requestor.delegateId] : [])]);
          const sodFallback =
            [requestor?.managerId, ...s.config.people.filter((p) => p.roles.includes("mdm")).map((p) => p.id)].find(
              (pid) => !!pid && !conflicted.has(pid) && s.config.people.some((p) => p.id === pid),
            ) ?? "";
          const sodMoves: { label: string; from: string; to: string }[] = [];
          const built = buildRoute({ domain, bu, data: req.data, people: s.config.people }).map((st) => {
            if (!conflicted.has(st.assigneeId) || !sodFallback) return st;
            sodMoves.push({ label: st.label, from: st.assigneeId, to: sodFallback });
            return { ...st, assigneeId: sodFallback, originalAssigneeId: st.originalAssigneeId ?? st.assigneeId };
          });
          const routed = activateNext(built, at);
          const expectedBy = expectedCompletion(routed, at, s.config.sla);
          // Auto-link: blocked purchase requests nobody has claimed yet, waiting on this item / customer name.
          const linkKey =
            domain.sapObject === "oItems"
              ? { prField: "itemName" as const, value: String(req.data.itemName ?? "") }
              : domain.sapObject === "oBusinessPartners" && domain.codePrefix !== "V" && domain.id !== "extend"
                ? { prField: "customerName" as const, value: String(req.data.customerName ?? "") }
                : null;
          const linked = linkKey
            ? s.prs.filter((p) => p.status === "blocked" && !p.blockedByRequestId && namesMatch(p[linkKey.prField], linkKey.value))
            : [];
          const linkedIds = new Set(linked.map((p) => p.id));
          const linkedSgd = linked.reduce((a, p) => a + p.sgd, 0);
          const prs = linked.length ? s.prs.map((p) => (linkedIds.has(p.id) ? { ...p, blockedByRequestId: id } : p)) : s.prs;

          const next: MdmRequest = {
            ...req,
            title: requestTitle(domain, req.data),
            submittedAt: at,
            status: openStatus(routed),
            steps: routed,
            expectedBy,
            configVersion: s.config.version,
            blockedPrIds: [...new Set([...req.blockedPrIds, ...linked.map((p) => p.id)])],
          };

          const drafts: AuditDraft[] = [];
          if (dd) {
            const pct = Math.round(dd.score * 100);
            drafts.push({
              requestId: id,
              at,
              actorId: actor(),
              action: dd.choice === "override" ? "duplicate_override" : dd.choice === "extend" ? "duplicate_extend" : "duplicate_use_existing",
              detail:
                dd.choice === "override"
                  ? `Possible duplicate ${dd.matchCode} ${dd.matchName} (${pct}%) overridden: “${dd.justification?.trim() ?? ""}”`
                  : `Possible duplicate ${dd.matchCode} ${dd.matchName} (${pct}%) → requested an extension`,
            });
          }
          const approvers = [...new Set(routed.filter((st) => st.stageId !== MDM_STAGE_ID).map((st) => personName(s.config, st.assigneeId)))];
          drafts.push({
            requestId: id,
            at,
            actorId: actor(),
            action: "submitted",
            detail: `Submitted · ${routed.length} approval steps${approvers.length ? ` (${approvers.join(", ")} + MDM)` : ""} · expected by ${expectedBy.slice(0, 10)}`,
            after: maskedSnapshot(domain, req.data),
          });
          for (const m of sodMoves) {
            drafts.push({
              requestId: id,
              at,
              actorId: SYSTEM_ACTOR_ID,
              action: "sod_reassigned",
              detail: `${m.label}: ${personName(s.config, m.from)} can't approve ${personName(s.config, req.requestorId)}'s own request (segregation of duties) → routed to ${personName(s.config, m.to)}`,
            });
          }
          if (linked.length) {
            drafts.push({
              requestId: id,
              at,
              actorId: SYSTEM_ACTOR_ID,
              action: "linked_waiting_orders",
              detail: `Linked ${linked.length} waiting order${linked.length === 1 ? "" : "s"} (${sgdText(linkedSgd)}): ${linked.map((p) => `${p.id} ${p.customerName}`).join(", ")} · released automatically when this is created in SAP B1`,
            });
          }
          for (const st of routed) {
            if (sodMoves.some((m) => m.label === st.label && m.to === st.assigneeId)) continue;
            if (st.originalAssigneeId && st.originalAssigneeId !== st.assigneeId) {
              drafts.push({
                requestId: id,
                at,
                actorId: SYSTEM_ACTOR_ID,
                action: "delegated",
                detail: `${st.label}: ${personName(s.config, st.originalAssigneeId)} is out of office → routed to ${personName(s.config, st.assigneeId)}`,
              });
            }
          }

          const requestorName = personName(s.config, req.requestorId);
          const notes: AppNotification[] = [];
          for (const st of routed.filter((x) => x.status === "pending")) {
            for (const n of approvalNotifications(next, st, requestorName, at)) notes.push(mkNotification(n));
          }
          notes.push(
            mkNotification({
              at,
              toId: req.requestorId,
              channel: "outlook",
              kind: "info",
              title: `We've received ${id}`,
              body: `${next.title} is with ${joinList(approvers) || "MDM"}. Expected in SAP B1 by ${expectedBy.slice(0, 10)}.${linked.length ? ` ${linked.length} waiting order${linked.length === 1 ? "" : "s"} (${sgdText(linkedSgd)}) ${linked.length === 1 ? "is" : "are"} linked and will be released the moment it's created.` : ""} Track it any time under My requests.`,
              requestId: id,
            }),
          );

          set({
            requests: replaceRequest(s.requests, next),
            prs,
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return { ok: true, errors: {} };
        },

        approveStep(requestId, stepId, comment) {
          const s = get();
          const req = findReq(requestId);
          if (!req) return fail("Request not found");
          if (!OPEN_STATUSES.has(req.status)) return fail(`${req.id} is ${req.status.replace("_", " ")}`);
          const step = req.steps.find((x) => x.id === stepId);
          if (!step) return fail("This step has already been decided");
          const sod = segregationCheck(req, step, actor(), s.config.people);
          if (!sod.ok) return fail(sod.reason!);
          const at = now();
          const { steps, outcome } = applyDecision(req.steps, stepId, "approved", at, comment);
          if (outcome === "noop") return fail("This step has already been decided");

          const next: MdmRequest = { ...req, steps, status: outcome === "completed" ? "mdm_review" : openStatus(steps) };
          const who = actor();
          const onBehalf = who !== step.assigneeId ? ` (recorded by ${personName(s.config, who)} for ${personName(s.config, step.assigneeId)})` : "";
          const drafts: AuditDraft[] = [
            {
              requestId,
              at,
              actorId: who,
              action: "approved",
              detail: `${step.label}${comment?.trim() ? ` · “${comment.trim()}”` : ""}${onBehalf}`,
            },
          ];

          const notes: AppNotification[] = [];
          const requestorName = personName(s.config, req.requestorId);
          for (const st of newlyActivated(req.steps, steps)) {
            for (const n of approvalNotifications(next, st, requestorName, at)) notes.push(mkNotification(n));
          }
          const done = steps.filter((x) => x.status === "approved" || x.status === "skipped").length;
          if (outcome === "business_approved") {
            const mdm = steps.find((x) => x.stageId === MDM_STAGE_ID);
            notes.push(
              mkNotification({
                at,
                toId: req.requestorId,
                channel: "teams",
                kind: "info",
                title: `${req.id} is fully approved`,
                body: `All business approvals are done. ${personName(s.config, mdm?.assigneeId)} (MDM) is doing the final check before creating it in SAP B1.`,
                requestId,
              }),
            );
          } else if (outcome === "completed") {
            notes.push(
              mkNotification({
                at,
                toId: req.requestorId,
                channel: "teams",
                kind: "info",
                title: `${req.id} passed the MDM final check`,
                body: `${next.title} is being created in SAP B1. You'll be notified the moment it's live.`,
                requestId,
              }),
            );
          } else {
            notes.push(
              mkNotification({
                at,
                toId: req.requestorId,
                channel: "teams",
                kind: "info",
                title: `${personName(s.config, step.assigneeId)} approved ${req.id}`,
                body: `${step.label} · ${done} of ${steps.length} steps done.${comment?.trim() ? ` “${comment.trim()}”` : ""}`,
                requestId,
                stepId,
              }),
            );
          }

          set({
            requests: replaceRequest(s.requests, next),
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return { ok: true };
        },

        rejectStep(requestId, stepId, comment) {
          const s = get();
          const req = findReq(requestId);
          if (!req) return fail("Request not found");
          if (!OPEN_STATUSES.has(req.status)) return fail(`${req.id} is ${req.status.replace("_", " ")}`);
          if (isBlank(comment ?? null)) return fail("Give the requestor a reason for rejecting");
          const step = req.steps.find((x) => x.id === stepId);
          if (!step) return fail("This step has already been decided");
          const sod = segregationCheck(req, step, actor(), s.config.people);
          if (!sod.ok) return fail(sod.reason!);
          const at = now();
          const { steps, outcome } = applyDecision(req.steps, stepId, "rejected", at, comment);
          if (outcome === "noop") return fail("This step has already been decided");

          const reason = comment.trim();
          const next: MdmRequest = { ...req, steps, status: "rejected", closedAt: at };
          const who = actor();
          const drafts: AuditDraft[] = [
            { requestId, at, actorId: who, action: "rejected", detail: `${step.label} · “${reason}”` },
          ];
          const notes: AppNotification[] = (["teams", "outlook"] as const).map((channel) =>
            mkNotification({
              at,
              toId: req.requestorId,
              channel,
              kind: "rejected",
              title: `${req.id} was rejected`,
              body: `${personName(s.config, step.assigneeId)} rejected ${req.title}: “${reason}”`,
              requestId,
              stepId,
            }),
          );
          // Other approvers who still had it open no longer need to act.
          for (const before of req.steps) {
            if (before.id === stepId || (before.status !== "pending" && before.status !== "question")) continue;
            notes.push(
              mkNotification({
                at,
                toId: before.assigneeId,
                channel: "teams",
                kind: "info",
                title: `${req.id} was rejected — no action needed`,
                body: `${personName(s.config, step.assigneeId)} rejected ${req.title}, so your step (${before.label}) was closed.`,
                requestId,
                stepId: before.id,
              }),
            );
          }
          const { [requestId]: _reserved, ...reservedCodes } = s.reservedCodes;
          void _reserved;
          set({
            requests: replaceRequest(s.requests, next),
            reservedCodes,
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return { ok: true };
        },

        askQuestion(requestId, stepId, text) {
          const s = get();
          const req = findReq(requestId);
          if (!req) return fail("Request not found");
          if (!OPEN_STATUSES.has(req.status)) return fail(`${req.id} is ${req.status.replace("_", " ")}`);
          if (isBlank(text ?? null)) return fail("Type your question");
          const step = req.steps.find((x) => x.id === stepId);
          if (!step || step.status !== "pending") return fail("Questions can only be asked on a pending step");
          const at = now();
          const question = text.trim();
          const steps = req.steps.map((x) =>
            x.id === stepId ? { ...x, status: "question" as const, pausedAt: at, question: { text: question, askedAt: at } } : x,
          );
          const next: MdmRequest = { ...req, steps, status: "needs_info" };
          const asker = personName(s.config, step.assigneeId);
          const drafts: AuditDraft[] = [
            { requestId, at, actorId: actor(), action: "question", detail: `${step.label} · “${question}” · SLA clock paused` },
          ];
          const notes = (["teams", "outlook"] as const).map((channel) =>
            mkNotification({
              at,
              toId: req.requestorId,
              channel,
              kind: "question",
              title: `${asker} has a question on ${req.id}`,
              body: `“${question}” Reply here; the answer goes straight back to ${asker}. The step's SLA clock is paused until you answer.`,
              requestId,
              stepId,
            }),
          );
          set({
            requests: replaceRequest(s.requests, next),
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return { ok: true };
        },

        answerQuestion(requestId, stepId, answer) {
          const s = get();
          const req = findReq(requestId);
          if (!req) return fail("Request not found");
          if (isBlank(answer ?? null)) return fail("Type your answer");
          const step = req.steps.find((x) => x.id === stepId);
          if (!step || step.status !== "question") return fail("There is no open question on this step");
          const at = now();
          const reply = answer.trim();
          const paused = step.pausedAt ? Math.max(0, Date.parse(at) - Date.parse(step.pausedAt)) : 0;
          const steps = req.steps.map((x) => {
            if (x.id !== stepId) return x;
            const answered: ApprovalStep = {
              ...x,
              status: "pending",
              pausedMs: (x.pausedMs || 0) + (Number.isFinite(paused) ? paused : 0),
              question: x.question ? { ...x.question, answer: reply, answeredAt: at } : { text: "", askedAt: at, answer: reply, answeredAt: at },
            };
            delete answered.pausedAt;
            return answered;
          });
          const next: MdmRequest = { ...req, steps, status: openStatus(steps) };
          const pausedHours = Math.round((paused / HOUR_MS) * 10) / 10;
          const drafts: AuditDraft[] = [
            {
              requestId,
              at,
              actorId: actor(),
              action: "answered",
              detail: `“${reply}” · back with ${personName(s.config, step.assigneeId)} · clock paused ${pausedHours}h`,
            },
          ];
          const answerer = personName(s.config, actor());
          const notes = (["teams", "outlook"] as const).map((channel) =>
            mkNotification({
              at,
              toId: step.assigneeId,
              channel,
              kind: "answer",
              title: `${answerer} answered your question on ${req.id}`,
              body: `“${reply}” Your step (${step.label}) is active again — approve, reject or ask a follow-up.`,
              requestId,
              stepId,
            }),
          );
          set({
            requests: replaceRequest(s.requests, next),
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return { ok: true };
        },

        fastForward(hours) {
          const s = get();
          const h = Number.isFinite(hours) ? Math.max(0, hours) : 0;
          const clockOffsetMs = s.clockOffsetMs + h * HOUR_MS;
          const at = new Date(simNowMs({ ...s, clockOffsetMs })).toISOString();
          const { sla, people } = s.config;
          const drafts: AuditDraft[] = [];
          const notes: AppNotification[] = [];
          let reminders = 0;
          let escalations = 0;

          const requests = s.requests.map((req) => {
            if (!OPEN_STATUSES.has(req.status)) return req;
            const { steps, events } = slaTick(req, at, sla, people);
            if (!events.length) return req;
            for (const ev of events) {
              const step = steps.find((x) => x.id === ev.stepId);
              const label = step?.label ?? "Approval step";
              if (ev.kind === "reminder") {
                reminders++;
                drafts.push({
                  requestId: req.id,
                  at,
                  actorId: SYSTEM_ACTOR_ID,
                  action: "reminder",
                  detail: `Reminder sent to ${personName(s.config, ev.toId)} · ${label} · ${sla.reminderAfterBusinessDays} business day without a decision`,
                });
                notes.push(
                  mkNotification({
                    at,
                    toId: ev.toId,
                    channel: "teams",
                    kind: "reminder",
                    title: `Reminder · ${req.id} is waiting on you`,
                    body: `${req.title} has been with you for ${sla.reminderAfterBusinessDays} business day. It escalates after ${sla.escalateAfterBusinessDays}.`,
                    requestId: req.id,
                    stepId: ev.stepId,
                  }),
                );
              } else {
                escalations++;
                const from = ev.fromId ?? step?.originalAssigneeId ?? "";
                const reassigned = !!step && step.assigneeId === ev.toId && ev.toId !== from;
                const toName = personName(s.config, ev.toId);
                const fromName = personName(s.config, from);
                // Segregation of duties: who was passed over, and why (empty when the plain delegate/manager rule applied).
                const sodWhy = ev.skipped?.length ? `segregation of duties: ${ev.skipped.map((k) => sodSkipText(s.config, req, k)).join("; ")}` : "";
                drafts.push({
                  requestId: req.id,
                  at,
                  actorId: SYSTEM_ACTOR_ID,
                  action: "escalated",
                  detail: reassigned
                    ? `${label}: no decision after ${sla.escalateAfterBusinessDays} business days → reassigned from ${fromName} to ${toName}${sodWhy ? ` (${sodWhy})` : ""}`
                    : sodWhy
                      ? `${label}: no decision after ${sla.escalateAfterBusinessDays} business days → ${toName} (MDM) alerted; ${fromName}'s delegate or manager can't take it over (${sodWhy})`
                      : `${label}: no decision after ${sla.escalateAfterBusinessDays} business days → ${toName} (MDM) alerted; ${fromName} has no delegate or manager`,
                });
                notes.push(
                  mkNotification({
                    at,
                    toId: ev.toId,
                    channel: "teams",
                    kind: "escalation",
                    title: reassigned ? `Escalated to you · ${req.id}` : `Stalled approval · ${req.id}`,
                    body: reassigned
                      ? `${fromName} hasn't acted on ${req.title} for ${sla.escalateAfterBusinessDays} business days, so ${label} is now yours.`
                      : sodWhy
                        ? `${label} on ${req.title} has waited ${sla.escalateAfterBusinessDays} business days with ${fromName}, and their delegate or manager can't take it over (${sodWhy}).`
                        : `${label} on ${req.title} has waited ${sla.escalateAfterBusinessDays} business days with ${fromName}, who has no delegate or manager on file.`,
                    requestId: req.id,
                    stepId: ev.stepId,
                  }),
                );
                if (from) {
                  notes.push(
                    mkNotification({
                      at,
                      toId: from,
                      channel: "outlook",
                      kind: "escalation",
                      title: `${req.id} was escalated`,
                      body: reassigned
                        ? `${label} on ${req.title} had no decision for ${sla.escalateAfterBusinessDays} business days and has been reassigned to ${toName}.`
                        : `${label} on ${req.title} had no decision for ${sla.escalateAfterBusinessDays} business days; MDM has been alerted.`,
                      requestId: req.id,
                      stepId: ev.stepId,
                    }),
                  );
                }
                notes.push(
                  mkNotification({
                    at,
                    toId: req.requestorId,
                    channel: "teams",
                    kind: "info",
                    title: `${req.id} was escalated`,
                    body: reassigned
                      ? `${label} moved from ${fromName} to ${toName} after ${sla.escalateAfterBusinessDays} business days, so your request keeps moving.`
                      : `${label} has waited ${sla.escalateAfterBusinessDays} business days; MDM is chasing it.`,
                    requestId: req.id,
                    stepId: ev.stepId,
                  }),
                );
              }
            }
            return { ...req, steps };
          });

          set({
            clockOffsetMs,
            requests,
            audit: withAudit(s.audit, drafts),
            notifications: notes.length ? [...notes.reverse(), ...s.notifications] : s.notifications,
          });
          return { reminders, escalations };
        },

        setOutOfOffice(personId, delegateId) {
          const s = get();
          const person = s.config.people.find((p) => p.id === personId);
          if (!person) return;
          if (delegateId !== null && (delegateId === personId || !s.config.people.some((p) => p.id === delegateId))) return;
          const at = now();
          const people: Person[] = s.config.people.map((p) =>
            p.id === personId ? { ...p, outOfOffice: delegateId !== null, delegateId: delegateId ?? p.delegateId } : p,
          );
          const drafts: AuditDraft[] = [];
          const notes: AppNotification[] = [];
          let requests = s.requests;

          if (delegateId === null) {
            drafts.push({ requestId: "CONFIG", at, actorId: actor(), action: "out_of_office_cleared", detail: `${person.name} is back in office` });
          } else {
            const delegateName = personName(s.config, delegateId);
            drafts.push({
              requestId: "CONFIG",
              at,
              actorId: actor(),
              action: "out_of_office_set",
              detail: `${person.name} is out of office · approvals go to ${delegateName}`,
            });
            requests = s.requests.map((req) => {
              if (!OPEN_STATUSES.has(req.status)) return req;
              let moved = false;
              const steps = req.steps.map((st) => {
                if (st.assigneeId !== personId || (st.status !== "pending" && st.status !== "waiting")) return st;
                moved = true;
                const reassigned: ApprovalStep = { ...st, assigneeId: delegateId, originalAssigneeId: st.originalAssigneeId ?? personId };
                if (st.status === "pending") {
                  for (const n of approvalNotifications(req, reassigned, personName(s.config, req.requestorId), at)) notes.push(mkNotification(n));
                }
                drafts.push({
                  requestId: req.id,
                  at,
                  actorId: actor(),
                  action: "delegated",
                  detail: `${st.label}: ${person.name} is out of office → ${delegateName}`,
                });
                return reassigned;
              });
              return moved ? { ...req, steps } : req;
            });
          }
          set({
            config: { ...s.config, people },
            requests,
            audit: withAudit(s.audit, drafts),
            notifications: notes.length ? [...notes, ...s.notifications] : s.notifications,
          });
        },

        logSensitiveReveal(requestId, fieldKey) {
          const s = get();
          const req = findReq(requestId);
          const domain = req ? domainOf(req.domainId) : undefined;
          const label =
            domain?.fields.find((f) => f.key === fieldKey)?.label ??
            s.config.domains.flatMap((d) => d.fields).find((f) => f.key === fieldKey || f.sapField === fieldKey)?.label ??
            fieldKey;
          set({
            audit: withAudit(s.audit, [
              { requestId, at: now(), actorId: actor(), action: "sensitive_revealed", detail: `Revealed ${label} (masked by default)` },
            ]),
          });
        },

        generateDtw(requestId) {
          const s = get();
          const req = findReq(requestId);
          if (!req || (req.status !== "mdm_review" && req.status !== "created")) return [];
          const domain = domainOf(req.domainId);
          if (!domain) return [];
          const code = req.sapCode ?? s.reservedCodes[req.id] ?? assignSapCode(domain, req, knownSapCodes(s, req.id));
          const files = buildDtwFiles(req, domain, code, dtwOptionsFor(s, req, domain, code));
          if (req.status === "mdm_review" && (!req.dtwGeneratedAt || !s.reservedCodes[req.id])) {
            const at = now();
            set({
              requests: replaceRequest(s.requests, { ...req, dtwGeneratedAt: req.dtwGeneratedAt ?? at }),
              reservedCodes: { ...s.reservedCodes, [req.id]: code },
              audit: withAudit(s.audit, [
                {
                  requestId,
                  at,
                  actorId: actor(),
                  action: "dtw_generated",
                  detail: `DTW import generated for ${code}: ${files.map((f) => f.fileName).join(", ")}`,
                },
              ]),
            });
          }
          return files;
        },

        markCreatedInSap(requestId) {
          const s = get();
          const req = findReq(requestId);
          if (!req) return { ok: false, reason: `Request ${requestId} not found` };
          const domain = domainOf(req.domainId);
          if (!domain) return { ok: false, reason: `${requestId} uses a request type that no longer exists` };
          if (req.status === "created" && req.sapCode) {
            const existing = s.sapRecords.find((r) => r.code === req.sapCode);
            if (existing) return { ok: true, record: existing };
          }
          if (req.status !== "mdm_review") {
            return { ok: false, reason: `${requestId} is not ready for SAP B1 (status: ${req.status.replace("_", " ")})` };
          }
          const who = actor();
          const sod = segregationCheck(req, "create_in_sap", who, s.config.people);
          if (!sod.ok) return { ok: false, reason: sod.reason };

          const at = now();
          const code = s.reservedCodes[req.id] ?? assignSapCode(domain, req, knownSapCodes(s, req.id));
          const drafts: AuditDraft[] = [];

          // Creating the record completes MDM's final check if it hasn't been approved explicitly.
          let steps = req.steps;
          const mdmOpen = steps.find((x) => x.stageId === MDM_STAGE_ID && (x.status === "pending" || x.status === "question"));
          if (mdmOpen) {
            steps = applyDecision(steps, mdmOpen.id, "approved", at, "Final check passed").steps;
            drafts.push({ requestId, at, actorId: who, action: "approved", detail: `${mdmOpen.label} · “Final check passed”` });
          }

          // SAP B1 record.
          let record: SapRecord;
          let sapRecords: SapRecord[];
          const idx = domain.id === "extend" ? s.sapRecords.findIndex((r) => r.code === code) : -1;
          let extendChange = "";
          if (idx >= 0) {
            const before = s.sapRecords[idx];
            record = applyExtension(before, req.data, req.id);
            sapRecords = s.sapRecords.map((r, i) => (i === idx ? record : r));
            const parts = [`U_Entities ${entitiesOf(before).join(", ") || "—"} → ${entitiesOf(record).join(", ")}`];
            if (record.fields.PayTermsGrpCode !== before.fields.PayTermsGrpCode) parts.push("payment terms updated");
            if (record.fields.CreditLimit !== before.fields.CreditLimit) parts.push("credit limit updated");
            if (record.fields.U_ShipToAddress !== before.fields.U_ShipToAddress) parts.push("ship-to address added");
            extendChange = parts.join("; ");
          } else {
            record = {
              code,
              object: domain.sapObject,
              name: recordName(domain.id, req.data) || req.title,
              createdAt: at,
              requestId: req.id,
              fields: sapFieldsFor(domain, req, code),
            };
            sapRecords = [...s.sapRecords, record];
          }

          // Release the demand that was waiting on this record.
          const field = unblockField(domain);
          const blocked = new Set(req.blockedPrIds);
          const released: PurchaseRequest[] = [];
          const prs = s.prs.map((p) => {
            if (p.status !== "blocked" || (p.blockedByRequestId !== req.id && !blocked.has(p.id))) return p;
            const open: PurchaseRequest = { ...p, status: "open", ...(field ? { [field]: code } : {}) };
            released.push(open);
            return open;
          });
          const releasedSgd = released.reduce((a, p) => a + p.sgd, 0);
          const lastUnblock: LastUnblock | null = released.length
            ? { beforeSgd: blockedSgd(s.prs), afterSgd: blockedSgd(prs), at, requestId: req.id }
            : s.lastUnblock;

          const { [req.id]: _reserved, ...reservedCodes } = s.reservedCodes;
          void _reserved;
          const next: MdmRequest = { ...req, steps, status: "created", sapCode: code, sapCreatedAt: at, closedAt: at };

          const noun = domainNoun(domain);
          drafts.push({
            requestId,
            at,
            actorId: who,
            action: "created_in_sap",
            detail:
              (domain.id === "extend"
                ? `${code} updated in SAP B1 (same code, DTW update): extended to ${String(req.data.extendToEntity ?? req.entity)}${extendChange ? ` · ${extendChange}` : ""}`
                : `${code} created in SAP B1 via DTW import`) +
              (released.length
                ? ` · ${released.length} purchase request${released.length === 1 ? "" : "s"} released (S$${releasedSgd.toLocaleString("en-SG")})`
                : ""),
          });

          const prPhrase = joinList(released.map((p) => `${p.customerName}'s ${p.id}`));
          const headline =
            domain.id === "extend"
              ? `${record.name} (${code}) is now set up for ${String(req.data.extendToEntity ?? req.entity)} in SAP B1`
              : `Your ${noun} ${code} is live in SAP B1`;
          const body = released.length
            ? `${headline} — ${prPhrase} can now be converted.`
            : `${headline} (${record.name}) and ready to use.`;
          const notes = (["teams", "outlook"] as const).map((channel) =>
            mkNotification({
              at,
              toId: req.requestorId,
              channel,
              kind: "created",
              title: `${code} is live in SAP B1`,
              body,
              requestId,
            }),
          );

          set({
            requests: replaceRequest(s.requests, next),
            sapRecords,
            prs,
            reservedCodes,
            lastUnblock,
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return { ok: true, record };
        },

        markNotificationRead(id) {
          const s = get();
          if (!s.notifications.some((n) => n.id === id && !n.read)) return;
          set({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
        },

        markAllNotificationsRead(channel) {
          const s = get();
          const mine = (n: AppNotification) => n.toId === s.personaId && !n.read && (!channel || n.channel === channel);
          if (!s.notifications.some(mine)) return;
          set({ notifications: s.notifications.map((n) => (mine(n) ? { ...n, read: true } : n)) });
        },

        cancelRequest(id, reason) {
          const s = get();
          const req = findReq(id);
          if (!req) return fail("Request not found");
          if (req.status !== "draft" && !OPEN_STATUSES.has(req.status)) {
            return fail(`${req.id} is already ${req.status.replace("_", " ")}`);
          }
          const at = now();
          const steps = req.steps.map((st) => (isFinalStatus(st.status) ? st : { ...st, status: "skipped" as const }));
          const next: MdmRequest = { ...req, steps, status: "cancelled", closedAt: at };
          const dd = req.duplicateDecision;
          const usedExisting = dd?.choice === "use_existing";
          const detail = reason?.trim()
            ? reason.trim()
            : usedExisting
              ? `Used the existing record ${dd!.matchCode} ${dd!.matchName} instead of creating a duplicate`
              : "Withdrawn by the requestor";
          const drafts: AuditDraft[] = [
            { requestId: id, at, actorId: actor(), action: usedExisting ? "duplicate_use_existing" : "cancelled", detail },
          ];
          const notes: AppNotification[] = [];
          for (const st of req.steps) {
            if (st.status !== "pending" && st.status !== "question") continue;
            notes.push(
              mkNotification({
                at,
                toId: st.assigneeId,
                channel: "teams",
                kind: "info",
                title: `${req.id} was withdrawn`,
                body: `${personName(s.config, req.requestorId)} withdrew ${req.title}. No action needed.`,
                requestId: id,
                stepId: st.id,
              }),
            );
          }
          const { [id]: _reserved, ...reservedCodes } = s.reservedCodes;
          void _reserved;
          set({
            requests: replaceRequest(s.requests, next),
            reservedCodes,
            audit: withAudit(s.audit, drafts),
            notifications: notes.length ? [...notes, ...s.notifications] : s.notifications,
          });
          return { ok: true };
        },

        updateConfig(next, summary) {
          const s = get();
          if (!next || !Array.isArray(next.domains) || !Array.isArray(next.people) || !Array.isArray(next.businessUnits) || !next.sla) return;
          if (next.people.length === 0 || next.domains.length === 0) return;
          const at = now();
          const version = s.config.version + 1;
          const text = summary?.trim() || "Configuration updated";
          const config: AppConfig = {
            ...next,
            version,
            history: [...s.config.history, { version, at, byId: actor(), summary: text }],
          };
          set({
            config,
            personaId: config.people.some((p) => p.id === s.personaId) ? s.personaId : config.people[0].id,
            audit: withAudit(s.audit, [
              {
                requestId: "CONFIG",
                at,
                actorId: actor(),
                action: "config_changed",
                detail: `v${version} · ${text}`,
                before: { version: s.config.version },
                after: { version },
              },
            ]),
          });
        },

        resetSandbox() {
          pendingPersist = false;
          set({ ...freshSandboxData(), hydrated: true });
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: hardenedJsonStorage(),
      partialize,
      migrate: () => {
        // Any other version: start the visitor on a fresh scenario.
        return freshSandboxData();
      },
      merge: (persisted, current) => {
        try {
          if (isValidSandboxData(persisted)) {
            const data = persisted;
            const personaOk = data.config.people.some((p) => p.id === data.personaId);
            const lu = (data as Partial<SandboxData>).lastUnblock;
            return {
              ...current,
              ...data,
              reservedCodes: isObj(data.reservedCodes) ? (data.reservedCodes as Record<string, string>) : {},
              lastUnblock: isObj(lu) && typeof lu.beforeSgd === "number" && typeof lu.afterSgd === "number" ? lu : null,
              personaId: personaOk ? data.personaId : data.config.people[0].id,
              hydrated: true,
            };
          }
        } catch {
          /* unreadable payload: reseed below */
        }
        pendingPersist = true;
        return { ...current, ...freshSandboxData(), hydrated: true };
      },
      onRehydrateStorage: () => finishHydration,
    },
  ),
);

storeApi = useSandbox;

// Complete the first (synchronous) hydration now that the store exists.
if (typeof window !== "undefined") {
  if (!useSandbox.getState().hydrated) {
    pendingPersist = false;
    useSandbox.setState({ ...freshSandboxData(), hydrated: true });
  } else if (pendingPersist) {
    pendingPersist = false;
    useSandbox.setState({});
  }
}

const subscribeHydration = (cb: () => void) => useSandbox.subscribe(cb);
const hydratedSnapshot = () => useSandbox.getState().hydrated;
const serverSnapshot = () => false;

/**
 * True once the sandbox has loaded from localStorage (or been seeded) in the browser.
 * Always false on the server and during the hydration render, so gated markup never mismatches.
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, hydratedSnapshot, serverSnapshot);
}

const DATA_KEYS: ReadonlySet<string> = new Set<string>(PERSISTED_KEYS);

/**
 * Merge a partial sandbox (e.g. a demo scene built from getSeedSnapshot()) into the store and persist it.
 * Only data keys are applied (actions are ignored); the store is marked hydrated.
 */
export function loadState(partial: Partial<SandboxState>): void {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(partial ?? {})) if (DATA_KEYS.has(k) && v !== undefined) patch[k] = v;
  pendingPersist = false;
  useSandbox.setState({ ...(patch as Partial<SandboxState>), hydrated: true });
}
