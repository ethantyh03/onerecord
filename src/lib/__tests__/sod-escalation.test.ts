import { beforeEach, describe, expect, it, vi } from "vitest";

// A Map-backed localStorage (and a minimal window) must exist before the store module loads.
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
import { hoursForBusinessDays, selectNow } from "@/lib/selectors";
import { verifyChain } from "@/lib/engine/audit";
import { slaTick } from "@/lib/engine/sla";
import { activateNext, buildRoute } from "@/lib/engine/routing";
import { CUSTOMER, PEOPLE, SLA, SPD } from "@/lib/engine/__tests__/fixtures";
import type { MdmRequest, Person } from "@/lib/types";

const S = () => useSandbox.getState();
const req = (id: string) => S().requests.find((r) => r.id === id) as MdmRequest;
const stepByRole = (id: string, role: string) => req(id).steps.find((s) => s.role === role)!;
const name = (id: string) => S().config.people.find((p) => p.id === id)?.name ?? id;

/** +N business days on the simulated clock, exactly as the "+3 business days" control does it. */
function plusBusinessDays(n: number) {
  return S().fastForward(hoursForBusinessDays(selectNow(S()), n));
}

/**
 * Segregation-of-duties violations across every request: one person holding (or having decided) two steps of the
 * same request, or an approver step held by the person who raised it. Skipped steps were never anyone's to decide.
 */
function sodViolations(requests: MdmRequest[]): string[] {
  const out: string[] = [];
  for (const r of requests) {
    const holders = new Map<string, string[]>();
    for (const st of r.steps) {
      if (st.status === "skipped") continue;
      holders.set(st.assigneeId, [...(holders.get(st.assigneeId) ?? []), st.label]);
      if (st.assigneeId === r.requestorId) out.push(`${r.id}: ${st.label} is held by its requestor ${st.assigneeId}`);
    }
    for (const [who, labels] of holders) if (labels.length > 1) out.push(`${r.id}: ${who} holds ${labels.join(" + ")}`);
  }
  return out;
}

