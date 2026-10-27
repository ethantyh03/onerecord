import { describe, expect, it } from "vitest";
import {
  MDM_STAGE_ID,
  activateNext,
  applyDecision,
  buildRoute,
  expectedCompletion,
  newlyActivated,
  resolveAssignee,
} from "../routing";
import { COSTCENTRE, CUSTOMER, EXTEND, ITEM, PEOPLE, SLA, SPD, VENDOR } from "./fixtures";
import type { ApprovalStep, BusinessUnit, Person } from "@/lib/types";

const NOW = "2026-10-26T01:00:00.000Z"; // Mon 09:00 SGT

function approveAll(steps: ApprovalStep[], stageIndex: number): ApprovalStep[] {
  let s = steps;
  for (const step of s.filter((x) => x.stageIndex === stageIndex)) {
    s = applyDecision(s, step.id, "approved", NOW).steps;
  }
  return s;
}

describe("resolveAssignee", () => {
  it("uses the BU's role assignment first", () => {
    expect(resolveAssignee("qa_ra", SPD, PEOPLE)).toEqual({ assigneeId: "ploy" });
  });

  it("falls back to the first person holding the role", () => {
    const bu: BusinessUnit = { ...SPD, roleAssignments: {} };
    expect(resolveAssignee("procurement", bu, PEOPLE).assigneeId).toBe("hafiz");
    expect(resolveAssignee("procurement", undefined, PEOPLE).assigneeId).toBe("hafiz");
  });

  it("an OOO assignee hands over to their delegate, keeping originalAssigneeId", () => {
    const people: Person[] = PEOPLE.map((p) => (p.id === "daniel" ? { ...p, outOfOffice: true, delegateId: "lan" } : p));
    expect(resolveAssignee("bu_head", SPD, people)).toEqual({ assigneeId: "lan", originalAssigneeId: "daniel" });
  });

  it("OOO without a delegate keeps the assignee", () => {
    const people = PEOPLE.map((p) => (p.id === "daniel" ? { ...p, outOfOffice: true } : p));
    expect(resolveAssignee("bu_head", SPD, people)).toEqual({ assigneeId: "daniel" });
  });

  it("does not loop on circular delegation", () => {
    const people = PEOPLE.map((p) =>
      p.id === "daniel"
        ? { ...p, outOfOffice: true, delegateId: "lan" }
        : p.id === "lan"
          ? { ...p, outOfOffice: true, delegateId: "daniel" }
          : p,
    );
    expect(() => resolveAssignee("bu_head", SPD, people)).not.toThrow();
  });
});

