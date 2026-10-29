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
import { StatusText } from "@/components/common";
import { cleanXMethod, matcherEval, stress, triageEval } from "@/data/contract";
import type { MessageKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STRESS_TITLE, STRESS_VERDICT, methodNames, stressExpected, stressScenario, triagePlain, triageTestSet } from "./copy";
import { COUNTRY_NAME, PanelFrame, PlainLine, TipBox, TipRow, VIZ, per100, signedPts } from "./shared";

const KIND_LABEL: Record<MessageKind, string> = {
  po: "Order (PO)",
  pr: "Request (PR)",
  enquiry: "Enquiry",
  followup: "Follow-up",
  mdm: "MDM setup",
};

/** One name per method across the page: "Seasonal model" and "Rolling 12-month average", ETS only in tooltips. */
function plainModel(s: string): string {
  return methodNames(
    s
      .replace(/\b(?:[Dd]amped |[Ss]easonal )?(?:Holt-Winters )?ETS\b/g, (_m: string, offset: number) =>
        offset === 0 ? "Seasonal model" : "seasonal model",
      )
      .replace(/\s*\(ours\)/g, "")
      .replace(/\(today\)/g, "(current)"),
  );
}

/** The clean × method finding, without the slogans. */
function cleanXSentence(s: string): string {
  return plainModel(
    s
      .replace(/\bour method is worse than today's\b/g, "the seasonal model is worse than the rolling average")
      .replace(/\s*A better model on dirty data makes things worse\./g, "")
      .replace(/\s*Clean the data first, then model\./g, ""),
  );
}

/** A numbered check: plain numeral, title, then a hairline running to the right edge (no boxed number). */
function SubHead({ n, title, children }: { n: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 space-y-0.5">
      <h3 className="flex items-center gap-3 text-[0.9375rem] font-semibold">
        <span className="num w-4 shrink-0 text-sm font-normal text-subtle">{n}</span>
        <span className="shrink-0">{title}</span>
        <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
      </h3>
      {children ? <p className="pl-7 text-[0.8125rem] text-muted-foreground">{children}</p> : null}
    </div>
  );
}

/** A figure as a readout (a hairline rule on its left, label, value, one line of meaning), not a box. */
function BigStat({ value, label, caption }: { value: ReactNode; label: string; caption: ReactNode }) {
  return (
    <div className="border-l border-border-strong pl-4">
      <div className="text-[0.8125rem] text-muted-foreground">{label}</div>
      <div className="font-wide mt-1.5 text-[1.75rem] leading-none font-semibold">{value}</div>
      <p className="mt-2 text-sm leading-snug text-secondary-foreground">{caption}</p>
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
      <SubHead n="1" title="Duplicate finder accuracy">
        Match threshold set on {tunedNames}, then tested on {heldNames}. Test duplicates include typos, word swaps and
        romanisation variants.
      </SubHead>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <BigStat value={<span className="num">{Math.round(hm.precision * 100)} of 100</span>} label="Precision" caption={`${m.plain.precision}.`} />
          <BigStat value={<span className="num">{Math.round(hm.recall * 100)} of 100</span>} label="Recall" caption={`${m.plain.recall}.`} />
          <p className="text-xs text-muted-foreground">
            Balance of the two (F1) {hm.f1.toFixed(2)} · {hm.tp} found, {hm.fp} false alarm{hm.fp === 1 ? "" : "s"}, {hm.fn}{" "}
            missed, out of {hm.pairsScored.toLocaleString("en-SG")} candidate pairs ({hm.truePairs} real duplicates). Expected
            range: 0.80–0.97.
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

        <div className="space-y-3">
          <div>
            <div className="border-b border-border pb-1.5 text-xs font-medium text-muted-foreground">Where it goes wrong, and why</div>
            <ul className="divide-y divide-border">
              {m.examples.slice(0, 3).map((e, i) => (
                <li key={i} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <StatusText size="sm" tone={e.kind === "missed" ? "warn" : "stuck"}>
                      {e.kind === "missed" ? "Missed duplicate" : "False alarm"}
                    </StatusText>
                    <span className="num text-xs text-muted-foreground">score {e.score.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 text-[0.8125rem] leading-snug">
                    <span className="font-medium">{e.a.cardName}</span>
                    <span className="text-muted-foreground"> vs </span>
                    <span className="font-medium">{e.b.cardName}</span>
                    <span className="text-muted-foreground"> · {COUNTRY_NAME[e.a.country]}</span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{e.why}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StressSection() {
  return (
    <div>
      <SubHead n="2" title={STRESS_TITLE}>
        The same forecast run on three versions of the data. With the seasons taken out, the seasonal model should hold no
        advantage.
      </SubHead>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-xs text-subtle">
            <tr className="border-b border-border-strong">
              <th className="px-3 py-2 text-left font-medium">Data</th>
              <th className="px-3 py-2 text-right font-medium">Rolling</th>
              <th className="px-3 py-2 text-right font-medium">Seasonal</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Lead</th>
              <th className="px-3 py-2 text-left font-medium">Expected</th>
            </tr>
          </thead>
          <tbody>
            {stress.scenarios.map((s) => {
              const shown = stressScenario(s.id, s.label, s.description);
              return (
              <tr key={s.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{shown.label}</div>
                  <div className="text-xs text-muted-foreground">{shown.description}</div>
                </td>
                <td className="num px-3 py-2 text-right">{per100(s.baselineWape)}</td>
                <td className="num px-3 py-2 text-right">{per100(s.oursWape)}</td>
                <td className="num px-3 py-2 text-right font-medium whitespace-nowrap">{signedPts(s.advantagePts)}</td>
                <td className="px-3 py-2 text-xs">
                  <StatusText size="sm" tone={s.passed ? "ok" : "stuck"}>
                    {s.passed ? "As expected" : "Not as expected"}
                  </StatusText>
                  <div className="text-muted-foreground">{stressExpected(s.expected)}</div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Errors are units off per 100 ordered: Products A and B, all five countries, merged customers, the same six forecast
        dates as the scorecard.
      </p>
      <PlainLine className="mt-2 text-sm">{STRESS_VERDICT}</PlainLine>
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
      <div className="border-t border-border px-1 py-3">
        <div className={cn("num font-wide text-2xl leading-none font-semibold", highlight && "text-ok-ink")}>{per100(v)}</div>
        <div className="mt-1 text-xs text-muted-foreground">per 100 ordered</div>
        {today ? (
          <StatusText size="sm" tone="neutral" hollow className="mt-1.5">
            Current
          </StatusText>
        ) : null}
        {highlight ? (
          <StatusText size="sm" tone="ok" className="mt-1.5">
            Clean records
          </StatusText>
        ) : null}
      </div>
    );
  };
  return (
    <div>
      <SubHead n="3" title="How much comes from clean data, how much from the model">
        Forecast error on the series that duplicates and mis-coding distort.
      </SubHead>
      {/* A ruled 2 x 2: rows are the data, columns the method. No boxed cells: the winner is in the ink. */}
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 text-sm">
        <div />
        <div className="px-1 pb-1.5 text-xs font-medium text-subtle">{plainModel(c.colLabels.rolling)}</div>
        <div className="px-1 pb-1.5 text-xs font-medium text-subtle">{plainModel(c.colLabels.ours)}</div>
        <div className="flex max-w-36 items-center border-t border-border pr-1 text-xs font-medium text-muted-foreground">{c.rowLabels.raw}</div>
        {cell("raw", "rolling")}
        {cell("raw", "ours")}
        <div className="flex max-w-36 items-center border-t border-border pr-1 text-xs font-medium text-muted-foreground">{c.rowLabels.golden}</div>
        {cell("golden", "rolling")}
        {cell("golden", "ours")}
      </div>
      <p className="mt-3 flex flex-wrap gap-y-1 border-t border-border pt-3 text-xs text-secondary-foreground [&>span]:border-l [&>span]:border-border-strong [&>span]:px-3 [&>span:first-child]:border-l-0 [&>span:first-child]:pl-0">
        <span>
          From cleaning: <span className="num font-semibold text-foreground">{c.fromCleaningPts.toFixed(1)} pts</span>
        </span>
        <span>
          From the model: <span className="num font-semibold text-foreground">{c.fromModellingPts.toFixed(1)} pts</span>
        </span>
        <span>
          Total: <span className="num font-semibold text-foreground">{c.totalImprovementPts.toFixed(1)} pts</span>
        </span>
      </p>
      <PlainLine className="mt-2 text-sm">{cleanXSentence(c.sentence)}</PlainLine>
    </div>
  );
}

function TriageSection() {
  const t = triageEval;
  const max = Math.max(1, ...t.confusion.flat());
  const correct = Math.round(t.accuracy * 100);
  return (
    <div>
      <SubHead n="4" title="Inbox triage rules: accuracy">
        Tested on {t.testSetSize} messages written independently of the rules and never used to tune them.
      </SubHead>
      <p className="-mt-1.5 mb-3 max-w-[100ch] text-xs text-muted-foreground">{triageTestSet(t.testSet)}</p>
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
                            "num h-9 min-w-12 rounded-[3px] text-center text-[0.8125rem] font-medium",
                            diag && "ring-2 ring-foreground/70 ring-inset",
                          )}
                          style={{
                            // Capped at a 45% mix so the body text keeps >= 4.5:1 in both themes (no ink switch needed).
                            background: v === 0 ? "var(--muted)" : `color-mix(in oklab, var(--chart-1) ${Math.round(10 + share * 35)}%, var(--card))`,
                            color: "var(--foreground)",
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
        <div className="space-y-4">
          <BigStat
            value={<span className="num">{correct} of 100</span>}
            label="Sorted into the right stream"
            caption={triagePlain(t.plain)}
          />
          <div>
            <div className="border-b border-border pb-1.5 text-xs font-medium text-muted-foreground">Typical misses</div>
            <ul className="divide-y divide-border">
              {t.errors.slice(0, 2).map((e) => (
                <li key={e.id} className="py-2 text-xs">
                  <div className="font-medium text-foreground">&ldquo;{e.subject}&rdquo;</div>
                  <div className="text-muted-foreground">
                    Was {KIND_LABEL[e.actual]}, rules said {KIND_LABEL[e.predicted]}.
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Sorting stays a suggestion: a person confirms every message. An in-tenant AI model is planned to replace the
            rules.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Component 8: "Model quality" panel. */
export function TrustPanel() {
  return (
    <PanelFrame
      testId="trust-panel"
      title="Model quality"
      subtitle="How the duplicate finder, the forecast and inbox sorting perform, including where they fall short."
    >
      <div className="space-y-8">
        <MatcherSection />
        <div className="grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <StressSection />
          <CleanXMethodSection />
        </div>
        <TriageSection />
      </div>
    </PanelFrame>
  );
}
