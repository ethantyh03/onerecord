"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useHasHydrated, useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FooterStrip } from "./footer-strip";
import { ShellSkeleton } from "./shell-skeleton";
import { SidebarNav } from "./sidebar-nav";
import {
  SIDEBAR_DOCK_QUERY,
  SIDEBAR_ID,
  SLIDE_HIDE,
  SLIDE_SHOW,
  linkDocksRail,
  readSidebarPref,
  sidebarMode,
  writeSidebarPref,
  type SidebarPref,
} from "./sidebar-state";
import { TopBar } from "./top-bar";

/**
 * The console frame every screen renders in: the rail (brand + navigation), the status bar
 * (☰, persona, sandbox clock, environment tag, notifications, theme, reset) and the environment
 * footer. Nothing below renders until the per-browser sandbox has loaded from localStorage, so pages
 * never flash seed-vs-saved state.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHasHydrated();
  const pathname = usePathname() ?? "/";

  // Pitch frames are full-screen and read no sandbox state: never flash the shell skeleton.
  if (pathname.startsWith("/pitch")) return <>{children}</>;
  if (!hydrated) return <ShellSkeleton rail={pathname !== "/"} />;

  return <ConsoleFrame pathname={pathname}>{children}</ConsoleFrame>;
}

function subscribeWide(onChange: () => void): () => void {
  const mq = window.matchMedia(SIDEBAR_DOCK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const wideNow = () => window.matchMedia(SIDEBAR_DOCK_QUERY).matches;
const wideOnServer = () => true;

/**
 * "open": the modal drawer. "docking": a link to a page that docks the rail was chosen, so the drawer
 * holds still (no backdrop) until that page arrives and it becomes the docked rail.
 */
type DrawerState = "open" | "docking" | null;

/**
 * Mounted only on the client, after the sandbox has hydrated, so the rail starts in its final place
 * (no slide on load). One <aside> serves every mode; hidden, it stays in the DOM (translated off-screen,
 * invisible and inert) so its links are always there.
 *
 * Only the rail slides (a compositor-only translate). The content's inset changes in one step, under the
 * rail as it slides: animating it would re-lay out the whole page (and every chart) on each frame.
 */
function ConsoleFrame({ pathname, children }: { pathname: string; children: ReactNode }) {
  const wide = useSyncExternalStore(subscribeWide, wideNow, wideOnServer);
  const [pref, setPref] = useState<SidebarPref>(readSidebarPref);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const configVersion = useSandbox((s) => s.config.version);

  const mode = sidebarMode(pathname, wide);
  // The drawer belongs to one page at one width: it closes itself when either changes.
  const key = `${mode}:${pathname}`;
  const [drawerKey, setDrawerKey] = useState(key);
  if (drawerKey !== key) {
    setDrawerKey(key);
    setDrawer(null);
  }
  const drawerState: DrawerState = mode === "overlay" && drawerKey === key ? drawer : null;
  const docked = mode === "docked" && pref === "expanded";
  const modal = drawerState === "open";
  const shown = docked || drawerState !== null;

  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const toggle = useCallback(() => {
    if (mode === "docked") {
      const next: SidebarPref = pref === "expanded" ? "collapsed" : "expanded";
      setPref(next);
      writeSidebarPref(next);
    } else {
      setDrawer(modal ? null : "open");
    }
  }, [mode, pref, modal]);

  const onNavigate = useCallback(
    (href: string) => {
      if (mode !== "overlay") return;
      setDrawer(linkDocksRail(href, pathname, wide, pref) ? "docking" : null);
    },
    [mode, pathname, wide, pref],
  );

  // Esc closes the drawer.
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setDrawer(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  // Focus moves into the drawer when it opens (its ☰, on the same spot) and back to the status bar's ☰
  // when it closes, unless it stayed on screen as the docked rail.
  const wasModal = useRef(false);
  useEffect(() => {
    if (modal && !wasModal.current) closeRef.current?.focus();
    if (!modal && wasModal.current && !shown) {
      const active = document.activeElement;
      if (!active || active === document.body || asideRef.current?.contains(active)) toggleRef.current?.focus();
    }
    wasModal.current = modal;
  }, [modal, shown]);

  // Pages can adapt to the docked rail: html[data-sidebar] is "expanded" only while the rail takes up
  // width beside the content; html[data-sidebar-drawer="open"] while the drawer covers the page.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.sidebar = docked ? "expanded" : "collapsed";
    if (modal) root.dataset.sidebarDrawer = "open";
    else delete root.dataset.sidebarDrawer;
  }, [docked, modal]);
  useEffect(
    () => () => {
      delete document.documentElement.dataset.sidebar;
      delete document.documentElement.dataset.sidebarDrawer;
    },
    [],
  );

  return (
    <TooltipProvider delay={150}>
      <a
        href="#main"
        inert={modal}
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        {mode === "overlay" ? (
          <div
            aria-hidden
            onClick={closeDrawer}
            data-testid="nav-backdrop"
            className={cn(
              "fixed inset-0 z-40 bg-black/55",
              modal ? cn("visible opacity-100", SLIDE_SHOW) : cn("pointer-events-none invisible opacity-0", SLIDE_HIDE),
            )}
          />
        ) : null}

        <aside
          id={SIDEBAR_ID}
          ref={asideRef}
          inert={!shown}
          role={modal ? "dialog" : undefined}
          aria-modal={modal || undefined}
          aria-label={modal ? "Navigation" : undefined}
          data-mode={mode}
          data-state={shown ? "open" : "closed"}
          className={cn(
            "fixed inset-y-0 left-0 border-r border-sidebar-border",
            mode === "docked" ? "z-40 w-[232px]" : "z-50 w-[min(264px,85vw)] lg:w-[232px]",
            shown ? cn("visible translate-x-0", SLIDE_SHOW) : cn("invisible -translate-x-full", SLIDE_HIDE),
            // The one shadow in the console: the drawer lifts off the page it covers (unpainted once hidden).
            mode === "overlay" && "shadow-[18px_0_36px_-22px_rgb(0_0_0/0.85)]",
          )}
        >
          <SidebarNav
            onNavigate={onNavigate}
            onClose={mode === "overlay" ? closeDrawer : undefined}
            closeRef={closeRef}
          />
        </aside>

        <div inert={modal} className={cn("flex min-w-0 flex-1 flex-col", docked && "pl-[232px]")}>
          <TopBar navOpen={shown} onToggleNav={toggle} toggleRef={toggleRef} showBrand={!docked} />
          <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-7">
            <div className="w-full max-w-[1600px]">{children}</div>
          </main>
          <FooterStrip configVersion={configVersion} />
        </div>
      </div>
    </TooltipProvider>
  );
}
