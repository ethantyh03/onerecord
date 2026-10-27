"use client";

import { CalendarClock, Gauge, Radar, UserRound } from "lucide-react";
import { actions, signals } from "@/data/contract";
import { SyntheticBadge } from "@/components/common/badges";
import { cn } from "@/lib/utils";
import { usePulse } from "./PulseContext";
import { PULSE_COUNTRIES, countryName, formatIsoDate, sgdCompact } from "./pulse-format";

/** Where the one-line imperative ends: the first clause break after a short lead-in. */
const BREAKS = [": ", ". ", ", so ", ", while ", ", when ", ", moving ", "; ", " so ", " before ", " that "];

/**
 * "Call Bukit Damai … across SPD and QTS. Its test-kit orders …" → [bold one-line imperative, full text for "Why".
 * Parentheticals (codes, unit counts) are dropped from the headline only.
 */
function splitAction(text: string): [string, string] {
  let cut = -1;
  for (const b of BREAKS) {
    const i = text.indexOf(b, 18);
    if (i > 0 && (cut < 0 || i < cut)) cut = i;
  }
  if (cut < 0) return [text, ""];
  const head = text.slice(0, cut).replace(/\s*\([^)]*\)/g, "").replace(/[,.;:]$/, "");
  if (head.length > 110) return [text, ""];
  return [head, text];
}

/** First sentence of the country narrative (". " followed by a capital letter). */
function firstSentence(text: string): [string, string] {
  const m = text.match(/^(.+?\.)\s+(?=[A-Z])/);
  if (!m) return [text, ""];
  return [m[1], text.slice(m[0].length)];
}

/** Component 10: one card per country. Implication in two lines, then bold one-line actions with owner, date and S$ chips. */
export function CountryActions() {
  const { country, setCountry } = usePulse();
  const conv = signals.assumptions;

  return (
    <section id="pulse-actions" aria-labelledby="pulse-actions-title" className="scroll-mt-24 space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="pulse-actions-title" className="text-lg font-semibold tracking-[-0.01em]">
            What each country should do next
          </h2>
          <SyntheticBadge />
        </div>
        <p className="max-w-[90ch] text-sm text-muted-foreground">
          Who does what, by when, and the measure to watch next quarter. S$ are addressable before conversion: we assume{" "}
          {Math.round(conv.dropOffSaveRate * 100)}% of at-risk accounts are saved and{" "}
          {Math.round(conv.crossSellConversion * 100)}% of cross-sell offers convert.
        </p>
      </div>

      <div className="space-y-3">
        {PULSE_COUNTRIES.map((code) => {
          const card = actions.cards.find((c) => c.country === code);
          if (!card) return null;
          const selected = country === code;
          const [lead, more] = firstSentence(card.implication);
          return (
            <article
              key={code}
              data-testid={`pulse-actions-${code}`}
              className={cn(
                "grid min-w-0 overflow-hidden rounded-xl border bg-card shadow-raised transition-colors lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]",
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
                  <h3 className="text-lg font-semibold text-foreground">{countryName(code)}</h3>
                  <span className="text-xs text-muted-foreground">{code}</span>
                </button>
                <p className="mt-1 line-clamp-3 text-[0.9375rem] leading-snug text-foreground" title={card.implication}>
                  {lead}
                </p>
                {more ? (
                  <details className="group mt-1 text-xs text-secondary-foreground">
                    <summary className="cursor-pointer list-none font-medium text-primary focus-visible:underline focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">More ▸</span>
                      <span className="hidden group-open:inline">Less ▾</span>
                    </summary>
                    <p className="mt-1 leading-snug">{more}</p>
                  </details>
                ) : null}
                <div className="mt-auto space-y-1 pt-3 text-xs">
                  <p className="text-foreground">
                    <span className="font-medium text-muted-foreground">Watch next quarter: </span>
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
                {card.actions.map((a, i) => {
                  const [head, why] = splitAction(a.action);
                  return (
                    <li key={i} className="flex min-w-0 flex-col gap-2.5 bg-card px-4 py-3.5">
                      <div className="flex items-start gap-2">
                        <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[0.6875rem] font-semibold text-accent-foreground">
                          {i + 1}
                        </span>
                        <p className="text-[0.9375rem] leading-snug font-semibold text-foreground" data-testid={`pulse-action-${code}-${i}`}>
                          {head}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-7 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 text-secondary-foreground">
                          <UserRound aria-label="Owner" className="size-3.5 shrink-0" />
                          {a.ownerRole}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 whitespace-nowrap text-secondary-foreground">
                          <CalendarClock aria-label="By when" className="size-3.5 shrink-0" />
                          By {formatIsoDate(a.byWhen)}
                        </span>
                        {a.sgdAddressable != null ? (
                          <span
                            className="inline-flex items-center rounded-md bg-ok-soft px-1.5 py-0.5 font-medium whitespace-nowrap text-ok-ink"
                            title="Addressable before conversion"
                          >
                            <span className="num font-semibold">{sgdCompact(a.sgdAddressable)}</span>&nbsp;addressable
                          </span>
                        ) : null}
                      </div>
                      <details className="group mt-auto pl-7 text-xs text-secondary-foreground">
                        <summary className="cursor-pointer list-none font-medium text-primary focus-visible:underline focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                          <span className="group-open:hidden">Why ▸</span>
                          <span className="hidden group-open:inline">Why ▾</span>
                        </summary>
                        <div className="mt-1 space-y-1.5 leading-snug">
                          {why ? <p>{why}</p> : null}
                          <p className="flex gap-1.5">
                            <Gauge aria-label="Measure of success" className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                            {a.kpi}
                          </p>
                          {a.sgdAddressable == null ? (
                            <p className="text-muted-foreground">Protects existing orders; no new S$ claimed.</p>
                          ) : null}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {conv.label} {actions.note}
      </p>
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
