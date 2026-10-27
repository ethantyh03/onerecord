/**
 * Pure selectors over the sandbox state, plus React hooks that memoise them.
 *
 * Selectors that build new arrays/objects (selectWaitingOn, selectStuckDemand, …) must NOT be passed straight
 * to useSandbox(selector): zustand would see a new value on every render. Use the hooks below instead
 * (useWaitingOn, useStuckDemand, …), or wrap with useMemo over useSandbox().
 */
import { useEffect, useMemo, useState } from "react";
import type {
  AppNotification,
  ApprovalStep,
  AuditEvent,
  BusinessUnit,
  CountryCode,
  DomainConfig,
  DtwFile,
  MdmRequest,
  Person,
  PurchaseRequest,
  RequestStatus,
} from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { SYSTEM_ACTOR_ID, SYSTEM_PERSON } from "@/config/people";
import { knownSapCodes } from "@/lib/seed";
import { useSandbox, type SandboxState } from "@/lib/store";
import { addBusinessDays, businessDaysBetween, stepElapsedBusinessDays } from "@/lib/engine/sla";
import { assignSapCode } from "@/lib/engine/codes";
import { buildDtwFiles } from "@/lib/engine/dtw";

/** Any object carrying the sandbox data (the store state, or a test fixture). */
export type SandboxView = Pick<
  SandboxState,
  "personaId" | "clockOffsetMs" | "config" | "requests" | "prs" | "audit" | "notifications" | "sapRecords" | "reservedCodes"
>;

const DAY_MS = 86_400_000;
const IN_FLIGHT: ReadonlySet<RequestStatus> = new Set<RequestStatus>(["in_approval", "needs_info", "mdm_review"]);
const ALL_STATUSES: RequestStatus[] = ["draft", "in_approval", "needs_info", "rejected", "mdm_review", "created", "cancelled"];

// =============================================================================================
// Basics
// =============================================================================================

/** Simulated "now" for this state (real time + fast-forward offset). */
export function selectNow(s: Pick<SandboxView, "clockOffsetMs">): string {
  return new Date(Date.now() + (Number.isFinite(s.clockOffsetMs) ? s.clockOffsetMs : 0)).toISOString();
}

/** Person by id. "system" resolves to the OneRecord automation actor used on reminders and escalations. */
export function personById(s: Pick<SandboxView, "config">, id: string | undefined): Person | undefined {
  if (!id) return undefined;
  if (id === SYSTEM_ACTOR_ID) return SYSTEM_PERSON;
  return s.config.people.find((p) => p.id === id);
}

/** Display name for any actor id (never throws; unknown ids are shown as-is). */
export function actorName(s: Pick<SandboxView, "config">, id: string | undefined): string {
  return personById(s, id)?.name ?? id ?? "—";
}

export function requestById(s: Pick<SandboxView, "requests">, id: string): MdmRequest | undefined {
  return s.requests.find((r) => r.id === id);
}

export function domainById(s: Pick<SandboxView, "config">, id: string): DomainConfig | undefined {
  return s.config.domains.find((d) => d.id === id);
}

export function buById(s: Pick<SandboxView, "config">, id: string): BusinessUnit | undefined {
  return s.config.businessUnits.find((b) => b.id === id);
}

/** "SPD — Diagnostics", or the raw code for an entity that isn't configured yet (e.g. a newly joined BU). */
export function buLabel(s: Pick<SandboxView, "config">, id: string): string {
  return buById(s, id)?.name ?? id;
}

// =============================================================================================
// SLA helpers
// =============================================================================================

/** Business days a step has been waiting (net of paused question time). */
export function stepAgeBusinessDays(step: ApprovalStep, nowIso: string): number {
  return stepElapsedBusinessDays(step, nowIso);
}

/** Active step past its SLA (sla.stepBusinessDays). Question steps are paused, so never breached while paused. */
export function isStepBreached(s: Pick<SandboxView, "config">, step: ApprovalStep, nowIso: string): boolean {
  return step.status === "pending" && stepElapsedBusinessDays(step, nowIso) > s.config.sla.stepBusinessDays;
}

/** Calendar hours to move the clock forward by `days` business days (skips weekends), for a "+1 business day" control. */
export function hoursForBusinessDays(nowIso: string, days: number): number {
  return Math.max(0, (Date.parse(addBusinessDays(nowIso, days)) - Date.parse(nowIso)) / 3_600_000);
}

