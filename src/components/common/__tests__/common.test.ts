import { describe, expect, it } from "vitest";
import type { ApprovalStep, RequestStatus, SlaConfig, StepStatus } from "@/lib/types";
import { firstName, formatAgo, formatDays, formatSgd, formatSgtDateTime, initials } from "../format";
import { readSla } from "../sla";
import { STATUS_META, statusMeta } from "../status-meta";

const SLA: SlaConfig = { stepBusinessDays: 2, reminderAfterBusinessDays: 1, escalateAfterBusinessDays: 3 };

function step(patch: Partial<ApprovalStep> = {}): ApprovalStep {
  return {
    id: "s1",
    stageId: "st1",
    stageLabel: "Business approval",
    stageIndex: 0,
    stageMode: "parallel",
    role: "finance",
    label: "Finance",
    assigneeId: "weijie",
    status: "pending",
    activatedAt: "2026-10-26T02:00:00.000Z",
    pausedMs: 0,
    ...patch,
  };
}

describe("format", () => {
  it("formats SGT date-times regardless of the machine time zone", () => {
    // 02:00 UTC = 10:00 SGT on Monday 26 Oct 2026
    expect(formatSgtDateTime("2026-10-26T02:00:00.000Z")).toBe("Mon 26 Oct, 10:00");
    expect(formatSgtDateTime("not a date")).toBe("—");
  });

  it("formats SGD whole and compact", () => {
    expect(formatSgd(310400)).toBe("S$310,400");
    expect(formatSgd(310400, { compact: true })).toBe("S$310k");
    expect(formatSgd(1_240_000, { compact: true })).toBe("S$1.2m");
    expect(formatSgd(4_500, { compact: true })).toBe("S$4.5k");
    expect(formatSgd(Number.NaN)).toBe("S$0");
  });

  it("trims trailing .0 on day counts", () => {
    expect(formatDays(2)).toBe("2");
    expect(formatDays(1.25)).toBe("1.3");
    expect(formatDays(-0.5)).toBe("0.5");
  });

  it("builds initials and first names for family-name-first names", () => {
    expect(initials("Amy Lim")).toBe("AL");
    expect(initials("Dr Ploy Srisuk")).toBe("PS");
    expect(initials("")).toBe("?");
    expect(firstName("Tan Wei Jie")).toBe("Wei Jie");
    expect(firstName("Priya Nair")).toBe("Priya");
  });

  it("describes relative time against the simulated clock", () => {
    const now = "2026-10-26T05:00:00.000Z";
    expect(formatAgo("2026-10-26T04:59:40.000Z", now)).toBe("just now");
    expect(formatAgo("2026-10-26T04:30:00.000Z", now)).toBe("30 min ago");
    expect(formatAgo("2026-10-26T01:00:00.000Z", now)).toBe("4 h ago");
    expect(formatAgo("2026-10-23T05:00:00.000Z", now)).toBe("3 d ago");
  });
});

describe("readSla", () => {
  it("is calm before the reminder threshold", () => {
    const r = readSla(step(), 0.4, SLA);
    expect(r.tone).toBe("ok");
    expect(r.label).toBe("1.6d left");
  });

  it("warns after the reminder threshold", () => {
    expect(readSla(step(), 1.5, SLA).tone).toBe("warn");
    expect(readSla(step({ reminderSentAt: "2026-10-27T02:00:00.000Z" }), 1.5, SLA).detail).toMatch(/reminder went/);
  });

  it("flags overdue and escalated steps as stuck", () => {
    const overdue = readSla(step(), 2.5, SLA);
    expect(overdue.tone).toBe("stuck");
    expect(overdue.label).toBe("Overdue 0.5d");
    const esc = readSla(step({ escalatedAt: "2026-10-29T02:00:00.000Z", originalAssigneeId: "weijie" }), 3.2, SLA);
    expect(esc.label).toBe("Escalated");
    expect(esc.detail).toMatch(/reassigned/);
  });

  it("shows a paused clock while a question is open", () => {
    const r = readSla(step({ status: "question" }), 0.8, SLA);
    expect(r.tone).toBe("paused");
    expect(r.label).toBe("Clock paused");
  });

  it("reports decided and idle steps without alarm", () => {
    expect(readSla(step({ status: "approved" }), 1.2, SLA)).toMatchObject({ tone: "done", label: "Done in 1.2d" });
    expect(readSla(step({ status: "waiting", activatedAt: undefined }), null, SLA).tone).toBe("idle");
    expect(readSla(step({ status: "skipped" }), null, SLA).label).toBe("Skipped");
  });
});

describe("status meta", () => {
  const all: (RequestStatus | StepStatus)[] = [
    "draft",
    "in_approval",
    "needs_info",
    "rejected",
    "mdm_review",
    "created",
    "cancelled",
    "waiting",
    "pending",
    "approved",
    "question",
    "skipped",
  ];

  it("labels every request and step status", () => {
    for (const s of all) {
      expect(STATUS_META[s].label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(STATUS_META).sort()).toEqual([...all].sort());
  });

  it("uses the semantic tones the design system defines", () => {
    expect(statusMeta("created").tone).toBe("ok");
    expect(statusMeta("rejected").tone).toBe("stuck");
    expect(statusMeta("needs_info").tone).toBe("warn");
    expect(statusMeta("question").tone).toBe("warn");
  });
});
