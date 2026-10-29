import type { CountryCode, CustomerMaster, MdmRequest } from "@/lib/types";

/**
 * Data and geometry for the landing page's globe. Pure functions (no DOM), so the mapping from the
 * SAP customer extract and the sandbox to what is drawn is unit-tested.
 */

/** Statuses that still have work ahead of them: the same set the SLA engine ticks. */
const OPEN: ReadonlySet<MdmRequest["status"]> = new Set(["in_approval", "needs_info", "mdm_review"]);

export interface GlobeNode {
  code: CountryCode;
  name: string;
  /** City the country team sits in, [lon, lat] */
  at: [number, number];
  /** Where the country name goes, [lon, lat] (inside the country, clear of the record clusters) */
  labelAt: [number, number];
}

/** The five Lives Group operating entities. Singapore is the hub: the MDM team sits there. */
export const GLOBE_NODES: Record<CountryCode, GlobeNode> = {
  SG: { code: "SG", name: "Singapore", at: [103.82, 1.35], labelAt: [104.05, 1.0] },
  MY: { code: "MY", name: "Malaysia", at: [101.69, 3.14], labelAt: [102.55, 4.75] },
  TH: { code: "TH", name: "Thailand", at: [100.5, 13.75], labelAt: [102.4, 16.5] },
  VN: { code: "VN", name: "Vietnam", at: [106.63, 10.82], labelAt: [107.95, 14.2] },
  MM: { code: "MM", name: "Myanmar", at: [96.16, 16.84], labelAt: [96.3, 20.6] },
};

export const HUB: CountryCode = "SG";

/** ISO 3166 numeric ids in world-atlas for the operating countries. */
export const OPERATING_ISO_IDS = new Set(["458", "764", "704", "104", "702"]);

export interface GlobeRequest {
  id: string;
  country: CountryCode;
}

