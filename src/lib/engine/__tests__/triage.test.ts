import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { MessageKind } from "@/lib/types";
import inbox from "@/data/inbox.json";
import { classifyMessage, TRIAGE_PRECEDENCE } from "../triage";

interface DevMessage {
  id: string;
  subject: string;
  body: string;
  from: string;
  label: MessageKind;
  note: string;
  hard?: boolean;
}
// Dev set only. The blind test set (analytics/triage/testset.json) is deliberately never loaded here.
const devset = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../../../analytics/triage/devset.json"), "utf-8"),
) as { messages: DevMessage[] };

const msg = (subject: string, body: string, from = "buyer@sunway-demo.example") => ({ subject, body, from });

describe("classifyMessage", () => {
  it('"PO-778812 for 40 boxes" ⇒ po', () => {
    const r = classifyMessage(msg("New order", "Please find attached PO-778812 for 40 boxes of Dengue NS1 Ag Rapid Test 25T."));
    expect(r.kind).toBe("po");
    expect(r.reasons).toContain("Contains PO number PO-778812");
    expect(r.reasons).toContain("States quantity 40 boxes");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"Do you carry dengue NS1 kits? price?" ⇒ enquiry', () => {
    const r = classifyMessage(msg("Enquiry", "Do you carry dengue NS1 kits? price?"));
    expect(r.kind).toBe("enquiry");
    expect(r.reasons.join(" ")).toMatch(/question/i);
  });

  it('"When will PO-55120 be delivered" ⇒ followup', () => {
    const r = classifyMessage(msg("Delivery", "When will PO-55120 be delivered"));
    expect(r.kind).toBe("followup");
    expect(r.reasons).toContain("Contains PO number PO-55120");
    expect(r.reasons.join(" ")).toMatch(/existing order/i);
  });

  it("quote accepted with quantity and product ⇒ pr", () => {
    const r = classifyMessage(
      msg("Re: Quotation Q-2291", "We accept your quotation and intend to order 12 kits of I-A-000812 next month once budget is released."),
    );
    expect(r.kind).toBe("pr");
    expect(r.reasons).toEqual(expect.arrayContaining(["States quantity 12 kits", "Mentions product code I-A-000812"]));
  });

  it("stated intent to order with a quantity outranks a polite question ⇒ pr", () => {
    const r = classifyMessage(msg("Dengue kits", "Hi, we'd like to order 20 boxes of Dengue NS1 next month, can you hold stock?"));
    expect(r.kind).toBe("pr");
    expect(r.reasons).toContain("States quantity 20 boxes");
  });

  it("master-data setup ⇒ mdm", () => {
    const r = classifyMessage(msg("New customer setup", "Please set up a new customer account for Klinik Kesihatan Ampang Jaya.", "siti.rahman@livesgroup.example"));
    expect(r.kind).toBe("mdm");
    expect(r.reasons.join(" ")).toMatch(/setup/i);
  });

  it("invoice queries are follow-ups", () => {
    expect(classifyMessage(msg("Invoice INV-20931", "Could you resend the invoice for our order last week?")).kind).toBe("followup");
  });

  it("PO number alone is still a PO, with lower confidence", () => {
    const r = classifyMessage(msg("PO 4500123456", "Attached."));
    expect(r.kind).toBe("po");
    expect(r.confidence).toBeLessThan(0.9);
  });

  it("never throws and falls back to a low-confidence enquiry", () => {
    const r = classifyMessage({ subject: "", body: "", from: "" });
    expect(r.kind).toBe("enquiry");
    expect(r.confidence).toBeLessThanOrEqual(0.5);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(() => classifyMessage({ subject: undefined as unknown as string, body: null as unknown as string, from: "" })).not.toThrow();
  });
});

