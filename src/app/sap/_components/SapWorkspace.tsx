"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Database, FileInput, Info, Network } from "lucide-react";
import { PageHeader } from "@/components/common";
import { useSandbox } from "@/lib/store";
import { DtwWizard } from "./DtwWizard";
import { MasterDataView } from "./MasterDataView";
import { ServiceLayerView } from "./ServiceLayerView";
import { SapTabs, SapToolButton, SapWindow } from "./sap-ui";

type Tab = "dtw" | "master" | "sl";

const TABS: { id: Tab; label: string; window: string }[] = [
  { id: "dtw", label: "Data Transfer Workbench", window: "Data Transfer Workbench · Import Business Object" },
  { id: "master", label: "Master Data", window: "Business Partner / Item Master Data" },
  { id: "sl", label: "Service Layer (Phase 2)", window: "Service Layer API · /b1s/v2" },
];

function isTab(v: string | null): v is Tab {
  return v === "dtw" || v === "master" || v === "sl";
}

export function SapWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestParam = params.get("request") ?? undefined;
  const codeParam = params.get("code");
  const tabParam = params.get("tab");

  const [tab, setTab] = useState<Tab>(isTab(tabParam) ? tabParam : codeParam ? "master" : "dtw");
  const [code, setCode] = useState<string | null>(codeParam);
  const [slRequest, setSlRequest] = useState<string | undefined>(requestParam);
  const recordCount = useSandbox((s) => s.sapRecords.length);
  const companyCountry = useSandbox((s) => s.config.people.find((p) => p.id === s.personaId)?.country ?? "SG");

  // Keep the URL shareable (?tab=…&request=…&code=…) without adding history entries.
  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    if (tab !== "dtw") next.set("tab", tab);
    else next.delete("tab");
    if (tab === "sl" && slRequest) next.set("request", slRequest);
    if (tab === "master" && code) next.set("code", code);
    else next.delete("code");
    const qs = next.toString();
    if (qs !== params.toString()) router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tab, code, slRequest, pathname, router, params]);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  function openRecord(next: string) {
    setCode(next);
    setTab("master");
  }

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        title="SAP Business One — simulated sandbox"
        subtitle="What the MDM team does after the final check: load the ready-made import files (SAP’s Data Transfer Workbench), open the new record, and preview Phase 2, where the record posts itself to SAP."
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e0b252] bg-[#fff6dc] px-2.5 py-0.5 text-[11.5px] font-medium text-[#5c4300]">
            <Info className="size-3.5" aria-hidden="true" />
            Simulated for the prototype — production uses DTW import (Phase 1) and the Service Layer API (Phase 2)
          </span>
        }
      />

      <SapWindow
        title={`SAP Business One · LIVES_SANDBOX · ${active.window}`}
        toolbar={
          <>
            <SapToolButton label="Data Transfer Workbench" onClick={() => setTab("dtw")} aria-pressed={tab === "dtw"} className={tab === "dtw" ? "border-[#a9b7c5] bg-white" : undefined}>
              <FileInput className="size-4 text-[#3c5a78]" aria-hidden="true" />
              <span className="hidden sm:inline">DTW</span>
            </SapToolButton>
            <SapToolButton label="Master Data" onClick={() => setTab("master")} aria-pressed={tab === "master"} className={tab === "master" ? "border-[#a9b7c5] bg-white" : undefined}>
              <Database className="size-4 text-[#3c5a78]" aria-hidden="true" />
              <span className="hidden sm:inline">Master Data</span>
            </SapToolButton>
            <SapToolButton label="Service Layer" onClick={() => setTab("sl")} aria-pressed={tab === "sl"} className={tab === "sl" ? "border-[#a9b7c5] bg-white" : undefined}>
              <Network className="size-4 text-[#3c5a78]" aria-hidden="true" />
              <span className="hidden sm:inline">Service Layer</span>
            </SapToolButton>
          </>
        }
        status={
          <>
            <span>Company: LIVES_SANDBOX (simulated)</span>
            <span className="text-[#8fa1b3]">|</span>
            <span>Branch: {companyCountry}</span>
            <span className="text-[#8fa1b3]">|</span>
            <span>{recordCount} record(s) in sandbox</span>
            <span className="ml-auto hidden sm:inline">Version 10.0 FP 2602 (assumed)</span>
          </>
        }
      >
        <SapTabs ariaLabel="SAP sandbox views" className="bg-[#e4eaf0] pt-2" value={tab} onChange={setTab} tabs={TABS} />
        {/* All views stay mounted so an in-progress import survives a look at Master Data. */}
        <div className="bg-[#f6f8fa]">
          <div hidden={tab !== "dtw"}>
            <DtwWizard initialRequestId={requestParam} onOpenRecord={openRecord} />
          </div>
          <div hidden={tab !== "master"}>
            <MasterDataView selectedCode={code} onSelect={setCode} />
          </div>
          <div hidden={tab !== "sl"}>
            <ServiceLayerView requestId={slRequest} onSelectRequest={setSlRequest} />
          </div>
        </div>
      </SapWindow>
    </div>
  );
}