/** Every open request in the sandbox (in approval, waiting on an answer, or at the MDM check), in id order. */
export function openRequestsForGlobe(requests: Pick<MdmRequest, "id" | "status" | "country">[]): GlobeRequest[] {
  return requests
    .filter((r) => OPEN.has(r.status) && r.country in GLOBE_NODES)
    .map((r) => ({ id: r.id, country: r.country }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Open requests per country (all five keys present). */
export function countByCountry(list: GlobeRequest[]): Record<CountryCode, number> {
  const out: Record<CountryCode, number> = { SG: 0, MY: 0, TH: 0, VN: 0, MM: 0 };
  for (const r of list) out[r.country] += 1;
  return out;
}

export interface QueueRow {
  id: string;
  title: string;
  country: CountryCode;
  /** Where it is now, in the words the request page uses */
  stage: string;
}

/** The open queue for the hero's live panel: the same requests as the arcs, newest first. */
export function openQueueRows(
  requests: Pick<MdmRequest, "id" | "status" | "country" | "title" | "steps">[],
): QueueRow[] {
  return requests
    .filter((r) => OPEN.has(r.status) && r.country in GLOBE_NODES)
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((r) => {
      let stage: string;
      if (r.status === "needs_info") stage = "Needs info";
      else if (r.status === "mdm_review") stage = "MDM check";
      else {
        const current = r.steps.find((s) => s.status === "pending" || s.status === "question");
        stage = current?.stageLabel ?? "In approval";
      }
      return { id: r.id, title: r.title, country: r.country, stage };
    });
}

// ------------------------------------------------------------------------------------------------
// Sphere maths. A point on the globe is a unit vector: x towards (0°, 0°), y towards (90°E, 0°), z north.
// ------------------------------------------------------------------------------------------------

export type Vec3 = [number, number, number];
const RAD = Math.PI / 180;

export function toVec([lon, lat]: [number, number]): Vec3 {
  const cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lon * RAD), cl * Math.sin(lon * RAD), Math.sin(lat * RAD)];
}

/** Angle between two unit vectors, radians. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(d);
}

/** Great-circle interpolation between two unit vectors. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const w = angleBetween(a, b);
  if (w < 1e-6) return [...a];
  const s = Math.sin(w);
  const ka = Math.sin((1 - t) * w) / s;
  const kb = Math.sin(t * w) / s;
  return [ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]];
}

/** Small deterministic hash so each request or record keeps its own place and rhythm across renders. */
export function hashUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Screen basis for an orthographic view centred on (lon, lat): f towards the viewer, e right, n up. */
export function viewBasis(lonDeg: number, latDeg: number) {
  const lam = lonDeg * RAD;
  const phi = latDeg * RAD;
  const cl = Math.cos(lam),
    sl = Math.sin(lam),
    cp = Math.cos(phi),
    sp = Math.sin(phi);
  return {
    f: [cp * cl, cp * sl, sp] as const,
    e: [-sl, cl, 0] as const,
    n: [-sp * cl, -sp * sl, cp] as const,
  };
}

export interface ArcPath {
  id: string;
  /** Sample points from origin to hub, lifted off the surface (|p| >= 1) */
  points: Vec3[];
  /** Seconds for one pulse to travel origin → hub */
  period: number;
  /** 0..1 phase offset so pulses don't march in step */
  phase: number;
}

/**
 * One arc per non-hub request, from its country's node to the hub. Requests from the same country
 * share the start and fan out by height, so four Malaysian requests read as four nested arcs.
 * `liftScale` keeps the arcs the same height on screen when the globe is drawn larger, and the height is
 * softly capped at a quarter of the chord, so a short hop never towers (the order of the lanes is kept).
 */
export const ARC_MAX_RISE = 0.25;

export function buildArcs(list: GlobeRequest[], samples = 48, liftScale = 1): ArcPath[] {
  const hub = toVec(GLOBE_NODES[HUB].at);
  const lanes: Partial<Record<CountryCode, number>> = {};
  const arcs: ArcPath[] = [];
  for (const r of list) {
    if (r.country === HUB) continue;
    const lane = (lanes[r.country] = (lanes[r.country] ?? -1) + 1);
    const origin = toVec(GLOBE_NODES[r.country].at);
    const dist = angleBetween(origin, hub);
    // Height above the surface at mid-arc, as a fraction of the radius.
    const raw = (dist * (0.16 + 0.11 * lane) + 0.006 * lane) * liftScale;
    const cap = ARC_MAX_RISE * 2 * Math.sin(dist / 2);
    const lift = cap * Math.tanh(raw / cap);
    const points: Vec3[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = slerp(origin, hub, t);
      const k = 1 + lift * Math.sin(Math.PI * t);
      points.push([p[0] * k, p[1] * k, p[2] * k]);
    }
    const h = hashUnit(r.id);
    arcs.push({ id: r.id, points, period: 3.4 + h * 1.6, phase: h });
  }
  return arcs;
}

/**
 * Evenly spaced dots over the sphere (rows of latitude, spacing kept in degrees of arc), limited to a
 * cap around `around` because only that side of the globe is ever on screen.
 * `classify(lon, lat)` returns 0 for sea, 1 for land, 2 for an operating country.
 */
export function buildDotMatrix(
  classify: (lon: number, lat: number) => 0 | 1 | 2,
  spacingDeg: number,
  around: [number, number],
  capDeg: number,
): { xyz: Float32Array; kind: Uint8Array } {
  const centre = toVec(around);
  const minDot = Math.cos(capDeg * RAD);
  const xyz: number[] = [];
  const kind: number[] = [];
  let row = 0;
  for (let lat = -84; lat <= 84; lat += spacingDeg, row++) {
    const n = Math.max(1, Math.round((360 * Math.cos(lat * RAD)) / spacingDeg));
    const off = row % 2 ? 0.5 : 0;
    for (let i = 0; i < n; i++) {
      const lon = -180 + ((i + off) * 360) / n;
      const v = toVec([lon, lat]);
      if (v[0] * centre[0] + v[1] * centre[1] + v[2] * centre[2] < minDot) continue;
      const k = classify(lon, lat);
      if (!k) continue;
      xyz.push(v[0], v[1], v[2]);
      kind.push(k);
    }
  }
  return { xyz: Float32Array.from(xyz), kind: Uint8Array.from(kind) };
}

// ------------------------------------------------------------------------------------------------
// Customer records: one dot per record in the illustrative SAP customer extract (master.json).
// ------------------------------------------------------------------------------------------------

/** [first prefix, last prefix, [lon, lat], spread in degrees] */
type ZipArea = readonly [number, number, readonly [number, number], number];

/**
 * Postcode prefix → the area it covers. Approximate: the synthetic postcodes follow each country's
 * real scheme (Singapore sector, Malaysian state, Thai province, Vietnamese city, Yangon), so a
 * record sits in the right part of its country. Prefixes the real schemes do not use fall back to
 * the region of their first digit (Thailand) or the main city.
 */
const ZIP_AREAS: Record<CountryCode, { digits: number; areas: ZipArea[]; fallback: (p: number) => ZipArea }> = {
  SG: {
    digits: 2,
    areas: [
      [1, 8, [103.849, 1.281], 0.019],
      [9, 10, [103.822, 1.274], 0.019],
      [11, 13, [103.776, 1.302], 0.022],
      [14, 16, [103.806, 1.289], 0.019],
      [17, 19, [103.855, 1.298], 0.016],
      [20, 23, [103.842, 1.306], 0.019],
      [24, 27, [103.805, 1.322], 0.022],
      [28, 30, [103.842, 1.328], 0.022],
      [31, 33, [103.862, 1.336], 0.022],
      [34, 37, [103.885, 1.319], 0.022],
      [38, 41, [103.902, 1.309], 0.019],
      [42, 45, [103.922, 1.315], 0.022],
      [46, 48, [103.942, 1.328], 0.022],
      [49, 50, [103.982, 1.36], 0.022],
      [51, 52, [103.947, 1.36], 0.022],
      [53, 55, [103.889, 1.372], 0.026],
      [56, 57, [103.846, 1.365], 0.022],
      [58, 59, [103.774, 1.341], 0.022],
      [60, 64, [103.712, 1.333], 0.032],
      [65, 68, [103.759, 1.373], 0.026],
      [69, 71, [103.712, 1.405], 0.026],
      [72, 73, [103.775, 1.436], 0.019],
      [75, 76, [103.832, 1.43], 0.019],
      [77, 78, [103.82, 1.398], 0.019],
      [79, 80, [103.868, 1.398], 0.019],
      [81, 81, [103.982, 1.36], 0.022],
      [82, 82, [103.902, 1.398], 0.019],
    ],
    fallback: () => [0, 0, [103.83, 1.35], 0.064],
  },
  MY: {
    digits: 2,
    areas: [
      [1, 2, [100.2, 6.44], 0.192],
      [5, 6, [100.37, 6.12], 0.288],
      [7, 7, [99.8, 6.35], 0.144],
      [8, 9, [100.49, 5.65], 0.288],
      [10, 11, [100.31, 5.4], 0.144],
      [12, 14, [100.45, 5.38], 0.192],
      [15, 16, [102.24, 6.08], 0.288],
      [17, 18, [101.97, 5.4], 0.48],
      [20, 21, [103.13, 5.3], 0.24],
      [22, 24, [103.4, 4.5], 0.432],
      [25, 26, [103.32, 3.81], 0.288],
      [27, 28, [102.42, 3.45], 0.48],
      [30, 31, [101.08, 4.6], 0.24],
      [32, 32, [100.7, 4.22], 0.24],
      [33, 33, [100.94, 4.77], 0.24],
      [34, 34, [100.73, 4.85], 0.24],
      [35, 35, [101.25, 3.95], 0.24],
      [36, 36, [101.02, 4.02], 0.192],
      [39, 39, [101.38, 4.47], 0.144],
      [40, 42, [101.45, 3.05], 0.24],
      [43, 43, [101.79, 2.99], 0.192],
      [44, 44, [101.65, 3.56], 0.192],
      [45, 45, [101.26, 3.34], 0.192],
      [46, 47, [101.61, 3.1], 0.144],
      [48, 48, [101.58, 3.32], 0.144],
      [49, 49, [101.74, 3.71], 0.12],
      [50, 60, [101.69, 3.14], 0.168],
      [62, 62, [101.69, 2.93], 0.096],
      [63, 63, [101.65, 2.92], 0.096],
      [64, 64, [101.7, 2.74], 0.144],
      [68, 68, [101.76, 3.17], 0.12],
      [69, 69, [101.79, 3.42], 0.12],
      [70, 71, [101.94, 2.73], 0.24],
      [72, 73, [102.25, 2.73], 0.288],
      [75, 78, [102.25, 2.2], 0.192],
      [79, 81, [103.74, 1.52], 0.192],
      [82, 82, [103.39, 1.49], 0.192],
      [83, 83, [102.93, 1.85], 0.192],
      [84, 84, [102.57, 2.04], 0.192],
      [85, 85, [102.82, 2.5], 0.24],
      [86, 86, [103.32, 2.03], 0.24],
      [87, 87, [115.24, 5.28], 0.096],
      [88, 89, [116.07, 5.98], 0.24],
      [90, 91, [118.07, 5.0], 0.36],
      [93, 98, [110.35, 1.55], 0.36],
    ],
    fallback: () => [0, 0, [101.62, 3.1], 0.29],
  },
  TH: {
    digits: 2,
    areas: [
      [10, 10, [100.52, 13.75], 0.192],
      [11, 11, [100.5, 13.86], 0.12],
      [12, 12, [100.53, 14.02], 0.144],
      [13, 13, [100.57, 14.35], 0.192],
      [14, 14, [100.45, 14.59], 0.144],
      [15, 15, [100.65, 14.8], 0.24],
      [16, 16, [100.4, 14.89], 0.144],
      [17, 17, [100.13, 15.18], 0.192],
      [18, 18, [100.91, 14.53], 0.192],
      [20, 20, [100.98, 13.36], 0.24],
      [21, 21, [101.28, 12.68], 0.24],
      [22, 22, [102.1, 12.61], 0.24],
      [23, 23, [102.5, 12.24], 0.192],
      [24, 24, [101.07, 13.69], 0.192],
      [25, 25, [101.37, 14.05], 0.192],
      [26, 26, [101.21, 14.2], 0.144],
      [27, 27, [102.07, 13.82], 0.24],
      [30, 30, [102.1, 14.97], 0.288],
      [31, 31, [103.1, 14.99], 0.24],
      [32, 32, [103.49, 14.88], 0.24],
      [33, 33, [104.32, 15.12], 0.24],
      [34, 34, [104.85, 15.24], 0.288],
      [35, 35, [104.15, 15.79], 0.192],
      [36, 36, [102.03, 15.81], 0.24],
      [37, 37, [104.62, 15.86], 0.192],
      [38, 38, [103.65, 18.36], 0.192],
      [39, 39, [102.43, 17.2], 0.192],
      [40, 40, [102.83, 16.43], 0.288],
      [41, 41, [102.79, 17.41], 0.24],
      [42, 42, [101.72, 17.49], 0.24],
      [43, 43, [102.74, 17.88], 0.192],
      [44, 44, [103.3, 16.18], 0.192],
      [45, 45, [103.65, 16.05], 0.192],
      [46, 46, [103.51, 16.43], 0.192],
      [47, 47, [104.15, 17.16], 0.24],
      [48, 48, [104.78, 17.4], 0.192],
      [49, 49, [104.72, 16.54], 0.192],
      [50, 50, [98.98, 18.79], 0.24],
      [51, 51, [99.0, 18.58], 0.144],
      [52, 52, [99.49, 18.29], 0.24],
      [53, 53, [100.1, 17.62], 0.24],
      [54, 54, [100.14, 18.14], 0.192],
      [55, 55, [100.77, 18.78], 0.24],
      [56, 56, [99.9, 19.17], 0.192],
      [57, 57, [99.83, 19.91], 0.24],
      [58, 58, [97.97, 19.3], 0.192],
      [60, 60, [100.12, 15.7], 0.24],
      [61, 61, [100.02, 15.38], 0.192],
      [62, 62, [99.52, 16.48], 0.24],
      [63, 63, [99.13, 16.87], 0.24],
      [64, 64, [99.82, 17.01], 0.192],
      [65, 65, [100.26, 16.82], 0.24],
      [66, 66, [100.35, 16.44], 0.192],
      [67, 67, [101.16, 16.42], 0.24],
      [70, 70, [99.81, 13.54], 0.192],
      [71, 71, [99.53, 14.0], 0.288],
      [72, 72, [100.12, 14.47], 0.192],
      [73, 73, [100.06, 13.82], 0.144],
      [74, 74, [100.27, 13.55], 0.12],
      [75, 75, [100.0, 13.41], 0.096],
      [76, 76, [99.94, 13.11], 0.192],
      [77, 77, [99.8, 11.81], 0.288],
      [80, 80, [99.96, 8.43], 0.24],
      [81, 81, [98.91, 8.09], 0.192],
      [82, 82, [98.53, 8.45], 0.192],
      [83, 83, [98.36, 7.92], 0.096],
      [84, 84, [99.33, 9.14], 0.288],
      [85, 85, [98.63, 9.96], 0.192],
      [86, 86, [99.18, 10.49], 0.24],
      [90, 90, [100.6, 7.1], 0.24],
      [91, 91, [100.07, 6.62], 0.144],
      [92, 92, [99.61, 7.56], 0.192],
      [93, 93, [100.07, 7.62], 0.192],
      [94, 94, [101.25, 6.87], 0.144],
      [95, 95, [101.28, 6.54], 0.144],
      [96, 96, [101.82, 6.43], 0.144],
    ],
    // Prefixes the Thai scheme does not use (68, 69, 78, 79, 87…): the region of the first digit.
    fallback: (p) => {
      const byDigit: Record<number, readonly [number, number]> = {
        1: [100.55, 13.85],
        2: [101.3, 13.1],
        3: [103.3, 15.0],
        4: [103.2, 16.9],
        5: [99.6, 18.6],
        6: [100.1, 16.4],
        7: [99.75, 13.6],
        8: [99.1, 8.9],
        9: [100.6, 7.0],
      };
      return [0, 0, byDigit[Math.floor(p / 10)] ?? [100.52, 13.75], 0.5];
    },
  },
  VN: {
    digits: 3,
    areas: [
      [100, 109, [105.83, 21.02], 0.312],
      [550, 559, [108.2, 16.05], 0.24],
      [700, 709, [106.68, 10.79], 0.288],
    ],
    fallback: () => [0, 0, [106.68, 10.79], 0.29],
  },
  MM: {
    digits: 2,
    areas: [
      [5, 5, [96.08, 21.97], 0.288],
      [11, 11, [96.16, 16.84], 0.312],
      [15, 15, [96.13, 19.75], 0.24],
    ],
    fallback: () => [0, 0, [96.16, 16.84], 0.31],
  },
};

/** The area a record's postcode points to (its own country's scheme). */
export function zipArea(country: CountryCode, zip: string | undefined): { at: [number, number]; spread: number } {
  const scheme = ZIP_AREAS[country];
  const digits = (zip ?? "").replace(/\D/g, "");
  const p = digits.length >= scheme.digits ? Number(digits.slice(0, scheme.digits)) : NaN;
  const hit = Number.isFinite(p) ? scheme.areas.find(([a, b]) => p >= a && p <= b) : undefined;
  const area = hit ?? scheme.fallback(Number.isFinite(p) ? p : -1);
  return { at: [area[2][0], area[2][1]], spread: area[3] };
}

export type SegmentTier = 3 | 2 | 1 | 0;

/** Dot size class: hospitals > diagnostic labs > research and industry > clinics. */
export function segmentTier(segment: string): SegmentTier {
  if (segment === "Public hospital" || segment === "Private hospital") return 3;
  if (segment === "Diagnostic lab") return 2;
  if (segment === "Clinic") return 0;
  return 1;
}

export interface CustomerPoint {
  code: string;
  name: string;
  country: CountryCode;
  segment: string;
  tier: SegmentTier;
  goldenId: string;
  /** The record this one merges into; its own code when it is the surviving record */
  goldenCode: string;
  /** A second (or third) record for a customer that already has one */
  dup: boolean;
  /** A duplicate coded to another country than its customer (e.g. an SG-coded Malaysian hospital) */
  crossBorder: boolean;
  /** No transactions on the record */
  dormant: boolean;
  /** [lon, lat], approximate: postcode area + a small deterministic offset */
  at: [number, number];
}

/** Which record of a customer survives the merge: coded in the customer's own country, with a tax ID, oldest code. */
function survivorOrder(goldenId: string) {
  const home = goldenId.slice(2, 4);
  return (a: CustomerMaster, b: CustomerMaster) =>
    Number(b.country === home) - Number(a.country === home) ||
    Number(!!b.licTradNum) - Number(!!a.licTradNum) ||
    a.cardCode.localeCompare(b.cardCode);
}

function jitter(code: string, k: number, spread: number): [number, number] {
  const u = Math.max(1e-4, hashUnit(`${code}#${k}a`));
  const v = hashUnit(`${code}#${k}b`);
  const d = Math.min(2.2, Math.sqrt(-2 * Math.log(u))) * spread;
  return [Math.cos(v * 2 * Math.PI) * d, Math.sin(v * 2 * Math.PI) * d];
}

/**
 * One point per customer record. Clean records sit in their postcode area; a duplicate sits a short
 * way from the record it duplicates (same customer, usually the same postcode) so the link between
 * them is visible, except when it is coded to another country: then it sits in that country, which
 * is the problem (an SG-coded Malaysian hospital books its orders to Singapore).
 * `isLand` keeps points off the sea where it can (tries a few offsets, then the area centre).
 */
export function buildCustomerPoints(
  customers: CustomerMaster[],
  isLand: (lon: number, lat: number) => boolean = () => true,
): CustomerPoint[] {
  const groups = new Map<string, CustomerMaster[]>();
  for (const c of customers) {
    const g = groups.get(c.goldenId);
    if (g) g.push(c);
    else groups.set(c.goldenId, [c]);
  }
  const survivor = new Map<string, CustomerMaster>();
  for (const [gid, recs] of groups) survivor.set(gid, [...recs].sort(survivorOrder(gid))[0]);

  const place = (c: CustomerMaster, around?: [number, number]): [number, number] => {
    const area = zipArea(c.country, c.zipCode);
    for (let k = 0; k < 10; k++) {
      let lon: number, lat: number;
      if (around) {
        // A duplicate: a short, fixed-length offset from its customer's record.
        const a = hashUnit(`${c.cardCode}#${k}d`) * 2 * Math.PI;
        const d = (c.country === "SG" ? 0.05 : 0.4) * (1 + 0.35 * hashUnit(`${c.cardCode}#${k}e`));
        lon = around[0] + Math.cos(a) * d;
        lat = around[1] + Math.sin(a) * d * 0.8;
      } else {
        const [dx, dy] = jitter(c.cardCode, k, area.spread);
        lon = area.at[0] + dx;
        lat = area.at[1] + dy;
      }
      if (isLand(lon, lat)) return [lon, lat];
    }
    return around ? [around[0], around[1]] : [area.at[0], area.at[1]];
  };

  const at = new Map<string, [number, number]>();
  for (const s of survivor.values()) at.set(s.cardCode, place(s));

  return customers.map((c) => {
    const s = survivor.get(c.goldenId)!;
    const dup = s.cardCode !== c.cardCode;
    const crossBorder = dup && c.country !== s.country;
    const pos = dup ? (crossBorder ? place(c) : place(c, at.get(s.cardCode))) : at.get(c.cardCode)!;
    return {
      code: c.cardCode,
      name: c.cardName,
      country: c.country,
      segment: c.segment,
      tier: segmentTier(c.segment),
      goldenId: c.goldenId,
      goldenCode: s.cardCode,
      dup,
      crossBorder,
      dormant: c.hasTransactions === false,
      at: pos,
    };
  });
}

// ------------------------------------------------------------------------------------------------
// The merge: duplicates glide into their customer's record, a few at a time.
// ------------------------------------------------------------------------------------------------

/** Wait after load before the merge starts, so the duplicates and their links are seen first. */
export const MERGE_DELAY_MS = 4800;
/** Spread of start times across the duplicates, and the glide of each one. */
export const MERGE_STAGGER_MS = 1400;
export const MERGE_GLIDE_MS = 1100;
export const MERGE_TOTAL_MS = MERGE_STAGGER_MS + MERGE_GLIDE_MS;

/** When this duplicate starts moving, in ms after the merge starts. */
export function mergeOffsetMs(code: string): number {
  return Math.round(hashUnit(`${code}#merge`) * MERGE_STAGGER_MS);
}

/** 0 before this duplicate starts, 1 once it has landed on its customer's record. */
export function mergeProgress(code: string, elapsedMs: number): number {
  return Math.min(1, Math.max(0, (elapsedMs - mergeOffsetMs(code)) / MERGE_GLIDE_MS));
}

/** How many duplicates have landed `elapsedMs` after the merge started. */
export function landedCount(points: Pick<CustomerPoint, "code" | "dup">[], elapsedMs: number): number {
  let n = 0;
  for (const p of points) if (p.dup && mergeProgress(p.code, elapsedMs) >= 1) n++;
  return n;
}

// ------------------------------------------------------------------------------------------------
// The view: a perspective camera above the globe, south of the region and looking north at it, so the
// horizon curves across the top of the hero (as on the Gotham site) while the region stays large.
// ------------------------------------------------------------------------------------------------

/**
 * Points the fitted view must show: the record clusters and hubs from Yangon to Hanoi, the Vietnamese
 * coast and Singapore. (Myanmar's empty west and Malaysian Borneo may fall outside the zone.)
 */
export const REGION_ANCHORS: [number, number][] = [
  [95.6, 16.6],
  [96.3, 20.9],
  [99.0, 19.9],
  [102.7, 18.0],
  [105.9, 21.3],
  [108.6, 16.0],
  [109.3, 12.6],
  [106.9, 10.4],
  [104.3, 1.15],
  [103.0, 1.5],
  [100.2, 6.4],
  [98.3, 7.8],
];

/** Longitude the camera looks along (the middle of the region), and the latitude it looks at. */
export const REGION_LON = 102.4;
export const REGION_TARGET_LAT = 10;
/** Camera distance from the globe's centre, in globe radii: close enough for a visibly curved horizon. */
export const CAMERA_DISTANCE = 1.9;

export interface CameraParams {
  /** The point on the globe straight below the camera */
  lon: number;
  lat: number;
  /** Distance from the centre, in radii (> 1) */
  D: number;
  /** The point the camera looks at, [lon, lat] */
  target: [number, number];
  /** Focal length (px per unit of tan) and the screen position of the view axis */
  f: number;
  ox: number;
  oy: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Distance along the view axis (perspective: nearer things are larger) */
  z: number;
  /** 0 on the horizon … 1 straight below the camera; < 0 behind the horizon */
  depth: number;
}

export interface Camera {
  params: CameraParams;
  /** Unit vector to the point below the camera */
  u: Vec3;
  project(p: readonly number[]): Projected;
  /** A point behind the horizon moved onto it (same bearing), so land that runs over the edge fills up to it */
  pin(p: readonly number[]): Vec3;
  /** The visible part of the horizon, in screen space, as one curve from left to right */
  horizon(samples?: number): { x: number; y: number }[];
  /** View-axis distance of the target, the reference for perspective sizes */
  zRef: number;
}

const norm = (v: Vec3): Vec3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function makeCamera(params: CameraParams): Camera {
  const { D, f, ox, oy } = params;
  const u = toVec([params.lon, params.lat]);
  const C: Vec3 = [u[0] * D, u[1] * D, u[2] * D];
  const T = toVec(params.target);
  const F = norm([T[0] - C[0], T[1] - C[1], T[2] - C[2]]);
  const R = norm(cross(F, [0, 0, 1]));
  const U = cross(R, F);
  const invD = 1 / D;
  const rho = Math.sqrt(1 - invD * invD);

  const project = (p: readonly number[]): Projected => {
    const vx = p[0] - C[0],
      vy = p[1] - C[1],
      vz = p[2] - C[2];
    const z = vx * F[0] + vy * F[1] + vz * F[2];
    const iz = 1 / Math.max(1e-4, z);
    return {
      x: ox + f * (vx * R[0] + vy * R[1] + vz * R[2]) * iz,
      y: oy - f * (vx * U[0] + vy * U[1] + vz * U[2]) * iz,
      z,
      depth: (dot(p, u) - invD) / (1 - invD),
    };
  };

  const pin = (p: readonly number[]): Vec3 => {
    const k = dot(p, u);
    const t = norm([p[0] - k * u[0], p[1] - k * u[1], p[2] - k * u[2]]);
    return [invD * u[0] + rho * t[0], invD * u[1] + rho * t[1], invD * u[2] + rho * t[2]];
  };

  // Horizon circle basis: b towards north (as seen from below the camera), a across.
  const b = norm([-u[2] * u[0], -u[2] * u[1], 1 - u[2] * u[2]]);
  const a = cross(b, u);
  const at = (th: number): Vec3 => {
    const c = Math.cos(th),
      s = Math.sin(th);
    return [
      invD * u[0] + rho * (c * b[0] + s * a[0]),
      invD * u[1] + rho * (c * b[1] + s * a[1]),
      invD * u[2] + rho * (c * b[2] + s * a[2]),
    ];
  };
  const front = (q: Vec3) => (q[0] - C[0]) * F[0] + (q[1] - C[1]) * F[1] + (q[2] - C[2]) * F[2] > 0.03;
  const horizon = (samples = 540) => {
    // Walk from the north point both ways while the horizon is in front of the camera.
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    const step = (2 * Math.PI) / samples;
    for (let th = 0; th <= Math.PI; th += step) {
      const q = at(th);
      if (!front(q)) break;
      const s = project(q);
      right.push({ x: s.x, y: s.y });
    }
    for (let th = -step; th >= -Math.PI; th -= step) {
      const q = at(th);
      if (!front(q)) break;
      const s = project(q);
      left.push({ x: s.x, y: s.y });
    }
    const pts = [...left.reverse(), ...right];
    if (pts.length > 1 && pts[0].x > pts[pts.length - 1].x) pts.reverse();
    return pts;
  };

  return { params, u, project, pin, horizon, zRef: project(T).z };
}

/**
 * Fit the camera: the region's anchors fill `zone` (centred both ways), and the camera is
 * moved north or south (still looking at the region) until the top of the horizon sits `limbTop` px
 * from the top of the canvas.
 */
export function fitCamera(
  zone: { x: number; y: number; w: number; h: number },
  limbTop: number,
  {
    D = CAMERA_DISTANCE,
    lon = REGION_LON,
    anchors = REGION_ANCHORS,
    extra = [],
  }: { D?: number; lon?: number; anchors?: [number, number][]; extra?: Vec3[] } = {},
): CameraParams {
  // `extra`: points off the surface that must also fit (the tops of the request arcs).
  const vs: Vec3[] = [...anchors.map(toVec), ...extra];
  let best: CameraParams | null = null;
  let bestErr = Infinity;
  for (let lat = -70; lat <= 4; lat += 0.25) {
    const unit = makeCamera({ lon, lat, D, target: [lon, REGION_TARGET_LAT], f: 1, ox: 0, oy: 0 });
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      ok = true;
    for (const v of vs) {
      const p = unit.project(v);
      if (p.z <= 0 || (p.depth <= 0.02 && Math.hypot(v[0], v[1], v[2]) < 1.0001)) {
        ok = false;
        break;
      }
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (!ok) continue;
    const f = Math.min(zone.w / (maxX - minX), zone.h / (maxY - minY));
    const ox = zone.x + zone.w / 2 - (f * (minX + maxX)) / 2;
    const oy = zone.y + zone.h / 2 - (f * (minY + maxY)) / 2;
    const hz = unit.horizon(180);
    if (!hz.length) continue;
    let top = Infinity;
    for (const q of hz) top = Math.min(top, oy + f * q.y);
    const err = Math.abs(top - limbTop);
    if (err < bestErr) {
      bestErr = err;
      best = { lon, lat, D, target: [lon, REGION_TARGET_LAT], f, ox, oy };
    }
  }
  return (
    best ?? { lon, lat: -20, D, target: [lon, REGION_TARGET_LAT], f: zone.w, ox: zone.x + zone.w / 2, oy: zone.y }
  );
}
