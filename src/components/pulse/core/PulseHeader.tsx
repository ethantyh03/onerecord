"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight, ChevronRight } from "lucide-react";
import { bridge, meta } from "@/data/contract";
import { RowNumber } from "@/components/common/data-rows";
import { SectionTitle } from "@/components/common/section";
import { formatSgd } from "@/components/common/format";
import { DataHonestyDrawer } from "@/components/pulse/analytics/DataHonestyDrawer";
import { MEASURE_NOTE, SEASONALITY_NOTE } from "@/components/pulse/analytics/copy";
import { useStuckDemand } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { usePulse, type PulseMeasure, type PulseView } from "./PulseContext";
import { RegionMap, type MapFocus } from "./RegionMap";
import { formatMonth, formatPct } from "./pulse-format";
import { useUnblockCountdown } from "./use-unblock-countdown";

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
    <div className="flex items-center gap-2">
      <span className="text-[0.8125rem] font-medium text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-md border border-border bg-canvas p-0.5">
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
                "h-8 rounded-sm border px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                active ? "border-border-strong bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
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
  { value: "sgd", label: "S$ value", hint: "Order value in SGD at fixed FX rates", testId: "pulse-measure-sgd" },
  { value: "units", label: "Units", hint: "Units ordered, compared within each product", testId: "pulse-measure-units" },
];

