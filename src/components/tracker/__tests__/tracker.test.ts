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
import { businessStages, linkedDemandByRequest, mdmStep, requestAgeBusinessDays } from "../tracker-utils";

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
