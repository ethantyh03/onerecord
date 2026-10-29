"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AMY_WATERFALL, waterfallTotals, type FixKind } from "./business-case";
import { Panel, T } from "./story-ui";

/** Grey = days elapsed; chart series 1 (teal) = saved by OneRecord's form and workflow; amber = saved by a process change alone. */
const COLOR: Record<FixKind | "total", string> = {
  total: "var(--chart-5)",
  tooling: "var(--chart-1)",
  process: "var(--chart-3)",
};

interface Bar {
  id: string;
  label: string;
  short: string;
  low: number;
  high: number;
  kind: FixKind | "total";
  value: string;
  tip: string;
}

const CHART_H = 260;

/**
 * §6.7 waterfall: one new item request, 18 days by email → ~4, one bar per fix.
 * The process-change slice (parallel approvals + SLA, no new software) is highlighted and annotated.
 */
export function AmyWaterfall() {
  const t = waterfallTotals();
  const pct = Math.round(t.processShare * 100);
  const bars: Bar[] = [];
  let running = t.beforeDays;
  bars.push({
    id: "start",
    label: "New item request by email today",
    short: "By email today",
    low: 0,
    high: t.beforeDays,
    kind: "total",
    value: `${t.beforeDays} days`,
    tip: "A new item code took 18 calendar days, a bounced request and three approvers one at a time.",
  });
  for (const s of AMY_WATERFALL) {
    const saved = s.beforeDays - s.afterDays;
    bars.push({
      id: s.id,
      label: s.label,
      short: s.label,
      low: running - saved,
      high: running,
      kind: s.kind,
      value: `−${saved} d`,
      tip: `${s.label}: ${s.beforeDays} → ${s.afterDays} days. Fix: ${s.fix}. ${s.kind === "process" ? "A policy change, no new software." : "Needs the new form and workflow."}`,
    });
    running -= saved;
  }
  bars.push({
    id: "end",
    label: "With OneRecord",
    short: "With OneRecord",
    low: 0,
    high: t.afterDays,
    kind: "total",
    value: `~${t.afterDays} days`,
    tip: "≈4 calendar days, about 3 business days: inside the ≤4-business-day target.",
  });

  const scale = (d: number) => (d / t.beforeDays) * CHART_H;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Panel
        as="figure"
        titleId="amy-waterfall-title"
        title="Where 18 days go: one new item request"
        description="Calendar days, illustrative breakdown"
        level={3}
        footer={
          <>
            Target: median ≤4 business days (≈6 calendar days) across all requests; this request comes in shorter because its approvals run in
            parallel.
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-secondary-foreground" aria-label="Legend">
          <LegendSwatch color={COLOR.total} label="Days elapsed" />
          <LegendSwatch color={COLOR.tooling} label="Saved by the new form and workflow" />
          <LegendSwatch color={COLOR.process} label="Saved by process change alone" />
        </div>

        <div className="relative pt-14">
          {/* annotation over the process-change bar */}
          <div
            className="pointer-events-none absolute top-0 flex justify-center"
            style={{ left: `${(3 / bars.length) * 100}%`, width: `${(1 / bars.length) * 100}%` }}
          >
            <span className="flex flex-col items-center text-center text-xs leading-tight font-semibold whitespace-nowrap text-warn-ink">
              <span>
                ≈{pct}% of the saving
                <br />
                needs no new software
              </span>
              <span aria-hidden className="mt-1 h-3 w-px bg-warn/70" />
            </span>
          </div>
          <div className="relative grid items-end gap-2" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, height: CHART_H }}>
            {/* quarter gridlines */}
            {[0.25, 0.5, 0.75].map((f) => (
              <span key={f} aria-hidden className="absolute inset-x-0 h-px bg-border/70" style={{ bottom: f * CHART_H }} />
            ))}
            {/* baseline */}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-border-strong" />
            {bars.map((b, i) => {
              const next = bars[i + 1];
              return (
                <div key={b.id} className="relative h-full">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={`${b.label}: ${b.value}`}
                          className="absolute inset-x-[14%] cursor-help rounded-[2px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          style={{
                            bottom: scale(b.low),
                            height: Math.max(3, scale(b.high - b.low)),
                            background: COLOR[b.kind],
                          }}
                        />
                      }
                    />
                    <TooltipContent className="block max-w-xs px-3 py-2 text-left text-[0.8125rem] leading-snug">{b.tip}</TooltipContent>
                  </Tooltip>
                  <span
                    className={cn(
                      "num pointer-events-none absolute inset-x-0 text-center text-sm font-semibold",
                      b.kind === "total" ? "text-foreground" : "text-secondary-foreground",
                    )}
                    style={{ bottom: scale(b.high) + 6 }}
                  >
                    {b.value}
                  </span>
                  {next && next.kind !== "total" ? (
                    <span
                      aria-hidden
                      className="absolute border-t border-dashed border-subtle/60"
                      style={{ bottom: scale(b.kind === "total" ? b.high : b.low), left: "86%", width: "calc(28% + 0.5rem)" }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
            {bars.map((b) => (
              <span key={b.id} className="text-center text-xs leading-tight text-muted-foreground">
                {b.kind === "total" ? <span className="font-semibold text-foreground">{b.short}</span> : shortLabel(b.id)}
              </span>
            ))}
          </div>
        </div>
      </Panel>

      <Panel titleId="amy-slices-title" title="The 18 days, slice by slice, and what fixes each one" level={3} flush>
        <table className={T.table} aria-labelledby="amy-slices-title">
          <thead>
            <tr className={T.headRow}>
              <th className={T.head}>Where the time goes</th>
              <th className={cn(T.head, "px-3 text-right")}>Days</th>
              <th className={T.head}>Fix</th>
            </tr>
          </thead>
          <tbody>
            {AMY_WATERFALL.map((s) => (
              <tr key={s.id} className={T.row}>
                <td className={cn(T.cell, "py-3 text-foreground")}>
                  {s.label}
                </td>
                <td className={cn(T.cell, "num px-3 py-3 text-right font-medium whitespace-nowrap text-foreground")}>
                  {s.beforeDays} → {s.afterDays}
                </td>
                <td className={cn(T.cell, "py-3")}>
                  <span className="block text-foreground">{s.fix}</span>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1.5 text-xs font-medium",
                      s.kind === "process" ? "text-warn-ink" : "text-secondary-foreground",
                    )}
                  >
                    <span aria-hidden className="size-2 rounded-[1px]" style={{ background: COLOR[s.kind] }} />
                    {s.kind === "process" ? "Process change, no new software" : "New form and workflow"}
                  </span>
                </td>
              </tr>
            ))}
            <tr className="border-t border-border-strong font-semibold">
              <td className={cn(T.cell, "py-3 text-foreground")}>Total</td>
              <td className={cn(T.cell, "num px-3 py-3 text-right whitespace-nowrap text-foreground")}>
                {t.beforeDays} → ~{t.afterDays}
              </td>
              <td className={cn(T.cell, "py-3 text-foreground")}>
                ≈3 business days.{" "}
                <span className="text-warn-ink">
                  {t.processSavedDays} of the {t.savedDays} days saved (≈{pct}%) need no new software.
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function shortLabel(id: string): string {
  switch (id) {
    case "notice":
      return "Email not noticed";
    case "bounce":
      return "Bounced, missing QA/RA";
    case "sequential":
      return "Approvers one at a time";
    case "keying":
      return "Keyed into SAP by hand";
    default:
      return id;
  }
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-[1px]" style={{ background: color }} />
      {label}
    </span>
  );
}
