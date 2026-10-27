"use client";

import type { ReactNode } from "react";
import { useHasHydrated } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FooterStrip } from "./footer-strip";
import { ShellSkeleton } from "./shell-skeleton";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

/**
 * The frame every screen renders in: brand sidebar, top bar (persona, simulated clock,
 * notifications, reset) and the prototype footer. Nothing below renders until the
 * per-browser sandbox has loaded from localStorage, so pages never flash seed-vs-saved state.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHasHydrated();

  if (!hydrated) return <ShellSkeleton />;

  return (
    <TooltipProvider delay={150}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] lg:block">
          <SidebarNav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
          <TopBar />
          <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-7">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
          <FooterStrip />
        </div>
      </div>
    </TooltipProvider>
  );
}
