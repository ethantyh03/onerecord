"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSgd } from "@/components/common";
import { usePulse, type PulseView } from "@/components/pulse/core/PulseContext";
import { bridge, type BridgeKey, type BridgeStep } from "@/data/contract";
import type { CountryCode } from "@/lib/types";
import { COUNTRY_CODES, COUNTRY_NAME, PanelFrame, PlainLine, Segmented, Swatch, TipBox, TipRow, VIZ, compactNumber } from "./shared";

const SHORT: Record<BridgeKey, string> = {
  prior: "Prior 12M",
  new: "New",
  expanding: "Expanding",
  declining: "Declining",
  lost: "Lost",
  current: "Current 12M",
};

type Row = {
  key: BridgeKey;
  name: string;
  label: string;
  base: number;
  value: number;
  signed: number;
  customers: number;
  color: string;
  display: string;
};

function colorFor(key: BridgeKey): string {
  if (key === "prior" || key === "current") return VIZ.total;
  if (key === "new" || key === "expanding") return VIZ.gain;
  return VIZ.loss;
}

function toRows(steps: BridgeStep[]): Row[] {
  let running = 0;
  return steps.map((s) => {
    const isTotal = s.key === "prior" || s.key === "current";
    let base: number;
    let value: number;
    if (isTotal) {
      base = 0;
      value = s.sgd;
      running = s.sgd;
    } else if (s.sgd >= 0) {
      base = running;
      value = s.sgd;
      running += s.sgd;
    } else {
      running += s.sgd;
      base = running;
      value = -s.sgd;
    }
    const money = formatSgd(Math.abs(s.sgd), { compact: true });
    return {
      key: s.key,
      name: SHORT[s.key],
      label: s.label,
      base,
      value,
      signed: s.sgd,
      customers: s.customers,
      color: colorFor(s.key),
      display: isTotal ? money : `${s.sgd >= 0 ? "+" : "−"}${money}`,
    };
  });
}

function stepOf(steps: BridgeStep[], key: BridgeKey): BridgeStep | undefined {
  return steps.find((s) => s.key === key);
}

/** Component 9a: growth bridge per country, driven by the raw / merged toggle. */
export function GrowthBridge() {
  const { country, setCountry, view, setView } = usePulse();
  const cb = bridge.countries.find((c) => c.country === country);
  const steps = useMemo(() => (cb ? (view === "merged" ? cb.dedup : cb.raw) : []), [cb, view]);
  const rows = useMemo(() => toRows(steps), [steps]);

  const prior = stepOf(steps, "prior")?.sgd ?? 0;
  const current = stepOf(steps, "current")?.sgd ?? 0;
  const growth = prior > 0 ? current / prior - 1 : null;

  const rawNew = cb ? stepOf(cb.raw, "new")?.customers ?? 0 : 0;
  const rawLost = cb ? stepOf(cb.raw, "lost")?.customers ?? 0 : 0;
  const dNew = cb ? stepOf(cb.dedup, "new")?.customers ?? 0 : 0;
  const dLost = cb ? stepOf(cb.dedup, "lost")?.customers ?? 0 : 0;
  const phantom = rawNew - dNew + (rawLost - dLost);
  const rawNewSgd = cb ? stepOf(cb.raw, "new")?.sgd ?? 0 : 0;
  const dNewSgd = cb ? stepOf(cb.dedup, "new")?.sgd ?? 0 : 0;

  return (
    <PanelFrame
      testId="growth-bridge"
      title={`Where growth came from · ${COUNTRY_NAME[country]}`}
      subtitle={bridge.definition}
      actions={
        <>
          <Segmented<CountryCode>
            label="Country"
            value={country}
            onChange={setCountry}
            testIdPrefix="bridge-country"
            options={COUNTRY_CODES.map((c) => ({ value: c, label: c, title: COUNTRY_NAME[c] }))}
          />
          <Segmented<PulseView>
            label="Customer view"
            value={view}
            onChange={setView}
            testIdPrefix="bridge-view"
            options={[
              { value: "merged", label: "Merged customers" },
              { value: "raw", label: "Raw SAP records" },
            ]}
          />
        </>
      }
    >
      {!cb ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No bridge data for this country.</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
              <li className="flex items-center gap-1.5">
                <Swatch kind="block" color={VIZ.total} />
                12-month total
              </li>
              <li className="flex items-center gap-1.5">
                <Swatch kind="block" color={VIZ.gain} />
                Added
              </li>
              <li className="flex items-center gap-1.5">
                <Swatch kind="block" color={VIZ.loss} />
                Taken away
              </li>
            </ul>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 4, left: 4 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke={VIZ.grid} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: VIZ.axis }}
                    height={40}
                    tick={({ x, y, payload, index }: { x: number | string; y: number | string; payload: { value: string }; index: number }) => (
                      <g transform={`translate(${x},${y})`}>
                        <text textAnchor="middle" dy={12} fontSize={12} fill="var(--foreground)">
                          {payload.value}
                        </text>
                        <text textAnchor="middle" dy={27} fontSize={11} fill="var(--muted-foreground)">
                          {rows[index] ? `${rows[index].customers} customers` : ""}
                        </text>
                      </g>
                    )}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `S$${compactNumber(v)}`}
                    tick={{ fontSize: 11, fill: VIZ.muted }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      const r = payload?.[0]?.payload as Row | undefined;
                      if (!active || !r) return null;
                      return (
                        <TipBox title={r.label}>
                          <TipRow color={r.color} label="Value" value={r.display} />
                          <TipRow label="Customers" value={r.customers} />
                        </TipBox>
                      );
                    }}
                  />
                  <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {rows.map((r) => (
                      <Cell key={r.key} fill={r.color} />
                    ))}
                    <LabelList dataKey="display" position="top" fontSize={11.5} fill="var(--foreground)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <aside className="space-y-3 xl:border-l xl:pl-5">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                12-month growth, {view === "merged" ? "merged customers" : "raw SAP records"}
              </div>
              <div className="num mt-1 text-[1.75rem] leading-none font-semibold tracking-[-0.02em]">
                {growth == null ? "—" : `${growth >= 0 ? "+" : "−"}${Math.abs(growth * 100).toFixed(1)}%`}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatSgd(prior, { compact: true })} → {formatSgd(current, { compact: true })}
              </p>
            </div>
            {phantom > 0 ? (
              <PlainLine className="text-sm">
                {view === "raw" ? (
                  <>
                    The raw records count <strong className="num">{rawNew}</strong> new and <strong className="num">{rawLost}</strong>{" "}
                    lost customers. Merge duplicates and <strong className="num">{phantom}</strong> of those turn out to be the
                    same hospitals under a second record.
                  </>
                ) : (
                  <>
                    Merged, <strong className="num">{phantom}</strong> &ldquo;new&rdquo; or &ldquo;lost&rdquo; customers
                    disappear: they were existing hospitals under a second record. New-customer value falls from{" "}
                    {formatSgd(rawNewSgd, { compact: true })} to {formatSgd(dNewSgd, { compact: true })}.
                  </>
                )}
              </PlainLine>
            ) : (
              <PlainLine className="text-sm">Merging duplicates does not change who is new or lost in this country.</PlainLine>
            )}
            {cb.example ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="text-xs font-medium text-muted-foreground">{cb.example.title}</div>
                <p className="mt-1 text-[0.8125rem] leading-snug text-secondary-foreground">
                  {view === "merged" ? cb.example.dedupStory : cb.example.rawStory}
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </PanelFrame>
  );
}