describe("buildRoute", () => {
  it("item + IVD category ⇒ the QA/RA step is present with addedBecause", () => {
    const steps = buildRoute({ domain: ITEM, bu: SPD, data: { category: "IVD reagent" }, people: PEOPLE });
    const qa = steps.find((s) => s.role === "qa_ra");
    expect(qa).toBeDefined();
    expect(qa!.assigneeId).toBe("ploy");
    expect(qa!.addedBecause).toBe("Category = IVD reagent → regulatory review required");
    expect(steps.every((s) => s.status === "waiting" && s.pausedMs === 0)).toBe(true);
  });

  it("item without a regulated category has no QA/RA step", () => {
    const steps = buildRoute({ domain: ITEM, bu: SPD, data: { category: "Lab consumable" }, people: PEOPLE });
    expect(steps.some((s) => s.role === "qa_ra")).toBe(false);
  });

  it("customer + creditLimit 80000 ⇒ finance_director present; 30000 ⇒ absent", () => {
    const high = buildRoute({ domain: CUSTOMER, bu: SPD, data: { creditLimit: 80000 }, people: PEOPLE });
    const fd = high.find((s) => s.role === "finance_director");
    expect(fd).toBeDefined();
    expect(fd!.assigneeId).toBe("rachel");
    expect(fd!.addedBecause).toMatch(/Credit limit/);
    const low = buildRoute({ domain: CUSTOMER, bu: SPD, data: { creditLimit: 30000 }, people: PEOPLE });
    expect(low.some((s) => s.role === "finance_director")).toBe(false);
  });

  it("always appends the MDM final stage last", () => {
    const steps = buildRoute({ domain: CUSTOMER, bu: SPD, data: { creditLimit: 30000 }, people: PEOPLE });
    const last = steps[steps.length - 1];
    expect(last.stageId).toBe(MDM_STAGE_ID);
    expect(last.role).toBe("mdm");
    expect(last.assigneeId).toBe("priya");
    expect(last.stageIndex).toBe(2);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it("appends BU extra stages before MDM, with a reason", () => {
    const bu: BusinessUnit = {
      ...SPD,
      id: "NBU",
      extraStages: [{ id: "reg-pre", label: "Regulatory pre-check", mode: "sequential", steps: [{ id: "ra", label: "QA/RA pre-check", role: "qa_ra" }] }],
    };
    const steps = buildRoute({ domain: COSTCENTRE, bu, data: {}, people: PEOPLE });
    expect(steps.map((s) => s.stageId)).toEqual(["cc-review", "cc-review", "reg-pre", MDM_STAGE_ID]);
    expect(steps[2].addedBecause).toMatch(/NBU/);
  });

  it("vendor supplying regulated products adds QA/RA; extend with credit change adds Finance", () => {
    const v = buildRoute({ domain: VENDOR, bu: SPD, data: { suppliesRegulated: "Yes" }, people: PEOPLE });
    expect(v.find((s) => s.role === "qa_ra")?.addedBecause).toBe("Supplies regulated = Yes → regulatory review required");
    const e = buildRoute({ domain: EXTEND, bu: SPD, data: { changesCreditTerms: "Yes" }, people: PEOPLE });
    expect(e.map((s) => s.role)).toEqual(["business_support", "finance", "mdm"]);
  });

  it("delegates an OOO approver at build time", () => {
    const people = PEOPLE.map((p) => (p.id === "siti" ? { ...p, outOfOffice: true, delegateId: "kyaw" } : p));
    const steps = buildRoute({ domain: ITEM, bu: SPD, data: { category: "IVD reagent" }, people });
    const bs = steps.find((s) => s.role === "business_support")!;
    expect(bs.assigneeId).toBe("kyaw");
    expect(bs.originalAssigneeId).toBe("siti");
  });
});

describe("activateNext", () => {
  it("a parallel stage activates 3 steps at once", () => {
    const steps = activateNext(buildRoute({ domain: ITEM, bu: SPD, data: { category: "IVD reagent" }, people: PEOPLE }), NOW);
    const pending = steps.filter((s) => s.status === "pending");
    expect(pending).toHaveLength(3);
    expect(pending.every((s) => s.activatedAt === NOW && s.stageIndex === 0)).toBe(true);
  });

  it("a sequential stage activates one step at a time", () => {
    let steps = activateNext(buildRoute({ domain: CUSTOMER, bu: SPD, data: { creditLimit: 80000 }, people: PEOPLE }), NOW);
    steps = approveAll(steps, 0);
    const pending = steps.filter((s) => s.status === "pending");
    expect(pending.map((s) => s.role)).toEqual(["finance"]);
  });

  it("is idempotent", () => {
    const once = activateNext(buildRoute({ domain: ITEM, bu: SPD, data: {}, people: PEOPLE }), NOW);
    expect(activateNext(once, "2026-10-27T01:00:00.000Z")).toEqual(once);
  });
});

describe("applyDecision", () => {
  const fresh = () => activateNext(buildRoute({ domain: ITEM, bu: SPD, data: { category: "IVD reagent" }, people: PEOPLE }), NOW);

  it("applyDecision on an approved step ⇒ noop", () => {
    const steps = fresh();
    const id = steps[0].id;
    const first = applyDecision(steps, id, "approved", NOW, "Looks good");
    expect(first.outcome).toBe("continue");
    const second = applyDecision(first.steps, id, "approved", NOW);
    expect(second.outcome).toBe("noop");
    expect(second.steps).toBe(first.steps);
  });

  it("noop on a waiting step or an unknown id", () => {
    const steps = fresh();
    const mdm = steps.find((s) => s.stageId === MDM_STAGE_ID)!;
    expect(applyDecision(steps, mdm.id, "approved", NOW).outcome).toBe("noop");
    expect(applyDecision(steps, "nope", "approved", NOW).outcome).toBe("noop");
  });

  it("business_approved when only MDM remains; completed when MDM approves", () => {
    let steps = fresh();
    const ids = steps.filter((s) => s.stageIndex === 0).map((s) => s.id);
    let outcome = "";
    for (const id of ids) ({ steps, outcome } = applyDecision(steps, id, "approved", NOW));
    expect(outcome).toBe("business_approved");
    const mdm = steps.find((s) => s.stageId === MDM_STAGE_ID)!;
    expect(mdm.status).toBe("pending");
    expect(newlyActivated(fresh(), steps).map((s) => s.id)).toEqual([mdm.id]);
    const done = applyDecision(steps, mdm.id, "approved", NOW);
    expect(done.outcome).toBe("completed");
  });

  it("rejection skips the remaining steps", () => {
    const steps = fresh();
    const res = applyDecision(steps, steps[1].id, "rejected", NOW, "Wrong pack size");
    expect(res.outcome).toBe("rejected");
    expect(res.steps[1]).toMatchObject({ status: "rejected", comment: "Wrong pack size", decidedAt: NOW });
    expect(res.steps.filter((s) => s.status === "skipped")).toHaveLength(steps.length - 1);
  });

  it("deciding a step with an open question closes the pause", () => {
    const steps = fresh().map((s, i) =>
      i === 0 ? { ...s, status: "question" as const, pausedAt: "2026-10-26T03:00:00.000Z" } : s,
    );
    const res = applyDecision(steps, steps[0].id, "approved", "2026-10-26T05:00:00.000Z");
    expect(res.outcome).toBe("continue");
    expect(res.steps[0].pausedMs).toBe(2 * 3600_000);
    expect(res.steps[0].pausedAt).toBeUndefined();
  });
});

describe("expectedCompletion", () => {
  it("costs each stage once (parallel) or per step (sequential)", () => {
    // item: 1 parallel stage + MDM = 2 stages × 2 bd = 4 bd from Mon 09:00 → Fri 09:00
    const item = buildRoute({ domain: ITEM, bu: SPD, data: { category: "IVD reagent" }, people: PEOPLE });
    expect(expectedCompletion(item, NOW, SLA)).toBe("2026-10-30T01:00:00.000Z");
    // customer high credit: parallel (2) + finance (2) + FD (2) + MDM (2) = 8 bd → Thu next week
    const cust = buildRoute({ domain: CUSTOMER, bu: SPD, data: { creditLimit: 80000 }, people: PEOPLE });
    expect(expectedCompletion(cust, NOW, SLA)).toBe("2026-11-05T01:00:00.000Z");
  });
});
