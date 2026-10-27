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

/** Closed-by-default section for the deep-dive panels below the country actions. Native <details>: no state. */
function MoreSection({ id, title, summary, children }: { id: string; title: string; summary: string; children: ReactNode }) {
  return (
    <details id={id} data-testid={id} className="group scroll-mt-24 rounded-xl border bg-card shadow-raised open:border-transparent open:bg-transparent open:shadow-none">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none group-open:mb-3 group-open:border group-open:bg-card [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="min-w-0">
          <span className="block text-base font-semibold text-foreground">{title}</span>
          <span className="block text-sm text-muted-foreground">{summary}</span>
        </span>
        <span className="ml-auto shrink-0 text-sm font-medium text-primary group-open:hidden">Show</span>
        <span className="ml-auto hidden shrink-0 text-sm font-medium text-primary group-open:inline">Hide</span>
      </summary>
      {children}
    </details>
  );
}

export default function PulsePage() {
  return (
    <PulseProvider>
      <DataHonestyProvider>
        <div className="space-y-7 pb-4">
          <PulseHeader />
          <PulseKpis />
          <CountryProductMatrix />
          <StreamsPanel />
          <HeroReveal />
          <section id="pulse-forecast" aria-label="Forecast" className="scroll-mt-24 space-y-7">
            <ForecastPanel />
            <Scorecard />
          </section>
          <CountryActions />
          <section aria-label="Can we trust it, growth bridge and signals" className="space-y-4">
            <MoreSection
              id="pulse-more-trust"
              title="Can we trust it?"
              summary="Duplicate finder tested on unseen countries, a no-signal stress test, clean data vs model, inbound sorting accuracy."
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
          <footer className="flex flex-col gap-3 border-t pt-5 md:flex-row md:items-center md:justify-between">
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
