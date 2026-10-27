"use client";

import { useMemo } from "react";
import { CalendarClock, Combine, SplitSquareVertical, UserRound } from "lucide-react";
import { actions, bridge, type TopAccountRaw } from "@/data/contract";
import { SyntheticBadge } from "@/components/common/badges";
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

const STATUS_CLASS: Record<TopAccountRaw["status"], string> = {
  new: "border-ok/40 bg-ok-soft text-ok-ink",
  lost: "border-stuck/40 bg-stuck-soft text-stuck-ink",
  flat: "border-border-strong bg-muted text-secondary-foreground",
  expanding: "border-border bg-card text-secondary-foreground",
  declining: "border-border bg-card text-secondary-foreground",
};

interface Row {
  key: string;
  rank: number;
  name: string;
  sub: string;
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
        sub: a.records > 1 ? `${a.records} SAP records merged · ${a.goldenId}` : a.goldenId,
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

  const records = cb.example.records.map((r) => ({
    ...r,
    stats: cb.topAccounts.raw.find((a) => a.cardCode === r.cardCode),
  }));
  const heroAction = card?.actions[0];

  return (
    <section
      aria-labelledby="pulse-hero-title"
      data-testid="pulse-hero"
      data-view={view}
      className="overflow-hidden rounded-xl border bg-card shadow-raised"
    >
      <div className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pulse-hero-title" className="text-lg font-semibold tracking-[-0.01em]">
              Duplicates hide the truth: Malaysia&apos;s top accounts
            </h2>
            <SyntheticBadge />
          </div>
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
        <div className="px-5 py-4 lg:border-r">
          <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
            <span>
              {merged ? "Top 10 customers, merged (one row per hospital)" : "Top 10 customers, raw (one row per SAP record)"}
            </span>
            <span>Last 12 months · YoY</span>
          </div>
          <ol className="space-y-1" aria-live="polite">
            {rows.map((r) => (
              <li
                key={r.key}
                className={cn(
                  "relative grid grid-cols-[1.5rem_minmax(0,1fr)_4.75rem_4.25rem] items-center gap-x-3 rounded-md px-2 py-1.5",
                  r.isHero && merged && "bg-stuck-soft animate-in fade-in-0 slide-in-from-bottom-2 duration-700",
                  r.isHero && !merged && "bg-warn-soft/70",
                )}
              >
                {r.isHero ? (
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-1 left-0 w-[3px] rounded-r-full", merged ? "bg-stuck" : "bg-warn")}
                  />
                ) : null}
                <span className="num text-right text-sm font-medium text-muted-foreground">{r.rank}</span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate text-sm text-foreground", r.isHero && "font-semibold")}>{r.name}</span>
                    {r.status && (r.status === "new" || r.status === "lost" || r.isHero) ? (
                      <span
                        className={cn(
                          "inline-flex h-[1.125rem] shrink-0 items-center rounded-full border px-1.5 text-[0.625rem] font-medium",
                          STATUS_CLASS[r.status],
                        )}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{
                          width: `${Math.max(2, (r.sgd12m / maxSgd) * 100)}%`,
                          background: r.isHero ? (merged ? "var(--stuck)" : "var(--warn)") : "var(--chart-1)",
                        }}
                      />
                    </span>
                    <span className="hidden w-40 shrink-0 truncate text-[0.6875rem] text-muted-foreground sm:block">{r.sub}</span>
                  </div>
                </div>
                <span className="num text-right text-sm font-medium text-foreground">{sgdCompact(r.sgd12m)}</span>
                <span
                  className={cn(
                    "num text-right text-sm",
                    r.isHero && merged ? "font-semibold text-stuck-ink" : "text-secondary-foreground",
                  )}
                >
                  {r.yoy == null ? "new" : formatPct(r.yoy)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            {merged
              ? `Merged, the three records are one hospital ranked #${heroRank}, and its decline is visible.`
              : "Highlighted rows are the same hospital, recorded three times by different teams and entities. Each looks harmless on its own."}
          </p>
        </div>

        {/* Merge stage */}
        <div className="flex flex-col bg-canvas/60 px-5 py-4">
          <div className="relative h-[17.5rem]">
            {records.map((r, i) => (
              <div
                key={r.cardCode}
                data-testid={`pulse-hero-record-${i}`}
                className="absolute inset-x-0 top-0 rounded-lg border border-warn/50 bg-card px-3.5 py-2.5 shadow-raised transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{
                  transform: merged ? "translateY(5.5rem) scale(0.92)" : `translateY(${i * 5.75}rem)`,
                  opacity: merged ? 0 : 1,
                  transitionDelay: merged ? `${i * 90}ms` : `${(2 - i) * 70 + 200}ms`,
                  zIndex: 3 - i,
                }}
                aria-hidden={merged}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{r.cardName}</div>
                    <div className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                      {r.cardCode} · {r.entity} · {r.country}
                    </div>
                  </div>
                  {r.stats ? (
                    <span
                      className={cn(
                        "inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[0.6875rem] font-medium",
                        STATUS_CLASS[r.stats.status],
                      )}
                    >
                      {STATUS_LABEL[r.stats.status]}
                    </span>
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
                className="absolute inset-x-0 top-0 rounded-xl border-2 border-stuck/60 bg-card px-4 py-3.5 shadow-float transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{
                  transform: merged ? "translateY(3.5rem) scale(1)" : "translateY(4.5rem) scale(0.94)",
                  opacity: merged ? 1 : 0,
                  transitionDelay: merged ? "380ms" : "0ms",
                  pointerEvents: merged ? "auto" : "none",
                }}
                aria-hidden={!merged}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    One hospital · {hero.goldenId} · {hero.records} records merged
                  </span>
                  <span className="rounded-full bg-stuck px-1.5 py-px text-[0.625rem] font-semibold text-stuck-foreground">
                    #{heroRank} in Malaysia
                  </span>
                </div>
                <div className="mt-1.5 text-base font-semibold text-foreground">{hero.name}</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="num text-sm text-secondary-foreground">
                    {sgdCompact(hero.sgdPrior12m)} → {sgdCompact(hero.sgd12m)}
                  </div>
                  <div className="num text-[2rem] leading-none font-semibold tracking-[-0.02em] text-stuck-ink">
                    {formatPct(hero.yoy)}
                  </div>
                </div>
                <div className="mt-1 text-right text-[0.6875rem] text-muted-foreground">year on year</div>
              </div>
            ) : null}
          </div>

          <p className="text-sm text-foreground">{merged ? cb.example.dedupStory : cb.example.rawStory}</p>

          {heroAction ? (
            <div
              className={cn(
                "mt-3 rounded-lg border bg-card px-3.5 py-3 transition-opacity duration-500",
                merged ? "opacity-100" : "opacity-45",
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {merged ? "What we do about it" : "Hidden until the records are merged"}
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">{heroAction.action}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary-foreground">
                <span className="inline-flex items-center gap-1">
                  <UserRound aria-hidden className="size-3.5" />
                  {heroAction.ownerRole}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock aria-hidden className="size-3.5" />
                  By {formatIsoDate(heroAction.byWhen)}
                </span>
                {heroAction.sgdAddressable != null ? (
                  <span className="num">{sgdCompact(heroAction.sgdAddressable)} addressable, before conversion</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
