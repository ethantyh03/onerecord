import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const mem = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  };
  const g = globalThis as unknown as { localStorage: typeof shim; window: { localStorage: typeof shim } };
  g.localStorage = shim;
  g.window = { localStorage: shim };
});

import { useSandbox } from "@/lib/store";
import { verifyChain } from "@/lib/engine/audit";
import { approveAllAsAssignees } from "../demo-actions";
import {
  BOARD_COLUMNS,
  boardColumnOf,
  boardSortKey,
  businessStages,
  linkedDemandByRequest,
  mdmStep,
  requestAgeBusinessDays,
  stageProgress,
  subDayDuration,
} from "../tracker-utils";

const S = () => useSandbox.getState();
const req = (id: string) => S().requests.find((r) => r.id === id)!;

describe("tracker helpers", () => {
  beforeEach(() => S().resetSandbox());

  it("groups REQ-1042 into business stages plus the MDM step", () => {
    const r = req("REQ-1042");
    const stages = businessStages(r);
    expect(stages.length).toBeGreaterThan(0);
    expect(stages.flatMap((s) => s.steps).every((s) => s.stageId !== "mdm-final")).toBe(true);
    expect(mdmStep(r)?.status).toBe("pending");
    expect(requestAgeBusinessDays(r, S().nowIso())).toBeGreaterThan(0);
  });

  it("sums linked blocked orders per request", () => {
    const m = linkedDemandByRequest(S().requests, S().prs);
    expect(m.get("REQ-1042")?.blockedSgd).toBe(70_000);
    expect(m.get("REQ-1038")?.blockedSgd).toBe(77_400);
  });

  it("approve-all walks every business stage as the assignees and restores the persona", () => {
    S().setPersona("priya");
    const before = S().audit.length;
    const { approved, blocked } = approveAllAsAssignees("REQ-1038");
    expect(blocked).toEqual([]);
    expect(approved.length).toBeGreaterThan(0);
    expect(req("REQ-1038").status).toBe("mdm_review");
    expect(S().personaId).toBe("priya");
    expect(S().audit.length).toBe(before + approved.length);
    expect(verifyChain(S().audit).ok).toBe(true);
    // Second click is a no-op.
    expect(approveAllAsAssignees("REQ-1038").approved).toEqual([]);
  });

  it("a tampered copy breaks the chain at the edited event", () => {
    const chain = S().audit;
    const target = chain.find((e) => e.requestId === "REQ-1042" && e.action === "approved")!;
    const copy = chain.map((e) => (e.seq === target.seq ? { ...e, detail: "edited" } : e));
    expect(verifyChain(copy)).toEqual({ ok: false, brokenAt: target.seq });
    expect(verifyChain(S().audit).ok).toBe(true);
  });
});

describe("stage board", () => {
  beforeEach(() => S().resetSandbox());

  it("puts every request in exactly one column, matching its status", () => {
    for (const r of S().requests) {
      const col = boardColumnOf(r);
      if (r.status === "in_approval" || r.status === "needs_info") expect(col).toBe("approval");
      else if (r.status === "created") expect(col).toBe("created");
      else if (r.status === "rejected" || r.status === "cancelled") expect(col).toBe("stopped");
      else if (r.status === "draft") expect(col).toBe("draft");
      else expect(["mdm", "ready"]).toContain(col);
    }
    expect(boardColumnOf(req("REQ-1042"))).toBe("mdm");
    expect(BOARD_COLUMNS.filter((c) => c.pipeline).map((c) => c.id)).toEqual(["approval", "mdm", "ready", "created"]);
  });

  it("moves a request to Ready for SAP B1 once MDM generates the DTW import", () => {
    S().setPersona("priya");
    S().generateDtw("REQ-1042");
    expect(boardColumnOf(req("REQ-1042"))).toBe("ready");
  });

  it("shows a route meter with the MDM check last and the active stage marked", () => {
    const meter = stageProgress(req("REQ-1042"));
    expect(meter.at(-1)).toEqual({ label: "MDM final check", state: "active" });
    expect(meter.slice(0, -1).every((m) => m.state === "done")).toBe(true);
    expect(stageProgress(req("REQ-1036")).some((m) => m.state === "paused")).toBe(true);
  });

  it("sorts in-flight cards by SLA used (questions last) and closed cards newest first", () => {
    const now = S().nowIso();
    const inFlight = S()
      .requests.filter((r) => boardColumnOf(r) === "approval")
      .sort((a, b) => boardSortKey(a, now) - boardSortKey(b, now));
    expect(inFlight.at(-1)?.status).toBe("needs_info");
    const created = S()
      .requests.filter((r) => boardColumnOf(r) === "created")
      .sort((a, b) => boardSortKey(a, now) - boardSortKey(b, now));
    const times = created.map((r) => Date.parse(r.sapCreatedAt ?? r.closedAt ?? r.submittedAt ?? r.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe("subDayDuration", () => {
  it("labels sub-day decisions in minutes or hours and leaves longer ones to the SLA chip", () => {
    expect(subDayDuration(26 / (24 * 60))).toBe("26 min");
    expect(subDayDuration(3 / 24)).toBe("3 h");
    expect(subDayDuration(2.5 / 24)).toBe("2.5 h");
    expect(subDayDuration(0)).toBe("under 1 min");
    expect(subDayDuration(1)).toBeNull();
    expect(subDayDuration(1.9)).toBeNull();
  });
});
