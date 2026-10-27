"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, FlaskConical, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SyntheticBadge } from "@/components/common";
import { meta, type DataHonestyItem } from "@/data/contract";
import { LINKS } from "@/lib/links";
import { cn } from "@/lib/utils";
import { MATCHER_CAVEAT, SEASON_CAVEAT } from "./caveats";

type ShownStatus = DataHonestyItem["status"] | "limitation";
type ShownItem = { item: string; status: ShownStatus; detail: string };

const STATUS: Record<ShownStatus, { label: string; cls: string }> = {
  synthetic: { label: "Synthetic", cls: "border-border-strong bg-muted text-secondary-foreground" },
  assumption: { label: "Assumption", cls: "border-warn/50 bg-warn-soft text-warn-ink" },
  validated: { label: "Validated here", cls: "border-ok/50 bg-ok-soft text-ok-ink" },
  limitation: { label: "Limitation", cls: "border-warn bg-card text-warn-ink" },
  needs_pilot: { label: "Needs a pilot", cls: "border-dashed border-phase2 bg-phase2-soft text-phase2-ink" },
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
  className,
}: {
  label?: string;
  testId?: string;
  className?: string;
}) {
  const ctx = useHonestyDrawer();
  return (
    <Button variant="outline" size="sm" data-testid={testId} className={className} onClick={() => ctx?.open()}>
      <FlaskConical />
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
            <ul className="divide-y rounded-lg border">
              {items.map((it) => (
                <li key={it.item} className="flex items-start gap-3 px-3.5 py-2.5">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-5 w-[6.75rem] shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-medium",
                      STATUS[it.status].cls,
                    )}
                  >
                    {STATUS[it.status].label}
                  </span>
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
            <ul className="space-y-2">
              {meta.plantedPatterns.map((p) => (
                <li key={p.id} className="rounded-lg border px-3.5 py-2.5 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <p className="mt-0.5 text-[0.8125rem] leading-snug text-secondary-foreground">{p.description}</p>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-ok/40 bg-ok-soft/50 px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-ok-ink">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Validated on synthetic data
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
                  {meta.validatedVsPilot.validatedHere.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-dashed border-phase2 bg-phase2-soft/50 px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-phase2-ink">
                  <ShieldQuestion className="size-4" aria-hidden />
                  Needs real SAP B1 data
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
                  {meta.validatedVsPilot.needsPilot.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Block>

          <Block title={`Pilot plan · ${pilot.weeks} weeks`} note={pilot.summary}>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">SAP B1 table</th>
                    <th className="px-3 py-2 text-left font-medium">Feeds</th>
                    <th className="px-3 py-2 text-left font-medium">Key fields</th>
                  </tr>
                </thead>
                <tbody>
                  {pilot.sapMapping.map((m) => (
                    <tr key={m.sapTable} className="border-b align-top last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-mono text-[0.8125rem] font-medium">{m.sapTable}</div>
                        <div className="text-xs text-muted-foreground">{m.sapDescription}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{m.feeds}</div>
                        <div className="font-mono text-xs text-muted-foreground">{m.ourFile}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-secondary-foreground">{m.keyFields.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="space-y-1.5 text-[0.8125rem]">
              {pilot.steps.map((s) => (
                <li key={s} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
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
