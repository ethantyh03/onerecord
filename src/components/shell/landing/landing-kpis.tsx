"use client";

import { useSandbox } from "@/lib/store";
import { selectStuckDemand } from "@/lib/selectors";
import { LiveMark, ProportionBar, Readout, ReadoutStrip } from "@/components/common/readout";
import { SyntheticBadge } from "@/components/common/badges";
import { formatSgd } from "@/components/common/format";
import { headline } from "@/data/contract";

/** Measured on the synthetic data (summary.json → headlines.duplicates), e.g. 25 of 388. */
const DUP = headline("duplicates");
const DUP_PCT = DUP?.baseline ? `${((DUP.value / DUP.baseline) * 100).toFixed(1)}%` : "6.4%";
const DUP_OF = DUP?.baseline ? `${DUP.value} of ${DUP.baseline}` : "25 of 388";

/**
 * The three headline numbers under the hero, as one ruled readout strip (Gotham meta-column idiom):
 * no boxes, no rails, state carried by the figure's colour. Stuck demand is the lead figure.
 */
export function LandingKpis() {
  const stuckSgd = useSandbox((s) => selectStuckDemand(s).totalSgd);
  const stuckCount = useSandbox((s) => selectStuckDemand(s).count);
  const countries = useSandbox(
    (s) => Object.values(selectStuckDemand(s).byCountry ?? {}).filter((c) => c && c.count > 0).length,
  );

  return (
    <ReadoutStrip as="section" aria-label="Headline numbers" footnote={<SyntheticBadge />}>
      <Readout
        label="Median time to set up a new record"
        value={
          // Units at normal width; "→ ≤ 4 business days" holds together, so the arrow never starts a line.
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="whitespace-nowrap text-muted-foreground line-through decoration-[2px] decoration-muted-foreground/50">
              14<span className="text-base font-medium [font-stretch:100%]"> days</span>
            </span>
            <span className="whitespace-nowrap">
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
              <span className="sr-only">down to</span> ≤ 4
              <span className="text-base font-medium text-secondary-foreground [font-stretch:100%]"> business days</span>
            </span>
          </span>
        }
        caption="Median 14 days (Amy's took 18) → ≤ 4 business days. Amy's item is from the brief (Appendix C)."
        footnote="Baseline median: assumption A26. Target is our KPI."
      />
      <Readout
        lead
        size="lg"
        tone="stuck"
        label="Stuck demand right now"
        href="/pulse"
        marker={<LiveMark />}
        value={formatSgd(stuckSgd)}
        caption={
          stuckCount > 0
            ? `${stuckCount} customer purchase request${stuckCount === 1 ? "" : "s"} in ${countries} ${
                countries === 1 ? "country" : "countries"
              } can't become orders until a customer or item is set up.`
            : "No customer purchase requests are waiting on a master record."
        }
      />
      <Readout
        label="New customer records that were duplicates"
        value={DUP_PCT}
        caption={
          <>
            {`${DUP_OF} customer records are copies of a customer that already existed, re-created under another spelling or country code.`}
            {DUP?.baseline ? <ProportionBar part={DUP.value} whole={DUP.baseline} tone="stuck" /> : null}
          </>
        }
        footnote="Measured. Assumption A13 had ≈6%."
      />
    </ReadoutStrip>
  );
}
