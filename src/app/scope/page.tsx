import type { Metadata } from "next";
import { ScopePage } from "@/components/story/scope-page";

export const metadata: Metadata = {
  title: "Scope and roadmap",
  description: "What version 1 covers, what it leaves out and why, and the roadmap.",
};

export default function Page() {
  return <ScopePage />;
}
