"use client";

import { CopyX, Hourglass, Timer } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { selectStuckDemand } from "@/lib/selectors";
import { KpiTile } from "@/components/common/kpi-tile";
import { SyntheticBadge } from "@/components/common/badges";
import { formatSgd } from "@/components/common/format";
import { headline } from "@/data/contract";

/** Measured on the synthetic data (summary.json → headlines.duplicates), e.g. 25 of 388. */
const DUP = headline("duplicates");
const DUP_PCT = DUP?.baseline ? `${((DUP.value / DUP.baseline) * 100).toFixed(1)}%` : "6.4%";
const DUP_OF = DUP?.baseline ? `${DUP.value} of ${DUP.baseline}` : "25 of 388";

function LiveDot() {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-stuck/30 bg-stuck-soft px-2 text-[0.6875rem] font-medium text-stuck-ink">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-stuck opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-stuck" />
      </span>
      Live
    </span>
  );
}

export function LandingKpis() {
  const stuckSgd = useSandbox((s) => selectStuckDemand(s).totalSgd);
  const stuckCount = useSandbox((s) => selectStuckDemand(s).count);
  const countries = useSandbox(
    (s) => Object.values(selectStuckDemand(s).byCountry ?? {}).filter((c) => c && c.count > 0).length,
  );

  return (
    <section aria-label="Headline numbers" className="grid gap-4 md:grid-cols-3">
      <KpiTile
        icon={Timer}
        tone="brand"
        label="Median time to set up a new record"
        value={
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-muted-foreground line-through decoration-[2px] decoration-muted-foreground/50">
              14 days
            </span>
            <span aria-hidden className="text-muted-foreground">→</span>
            <span className="sr-only">down to</span>
            <span>≤ 4</span>
            <span className="text-lg font-medium tracking-[-0.01em] text-secondary-foreground">business days</span>
          </span>
        }
        caption="Median 14 days (Amy's took 18) → ≤ 4 business days. Amy's item is from the brief (Appendix C)."
        footnote="Baseline median: assumption A26. Target is our KPI."
      />
      <KpiTile
        icon={Hourglass}
        tone="stuck"
        label="Stuck demand right now"
        href="/pulse"
        badge={<LiveDot />}
        value={formatSgd(stuckSgd)}
        caption={
          stuckCount > 0
            ? `${stuckCount} customer purchase request${stuckCount === 1 ? "" : "s"} in ${countries} ${
                countries === 1 ? "country" : "countries"
              } can't become orders until a customer or item is set up.`
            : "No customer purchase requests are waiting on a master record."
        }
        footnote={<SyntheticBadge />}
      />
      <KpiTile
        icon={CopyX}
        label="New customer records that were duplicates"
        value={DUP_PCT}
        caption={`${DUP_OF} customer records are copies of a customer that already existed, re-created under another spelling or country code.`}
        footnote={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <SyntheticBadge />
            <span>Measured. Assumption A13 had ≈6%.</span>
          </span>
        }
      />
    </section>
  );
}
