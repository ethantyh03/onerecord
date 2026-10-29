"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { SectionTitle, StatusText, type StateTone } from "@/components/common";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_ASSUMPTIONS, ASSUMPTION_GROUPS, TAG_META, type Assumption, type AssumptionTag } from "../_data";

const TAG_ORDER: AssumptionTag[] = ["illustrative", "team-estimate", "research", "policy", "amended", "low-confidence"];

function matches(a: Assumption, q: string): boolean {
  if (!q) return true;
  const hay = `${a.id} ${a.title} ${a.value} ${a.basis} ${a.usedIn ?? ""} ${a.tags.map((t) => TAG_META[t].label).join(" ")}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/**
 * Provenance as quiet status text (a small square + the label), not a coloured chip. Ink only where the label
 * asks something of the reader: research = verified (green), a policy choice needs agreeing (amber), low
 * confidence is a caution (hollow amber). Estimates and amendments are neutral; illustrative is hollow grey.
 */
const TAG_TONE: Record<AssumptionTag, { tone: StateTone; hollow?: boolean }> = {
  illustrative: { tone: "waiting" },
  research: { tone: "ok" },
  "team-estimate": { tone: "neutral" },
  amended: { tone: "neutral" },
  policy: { tone: "warn" },
  "low-confidence": { tone: "warn", hollow: true },
};

function TagPill({ tag }: { tag: AssumptionTag }) {
  const m = TAG_META[tag];
  const t = TAG_TONE[tag];
  return (
    <StatusText size="sm" tone={t.tone} hollow={t.hollow} title={m.hint}>
      {m.label}
    </StatusText>
  );
}

function AssumptionCard({ a }: { a: Assumption }) {
  return (
    <article
      id={a.id}
      data-testid={`assumption-${a.id}`}
      className="grid scroll-mt-24 gap-x-5 gap-y-2 border-b border-border py-4 last:border-b-0 md:grid-cols-[3.5rem_minmax(0,1fr)]"
    >
      <div className="pt-px text-base leading-5">
        <code className="mono-id text-foreground">{a.id}</code>
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="text-[0.9375rem] leading-5 font-semibold text-foreground">{a.title}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {a.tags.map((t) => (
              <TagPill key={t} tag={t} />
            ))}
          </div>
        </div>
        <p className="max-w-[86ch] text-[0.9375rem] leading-relaxed text-foreground">{a.value}</p>
        <p className="max-w-[86ch] text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-secondary-foreground">Basis: </span>
          {a.basis}
        </p>
        {a.usedIn ? (
          <p className="text-xs leading-5 text-subtle">
            <span className="font-medium text-muted-foreground">Shows up in:</span> {a.usedIn}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function AssumptionsRegister() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<AssumptionTag | null>(null);

  const groups = useMemo(
    () =>
      ASSUMPTION_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((a) => matches(a, q.trim()) && (!tag || a.tags.includes(tag))),
      })),
    [q, tag],
  );
  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  const counts = useMemo(() => {
    const c = {} as Record<AssumptionTag, number>;
    for (const t of TAG_ORDER) c[t] = ALL_ASSUMPTIONS.filter((a) => a.tags.includes(t)).length;
    return c;
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Assumption groups" className="lg:sticky lg:top-[4.5rem] lg:self-start">
        <ul className="flex flex-wrap gap-x-1 gap-y-0.5 lg:flex-col lg:gap-0 lg:border-l lg:border-border">
          {groups.map((g) => (
            <li key={g.id}>
              <a
                href={`#group-${g.id}`}
                className="flex items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-sm text-secondary-foreground transition-colors outline-none hover:bg-secondary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring lg:rounded-none lg:px-3"
              >
                {g.title}
                <span className="num text-xs text-subtle">{g.items.length}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-5 hidden space-y-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground lg:block">
          <p>Every number in OneRecord that is not a cited fact traces back to one of these.</p>
          <p>Change an assumption here first, then rerun the pipeline.</p>
        </div>
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="space-y-2.5">
          <div className="relative max-w-xl">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search, e.g. dengue, licence, credit, A22"
              aria-label="Search assumptions"
              data-testid="assumptions-search"
              className="h-9 pl-9 text-[0.9375rem]"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by label">
            {TAG_ORDER.map((t) => {
              const active = tag === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  data-testid={`assumptions-tag-${t}`}
                  onClick={() => setTag(active ? null : t)}
                  title={TAG_META[t].hint}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  {TAG_META[t].label}
                  <span className={cn("num text-xs", active ? "text-muted-foreground" : "text-subtle")}>{counts[t]}</span>
                </button>
              );
            })}
            <span aria-live="polite" className="ml-2 text-xs text-muted-foreground">
              Showing {shown} of {ALL_ASSUMPTIONS.length}
            </span>
          </div>
        </div>

        {shown === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[0.9375rem] font-medium text-muted-foreground">
              No assumption matches &ldquo;{q}&rdquo;{tag ? ` with the label ${TAG_META[tag].label}` : ""}.
            </p>
            <button
              type="button"
              className="mt-2 rounded-sm text-sm font-medium text-primary underline decoration-primary/35 underline-offset-4 outline-none hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => {
                setQ("");
                setTag(null);
              }}
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.id} id={`group-${g.id}`} aria-labelledby={`group-${g.id}-title`} className="scroll-mt-24 pt-4 first:pt-0">
                <SectionTitle id={`group-${g.id}-title`} title={g.title} count={g.items.length} description={g.blurb} />
                <div className="mt-2 border-t border-border">
                  {g.items.map((a) => (
                    <AssumptionCard key={a.id} a={a} />
                  ))}
                </div>
              </section>
            ))
        )}
      </div>
    </div>
  );
}
