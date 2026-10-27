import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default: "OneRecord · Lives Group master data",
    template: "%s · OneRecord",
  },
  description:
    "Prototype: one request-and-approval flow for customer, vendor, item and cost-centre master data, handed cleanly to SAP Business One, feeding a trusted regional view. Synthetic, illustrative data.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f3a44",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-SG" className={`${uiFont.variable} ${codeFont.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <AppShell>{children}</AppShell>
        <Toaster theme="light" position="bottom-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
