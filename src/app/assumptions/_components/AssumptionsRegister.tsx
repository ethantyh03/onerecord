"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
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

function TagPill({ tag }: { tag: AssumptionTag }) {
  const m = TAG_META[tag];
  return (
    <span
      title={m.hint}
      className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[0.6875rem] font-medium whitespace-nowrap", m.cls)}
    >
      {m.label}
    </span>
  );
}

function AssumptionCard({ a }: { a: Assumption }) {
  return (
    <article
      id={a.id}
      data-testid={`assumption-${a.id}`}
      className="grid scroll-mt-24 gap-x-5 gap-y-2 border-b px-5 py-4 last:border-b-0 md:grid-cols-[4.5rem_minmax(0,1fr)]"
    >
      <div className="num text-[1.375rem] leading-none font-semibold tracking-[-0.02em] text-primary">{a.id}</div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="text-[0.9375rem] font-semibold">{a.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            {a.tags.map((t) => (
              <TagPill key={t} tag={t} />
            ))}
          </div>
        </div>
        <p className="max-w-[86ch] text-[0.9375rem] leading-relaxed text-foreground">{a.value}</p>
        <p className="max-w-[86ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
          <span className="font-medium text-secondary-foreground">Basis: </span>
          {a.basis}
        </p>
        {a.usedIn ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Shows up in:</span> {a.usedIn}
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
      <nav aria-label="Assumption groups" className="lg:sticky lg:top-20 lg:self-start">
        <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
          {groups.map((g) => (
            <li key={g.id}>
              <a
                href={`#group-${g.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm text-secondary-foreground hover:bg-muted hover:text-foreground"
              >
                {g.title}
                <span className="num text-xs text-muted-foreground">{g.items.length}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-5 hidden space-y-2 border-t pt-4 text-xs text-muted-foreground lg:block">
          <p>Every number in OneRecord that is not a cited fact traces back to one of these.</p>
          <p>Change an assumption here first, then rerun the pipeline.</p>
        </div>
      </nav>

      <div className="min-w-0 space-y-5">
        <div className="space-y-3">
          <div className="relative max-w-xl">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search, e.g. dengue, licence, credit, A22"
              aria-label="Search assumptions"
              data-testid="assumptions-search"
              className="h-10 pl-9 text-[0.9375rem]"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by label">
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
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active ? "border-foreground bg-foreground text-background" : "bg-card text-secondary-foreground hover:border-border-strong",
                  )}
                >
                  {TAG_META[t].label}
                  <span className={cn("num", active ? "opacity-80" : "text-muted-foreground")}>{counts[t]}</span>
                </button>
              );
            })}
            <span aria-live="polite" className="ml-1 text-xs text-muted-foreground">
              Showing {shown} of {ALL_ASSUMPTIONS.length}
            </span>
          </div>
        </div>

        {shown === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
            <p className="text-sm font-medium">No assumption matches &ldquo;{q}&rdquo;{tag ? ` with the label ${TAG_META[tag].label}` : ""}.</p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
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
              <section key={g.id} id={`group-${g.id}`} className="scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-raised">
                <header className="border-b bg-muted/40 px-5 py-3">
                  <h2 className="text-base font-semibold">{g.title}</h2>
                  <p className="text-[0.8125rem] text-muted-foreground">{g.blurb}</p>
                </header>
                {g.items.map((a) => (
                  <AssumptionCard key={a.id} a={a} />
                ))}
              </section>
            ))
        )}
      </div>
    </div>
  );
}
