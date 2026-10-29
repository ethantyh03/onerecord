/**
 * Every data-driven figure on the finals deck, read from the submitted data files (never typed in by hand).
 * Prose figures on the slides are copied from docs/superpowers/deck-content.md, whose numbers ledger maps each
 * one to its source file and key. If a figure is not in that ledger, it does not go on a slide.
 */
import bridge from "@/data/bridge.json";
import dedup from "@/data/dedup.json";
import impact from "@/data/impact.json";
import master from "@/data/master.json";
import matrix from "@/data/matrix.json";

// ---------------------------------------------------------------- formatting

const MINUS = "−";

export function pct(v: number, digits = 0): string {
  const s = Math.abs(v * 100).toFixed(digits);
  return `${v < 0 ? MINUS : "+"}${s}%`;
}

export function sgdMillions(v: number, digits = 2): string {
  return `S$${(v / 1_000_000).toFixed(digits)}M`;
}

export function sgdThousands(v: number, digits = 1): string {
  return `S$${(v / 1000).toFixed(digits)}k`;
}

export function grouped(v: number): string {
  return Math.round(v).toLocaleString("en-SG");
}

// ---------------------------------------------------------------- duplicates: Bukit Damai (s03, s04)

type RawAccount = (typeof bridge.countries)[number]["topAccounts"]["raw"][number];
type DedupAccount = (typeof bridge.countries)[number]["topAccounts"]["dedup"][number];

const my = bridge.countries.find((c) => c.country === "MY");
if (!my) throw new Error("bridge.json has no MY country");

const heroDedupIndex = my.topAccounts.dedup.findIndex((a: DedupAccount) => "hero" in a && a.hero);
const heroDedup = my.topAccounts.dedup[heroDedupIndex];

export interface RawRecordRow {
  cardCode: string;
  name: string;
  entity: string;
  rank: number;
  yoy: number | null;
  status: string;
}

const entityOf = new Map(master.customers.map((c) => [c.cardCode, c.entity]));

/** The hero's raw SAP records, in Malaysia rank order (#7, #10, #11). */
export const BUKIT_RAW: RawRecordRow[] = my.topAccounts.raw
  .map((a: RawAccount, i: number) => ({ a, rank: i + 1 }))
  .filter(({ a }) => a.goldenId === heroDedup.goldenId)
  .map(({ a, rank }) => ({
    cardCode: a.cardCode,
    name: a.name,
    entity: entityOf.get(a.cardCode) ?? "",
    rank,
    yoy: a.yoy,
    status: a.status,
  }));

export const BUKIT_MERGED = {
  goldenId: heroDedup.goldenId,
  name: heroDedup.name,
  rank: heroDedupIndex + 1,
  records: heroDedup.records,
  sgd12m: heroDedup.sgd12m,
  sgdPrior12m: heroDedup.sgdPrior12m,
  yoy: heroDedup.yoy,
  entities: Array.from(new Set(BUKIT_RAW.map((r) => r.entity))).sort((a, b) => (a === "SPD" ? -1 : b === "SPD" ? 1 : a.localeCompare(b))),
  codes: BUKIT_RAW.map((r) => r.cardCode).sort(),
};

// ---------------------------------------------------------------- duplicates: the 388 -> 363 dot field (s04)

export const DEDUP_COUNTS = dedup.customers; // rawRecords 388, goldenCustomers 363, duplicateRecords 25, duplicateRate 0.0644

export interface Dot {
  code: string;
  /** Position in raw SAP order (sorted by card code). */
  from: number;
  /** Position after merging (survivors only); for a duplicate, its survivor's merged position. */
  to: number;
  /** For a duplicate: the raw position of the record it merges into. */
  into: number | null;
  /** A surviving record that absorbs at least one duplicate. */
  absorbs: boolean;
  hero: boolean;
}

function buildDots(): Dot[] {
  const sorted = [...master.customers].sort((a, b) => a.cardCode.localeCompare(b.cardCode));
  const survivorOf = new Map<string, number>(); // goldenId -> raw index of the first record
  const sizes = new Map<string, number>();
  sorted.forEach((c, i) => {
    if (!survivorOf.has(c.goldenId)) survivorOf.set(c.goldenId, i);
    sizes.set(c.goldenId, (sizes.get(c.goldenId) ?? 0) + 1);
  });
  const mergedIndex = new Map<number, number>();
  let j = 0;
  sorted.forEach((c, i) => {
    if (survivorOf.get(c.goldenId) === i) mergedIndex.set(i, j++);
  });
  return sorted.map((c, i) => {
    const s = survivorOf.get(c.goldenId)!;
    const isSurvivor = s === i;
    return {
      code: c.cardCode,
      from: i,
      to: mergedIndex.get(s)!,
      into: isSurvivor ? null : s,
      absorbs: isSurvivor && (sizes.get(c.goldenId) ?? 1) > 1,
      hero: isSurvivor && c.goldenId === BUKIT_MERGED.goldenId,
    };
  });
}

export const DOTS: Dot[] = buildDots();

// ---------------------------------------------------------------- regional view (s09)

export const GROUP = {
  sgd12m: matrix.views.dedup.group.sgd12m,
  yoy: matrix.views.dedup.group.yoy,
  momentum: matrix.views.dedup.group.momentum,
};

// ---------------------------------------------------------------- business case (s11)

export interface CaseRow {
  requests: number;
  base: boolean;
  hours: string;
  net: string;
  payback: string;
  threeYear: string;
}

export const CASE_ROWS: CaseRow[] = impact.hardBenefit.rows.map((r) => {
  const p = impact.payback.rows.find((x) => x.requestsPerMonth === r.requestsPerMonth);
  if (!p) throw new Error(`impact.json has no payback row for ${r.requestsPerMonth}`);
  return {
    requests: r.requestsPerMonth,
    base: r.isBase,
    hours: grouped(r.hoursPerYear.value),
    net: sgdThousands(r.netSgdPerYear.value),
    payback: `${p.paybackMonths.value.toFixed(1)} months`,
    threeYear: `S$${Math.round(p.threeYearNetSgd.value / 1000)}k`,
  };
});

export const PHASE1 = impact.costs.phase1;
export const PHASE2 = impact.costs.phase2;
export const PROCESS_SHARE = impact.waterfall.totals.processShare.value; // 0.429
export const HOURS_PER_YEAR = impact.headline.hoursPerYear.value; // 1751

/** Amy's 18 days, as our reading of App C splits them (s02). */
export const AMY_SLICES = impact.waterfall.slices.map((s) => ({ id: s.id, days: s.beforeDays.value }));
