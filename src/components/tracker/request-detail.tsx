"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, FileSearch, ShieldCheck } from "lucide-react";
import { useHasHydrated, useSandbox } from "@/lib/store";
import { buById, buLabel, domainById, personById, requestById } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, PersonAvatar, SapCode, StatusBadge, formatSgtDateTime, formatSgtDay } from "@/components/common";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { BlockedOrdersCard } from "./blocked-orders-card";
import { DeliveryTracker } from "./delivery-tracker";
import { DemoControls } from "./demo-controls";
import { DuplicateDecisionCard, RequestDataCard } from "./request-data-card";
import { countryName, demandFor, linkedDemandByRequest } from "./tracker-utils";

export function RequestDetailSkeleton() {
  return (
    <div className="w-full space-y-5" aria-busy="true" aria-label="Loading request">
      <Skeleton className="h-9 w-[28rem] max-w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-[560px]" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

/** One Gotham meta column: a hairline rule on its left, a quiet label, the value. No box around the row. */
function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1 border-l border-border-strong pr-4 pl-3", className)}>
      <dt className="text-xs leading-4 text-subtle">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** The scene loader on /demo marks the tab; while filming, the approver-simulation box stays out of shot. */
const DEMO_SESSION_KEY = "onerecord-demo-last-loaded";
function isFilming(params: URLSearchParams): boolean {
  if (params.get("demo") === "1") return true;
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

/** Requestor cell: name plus a title that wraps inside its own column instead of running into the next one. */
function RequestorCell({ personId }: { personId: string }) {
  const config = useSandbox((s) => s.config);
  const person = personById({ config }, personId);
  if (!person) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-start gap-2">
      <PersonAvatar person={person} size="sm" away={person.outOfOffice} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[0.8125rem] font-medium text-foreground">{person.name}</span>
        <span className="line-clamp-2 text-xs font-normal text-muted-foreground" title={person.title}>
          {person.title}
        </span>
      </span>
    </span>
  );
}

export function RequestDetail() {
  const params = useSearchParams();
  const id = (params.get("id") ?? "").trim().toUpperCase();
  const hydrated = useHasHydrated();
  const requests = useSandbox((s) => s.requests);
  const prs = useSandbox((s) => s.prs);
  const config = useSandbox((s) => s.config);

  const req = useMemo(() => (id ? requestById({ requests }, id) : undefined), [requests, id]);
  const demandMap = useMemo(() => linkedDemandByRequest(requests, prs), [requests, prs]);

  const reqId = req?.id;
  // Deep link from the Teams card ("Open details" → #request-data). The page renders a skeleton until the sandbox
  // hydrates, so the browser's own hash jump finds nothing; scroll once the section exists. DOM only, no store writes.
  useEffect(() => {
    if (!hydrated || !reqId || window.location.hash !== "#request-data") return;
    const raf = window.requestAnimationFrame(() => {
      document.getElementById("request-data")?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [hydrated, reqId]);

  if (!hydrated) return <RequestDetailSkeleton />;

  if (!req) {
    return (
      <div className="w-full">
        <PageHeader title="Request not found" subtitle={id ? `There is no request ${id} in this sandbox.` : "No request id was given."} />
        <EmptyState
          icon={FileSearch}
          title={id ? `${id} isn't in this sandbox` : "Pick a request to track"}
          description="Requests live in this browser's demo sandbox. A reset or another browser starts from the seeded set."
          action={
            <Link href="/requests" className={buttonVariants({ variant: "default" })}>
              See all requests
            </Link>
          }
        />
      </div>
    );
  }

  const domain = domainById({ config }, req.domainId);
  const bu = buById({ config }, req.entity);
  const demand = demandFor(demandMap, req.id);
  const created = req.status === "created";
  const filming = isFilming(params);

  return (
    <div className="w-full pb-6" data-testid="request-detail" data-request-id={req.id}>
      <Link
        href="/requests"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        data-testid="request-back"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All requests
      </Link>
      <PageHeader
        title={req.title}
        meta={
          <>
            <SapCode code={req.id} />
            <StatusBadge status={req.status} />
          </>
        }
        actions={
          <>
            <a href="#request-data" className={buttonVariants({ variant: "ghost" })} data-testid="request-jump-data">
              <ArrowDown aria-hidden />
              Request data
            </a>
            {req.status === "mdm_review" ? (
              <Link href={`/mdm?id=${encodeURIComponent(req.id)}`} className={buttonVariants({ variant: "outline" })} data-testid="request-open-mdm">
                <ShieldCheck aria-hidden />
                Open in MDM console
              </Link>
            ) : created && req.sapCode ? (
              <Link href={`/sap?code=${encodeURIComponent(req.sapCode)}`} className={buttonVariants({ variant: "outline" })}>
                View {req.sapCode} in SAP B1 (simulated)
              </Link>
            ) : null}
          </>
        }
        className="mb-5"
      />

      <dl className="mb-6 grid grid-cols-2 gap-y-4 md:grid-cols-5" aria-label="Request facts">
        <Fact label="Requestor" className="col-span-2 md:col-span-1">
          <RequestorCell personId={req.requestorId} />
        </Fact>
        <Fact label="Request type">{domain?.label ?? req.domainId}</Fact>
        <Fact label="Entity · country">
          <span className="line-clamp-2" title={`${buLabel({ config }, req.entity)} · ${countryName(req.country)}`}>
            {buLabel({ config }, req.entity)} · {countryName(req.country)}
          </span>
          {!bu ? <span className="mt-0.5 block text-xs font-normal text-warn-ink">BU not configured yet — ask MDM to add it</span> : null}
        </Fact>
        <Fact label="Created">
          <span className="num">{formatSgtDateTime(req.createdAt)}</span>
        </Fact>
        <Fact label={created ? "Live in SAP B1" : "Expected live"}>
          {created && req.sapCreatedAt ? (
            <span className="num text-ok-ink">{formatSgtDay(req.sapCreatedAt)}</span>
          ) : req.expectedBy && req.status !== "rejected" && req.status !== "cancelled" ? (
            <span className="num font-wide text-[1.125rem] leading-6 font-semibold text-foreground" data-testid="request-expected">
              {formatSgtDay(req.expectedBy)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Fact>
      </dl>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-5">
          <DeliveryTracker request={req} domain={domain} demand={demand} />
        </div>
        <aside className="min-w-0 space-y-5">
          <BlockedOrdersCard request={req} />
          <DuplicateDecisionCard request={req} domain={domain} />
          {filming ? null : <DemoControls request={req} />}
        </aside>
      </div>

      <div className="mt-5 space-y-5">
        <RequestDataCard request={req} domain={domain} />
        <AuditTimeline requestId={req.id} />
      </div>
    </div>
  );
}
