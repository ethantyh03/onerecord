import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Finals deck",
};

export default function DeckLayout({ children }: { children: ReactNode }) {
  return children;
}
