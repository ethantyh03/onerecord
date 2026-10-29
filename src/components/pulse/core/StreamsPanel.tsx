"use client";

import Link from "next/link";
import { streams, type CountryStreams, type StreamMonth } from "@/data/contract";
import { useStuckDemand } from "@/lib/selectors";
import { StateGlyph } from "@/components/common/glyph";
import { formatSgd } from "@/components/common/format";
import { Sparkline } from "./Sparkline";
import { PULSE_COUNTRIES, countCompact, countryName, formatMonth, formatPct, sgdCompact } from "./pulse-format";

interface StreamDef {
  key: keyof Omit<StreamMonth, "month">;
  label: string;
  plain: string;
  color: string;
  kind: "sgd" | "count";
  total: (c: CountryStreams) => number;
}

const DEMAND: StreamDef[] = [
  {
    key: "poSgd",
    label: "Orders (POs)",
    plain: "Demand, counted",
    color: "var(--chart-1)",
    kind: "sgd",
    total: (c) => c.poSgd12m,
  },
  {
    key: "prSgd",
    label: "Purchase requests",
    plain: "Pipeline, not counted",
    color: "var(--chart-3)",
    kind: "sgd",
    total: (c) => c.prSgd12m,
  },
  {
    key: "enquiries",
    label: "Enquiries",
    plain: "Leading signal",
    color: "var(--chart-4)",
    kind: "count",
    total: (c) => c.enquiries12m,
  },
];

const MDM: StreamDef = {
  key: "mdmRequests",
  label: "Setup requests",
  plain: "Internal work, not demand",
  color: "var(--chart-5)",
  kind: "count",
  total: (c) => c.mdmRequests12m,
};

function yoyFromSeries(series: StreamMonth[], key: StreamDef["key"]): number | null {
  if (series.length < 24) return null;
  const prior = series.slice(-24, -12).reduce((a, m) => a + (m[key] as number), 0);
  const cur = series.slice(-12).reduce((a, m) => a + (m[key] as number), 0);
  return prior > 0 ? cur / prior - 1 : null;
}

/** First month with recorded setup history: earlier months are 0 because none was generated, not because there were none. */
function mdmHistoryStart(series: StreamMonth[]): number {
  const i = series.findIndex((m) => m.mdmRequests > 0);
  return i < 0 ? 0 : i;
}

function Track({ def, c }: { def: StreamDef; c: CountryStreams }) {
  const isMdm = def.key === "mdmRequests";
  const from = isMdm ? mdmHistoryStart(c.series) : 0;
  const values = c.series.slice(from).map((m) => m[def.key] as number);
  const total = def.total(c);
  const yoy = isMdm ? null : yoyFromSeries(c.series, def.key);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-secondary-foreground">
          <span aria-hidden className="h-0.5 w-3 shrink-0" style={{ background: def.color }} />
          <span className="truncate">{def.label}</span>
        </span>
        <span className="num text-sm font-semibold text-foreground">
          {def.kind === "sgd" ? sgdCompact(total) : countCompact(total)}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>{def.plain}</span>
        <span className="num">{yoy == null ? (isMdm && from > 0 ? `from ${formatMonth(c.series[from].month)}` : "") : `${formatPct(yoy)} YoY`}</span>
      </div>
      <Sparkline
        values={values}
        splitAt={isMdm ? undefined : 12}
        color={def.color}
        area={def.key === "poSgd"}
        height={30}
        className="mt-1"
        label={`${def.label}, ${countryName(c.country)}, ${values.length} months`}
      />
    </div>
  );
}

/** Component 4: demand streams and internal MDM work per country, never mixed on one axis. */
export function StreamsPanel() {
  const stuck = useStuckDemand();

  return (
    <section aria-labelledby="pulse-streams-title" data-testid="pulse-streams" className="panel overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 id="pulse-streams-title" className="panel-title flex min-h-7 items-center">
          Demand and setup work, kept apart
        </h2>
        <p className="mt-1 max-w-[86ch] text-sm leading-snug text-muted-foreground">
          Last 12 months per country, each stream on its own scale. Demand lines cover 24 months (the coloured part is
          this year); setup requests start in Oct 2025, where the setup history begins.
        </p>
      </div>

      <div
        className="flex flex-col gap-2 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6"
        data-testid="pulse-streams-legend"
      >
        <p className="text-sm font-medium text-foreground md:max-w-[62ch]">{streams.legend}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-secondary-foreground">
          {[...DEMAND, MDM].map((d) => (
            <li key={d.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4" style={{ background: d.color }} />
              {d.label}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <StateGlyph tone="stuck" size="sm" />
            Stuck demand (live)
          </li>
        </ul>
      </div>

      {/* Countries as ruled columns, not cards: every column carries its own left and top hairline, and the grid is
          pulled 1px up and left so the outer rules sit under the panel edge. Rules stay whole when columns wrap. */}
      <div className="overflow-hidden">
        <div className="-mt-px -ml-px grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {PULSE_COUNTRIES.map((code) => {
            const c = streams.countries.find((x) => x.country === code);
            if (!c) return null;
            const s = stuck.byCountry[code] ?? { sgd: 0, count: 0, maxDaysWaiting: 0 };
            return (
              <article
                key={code}
                data-testid={`pulse-streams-${code}`}
                className="flex min-w-0 flex-col border-t border-l border-border px-4 pt-3.5 pb-4"
              >
                <header className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="font-wide text-sm font-semibold text-foreground">{countryName(code)}</h3>
                  <span className="text-right text-xs text-muted-foreground">
                    {Math.round(c.prToPoConversion * 100)}% of requests became orders
                  </span>
                </header>
                <div className="space-y-3.5">
                  {DEMAND.map((d) => (
                    <Track key={d.key} def={d} c={c} />
                  ))}
                </div>

                {s.count > 0 ? (
                  <Link
                    href="/mdm"
                    className="group/stuck my-3.5 flex items-start gap-2 text-xs leading-4 text-stuck-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <StateGlyph tone="stuck" className="mt-1" />
                    <span className="underline decoration-transparent underline-offset-[3px] transition-colors group-hover/stuck:decoration-stuck/60">
                      <span className="num font-semibold">{formatSgd(s.sgd)}</span> stuck: {s.count} request
                      {s.count === 1 ? "" : "s"} waiting on a setup
                    </span>
                  </Link>
                ) : (
                  <p className="my-3.5 flex items-start gap-2 text-xs leading-4 text-muted-foreground">
                    <StateGlyph tone="waiting" className="mt-1" />
                    Nothing stuck waiting on a setup
                  </p>
                )}

                <div className="border-t border-border-strong pt-3.5">
                  <Track def={MDM} c={c} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Orders are counted on merged customers. Setup requests are counts of internal MDM work and never feed the order
        or growth figures. The only link between the two is stuck demand: a customer request that can&apos;t become an
        order until a record is set up. Setup lines start in Oct 2025: the synthetic data has no setup history before
        then, which is not the same as no requests.
      </p>
    </section>
  );
}
