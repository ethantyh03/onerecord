"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpenText, CalendarRange, Sigma, TrendingUp } from "lucide-react";
import { meta, matrix } from "@/data/contract";
import { SyntheticBadge } from "@/components/common/badges";
import { cn } from "@/lib/utils";
import { usePulse, type PulseMeasure, type PulseView } from "./PulseContext";
import { formatMonth } from "./pulse-format";

interface SegOption<T extends string> {
  value: T;
  label: string;
  hint: string;
  testId: string;
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-muted p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              title={o.hint}
              data-testid={o.testId}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                active ? "bg-card text-foreground shadow-raised" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const VIEW_OPTIONS: SegOption<PulseView>[] = [
  {
    value: "merged",
    label: "Merged customers",
    hint: "Duplicate SAP records combined into one golden customer ID (default)",
    testId: "pulse-toggle-merged",
  },
  {
    value: "raw",
    label: "Raw SAP records",
    hint: "Every SAP customer record counted separately, as recorded today",
    testId: "pulse-toggle-raw",
  },
];

const MEASURE_OPTIONS: SegOption<PulseMeasure>[] = [
  { value: "sgd", label: "S$ value", hint: "Order value in SGD, fixed illustrative FX", testId: "pulse-measure-sgd" },
  { value: "units", label: "Units", hint: "Units ordered, compared within each product", testId: "pulse-measure-units" },
];

function Definition({ icon: Icon, term, children }: { icon: typeof Sigma; term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-foreground">{term}</dt>
        <dd className="mt-0.5 text-[0.8125rem] leading-snug text-secondary-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** Component 1: title, definitions printed verbatim, and the two view toggles. */
export function PulseHeader() {
  const { view, setView, measure, setMeasure } = usePulse();
  const w = meta.window;

  return (
    <header className="mb-6 space-y-5 border-b border-border pb-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-foreground">Regional Pulse</h1>
            <SyntheticBadge />
          </div>
          <p className="max-w-[72ch] text-[0.9375rem] text-muted-foreground">
            Customer orders across five countries and three product groups, counted on clean customer records. In
            production this is a Power BI report on SAP B1 extracts.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Segmented label="Customers" value={view} onChange={setView} options={VIEW_OPTIONS} />
          <Segmented label="Measure" value={measure} onChange={setMeasure} options={MEASURE_OPTIONS} />
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-4 rounded-xl border bg-card px-5 py-4 shadow-raised md:grid-cols-2 2xl:grid-cols-4">
        <Definition icon={CalendarRange} term="Time window">
          Window: {w.label} (12 months) · compared with the same 12 months a year earlier
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Prior period {formatMonth(w.priorStart)} – {formatMonth(w.priorEnd)}.
          </span>
        </Definition>
        <Definition icon={Sigma} term="Growth (headline)">
          {meta.growthFormula}
        </Definition>
        <Definition icon={TrendingUp} term="Momentum (latest quarter)">
          {meta.momentumFormula}
        </Definition>
        <Definition icon={BookOpenText} term="Why not half-years">
          {meta.seasonalityNote}
        </Definition>
      </dl>

      <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p className="max-w-[110ch]">
          {matrix.measureNote} The 6–12-month limit is a spreadsheet habit, not a data limit: SAP B1 already holds 24–36
          months of PO history (assumption A27).
        </p>
        <Link
          href="/assumptions"
          className="shrink-0 font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          data-testid="pulse-assumptions-link"
        >
          See every assumption behind these numbers
        </Link>
      </div>
    </header>
  );
}