// =============================================================================================
// Plan selectors
// =============================================================================================

/** Pending or question steps currently assigned to the person, oldest first. */
export function selectWaitingOn(s: Pick<SandboxView, "requests">, personId: string): { request: MdmRequest; step: ApprovalStep }[] {
  const out: { request: MdmRequest; step: ApprovalStep }[] = [];
  for (const request of s.requests) {
    if (!IN_FLIGHT.has(request.status)) continue;
    for (const step of request.steps) {
      if (step.assigneeId === personId && (step.status === "pending" || step.status === "question")) out.push({ request, step });
    }
  }
  return out.sort((a, b) => Date.parse(a.step.activatedAt ?? a.request.createdAt) - Date.parse(b.step.activatedAt ?? b.request.createdAt));
}

export interface StuckDemand {
  totalSgd: number;
  count: number;
  byCountry: Record<CountryCode, { sgd: number; count: number; maxDaysWaiting: number }>;
  prs: PurchaseRequest[];
}

/** Purchase requests blocked by MDM setup (status "blocked"); days waiting are whole calendar days. */
export function selectStuckDemand(s: Pick<SandboxView, "prs" | "clockOffsetMs">): StuckDemand {
  const now = Date.parse(selectNow(s));
  const byCountry = Object.fromEntries(COUNTRIES.map((c) => [c.code, { sgd: 0, count: 0, maxDaysWaiting: 0 }])) as StuckDemand["byCountry"];
  const prs = s.prs.filter((p) => p.status === "blocked").sort((a, b) => b.sgd - a.sgd);
  let totalSgd = 0;
  for (const p of prs) {
    totalSgd += p.sgd;
    const bucket = byCountry[p.country] ?? (byCountry[p.country] = { sgd: 0, count: 0, maxDaysWaiting: 0 });
    bucket.sgd += p.sgd;
    bucket.count += 1;
    const days = Math.max(0, Math.floor((now - Date.parse(p.createdAt)) / DAY_MS));
    bucket.maxDaysWaiting = Math.max(bucket.maxDaysWaiting, days);
  }
  return { totalSgd, count: prs.length, byCountry, prs };
}