describe("segregation of duties survives SLA escalation (seeded sandbox)", () => {
  beforeEach(() => {
    S().resetSandbox();
  });

  it("the seeded sandbox starts clean: nobody holds two steps on one request", () => {
    expect(sodViolations(S().requests)).toEqual([]);
    // The REQ-1038 setup that used to break: Wei Jie's delegate *and* manager is Rachel, who holds the FD step.
    const weijie = S().config.people.find((p) => p.id === "weijie")!;
    expect(weijie).toMatchObject({ delegateId: "rachel", managerId: "rachel" });
    expect(stepByRole("REQ-1038", "finance")).toMatchObject({ assigneeId: "weijie", status: "pending" });
    expect(stepByRole("REQ-1038", "finance_director")).toMatchObject({ assigneeId: "rachel", status: "waiting" });
  });

  it("REQ-1038: +3 business days escalates Finance past Rachel Koh (already Finance Director) to Henry Goh", () => {
    const res = plusBusinessDays(3);
    expect(res.escalations).toBeGreaterThan(0);

    const fin = stepByRole("REQ-1038", "finance");
    const fd = stepByRole("REQ-1038", "finance_director");
    expect(fin.escalatedAt).toBeTruthy();
    expect(fin.assigneeId).not.toBe("rachel");
    expect(fin).toMatchObject({ assigneeId: "henry", originalAssigneeId: "weijie", status: "pending" });
    expect(fd).toMatchObject({ assigneeId: "rachel", status: "waiting" });

    // Audit says who took it and why Rachel was passed over.
    const esc = S().audit.filter((e) => e.requestId === "REQ-1038" && e.action === "escalated");
    expect(esc).toHaveLength(1);
    expect(esc[0].detail).toContain(`reassigned from ${name("weijie")} to ${name("henry")}`);
    expect(esc[0].detail).toContain(name("rachel"));
    expect(esc[0].detail).toContain("segregation of duties");
    // Henry gets the Teams escalation; Rachel gets nothing for REQ-1038's Finance step.
    const notes = S().notifications.filter((n) => n.requestId === "REQ-1038" && n.kind === "escalation");
    expect(notes.some((n) => n.toId === "henry" && n.channel === "teams" && n.title === "Escalated to you · REQ-1038")).toBe(true);
    expect(notes.some((n) => n.toId === "rachel")).toBe(false);
    expect(verifyChain(S().audit).ok).toBe(true);
  });

  it("after +3 business days no person holds two steps on any request", () => {
    plusBusinessDays(3);
    expect(sodViolations(S().requests)).toEqual([]);
  });

  it("stays clean however far the clock runs (+1, +3, then 200 hours)", () => {
    plusBusinessDays(1);
    expect(sodViolations(S().requests)).toEqual([]);
    plusBusinessDays(3);
    expect(sodViolations(S().requests)).toEqual([]);
    S().fastForward(200);
    expect(sodViolations(S().requests)).toEqual([]);
    expect(verifyChain(S().audit).ok).toBe(true);
  });

  it("REQ-1038 end to end: Henry approves Finance, Rachel's FD step then stalls → MDM alerted, Rachel keeps it", () => {
    plusBusinessDays(3);
    S().setPersona("henry");
    expect(S().approveStep("REQ-1038", stepByRole("REQ-1038", "finance").id, "Credit terms fine").ok).toBe(true);
    expect(stepByRole("REQ-1038", "finance_director")).toMatchObject({ assigneeId: "rachel", status: "pending" });

    plusBusinessDays(3);
    const fd = stepByRole("REQ-1038", "finance_director");
    // Rachel's manager is Henry, who already decided Finance; Henry has no manager → MDM is alerted instead.
    expect(fd).toMatchObject({ assigneeId: "rachel", status: "pending" });
    expect(fd.escalatedAt).toBeTruthy();
    expect(fd.originalAssigneeId).toBeUndefined();
    const esc = S().audit.filter((e) => e.requestId === "REQ-1038" && e.action === "escalated");
    expect(esc).toHaveLength(2);
    expect(esc[1].detail).toContain("(MDM) alerted");
    expect(esc[1].detail).toContain(name("henry"));
    expect(esc[1].detail).toContain("segregation of duties");
    expect(esc[1].detail).not.toContain("has no delegate or manager");
    expect(S().notifications.some((n) => n.requestId === "REQ-1038" && n.toId === "priya" && n.title === "Stalled approval · REQ-1038")).toBe(true);
    expect(sodViolations(S().requests)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Engine level: slaTick picks an eligible person or falls back to MDM.

const MON_09 = "2026-10-26T01:00:00.000Z"; // Mon 26 Oct 2026, 09:00 SGT
const LATE = "2026-10-29T05:00:00.000Z"; // Thu 13:00 SGT: 3.17 business days later, past escalation

function customerRequest(people: Person[], creditLimit = 30000, requestorId = "amy"): MdmRequest {
  const steps = activateNext(buildRoute({ domain: CUSTOMER, bu: SPD, data: { creditLimit }, people }), MON_09);
  return {
    id: "REQ-1099",
    domainId: "customer",
    title: "New Customer: Test",
    requestorId,
    entity: "SPD",
    country: "SG",
    createdAt: MON_09,
    submittedAt: MON_09,
    status: "in_approval",
    data: {},
    configVersion: 1,
    steps,
    blockedPrIds: [],
  };
}

/** Only the step with `role` is pending (since MON_09): earlier stages approved by their assignees, the rest waiting. */
function withPending(r: MdmRequest, role: string): MdmRequest {
  const target = r.steps.find((s) => s.role === role)!;
  return {
    ...r,
    steps: r.steps.map((s) =>
      s.id === target.id
        ? { ...s, status: "pending" as const, activatedAt: MON_09 }
        : s.stageIndex < target.stageIndex
          ? { ...s, status: "approved" as const, activatedAt: MON_09, decidedAt: MON_09 }
          : { ...s, status: "waiting" as const, activatedAt: undefined },
    ),
  };
}

const set = (people: Person[], id: string, patch: Partial<Person>) => people.map((p) => (p.id === id ? { ...p, ...patch } : p));
/** Fixture people plus a group MD with no manager of their own. */
const withHenry = (people: Person[]) => [...people, { ...people.find((p) => p.id === "rachel")!, id: "henry", name: "Henry Goh", roles: [] }];

describe("slaTick: escalation respects segregation of duties", () => {
  it("skips a manager who already holds another step and goes to that manager's manager", () => {
    // weijie → rachel (holds FD, credit limit > 50k) → rachel's manager henry.
    const people = set(withHenry(PEOPLE), "rachel", { managerId: "henry" });
    const r = withPending(customerRequest(people, 80000), "finance");
    expect(r.steps.find((s) => s.role === "finance_director")?.assigneeId).toBe("rachel");
    const t = slaTick(r, LATE, SLA, people);
    const esc = t.events.find((e) => e.kind === "escalation" && e.fromId === "weijie")!;
    expect(esc.toId).toBe("henry");
    expect(esc.skipped).toEqual([
      { id: "rachel", reason: "holds_step", stepLabel: r.steps.find((s) => s.role === "finance_director")!.label, stepStatus: "waiting" },
    ]);
    expect(t.steps.find((s) => s.role === "finance")).toMatchObject({ assigneeId: "henry", originalAssigneeId: "weijie" });
  });

  it("falls back to MDM alerted (assignee unchanged) when the manager's manager is also ineligible or missing", () => {
    const r = withPending(customerRequest(PEOPLE, 80000), "finance"); // fixture rachel has no manager
    const t = slaTick(r, LATE, SLA, PEOPLE);
    const esc = t.events.find((e) => e.kind === "escalation" && e.fromId === "weijie")!;
    expect(esc.toId).toBe("priya");
    expect(esc.skipped?.map((x) => x.id)).toEqual(["rachel"]);
    const fin = t.steps.find((s) => s.role === "finance")!;
    expect(fin).toMatchObject({ assigneeId: "weijie" });
    expect(fin.escalatedAt).toBe(LATE);
    expect(fin.originalAssigneeId).toBeUndefined();
  });

  it("never escalates to the requestor or the requestor's delegate", () => {
    // Daniel's BU step: his manager rachel raised the request → rachel's manager meiling holds nothing → meiling.
    const people = set(PEOPLE, "rachel", { managerId: "meiling" });
    const r = withPending(customerRequest(people, 30000, "rachel"), "bu_head");
    const t = slaTick(r, LATE, SLA, people);
    const esc = t.events.find((e) => e.kind === "escalation" && e.fromId === "daniel")!;
    expect(esc.toId).toBe("meiling");
    expect(esc.skipped).toEqual([{ id: "rachel", reason: "requestor" }]);

    // Requestor amy's delegate is rachel → rachel can't take Daniel's step either.
    const people2 = set(set(PEOPLE, "amy", { delegateId: "rachel" }), "rachel", { managerId: "meiling" });
    const r2 = withPending(customerRequest(people2), "bu_head");
    const t2 = slaTick(r2, LATE, SLA, people2);
    const esc2 = t2.events.find((e) => e.kind === "escalation" && e.fromId === "daniel")!;
    expect(esc2.toId).toBe("meiling");
    expect(esc2.skipped).toEqual([{ id: "rachel", reason: "requestor_delegate" }]);
  });

  it("skips someone who already decided another step on the request", () => {
    // Siti's BS step stalls; her manager daniel already approved the BU step → daniel's manager rachel.
    const base = customerRequest(PEOPLE);
    const r: MdmRequest = {
      ...base,
      steps: base.steps.map((s) =>
        s.role === "bu_head" ? { ...s, status: "approved" as const, decidedAt: MON_09 } : s.role === "business_support" ? { ...s, activatedAt: MON_09 } : s,
      ),
    };
    const t = slaTick(r, LATE, SLA, PEOPLE);
    const esc = t.events.find((e) => e.kind === "escalation" && e.fromId === "siti")!;
    expect(esc.toId).toBe("rachel");
    expect(esc.skipped?.[0]).toMatchObject({ id: "daniel", reason: "holds_step", stepStatus: "approved" });
  });

  it("two steps escalating in the same tick never land on the same person", () => {
    // Daniel (BU) and Siti (Business Support) both report to henry here; the second one must not also go to henry.
    const people = set(set(withHenry(PEOPLE), "daniel", { managerId: "henry" }), "siti", { managerId: "henry" });
    const r = customerRequest(people);
    const t = slaTick(r, LATE, SLA, people);
    const esc = t.events.filter((e) => e.kind === "escalation");
    expect(esc).toHaveLength(2);
    const holders = t.steps.filter((s) => s.status !== "skipped").map((s) => s.assigneeId);
    expect(new Set(holders).size).toBe(holders.length);
    expect(esc.filter((e) => e.toId === "henry")).toHaveLength(1);
  });

  it("keeps the plain rule when nobody conflicts: delegate first, else manager, no skipped list", () => {
    const people = set(PEOPLE, "siti", { delegateId: "kyaw" });
    const t = slaTick(customerRequest(people), LATE, SLA, people);
    const fromSiti = t.events.find((e) => e.kind === "escalation" && e.fromId === "siti")!;
    expect(fromSiti.toId).toBe("kyaw");
    expect(fromSiti.skipped).toBeUndefined();
  });
});
