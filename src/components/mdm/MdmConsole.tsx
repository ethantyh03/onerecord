"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, ShieldCheck } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { selectMdmQueue, useCurrentPerson, usePipelineStats } from "@/lib/selectors";
import { formatDays, KpiTile, PageHeader } from "@/components/common";
import { isMdmUser } from "./mdm-helpers";
import { MdmDetail } from "./MdmDetail";
import { MdmQueue } from "./MdmQueue";
import { StuckDemandTile } from "./StuckDemandTile";
import { SwitchToMdmButton } from "./SwitchToMdmButton";

/** /mdm (queue) and /mdm?id=REQ-… (detail). Must render inside <Suspense> because it reads the search params. */
export function MdmConsole() {
  const params = useSearchParams();
  const id = params.get("id")?.trim().toUpperCase();
  if (id) return <MdmDetail key={id} id={id} />;
  return <MdmHome />;
}

function MdmHome() {
  const me = useCurrentPerson();
  const requests = useSandbox((s) => s.requests);
  const queueCount = useMemo(() => selectMdmQueue({ requests }).length, [requests]);
  const createdCount = useMemo(() => requests.filter((r) => r.status === "created").length, [requests]);
  const stats = usePipelineStats();
  const mdm = isMdmUser(me);

  return (
    <div>
      <PageHeader
        title="MDM console"
        subtitle="Final check before anything reaches SAP Business One: re-run the duplicate check, review every field against SAP's limits, then import with the Data Transfer Workbench."
      />

      {!mdm ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warn/50 bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          <ShieldCheck aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            You&apos;re viewing as <strong className="font-semibold">{me.name}</strong> ({me.title}). This console belongs to the MDM
            team: you can look, but only MDM can import records into SAP B1.
          </span>
          <SwitchToMdmButton />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <StuckDemandTile />
        <KpiTile
          tone="brand"
          icon={ShieldCheck}
          label={mdm ? "Waiting for your final check" : "Waiting for MDM's final check"}
          value={queueCount}
          caption="Fully approved by the business; MDM checks and imports them."
        />
        <KpiTile
          icon={Clock}
          label="Median time to SAP B1"
          value={
            <>
              {formatDays(stats.medianDaysToCreate)}
              <span className="ml-1.5 text-base font-medium text-muted-foreground">business days</span>
            </>
          }
          caption={`Submission to created, across ${createdCount} records. Target ≤ 4 business days.`}
        />
      </div>

      <MdmQueue mine={mdm} />
    </div>
  );
}
