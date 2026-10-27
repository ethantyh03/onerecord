"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { PulseProvider } from "@/components/pulse/core/PulseContext";
import { PulseHeader } from "@/components/pulse/core/PulseHeader";
import { PulseKpis } from "@/components/pulse/core/PulseKpis";
import { CountryProductMatrix } from "@/components/pulse/core/CountryProductMatrix";
import { StreamsPanel } from "@/components/pulse/core/StreamsPanel";
import { HeroReveal } from "@/components/pulse/core/HeroReveal";
import { CountryActions } from "@/components/pulse/core/CountryActions";
import {
  DataHonestyDrawer,
  ForecastPanel,
  GrowthBridge,
  Scorecard,
  SignalsTables,
  TrustPanel,
} from "@/components/pulse/analytics";

export default function PulsePage() {
  return (
    <PulseProvider>
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
        <section aria-label="Can we trust it, growth bridge and signals" className="space-y-7">
          <TrustPanel />
          <GrowthBridge />
          <SignalsTables />
        </section>
        <footer className="flex flex-col gap-3 border-t pt-5 md:flex-row md:items-center md:justify-between">
          <Link
            href="/triage"
            data-testid="pulse-triage-link"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            <Inbox aria-hidden className="size-4" />
            Inbound sorting: how POs, PRs, enquiries and MDM requests are told apart
          </Link>
          <DataHonestyDrawer />
        </footer>
      </div>
    </PulseProvider>
  );
}
