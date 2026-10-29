"use client";

import { Fragment, useMemo } from "react";
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { matrix, type MatrixCell, type MatrixTotal, type MonthValueUnits } from "@/data/contract";
import type { CountryCode, ProductGroup } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MATCHER_CAVEAT } from "@/components/pulse/analytics/caveats";
import { cn } from "@/lib/utils";
import { usePulse, type PulseMeasure } from "./PulseContext";
import { Sparkline } from "./Sparkline";
import {
  PRODUCT_SHORT,
  PULSE_COUNTRIES,
  PULSE_PRODUCTS,
  YOY_BINS,
  binFill,
  countCompact,
  countryName,
  formatMonth,
  formatPct,
  sgdCompact,
  sgdDelta,
  viewKey,
  yoyFill,
} from "./pulse-format";

function TrendIcon({ v }: { v: number | null }) {
  const cls = "size-3.5 shrink-0";
  if (v == null || Math.abs(v) < 0.03) return <ArrowRight aria-hidden className={cn(cls, "text-muted-foreground")} />;
  return v > 0 ? (
    <ArrowUpRight aria-hidden className={cn(cls, "text-foreground")} />
  ) : (
    <ArrowDownRight aria-hidden className={cn(cls, "text-foreground")} />
  );
}

/**
 * What cleaning moved into or out of a box, as a bare figure (no chip). Neutral ink: the sign is in the text, so
 * the colour doesn't pretend + or − is good or bad. The teal Δ ties it to the map's arcs (orders moved by merging).
 */
function DeltaBadge({ delta, label, text }: { delta: number; label?: string; text?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-baseline gap-1 text-xs leading-5 font-semibold whitespace-nowrap text-secondary-foreground"
      title={label}
    >
      <span aria-hidden className="text-signal">
        Δ
      </span>
      <span className="num">{text ?? sgdDelta(delta)}</span>
      <span className="sr-only">changed by cleaning versus raw records</span>
    </span>
  );
}

function cellNumbers(cell: MatrixCell, measure: PulseMeasure) {
  return measure === "units"
    ? {
        value: `${countCompact(cell.units12m)}`,
        unit: "units",
        prior: `${countCompact(cell.unitsPrior12m)} units`,
        yoy: cell.unitsYoy,
        momentum: cell.momentumUnits,
        series: cell.series.map((p) => p.units),
      }
    : {
        value: sgdCompact(cell.sgd12m),
        unit: "",
        prior: sgdCompact(cell.sgdPrior12m),
        yoy: cell.yoy,
        momentum: cell.momentum,
        series: cell.series.map((p) => p.sgd),
      };
}

/** "+1.2k units" / "−860 units" */
function unitsDelta(v: number): string {
  if (!v) return "0 units";
  return `${v > 0 ? "+" : "−"}${countCompact(Math.abs(v))} units`;
}

