/**
 * Display pseudonyms for real organisation names (final model §3.6 / §7.2: every customer except NUH is fictional,
 * and no real hospital name is shown next to sales).
 *
 * The sources are now clean: analytics/params.yaml, analytics/streams.py, the triage sets, src/lib/seed.ts and the
 * generated src/data/*.json all use fictional names at the source (pre-publication pass, 28 Oct 2026), so these
 * replacements match nothing and do nothing. src/data/contract.ts still runs every generated JSON file through
 * `pseudonymise` as a defensive layer, in case a future edit or regeneration reintroduces one of these names.
 *
 * Order matters: the most specific strings come first.
 */
export const PSEUDONYMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Sunway Medical Cent(?:re|er)/g, "Sungai Permai Medical Centre"],
  [/Penang General Hospital/g, "Pulau Mutiara General Hospital"],
  [/Hospital Pulau Pinang/g, "Hospital Besar Pulau Mutiara"],
  [/sunwaymedicalcentr/g, "sungaipermaimedic"],
  [/penanggeneralhospi/g, "pulaumutiarageneral"],
  [/Jalan Sunway/g, "Jalan Sungai Permai"],
  [/Jalan Penang/g, "Jalan Mutiara"],
  [/Penang General/g, "Pulau Mutiara General"],
  [/\bSunway\b/g, "Sungai Permai"],
  [/\bSiriraj\b/g, "Chao Phraya Central"],
];

export function pseudonymiseText(s: string): string {
  let out = s;
  for (const [re, to] of PSEUDONYMS) out = out.replace(re, to);
  return out;
}

/** Deep copy of a JSON value with every string pseudonymised (keys untouched). */
export function pseudonymise<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return pseudonymiseText(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = walk(x);
      return o;
    }
    return v;
  };
  return walk(value) as T;
}
