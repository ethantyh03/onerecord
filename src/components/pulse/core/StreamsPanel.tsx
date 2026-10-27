"use client";

import Link from "next/link";
import { Hourglass } from "lucide-react";
import { streams, type CountryStreams, type StreamMonth } from "@/data/contract";
import { useStuckDemand } from "@/lib/selectors";
import { SyntheticBadge } from "@/components/common/badges";
import { formatSgd } from "@/components/common/format";
import { Sparkline } from "./Sparkline";
import { PULSE_COUNTRIES, countCompact, countryName, formatPct, sgdCompact } from "./pulse-format";

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

function Track({ def, c }: { def: StreamDef; c: CountryStreams }) {
  const values = c.series.map((m) => m[def.key] as number);
  const total = def.total(c);
  const yoy = yoyFromSeries(c.series, def.key);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-secondary-foreground">
          <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: def.color }} />
          <span className="truncate">{def.label}</span>
        </span>
        <span className="num text-sm font-semibold text-foreground">
          {def.kind === "sgd" ? sgdCompact(total) : countCompact(total)}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[0.6875rem] text-muted-foreground">
        <span>{def.plain}</span>
        <span className="num">{yoy == null ? "" : `${formatPct(yoy)} YoY`}</span>
      </div>
      <Sparkline
        values={values}
        splitAt={12}
        color={def.color}
        area={def.key === "poSgd"}
        height={30}
        className="mt-1"
        label={`${def.label}, ${countryName(c.country)}, 24 months`}
      />
    </div>
  );
}

/** Component 4: demand streams and internal MDM work per country, never mixed on one axis. */
export function StreamsPanel() {
  const stuck = useStuckDemand();

  return (
    <section aria-labelledby="pulse-streams-title" data-testid="pulse-streams" className="rounded-xl border bg-card p-5 shadow-raised">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pulse-streams-title" className="text-lg font-semibold tracking-[-0.01em]">
              Demand and setup work, kept apart
            </h2>
            <SyntheticBadge />
          </div>
          <p className="max-w-[80ch] text-sm text-muted-foreground">
            Last 12 months per country, each stream on its own scale. Every line covers 24 months; the coloured part is
            this year.
          </p>
        </div>
      </div>

      <div
        className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-muted/60 px-4 py-3 md:flex-row md:items-center md:gap-5"
        data-testid="pulse-streams-legend"
      >
        <p className="text-sm font-medium text-foreground md:max-w-[62ch]">{streams.legend}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-secondary-foreground">
          {[...DEMAND, MDM].map((d) => (
            <li key={d.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: d.color }} />
              {d.label}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <Hourglass aria-hidden className="size-3 text-stuck" />
            Stuck demand (live)
          </li>
        </ul>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {PULSE_COUNTRIES.map((code) => {
          const c = streams.countries.find((x) => x.country === code);
          if (!c) return null;
          const s = stuck.byCountry[code] ?? { sgd: 0, count: 0, maxDaysWaiting: 0 };
          return (
            <article
              key={code}
              data-testid={`pulse-streams-${code}`}
              className="flex min-w-0 flex-col rounded-lg border border-border px-4 pt-3 pb-3.5"
            >
              <header className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{countryName(code)}</h3>
                <span className="text-xs text-muted-foreground">
                  {Math.round(c.prToPoConversion * 100)}% of requests became orders
                </span>
              </header>
              <div className="space-y-3">
                {DEMAND.map((d) => (
                  <Track key={d.key} def={d} c={c} />
                ))}
              </div>

              {s.count > 0 ? (
                <Link
                  href="/mdm"
                  className="my-3 flex items-center gap-2 rounded-md border border-stuck/30 bg-stuck-soft px-2.5 py-1.5 text-xs text-stuck-ink transition-colors hover:border-stuck/60 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <Hourglass aria-hidden className="size-3.5 shrink-0" />
                  <span>
                    <span className="num font-semibold">{formatSgd(s.sgd)}</span> stuck: {s.count} request
                    {s.count === 1 ? "" : "s"} waiting on a setup
                  </span>
                </Link>
              ) : (
                <p className="my-3 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
                  Nothing stuck waiting on a setup
                </p>
              )}

              <div className="border-t border-dashed pt-3">
                <Track def={MDM} c={c} />
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Orders are counted on merged customers. Setup requests are counts of internal MDM work and never feed the order
        or growth figures. The only link between the two is stuck demand: a customer request that can&apos;t become an
        order until a record is set up.
      </p>
    </section>
  );
}
