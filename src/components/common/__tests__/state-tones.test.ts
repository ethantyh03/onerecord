import { describe, expect, it } from "vitest";
import { SLA_GLYPH } from "../sla";
import { STATUS_META, statusGlyphTone, type AnyStatus } from "../status-meta";

describe("statusGlyphTone (status as plain text, pattern sheet E1)", () => {
  it("colours only real states: done green, rejected coral, a question amber", () => {
    expect(statusGlyphTone("approved")).toBe("ok");
    expect(statusGlyphTone("created")).toBe("ok");
    expect(statusGlyphTone("rejected")).toBe("stuck");
    expect(statusGlyphTone("needs_info")).toBe("warn");
    expect(statusGlyphTone("question")).toBe("warn");
  });

  it("keeps work in progress grey and not-started work hollow", () => {
    for (const s of ["in_approval", "mdm_review", "pending"] as AnyStatus[]) expect(statusGlyphTone(s)).toBe("neutral");
    for (const s of ["draft", "waiting", "skipped", "cancelled"] as AnyStatus[]) expect(statusGlyphTone(s)).toBe("waiting");
  });

  it("has a tone for every known status and falls back for unknown ones", () => {
    for (const s of Object.keys(STATUS_META) as AnyStatus[]) expect(statusGlyphTone(s)).toBeTruthy();
    expect(statusGlyphTone("nope" as AnyStatus)).toBe("waiting");
  });
});

describe("SLA_GLYPH", () => {
  it("uses colour only for clock risk and done", () => {
    expect(SLA_GLYPH.ok).toBe("neutral");
    expect(SLA_GLYPH.paused).toBe("neutral");
    expect(SLA_GLYPH.warn).toBe("warn");
    expect(SLA_GLYPH.stuck).toBe("stuck");
    expect(SLA_GLYPH.done).toBe("ok");
    expect(SLA_GLYPH.idle).toBe("waiting");
  });
});
