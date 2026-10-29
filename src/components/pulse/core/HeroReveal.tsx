"use client";

import { useMemo } from "react";
import { Combine, SplitSquareVertical } from "lucide-react";
import { actions, bridge, type TopAccountRaw } from "@/data/contract";
import { StateGlyph, type StateTone } from "@/components/common/glyph";
import { StatusText } from "@/components/common/status-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePulse } from "./PulseContext";
import { formatIsoDate, formatPct, sgdCompact } from "./pulse-format";

const HERO_COUNTRY = "MY";
const LIST_LEN = 10;

const STATUS_LABEL: Record<TopAccountRaw["status"], string> = {
  new: "New customer",
  lost: "Lost customer",
  flat: "Flat",
  expanding: "Growing",
  declining: "Declining",
};

/** Status as plain text (glyph + word), never a chip: new reads as growth, lost as money gone, the rest neutral. */
const STATUS_TONE: Record<TopAccountRaw["status"], StateTone> = {
  new: "ok",
  lost: "stuck",
  flat: "neutral",
  expanding: "neutral",
  declining: "neutral",
};

interface Row {
  key: string;
  rank: number;
  name: string;
  sub: string;
  /** Second caption line (the golden ID), so neither line is truncated. */
  sub2?: string;
  sgd12m: number;
  yoy: number | null;
  status?: TopAccountRaw["status"];
  isHero: boolean;
  records?: number;
}

/** Top LIST_LEN rows, plus any hero rows ranked lower so the three records are always on screen. */
function withHero<T>(list: T[], isHero: (a: T) => boolean): { a: T; rank: number }[] {
  const ranked = list.map((a, i) => ({ a, rank: i + 1 }));
  return [...ranked.slice(0, LIST_LEN), ...ranked.slice(LIST_LEN).filter((r) => isHero(r.a))];
}

