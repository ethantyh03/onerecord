import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/config/default-config";
import { assignSapCode, sapKeyFor } from "@/lib/engine/codes";
import { buildDtwFiles } from "@/lib/engine/dtw";
import { buildSeed, knownSapCodes } from "@/lib/seed";
import { primaryKeyOf, simulateDtwImport } from "../dtw-sim";

const NOW = "2026-10-28T02:00:00.000Z";

describe("DTW simulation on the seeded demo", () => {
  const seed = buildSeed(NOW);
  const ready = seed.requests.filter((r) => r.status === "mdm_review");

  function simulate(id: string) {
    const req = seed.requests.find((r) => r.id === id);
    if (!req) throw new Error(`${id} missing from seed`);
    const domain = DEFAULT_CONFIG.domains.find((d) => d.id === req.domainId);
    if (!domain) throw new Error(`${id} has no domain`);
    const code = assignSapCode(domain, req, knownSapCodes(seed, req.id));
    const files = buildDtwFiles(req, domain, code);
    return { req, domain, code, files, sim: simulateDtwImport(files) };
  }

  it("REQ-1042 (the demo item) is ready and simulates with 0 errors, 0 warnings", () => {
    expect(ready.map((r) => r.id)).toContain("REQ-1042");
    const { sim, files, code } = simulate("REQ-1042");
    expect(sim.files.flatMap((f) => [...f.errors, ...f.warnings])).toEqual([]);
    expect(primaryKeyOf(files)).toBe(code);
    expect(code).toMatch(/^I-A-\d{6}$/);
  });

  it("every other request waiting for MDM simulates without errors", () => {
    for (const r of ready) {
      const { sim } = simulate(r.id);
      expect(sim.files.flatMap((f) => f.errors), r.id).toEqual([]);
    }
  });

  it("cost-centre requests post an 8-character PrcCode (CC- prefix dropped) and import cleanly", () => {
    const ccs = seed.requests.filter((r) => DEFAULT_CONFIG.domains.find((d) => d.id === r.domainId)?.sapObject === "oProfitCenter");
    expect(ccs.length).toBeGreaterThan(0);
    for (const r of ccs) {
      const { code, files, sim } = simulate(r.id);
      expect(code).toMatch(/^CC-[A-Z]{2}-\d{4}$/);
      expect(primaryKeyOf(files)).toBe(sapKeyFor(code));
      expect(sapKeyFor(code).length).toBeLessThanOrEqual(8);
      expect(sim.files.flatMap((f) => f.errors), r.id).toEqual([]);
    }
  });
});
