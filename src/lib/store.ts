/**
 * OneRecord sandbox store: every piece of mutable demo state, persisted per visitor in localStorage.
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
import { slaTick } from "@/lib/engine/sla";
import { appendAudit } from "@/lib/engine/audit";
import { assignSapCode } from "@/lib/engine/codes";
import { buildDtwFiles } from "@/lib/engine/dtw";

// =============================================================================================
// Types
// =============================================================================================

export const STORAGE_KEY = "onerecord-sandbox-v1";
export const STORAGE_VERSION = 1;

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
}

export interface ActionResult {
  ok: boolean;
  error?: string;
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
  /** No-op (ok: false) when the step is not pending/question, e.g. a double click or a stale tab. */
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
  /** Creates the SAP B1 record, releases blocked PRs and notifies the requestor. Throws if not at MDM review. */
  markCreatedInSap(requestId: string): SapRecord;
  markNotificationRead(id: string): void;
  /** Marks the current persona's notifications read (optionally one channel). */
  markAllNotificationsRead(channel?: AppNotification["channel"]): void;
  /** Withdraw a draft or an in-flight request. */
  cancelRequest(id: string, reason?: string): ActionResult;
  /** Saves a new config version; in-flight requests keep the route they started with. */
  updateConfig(next: AppConfig, summary: string): void;
  /** Fresh seed, real time, Amy as persona. */
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

function simulatedNow(offsetMs: number): string {
  return new Date(Date.now() + (Number.isFinite(offsetMs) ? offsetMs : 0)).toISOString();
}

/** Fresh sandbox data for a visitor, relative to real time. */
export function freshSandboxData(nowIso: string = new Date().toISOString()): SandboxData {
  const config = cloneDefaultConfig();
  // Go-live is ~13 weeks before today so the configuration history lines up with the seeded requests.
  const goLive = new Date(Date.parse(nowIso) - 92 * DAY_MS).toISOString().slice(0, 10) + "T01:00:00.000Z";
  config.history = config.history.map((h, i) => (i === 0 ? { ...h, at: goLive } : h));
  const seed = buildSeed(nowIso, config);
  return {
    personaId: "amy",
    clockOffsetMs: 0,
    config,
    ...seed,
    idCounter: nextRequestNumber(seed.requests),
    reservedCodes: {},
  };
}

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
  if (id === SYSTEM_ACTOR_ID) return "OneRecord automation";
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
    const probe = "__onerecord_probe__";
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
  idCounter: 1001,
  reservedCodes: {},
};

export const useSandbox = create<SandboxState>()(
  persist(
    (set, get) => {
      const now = () => simulatedNow(get().clockOffsetMs);
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
          const routed = activateNext(buildRoute({ domain, bu, data: req.data, people: s.config.people }), at);
          const expectedBy = expectedCompletion(routed, at, s.config.sla);
          const next: MdmRequest = {
            ...req,
            title: requestTitle(domain, req.data),
            submittedAt: at,
            status: openStatus(routed),
            steps: routed,
            expectedBy,
            configVersion: s.config.version,
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
          for (const st of routed) {
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
              body: `${next.title} is with ${joinList(approvers) || "MDM"}. Expected in SAP B1 by ${expectedBy.slice(0, 10)}. Track it any time under My requests.`,
              requestId: id,
            }),
          );

          set({
            requests: replaceRequest(s.requests, next),
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return { ok: true, errors: {} };
        },

        approveStep(requestId, stepId, comment) {
          const s = get();
          const req = findReq(requestId);
          if (!req) return { ok: false, error: "Request not found" };
          if (!OPEN_STATUSES.has(req.status)) return { ok: false, error: `${req.id} is ${req.status.replace("_", " ")}` };
          const step = req.steps.find((x) => x.id === stepId);
          const at = now();
          const { steps, outcome } = applyDecision(req.steps, stepId, "approved", at, comment);
          if (outcome === "noop" || !step) return { ok: false, error: "This step has already been decided" };

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
          if (!req) return { ok: false, error: "Request not found" };
          if (!OPEN_STATUSES.has(req.status)) return { ok: false, error: `${req.id} is ${req.status.replace("_", " ")}` };
          if (isBlank(comment ?? null)) return { ok: false, error: "Give the requestor a reason for rejecting" };
          const step = req.steps.find((x) => x.id === stepId);
          const at = now();
          const { steps, outcome } = applyDecision(req.steps, stepId, "rejected", at, comment);
          if (outcome === "noop" || !step) return { ok: false, error: "This step has already been decided" };

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
          if (!req) return { ok: false, error: "Request not found" };
          if (!OPEN_STATUSES.has(req.status)) return { ok: false, error: `${req.id} is ${req.status.replace("_", " ")}` };
          if (isBlank(text ?? null)) return { ok: false, error: "Type your question" };
          const step = req.steps.find((x) => x.id === stepId);
          if (!step || step.status !== "pending") return { ok: false, error: "Questions can only be asked on a pending step" };
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
          if (!req) return { ok: false, error: "Request not found" };
          if (isBlank(answer ?? null)) return { ok: false, error: "Type your answer" };
          const step = req.steps.find((x) => x.id === stepId);
          if (!step || step.status !== "question") return { ok: false, error: "There is no open question on this step" };
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
          const at = simulatedNow(clockOffsetMs);
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
                drafts.push({
                  requestId: req.id,
                  at,
                  actorId: SYSTEM_ACTOR_ID,
                  action: "escalated",
                  detail: reassigned
                    ? `${label}: no decision after ${sla.escalateAfterBusinessDays} business days → reassigned from ${fromName} to ${toName}`
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
          const files = buildDtwFiles(req, domain, code);
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
          if (!req) throw new Error(`Request ${requestId} not found`);
          const domain = domainOf(req.domainId);
          if (!domain) throw new Error(`${requestId} uses a request type that no longer exists`);
          if (req.status === "created" && req.sapCode) {
            const existing = s.sapRecords.find((r) => r.code === req.sapCode);
            if (existing) return existing;
          }
          if (req.status !== "mdm_review") {
            throw new Error(`${requestId} is not ready for SAP B1 (status: ${req.status.replace("_", " ")})`);
          }

          const at = now();
          const who = actor();
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
          if (idx >= 0) {
            record = applyExtension(s.sapRecords[idx], req.data, req.id);
            sapRecords = s.sapRecords.map((r, i) => (i === idx ? record : r));
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
                ? `${code} extended to ${String(req.data.extendToEntity ?? req.entity)} in SAP B1`
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
            audit: withAudit(s.audit, drafts),
            notifications: [...notes, ...s.notifications],
          });
          return record;
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
          if (!req) return { ok: false, error: "Request not found" };
          if (req.status !== "draft" && !OPEN_STATUSES.has(req.status)) {
            return { ok: false, error: `${req.id} is already ${req.status.replace("_", " ")}` };
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
        if (isValidSandboxData(persisted)) {
          const data = persisted;
          const personaOk = data.config.people.some((p) => p.id === data.personaId);
          return {
            ...current,
            ...data,
            reservedCodes: isObj(data.reservedCodes) ? (data.reservedCodes as Record<string, string>) : {},
            personaId: personaOk ? data.personaId : data.config.people[0].id,
            hydrated: true,
          };
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
