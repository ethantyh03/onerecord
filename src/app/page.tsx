import { LandingHero } from "@/components/shell/landing/landing-hero";
import { LandingKpis } from "@/components/shell/landing/landing-kpis";

export default function HomePage() {
  return (
    <div className="space-y-7 pb-4">
      <LandingHero />
      <LandingKpis />
    </div>
  );
}
