"use client";

import { Info } from "lucide-react";
import { StatusText, formatSgd } from "@/components/common";
import { usePulse } from "@/components/pulse/core/PulseContext";
import { backtest, type BacktestCell } from "@/data/contract";
import { cn } from "@/lib/utils";
import { COUNTRY_NAME, PanelFrame, PlainLine, VIZ, per100, signedPts, biasWords } from "./shared";
import { productCPlan } from "./productC";
import { SEASON_CAVEAT } from "./caveats";
import { HEADLINE_ERROR, WIN_LOSS_SENTENCE } from "./copy";

const ORDER = ["SG", "MY", "TH", "VN", "MM"];

function sortCells(cells: BacktestCell[]): BacktestCell[] {
  return [...cells].sort(
    (a, b) => a.product.localeCompare(b.product) || ORDER.indexOf(a.country) - ORDER.indexOf(b.country),
  );
}

function biasShort(b: number): string {
  const v = Math.round(b * 1000) / 10;
  if (Math.abs(v) < 0.5) return "≈ 0%";
  return `${v > 0 ? "+" : "−"}${Math.abs(v)}%`;
}

/** Diverging bar for Δ WAPE points: left (teal) = seasonal model better, right (amber) = rolling average better. */
function DeltaBar({ pts, max }: { pts: number; max: number }) {
  const w = Math.min(1, Math.abs(pts) / max) * 50;
  const better = pts < 0;
  return (
    <div className="relative h-2 w-24" aria-hidden>
      <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
      <div
        className="absolute inset-y-0 rounded-[2px]"
        style={{
          background: better ? VIZ.ours : VIZ.today,
          width: `${w}%`,
          left: better ? `${50 - w}%` : "50%",
        }}
      />
    </div>
  );
}

/**
 * Component 7: backtest scorecard. Losses are shown, never hidden: the result word is amber and the difference bar
 * points the other way (no row tint). Product C sits in its own group.
 */
