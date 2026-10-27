"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, FilePlus2, Hourglass, Inbox, Search, ShoppingCart, Siren, X } from "lucide-react";
import type { MdmRequest, RequestStatus } from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { useHasHydrated, useSandbox } from "@/lib/store";
import { buLabel, personById, useMyRequests, useNow, usePipelineStats, useStuckDemand } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  KpiTile,
  PageHeader,
  PersonAvatar,
  SapCode,
  SlaChip,
  StatusBadge,
  formatDays,
  formatSgd,
  statusMeta,
} from "@/components/common";
import {
  activeSteps,
  countryName,
  demandFor,
  linkedDemandByRequest,
  requestAgeBusinessDays,
  searchText,
  worstActiveStep,
  type LinkedDemand,
} from "./tracker-utils";

type TabId = "mine" | "all";
const REQUEST_STATUSES: RequestStatus[] = ["in_approval", "needs_info", "mdm_review", "created", "rejected", "cancelled", "draft"];

interface Filters {
  domain: string;
  country: string;
  status: string;
  bu: string;
  q: string;
}
const NO_FILTERS: Filters = { domain: "", country: "", status: "", bu: "", q: "" };

function FilterSelect({
  label,
  value,
  onChange,
  options,
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testid: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        className={cn(
          "h-8 min-w-36 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          value && "border-primary/40 bg-primary-soft/50",
        )}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function WaitingOnCell({ req }: { req: MdmRequest }) {
  const config = useSandbox((s) => s.config);
  const view = { config };
  const requestor = personById(view, req.requestorId);

  if (req.status === "draft") return <span className="text-sm text-muted-foreground">Not submitted yet</span>;
  if (req.status === "cancelled") return <span className="text-sm text-muted-foreground">Withdrawn</span>;
  if (req.status === "created")
    return (
      <span className="flex items-center gap-2 text-sm text-secondary-foreground">
        Live as <SapCode code={req.sapCode} />
      </span>
    );
  if (req.status === "rejected") {
    const st = req.steps.find((s) => s.status === "rejected");
    return <span className="text-sm text-stuck-ink">Stopped at {st?.label.split(" — ")[0] ?? "approval"}</span>;
  }

  const active = activeSteps(req);
  const question = active.find((s) => s.status === "question");
  if (question) {
    return (
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{question.stageLabel} · question asked</p>
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <PersonAvatar person={requestor} size="xs" />
          <span className="truncate">Answer from {requestor?.name ?? "requestor"}</span>
        </p>
      </div>
    );
  }
  const people = active.map((s) => personById(view, s.assigneeId));
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{active[0]?.stageLabel ?? "—"}</p>
      <p className="flex items-center gap-1.5 text-sm text-foreground">
        <span className="flex -space-x-1.5">
          {people.slice(0, 3).map((p, i) => (
            <PersonAvatar key={i} person={p} size="xs" className="ring-2 ring-card" />
          ))}
        </span>
        <span className="truncate">
          {people.length === 1 ? (people[0]?.name ?? "Unassigned") : `${people.length} approvers in parallel`}
        </span>
      </p>
    </div>
  );
}

function RequestRow({ req, now, demand, onOpen }: { req: MdmRequest; now: string; demand: LinkedDemand; onOpen: (id: string) => void }) {
  const config = useSandbox((s) => s.config);
  const domain = config.domains.find((d) => d.id === req.domainId);
  const age = requestAgeBusinessDays(req, now);
  const worst = worstActiveStep(req, now);
  const href = `/requests/view?id=${encodeURIComponent(req.id)}`;

  return (
    <TableRow
      data-testid={`request-row-${req.id}`}
      data-status={req.status}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        onOpen(req.id);
      }}
      className="cursor-pointer"
    >
      <TableCell className="max-w-[22rem] py-3">
        <Link href={href} className="group/link block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <span className="num font-mono text-xs text-muted-foreground">{req.id}</span>
          <span className="block truncate text-sm font-medium text-foreground group-hover/link:underline group-hover/link:underline-offset-4">
            {req.title}
          </span>
        </Link>
      </TableCell>
      <TableCell className="text-sm text-secondary-foreground">{domain?.label ?? req.domainId}</TableCell>
      <TableCell className="text-sm">
        <span className="block text-foreground">{req.entity}</span>
        <span className="block text-xs text-muted-foreground">{countryName(req.country)}</span>
      </TableCell>
      <TableCell>
        <StatusBadge status={req.status} size="sm" />
      </TableCell>
      <TableCell className="max-w-[16rem]">
        <WaitingOnCell req={req} />
      </TableCell>
      <TableCell className="num text-right text-sm text-secondary-foreground">{age === null ? "—" : `${formatDays(age)} d`}</TableCell>
      <TableCell>{worst ? <SlaChip step={worst} /> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
      <TableCell className="num text-right">
        {demand.blockedCount ? (
          <span className="text-sm font-semibold text-stuck-ink" title={`${demand.blockedCount} purchase request(s) blocked`}>
            {formatSgd(demand.blockedSgd)}
          </span>
        ) : demand.releasedCount ? (
          <span className="text-xs text-ok-ink" title="Released when the record went live">
            {formatSgd(demand.releasedSgd)} released
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function RequestsWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHasHydrated();
  const [tab, setTab] = useState<TabId>(params.get("tab") === "all" ? "all" : "mine");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const requests = useSandbox((s) => s.requests);
  const prs = useSandbox((s) => s.prs);
  const config = useSandbox((s) => s.config);
  const personaId = useSandbox((s) => s.personaId);
  const now = useNow(20_000);
  const stats = usePipelineStats();
  const stuck = useStuckDemand();

  const me = personById({ config }, personaId);
  const demandMap = useMemo(() => linkedDemandByRequest(requests, prs), [requests, prs]);

  const mine = useMyRequests();
  // Other people's drafts are private to them.
  const all = useMemo(
    () =>
      requests
        .filter((r) => r.status !== "draft" || r.requestorId === personaId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [requests, personaId],
  );

  const base = tab === "mine" ? mine : all;
  const rows = useMemo(() => {
    if (tab === "mine") return base;
    const q = filters.q.trim().toLowerCase();
    return base.filter((r) => {
      if (filters.domain && r.domainId !== filters.domain) return false;
      if (filters.country && r.country !== filters.country) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.bu && r.entity !== filters.bu) return false;
      if (q && !searchText(r, personById({ config }, r.requestorId)?.name ?? "").includes(q)) return false;
      return true;
    });
  }, [base, tab, filters, config]);

  const buOptions = useMemo(() => {
    const ids = new Set<string>([...config.businessUnits.map((b) => b.id), ...requests.map((r) => r.entity)]);
    return [...ids].map((id) => ({ value: id, label: buLabel({ config }, id) }));
  }, [config, requests]);

  const filtersOn = tab === "all" && Object.values(filters).some(Boolean);
  const set = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const open = (id: string) => router.push(`/requests/view?id=${encodeURIComponent(id)}`);

  return (
    <div className="mx-auto w-full max-w-[1320px] pb-6">
      <PageHeader
        title="Requests"
        subtitle="Every master-data request: where it is, who it is waiting on, and which customer orders it holds up."
        actions={
          <Link href="/requests/new" className={buttonVariants({ variant: "default" })} data-testid="requests-new">
            <FilePlus2 aria-hidden />
            New request
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="In flight"
          icon={Hourglass}
          tone="brand"
          value={hydrated ? stats.inFlight : "—"}
          caption="In approval, waiting on an answer, or at the MDM final check"
        />
        <KpiTile
          label="SLA breached"
          icon={Siren}
          tone={hydrated && stats.breached > 0 ? "warn" : "ok"}
          value={hydrated ? stats.breached : "—"}
          caption={`Requests with a step open more than ${config.sla.stepBusinessDays} business days`}
        />
        <KpiTile
          label="Median time to create"
          icon={Clock3}
          value={hydrated ? `${formatDays(stats.medianDaysToCreate)} d` : "—"}
          caption="Business days from submission to live in SAP B1"
          footnote="Today by email: median 14 days (Amy's took 18) → ≤ 4 business days"
        />
        <KpiTile
          label="Orders waiting on master data"
          icon={ShoppingCart}
          tone="stuck"
          value={hydrated ? formatSgd(stuck.totalSgd) : "—"}
          caption={hydrated ? `${stuck.count} customer purchase requests can't convert yet` : " "}
          href="/pulse"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="gap-0">
        <div className="flex flex-col gap-3 rounded-t-xl border border-b-0 bg-card px-4 pt-3 pb-3 shadow-raised lg:flex-row lg:items-end lg:justify-between">
          <TabsList className="h-9">
            <TabsTrigger value="mine" data-testid="requests-tab-mine" className="px-3">
              My requests
              <span className="num ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{hydrated ? mine.length : 0}</span>
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="requests-tab-all" className="px-3">
              All requests
              <span className="num ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{hydrated ? all.length : 0}</span>
            </TabsTrigger>
          </TabsList>

          {tab === "all" ? (
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Search</span>
                <span className="relative">
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.q}
                    onChange={(e) => set("q")(e.target.value)}
                    placeholder="ID, title or requestor"
                    className="h-8 w-56 pl-8"
                    data-testid="requests-search"
                  />
                </span>
              </label>
              <FilterSelect
                label="Type"
                value={filters.domain}
                onChange={set("domain")}
                testid="requests-filter-domain"
                options={config.domains.map((d) => ({ value: d.id, label: d.label }))}
              />
              <FilterSelect
                label="Country"
                value={filters.country}
                onChange={set("country")}
                testid="requests-filter-country"
                options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
              />
              <FilterSelect
                label="Status"
                value={filters.status}
                onChange={set("status")}
                testid="requests-filter-status"
                options={REQUEST_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }))}
              />
              <FilterSelect label="BU" value={filters.bu} onChange={set("bu")} testid="requests-filter-bu" options={buOptions} />
              {filtersOn ? (
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8")}
                  data-testid="requests-clear-filters"
                >
                  <X aria-hidden />
                  Clear
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {me ? `Requests raised by ${me.name}.` : null} Switch persona in the top bar to see someone else&apos;s.
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-b-xl border bg-card shadow-raised">
          {!hydrated ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            tab === "mine" ? (
              <EmptyState
                size="md"
                icon={Inbox}
                className="m-4 border-0"
                title={`${me?.name ?? "This persona"} hasn't raised any requests`}
                description="Start a request and you can follow every approval here, or look at the whole pipeline."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link href="/requests/new" className={buttonVariants({ variant: "default" })}>
                      Start a request
                    </Link>
                    <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => setTab("all")}>
                      See all requests
                    </button>
                  </div>
                }
              />
            ) : (
              <EmptyState
                size="md"
                icon={Search}
                className="m-4 border-0"
                title="No requests match these filters"
                description="Widen the search or clear the filters to see the whole pipeline."
                action={
                  <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </button>
                }
              />
            )
          ) : (
            <Table data-testid="requests-table">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Request</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current step · waiting on</TableHead>
                  <TableHead className="text-right" title="Business days since submission">
                    Age
                  </TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="pr-4 text-right">Orders waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4">
                {rows.map((r) => (
                  <RequestRow key={r.id} req={r} now={now} demand={demandFor(demandMap, r.id)} onOpen={open} />
                ))}
              </TableBody>
            </Table>
          )}
          {hydrated && rows.length > 0 ? (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {rows.length} request{rows.length === 1 ? "" : "s"} · age in business days (Mon–Fri, SGT) on the simulated clock · synthetic,
              illustrative data
            </p>
          ) : null}
        </div>
      </Tabs>
    </div>
  );
}