describe("classifyMessage — documented hard cases", () => {
  it("a follow-up that quotes a PO number stays a follow-up", () => {
    const r = classifyMessage(msg("PO 4500234519 – not received", "Hi, our PO 4500234519 for CRP latex was due Fri but till now not received. Pls check."));
    expect(r.kind).toBe("followup");
    expect(r.reasons).toContain("Contains PO number PO 4500234519");
  });

  it("amending or cancelling an existing PO is a follow-up, not a new PO", () => {
    expect(classifyMessage(msg("Amend PO-660021", "Please amend our PO-660021 quantity from 100 to 150 tests.")).kind).toBe("followup");
    expect(classifyMessage(msg("Cancel PO 30021455", "Please cancel PO 30021455, the requisition was duplicated.")).kind).toBe("followup");
  });

  it("an enquiry that mentions a quantity hypothetically stays an enquiry", () => {
    const r = classifyMessage(msg("Volume pricing", "If we order 500 boxes gloves, can you deliver monthly in batches? What price for that volume?"));
    expect(r.kind).toBe("enquiry");
    expect(r.reasons.join(" ")).toMatch(/no commitment/i);
  });

  it('"PO to follow" without a number is a purchase request', () => {
    const r = classifyMessage(msg("Re: Quote Q-4410", "Ok we go with this quote. Pls proceed with 50 boxes, PO to follow next week once approved."));
    expect(r.kind).toBe("pr");
    expect(r.reasons.join(" ")).toMatch(/PO still to come/);
  });

  it("an MDM request inside an order email goes to MDM first (precedence), and says so", () => {
    const r = classifyMessage(
      msg("PO-552019 + new delivery address", "Attached PO-552019 for 20 boxes gloves. Please also set up our new ship-to address at Tampines warehouse and deliver this PO there."),
    );
    expect(r.kind).toBe("mdm");
    expect(r.reasons.join(" ")).toMatch(/Also looks like a PO/);
    expect(r.confidence).toBeLessThan(0.85);
  });

  it("proforma invoice is not a billing follow-up", () => {
    const r = classifyMessage(msg("Purchase request", "We would like to purchase 50 boxes glucometer strips. Please send proforma invoice and we will send PO."));
    expect(r.kind).toBe("pr");
  });

  it("precedence order is documented and complete", () => {
    expect(TRIAGE_PRECEDENCE).toEqual(["mdm", "followup", "po", "pr", "enquiry"]);
  });

  it("confidence grows with the margin between the top two classes", () => {
    const clear = classifyMessage(msg("PO-778812", "Please find attached PO-778812 for 40 boxes of Dengue NS1 Ag Rapid Test 25T."));
    const close = classifyMessage(msg("PO-552019", "Attached PO-552019 for 20 boxes gloves. Please also set up our new ship-to address."));
    expect(clear.confidence).toBeGreaterThan(close.confidence);
    for (const r of [clear, close]) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(0.98);
    }
  });
});

describe("classifyMessage — dev-set regression", () => {
  const msgs = devset.messages;

  it("dev set is balanced: 80 messages, 16 per label", () => {
    expect(msgs).toHaveLength(80);
    for (const k of TRIAGE_PRECEDENCE) expect(msgs.filter((m) => m.label === k)).toHaveLength(16);
  });

  it("accuracy on the dev set is at least 0.85, and every class recall at least 0.75", () => {
    const preds = msgs.map((m) => ({ m, kind: classifyMessage(m).kind }));
    const acc = preds.filter((p) => p.kind === p.m.label).length / msgs.length;
    expect(acc).toBeGreaterThanOrEqual(0.85);
    for (const k of TRIAGE_PRECEDENCE) {
      const ofK = preds.filter((p) => p.m.label === k);
      expect(ofK.filter((p) => p.kind === k).length / ofK.length).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("every dev prediction carries at least one readable reason", () => {
    for (const m of msgs) {
      const r = classifyMessage(m);
      expect(r.reasons.length).toBeGreaterThan(0);
      expect(r.reasons.every((x) => typeof x === "string" && x.length > 5)).toBe(true);
    }
  });

  it("agrees with the human labels on the demo inbox (src/data/inbox.json)", () => {
    const rows = (inbox as { messages: { subject: string; body: string; from: string; humanLabel: MessageKind }[] }).messages;
    const agree = rows.filter((m) => classifyMessage(m).kind === m.humanLabel).length;
    expect(agree / rows.length).toBeGreaterThanOrEqual(0.9);
  });
});