/** Component 5: the MY top-accounts list, raw vs merged, with three records merging into one golden customer. */
export function HeroReveal() {
  const { view, setView } = usePulse();
  const merged = view === "merged";
  const cb = bridge.countries.find((c) => c.country === HERO_COUNTRY);
  const card = actions.cards.find((c) => c.country === HERO_COUNTRY);

  const heroId = cb?.topAccounts.dedup.find((a) => a.hero)?.goldenId ?? cb?.example.goldenId ?? "";
  const hero = cb?.topAccounts.dedup.find((a) => a.goldenId === heroId);
  const heroRank = cb ? cb.topAccounts.dedup.findIndex((a) => a.goldenId === heroId) + 1 : 0;

  const rows: Row[] = useMemo(() => {
    if (!cb) return [];
    if (merged) {
      return withHero(cb.topAccounts.dedup, (a) => a.goldenId === heroId).map(({ a, rank }) => ({
        key: `g-${a.goldenId}`,
        rank,
        name: a.name,
        sub: a.records > 1 ? `${a.records} SAP records merged` : a.goldenId,
        sub2: a.records > 1 ? a.goldenId : undefined,
        sgd12m: a.sgd12m,
        yoy: a.yoy,
        isHero: a.goldenId === heroId,
        records: a.records,
      }));
    }
    return withHero(cb.topAccounts.raw, (a) => a.goldenId === heroId).map(({ a, rank }) => ({
      key: `r-${a.cardCode}`,
      rank,
      name: a.name,
      sub: a.cardCode,
      sgd12m: a.sgd12m,
      yoy: a.yoy,
      status: a.status,
      isHero: a.goldenId === heroId,
    }));
  }, [cb, merged, heroId]);

  /** One fixed scale across both views, so bars don't rescale when the toggle flips. */
  const maxSgd = useMemo(() => {
    if (!cb) return 1;
    return Math.max(1, ...cb.topAccounts.raw.map((a) => a.sgd12m), ...cb.topAccounts.dedup.map((a) => a.sgd12m));
  }, [cb]);

  if (!cb) return null;

  const extra = Math.max(0, rows.length - LIST_LEN);
  const heroShort = hero?.name.split(" ").slice(0, 2).join(" ") ?? "hero";

  const records = cb.example.records.map((r) => ({
    ...r,
    stats: cb.topAccounts.raw.find((a) => a.cardCode === r.cardCode),
  }));
  const heroAction = card?.actions[0];

  return (
    <section
      aria-labelledby="pulse-hero-title"
      id="pulse-hero"
      data-testid="pulse-hero"
      data-view={view}
      className="panel scroll-mt-24 overflow-hidden"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 id="pulse-hero-title" className="panel-title flex min-h-7 items-center">
            Duplicates hide the truth: Malaysia&apos;s top accounts
          </h2>
          <p className="max-w-[80ch] text-sm text-muted-foreground">{cb.example.title}.</p>
        </div>
        <Button
          variant={merged ? "outline" : "default"}
          size="lg"
          data-testid="pulse-hero-merge"
          onClick={() => setView(merged ? "raw" : "merged")}
        >
          {merged ? <SplitSquareVertical aria-hidden /> : <Combine aria-hidden />}
          {merged ? "Show raw SAP records" : "Merge the duplicates"}
        </Button>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Ranked list */}
        <div className="px-4 py-4 lg:border-r lg:border-border">
          <div className="mb-2 flex items-baseline justify-between border-b border-border pb-2 text-xs text-muted-foreground">
            <span>
              {merged ? "Top 10 customers, merged (one row per hospital)" : "Top 10 customers, raw (one row per SAP record)"}
              {extra > 0 ? ` + the other ${heroShort} record${extra === 1 ? "" : "s"}` : ""}
            </span>
            <span>Last 12 months · YoY</span>
          </div>
          <ol className="divide-y divide-border" aria-live="polite">
            {rows.map((r, idx) => (
              <li
                key={r.key}
                className={cn(
                  // The hospital in question reads like a selected row (raised fill, bold name, state glyph); its
                  // colour lives in the glyph, the bar and the figure, never in a tint or a rail.
                  "relative grid grid-cols-[1.5rem_minmax(0,1fr)_4.75rem_4.25rem] items-center gap-x-3 px-2 py-1.5 transition-colors duration-500",
                  idx === LIST_LEN && "border-t-border-strong",
                  r.isHero && "bg-secondary",
                )}
              >
                <span className="num text-right text-sm font-medium text-muted-foreground">{r.rank}</span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    {r.isHero ? <StateGlyph tone={merged ? "stuck" : "warn"} /> : null}
                    <span className={cn("truncate text-sm text-foreground", r.isHero && "font-semibold")}>{r.name}</span>
                    {r.status && (r.status === "new" || r.status === "lost" || r.isHero) ? (
                      <StatusText size="sm" tone={STATUS_TONE[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </StatusText>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={cn("h-1 flex-1 overflow-hidden rounded-[1px]", r.isHero ? "bg-border-strong" : "bg-secondary")}>
                      <span
                        className="block h-full transition-[width] duration-700 ease-out"
                        style={{
                          width: `${Math.max(2, (r.sgd12m / maxSgd) * 100)}%`,
                          background: r.isHero ? (merged ? "var(--stuck)" : "var(--warn)") : "var(--chart-5)",
                        }}
                      />
                    </span>
                    <span className="hidden w-40 shrink-0 text-[0.8125rem] leading-tight text-muted-foreground sm:block">
                      <span className={cn("block truncate", !r.sub2 && "mono-id")}>{r.sub}</span>
                      {r.sub2 ? <span className="mono-id block truncate">{r.sub2}</span> : null}
                    </span>
                  </div>
                </div>
                <span className="num text-right text-sm font-medium text-foreground">{sgdCompact(r.sgd12m)}</span>
                <span
                  className={cn(
                    "num text-right text-sm",
                    r.isHero && merged ? "font-semibold text-stuck-ink" : r.isHero ? "font-medium text-warn-ink" : "text-secondary-foreground",
                  )}
                >
                  {r.yoy == null ? "new" : formatPct(r.yoy)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-border pt-2.5 text-sm text-muted-foreground">
            {merged
              ? `Merged, the three records are one hospital ranked #${heroRank}, and its decline is visible.`
              : "Highlighted rows are the same hospital, recorded three times by different teams and entities. Each looks harmless on its own."}
          </p>
        </div>

        {/* Merge stage */}
        <div className="flex flex-col border-t border-border bg-canvas px-4 py-4 lg:border-t-0">
          <div
            className={cn(
              "relative transition-[height] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]",
              merged ? "h-[10.5rem]" : "h-[17.5rem]",
            )}
          >
            {records.map((r, i) => (
              <div
                key={r.cardCode}
                data-testid={`pulse-hero-record-${i}`}
                className="absolute inset-x-0 top-0 rounded-md border border-border-strong bg-card px-3.5 py-2.5 transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{
                  transform: merged ? "translateY(1rem) scale(0.92)" : `translateY(${i * 5.75}rem)`,
                  opacity: merged ? 0 : 1,
                  pointerEvents: merged ? "none" : "auto",
                  transitionDelay: merged ? `${i * 90}ms` : `${(2 - i) * 70 + 200}ms`,
                  zIndex: 3 - i,
                }}
                aria-hidden={merged}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{r.cardName}</div>
                    <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                      <span className="mono-id text-secondary-foreground">{r.cardCode}</span> · {r.entity} · {r.country}
                    </div>
                  </div>
                  {r.stats ? (
                    <StatusText size="sm" tone={STATUS_TONE[r.stats.status]} className="mt-0.5">
                      {STATUS_LABEL[r.stats.status]}
                    </StatusText>
                  ) : null}
                </div>
                {r.stats ? (
                  <div className="num mt-1 text-xs text-secondary-foreground">
                    {sgdCompact(r.stats.sgdPrior12m)} → {sgdCompact(r.stats.sgd12m)} this year
                  </div>
                ) : null}
              </div>
            ))}

            {hero ? (
              <div
                data-testid="pulse-hero-golden"
                className="absolute inset-x-0 top-0 overflow-hidden rounded-md border border-border-strong bg-card px-4 py-3.5 transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{
                  transform: merged ? "translateY(0) scale(1)" : "translateY(4.5rem) scale(0.94)",
                  opacity: merged ? 1 : 0,
                  transitionDelay: merged ? "380ms" : "0ms",
                  pointerEvents: merged ? "auto" : "none",
                }}
                aria-hidden={!merged}
              >
                <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                  <span className="leading-tight">
                    One hospital · {hero.records} records merged
                    <span className="mt-1 block text-[0.8125rem]">
                      <span className="mono-id text-secondary-foreground">{hero.goldenId}</span>
                    </span>
                  </span>
                  <StatusText tone="stuck" className="font-semibold">
                    #{heroRank} in Malaysia
                  </StatusText>
                </div>
                <div className="font-wide mt-1.5 text-base font-semibold text-foreground">{hero.name}</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="num text-sm text-secondary-foreground">
                    {sgdCompact(hero.sgdPrior12m)} → {sgdCompact(hero.sgd12m)}
                  </div>
                  <div className="num font-wide text-[2rem] leading-none font-semibold text-stuck-ink">
                    {formatPct(hero.yoy)}
                  </div>
                </div>
                <div className="mt-1 text-right text-xs text-muted-foreground">year on year</div>
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-foreground">{merged ? cb.example.dedupStory : cb.example.rawStory}</p>

          {heroAction ? (
            <div
              className={cn(
                "mt-4 border-t border-border-strong pt-3 transition-opacity duration-500",
                merged ? "opacity-100" : "opacity-45",
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {merged ? "What we do about it" : "Hidden until the records are merged"}
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">{heroAction.action}</p>
              {/* Owner, date and value as ruled meta columns: no icons, no chips. */}
              <p className="mt-2.5 flex flex-wrap gap-y-1 text-xs leading-4 text-secondary-foreground [&>span]:border-l [&>span]:border-border-strong [&>span]:px-3 [&>span:first-child]:border-l-0 [&>span:first-child]:pl-0">
                <span>
                  <span className="sr-only">Owner: </span>
                  {heroAction.ownerRole}
                </span>
                <span className="num whitespace-nowrap">By {formatIsoDate(heroAction.byWhen)}</span>
                {heroAction.sgdAddressable != null ? (
                  <span className="num whitespace-nowrap" title="Addressable before conversion">
                    <span className="font-semibold text-foreground">{sgdCompact(heroAction.sgdAddressable)}</span> addressable
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
