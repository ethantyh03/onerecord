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
  ConsolePanel,
  EmptyState,
  firstName,
  formatDays,
  formatSgd,
  formatSgtDateTime,
  Notice,
  PanelSection,
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
import { EntityCell, ViewerNotice } from "./Panel";
import { ServiceLayerPanel } from "./ServiceLayerPanel";
import { StuckDemandTile } from "./StuckDemandTile";
import { SwitchToMdmButton } from "./SwitchToMdmButton";

type Tab = "dtw" | "sl";

type StepState = "done" | "current" | "todo";

/**
 * One column of the hand-off: generate → load in SAP B1 → mark created. Columns are split by hairlines;
 * state is in the ink, not a bar: a done step shows a green check in place of its number, the current
 * step's number is bright (and its button is the filled one), later steps stay subtle.
 */
/**
 * One row of the hand-off procedure: number (or a check when done), the title over its description,
 * and the step's button at the right. Rows stack under hairlines so the three buttons line up in one column.
 */
function HandoffStep({
  n,
  title,
  state,
  action,
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  /** The step's button, right-aligned on wide screens (under the description on narrow ones) */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li
      data-state={state}
      aria-current={state === "current" ? "step" : undefined}
      className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 px-4 py-3.5 md:grid-cols-[1rem_minmax(0,1fr)_auto] md:gap-x-5"
    >
      {state === "done" ? (
        <CheckCircle2 aria-label="Done" className="mt-0.5 size-4 shrink-0 text-ok-ink" />
      ) : (
        <span
          className={cn(
            "num w-4 shrink-0 text-center text-sm leading-5 font-semibold",
            state === "current" ? "text-foreground" : "text-subtle",
          )}
        >
          {n}
        </span>
      )}
      <div className="min-w-0 space-y-1">
        <p className={cn("text-sm leading-5 font-semibold", state === "todo" ? "text-secondary-foreground" : "text-foreground")}>
          {title}
        </p>
        <div className="max-w-[72ch] text-[0.8125rem] leading-5 text-muted-foreground">{children}</div>
      </div>
      {action ? <div className="col-start-2 md:col-start-3 md:self-center md:justify-self-end">{action}</div> : null}
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
          title={`${id} wasn't found`}
          description="It may have been cleared by a sandbox reset. Pick a request from the MDM queue."
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
      description: `${me.name} isn't on the MDM team. Switch to Priya Nair (MDM) to continue.`,
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
              : "Teams and Outlook notifications sent to the requestor.",
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

      {/* The record as an object, on the open page: identity, then the four facts MDM checks first as
          Gotham meta columns (a hairline before each). The live stuck-demand readout sits beside it. */}
      <div className="grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] 2xl:gap-x-10 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="min-w-0" aria-label={`${req.id} summary`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <SapCode code={req.id} className="text-[0.9375rem] text-foreground" />
            <StatusBadge status={req.status} />
            <span className="text-[0.8125rem] text-muted-foreground">{domain.label}</span>
          </div>
          <h1 className="font-wide mt-2 text-[1.625rem] leading-8 font-semibold text-foreground">{req.title}</h1>
          <dl className="mt-5 grid grid-cols-2 gap-y-4 sm:grid-cols-4 [&>div]:min-w-0 [&>div]:border-l [&>div]:border-border-strong [&>div]:pr-4 [&>div]:pl-3">
            <div>
              <dt className="text-xs text-subtle">Requested by</dt>
              <dd className="mt-1.5">
                <PersonChip personId={req.requestorId} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Entity / country</dt>
              <dd className="mt-1.5">
                <EntityCell entity={req.entity} country={req.country} configured={!!buById({ config }, req.entity)} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">{created ? "Created in SAP B1" : "Approved at"}</dt>
              <dd className="num mt-1.5 text-[0.8125rem] font-medium text-foreground">
                {created && req.sapCreatedAt ? formatSgtDateTime(req.sapCreatedAt) : approved ? formatSgtDateTime(approved) : "—"}
                {atReview ? (
                  <span className={cn("block text-xs font-normal", waiting > 1 ? "text-warn-ink" : "text-muted-foreground")}>
                    {formatDays(waiting)} business days waiting
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">{created ? "Orders released" : "Customer orders waiting"}</dt>
              <dd className="num mt-1">
                {created ? (
                  <span className={cn("font-wide text-lg leading-6 font-semibold", releasedSgd > 0 ? "text-ok-ink" : "text-muted-foreground")}>
                    {releasedSgd > 0 ? formatSgd(releasedSgd) : "—"}
                  </span>
                ) : (
                  <span className={cn("font-wide text-lg leading-6 font-semibold", blockedSgd > 0 ? "text-stuck" : "text-muted-foreground")}>
                    {blockedSgd > 0 ? formatSgd(blockedSgd) : "—"}
                  </span>
                )}
                {linked.length ? (
                  <>
                    <span className="block text-xs text-subtle">
                      {linked.length} order{linked.length === 1 ? "" : "s"}
                    </span>
                    <ul className="mt-1 space-y-0.5 text-xs text-secondary-foreground" data-testid="mdm-linked-prs">
                      {linked.slice(0, 3).map((p) => (
                        <li key={p.id} className="truncate" title={`${p.id} · ${p.customerName} · ${formatSgd(p.sgd)}`}>
                          <span className="mono-id text-muted-foreground">{p.id}</span> {p.customerName}
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
        <StuckDemandTile className="self-start" />
      </div>

      {!mdm ? (
        <ViewerNotice action={<SwitchToMdmButton />}>
          <p>
            You&apos;re viewing as <strong className="font-semibold text-foreground">{me.name}</strong> ({me.title}). Only the MDM team can
            generate imports or create records in SAP B1{canSee ? "" : ", and credit terms and bank details stay masked"}.
          </p>
        </ViewerNotice>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <DuplicateRecheck req={req} domain={domain} now={now} />

          {/* SAP B1 hand-off */}
          <div ref={handoffRef} className="scroll-mt-4">
            <ConsolePanel
              title="SAP B1 hand-off"
              subtitle={
                isExtend
                  ? "One business partner record is shared by every entity, so an extension updates the existing record."
                  : "MDM imports the approved record into SAP B1 with the Data Transfer Workbench (DTW) after a final check."
              }
            >
              <PanelSection flush>
                <ol className="divide-y divide-border">
                  <HandoffStep
                    n={1}
                    title="Generate the import file"
                    state={generated ? "done" : atReview ? "current" : "todo"}
                    action={
                      <Button
                        data-testid="mdm-generate-dtw"
                        onClick={onGenerate}
                        variant={generated ? "outline" : "default"}
                        disabled={!atReview && !created}
                      >
                        <FileSpreadsheet aria-hidden />
                        {generated ? "Show SAP B1 import" : "Generate SAP B1 import"}
                      </Button>
                    }
                  >
                    <span>
                      {generated && req.dtwGeneratedAt ? (
                        <>
                          Generated <span className="num">{formatSgtDateTime(req.dtwGeneratedAt)}</span> · code{" "}
                          <SapCode code={code} variant="plain" className="text-foreground" /> reserved
                        </>
                      ) : (
                        <>
                          DTW template rows with SAP&apos;s own field names. Code <SapCode code={code} variant="plain" className="text-foreground" />{" "}
                          will be reserved.
                        </>
                      )}
                    </span>
                  </HandoffStep>
                  <HandoffStep
                    n={2}
                    title="Load it in SAP B1"
                    state={created ? "done" : generated && atReview ? "current" : "todo"}
                    action={
                      <Link href={sapHref} data-testid="mdm-open-sap" className={cn(buttonVariants({ variant: "outline" }))}>
                        <MonitorCog aria-hidden />
                        Open in SAP B1
                        <ExternalLink aria-hidden className="size-3.5 opacity-70" />
                      </Link>
                    }
                  >
                    <span>
                      In DTW, choose{" "}
                      {dtwImportMode(domain) === "update" ? "“Update existing objects” (keyed by CardCode)" : "“Add new objects”"} and load{" "}
                      {files.length === 1 ? "the file" : files.length === 2 ? "both files" : `all ${files.length} files`}.
                    </span>
                  </HandoffStep>
                  <HandoffStep
                    n={3}
                    title={isExtend ? "Confirm the update" : "Confirm it's live"}
                    state={created ? "done" : "todo"}
                    action={
                      created ? null : (
                        <Button
                          data-testid="mdm-mark-created"
                          onClick={onMarkCreated}
                          variant={generated ? "default" : "outline"}
                          disabled={!atReview || busy}
                        >
                          <Database aria-hidden />
                          {isExtend ? "Mark updated in SAP B1" : "Mark created in SAP B1"}
                        </Button>
                      )
                    }
                  >
                    {created ? (
                      <span className="flex flex-col gap-1 text-[0.8125rem] text-foreground" data-testid="mdm-created-summary">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <PackageCheck aria-hidden className="size-4 text-ok-ink" />
                          <SapCode code={req.sapCode} /> {createVerb}{" "}
                          <span className="num">{req.sapCreatedAt ? formatSgtDateTime(req.sapCreatedAt) : ""}</span>
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
                  </HandoffStep>
                </ol>
              </PanelSection>

              {!atReview && !created ? (
                <PanelSection className="py-3">
                  <Notice tone="waiting">
                    {req.id} is {req.status.replace("_", " ")}: it reaches MDM after every business approver signs off.
                  </Notice>
                </PanelSection>
              ) : null}

              <PanelSection>
                <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                  <TabsList>
                    <TabsTrigger value="dtw" data-testid="mdm-tab-dtw" className="px-3">
                      DTW import
                    </TabsTrigger>
                    <TabsTrigger value="sl" data-testid="mdm-tab-sl" className="px-3">
                      Service Layer (planned)
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="dtw" className="pt-3">
                    {generated ? (
                      <DtwPreview files={files} sensitive={sensitive} canSee={canSee} canDownload={mdm} />
                    ) : (
                      <p className="py-1 text-sm text-muted-foreground">
                        Generate the SAP B1 import to preview the DTW files here:{" "}
                        {files.map((f, i) => (
                          <span key={f.fileName}>
                            {i ? ", " : ""}
                            <span className="mono-id text-secondary-foreground">{f.fileName}</span>
                          </span>
                        ))}
                        .
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="sl" className="pt-3">
                    {payload ? <ServiceLayerPanel payload={payload} sensitive={sensitive} canSee={canSee} /> : null}
                  </TabsContent>
                </Tabs>
              </PanelSection>
            </ConsolePanel>
          </div>

          <FieldReview req={req} rows={rows} />
        </div>

        <aside className="grid min-w-0 content-start items-start gap-5 xl:grid-cols-2 2xl:grid-cols-1">
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
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ArrowLeft aria-hidden className="size-4" />
      MDM queue
    </Link>
  );
}
