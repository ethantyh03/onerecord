import type { Metadata } from "next";
import { ScopePage } from "@/components/story/scope-page";

export const metadata: Metadata = {
  title: "Scope and roadmap · OneRecord",
  description: "What we deliberately left out of version 1, why, and the order we would build the rest.",
};

export default function Page() {
  return <ScopePage />;
}
