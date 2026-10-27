/**
 * Pure helpers shared by the request list and the delivery tracker. No React.
 */
import type { ApprovalStep, CountryCode, MdmRequest, PurchaseRequest, RequestStatus } from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { MDM_STAGE_ID } from "@/lib/engine/routing";
import { businessDaysBetween, stepElapsedBusinessDays } from "@/lib/engine/sla";

export const IN_FLIGHT_STATUSES: ReadonlySet<RequestStatus> = new Set<RequestStatus>(["in_approval", "needs_info", "mdm_review"]);

export function countryName(code: CountryCode | string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** Steps that are waiting on someone right now (pending or paused on a question). */
export function activeSteps(req: MdmRequest): ApprovalStep[] {
  return req.steps.filter((s) => s.status === "pending" || s.status === "question");
}

/** The active step that has used the most of its SLA (for a single chip in a table row). */
export function worstActiveStep(req: MdmRequest, nowIso: string): ApprovalStep | undefined {
  let worst: ApprovalStep | undefined;
  let worstDays = -1;
  for (const s of activeSteps(req)) {
    const d = stepElapsedBusinessDays(s, nowIso);
    if (d > worstDays) {
      worst = s;
      worstDays = d;
    }
  }
  return worst;
}

/** Business days the request has been open (submission → close, or → now while in flight). */
export function requestAgeBusinessDays(req: MdmRequest, nowIso: string): number | null {
  const start = req.submittedAt ?? (req.status === "draft" ? undefined : req.createdAt);
  if (!start) return null;
  const end = IN_FLIGHT_STATUSES.has(req.status) ? nowIso : (req.closedAt ?? req.sapCreatedAt ?? nowIso);
  return Math.max(0, businessDaysBetween(start, end));
}

/** Business stages (MDM final check excluded), grouped by stageIndex in route order. */
export function businessStages(req: MdmRequest): { stageIndex: number; label: string; mode: "parallel" | "sequential"; steps: ApprovalStep[] }[] {
  const groups = new Map<number, ApprovalStep[]>();
  for (const s of req.steps) {
    if (s.stageId === MDM_STAGE_ID) continue;
    const list = groups.get(s.stageIndex) ?? [];
    list.push(s);
    groups.set(s.stageIndex, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([stageIndex, steps]) => ({
      stageIndex,
      label: steps[0]?.stageLabel ?? `Stage ${stageIndex + 1}`,
      mode: steps[0]?.stageMode ?? "parallel",
      steps,
    }));
}

export function mdmStep(req: MdmRequest): ApprovalStep | undefined {
  return req.steps.find((s) => s.stageId === MDM_STAGE_ID);
}

export interface LinkedDemand {
  /** PRs still blocked by this request */
  blockedSgd: number;
  blockedCount: number;
  /** PRs this request released when it was created in SAP B1 */
  releasedSgd: number;
  releasedCount: number;
}

const EMPTY_DEMAND: LinkedDemand = { blockedSgd: 0, blockedCount: 0, releasedSgd: 0, releasedCount: 0 };

/** Linked purchase requests per request id, in one pass. */
export function linkedDemandByRequest(requests: MdmRequest[], prs: PurchaseRequest[]): Map<string, LinkedDemand> {
  const prById = new Map(prs.map((p) => [p.id, p]));
  const out = new Map<string, LinkedDemand>();
  const owner = new Map<string, string>(); // pr id -> request id
  for (const r of requests) for (const id of r.blockedPrIds) owner.set(id, r.id);
  for (const p of prs) if (p.blockedByRequestId) owner.set(p.id, p.blockedByRequestId);
  for (const [prId, reqId] of owner) {
    const p = prById.get(prId);
    if (!p) continue;
    const cur = { ...(out.get(reqId) ?? EMPTY_DEMAND) };
    if (p.status === "blocked") {
      cur.blockedSgd += p.sgd;
      cur.blockedCount += 1;
    } else {
      cur.releasedSgd += p.sgd;
      cur.releasedCount += 1;
    }
    out.set(reqId, cur);
  }
  return out;
}

export function demandFor(map: Map<string, LinkedDemand>, id: string): LinkedDemand {
  return map.get(id) ?? EMPTY_DEMAND;
}

/** Lower-case haystack for the search box. */
export function searchText(req: MdmRequest, requestorName: string): string {
  return `${req.id} ${req.title} ${requestorName} ${req.entity} ${req.country} ${req.sapCode ?? ""}`.toLowerCase();
}

/**
 * Wall-clock label for a decision that took under one business day ("26 min", "3 h"), so the tracker never says
 * "Done in 0d". Returns null for a day or more (the SLA chip's "Done in 1.2d" reads fine there).
 */
export function subDayDuration(businessDays: number): string | null {
  if (!Number.isFinite(businessDays) || businessDays >= 1) return null;
  const minutes = Math.max(0, Math.round(businessDays * 24 * 60));
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 6) / 10;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}
