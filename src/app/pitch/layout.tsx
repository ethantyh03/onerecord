import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import { PitchLightRoot } from "./_lib/pitch-light-root";

export const metadata: Metadata = {
  title: "Pitch",
};

/*
 * The pitch frames were exported to the submitted PDF, so they keep their original look: light tokens
 * (.theme-light), the original radii and shadows (.pitch-legacy) and the original fonts, declared here
 * so the app itself no longer loads them.
 */
const uiFont = Schibsted_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const codeFont = IBM_Plex_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/**
 * Pitch frames are recorded full-screen. The app shell can't be skipped per route (it wraps every
 * page in the root layout), so this layer covers it completely: fixed, inset-0, above the sidebar.
 */
export default function PitchLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${uiFont.variable} ${codeFont.variable} theme-light pitch-legacy fixed inset-0 z-[60] overflow-hidden font-sans`}
      data-testid="pitch-overlay"
    >
      <PitchLightRoot />
      {children}
    </div>
  );
}
