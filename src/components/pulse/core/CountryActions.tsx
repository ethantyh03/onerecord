"use client";

import { Gauge } from "lucide-react";
import { actions, signals } from "@/data/contract";
import { ACTIONS_NOTE } from "@/components/pulse/analytics/copy";
import { RowNumber } from "@/components/common/data-rows";
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

/**
 * Component 10: one ruled row per country. Implication in two lines, then bold one-line actions with owner, date and S$
 * as quiet meta columns under each (no chips, no boxed numbers). The selected country is a raised row, not a rail.
 */
export function CountryActions() {
  const { country, setCountry } = usePulse();
  const conv = signals.assumptions;

  return (
    <section
      id="pulse-actions"
      aria-labelledby="pulse-actions-title"
      className="panel scroll-mt-24 overflow-hidden"
    >
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3">
        <h2 id="pulse-actions-title" className="panel-title flex min-h-7 items-center">
          What each country should do next
        </h2>
        <p className="max-w-[96ch] text-sm leading-snug text-muted-foreground">
          Who does what, by when, and the measure to watch next quarter. S$ are addressable before conversion, assuming{" "}
          {Math.round(conv.dropOffSaveRate * 100)}% of at-risk accounts are saved and{" "}
          {Math.round(conv.crossSellConversion * 100)}% of cross-sell offers convert.
        </p>
      </div>

      <div className="divide-y divide-border">
        {PULSE_COUNTRIES.map((code) => {
          const card = actions.cards.find((c) => c.country === code);
          if (!card) return null;
          const selected = country === code;
          const [lead, more] = firstSentence(card.implication);
          return (
            <article
              key={code}
              data-testid={`pulse-actions-${code}`}
              data-selected={selected || undefined}
              aria-current={selected ? "true" : undefined}
              className="relative grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]"
            >
              {/* The selected country (the one in the forecast chart) is a raised row header, not a rail. */}
              <div
                className={cn(
                  "flex flex-col border-b border-border px-4 py-3.5 transition-colors lg:border-r lg:border-b-0",
                  selected && "bg-secondary",
                )}
              >
                <button
                  type="button"
                  onClick={() => setCountry(code)}
                  className="flex w-full items-baseline gap-2 text-left focus-visible:underline focus-visible:outline-none"
                  title={`Show ${countryName(code)} in the forecast`}
                >
                  <h3 className="font-wide text-base font-semibold text-foreground">{countryName(code)}</h3>
                  <span className="text-xs text-subtle">{code}</span>
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
                  <p className="text-subtle">Based on: {plainSource(card.signalSource)}</p>
                </div>
              </div>

              <ol
                className={cn(
                  "grid divide-y divide-border md:divide-y-0",
                  card.actions.length >= 3
                    ? "md:grid-cols-3 md:divide-x"
                    : card.actions.length === 2
                      ? "md:grid-cols-2 md:divide-x"
                      : "",
                )}
              >
                {card.actions.map((a, i) => {
                  const [head, why] = splitAction(a.action);
                  return (
                    <li key={i} className="flex min-w-0 flex-col gap-2 px-4 py-3.5">
                      <div className="flex items-start gap-2">
                        <RowNumber n={i + 1} className="leading-snug" />
                        <p className="text-[0.9375rem] leading-snug font-semibold text-foreground" data-testid={`pulse-action-${code}-${i}`}>
                          {head}
                        </p>
                      </div>
                      {/* Owner, date and value as quiet lines: the S$ is the one figure that stands out. */}
                      <dl className="space-y-0.5 pl-7 text-xs leading-4">
                        <div className="text-secondary-foreground">
                          <dt className="sr-only">Owner</dt>
                          <dd>{a.ownerRole}</dd>
                        </div>
                        <div className="text-muted-foreground">
                          <dt className="sr-only">By when</dt>
                          <dd className="num whitespace-nowrap">By {formatIsoDate(a.byWhen)}</dd>
                        </div>
                        {a.sgdAddressable != null ? (
                          <div className="pt-1 text-muted-foreground">
                            <dt className="sr-only">Addressable before conversion</dt>
                            <dd className="num whitespace-nowrap" title="Addressable before conversion">
                              <span className="text-[0.8125rem] font-semibold text-foreground">{sgdCompact(a.sgdAddressable)}</span> addressable
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                      <details className="group mt-auto pt-1 pl-7 text-xs text-secondary-foreground">
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
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {ACTIONS_NOTE}
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
