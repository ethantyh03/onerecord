"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSgd } from "@/components/common";
import { usePulse } from "@/components/pulse/core/PulseContext";
import { backtest, backtestCell, type MethodId } from "@/data/contract";
import type { CountryCode, ProductGroup } from "@/lib/types";
import {
  COUNTRY_CODES,
  COUNTRY_NAME,
  PRODUCT_SHORT,
  PRODUCTS,
  PanelFrame,
  PlainLine,
  Segmented,
  Swatch,
  TipBox,
  TipRow,
  VIZ,
  biasWords,
  compactNumber,
  monthLong,
  monthShort,
  per100,
  units,
} from "./shared";
import { productCPlan } from "./productC";

type Row = {
  month: string;
  actual?: number;
  r6?: number;
  r12?: number;
  ets?: number;
  p50?: number;
  band?: [number, number];
};

const STEP_MS = 850;

const SERIES: { key: "r6" | "r12" | "ets"; method: MethodId; label: string; color: string; width: number }[] = [
  { key: "r6", method: "rolling6", label: "Rolling 6-month average", color: VIZ.context, width: 1.5 },
  { key: "r12", method: "rolling12", label: "Rolling 12-month average (today's method)", color: VIZ.today, width: 2 },
  { key: "ets", method: "etsDamped", label: "Seasonal ETS (ours)", color: VIZ.ours, width: 2.5 },
];

function h1(points: { h: number; value: number }[] | undefined): number | undefined {
  return points?.find((p) => p.h === 1)?.value;
}