/** Requests raised by the person, newest first. */
export function selectMyRequests(s: Pick<SandboxView, "requests">, personId: string): MdmRequest[] {
  return s.requests.filter((r) => r.requestorId === personId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface PipelineStats {
  inFlight: number;
  /** In-flight requests with at least one active step past its SLA. */
  breached: number;
  /** Median business days from submission to creation in SAP B1 (one decimal). */
  medianDaysToCreate: number;
  byStatus: Record<RequestStatus, number>;
}

export function selectPipelineStats(s: Pick<SandboxView, "requests" | "config" | "clockOffsetMs">): PipelineStats {
  const now = selectNow(s);
  const byStatus = Object.fromEntries(ALL_STATUSES.map((k) => [k, 0])) as Record<RequestStatus, number>;
  let inFlight = 0;
  let breached = 0;
  const durations: number[] = [];
  for (const r of s.requests) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (IN_FLIGHT.has(r.status)) {
      inFlight++;
      if (r.steps.some((st) => isStepBreached(s, st, now))) breached++;
    }
    if (r.status === "created" && r.submittedAt && r.sapCreatedAt) {
      durations.push(businessDaysBetween(r.submittedAt, r.sapCreatedAt));
    }
  }
  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const median = durations.length === 0 ? 0 : durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
  return { inFlight, breached, medianDaysToCreate: Math.round(median * 10) / 10, byStatus };
}

// =============================================================================================
// Extra selectors
// =============================================================================================

/** Requests waiting for MDM's final check, oldest first. */
export function selectMdmQueue(s: Pick<SandboxView, "requests">): MdmRequest[] {
  return s.requests
    .filter((r) => r.status === "mdm_review")
    .sort((a, b) => Date.parse(a.submittedAt ?? a.createdAt) - Date.parse(b.submittedAt ?? b.createdAt));
}

/** PRs linked to a request (blocked by it now, or released by it). */
export function selectPrsForRequest(s: Pick<SandboxView, "prs" | "requests">, requestId: string): PurchaseRequest[] {
  const req = requestById(s, requestId);
  const ids = new Set(req?.blockedPrIds ?? []);
  return s.prs.filter((p) => p.blockedByRequestId === requestId || ids.has(p.id));
}

/** Audit events for one request (or "CONFIG"), in chain order. */
export function selectAuditFor(s: Pick<SandboxView, "audit">, requestId: string): AuditEvent[] {
  return s.audit.filter((e) => e.requestId === requestId);
}

/** Notifications for a person, newest first, optionally one channel. */
export function selectNotifications(
  s: Pick<SandboxView, "notifications">,
  personId: string,
  channel?: AppNotification["channel"],
): AppNotification[] {
  return s.notifications
    .filter((n) => n.toId === personId && (!channel || n.channel === channel))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function selectUnreadCounts(s: Pick<SandboxView, "notifications">, personId: string): { teams: number; outlook: number } {
  let teams = 0;
  let outlook = 0;
  for (const n of s.notifications) {
    if (n.toId !== personId || n.read) continue;
    if (n.channel === "teams") teams++;
    else outlook++;
  }
  return { teams, outlook };
}

/** The SAP code a request has, has reserved, or would get next (preview only; nothing is reserved). */
export function selectProposedSapCode(s: SandboxView, requestId: string): string | undefined {
  const req = requestById(s, requestId);
  const domain = req ? domainById(s, req.domainId) : undefined;
  if (!req || !domain) return undefined;
  return req.sapCode ?? s.reservedCodes?.[req.id] ?? assignSapCode(domain, req, knownSapCodes(s, req.id));
}

/** DTW files as they would be generated now, without reserving a code or writing an audit event. */
export function selectDtwPreview(s: SandboxView, requestId: string): DtwFile[] {
  const req = requestById(s, requestId);
  const domain = req ? domainById(s, req.domainId) : undefined;
  const code = selectProposedSapCode(s, requestId);
  if (!req || !domain || !code) return [];
  return buildDtwFiles(req, domain, code);
}

// =============================================================================================
// Hooks
// =============================================================================================

/** The current persona (falls back to the first configured person). */
export function useCurrentPerson(): Person {
  return useSandbox((s) => personById(s, s.personaId) ?? s.config.people[0] ?? SYSTEM_PERSON);
}

/** Simulated now; updates on fast-forward and every `intervalMs` of real time. */
export function useNow(intervalMs = 30_000): string {
  const offset = useSandbox((s) => s.clockOffsetMs);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), Math.max(1_000, intervalMs));
    return () => clearInterval(t);
  }, [intervalMs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces a fresh Date.now()
  return useMemo(() => selectNow({ clockOffsetMs: offset }), [offset, tick]);
}

export function useWaitingOn(personId?: string): { request: MdmRequest; step: ApprovalStep }[] {
  const requests = useSandbox((s) => s.requests);
  const me = useSandbox((s) => s.personaId);
  const id = personId ?? me;
  return useMemo(() => selectWaitingOn({ requests }, id), [requests, id]);
}

export function useStuckDemand(): StuckDemand {
  const prs = useSandbox((s) => s.prs);
  const clockOffsetMs = useSandbox((s) => s.clockOffsetMs);
  return useMemo(() => selectStuckDemand({ prs, clockOffsetMs }), [prs, clockOffsetMs]);
}

export function useMyRequests(personId?: string): MdmRequest[] {
  const requests = useSandbox((s) => s.requests);
  const me = useSandbox((s) => s.personaId);
  const id = personId ?? me;
  return useMemo(() => selectMyRequests({ requests }, id), [requests, id]);
}

export function usePipelineStats(): PipelineStats {
  const requests = useSandbox((s) => s.requests);
  const config = useSandbox((s) => s.config);
  const clockOffsetMs = useSandbox((s) => s.clockOffsetMs);
  return useMemo(() => selectPipelineStats({ requests, config, clockOffsetMs }), [requests, config, clockOffsetMs]);
}

export function useUnreadCounts(personId?: string): { teams: number; outlook: number } {
  const notifications = useSandbox((s) => s.notifications);
  const me = useSandbox((s) => s.personaId);
  const id = personId ?? me;
  return useMemo(() => selectUnreadCounts({ notifications }, id), [notifications, id]);
}
