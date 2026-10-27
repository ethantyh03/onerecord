import type { Metadata } from "next";
import { TriagePage } from "@/components/story/triage-page";

export const metadata: Metadata = {
  title: "Inbound sorting · OneRecord",
  description: "The shared mailbox sorted into orders, open requests, enquiries, follow-ups and master-data setup, with the reasons for each.",
};

export default function Page() {
  return <TriagePage />;
}
