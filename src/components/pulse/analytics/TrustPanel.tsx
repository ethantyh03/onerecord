"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, X } from "lucide-react";
import { cleanXMethod, matcherEval, stress, triageEval } from "@/data/contract";
import type { MessageKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MATCHER_CAVEAT } from "./caveats";
import { COUNTRY_NAME, PanelFrame, PlainLine, TipBox, TipRow, VIZ, per100, signedPts } from "./shared";

const KIND_LABEL: Record<MessageKind, string> = {
  po: "Order (PO)",
  pr: "Request (PR)",
  enquiry: "Enquiry",
  followup: "Follow-up",
  mdm: "MDM setup",
};

/** One name for our model across the page: "Seasonal model (ours)", ETS only in tooltips. */
function plainModel(s: string): string {
  return s.replace(/\b(?:[Dd]amped |[Ss]easonal )?(?:Holt-Winters )?ETS\b/g, (_m: string, offset: number) =>
    offset === 0 ? "Seasonal model" : "seasonal model",
  );
}

function SubHead({ n, title, children }: { n: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 space-y-0.5">
      <h3 className="flex items-baseline gap-2 text-[0.9375rem] font-semibold">
        <span className="text-xs font-medium text-muted-foreground">{n}</span>
        {title}
      </h3>
      {children ? <p className="text-[0.8125rem] text-muted-foreground">{children}</p> : null}
    </div>
  );
}

function BigStat({ value, label, caption }: { value: ReactNode; label: string; caption: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-[1.75rem] leading-none font-semibold tracking-[-0.02em]">{value}</div>
      <p className="mt-1.5 text-[0.8125rem] leading-snug text-secondary-foreground">{caption}</p>
    </div>
  );
}

