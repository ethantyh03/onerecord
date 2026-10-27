"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FileX2,
  Info,
  MonitorCog,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { DtwFile } from "@/lib/types";
import { dtwOptionsFor, useSandbox } from "@/lib/store";
import {
  actorName,
  buById,
  domainById,
  selectDtwPreview,
  selectPrsForRequest,
  selectProposedSapCode,
  useCurrentPerson,
  useNow,
  type SandboxView,
} from "@/lib/selectors";
import { canSeeSensitive } from "@/lib/engine/masking";
import { dtwImportMode, toServiceLayerPayload } from "@/lib/engine/dtw";
import { businessDaysBetween } from "@/lib/engine/sla";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import {
  EmptyState,
  firstName,
  formatDays,
  formatSgd,
  formatSgtDateTime,
  PersonChip,
  SapCode,
  StatusBadge,
} from "@/components/common";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApprovalHistory } from "./ApprovalHistory";
import { DtwPreview } from "./DtwPreview";
import { DuplicateRecheck } from "./DuplicateRecheck";
import { FieldReview } from "./FieldReview";
import { approvedAt, buildFieldReview, isMdmUser, sensitiveProperties } from "./mdm-helpers";
import { EntityCell, Panel } from "./Panel";
import { ServiceLayerPanel } from "./ServiceLayerPanel";
import { StuckDemandTile } from "./StuckDemandTile";
import { SwitchToMdmButton } from "./SwitchToMdmButton";

type Tab = "dtw" | "sl";

function SimulatedTag() {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-border-strong/70 bg-card px-2 text-[0.6875rem] font-medium whitespace-nowrap text-muted-foreground">
      Simulated
    </span>
  );
}

/** One step of the hand-off sequence: generate → load in SAP B1 → mark created. */
function HandoffStep({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border bg-background/60 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "num inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            done ? "bg-ok text-ok-foreground" : "bg-primary-soft text-accent-foreground",
          )}
        >
          {done ? <CheckCircle2 aria-hidden className="size-3.5" /> : n}
        </span>
        <span className="text-[0.8125rem] font-semibold text-foreground">{title}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 text-xs text-muted-foreground">{children}</div>
    </li>
  );
}

