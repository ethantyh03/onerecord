"use client";

import { Fragment, useMemo } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, MousePointerClick } from "lucide-react";
import { matrix, type MatrixCell, type MatrixTotal, type MonthValueUnits } from "@/data/contract";
import type { CountryCode, ProductGroup } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SyntheticBadge } from "@/components/common/badges";
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

/** Neutral outline badge: the sign is in the text, so the colour doesn't pretend + or − is good or bad. */
function DeltaBadge({ delta, label, text }: { delta: number; label?: string; text?: string }) {
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border-strong bg-card/80 px-1.5 text-[0.6875rem] font-semibold whitespace-nowrap text-secondary-foreground"
      title={label}
    >
      <span aria-hidden>Δ</span>
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
              "group/cell relative flex min-h-[7.25rem] w-full min-w-0 flex-col rounded-lg border px-3 pt-2.5 pb-2 text-left transition-[box-shadow,border-color] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              selected ? "border-primary shadow-[0_0_0_2px_var(--primary)]" : "border-border hover:border-border-strong",
            )}
          />
        }
      >
        <span className="flex items-start justify-between gap-2">
          <span className="num text-lg leading-tight font-semibold tracking-[-0.015em] text-foreground">
            {n.value}
            {n.unit ? <span className="ml-1 text-xs font-medium text-secondary-foreground">{n.unit}</span> : null}
          </span>
          {hasDelta ? <DeltaBadge delta={cell.deltaVsRaw} text={deltaText} label={deltaTitle} /> : null}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[0.8125rem] font-semibold text-foreground">
          <TrendIcon v={n.yoy} />
          <span className="num">{n.yoy == null ? "No orders last year" : `${formatPct(n.yoy)} YoY`}</span>
        </span>
        <span className="mt-auto pt-1.5">
          <Sparkline values={n.series} splitAt={12} height={26} />
        </span>
        {selected ? (
          <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-px text-[0.625rem] font-semibold text-primary-foreground">
            Forecast below
          </span>
        ) : null}
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

function TotalCell({ t, delta, emphasis }: { t: TotalNumbers; delta?: number; emphasis?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[7.25rem] min-w-0 flex-col rounded-lg border border-dashed border-border-strong/70 px-3 pt-2.5 pb-2",
        emphasis ? "bg-secondary" : "bg-card",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="num text-lg leading-tight font-semibold tracking-[-0.015em] text-foreground">{t.value}</span>
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
      className="scroll-mt-24 rounded-xl border bg-card p-5 shadow-raised"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pulse-matrix-title" className="text-lg font-semibold tracking-[-0.01em]">
              Orders by country and product
            </h2>
            <SyntheticBadge />
          </div>
          <p className="max-w-[80ch] text-sm text-muted-foreground">
            Each box is the last 12 months of confirmed orders ({measure === "units" ? "units" : "S$"}), the change on the
            same 12 months a year earlier, and the monthly trend ({spanLabel}; the darker line is this year). Colour shows
            growth: teal is up, sand is down.
          </p>
        </div>
        <p className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 text-xs font-medium text-accent-foreground">
          <MousePointerClick aria-hidden className="size-3.5" />
          Showing the forecast for {countryName(country)} × Product {product}. Click any box to change it.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto scrollbar-thin">
        <div className="grid min-w-[860px] grid-cols-[minmax(8.5rem,0.8fr)_repeat(3,minmax(0,1fr))_minmax(0,1fr)] gap-2">
          <div />
          {PULSE_PRODUCTS.map((p) => (
            <div key={p} className="px-1 pb-1">
              <div className="text-sm font-semibold text-foreground">Product {p}</div>
              <div className="text-xs text-muted-foreground">
                {PRODUCT_SHORT[p]}
                {p === "C" ? " · lumpy, tender-driven" : ""}
              </div>
            </div>
          ))}
          <div className="px-1 pb-1">
            <div className="text-sm font-semibold text-foreground">All products</div>
            <div className="text-xs text-muted-foreground">Country total</div>
          </div>

          {PULSE_COUNTRIES.map((c) => (
            <Fragment key={c}>
              <div className="flex flex-col justify-center px-1">
                <span className="text-sm font-semibold text-foreground">{countryName(c)}</span>
                <span className="text-xs text-muted-foreground">{c}</span>
              </div>
              {PULSE_PRODUCTS.map((p) => {
                const cell = byKey.get(`${c}-${p}`);
                return cell ? (
                  <MatrixCellButton key={p} cell={cell} rawCell={rawByKey.get(`${c}-${p}`)} showDelta={merged} />
                ) : (
                  <div key={p} className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    No orders recorded
                  </div>
                );
              })}
              <TotalCell
                t={countryTotal(c)}
                delta={
                  merged && measure === "sgd"
                    ? Math.round((total(v.countryTotals, c)?.sgd12m ?? 0) - rawCountryTotal(c))
                    : undefined
                }
              />
            </Fragment>
          ))}

          <div className="flex flex-col justify-center px-1">
            <span className="text-sm font-semibold text-foreground">All countries</span>
            <span className="text-xs text-muted-foreground">Product total</span>
          </div>
          {PULSE_PRODUCTS.map((p) => (
            <TotalCell key={p} t={productTotal(p)} />
          ))}
          <TotalCell t={groupTotal} emphasis />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t pt-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Colour key: growth year on year">
          <span className="text-xs font-medium text-muted-foreground">Growth YoY</span>
          {YOY_BINS.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground">
              <span aria-hidden className="size-3 rounded-[3px] border border-border" style={{ background: binFill(b) }} />
              {b.label}
            </span>
          ))}
        </div>
        <p className="max-w-[70ch] text-xs leading-snug text-muted-foreground">
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
