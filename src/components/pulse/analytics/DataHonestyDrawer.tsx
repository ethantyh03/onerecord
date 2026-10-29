"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, FlaskConical } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusText, SyntheticBadge, type StateTone } from "@/components/common";
import { meta, type DataHonestyItem } from "@/data/contract";
import { LINKS } from "@/lib/links";
import { MATCHER_CAVEAT, SEASON_CAVEAT } from "./caveats";

type ShownStatus = DataHonestyItem["status"] | "limitation";
type ShownItem = { item: string; status: ShownStatus; detail: string };

/** Status as text (glyph + word in the state's ink), not a tinted chip. Phase-2 violet for what needs a pilot. */
const STATUS: Record<ShownStatus, { label: string; tone: StateTone; hollow?: boolean }> = {
  synthetic: { label: "Synthetic", tone: "neutral" },
  assumption: { label: "Assumption", tone: "warn", hollow: true },
  validated: { label: "Validated here", tone: "ok" },
  limitation: { label: "Limitation", tone: "warn" },
  needs_pilot: { label: "Needs a pilot", tone: "phase2" },
};

const ORDER: ShownStatus[] = ["synthetic", "assumption", "validated", "limitation", "needs_pilot"];

/** A limit presented as a validation reads as over-claiming: the season-dependence finding is a limitation. */
function shownItems(): ShownItem[] {
  const base: ShownItem[] = meta.dataHonesty.map((it) =>
    /season dependence/i.test(it.item)
      ? { item: "The forecast gain depends on the season", status: "limitation", detail: SEASON_CAVEAT }
      : it,
  );
  base.push({ item: "Merged customers in a pilot", status: "needs_pilot", detail: MATCHER_CAVEAT });
  return base.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
}

/** The planted stuck-demand check is measured on the synthetic history, not the live demo store. */
function assertionText(name: string, assertion: string): string {
  if (!/stuck demand/i.test(name)) return assertion;
  const m = assertion.match(/Measured:\s*(\d+)/);
  const k = m ? `S$${Math.round(Number(m[1]) / 1000)}k` : "";
  return `Synthetic-history check on 28 Oct (12 blocked PRs): ${k}, inside S$150–450k (pass). The live Stuck demand tile also counts the requests scripted for the demo, so it reads higher.`;
}

interface HonestyCtx {
  open: () => void;
}
const Ctx = createContext<HonestyCtx | null>(null);

/** Opens the page's single "What's real here?" drawer from anywhere inside the provider. */
export function useHonestyDrawer(): HonestyCtx | null {
  return useContext(Ctx);
}

function Block({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
        {note ? <p className="text-[0.8125rem] text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

const PARAMS_URL = `${LINKS.github}/blob/main/analytics/params.yaml`;

/** Provides one drawer for the whole page; triggers anywhere inside call useHonestyDrawer().open(). */
export function DataHonestyProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <HonestySheet open={isOpen} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
}

/** Button that opens the drawer. Rendered in the page header and the footer. */
export function DataHonestyDrawer({
  label = "What's real here?",
  testId = "honesty-drawer-open",
  variant = "outline",
  icon = true,
  className,
}: {
  label?: string;
  testId?: string;
  /** "outline" (default) for the footer control; "ghost" where it sits in a line of quiet meta text */
  variant?: "outline" | "ghost";
  /** Lead with the flask (off when a provenance marker with its own flask sits right before it) */
  icon?: boolean;
  className?: string;
}) {
  const ctx = useHonestyDrawer();
  return (
    <Button variant={variant} size="sm" data-testid={testId} className={className} onClick={() => ctx?.open()}>
      {icon ? <FlaskConical /> : null}
      {label}
    </Button>
  );
}

/** Sheet listing what is synthetic, the planted patterns and their sources, validated vs pilot, and the pilot plan. */
function HonestySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = shownItems();
  const pilot = meta.pilotPlan;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        data-testid="honesty-drawer"
      >
        <SheetHeader className="border-b px-6 pt-5 pb-4">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="text-lg font-semibold">What&apos;s real on this page</SheetTitle>
            <SyntheticBadge />
          </div>
          <SheetDescription>
            Every number on Regional Pulse comes from synthetic data generated with seed {meta.seed}. We planted known patterns
            so you can check that the methods find them. Good scores here show the pipeline works, not that the patterns exist
            in Lives Group&apos;s data.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-7 px-6 py-5">
          <Block title="What is synthetic, assumed or tested">
            <ul className="divide-y divide-border border-y border-border">
              {items.map((it) => (
                <li key={it.item} className="flex items-start gap-3 py-2.5">
                  <StatusText
                    size="sm"
                    tone={STATUS[it.status].tone}
                    hollow={STATUS[it.status].hollow}
                    className="mt-0.5 w-[7.25rem]"
                  >
                    {STATUS[it.status].label}
                  </StatusText>
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">{it.item}</div>
                    <div className="text-[0.8125rem] text-muted-foreground">{it.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Block>

          <Block
            title="Patterns we planted, and where each comes from"
            note="The generator checks each one before the data is accepted; if a check fails, the data is regenerated."
          >
            <ul className="divide-y divide-border border-y border-border">
              {meta.plantedPatterns.map((p) => (
                <li key={p.id} className="py-2.5 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <p className="mt-0.5 text-sm leading-snug text-secondary-foreground">{p.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-secondary-foreground">Source:</span> {p.source}
                    </span>
                    <span>
                      <span className="font-medium text-secondary-foreground">Check:</span> {assertionText(p.name, p.assertion)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Validated here vs needs a pilot">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 sm:divide-x sm:divide-border">
              <div>
                <StatusText tone="ok" className="text-sm">
                  Validated on synthetic data
                </StatusText>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
                  {meta.validatedVsPilot.validatedHere.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
              <div className="sm:pl-6">
                <StatusText tone="phase2" className="text-sm">
                  Needs real SAP B1 data
                </StatusText>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
                  {meta.validatedVsPilot.needsPilot.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Block>

          <Block title={`Pilot plan · ${pilot.weeks} weeks`} note={pilot.summary}>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-xs text-subtle">
                  <tr className="border-b border-border-strong">
                    <th className="px-3 py-2 text-left font-medium">SAP B1 table</th>
                    <th className="px-3 py-2 text-left font-medium">Feeds</th>
                    <th className="px-3 py-2 text-left font-medium">Key fields</th>
                  </tr>
                </thead>
                <tbody>
                  {pilot.sapMapping.map((m) => (
                    <tr key={m.sapTable} className="border-b border-border align-top last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium">
                          <span className="mono-id">{m.sapTable}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{m.sapDescription}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{m.feeds}</div>
                        <div className="text-sm text-muted-foreground">
                          <span className="mono-id">{m.ourFile}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-secondary-foreground">
                        <span className="mono-id">{m.keyFields.join(", ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="space-y-1.5 text-[0.8125rem]">
              {pilot.steps.map((s) => (
                <li key={s} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-subtle" />
                  <span className="text-secondary-foreground">{s}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              A27: SAP B1 already holds ≥ 24–36 months of PO history; the 6–12-month limit is a spreadsheet habit, not a data
              limit.
            </p>
          </Block>

          <Block title="Model limits">
            <ul className="list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
              <li>{MATCHER_CAVEAT}</li>
              {meta.modelCard.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Block>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <a
              href={PARAMS_URL}
              target="_blank"
              rel="noreferrer"
              data-testid="honesty-params-link"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink />
              Every parameter: analytics/params.yaml
            </a>
            <Link href="/assumptions" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Assumptions register
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