/** /mdm?id=REQ-…: duplicate re-check, field review, approval history + audit, and the SAP B1 hand-off. */
export function MdmDetail({ id }: { id: string }) {
  const requests = useSandbox((s) => s.requests);
  const config = useSandbox((s) => s.config);
  const sapRecords = useSandbox((s) => s.sapRecords);
  const reservedCodes = useSandbox((s) => s.reservedCodes);
  const prs = useSandbox((s) => s.prs);
  const me = useCurrentPerson();
  const now = useNow(15_000);
  const [tab, setTab] = useState<Tab>("dtw");
  const [busy, setBusy] = useState(false);
  const handoffRef = useRef<HTMLDivElement>(null);

  const req = requests.find((r) => r.id === id);
  const domain = req ? domainById({ config }, req.domainId) : undefined;
  const view = useMemo(
    () => ({ requests, config, sapRecords, reservedCodes }) as unknown as SandboxView,
    [requests, config, sapRecords, reservedCodes],
  );
  const code = useMemo(() => (req ? selectProposedSapCode(view, req.id) : undefined), [view, req]);
  const files: DtwFile[] = useMemo(() => (req ? selectDtwPreview(view, req.id) : []), [view, req]);
  const payload = useMemo(
    () => (req && domain && code ? toServiceLayerPayload(req, domain, code, dtwOptionsFor({ sapRecords }, req, domain, code)) : null),
    [req, domain, code, sapRecords],
  );
  const rows = useMemo(() => (req && domain ? buildFieldReview(req, domain, files, code) : []), [req, domain, files, code]);
  const sensitive = useMemo(() => (domain ? sensitiveProperties(domain) : new Set<string>()), [domain]);
  const linked = useMemo(() => (req ? selectPrsForRequest({ prs, requests }, req.id) : []), [prs, requests, req]);

  if (!req || !domain) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          icon={FileX2}
          title={`${id} isn't in this sandbox`}
          description="It may have been raised before the demo was reset. Pick a request from the MDM queue."
          action={
            <Link href="/mdm" className={buttonVariants({ variant: "outline" })}>
              Open the MDM queue
            </Link>
          }
        />
      </div>
    );
  }

  const isExtend = domain.id === "extend";
  const canSee = canSeeSensitive(me);
  const mdm = isMdmUser(me);
  const atReview = req.status === "mdm_review";
  const created = req.status === "created";
  const generated = created || !!req.dtwGeneratedAt;
  const blocked = linked.filter((p) => p.status === "blocked");
  const blockedSgd = blocked.reduce((a, p) => a + p.sgd, 0);
  const releasedSgd = created ? linked.reduce((a, p) => a + p.sgd, 0) : 0;
  const approved = approvedAt(req);
  const waiting = approved && atReview ? businessDaysBetween(approved, now) : 0;
  const requestor = firstName(actorName({ config }, req.requestorId));
  const createVerb = isExtend ? "updated" : "created";

  function notMdm(action: string) {
    toast.error(`Only the MDM team can ${action}`, {
      description: `${me.name} isn't on the MDM team. Switch persona to Priya Nair (MDM).`,
    });
  }

  function onGenerate() {
    if (generated) {
      setTab("dtw");
      requestAnimationFrame(() => handoffRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    if (!mdm) return notMdm("generate SAP B1 import files");
    if (!atReview && !created) {
      toast.error("Not ready for SAP B1 yet", { description: `${req!.id} still needs its business approvals.` });
      return;
    }
    const out = useSandbox.getState().generateDtw(req!.id);
    if (out.length === 0) {
      toast.error("No import generated", { description: `${req!.id} can't be exported in its current state.` });
      return;
    }
    setTab("dtw");
    toast.success(`SAP B1 import generated for ${code}`, {
      description: `${out.map((f) => f.fileName).join(" + ")} · code ${code} reserved for ${req!.id}`,
    });
    requestAnimationFrame(() => handoffRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function onMarkCreated() {
    if (!mdm) return notMdm(`mark records ${createVerb} in SAP B1`);
    if (busy) return;
    setBusy(true);
    try {
      const before = useSandbox.getState();
      const beforeSgd = selectPrsForRequest(before, req!.id)
        .filter((p) => p.status === "blocked")
        .reduce((a, p) => a + p.sgd, 0);
      const res = before.markCreatedInSap(req!.id);
      if (!res.ok) {
        toast.error(`Can't mark ${req!.id} ${createVerb} in SAP B1`, { description: res.reason });
        return;
      }
      const after = useSandbox.getState();
      const lu = after.lastUnblock;
      const released = lu && lu.requestId === req!.id ? lu.beforeSgd - lu.afterSgd : beforeSgd;
      const sapCode = res.record?.code ?? after.requests.find((r) => r.id === req!.id)?.sapCode ?? code;
      toast.success(
        `${sapCode} ${createVerb} · ${requestor} notified${released > 0 ? ` · ${formatSgd(released)} of customer orders unblocked` : ""}`,
        {
          description:
            released > 0
              ? "The stuck-demand total drops by exactly the orders that were waiting on this record."
              : "Teams and Outlook notifications (simulated) sent to the requestor.",
        },
      );
    } finally {
      setBusy(false);
    }
  }

  const sapHref = created && req.sapCode ? `/sap?tab=master&code=${encodeURIComponent(req.sapCode)}` : `/sap?request=${req.id}`;

  return (
    <div className="space-y-5">
      <BackLink />

      {/* Request summary + live stuck demand */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-xl border bg-card px-5 py-4 shadow-raised">
          <div className="flex flex-wrap items-center gap-2">
            <SapCode code={req.id} />
            <StatusBadge status={req.status} />
            <span className="text-[0.8125rem] text-muted-foreground">{domain.label}</span>
          </div>
          <h1 className="mt-2 text-[1.5rem] leading-tight font-semibold tracking-[-0.02em] text-foreground">{req.title}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Requested by</dt>
              <dd className="mt-1">
                <PersonChip personId={req.requestorId} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Entity / country</dt>
              <dd className="mt-1">
                <EntityCell entity={req.entity} country={req.country} configured={!!buById({ config }, req.entity)} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{created ? "Created in SAP B1" : "Approved at"}</dt>
              <dd className="num mt-1 text-[0.8125rem] font-medium text-foreground">
                {created && req.sapCreatedAt ? formatSgtDateTime(req.sapCreatedAt) : approved ? formatSgtDateTime(approved) : "—"}
                {atReview ? <span className="block text-xs font-normal text-muted-foreground">{formatDays(waiting)} business days waiting</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{created ? "Orders released" : "Customer orders waiting"}</dt>
              <dd className="num mt-1">
                {created ? (
                  <span className={cn("text-base font-semibold", releasedSgd > 0 ? "text-ok-ink" : "text-muted-foreground")}>
                    {releasedSgd > 0 ? formatSgd(releasedSgd) : "—"}
                  </span>
                ) : (
                  <span className={cn("text-base font-semibold", blockedSgd > 0 ? "text-stuck" : "text-muted-foreground")}>
                    {blockedSgd > 0 ? formatSgd(blockedSgd) : "—"}
                  </span>
                )}
                {linked.length ? (
                  <>
                    <span className="block text-xs text-muted-foreground">
                      {linked.length} order{linked.length === 1 ? "" : "s"}
                    </span>
                    <ul className="mt-1 space-y-0.5 text-xs text-secondary-foreground" data-testid="mdm-linked-prs">
                      {linked.slice(0, 3).map((p) => (
                        <li key={p.id} className="truncate" title={`${p.id} · ${p.customerName} · ${formatSgd(p.sgd)}`}>
                          <span className="font-mono text-[0.6875rem] text-muted-foreground">{p.id}</span> {p.customerName}
                        </li>
                      ))}
                      {linked.length > 3 ? <li className="text-muted-foreground">+{linked.length - 3} more</li> : null}
                    </ul>
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
        </section>
        <StuckDemandTile />
      </div>

      {!mdm ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warn/50 bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          <Info aria-hidden className="size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            You&apos;re viewing as <strong className="font-semibold">{me.name}</strong> ({me.title}). Only the MDM team can generate
            imports or create records in SAP B1{canSee ? "" : ", and credit terms and bank details stay masked"}.
          </p>
          <SwitchToMdmButton />
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <DuplicateRecheck req={req} domain={domain} now={now} />

          {/* SAP B1 hand-off */}
          <div ref={handoffRef} className="scroll-mt-4">
            <Panel
              title="SAP B1 hand-off"
              description={
                isExtend
                  ? "One business partner record is shared by every entity, so an extension updates the existing record (assumption A28)."
                  : "Phase 1: MDM imports an approved record with SAP's Data Transfer Workbench after a final check."
              }
              actions={<SimulatedTag />}
            >
              <ol className="grid gap-3 md:grid-cols-3">
                <HandoffStep n={1} title="Generate the import file" done={generated}>
                  <span>
                    {generated && req.dtwGeneratedAt
                      ? `Generated ${formatSgtDateTime(req.dtwGeneratedAt)} · code ${code} reserved`
                      : `DTW template rows with SAP's own field names. Code ${code ?? "—"} will be reserved.`}
                  </span>
                  <Button
                    data-testid="mdm-generate-dtw"
                    onClick={onGenerate}
                    variant={generated ? "outline" : "default"}
                    disabled={!atReview && !created}
                    className="self-start"
                  >
                    <FileSpreadsheet aria-hidden />
                    {generated ? "Show SAP B1 import" : "Generate SAP B1 import"}
                  </Button>
                </HandoffStep>
                <HandoffStep n={2} title="Load it in SAP B1" done={created}>
                  <span>
                    DTW wizard: {dtwImportMode(domain) === "update" ? "“Update existing objects”, keyed by CardCode" : "“Add new objects”"}.
                    No SAP licence in the prototype, so SAP B1 is a faithful simulation.
                  </span>
                  <Link
                    href={sapHref}
                    data-testid="mdm-open-sap"
                    className={cn(buttonVariants({ variant: "outline" }), "self-start")}
                  >
                    <MonitorCog aria-hidden />
                    Open in SAP B1 (simulated)
                    <ExternalLink aria-hidden className="size-3.5 opacity-70" />
                  </Link>
                </HandoffStep>
                <HandoffStep n={3} title={isExtend ? "Confirm the update" : "Confirm it's live"} done={created}>
                  {created ? (
                    <span className="flex flex-col gap-1 text-[0.8125rem] text-foreground" data-testid="mdm-created-summary">
                      <span className="flex items-center gap-1.5">
                        <PackageCheck aria-hidden className="size-4 text-ok-ink" />
                        <SapCode code={req.sapCode} /> {createVerb} {req.sapCreatedAt ? formatSgtDateTime(req.sapCreatedAt) : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {requestor} notified in Teams and Outlook
                        {releasedSgd > 0 ? ` · ${formatSgd(releasedSgd)} of customer orders released` : ""}
                      </span>
                    </span>
                  ) : (
                    <span>
                      Releases {blockedSgd > 0 ? `${formatSgd(blockedSgd)} of customer orders` : "the record"} and tells {requestor}.
                      Whoever approved Finance can&apos;t do this step.
                    </span>
                  )}
                  {created ? null : (
                    <Button
                      data-testid="mdm-mark-created"
                      onClick={onMarkCreated}
                      disabled={!atReview || busy}
                      className="self-start"
                    >
                      <Database aria-hidden />
                      {isExtend ? "Mark updated in SAP B1" : "Mark created in SAP B1"}
                    </Button>
                  )}
                </HandoffStep>
              </ol>

              {!atReview && !created ? (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[0.8125rem] text-secondary-foreground">
                  {req.id} is {req.status.replace("_", " ")}: it reaches MDM after every business approver signs off.
                </p>
              ) : null}

              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-4">
                <TabsList>
                  <TabsTrigger value="dtw" data-testid="mdm-tab-dtw" className="px-3">
                    DTW import (Phase 1)
                  </TabsTrigger>
                  <TabsTrigger value="sl" data-testid="mdm-tab-sl" className="px-3">
                    Service Layer (Phase 2)
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="dtw" className="pt-3">
                  {generated ? (
                    <DtwPreview files={files} sensitive={sensitive} canSee={canSee} canDownload={mdm} />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
                      Generate the SAP B1 import to preview the DTW files here: {files.map((f) => f.fileName).join(", ")}.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="sl" className="pt-3">
                  {payload ? <ServiceLayerPanel payload={payload} sensitive={sensitive} canSee={canSee} /> : null}
                </TabsContent>
              </Tabs>
            </Panel>
          </div>

          <FieldReview req={req} rows={rows} />
        </div>

        <aside className="min-w-0 space-y-5">
          <ApprovalHistory req={req} />
          <AuditTimeline requestId={req.id} />
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/mdm"
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ArrowLeft aria-hidden className="size-4" />
      MDM queue
    </Link>
  );
}
