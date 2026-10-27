import type { Metadata } from "next";
import { ImpactPage } from "@/components/story/impact-page";

export const metadata: Metadata = {
  title: "Business case · OneRecord",
  description: "Hours released, cost, payback at 40/80/120 requests a month, and why this option over the alternatives.",
};

export default function Page() {
  return <ImpactPage />;
}