/** One term of "Definitions": the term, then its definition. No icon: the term says what it is. */
function Definition({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.8125rem] font-semibold text-foreground">{term}</dt>
      <dd className="mt-0.5 text-sm leading-snug text-secondary-foreground">{children}</dd>
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

/**
 * Component 1: title, the growth definition as ruled meta columns, then the region map beside the key insights
 * (three numbered findings) and the definitions. One box on this screen: the map.
 */
export function PulseHeader() {
  const { view, setView, measure, setMeasure } = usePulse();
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const w = meta.window;
  const stuck = useStuckDemand();
  const my = bridge.countries.find((c) => c.country === "MY");
  const hero = my?.topAccounts.dedup.find((a) => a.hero);
  const heroRank = my && hero ? my.topAccounts.dedup.indexOf(hero) + 1 : 0;
  const misSgd = Number(meta.params.misattributionSgd12m) || 0;
  // Takeaway 3 is on the first screen at presenter size: after an SAP release (Beat 7's bridge) it counts
  // down from the old stuck figure to the new one, so the drop is seen without scrolling to the tile.
  const stuckTakeRef = useRef<HTMLLIElement>(null);
  const shownStuck = useUnblockCountdown(stuck.totalSgd, "onerecord-pulse-unblock-seen-takeaway", stuckTakeRef);

  const takeaways: { href: string; testId: string; focus: MapFocus; body: ReactNode }[] = [
    {
      href: "#pulse-hero",
      testId: "pulse-takeaway-hero",
      focus: "hero",
      body: hero ? (
        <>
          Malaysia&apos;s #{heroRank} hospital is shrinking{" "}
          <strong className="num font-semibold text-stuck-ink">{formatPct(hero.yoy).replace("−", "")}</strong>, hidden behind a
          &ldquo;new&rdquo; customer record.
        </>
      ) : (
        "Duplicate records hide a shrinking Malaysian account."
      ),
    },
    {
      href: "#pulse-matrix",
      testId: "pulse-takeaway-matrix",
      focus: "flows",
      body: (
        <>
          <strong className="num font-semibold text-foreground">{sgdMillions(misSgd)}</strong> of Malaysian and Vietnamese orders
          sit on Singapore records.
        </>
      ),
    },
    {
      href: "/mdm",
      testId: "pulse-takeaway-stuck",
      focus: "stuck",
      body:
        stuck.count > 0 ? (
          <>
            <strong className="num font-semibold text-stuck-ink">{formatSgd(shownStuck)}</strong> of customer orders wait on a
            record setup today.
          </>
        ) : (
          "No customer orders are waiting on a record setup right now."
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-4 min-[1440px]:flex-row min-[1440px]:items-end min-[1440px]:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <h1 className="font-wide text-[1.75rem] leading-8 font-semibold text-foreground">Regional Pulse</h1>
            <DataHonestyDrawer
              variant="ghost"
              icon={false}
              label="About this data"
              className="h-6 px-0 text-xs font-medium text-muted-foreground underline decoration-border-strong underline-offset-4 hover:bg-transparent hover:text-foreground hover:decoration-foreground"
            />
          </div>
          <p className="max-w-[76ch] text-[0.9375rem] leading-6 text-muted-foreground">
            Customer orders across five countries and three product groups, counted on clean customer records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Segmented label="Customers" value={view} onChange={setView} options={VIEW_OPTIONS} />
          <Segmented label="Measure" value={measure} onChange={setMeasure} options={MEASURE_OPTIONS} />
        </div>
      </header>

      {/* How growth is counted, as meta columns: one hairline rule between terms, no box, no icon. It sits under the
          title at every width, so it is on the first screen at 1280x720 too. */}
      <p
        className="flex flex-wrap items-baseline gap-y-1.5 text-sm leading-5 text-secondary-foreground [&>span]:border-l [&>span]:border-border-strong [&>span]:px-4 [&>span:first-child]:border-l-0 [&>span:first-child]:pl-0"
        data-testid="pulse-definition"
      >
        <span className="text-[0.9375rem] font-semibold text-foreground">
          Growth = {monthOnly(w.start)} {w.start.slice(0, 4)}–{formatMonth(w.end)} vs {monthOnly(w.priorStart)}{" "}
          {w.priorStart.slice(0, 4)}–{formatMonth(w.priorEnd)}
          <span className="sr-only">, </span>
        </span>
        <span>
          de-duplicated customers<span className="sr-only">, </span>
        </span>
        <span>
          confirmed POs only<span className="sr-only">. </span>
        </span>
        <span className="text-muted-foreground">
          Momentum = {monthOnly(w.momentumStart)}–{monthOnly(w.momentumEnd)} YoY
        </span>
      </p>

      {/* The map leads; beside it (under it below 1440px) the three findings and the definitions, as ruled rows. */}
      <div className="grid gap-x-7 gap-y-5 [grid-template-areas:'map'_'take'_'how'] min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] min-[1440px]:grid-rows-[auto_minmax(0,1fr)] min-[1440px]:gap-y-0 min-[1440px]:[grid-template-areas:'map_take'_'map_how']">
        <div className="min-w-0 [grid-area:map]">
          <RegionMap focus={focus} />
        </div>

        <section aria-labelledby="pulse-takeaways-title" className="flex min-w-0 flex-col [grid-area:take]">
          <SectionTitle id="pulse-takeaways-title" title="Key insights" />
          <ol className="mt-1 flex flex-col divide-y divide-border border-b border-border lg:max-[1439px]:mt-2 lg:max-[1439px]:grid lg:max-[1439px]:grid-cols-3 lg:max-[1439px]:divide-y-0 lg:max-[1439px]:border-b-0">
            {takeaways.map((t, i) => (
              <li
                key={t.testId}
                ref={t.focus === "stuck" ? stuckTakeRef : undefined}
                className={cn("flex", i > 0 && "lg:max-[1439px]:border-l lg:max-[1439px]:border-border")}
              >
                <a
                  href={t.href}
                  data-testid={t.testId}
                  onMouseEnter={() => setFocus(t.focus)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(t.focus)}
                  onBlur={() => setFocus(null)}
                  className={cn(
                    "group/take flex flex-1 items-start gap-3 py-[1.125rem] pr-1 text-base leading-6 text-secondary-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    "lg:max-[1439px]:px-4 lg:max-[1439px]:py-2",
                    i === 0 && "lg:max-[1439px]:pl-0",
                  )}
                >
                  <RowNumber n={i + 1} className="leading-6" />
                  <span className="min-w-0 flex-1">{t.body}</span>
                  {t.href.startsWith("#") ? (
                    <ArrowDown aria-hidden className="mt-1 size-4 shrink-0 text-subtle transition-colors group-hover/take:text-foreground" />
                  ) : (
                    <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-subtle transition-colors group-hover/take:text-foreground" />
                  )}
                </a>
              </li>
            ))}
          </ol>
        </section>

        <details
          className="group min-w-0 self-start border-b border-border [grid-area:how] max-[1439px]:border-t"
          data-testid="pulse-how-we-count"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle transition-transform group-open:rotate-90" />
            Definitions
          </summary>
          <div className="space-y-4 pb-4 pl-6.5">
            <dl className="grid gap-x-8 gap-y-3.5 lg:max-[1439px]:grid-cols-2">
              <Definition term="Time window">
                {formatMonth(w.start)} – {formatMonth(w.end)} (12 months), compared with the same 12 months a year earlier:{" "}
                {formatMonth(w.priorStart)} – {formatMonth(w.priorEnd)}.
              </Definition>
              <Definition term="Growth (headline)">{noSept(meta.growthFormula)}</Definition>
              <Definition term="Momentum (latest quarter)">{noSept(meta.momentumFormula)}</Definition>
              <Definition term="Seasonality">{SEASONALITY_NOTE}</Definition>
            </dl>
            <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <p>{MEASURE_NOTE} History: 24–36 months of PO history from SAP B1.</p>
              <Link
                href="/assumptions"
                className="w-fit font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="pulse-assumptions-link"
              >
                Assumptions
              </Link>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