function MatrixCellButton({ cell, rawCell, showDelta }: { cell: MatrixCell; rawCell?: MatrixCell; showDelta: boolean }) {
  const { measure, country, product, setCountry, setProduct } = usePulse();
  const n = cellNumbers(cell, measure);
  const selected = country === cell.country && product === cell.product;
  const hasDelta = showDelta && cell.changedByCleaning && cell.deltaVsRaw !== 0;
  const unitDelta = rawCell ? cell.units12m - rawCell.units12m : null;
  const deltaText = measure === "units" ? (unitDelta == null ? "" : unitsDelta(unitDelta)) : undefined;
  const deltaTitle = `Cleaning moved ${sgdDelta(cell.deltaVsRaw)}${unitDelta != null ? ` (${unitsDelta(unitDelta)})` : ""} ${cell.deltaVsRaw > 0 ? "into" : "out of"} this box`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-testid={`pulse-cell-${cell.country}-${cell.product}`}
            aria-pressed={selected}
            aria-label={`${countryName(cell.country)}, Product ${cell.product}: ${n.value} ${n.unit}, ${formatPct(n.yoy)} year on year. Select to show its forecast.`}
            onClick={() => {
              setCountry(cell.country);
              setProduct(cell.product);
            }}
            style={{ background: yoyFill(n.yoy) }}
            className={cn(
              // A heatmap cell: the fill is the data (growth bin). Square-ish, no border; selection is a 2px inset
              // ring in foreground ink, hover a 1px one.
              "group/cell relative flex min-h-[7rem] w-full min-w-0 flex-col rounded-[3px] px-3 pt-2.5 pb-2 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected ? "ring-2 ring-foreground ring-inset" : "hover:ring-1 hover:ring-muted-foreground/70 hover:ring-inset",
            )}
          />
        }
      >
        <span className="flex items-start justify-between gap-2">
          <span className="num font-wide text-lg leading-tight font-semibold text-foreground">
            {n.value}
            {n.unit ? <span className="ml-1 text-xs font-medium text-secondary-foreground">{n.unit}</span> : null}
          </span>
          {hasDelta ? <DeltaBadge delta={cell.deltaVsRaw} text={deltaText} label={deltaTitle} /> : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[0.8125rem] font-semibold text-foreground">
          <TrendIcon v={n.yoy} />
          <span className="num whitespace-nowrap">{n.yoy == null ? "No orders last year" : `${formatPct(n.yoy)} YoY`}</span>
          {selected ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-foreground">
              Forecast below
              <ArrowDown aria-hidden className="size-3.5" />
            </span>
          ) : null}
        </span>
        <span className="mt-auto pt-1.5">
          <Sparkline values={n.series} splitAt={12} height={26} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[18rem] flex-col items-start gap-1 py-2 text-left">
        <span className="font-semibold">
          {countryName(cell.country)} · Product {cell.product} ({PRODUCT_SHORT[cell.product]})
        </span>
        <span>
          Last 12 months {n.value} {n.unit} vs {n.prior} a year earlier ({formatPct(n.yoy)}).
        </span>
        <span>Latest quarter vs same quarter last year: {formatPct(n.momentum)}.</span>
        {hasDelta ? (
          <span>
            Cleaning moved {sgdDelta(cell.deltaVsRaw)}
            {unitDelta != null ? ` (${unitsDelta(unitDelta)})` : ""} {cell.deltaVsRaw > 0 ? "into" : "out of"} this cell:
            orders that were recorded under the wrong country or product.
          </span>
        ) : null}
        <span className="opacity-80">Click to show this cell&apos;s forecast.</span>
      </TooltipContent>
    </Tooltip>
  );
}

interface TotalNumbers {
  value: string;
  yoy: number | null;
  series: number[] | null;
  note?: string;
}

/**
 * A total, outside the heatmap: no fill, set off by a rule (left of the totals column, above the totals row, both
 * for the grand total), like a sum line in a ledger.
 */
