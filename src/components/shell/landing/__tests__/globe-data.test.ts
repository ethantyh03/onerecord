import { describe, expect, it } from "vitest";
import { getSeedSnapshot } from "@/lib/store";
import type { MdmRequest } from "@/lib/types";
import {
  GLOBE_NODES,
  angleBetween,
  buildArcs,
  buildDotMatrix,
  countByCountry,
  openRequestsForGlobe,
  slerp,
  toVec,
} from "../globe-data";

type Req = Pick<MdmRequest, "id" | "status" | "country">;
const req = (id: string, country: Req["country"], status: Req["status"] = "in_approval"): Req => ({ id, country, status });

describe("openRequestsForGlobe", () => {
  it("keeps only open requests (in approval, needs info, MDM check), in id order", () => {
    const list = openRequestsForGlobe([
      req("REQ-3", "MY", "mdm_review"),
      req("REQ-1", "TH", "needs_info"),
      req("REQ-2", "VN", "created"),
      req("REQ-4", "SG", "draft"),
      req("REQ-5", "MM", "rejected"),
      req("REQ-6", "SG", "cancelled"),
      req("REQ-0", "SG"),
    ]);
    expect(list.map((r) => r.id)).toEqual(["REQ-0", "REQ-1", "REQ-3"]);
  });

  it("matches the seeded sandbox: 11 open requests, two of them raised in Singapore", () => {
    const seed = getSeedSnapshot();
    const list = openRequestsForGlobe(seed.requests);
    expect(list).toHaveLength(11);
    expect(countByCountry(list)).toEqual({ SG: 2, MY: 4, TH: 2, VN: 2, MM: 1 });
  });
});

describe("buildArcs", () => {
  it("draws one arc per non-Singapore request; Singapore's own are rings, not arcs", () => {
    const arcs = buildArcs(openRequestsForGlobe([req("A", "SG"), req("B", "MY"), req("C", "MY"), req("D", "MM")]));
    expect(arcs.map((a) => a.id)).toEqual(["B", "C", "D"]);
  });

  it("runs from the requesting country's node to the Singapore hub, lifted off the surface", () => {
    const [arc] = buildArcs([{ id: "X", country: "TH" }], 32);
    const first = arc.points[0];
    const last = arc.points[arc.points.length - 1];
    expect(angleBetween(first, toVec(GLOBE_NODES.TH.at))).toBeLessThan(1e-6);
    expect(angleBetween(last, toVec(GLOBE_NODES.SG.at))).toBeLessThan(1e-6);
    const mid = arc.points[16];
    expect(Math.hypot(...mid)).toBeGreaterThan(1);
  });

  it("fans same-country arcs by height so each request stays visible", () => {
    const arcs = buildArcs([
      { id: "A", country: "MY" },
      { id: "B", country: "MY" },
    ]);
    const peak = (i: number) => Math.hypot(...arcs[i].points[24]);
    expect(peak(1)).toBeGreaterThan(peak(0));
  });

  it("keeps each request's rhythm stable across renders", () => {
    const a = buildArcs([{ id: "REQ-1042", country: "MY" }])[0];
    const b = buildArcs([{ id: "REQ-1042", country: "MY" }])[0];
    expect(a.period).toBe(b.period);
    expect(a.phase).toBe(b.phase);
  });
});

describe("sphere helpers", () => {
  it("slerp stays on the unit sphere", () => {
    const p = slerp(toVec([96.16, 16.84]), toVec([103.82, 1.35]), 0.4);
    expect(Math.hypot(...p)).toBeCloseTo(1, 9);
  });

  it("buildDotMatrix keeps only land inside the cap", () => {
    const { xyz, kind } = buildDotMatrix((lon) => (lon > 0 ? 1 : 0), 5, [90, 0], 30);
    expect(kind.length).toBeGreaterThan(0);
    expect(xyz.length).toBe(kind.length * 3);
    const centre = toVec([90, 0]);
    for (let i = 0; i < kind.length; i++) {
      const v: [number, number, number] = [xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]];
      expect(angleBetween(v, centre)).toBeLessThanOrEqual((30 * Math.PI) / 180 + 1e-6);
    }
  });
});
