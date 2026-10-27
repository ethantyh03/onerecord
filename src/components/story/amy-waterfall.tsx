"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AMY_WATERFALL, waterfallTotals, type FixKind } from "./business-case";
import { NoteChip } from "./story-ui";

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
 * §6.7 waterfall: Amy's 18 days → ~4, one bar per fix.
 * The process-change slice (parallel approvals + SLA, no new software) is highlighted and annotated.
 */
export function AmyWaterfall() {
  const t = waterfallTotals();
  const pct = Math.round(t.processShare * 100);
  const bars: Bar[] = [];
  let running = t.beforeDays;
  bars.push({
    id: "start",
    label: "Amy's request today",
    short: "Today",
    low: 0,
    high: t.beforeDays,
    kind: "total",
    value: `${t.beforeDays} days`,
    tip: "App C: Amy's new item code took 18 calendar days, a bounced request and three approvers one at a time.",
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <figure className="rounded-xl border bg-card p-5 shadow-raised" aria-labelledby="amy-waterfall-title">
        <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p id="amy-waterfall-title" className="font-semibold text-foreground">
              Where Amy&apos;s 18 days go
            </p>
            <p className="text-sm text-muted-foreground">Calendar days, our breakdown of App C (illustrative)</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <NoteChip>Scenario from case brief, App C</NoteChip>
          </div>
        </figcaption>

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
            <span className="rounded-md border border-warn/50 bg-warn-soft px-2 py-1 text-center text-xs leading-tight font-semibold whitespace-nowrap text-warn-ink">
              ≈{pct}% of the saving
              <br />
              needs no new software
            </span>
          </div>
          <div className="relative grid items-end gap-2" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, height: CHART_H }}>
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
                          className="absolute inset-x-[14%] cursor-help rounded-[4px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          style={{
                            bottom: scale(b.low),
                            height: Math.max(3, scale(b.high - b.low)),
                            background: COLOR[b.kind],
                            boxShadow: b.kind === "process" ? "0 0 0 2px var(--card), 0 0 0 4px var(--warn)" : undefined,
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
                      className="absolute border-t border-dashed border-border-strong"
                      style={{ bottom: scale(b.kind === "total" ? b.high : b.low), left: "86%", width: "calc(28% + 0.5rem)" }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
            {bars.map((b) => (
              <span key={b.id} className="text-center text-[0.75rem] leading-tight text-muted-foreground">
                {b.kind === "total" ? <span className="font-semibold text-foreground">{b.short}</span> : shortLabel(b.id)}
              </span>
            ))}
          </div>
        </div>
      </figure>

      <div className="overflow-hidden rounded-xl border bg-card shadow-raised">
        <table className="w-full text-sm">
          <caption className="sr-only">Amy&apos;s 18 days, slice by slice, and what fixes each one</caption>
          <thead className="bg-muted/60 text-left text-[0.8125rem] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Where the time goes</th>
              <th className="px-3 py-2.5 text-right font-medium">Days</th>
              <th className="px-4 py-2.5 font-medium">Fix</th>
            </tr>
          </thead>
          <tbody>
            {AMY_WATERFALL.map((s) => (
              <tr key={s.id} className={cn("border-t align-top", s.kind === "process" && "bg-warn-soft/70")}>
                <td className="px-4 py-3 text-foreground">{s.label}</td>
                <td className="num px-3 py-3 text-right font-medium whitespace-nowrap text-foreground">
                  {s.beforeDays} → {s.afterDays}
                </td>
                <td className="px-4 py-3">
                  <span className="block text-foreground">{s.fix}</span>
                  <span className={cn("mt-1 inline-flex items-center gap-1.5 text-xs font-medium", s.kind === "process" ? "text-warn-ink" : "text-primary")}>
                    <span aria-hidden className="size-2 rounded-full" style={{ background: COLOR[s.kind] }} />
                    {s.kind === "process" ? "Process change, no new software" : "New form and workflow"}
                  </span>
                </td>
              </tr>
            ))}
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-4 py-3 text-foreground">Total</td>
              <td className="num px-3 py-3 text-right whitespace-nowrap text-foreground">
                {t.beforeDays} → ~{t.afterDays}
              </td>
              <td className="px-4 py-3 text-foreground">
                ≈3 business days.{" "}
                <span className="text-warn-ink">
                  {t.processSavedDays} of the {t.savedDays} days saved (≈{pct}%) need no new software.
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
      <span aria-hidden className="size-3 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}