function TotalCell({ t, delta, edge }: { t: TotalNumbers; delta?: number; edge: "col" | "row" | "corner" }) {
  return (
    <div
      className={cn(
        // The rules are pseudo-elements that run 2px into the grid gap, so they read as one continuous line.
        "relative flex min-h-[7rem] min-w-0 flex-col px-3 pt-2.5 pb-2",
        edge !== "row" && "before:absolute before:-top-0.5 before:-bottom-0.5 before:left-0 before:w-px before:bg-border-strong",
        edge !== "col" && "after:absolute after:top-0 after:-right-0.5 after:-left-0.5 after:h-px after:bg-border-strong",
        edge === "corner" && "bg-secondary/50 before:top-0 after:right-0",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="num font-wide text-lg leading-tight font-semibold text-foreground">{t.value}</span>
        {delta ? <DeltaBadge delta={delta} /> : null}
      </span>
      {t.note ? (
        <span className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.note}</span>
      ) : (
        <span className="mt-0.5 flex items-center gap-1 text-[0.8125rem] font-semibold text-foreground">
          <TrendIcon v={t.yoy} />
          <span className="num">{formatPct(t.yoy)} YoY</span>
        </span>
      )}
      {t.series ? (
        <span className="mt-auto pt-1.5">
          <Sparkline values={t.series} splitAt={12} height={26} />
        </span>
      ) : null}
    </div>
  );
}

function sumUnits(cells: MatrixCell[]): { units: number; prior: number; series: number[] } {
  const units = cells.reduce((a, c) => a + c.units12m, 0);
  const prior = cells.reduce((a, c) => a + c.unitsPrior12m, 0);
  const len = cells[0]?.series.length ?? 0;
  const series = Array.from({ length: len }, (_, i) =>
    cells.reduce((a, c) => a + ((c.series[i] as MonthValueUnits | undefined)?.units ?? 0), 0),
  );
  return { units, prior, series };
}

const MIXED_UNITS = "Units can't be added across products. Switch to S$.";

/** Component 3: 5 countries × 3 products, 12-month value, YoY colour, 24-month trend, totals. */
export function CountryProductMatrix() {
  const { view, measure, country, product } = usePulse();
  const v = matrix.views[viewKey(view)];
  const raw = matrix.views.raw;
  const merged = view === "merged";

  const byKey = useMemo(() => {
    const m = new Map<string, MatrixCell>();
    for (const c of v.cells) m.set(`${c.country}-${c.product}`, c);
    return m;
  }, [v]);
  const rawByKey = useMemo(() => {
    const m = new Map<string, MatrixCell>();
    for (const c of raw.cells) m.set(`${c.country}-${c.product}`, c);
    return m;
  }, [raw]);

  const total = (list: MatrixTotal[], key: string) => list.find((t) => t.key === key);
  const rawCountryTotal = (key: CountryCode) => total(raw.countryTotals, key)?.sgd12m ?? 0;

  const countryTotal = (c: CountryCode): TotalNumbers => {
    const t = total(v.countryTotals, c);
    if (!t) return { value: "n/a", yoy: null, series: null };
    if (measure === "units") return { value: "n/a", yoy: null, series: null, note: MIXED_UNITS };
    return { value: sgdCompact(t.sgd12m), yoy: t.yoy, series: t.series.map((p) => p.sgd) };
  };

  const productTotal = (p: ProductGroup): TotalNumbers => {
    const t = total(v.productTotals, p);
    if (measure === "units") {
      const s = sumUnits(v.cells.filter((c) => c.product === p));
      return {
        value: `${countCompact(t?.units12m ?? s.units)} units`,
        yoy: s.prior > 0 ? s.units / s.prior - 1 : null,
        series: s.series,
      };
    }
    if (!t) return { value: "n/a", yoy: null, series: null };
    return { value: sgdCompact(t.sgd12m), yoy: t.yoy, series: t.series.map((x) => x.sgd) };
  };

  const groupTotal: TotalNumbers =
    measure === "units"
      ? { value: "n/a", yoy: null, series: null, note: MIXED_UNITS }
      : { value: sgdCompact(v.group.sgd12m), yoy: v.group.yoy, series: v.group.series.map((p) => p.sgd) };

  const months = matrix.months;
  const spanLabel = months.length ? `${formatMonth(months[0])} – ${formatMonth(months[months.length - 1])}` : "";
  const changedCount = merged ? v.cells.filter((c) => c.changedByCleaning && c.deltaVsRaw !== 0).length : 0;

  return (
    <section
      aria-labelledby="pulse-matrix-title"
      id="pulse-matrix"
      data-testid="pulse-matrix"
      className="panel scroll-mt-24 overflow-hidden"
    >
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 space-y-1">
          <h2 id="pulse-matrix-title" className="panel-title flex min-h-7 items-center">
            Orders by country and product
          </h2>
          <p className="max-w-[86ch] text-sm leading-snug text-muted-foreground">
            Each box is the last 12 months of confirmed orders ({measure === "units" ? "units" : "S$"}), the change on the
            same 12 months a year earlier, and the monthly trend ({spanLabel}; the darker line is this year). Colour shows
            growth: teal is up, sand is down.
          </p>
        </div>
        <p className="shrink-0 text-[0.8125rem] leading-5 text-muted-foreground lg:max-w-[19rem] lg:pt-1 lg:text-right">
          Showing the forecast for{" "}
          <span className="font-medium text-foreground">
            {countryName(country)} × Product {product}
          </span>
          . Click any box to change it.
        </p>
      </div>

      <div className="relative overflow-x-auto p-4 scrollbar-thin">
        <div className="grid min-w-[860px] grid-cols-[minmax(8.5rem,0.8fr)_repeat(3,minmax(0,1fr))_minmax(0,1fr)] gap-1">
          <div />
          {PULSE_PRODUCTS.map((p) => (
            <div key={p} className="px-1 pb-1.5">
              <div className="text-sm font-semibold text-foreground">Product {p}</div>
              <div className="text-xs text-muted-foreground">
                {PRODUCT_SHORT[p]}
                {p === "C" ? " · lumpy, tender-driven" : ""}
              </div>
            </div>
          ))}
          <div className="px-1 pb-1.5 pl-3">
            <div className="text-sm font-semibold text-foreground">All products</div>
            <div className="text-xs text-muted-foreground">Country total</div>
          </div>

          {PULSE_COUNTRIES.map((c) => (
            <Fragment key={c}>
              <div className="flex flex-col justify-center px-1">
                <span className="text-sm font-semibold text-foreground">{countryName(c)}</span>
                <span className="text-xs text-subtle">{c}</span>
              </div>
              {PULSE_PRODUCTS.map((p) => {
                const cell = byKey.get(`${c}-${p}`);
                return cell ? (
                  <MatrixCellButton key={p} cell={cell} rawCell={rawByKey.get(`${c}-${p}`)} showDelta={merged} />
                ) : (
                  <div key={p} className="rounded-[3px] bg-secondary/40 p-3 text-xs text-muted-foreground">
                    No orders recorded
                  </div>
                );
              })}
              <TotalCell
                edge="col"
                t={countryTotal(c)}
                delta={
                  merged && measure === "sgd"
                    ? Math.round((total(v.countryTotals, c)?.sgd12m ?? 0) - rawCountryTotal(c))
                    : undefined
                }
              />
            </Fragment>
          ))}

          <div className="relative flex flex-col justify-center px-1 after:absolute after:top-0 after:-right-0.5 after:left-0 after:h-px after:bg-border-strong">
            <span className="text-sm font-semibold text-foreground">All countries</span>
            <span className="text-xs text-muted-foreground">Product total</span>
          </div>
          {PULSE_PRODUCTS.map((p) => (
            <TotalCell key={p} edge="row" t={productTotal(p)} />
          ))}
          <TotalCell edge="corner" t={groupTotal} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5" aria-label="Colour key: growth year on year">
          <span className="text-xs font-medium text-muted-foreground">Growth YoY</span>
          {YOY_BINS.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground">
              <span aria-hidden className="size-2.5 rounded-[1px]" style={{ background: binFill(b) }} />
              {b.label}
            </span>
          ))}
        </div>
        <p className="max-w-[150ch] text-xs leading-snug text-muted-foreground">
          {merged ? (
            <>
              <span className="font-semibold text-foreground">Δ</span> marks the {changedCount} boxes that change once
              customers are cleaned{measure === "units" ? " (in units; S$ in the tooltip)" : ""}.{" "}
              {matrix.cleaningNote.replace(/\bSept\b/g, "Sep")}{" "}
              <span className="font-medium text-secondary-foreground" data-testid="pulse-matrix-matcher-caveat">
                {MATCHER_CAVEAT}
              </span>
            </>
          ) : (
            "Raw view: every SAP record counted as recorded, including orders booked under the wrong country or product. Switch to merged customers to see what cleaning changes."
          )}
        </p>
      </div>
    </section>
  );
}
