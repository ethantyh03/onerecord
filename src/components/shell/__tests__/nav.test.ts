import { describe, expect, it } from "vitest";
import { NAV_ITEMS, activeNavHref } from "../nav-items";
import { FOOTER_TEXT } from "../copy";

describe("shell navigation", () => {
  it("lists the screens in the agreed order", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/",
      "/requests/new",
      "/requests",
      "/approvals",
      "/mdm",
      "/sap",
      "/pulse",
      "/triage",
      "/impact",
      "/architecture",
      "/scope",
      "/assumptions",
      "/admin",
    ]);
  });

  it("marks exactly one item active, preferring the most specific href", () => {
    expect(activeNavHref("/")).toBe("/");
    expect(activeNavHref("/requests/new")).toBe("/requests/new");
    expect(activeNavHref("/requests")).toBe("/requests");
    expect(activeNavHref("/requests/REQ-1042")).toBe("/requests");
    expect(activeNavHref("/sap")).toBe("/sap");
    expect(activeNavHref("/sapling")).toBeNull();
    expect(activeNavHref("/unknown")).toBeNull();
  });

  it("carries the production-framing footer", () => {
    expect(FOOTER_TEXT).toContain("synthetic, illustrative data");
    expect(FOOTER_TEXT).toContain("SAP Business One");
  });
});