function MatcherSection() {
  const m = matcherEval;
  const hm = m.heldOutMetrics;
  const curve = [...m.prCurve].sort((a, b) => a.recall - b.recall);
  const chosen = m.prCurve.reduce((best, p) =>
    Math.abs(p.threshold - m.threshold) < Math.abs(best.threshold - m.threshold) ? p : best,
  m.prCurve[0]);
  const heldNames = m.heldOut.map((c) => COUNTRY_NAME[c]).join(", ");
  const tunedNames = m.tunedOn.map((c) => COUNTRY_NAME[c]).join(" and ");

  return (
    <div>
      <SubHead n="1" title="Duplicate finder, tested on countries it never saw">
        Threshold tuned on {tunedNames}, then frozen and tested on {heldNames}. The test duplicates include typos, word
        swaps and romanisation variants the name cleaner was never written for.
      </SubHead>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-3">
          <BigStat value={<span className="num">{Math.round(hm.precision * 100)} of 100</span>} label="Precision" caption={`${m.plain.precision}.`} />
          <BigStat value={<span className="num">{Math.round(hm.recall * 100)} of 100</span>} label="Recall" caption={`${m.plain.recall}.`} />
          <p className="text-xs text-muted-foreground">
            Balance of the two (F1) {hm.f1.toFixed(2)} · {hm.tp} found, {hm.fp} false alarm{hm.fp === 1 ? "" : "s"}, {hm.fn}{" "}
            missed, out of {hm.pairsScored.toLocaleString("en-SG")} candidate pairs ({hm.truePairs} real duplicates). A perfect
            score would be a warning sign; we expect 0.80–0.97.
          </p>
        </div>

        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">Trade-off: catch more, or warn less</div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 12, right: 14, bottom: 18, left: 0 }}>
                <CartesianGrid stroke={VIZ.grid} />
                <XAxis
                  dataKey="recall"
                  type="number"
                  domain={[0.4, 1]}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}`}
                  tick={{ fontSize: 11, fill: VIZ.muted }}
                  tickLine={false}
                  axisLine={{ stroke: VIZ.axis }}
                  label={{ value: "Real duplicates caught (per 100)", position: "insideBottom", offset: -10, fontSize: 11, fill: VIZ.muted }}
                />
                <YAxis
                  dataKey="precision"
                  type="number"
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}`}
                  tick={{ fontSize: 11, fill: VIZ.muted }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  label={{
                    value: "Warnings that are real (per 100)",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    dy: 70,
                    fontSize: 11,
                    fill: VIZ.muted,
                  }}
                />
                <Line
                  dataKey="precision"
                  stroke={VIZ.ours}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: VIZ.ours, stroke: VIZ.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <ReferenceDot
                  x={chosen.recall}
                  y={chosen.precision}
                  r={7}
                  fill={VIZ.surface}
                  stroke={VIZ.ink}
                  strokeWidth={2}
                  label={{ value: `Chosen: ${m.threshold}`, position: "left", fontSize: 11, fill: VIZ.ink }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as { threshold: number; precision: number; recall: number } | undefined;
                    if (!active || !p) return null;
                    return (
                      <TipBox title={`Match score ≥ ${p.threshold.toFixed(2)}`}>
                        <TipRow label="Warnings that are real" value={`${Math.round(p.precision * 100)} of 100`} />
                        <TipRow label="Duplicates caught" value={`${Math.round(p.recall * 100)} of 100`} />
                      </TipBox>
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Duplicates caught, by kind of difference</div>
            {m.perPerturbation.map((p) => (
              <div key={p.type} className="grid grid-cols-[minmax(0,1fr)_88px_44px] items-center gap-2 text-xs">
                <span className="truncate text-secondary-foreground" title={p.label}>
                  {p.label}
                </span>
                <span className="h-2 rounded-[3px] bg-muted" aria-hidden>
                  <span className="block h-2 rounded-[3px]" style={{ width: `${p.recall * 100}%`, background: VIZ.ours }} />
                </span>
                <span className="num text-right text-muted-foreground">
                  {Math.round(p.recall * p.n)}/{p.n}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="rounded-lg border border-warn/50 bg-warn-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-warn-ink" data-testid="trust-matcher-caveat">
            {MATCHER_CAVEAT}
          </p>
          <div className="text-xs font-medium text-muted-foreground">Where it goes wrong, and why</div>
          {m.examples.slice(0, 3).map((e, i) => (
            <div key={i} className="rounded-lg border px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-medium",
                    e.kind === "missed" ? "bg-warn-soft text-warn-ink" : "bg-stuck-soft text-stuck-ink",
                  )}
                >
                  {e.kind === "missed" ? "Missed duplicate" : "False alarm"}
                </span>
                <span className="num text-xs text-muted-foreground">score {e.score.toFixed(2)}</span>
              </div>
              <div className="mt-1.5 text-[0.8125rem] leading-snug">
                <span className="font-medium">{e.a.cardName}</span>
                <span className="text-muted-foreground"> vs </span>
                <span className="font-medium">{e.b.cardName}</span>
                <span className="text-muted-foreground"> · {COUNTRY_NAME[e.a.country]}</span>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{e.why}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StressSection() {
  return (
    <div>
      <SubHead n="2" title={stress.title}>
        Same pipeline, three versions of the data. If the seasonal method only won by luck, it would also &ldquo;win&rdquo; on
        data with no seasons in it.
      </SubHead>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Data</th>
              <th className="px-3 py-2 text-right font-medium">Today&apos;s</th>
              <th className="px-3 py-2 text-right font-medium">Ours</th>
              <th className="px-3 py-2 text-right font-medium">Our lead</th>
              <th className="px-3 py-2 text-left font-medium">Expected</th>
            </tr>
          </thead>
          <tbody>
            {stress.scenarios.map((s) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                </td>
                <td className="num px-3 py-2 text-right">{per100(s.baselineWape)}</td>
                <td className="num px-3 py-2 text-right">{per100(s.oursWape)}</td>
                <td className="num px-3 py-2 text-right font-medium">{signedPts(s.advantagePts)}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={cn("inline-flex items-center gap-1 font-medium", s.passed ? "text-ok-ink" : "text-stuck-ink")}>
                    {s.passed ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                    {s.passed ? "As expected" : "Not as expected"}
                  </span>
                  <div className="text-muted-foreground">{s.expected}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Errors are units off per 100 ordered: Products A and B, all five countries, merged customers, the same six forecast
        dates as the scorecard.
      </p>
      <PlainLine className="mt-2 text-sm">{stress.verdict}</PlainLine>
    </div>
  );
}

function CleanXMethodSection() {
  const c = cleanXMethod;
  const cell = (row: "raw" | "golden", col: "rolling" | "ours") => {
    const v = c.table[row][col];
    const highlight = row === "golden" && col === "ours";
    const today = row === "raw" && col === "rolling";
    return (
      <div
        className={cn(
          "rounded-lg border px-3 py-3",
          highlight && "border-primary/50 bg-primary-soft",
          today && "bg-muted/40",
        )}
      >
        <div className="num text-2xl leading-none font-semibold tracking-[-0.02em]">{per100(v)}</div>
        <div className="mt-1 text-xs text-muted-foreground">per 100 ordered</div>
        {today ? <div className="mt-1.5 text-[0.6875rem] font-medium text-secondary-foreground">Today</div> : null}
        {highlight ? <div className="mt-1.5 text-[0.6875rem] font-medium text-primary">With OneRecord</div> : null}
      </div>
    );
  };
  return (
    <div>
      <SubHead n="3" title="How much comes from clean data, how much from the model">
        Forecast error on the series that duplicates and mis-coding distort.
      </SubHead>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-sm">
        <div />
        <div className="px-1 text-xs font-medium text-muted-foreground">{plainModel(c.colLabels.rolling)}</div>
        <div className="px-1 text-xs font-medium text-muted-foreground">{plainModel(c.colLabels.ours)}</div>
        <div className="flex max-w-36 items-center pr-1 text-xs font-medium text-muted-foreground">{c.rowLabels.raw}</div>
        {cell("raw", "rolling")}
        {cell("raw", "ours")}
        <div className="flex max-w-36 items-center pr-1 text-xs font-medium text-muted-foreground">{c.rowLabels.golden}</div>
        {cell("golden", "rolling")}
        {cell("golden", "ours")}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border px-2.5 py-1">
          From cleaning: <span className="num font-semibold">{c.fromCleaningPts.toFixed(1)} pts</span>
        </span>
        <span className="rounded-full border px-2.5 py-1">
          From the model: <span className="num font-semibold">{c.fromModellingPts.toFixed(1)} pts</span>
        </span>
        <span className="rounded-full border px-2.5 py-1">
          Total: <span className="num font-semibold">{c.totalImprovementPts.toFixed(1)} pts</span>
        </span>
      </div>
      <PlainLine className="mt-2 text-sm">{plainModel(c.sentence)}</PlainLine>
    </div>
  );
}

function TriageSection() {
  const t = triageEval;
  const max = Math.max(1, ...t.confusion.flat());
  const correct = Math.round(t.accuracy * 100);
  return (
    <div>
      <SubHead n="4" title="Inbox triage rules, tested honestly">
        Tested on {t.testSetSize} messages written independently of the rules and never used to tune them.
      </SubHead>
      <p className="-mt-1.5 mb-3 max-w-[100ch] text-xs text-muted-foreground">{t.testSet}</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[440px] border-separate border-spacing-[3px] text-xs" aria-label="Confusion matrix: rows are the true stream, columns are what the rules chose">
            <thead>
              <tr>
                <th className="pb-1 text-left font-medium text-muted-foreground">Actually ↓ · Rules said →</th>
                {t.labels.map((l) => (
                  <th key={l} className="px-1 pb-1 text-center font-medium text-muted-foreground">
                    {KIND_LABEL[l]}
                  </th>
                ))}
                <th className="px-1 pb-1 text-right font-medium text-muted-foreground">Right</th>
              </tr>
            </thead>
            <tbody>
              {t.confusion.map((row, i) => {
                const n = row.reduce((a, b) => a + b, 0);
                return (
                  <tr key={t.labels[i]}>
                    <th className="pr-2 text-left font-medium whitespace-nowrap text-secondary-foreground">{KIND_LABEL[t.labels[i]]}</th>
                    {row.map((v, j) => {
                      const share = v / max;
                      const diag = i === j;
                      return (
                        <td
                          key={j}
                          title={`${v} ${KIND_LABEL[t.labels[i]]} messages sorted as ${KIND_LABEL[t.labels[j]]}`}
                          className={cn(
                            "num h-9 min-w-12 rounded-[4px] text-center text-[0.8125rem] font-medium",
                            diag && "ring-2 ring-foreground/70 ring-inset",
                          )}
                          style={{
                            background: v === 0 ? "var(--muted)" : `color-mix(in oklch, var(--chart-1) ${Math.round(12 + share * 78)}%, var(--card))`,
                            color: share > 0.55 ? "var(--primary-foreground)" : "var(--foreground)",
                          }}
                        >
                          {v}
                        </td>
                      );
                    })}
                    <td className="num pl-1 text-right text-muted-foreground">
                      {row[i]}/{n}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1.5 text-xs text-muted-foreground">Outlined squares are correct. Darker = more messages.</p>
        </div>
        <div className="space-y-3">
          <BigStat
            value={<span className="num">{correct} of 100</span>}
            label="Sorted into the right stream"
            caption={t.plain}
          />
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Typical misses</div>
            {t.errors.slice(0, 2).map((e) => (
              <div key={e.id} className="rounded-lg border px-3 py-2 text-xs">
                <div className="font-medium text-foreground">&ldquo;{e.subject}&rdquo;</div>
                <div className="text-muted-foreground">
                  Was {KIND_LABEL[e.actual]}, rules said {KIND_LABEL[e.predicted]}.
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            This is why sorting stays a suggestion: a person confirms every message. In production, an in-tenant model would
            replace the rules (Phase 2).
          </p>
        </div>
      </div>
    </div>
  );
}

/** Component 8: "Can we trust it?" panel. */
export function TrustPanel() {
  return (
    <PanelFrame
      testId="trust-panel"
      title="Can we trust it?"
      subtitle="Four checks on the methods behind this page, including where they fall short."
    >
      <div className="space-y-6">
        <MatcherSection />
        <div className="grid gap-6 border-t pt-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <StressSection />
          <CleanXMethodSection />
        </div>
        <div className="border-t pt-5">
          <TriageSection />
        </div>
      </div>
    </PanelFrame>
  );
}
