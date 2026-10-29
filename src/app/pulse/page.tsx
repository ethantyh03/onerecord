"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { PulseProvider } from "@/components/pulse/core/PulseContext";
import { PulseHeader } from "@/components/pulse/core/PulseHeader";
import { PulseKpis } from "@/components/pulse/core/PulseKpis";
import { CountryProductMatrix } from "@/components/pulse/core/CountryProductMatrix";
import { StreamsPanel } from "@/components/pulse/core/StreamsPanel";
import { HeroReveal } from "@/components/pulse/core/HeroReveal";
import { CountryActions } from "@/components/pulse/core/CountryActions";
import {
  DataHonestyDrawer,
  DataHonestyProvider,
  ForecastPanel,
  GrowthBridge,
  Scorecard,
  SignalsTables,
  TrustPanel,
} from "@/components/pulse/analytics";

/**
 * Closed-by-default deep dive below the country actions: one ruled row of a list (not a card), opening onto its
 * panel. Native <details>: no state.
 */
function MoreSection({ id, title, summary, children }: { id: string; title: string; summary: string; children: ReactNode }) {
  return (
    <details id={id} data-testid={id} className="group scroll-mt-24">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-3 pr-1 transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="ml-1 size-4 shrink-0 text-subtle transition-transform group-open:rotate-90" />
        <span className="min-w-0">
          <span className="panel-title block">{title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{summary}</span>
        </span>
        <span className="ml-auto shrink-0 text-sm font-medium text-muted-foreground group-open:hidden">Show</span>
        <span className="ml-auto hidden shrink-0 text-sm font-medium text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <div className="pt-1 pb-5">{children}</div>
    </details>
  );
}

export default function PulsePage() {
  return (
    <PulseProvider>
      <DataHonestyProvider>
        <div className="space-y-6 pb-4">
          <PulseHeader />
          <PulseKpis />
          <CountryProductMatrix />
          <StreamsPanel />
          <HeroReveal />
          <section id="pulse-forecast" aria-label="Forecast" className="scroll-mt-24 space-y-6">
            <ForecastPanel />
            <Scorecard />
          </section>
          <CountryActions />
          <section
            aria-label="Model quality, growth bridge and signals"
            className="divide-y divide-border border-y border-border"
          >
            <MoreSection
              id="pulse-more-trust"
              title="Model quality"
              summary="Duplicate finder accuracy, forecast stability, the effect of clean data, and inbox sorting accuracy."
            >
              <TrustPanel />
            </MoreSection>
            <MoreSection
              id="pulse-more-bridge"
              title="Where growth came from"
              summary="New, expanding, declining and lost customers per country, raw vs merged."
            >
              <GrowthBridge />
            </MoreSection>
            <MoreSection
              id="pulse-more-signals"
              title="Customers to act on"
              summary="Drop-off risk and cross-sell gaps on merged customers, with S$ before conversion."
            >
              <SignalsTables />
            </MoreSection>
          </section>
          <footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link
              href="/triage"
              data-testid="pulse-triage-link"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              <Inbox aria-hidden className="size-4" />
              Inbox triage: how POs, PRs, enquiries and MDM requests are told apart
            </Link>
            <DataHonestyDrawer testId="honesty-drawer-open-footer" />
          </footer>
        </div>
      </DataHonestyProvider>
    </PulseProvider>
  );
}