/** Component 6: forecast chart for the selected country × product, with a replay of the backtest origins. */
export function ForecastPanel() {
  const { country, setCountry, product, setProduct } = usePulse();
  const cell = backtestCell(country, product);
  const origins = useMemo(() => cell?.origins ?? [], [cell]);
  const total = origins.length;

  // step = number of origins revealed (0..total). Default: everything shown.
  const [step, setStep] = useState<number>(total);
  const [playing, setPlaying] = useState(false);
  const [range, setRange] = useState<"all" | "recent">("all");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };

  // Changing the cell shows the finished replay for the new cell.
  const cellKey = `${country}-${product}`;
  const [shownKey, setShownKey] = useState(cellKey);
  if (shownKey !== cellKey) {
    setShownKey(cellKey);
    setStep(total);
  }

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  }, [cellKey]);

  const replay = () => {
    if (playing) {
      stop();
      return;
    }
    if (timer.current) clearInterval(timer.current);
    let k = 0;
    setStep(0);
    setPlaying(true);
    timer.current = setInterval(() => {
      k += 1;
      setStep(k);
      if (k >= total) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setPlaying(false);
      }
    }, STEP_MS);
  };

  const isC = product === "C";

  const rows: Row[] = useMemo(() => {
    if (!cell) return [];
    const byMonth = new Map<string, Row>();
    for (const a of cell.actuals) byMonth.set(a.month, { month: a.month, actual: a.value });
    origins.slice(0, step).forEach((o) => {
      const r6 = o.forecasts.rolling6?.find((p) => p.h === 1);
      const month = r6?.month ?? o.forecasts.etsDamped?.find((p) => p.h === 1)?.month;
      if (!month) return;
      const row = byMonth.get(month) ?? { month };
      row.r6 = h1(o.forecasts.rolling6);
      row.r12 = h1(o.forecasts.rolling12);
      row.ets = h1(o.forecasts.etsDamped);
      byMonth.set(month, row);
    });
    if (!isC && step >= total) {
      const last = cell.actuals[cell.actuals.length - 1];
      if (last) {
        const lr = byMonth.get(last.month);
        if (lr) {
          lr.p50 = last.value;
          lr.band = [last.value, last.value];
        }
      }
      for (const p of cell.next3) {
        byMonth.set(p.month, { month: p.month, p50: p.p50, band: [p.p10, p.p90] });
      }
    }
    const list = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
    if (isC || step < total) {
      // Keep the x-axis stable during replay: reserve the forecast months.
      for (const m of backtest.forecastMonths) if (!list.some((r) => r.month === m)) list.push({ month: m });
    }
    return range === "recent" ? list.slice(-18) : list;
  }, [cell, origins, step, total, isC, range]);

  const current = step > 0 ? origins[step - 1] : undefined;
  const currentTarget = current?.forecasts.etsDamped?.find((p) => p.h === 1)?.month;
  const currentActual = cell?.actuals.find((a) => a.month === currentTarget)?.value;

  const baseW = cell?.scores.rolling12.wape ?? 0;
  const oursW = cell?.scores.etsDamped.wape ?? 0;
  const oursWins = cell ? cell.oursBeatsBaseline : false;
  const plan = isC ? productCPlan(country) : null;
  const firstForecast = backtest.forecastMonths[0];
  const lastForecast = backtest.forecastMonths[backtest.forecastMonths.length - 1];

  const controls = (
    <>
      <Segmented<CountryCode>
        label="Country"
        value={country}
        onChange={setCountry}
        testIdPrefix="forecast-country"
        options={COUNTRY_CODES.map((c) => ({ value: c, label: c, title: COUNTRY_NAME[c] }))}
      />
      <Segmented<ProductGroup>
        label="Product"
        value={product}
        onChange={setProduct}
        testIdPrefix="forecast-product"
        options={PRODUCTS.map((p) => ({ value: p, label: `Product ${p}`, title: PRODUCT_SHORT[p] }))}
      />
    </>
  );

  return (
    <PanelFrame
      testId="forecast-panel"
      title={`Forecast check · ${COUNTRY_NAME[country]} × Product ${product}`}
      subtitle={
        <>
          36 months of confirmed orders (units). At six points in 2026 we pretended it was that month, forecast the next
          month using only data up to then, and compared each method with what really happened.
        </>
      }
      actions={controls}
    >
      {!cell ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No backtest is available for this cell.</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
                <li className="flex items-center gap-1.5">
                  <Swatch color={VIZ.ink} />
                  Actual orders
                </li>
                {SERIES.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </li>
                ))}
                {!isC ? (
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden className="inline-block h-2.5 w-3.5 rounded-[3px] opacity-25" style={{ background: VIZ.ours }} />
                    Likely range, P10–P90
                  </li>
                ) : null}
              </ul>
              <div className="flex items-center gap-2">
                <Segmented<"all" | "recent">
                  label="Time range"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "all", label: "36 months" },
                    { value: "recent", label: "Last 18" },
                  ]}
                />
                <Button
                  size="sm"
                  variant={playing ? "outline" : "default"}
                  onClick={replay}
                  data-testid="forecast-replay"
                  aria-label={playing ? "Pause replay" : "Replay the backtest"}
                >
                  {playing ? <Pause /> : step >= total ? <RotateCcw /> : <Play />}
                  {playing ? "Pause" : "Replay"}
                </Button>
              </div>
            </div>

            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 22, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} stroke={VIZ.grid} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthShort}
                    interval={range === "all" ? 2 : 1}
                    tick={{ fontSize: 11, fill: VIZ.muted }}
                    tickLine={false}
                    axisLine={{ stroke: VIZ.axis }}
                    minTickGap={8}
                  />
                  <YAxis
                    tickFormatter={compactNumber}
                    tick={{ fontSize: 11, fill: VIZ.muted }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  {firstForecast && lastForecast ? (
                    <ReferenceArea
                      x1={firstForecast}
                      x2={lastForecast}
                      fill={VIZ.ours}
                      fillOpacity={0.05}
                      stroke="none"
                      label={{ value: "Next 3 months", position: "insideTop", fontSize: 11, fill: VIZ.muted }}
                    />
                  ) : null}
                  {current ? (
                    <ReferenceLine
                      x={current.origin}
                      stroke={VIZ.muted}
                      strokeWidth={1}
                      label={{
                        value: `Data up to ${monthShort(current.origin)}`,
                        position: "top",
                        fontSize: 11,
                        fill: VIZ.muted,
                      }}
                    />
                  ) : null}
                  {!isC ? (
                    <Area
                      dataKey="band"
                      stroke="none"
                      fill={VIZ.ours}
                      fillOpacity={0.18}
                      isAnimationActive={false}
                      connectNulls={false}
                      name="Likely range"
                    />
                  ) : null}
                  <Line
                    dataKey="actual"
                    stroke={VIZ.ink}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="Actual orders"
                  />
                  {!isC ? (
                    <Line
                      dataKey="p50"
                      stroke={VIZ.ours}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 3, fill: VIZ.ours, stroke: VIZ.surface, strokeWidth: 2 }}
                      isAnimationActive={false}
                      name="ETS forecast"
                    />
                  ) : null}
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={s.width}
                      connectNulls
                      dot={{ r: s.key === "ets" ? 4.5 : 4, fill: s.color, stroke: VIZ.surface, strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: VIZ.surface, strokeWidth: 2 }}
                      isAnimationActive={false}
                      name={s.label}
                    />
                  ))}
                  <Tooltip
                    cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const r = payload[0]?.payload as Row | undefined;
                      if (!r) return null;
                      return (
                        <TipBox title={monthLong(String(label ?? r.month))}>
                          {r.actual != null ? <TipRow color={VIZ.ink} label="Actual" value={units(r.actual)} /> : null}
                          {SERIES.map((s) =>
                            r[s.key] != null ? (
                              <TipRow
                                key={s.key}
                                color={s.color}
                                label={s.key === "ets" ? "Ours (ETS)" : s.key === "r12" ? "Today's (rolling 12)" : "Rolling 6"}
                                value={units(r[s.key] as number)}
                              />
                            ) : null,
                          )}
                          {r.band && r.actual == null ? (
                            <>
                              <TipRow color={VIZ.ours} dashed label="ETS forecast" value={units(r.p50 ?? 0)} />
                              <TipRow label="Likely range" value={`${units(r.band[0])}–${units(r.band[1])}`} />
                            </>
                          ) : null}
                        </TipBox>
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <p aria-live="polite" className="mt-2 min-h-5 text-[0.8125rem] text-muted-foreground">
              {current && currentTarget ? (
                <>
                  Forecast made with data up to <span className="font-medium text-foreground">{monthLong(current.origin)}</span>{" "}
                  for {monthLong(currentTarget)}
                  {currentActual != null ? (
                    <>
                      : actual {units(currentActual)}, today&apos;s method {units(h1(current.forecasts.rolling12) ?? 0)}, ours{" "}
                      {units(h1(current.forecasts.etsDamped) ?? 0)}.
                    </>
                  ) : (
                    "."
                  )}{" "}
                  Step {step} of {total}.
                </>
              ) : (
                "Press Replay to step through the six forecast dates."
              )}
            </p>
          </div>

          <aside className="space-y-4 xl:border-l xl:pl-5">
            {isC ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-3">
                  <p className="flex items-start gap-2 text-sm font-medium text-warn-ink">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Neither method is good for instruments.
                  </p>
                  <p className="mt-1.5 text-[0.8125rem] leading-snug text-secondary-foreground">{backtest.productC.note}</p>
                </div>
                <PlainLine>
                  In this cell today&apos;s method is off by <strong className="num">{per100(baseW)}</strong> units per 100
                  ordered; ours by <strong className="num">{per100(oursW)}</strong>. Shown so you can see it, not used.
                </PlainLine>
                {plan ? (
                  <div className="rounded-lg border bg-muted/40 px-3.5 py-3">
                    <div className="text-xs font-medium text-muted-foreground">Planned from the tender pipeline instead</div>
                    <div className="num mt-1 text-2xl font-semibold tracking-[-0.02em]">{formatSgd(plan.expectedSgd, { compact: true })}</div>
                    <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
                      Open PR/tender value for instruments ({formatSgd(plan.pipelineCSgd, { compact: true })}) × historical
                      PR→PO conversion in {COUNTRY_NAME[country]} ({Math.round(plan.conversion * 100)}%). Pipeline-weighted, not
                      a time-series model. C&apos;s share of the open pipeline is assumed equal to its share of 12-month orders (
                      {Math.round(plan.cShare * 100)}%).
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">In this cell</div>
                  <PlainLine className="mt-1">
                    Today&apos;s method is off by <strong className="num text-foreground">{per100(baseW)}</strong> units per 100
                    ordered; ours by <strong className="num text-foreground">{per100(oursW)}</strong>.
                  </PlainLine>
                  <p
                    className={
                      oursWins
                        ? "mt-1.5 text-[0.8125rem] font-medium text-ok-ink"
                        : "mt-1.5 text-[0.8125rem] font-medium text-warn-ink"
                    }
                  >
                    {oursWins
                      ? "Ours is closer here."
                      : "Today's method is closer here. This is one of the cells we lose, and it stays on the scorecard."}
                  </p>
                  <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
                    Today&apos;s method {biasWords(cell.scores.rolling12.bias)}; ours {biasWords(cell.scores.etsDamped.bias)}.
                  </p>
                </div>
                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-muted-foreground">Next 3 months (ours, with likely range)</div>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {cell.next3.map((p) => (
                      <li key={p.month} className="flex items-baseline justify-between gap-3">
                        <span className="text-muted-foreground">{monthLong(p.month)}</span>
                        <span className="num">
                          <span className="font-semibold">{units(p.p50)}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            ({units(p.p10)}–{units(p.p90)})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Range = P10–P90 from the backtest errors. Planners can hold safety stock at the top of the range.
                  </p>
                </div>
                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-muted-foreground">Across Products A and B, all countries</div>
                  <PlainLine className="mt-1 text-sm">
                    {backtest.headline.plainBaseline}. {backtest.headline.plainOurs}.
                  </PlainLine>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </PanelFrame>
  );
}
