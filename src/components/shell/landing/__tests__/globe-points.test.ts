import { describe, expect, it } from "vitest";
import { dedup, master } from "@/data/contract";
import { getSeedSnapshot } from "@/lib/store";
import {
  GLOBE_NODES,
  MERGE_TOTAL_MS,
  REGION_ANCHORS,
  buildCustomerPoints,
  fitCamera,
  landedCount,
  makeCamera,
  mergeProgress,
  openQueueRows,
  segmentTier,
  toVec,
  zipArea,
} from "../globe-data";

describe("customer points (one per record in the SAP extract)", () => {
  const points = buildCustomerPoints(master.customers);

  it("has one point per record and the duplicate counts from dedup.json (388 records, 25 duplicates, 363 customers)", () => {
    expect(points).toHaveLength(dedup.customers.rawRecords);
    expect(points.filter((p) => p.dup)).toHaveLength(dedup.customers.duplicateRecords);
    expect(new Set(points.map((p) => p.goldenCode)).size).toBe(dedup.customers.goldenCustomers);
  });

  it("links each duplicate to a surviving record of the same customer", () => {
    const byCode = new Map(points.map((p) => [p.code, p]));
    for (const p of points.filter((q) => q.dup)) {
      const g = byCode.get(p.goldenCode)!;
      expect(g.dup).toBe(false);
      expect(g.goldenId).toBe(p.goldenId);
    }
  });

  it("keeps the SG-coded copy of Hospital Taman Seri in Singapore, linked across the border to the Malaysian record", () => {
    const copy = points.find((p) => p.code === "C-SG-00074")!;
    expect(copy.dup).toBe(true);
    expect(copy.crossBorder).toBe(true);
    expect(copy.goldenCode).toBe("C-MY-00066");
    expect(copy.at[0]).toBeGreaterThan(103.5);
    expect(copy.at[1]).toBeLessThan(1.6);
  });

  it("merges Bukit Damai's three records into one", () => {
    const bd = points.filter((p) => p.goldenId === "G-MY-0002");
    expect(bd).toHaveLength(3);
    expect(bd.filter((p) => !p.dup).map((p) => p.code)).toEqual(["C-MY-00029"]);
  });

  it("is deterministic", () => {
    const again = buildCustomerPoints(master.customers);
    expect(again.map((p) => p.at)).toEqual(points.map((p) => p.at));
  });

  it("sizes by segment: hospitals > labs > research and industry > clinics", () => {
    expect(segmentTier("Public hospital")).toBe(3);
    expect(segmentTier("Private hospital")).toBe(3);
    expect(segmentTier("Diagnostic lab")).toBe(2);
    expect(segmentTier("Industry")).toBe(1);
    expect(segmentTier("Clinic")).toBe(0);
  });

  it("places records by postcode area inside their own country", () => {
    expect(zipArea("SG", "119074").at[1]).toBeCloseTo(1.3, 0);
    expect(zipArea("VN", "100000").at[1]).toBeGreaterThan(20); // Hanoi
    expect(zipArea("VN", "700000").at[1]).toBeLessThan(12); // Ho Chi Minh City
    expect(zipArea("TH", "50000").at[1]).toBeGreaterThan(18); // Chiang Mai
    expect(zipArea("MM", undefined).at).toEqual([96.16, 16.84]); // no postcode: Yangon
  });
});

describe("the merge", () => {
  const points = buildCustomerPoints(master.customers);

  it("lands every duplicate by the end, none before it starts", () => {
    expect(landedCount(points, -1)).toBe(0);
    expect(landedCount(points, MERGE_TOTAL_MS)).toBe(dedup.customers.duplicateRecords);
    for (const p of points.filter((q) => q.dup)) expect(mergeProgress(p.code, MERGE_TOTAL_MS)).toBe(1);
  });

  it("counts up monotonically", () => {
    let prev = 0;
    for (let t = 0; t <= MERGE_TOTAL_MS; t += 50) {
      const n = landedCount(points, t);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
});

describe("open queue rows (the hero's live panel)", () => {
  it("lists the same 11 open requests as the arcs, newest first, with their stage", () => {
    const rows = openQueueRows(getSeedSnapshot().requests);
    expect(rows).toHaveLength(11);
    expect(rows[0].id).toBe("REQ-1044");
    expect(rows.find((r) => r.id === "REQ-1042")?.stage).toBe("MDM check");
    expect(rows.find((r) => r.id === "REQ-1036")?.stage).toBe("Needs info");
  });
});

describe("camera", () => {
  const zone = { x: 860, y: 84, w: 470, h: 470 };
  const cam = makeCamera(fitCamera(zone, 20));

  it("fits the region's anchors into the zone", () => {
    for (const a of REGION_ANCHORS) {
      const p = cam.project(toVec(a));
      expect(p.depth).toBeGreaterThan(0);
      expect(p.x).toBeGreaterThanOrEqual(zone.x - 1);
      expect(p.x).toBeLessThanOrEqual(zone.x + zone.w + 1);
      expect(p.y).toBeGreaterThanOrEqual(zone.y - 1);
      expect(p.y).toBeLessThanOrEqual(zone.y + zone.h + 1);
    }
  });

  it("puts the top of the horizon near the requested line, above every entity", () => {
    const top = Math.min(...cam.horizon().map((q) => q.y));
    expect(Math.abs(top - 20)).toBeLessThan(6);
    for (const n of Object.values(GLOBE_NODES)) expect(cam.project(toVec(n.at)).y).toBeGreaterThan(top);
  });

  it("pins a point behind the horizon onto it", () => {
    const behind = toVec([-80, 10]);
    const pinned = cam.pin(behind);
    expect(Math.hypot(...pinned)).toBeCloseTo(1, 6);
    expect(Math.abs(cam.project(pinned).depth)).toBeLessThan(1e-6);
  });
});
