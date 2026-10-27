import { LandingHero } from "@/components/shell/landing/landing-hero";
import { LandingKpis } from "@/components/shell/landing/landing-kpis";
import { PersonaCards } from "@/components/shell/landing/persona-cards";
import { ProcessDiagram } from "@/components/shell/landing/process-diagram";

export default function HomePage() {
  return (
    <div className="space-y-7 pb-4">
      <LandingHero />
      <ProcessDiagram />
      <LandingKpis />
      <PersonaCards />
    </div>
  );
}
