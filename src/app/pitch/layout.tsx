import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pitch",
};

/**
 * Pitch frames are recorded full-screen. The app shell can't be skipped per route (it wraps every
 * page in the root layout), so this layer covers it completely: fixed, inset-0, above the sidebar.
 */
export default function PitchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden" data-testid="pitch-overlay">
      {children}
    </div>
  );
}
