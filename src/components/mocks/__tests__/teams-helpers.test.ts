import { describe, expect, it } from "vitest";
import type { ApprovalStep, DomainConfig, MdmRequest, SlaConfig } from "@/lib/types";
import { buildKeyFacts, countryName, formatFactValue, teamsSla } from "../teams-helpers";

const SLA: SlaConfig = { stepBusinessDays: 2, reminderAfterBusinessDays: 1, escalateAfterBusinessDays: 3 };

function step(over: Partial<ApprovalStep> = {}): ApprovalStep {
  return {
    id: "s1",
    stageId: "review",
    stageLabel: "Business review",
    stageIndex: 0,
    stageMode: "parallel",
    role: "qa_ra",
    label: "QA/RA — regulatory review",
    assigneeId: "ploy",
    status: "pending",
    // Monday 26 Oct 2026, 10:00 SGT
    activatedAt: "2026-10-26T02:00:00.000Z",
    pausedMs: 0,
    ...over,
  };
}

describe("teamsSla", () => {
  it('reads "Due in 1.5 business days" half a business day in', () => {
    const s = teamsSla(step(), SLA, "2026-10-26T14:00:00.000Z");
    expect(s.label).toBe("Due in 1.5 business days");
    expect(s.tone).toBe("ok");
  });

  it("uses the singular for exactly one day left", () => {
    expect(teamsSla(step(), SLA, "2026-10-27T02:00:00.000Z").label).toBe("Due in 1 business day");
  });

  it("goes overdue after the step budget and skips the weekend", () => {
    // Friday 10:00 activation; the following Wednesday 10:00 is 3 business days later.
    const s = teamsSla(step({ activatedAt: "2026-10-23T02:00:00.000Z" }), SLA, "2026-10-28T02:00:00.000Z");
    expect(s.tone).toBe("overdue");
    expect(s.label).toBe("Overdue by 1 business day");
  });

  it("pauses while a question is open and ignores decided steps", () => {
    const q = step({ status: "question", pausedAt: "2026-10-26T06:00:00.000Z" });
    expect(teamsSla(q, SLA, "2026-10-30T02:00:00.000Z")).toMatchObject({ tone: "paused", label: "SLA paused · question open" });
    expect(teamsSla(step({ status: "approved" }), SLA, "2026-10-30T02:00:00.000Z").tone).toBe("done");
  });

  it("subtracts paused time from the clock", () => {
    const s = teamsSla(step({ pausedMs: 12 * 3_600_000 }), SLA, "2026-10-27T02:00:00.000Z");
    expect(s.label).toBe("Due in 1.5 business days");
  });
});

describe("buildKeyFacts", () => {
  const domain: DomainConfig = {
    id: "customer",
    label: "New Customer",
    description: "",
    icon: "building",
    sapObject: "oBusinessPartners",
    codePrefix: "C",
    dupCheck: true,
    enabled: true,
    stages: [],
    fields: [
      { key: "customerName", label: "Customer name", type: "text", required: true },
      { key: "taxId", label: "Tax ID", type: "text", required: true },
      { key: "notes", label: "Notes", type: "textarea", required: false },
      { key: "creditLimit", label: "Credit limit", type: "number", required: false, sensitive: true },
      { key: "paymentTerms", label: "Payment terms", type: "select", required: false, sensitive: true },
      { key: "bankAccountNo", label: "Bank account", type: "text", required: false, sensitive: true },
      { key: "swift", label: "SWIFT", type: "text", required: false, sensitive: true },
      { key: "segment", label: "Segment", type: "select", required: false, showIf: { field: "taxId", op: "notEmpty" } },
    ],
  };
  const req = {
    id: "REQ-1038",
    data: {
      customerName: "Harbourfront Specialist Clinic",
      taxId: "201912345K",
      notes: "Long text is left off the card",
      creditLimit: 80000,
      paymentTerms: "Net 30",
      bankAccountNo: "0123456789",
      swift: "DBSSSGSG",
      segment: "Clinic",
    },
  } as unknown as MdmRequest;

  it("keeps config order, drops textareas, caps sensitive facts at 3 and puts them last", () => {
    const facts = buildKeyFacts(req, domain, { limit: 6 });
    expect(facts.map((f) => f.key)).toEqual(["customerName", "taxId", "segment", "creditLimit", "paymentTerms", "bankAccountNo"]);
    expect(facts.filter((f) => f.sensitive)).toHaveLength(3);
  });

  it("leads with sensitive facts for finance approvers", () => {
    const facts = buildKeyFacts(req, domain, { limit: 4, role: "finance" });
    expect(facts.slice(0, 3).every((f) => f.sensitive)).toBe(true);
    expect(facts).toHaveLength(4);
  });

  it("hides fields whose showIf fails and falls back to raw keys without a domain", () => {
    const noTax = { ...req, data: { ...req.data, taxId: "" } } as MdmRequest;
    expect(buildKeyFacts(noTax, domain).some((f) => f.key === "segment")).toBe(false);
    const raw = buildKeyFacts({ ...req, data: { itemName: "Kit" } } as MdmRequest, undefined);
    expect(raw).toEqual([{ key: "itemName", label: "Item name", value: "Kit", sensitive: false }]);
  });
});

describe("formatting", () => {
  it("formats facts and countries", () => {
    expect(formatFactValue(80000)).toBe("80,000");
    expect(formatFactValue(null)).toBe("—");
    expect(countryName("MM")).toBe("Myanmar");
  });
});
