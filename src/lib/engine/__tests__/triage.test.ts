import { describe, expect, it } from "vitest";
import { classifyMessage } from "../triage";

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
