import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Regional Pulse" };

export default function PulseLayout({ children }: { children: ReactNode }) {
  return children;
}
