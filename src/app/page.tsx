import { GoldenRecord } from "@/components/shell/landing/golden-record";
import { LandingHero } from "@/components/shell/landing/landing-hero";
import { LandingKpis } from "@/components/shell/landing/landing-kpis";
import { PersonaCards } from "@/components/shell/landing/persona-cards";
import { ProcessDiagram } from "@/components/shell/landing/process-diagram";

export default function HomePage() {
  return (
    <div className="space-y-7 pb-4">
      <LandingHero />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] xl:items-start">
        <GoldenRecord />
        <LandingKpis />
      </div>
      <ProcessDiagram />
      <PersonaCards />
    </div>
  );
}
