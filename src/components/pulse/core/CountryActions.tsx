"use client";

import { CalendarClock, Gauge, Radar, UserRound } from "lucide-react";
import { actions, signals } from "@/data/contract";
import { SyntheticBadge } from "@/components/common/badges";
import { cn } from "@/lib/utils";
import { usePulse } from "./PulseContext";
import { PULSE_COUNTRIES, countryName, formatIsoDate, sgdCompact } from "./pulse-format";

/** Component 10: one card per country. Implication sentence, then who does what, by when, and what to watch. */
export function CountryActions() {
  const { country, setCountry } = usePulse();
  const conv = signals.assumptions;

  return (
    <section aria-labelledby="pulse-actions-title" className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="pulse-actions-title" className="text-lg font-semibold tracking-[-0.01em]">
            What each country should do next
          </h2>
          <SyntheticBadge />
        </div>
        <p className="max-w-[90ch] text-sm text-muted-foreground">
          What the numbers mean for each country, then two or three actions with an owner, a date and the measure to
          watch next quarter. {conv.label} Assumed rates: {Math.round(conv.dropOffSaveRate * 100)}% of at-risk accounts
          saved, {Math.round(conv.crossSellConversion * 100)}% of cross-sell offers converted.
        </p>
      </div>

      <div className="space-y-3">
        {PULSE_COUNTRIES.map((code) => {
          const card = actions.cards.find((c) => c.country === code);
          if (!card) return null;
          const selected = country === code;
          return (
            <article
              key={code}
              data-testid={`pulse-actions-${code}`}
              className={cn(
                "grid min-w-0 overflow-hidden rounded-xl border bg-card shadow-raised transition-colors lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
                selected ? "border-primary/60" : "border-border",
              )}
            >
              <div className="flex flex-col border-b bg-muted/40 px-4 py-3.5 lg:border-r lg:border-b-0">
                <button
                  type="button"
                  onClick={() => setCountry(code)}
                  className="flex w-full items-baseline gap-2 text-left focus-visible:underline focus-visible:outline-none"
                  title={`Show ${countryName(code)} in the forecast`}
                >
                  <h3 className="text-base font-semibold text-foreground">{countryName(code)}</h3>
                  <span className="text-xs text-muted-foreground">{code}</span>
                </button>
                <p className="mt-1.5 text-[0.9375rem] leading-snug text-foreground">{card.implication}</p>
                <div className="mt-auto space-y-1 pt-3 text-xs">
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Watch next quarter: </span>
                    {card.kpi}
                  </p>
                  <p className="inline-flex items-center gap-1 text-muted-foreground">
                    <Radar aria-hidden className="size-3" />
                    Based on: {plainSource(card.signalSource)}
                  </p>
                </div>
              </div>

              <ol
                className={cn(
                  "grid gap-px bg-border",
                  card.actions.length >= 3 ? "md:grid-cols-3" : card.actions.length === 2 ? "md:grid-cols-2" : "",
                )}
              >
                {card.actions.map((a, i) => (
                  <li key={i} className="flex min-w-0 flex-col gap-2 bg-card px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      <span className="num mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[0.6875rem] font-semibold text-accent-foreground">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-snug font-medium text-foreground">{a.action}</p>
                    </div>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 pl-7 text-xs text-secondary-foreground">
                      <dt className="flex items-center text-muted-foreground">
                        <UserRound aria-label="Owner" className="size-3.5" />
                      </dt>
                      <dd>{a.ownerRole}</dd>
                      <dt className="flex items-center text-muted-foreground">
                        <CalendarClock aria-label="By when" className="size-3.5" />
                      </dt>
                      <dd>By {formatIsoDate(a.byWhen)}</dd>
                      <dt className="flex items-center text-muted-foreground">
                        <Gauge aria-label="Measure of success" className="size-3.5" />
                      </dt>
                      <dd>{a.kpi}</dd>
                    </dl>
                    <div className="mt-auto pl-7">
                      {a.sgdAddressable != null ? (
                        <p className="inline-flex items-baseline gap-1.5 rounded-md bg-ok-soft px-2 py-0.5 text-xs text-ok-ink">
                          <span className="num font-semibold">{sgdCompact(a.sgdAddressable)}</span>
                          addressable, before conversion
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Protects existing orders; no new S$ claimed</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{actions.note}</p>
    </section>
  );
}

const SOURCE_WORDS: [RegExp, string][] = [
  [/signals\.dropOff/g, "drop-off signal"],
  [/signals\.crossSell/g, "cross-sell signal"],
  [/\bmatrix\b/g, "country × product view"],
  [/\bdedup\b/g, "duplicate clean-up"],
  [/\bbridge\b/g, "growth bridge"],
  [/\bstreams\b/g, "demand streams"],
  [/\bbacktest\b/g, "forecast backtest"],
];

/** "signals.dropOff + bridge" → "drop-off signal + growth bridge" */
function plainSource(src: string): string {
  return SOURCE_WORDS.reduce((acc, [re, word]) => acc.replace(re, word), src);
}
