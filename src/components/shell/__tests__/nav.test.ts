import { describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, activeNavHref } from "../nav-items";
import { ENVIRONMENT_TAG, FOOTER_TEXT, footerText } from "../copy";

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
      "/admin",
      "/impact",
      "/architecture",
      "/scope",
      "/assumptions",
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

  it("carries the environment footer, with the live config version when known", () => {
    expect(FOOTER_TEXT).toContain("Lives Group");
    expect(FOOTER_TEXT).toContain("Sandbox environment");
    expect(footerText()).toBe(FOOTER_TEXT);
    expect(footerText(3)).toBe(`${FOOTER_TEXT} · Config v3`);
  });

  it("shows one environment tag that says the data is synthetic", () => {
    expect(ENVIRONMENT_TAG).toBe("Sandbox · synthetic data");
  });

  it("groups the reference pages under About, at the foot of the rail", () => {
    const about = NAV_GROUPS.find((g) => g.label === "About");
    expect(about?.atEnd).toBe(true);
    expect(NAV_GROUPS.at(-1)).toBe(about);
    expect(about?.items.map((i) => i.label)).toEqual(["Business case", "Architecture", "Scope & roadmap", "Assumptions"]);
    expect(NAV_GROUPS.find((g) => g.label === "Insight")?.items.map((i) => i.href)).toEqual(["/pulse", "/triage"]);
  });
});
