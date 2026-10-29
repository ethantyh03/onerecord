"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusText, type StateTone } from "@/components/common";
import { meta, type DataHonestyItem } from "@/data/contract";
import { LINKS } from "@/lib/links";
import { MATCHER_CAVEAT, SEASON_CAVEAT } from "./caveats";
import {
  MODEL_LIMITS,
  NEEDS_LIVE_DATA,
  VALIDATED_HERE,
  honestyItem,
  patternDescription,
  patternName,
  patternSource,
} from "./copy";

type ShownStatus = DataHonestyItem["status"] | "limitation";
type ShownItem = { item: string; status: ShownStatus; detail: string };

/** Status as text (glyph + word in the state's ink), not a tinted chip. Planned violet for what needs live data. */
const STATUS: Record<ShownStatus, { label: string; tone: StateTone; hollow?: boolean }> = {
  synthetic: { label: "Synthetic", tone: "neutral" },
  assumption: { label: "Assumption", tone: "warn", hollow: true },
  validated: { label: "Validated", tone: "ok" },
  limitation: { label: "Limitation", tone: "warn" },
  needs_pilot: { label: "Needs live data", tone: "phase2" },
};

const ORDER: ShownStatus[] = ["synthetic", "assumption", "validated", "limitation", "needs_pilot"];

/** A limit presented as a validation reads as over-claiming: the season-dependence finding is a limitation. */
function shownItems(): ShownItem[] {
  const base: ShownItem[] = meta.dataHonesty.map((it) =>
    /season dependence/i.test(it.item)
      ? { item: "The forecast gain depends on the season", status: "limitation", detail: SEASON_CAVEAT }
      : honestyItem(it),
  );
  base.push({ item: "Merged customers on live data", status: "needs_pilot", detail: MATCHER_CAVEAT });
  return base.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
}

/** The built-in stuck-demand check is measured on the synthetic history, not the live sandbox store. */
function assertionText(name: string, assertion: string): string {
  if (!/stuck demand/i.test(name)) return assertion;
  const m = assertion.match(/Measured:\s*(\d+)/);
  const k = m ? `S$${Math.round(Number(m[1]) / 1000)}k` : "";
  return `Synthetic-history check on 28 Oct (12 blocked PRs): ${k}, inside S$150–450k (pass). The live Stuck demand tile also counts the sandbox's open requests, so it reads higher.`;
}

interface HonestyCtx {
  open: () => void;
}
const Ctx = createContext<HonestyCtx | null>(null);

/** Opens the page's single "About this data" drawer from anywhere inside the provider. */
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
  label = "About this data",
  testId = "honesty-drawer-open",
  variant = "outline",
  icon = true,
  className,
}: {
  label?: string;
  testId?: string;
  /** "outline" (default) for the footer control; "ghost" where it sits in a line of quiet meta text */
  variant?: "outline" | "ghost";
  /** Lead with the info icon (off where the button sits in a line of quiet meta text) */
  icon?: boolean;
  className?: string;
}) {
  const ctx = useHonestyDrawer();
  return (
    <Button variant={variant} size="sm" data-testid={testId} className={className} onClick={() => ctx?.open()}>
      {icon ? <Info /> : null}
      {label}
    </Button>
  );
}

/** Sheet listing what is synthetic, the built-in test patterns and their sources, what is validated, the SAP B1 source tables and model limits. */
function HonestySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = shownItems();
  const sources = meta.pilotPlan.sapMapping;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        data-testid="honesty-drawer"
      >
        <SheetHeader className="border-b px-6 pt-5 pb-4">
          <SheetTitle className="pr-8 text-lg font-semibold">About this data</SheetTitle>
          <SheetDescription>
            In this sandbox, Regional Pulse runs on synthetic data (seed {meta.seed}) with known patterns built in, so each
            method can be checked against them. Good scores show the pipeline works, not that the patterns exist in Lives
            Group&apos;s live data.
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
            title="Built-in test patterns and their sources"
            note="The generator checks each one before the data is accepted; if a check fails, the data is regenerated."
          >
            <ul className="divide-y divide-border border-y border-border">
              {meta.plantedPatterns.map((p) => (
                <li key={p.id} className="py-2.5 text-sm">
                  <div className="font-medium">{patternName(p.name)}</div>
                  <p className="mt-0.5 text-sm leading-snug text-secondary-foreground">{patternDescription(p.description)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-secondary-foreground">Source:</span> {patternSource(p.id, p.source)}
                    </span>
                    <span>
                      <span className="font-medium text-secondary-foreground">Check:</span> {assertionText(p.name, p.assertion)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Validated vs needs live SAP B1 data">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 sm:divide-x sm:divide-border">
              <div>
                <StatusText tone="ok" className="text-sm">
                  Validated on synthetic data
                </StatusText>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
                  {VALIDATED_HERE.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
              <div className="sm:pl-6">
                <StatusText tone="phase2" className="text-sm">
                  Needs live SAP B1 data
                </StatusText>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
                  {NEEDS_LIVE_DATA.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Block>

          <Block title="SAP B1 source tables" note="The same pipeline reruns unchanged on extracts of these tables.">
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
                  {sources.map((m) => (
                    <tr key={m.sapTable} className="border-b border-border align-top last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium">
                          <span className="mono-id">{m.sapTable}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{m.sapDescription}</div>
                      </td>
                      <td className="px-3 py-2">{m.feeds}</td>
                      <td className="px-3 py-2 text-sm text-secondary-foreground">
                        <span className="mono-id">{m.keyFields.join(", ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">SAP B1 holds 24–36 months of PO history.</p>
          </Block>

          <Block title="Model limits">
            <ul className="list-disc space-y-1 pl-4 text-[0.8125rem] text-secondary-foreground">
              {MODEL_LIMITS.map((l) => (
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
              Model parameters
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
