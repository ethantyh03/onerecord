"use client";

import { useMemo } from "react";
import { useHasHydrated, useSandbox } from "@/lib/store";
import { selectStuckDemand, usePipelineStats } from "@/lib/selectors";
import { LiveMark, ProportionBar, Readout, ReadoutStrip, ReadoutUnit } from "@/components/common/readout";
import { formatDays, formatSgd } from "@/components/common/format";
import { headline } from "@/data/contract";

/** Measured on the customer master (summary.json → headlines.duplicates), e.g. 25 of 388. */
const DUP = headline("duplicates");
const DUP_PCT = DUP?.baseline ? `${((DUP.value / DUP.baseline) * 100).toFixed(1)}%` : "6.4%";
const DUP_OF = DUP?.baseline ? `${DUP.value} of ${DUP.baseline}` : "25 of 388";

/**
 * The three numbers under the open-request queue, as one ruled readout strip (Gotham meta-column idiom):
 * no boxes, no rails, state carried by the figure's colour. Orders waiting on master data lead. The live
 * figures read the sandbox (the same selectors as Requests and the MDM console) once it has loaded, so the
 * server render and the first client render agree.
 */
export function LandingKpis() {
  const hydrated = useHasHydrated();
  const stuckSgd = useSandbox((s) => selectStuckDemand(s).totalSgd);
  const stuckCount = useSandbox((s) => selectStuckDemand(s).count);
  const countries = useSandbox(
    (s) => Object.values(selectStuckDemand(s).byCountry ?? {}).filter((c) => c && c.count > 0).length,
  );
  const requests = useSandbox((s) => s.requests);
  const createdCount = useMemo(() => requests.filter((r) => r.status === "created").length, [requests]);
  const stats = usePipelineStats();

  return (
    <ReadoutStrip as="section" aria-label="Key metrics">
      <Readout
        lead
        size="lg"
        tone="stuck"
        label="Orders waiting on master data"
        href="/pulse"
        marker={<LiveMark />}
        value={hydrated ? formatSgd(stuckSgd) : "—"}
        caption={
          !hydrated
            ? " "
            : stuckCount > 0
              ? `${stuckCount} customer purchase request${stuckCount === 1 ? "" : "s"} in ${countries} ${
                  countries === 1 ? "country" : "countries"
                } can't become orders until a customer or item is set up.`
              : "No customer purchase requests are waiting on a master record."
        }
      />
      <Readout
        label="Median time to SAP B1"
        value={
          hydrated ? (
            // One span so the unit sits just after the figure, not a flex gap away.
            <span>
              {formatDays(stats.medianDaysToCreate)}
              <ReadoutUnit>business days</ReadoutUnit>
            </span>
          ) : (
            "—"
          )
        }
        caption={
          hydrated
            ? `Submission to live in SAP B1, across ${createdCount} created record${createdCount === 1 ? "" : "s"}. Target ≤ 4 business days.`
            : " "
        }
      />
      <Readout
        label="Duplicate customer records"
        value={DUP_PCT}
        caption={
          <>
            {`${DUP_OF} customer records duplicate a customer already in SAP B1, under another spelling or country code.`}
            {DUP?.baseline ? <ProportionBar part={DUP.value} whole={DUP.baseline} tone="stuck" /> : null}
          </>
        }
      />
    </ReadoutStrip>
  );
}
