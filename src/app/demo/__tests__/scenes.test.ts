import { describe, expect, it, vi } from "vitest";

// A Map-backed localStorage (and a minimal window) must exist before the store module loads.
vi.hoisted(() => {
  const mem = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  };
  const g = globalThis as unknown as { localStorage: typeof shim; window: { localStorage: typeof shim } };
  g.localStorage = shim;
  g.window = { localStorage: shim };
  return mem;
});

import { useSandbox, STORAGE_KEY } from "@/lib/store";
import { selectStuckDemand } from "@/lib/selectors";
import { SCENES, loadScene } from "@/lib/scenes";
import { K2EDTA_ITEM } from "@/lib/seed";

const s = () => useSandbox.getState();
const sgt = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(11, 16);

describe("demo scenes", () => {
  it("every scene loads without throwing and leaves its persona selected", async () => {
    for (const scene of SCENES) {
      const route = await loadScene(scene.id);
      expect(route.startsWith(scene.route.split("?")[0])).toBe(true);
      expect(s().personaId).toBe(scene.persona);
    }
  });

  it("amy-intake: fresh seed, no ad-hoc requests", async () => {
    expect(await loadScene("amy-intake")).toBe("/requests/new?domain=item");
    expect(s().requests.some((r) => Number(r.id.slice(4)) >= 1100)).toBe(false);
    expect(s().config.businessUnits.some((b) => b.id === "MLS")).toBe(false);
  });

  it("marcus-dup: MLS added and a customer draft for Natl Univ Hosp", async () => {
    const route = await loadScene("marcus-dup");
    expect(route).toBe("/requests/new?draft=REQ-1100");
    expect(s().config.businessUnits.some((b) => b.id === "MLS")).toBe(true);
    const d = s().requests.find((r) => r.id === "REQ-1100")!;
    expect(d.status).toBe("draft");
    expect(d.requestorId).toBe("marcus");
    expect(d.data).toMatchObject({ customerName: "Natl Univ Hosp", country: "SG", taxId: "198500123K", entity: "MLS" });
  });

  it("weijie-teams: extension pending on Wei Jie at Finance after Siti approved", async () => {
    expect(await loadScene("weijie-teams")).toBe("/approvals");
    const r = s().requests.find((x) => x.id === "REQ-1100")!;
    expect(r.domainId).toBe("extend");
    expect(r.entity).toBe("MLS");
    const bs = r.steps.find((x) => x.role === "business_support")!;
    expect(bs.status).toBe("approved");
    expect(bs.assigneeId).toBe("siti");
    const fin = r.steps.find((x) => x.role === "finance")!;
    expect(fin.status).toBe("pending");
    expect(fin.assigneeId).toBe("weijie");
    expect(sgt(s().nowIso())).toBe("10:05");
  });

  it("priya-sap: K2EDTA item at MDM review with 3 linked PRs; creating it drops stuck demand by S$36,000", async () => {
    expect(await loadScene("priya-sap")).toBe("/mdm?id=REQ-1100");
    const r = s().requests.find((x) => x.id === "REQ-1100")!;
    expect(r.data.itemName).toBe(K2EDTA_ITEM);
    expect(r.status).toBe("mdm_review");
    expect(r.steps.some((x) => x.role === "qa_ra")).toBe(true);
    expect(r.blockedPrIds.sort()).toEqual(["PR-5534", "PR-5536", "PR-5538"]);
    const before = selectStuckDemand(s()).totalSgd;
    expect(before).toBe(345_800);
    const res = s().markCreatedInSap("REQ-1100");
    expect(res.ok).toBe(true);
    expect(selectStuckDemand(s()).totalSgd).toBe(309_800);
  });

  it("is deterministic: loading the same scene twice gives the same requests and persists", async () => {
    await loadScene("priya-sap");
    const a = JSON.stringify(s().requests.map((r) => [r.id, r.status, r.steps.map((x) => [x.id, x.status, x.assigneeId])]));
    await loadScene("pulse");
    await loadScene("priya-sap");
    const b = JSON.stringify(s().requests.map((r) => [r.id, r.status, r.steps.map((x) => [x.id, x.status, x.assigneeId])]));
    expect(b).toBe(a);
    const saved = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.state.personaId).toBe("priya");
  });
});
