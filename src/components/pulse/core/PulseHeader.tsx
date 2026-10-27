"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpenText, CalendarRange, ChevronRight, Sigma, TrendingUp } from "lucide-react";
import { bridge, meta, matrix } from "@/data/contract";
import { SyntheticBadge } from "@/components/common/badges";
import { formatSgd } from "@/components/common/format";
import { DataHonestyDrawer } from "@/components/pulse/analytics/DataHonestyDrawer";
import { useStuckDemand } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { usePulse, type PulseMeasure, type PulseView } from "./PulseContext";
import { formatMonth, formatPct } from "./pulse-format";

interface SegOption<T extends string> {
  value: T;
  label: string;
  hint: string;
  testId: string;
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-muted p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              title={o.hint}
              data-testid={o.testId}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                active ? "bg-card text-foreground shadow-raised" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const VIEW_OPTIONS: SegOption<PulseView>[] = [
  {
    value: "merged",
    label: "Merged customers",
    hint: "Duplicate SAP records combined into one golden customer ID (default)",
    testId: "pulse-toggle-merged",
  },
  {
    value: "raw",
    label: "Raw SAP records",
    hint: "Every SAP customer record counted separately, as recorded today",
    testId: "pulse-toggle-raw",
  },
];

const MEASURE_OPTIONS: SegOption<PulseMeasure>[] = [
  { value: "sgd", label: "S$ value", hint: "Order value in SGD, fixed illustrative FX", testId: "pulse-measure-sgd" },
  { value: "units", label: "Units", hint: "Units ordered, compared within each product", testId: "pulse-measure-units" },
];

function Definition({ icon: Icon, term, children }: { icon: typeof Sigma; term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-foreground">{term}</dt>
        <dd className="mt-0.5 text-[0.8125rem] leading-snug text-secondary-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** "2025-10" → "Oct" */
function monthOnly(m: string): string {
  return formatMonth(m).replace(/ \d{4}$/, "");
}

/** "S$1.06M" → "S$1.1M" for a headline bullet. */
function sgdMillions(v: number): string {
  return `S$${(v / 1_000_000).toFixed(1)}M`;
}

const noSept = (s: string) => s.replace(/\bSept\b/g, "Sep");

/** Component 1: title, the one-line growth definition, what the page tells you, and the two view toggles. */
export function PulseHeader() {
  const { view, setView, measure, setMeasure } = usePulse();
  const w = meta.window;
  const stuck = useStuckDemand();
  const my = bridge.countries.find((c) => c.country === "MY");
  const hero = my?.topAccounts.dedup.find((a) => a.hero);
  const heroRank = my && hero ? my.topAccounts.dedup.indexOf(hero) + 1 : 0;
  const misSgd = Number(meta.params.misattributionSgd12m) || 0;

  const takeaways: { href: string; testId: string; body: ReactNode }[] = [
    {
      href: "#pulse-hero",
      testId: "pulse-takeaway-hero",
      body: hero ? (
        <>
          Malaysia&apos;s #{heroRank} hospital is shrinking{" "}
          <strong className="num">{formatPct(hero.yoy).replace("−", "")}</strong>, hidden behind a &ldquo;new&rdquo; customer
          record.
        </>
      ) : (
        "Duplicate records hide a shrinking Malaysian account."
      ),
    },
    {
      href: "#pulse-matrix",
      testId: "pulse-takeaway-matrix",
      body: (
        <>
          <strong className="num">{sgdMillions(misSgd)}</strong> of Malaysian and Vietnamese orders sit on Singapore records.
        </>
      ),
    },
    {
      href: "/mdm",
      testId: "pulse-takeaway-stuck",
      body:
        stuck.count > 0 ? (
          <>
            <strong className="num">{formatSgd(stuck.totalSgd)}</strong> of customer orders wait on a record setup today.
          </>
        ) : (
          "No customer orders are waiting on a record setup right now."
        ),
    },
  ];

  return (
    <header className="mb-6 space-y-5 border-b border-border pb-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-foreground">Regional Pulse</h1>
            <SyntheticBadge />
            <DataHonestyDrawer label="What's real here? (limits & caveats)" />
          </div>
          <p className="max-w-[72ch] text-[0.9375rem] text-muted-foreground">
            Customer orders across five countries and three product groups, counted on clean customer records. In
            production this is a Power BI report on SAP B1 extracts.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Segmented label="Customers" value={view} onChange={setView} options={VIEW_OPTIONS} />
          <Segmented label="Measure" value={measure} onChange={setMeasure} options={MEASURE_OPTIONS} />
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-5 py-3.5 shadow-raised"
        data-testid="pulse-definition"
      >
        <Sigma aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={2} />
        <p className="text-lg leading-snug font-semibold text-foreground">
          Growth = {monthOnly(w.start)} {w.start.slice(0, 4)}–{formatMonth(w.end)} vs {monthOnly(w.priorStart)}{" "}
          {w.priorStart.slice(0, 4)}–{formatMonth(w.priorEnd)}
          <span className="font-normal text-muted-foreground"> · </span>
          de-duplicated customers
          <span className="font-normal text-muted-foreground"> · </span>
          confirmed POs only
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 py-1 text-sm font-semibold text-accent-foreground">
          <TrendingUp aria-hidden className="size-4" />
          Momentum = {monthOnly(w.momentumStart)}–{monthOnly(w.momentumEnd)} YoY
        </span>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground">What this page tells you</h2>
        <ol className="mt-2 grid gap-2 md:grid-cols-3">
          {takeaways.map((t, i) => (
            <li key={t.testId}>
              <a
                href={t.href}
                data-testid={t.testId}
                className="flex h-full gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 text-[0.9375rem] leading-snug text-foreground transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <span>{t.body}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <details className="group rounded-lg border bg-muted/30" data-testid="pulse-how-we-count">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          How we count: exact formulas, time window, and why not half-years
        </summary>
        <div className="space-y-4 border-t px-4 py-4">
          <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            <Definition icon={CalendarRange} term="Time window">
              {formatMonth(w.start)} – {formatMonth(w.end)} (12 months), compared with the same 12 months a year earlier:{" "}
              {formatMonth(w.priorStart)} – {formatMonth(w.priorEnd)}.
            </Definition>
            <Definition icon={Sigma} term="Growth (headline)">
              {noSept(meta.growthFormula)}
            </Definition>
            <Definition icon={TrendingUp} term="Momentum (latest quarter)">
              {noSept(meta.momentumFormula)}
            </Definition>
            <Definition icon={BookOpenText} term="Why not half-years">
              {meta.seasonalityNote}
            </Definition>
          </dl>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p className="max-w-[110ch]">
              {noSept(matrix.measureNote)} The 6–12-month limit is a spreadsheet habit, not a data limit: SAP B1 already
              holds 24–36 months of PO history (assumption A27).
            </p>
            <Link
              href="/assumptions"
              className="shrink-0 font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              data-testid="pulse-assumptions-link"
            >
              See every assumption behind these numbers
            </Link>
          </div>
        </div>
      </details>
    </header>
  );
}
