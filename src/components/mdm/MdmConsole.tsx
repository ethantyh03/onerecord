"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSandbox } from "@/lib/store";
import { selectMdmQueue, useCurrentPerson, usePipelineStats } from "@/lib/selectors";
import { formatDays, PageHeader, Readout, ReadoutStrip, ReadoutUnit } from "@/components/common";
import { isMdmUser } from "./mdm-helpers";
import { MdmDetail } from "./MdmDetail";
import { MdmQueue } from "./MdmQueue";
import { ViewerNotice } from "./Panel";
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
        <ViewerNotice className="-mt-6 mb-6 border-t-0" action={<SwitchToMdmButton />}>
          You&apos;re viewing as <strong className="font-semibold text-foreground">{me.name}</strong> ({me.title}). This console belongs to
          the MDM team: you can look, but only MDM can import records into SAP B1.
        </ViewerNotice>
      ) : null}

      {/* The Gotham meta-column readouts: the money waiting leads, wider; the other two are plain figures. */}
      <ReadoutStrip className="mb-9">
        <StuckDemandTile />
        <Readout
          label="Ready for final check"
          value={queueCount}
          caption="Fully approved by the business; MDM checks and imports them."
        />
        <Readout
          label="Median time to SAP B1"
          value={
            <>
              {formatDays(stats.medianDaysToCreate)}
              <ReadoutUnit>business days</ReadoutUnit>
            </>
          }
          caption={`Submission to created, across ${createdCount} records. Target ≤ 4 business days.`}
        />
      </ReadoutStrip>

      <MdmQueue mine={mdm} />
    </div>
  );
}
