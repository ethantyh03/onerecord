import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SIDEBAR_STORAGE_KEY,
  linkDocksRail,
  parseSidebarPref,
  readSidebarPref,
  sidebarMode,
  writeSidebarPref,
} from "../sidebar-state";

describe("sidebar placement", () => {
  it("is a drawer on Home at every width, so the hero gets the whole screen", () => {
    expect(sidebarMode("/", true)).toBe("overlay");
    expect(sidebarMode("/", false)).toBe("overlay");
  });

  it("docks beside the content on wide screens everywhere else, and is a drawer below lg", () => {
    expect(sidebarMode("/pulse", true)).toBe("docked");
    expect(sidebarMode("/requests/new", true)).toBe("docked");
    expect(sidebarMode("/pulse", false)).toBe("overlay");
  });

  it("lets a drawer link become the docked rail only when the next page docks it expanded", () => {
    expect(linkDocksRail("/pulse", "/", true, "expanded")).toBe(true);
    expect(linkDocksRail("/pulse", "/", true, "collapsed")).toBe(false);
    expect(linkDocksRail("/pulse", "/", false, "expanded")).toBe(false);
    expect(linkDocksRail("/", "/", true, "expanded")).toBe(false);
  });
});

describe("sidebar choice storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to expanded for anything but an explicit collapse", () => {
    expect(parseSidebarPref("collapsed")).toBe("collapsed");
    expect(parseSidebarPref("expanded")).toBe("expanded");
    expect(parseSidebarPref(null)).toBe("expanded");
    expect(parseSidebarPref("junk")).toBe("expanded");
  });

  it("round-trips through localStorage under or-sidebar", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    writeSidebarPref("collapsed");
    expect(store.get(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(readSidebarPref()).toBe("collapsed");
  });

  it("keeps working when storage throws or is missing", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(readSidebarPref()).toBe("expanded");
    expect(() => writeSidebarPref("collapsed")).not.toThrow();
    vi.stubGlobal("window", undefined);
    expect(readSidebarPref()).toBe("expanded");
    expect(() => writeSidebarPref("expanded")).not.toThrow();
  });
});
