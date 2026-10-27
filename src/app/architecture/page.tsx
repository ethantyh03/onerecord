import type { Metadata } from "next";
import { ArchitecturePage } from "@/components/story/architecture-page";

export const metadata: Metadata = {
  title: "How it lands in SAP B1 · OneRecord",
  description: "Swimlane from the Power Apps form to SAP Business One, colour-coded by who builds each part, with the field-by-field SAP mapping.",
};

export default function Page() {
  return <ArchitecturePage />;
}
