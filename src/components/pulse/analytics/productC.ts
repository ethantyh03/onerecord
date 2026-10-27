import { matrix, matrixCell, streams } from "@/data/contract";
import type { CountryCode } from "@/lib/types";

export interface ProductCPlan {
  country: CountryCode;
  /** Open PR/tender pipeline for the whole country (all products), S$ */
  pipelineAllSgd: number;
  /** Product C share of the country's 12M PO value (merged view), used to apportion the pipeline */
  cShare: number;
  /** Open pipeline attributed to Product C, S$ */
  pipelineCSgd: number;
  /** Historical PR → PO conversion for the country */
  conversion: number;
  /** Pipeline-weighted expectation for the next quarter, S$ */
  expectedSgd: number;
}

/**
 * Product C is planned from the tender/PR pipeline, not a time-series model:
 * expected = open pipeline attributed to C × historical PR→PO conversion for the country.
 * The pipeline in streams.json is per country, so C's part is apportioned by C's share of 12M orders (illustrative).
 */
export function productCPlan(country: CountryCode): ProductCPlan | null {
  const s = streams.countries.find((c) => c.country === country);
  const cell = matrixCell("dedup", country, "C");
  const total = matrix.views.dedup.countryTotals.find((t) => t.key === country);
  if (!s || !cell || !total || total.sgd12m <= 0) return null;
  const cShare = cell.sgd12m / total.sgd12m;
  const pipelineCSgd = s.prPipelineOpenSgd * cShare;
  return {
    country,
    pipelineAllSgd: s.prPipelineOpenSgd,
    cShare,
    pipelineCSgd,
    conversion: s.prToPoConversion,
    expectedSgd: pipelineCSgd * s.prToPoConversion,
  };
}