export function Scorecard() {
  const { country, product, setCountry, setProduct } = usePulse();
  const headlineCells = sortCells(backtest.cells.filter((c) => c.inHeadline && c.product !== "C"));
  const cCells = sortCells(backtest.cells.filter((c) => c.product === "C" || !c.inHeadline));
  const maxPts = Math.max(5, ...headlineCells.map((c) => Math.abs(c.deltaWapePts)));
  const wl = backtest.winLoss;
  const h = backtest.headline;

  const select = (c: BacktestCell) => {
    setCountry(c.country);
    setProduct(c.product);
  };

  const isSelected = (c: BacktestCell) => c.country === country && c.product === product;
  const rowCls = (c: BacktestCell) =>
    cn(
      "h-10 cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-secondary/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      isSelected(c) && "bg-secondary hover:bg-secondary",
    );

  return (
    <PanelFrame
      testId="scorecard"
      title="Forecast scorecard"
      subtitle={
        <>
          Every country × product, scored the same way on six 2026 forecast dates. Error is read as &ldquo;off by N units
          per 100 ordered&rdquo;
          <span
            className="ml-1 inline-flex translate-y-0.5 cursor-help text-muted-foreground"
            title={`Forecast error (WAPE): ${backtest.wapeFormula}`}
            aria-label={`Forecast error (WAPE): ${backtest.wapeFormula}`}
          >
            <Info className="size-3.5" aria-hidden />
          </span>
          . Click a row to open it in the forecast chart.
        </>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1">
          <PlainLine>
            <span className="font-medium text-foreground">Products A and B:</span> {HEADLINE_ERROR}.
          </PlainLine>
          <p className="text-sm font-medium text-secondary-foreground" data-testid="scorecard-season-caveat">
            {SEASON_CAVEAT}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="scorecard-winloss">
            {WIN_LOSS_SENTENCE}
          </p>
        </div>
        <div className="flex gap-5 text-sm md:pb-0.5">
          <StatusText tone="ok" className="text-sm">
            <span className="num font-semibold">{wl.oursWins}</span> seasonal better
          </StatusText>
          <StatusText tone="warn" className="text-sm">
            <span className="num font-semibold">{wl.baselineWins}</span> rolling better
          </StatusText>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Forecast error by country and product</caption>
          <thead className="text-xs text-subtle">
            <tr className="border-b border-border-strong">
              <th className="px-3 py-2 text-left font-medium">Cell</th>
              <th className="px-3 py-2 text-right font-medium">Rolling 12-month average</th>
              <th className="px-3 py-2 text-right font-medium" title="Damped Holt-Winters exponential smoothing (ETS)">
                Seasonal model
              </th>
              <th className="px-3 py-2 text-left font-medium">Difference</th>
              <th className="px-3 py-2 text-right font-medium" title="Bias: + means the method orders too much on average, − too little">
                Over (+) / under (−) forecast, rolling / seasonal
              </th>
              <th className="px-3 py-2 text-left font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <th colSpan={6} className="px-3 pt-3 pb-1.5 text-left text-xs font-semibold text-foreground">
                Products A and B · in the headline
              </th>
            </tr>
            {headlineCells.map((c) => {
              const loss = !c.oursBeatsBaseline;
              return (
                <tr
                  key={`${c.country}${c.product}`}
                  tabIndex={0}
                  onClick={() => select(c)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select(c))}
                  data-testid={`scorecard-row-${c.country}-${c.product}`}
                  aria-current={isSelected(c) ? "true" : undefined}
                  className={rowCls(c)}
                >
                  <td className="px-3 py-2">
                    <span className="font-medium">{COUNTRY_NAME[c.country]}</span>
                    <span className="text-muted-foreground"> · Product {c.product}</span>
                  </td>
                  <td className="num px-3 py-2 text-right">{per100(c.baselineWape)} per 100</td>
                  <td className="num px-3 py-2 text-right font-medium">{per100(c.oursWape)} per 100</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <DeltaBar pts={c.deltaWapePts} max={maxPts} />
                      <span className={cn("num text-xs", loss ? "font-medium text-warn-ink" : "text-secondary-foreground")}>
                        {signedPts(c.deltaWapePts)}
                      </span>
                    </div>
                  </td>
                  <td className="num px-3 py-2 text-right text-xs text-muted-foreground">
                    {biasShort(c.scores.rolling12.bias)} / {biasShort(c.scores.etsDamped.bias)}
                  </td>
                  <td className="px-3 py-2">
                    {loss ? (
                      <StatusText size="sm" tone="warn">
                        Rolling better
                      </StatusText>
                    ) : (
                      <StatusText size="sm" tone="ok">
                        Seasonal better
                      </StatusText>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-border">
              <th colSpan={6} className="px-3 pt-5 pb-1.5 text-left text-xs font-semibold text-foreground">
                Product C · instruments · planned from tender pipeline; neither method is good
              </th>
            </tr>
            {cCells.map((c) => {
              const plan = productCPlan(c.country);
              return (
                <tr
                  key={`${c.country}${c.product}`}
                  tabIndex={0}
                  onClick={() => select(c)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select(c))}
                  data-testid={`scorecard-row-${c.country}-${c.product}`}
                  aria-current={isSelected(c) ? "true" : undefined}
                  className={cn(rowCls(c), "text-muted-foreground")}
                >
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{COUNTRY_NAME[c.country]}</span> · Product {c.product}
                  </td>
                  <td className="num px-3 py-2 text-right">{per100(c.baselineWape)} per 100</td>
                  <td className="num px-3 py-2 text-right">{per100(c.oursWape)} per 100</td>
                  <td className="px-3 py-2 text-xs">Not compared</td>
                  <td className="num px-3 py-2 text-right text-xs">
                    {biasShort(c.scores.rolling12.bias)} / {biasShort(c.scores.etsDamped.bias)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {plan ? (
                      <span title="Open PR/tender value for instruments × historical PR→PO conversion">
                        Pipeline-weighted: <span className="num font-medium text-foreground">{formatSgd(plan.expectedSgd, { compact: true })}</span>
                      </span>
                    ) : (
                      "Planned from pipeline"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Difference = seasonal − rolling, in error points; negative means the seasonal model is closer. Over/under: the rolling
        average {biasWords(h.baselineBias)} overall, the seasonal model {biasWords(h.oursBias)}. Product C is excluded from
        the headline: the rolling average is off by {per100(backtest.productC.baselineWape)} per 100 and the seasonal model by{" "}
        {per100(backtest.productC.oursWape)}.
        Pipeline-weighted = open PR/tender value for instruments × the country&apos;s historical PR→PO conversion.
      </p>
    </PanelFrame>
  );
}
