import { meta } from "@/data/contract";

/**
 * Data caveats shown next to the numbers they qualify (not only in the "What's real here?" drawer).
 * Every figure is read from meta.json params so the text cannot drift from the pipeline.
 */
const p = meta.params;

function num(key: string, fallback: number): number {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

const offSeasonPts = num("backtestOffSeasonAdvantagePts", 0.2);
const all12Pts = num("backtestAll12OriginsAdvantagePts", 1.5);
const recoveredShare = num("misattributionRecoveredByMatcherShare", 0.608);
const misattributedSgd = num("misattributionSgd12m", 1_057_625);

export const RECOVERED_PCT = Math.round(recoveredShare * 100);
export const MISATTRIBUTED_LABEL = `S$${(misattributedSgd / 1_000_000).toFixed(2)}M`;

/** Lead caveat 2: the forecast gain is seasonal. */
export const SEASON_CAVEAT = `Scored on Apr–Sep 2026, the dengue-season rise, where today's method lags most. Off-season the two methods are about level (+${offSeasonPts.toFixed(1)} points); over 12 forecast dates ours is +${all12Pts.toFixed(1)} points better.`;

/** Short form for tiles. */
export const SEASON_CAVEAT_SHORT = `Scored Apr–Sep 2026, the dengue rise. Off-season the two are about level (+${offSeasonPts.toFixed(1)}); over all 12 forecast dates +${all12Pts.toFixed(1)}.`;

/** Lead caveat 1: the merged view uses the confirmed golden-ID crosswalk. */
export const MATCHER_CAVEAT = `In a pilot, merged customers = the duplicate finder's suggestions, confirmed by the MDM team. On its own the finder recovers about ${RECOVERED_PCT}% of the ${MISATTRIBUTED_LABEL} booked to the wrong country: all of Malaysia's, but not the Vietnamese hospital booked in Singapore. It also misses one Thai duplicate pair.`;
