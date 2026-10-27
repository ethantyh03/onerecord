import { describe, expect, it } from "vitest";
import { addBusinessDays, businessDaysBetween, slaTick } from "../sla";
import { activateNext, buildRoute } from "../routing";
import { CUSTOMER, PEOPLE, SLA, SPD } from "./fixtures";
import type { MdmRequest } from "@/lib/types";

const FRI_10 = "2026-10-23T02:00:00.000Z"; // Fri 23 Oct 2026, 10:00 SGT
const MON_10 = "2026-10-26T02:00:00.000Z"; // Mon 26 Oct 2026, 10:00 SGT
const MON_09 = "2026-10-26T01:00:00.000Z";

describe("addBusinessDays", () => {
  it("Fri 10:00 + 1 business day = Mon 10:00 (SGT)", () => {
    expect(addBusinessDays(FRI_10, 1)).toBe(MON_10);
  });

  it("handles fractional days and weekday arithmetic", () => {
    expect(addBusinessDays(MON_10, 0.5)).toBe("2026-10-26T14:00:00.000Z"); // Mon 22:00 SGT
    expect(addBusinessDays(MON_10, 5)).toBe("2026-11-02T02:00:00.000Z");
    expect(addBusinessDays("2026-10-23T08:00:00.000Z", 0.5)).toBe("2026-10-25T20:00:00.000Z"); // Fri 16:00 + 12h → Mon 04:00 SGT
  });

  it("starts a weekend instant from Monday 00:00 SGT", () => {
    const sat = "2026-10-24T04:00:00.000Z"; // Sat 12:00 SGT
    expect(addBusinessDays(sat, 1)).toBe("2026-10-26T16:00:00.000Z"); // Tue 00:00 SGT
  });

  it("uses SGT, not UTC, to decide what is a weekend", () => {
    // Fri 23:30 UTC = Sat 07:30 SGT — already the weekend in Singapore
    expect(addBusinessDays("2026-10-23T23:30:00.000Z", 0.25)).toBe("2026-10-25T22:00:00.000Z"); // Mon 06:00 SGT
  });
});

describe("businessDaysBetween", () => {
  it("excludes weekends and is fractional", () => {
    expect(businessDaysBetween(FRI_10, MON_10)).toBeCloseTo(1, 10);
    expect(businessDaysBetween(MON_10, "2026-10-26T14:00:00.000Z")).toBeCloseTo(0.5, 10);
    expect(businessDaysBetween(MON_10, "2026-11-02T02:00:00.000Z")).toBeCloseTo(5, 10);
  });

  it("is zero across a pure weekend and negative when reversed", () => {
    expect(businessDaysBetween("2026-10-23T16:00:00.000Z", "2026-10-25T15:59:00.000Z")).toBe(0);
    expect(businessDaysBetween(MON_10, FRI_10)).toBeCloseTo(-1, 10);
  });

  it("round-trips with addBusinessDays", () => {
    for (const d of [0.1, 1, 2.5, 3, 7.75]) {
      expect(businessDaysBetween(FRI_10, addBusinessDays(FRI_10, d))).toBeCloseTo(d, 6);
    }
  });
});

function requestAt(activatedAt: string): MdmRequest {
  const steps = activateNext(buildRoute({ domain: CUSTOMER, bu: SPD, data: { creditLimit: 30000 }, people: PEOPLE }), activatedAt);
  return {
    id: "REQ-1099",
    domainId: "customer",
    title: "New Customer: Test",
    requestorId: "amy",
    entity: "SPD",
    country: "SG",
    createdAt: activatedAt,
    submittedAt: activatedAt,
    status: "in_approval",
    data: {},
    configVersion: 1,
    steps,
    blockedPrIds: [],
  };
}

describe("slaTick", () => {
  it("+1.2 bd ⇒ 1 reminder per pending step; +3.5 bd ⇒ 1 escalation to managerId; then 0 events", () => {
    const req = requestAt(MON_09);
    const pendingIds = req.steps.filter((s) => s.status === "pending").map((s) => s.id);
    expect(pendingIds).toHaveLength(2);

    const t1 = slaTick(req, addBusinessDays(MON_09, 1.2), SLA, PEOPLE);
    expect(t1.events.filter((e) => e.kind === "reminder")).toHaveLength(2);
    expect(t1.events.filter((e) => e.kind === "escalation")).toHaveLength(0);
    const daniel = t1.events.find((e) => e.toId === "daniel");
    expect(daniel).toMatchObject({ kind: "reminder" });

    const r2 = { ...req, steps: t1.steps };
    const t2 = slaTick(r2, addBusinessDays(MON_09, 3.5), SLA, PEOPLE);
    expect(t2.events.filter((e) => e.kind === "reminder")).toHaveLength(0);
    const esc = t2.events.filter((e) => e.kind === "escalation");
    expect(esc).toHaveLength(2);
    const fromDaniel = esc.find((e) => e.fromId === "daniel")!;
    expect(fromDaniel.toId).toBe("rachel"); // daniel.managerId
    const step = t2.steps.find((s) => s.id === fromDaniel.stepId)!;
    expect(step.assigneeId).toBe("rachel");
    expect(step.originalAssigneeId).toBe("daniel");
    expect(step.escalatedAt).toBeDefined();

    const t3 = slaTick({ ...req, steps: t2.steps }, addBusinessDays(MON_09, 3.6), SLA, PEOPLE);
    expect(t3.events).toHaveLength(0);
  });

  it("fast-forwarding far past every SLA gives exactly one reminder and one escalation per step", () => {
    const req = requestAt(MON_09);
    const far = new Date(Date.parse(MON_09) + 200 * 3600_000).toISOString();
    const t1 = slaTick(req, far, SLA, PEOPLE);
    expect(t1.events.filter((e) => e.kind === "reminder")).toHaveLength(2);
    expect(t1.events.filter((e) => e.kind === "escalation")).toHaveLength(2);
    const t2 = slaTick({ ...req, steps: t1.steps }, far, SLA, PEOPLE);
    expect(t2.events).toHaveLength(0);
    expect(t2.steps).toEqual(t1.steps);
  });

  it("escalates to the delegate when one is set", () => {
    const people = PEOPLE.map((p) => (p.id === "siti" ? { ...p, delegateId: "kyaw" } : p));
    const req = requestAt(MON_09);
    const t = slaTick(req, addBusinessDays(MON_09, 3.2), SLA, people);
    expect(t.events.find((e) => e.kind === "escalation" && e.fromId === "siti")?.toId).toBe("kyaw");
  });

  it("excludes paused time", () => {
    const req = requestAt(MON_09);
    const steps = req.steps.map((s) => (s.status === "pending" ? { ...s, pausedMs: 24 * 3600_000 } : s));
    const t = slaTick({ ...req, steps }, addBusinessDays(MON_09, 1.2), SLA, PEOPLE);
    expect(t.events).toHaveLength(0);
  });

  it("ignores steps whose clock is paused by an open question", () => {
    const req = requestAt(MON_09);
    const steps = req.steps.map((s) => (s.status === "pending" ? { ...s, status: "question" as const, pausedAt: MON_09 } : s));
    const t = slaTick({ ...req, steps, status: "needs_info" }, addBusinessDays(MON_09, 5), SLA, PEOPLE);
    expect(t.events).toHaveLength(0);
  });

  it("does nothing for closed requests", () => {
    const req = { ...requestAt(MON_09), status: "rejected" as const };
    expect(slaTick(req, addBusinessDays(MON_09, 5), SLA, PEOPLE).events).toHaveLength(0);
  });
});
