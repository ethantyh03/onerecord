import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { THEME_INIT_SCRIPT } from "@/components/common/theme-script";
import "./globals.css";

/** UI + headings. Variable width axis: titles run semi-expanded (font-wide), body at normal width. */
const uiFont = Archivo({
  variable: "--font-ui",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

/** Identifiers and machine values only (REQ-1042, C-SG-00017, SAP codes, the SLA clock). */
const codeFont = Martian_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "OneRecord · Lives Group master data",
    template: "%s · OneRecord",
  },
  description: "Request, approve and load customer, vendor, item and cost-centre master data into SAP Business One.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#08090a",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // "dark" is the default; the inline script swaps to the saved light choice before first paint.
    <html lang="en-SG" className={`dark ${uiFont.variable} ${codeFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
