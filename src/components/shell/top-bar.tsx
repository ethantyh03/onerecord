"use client";

import type { Ref } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecordMark } from "./brand-mark";
import { EnvironmentTag } from "./environment-tag";
import { NotificationBell } from "./notification-bell";
import { PersonaSwitcher } from "./persona-switcher";
import { ResetDemoButton } from "./reset-demo-button";
import { SimClock } from "./sim-clock";
import { SIDEBAR_ID } from "./sidebar-state";
import { ThemeToggle } from "./theme-toggle";

/** Full-height hairline between status-bar segments. */
function Divider({ className }: { className?: string }) {
  return <span aria-hidden className={cn("w-px shrink-0 self-stretch bg-border dark:bg-sidebar-border", className)} />;
}

export interface TopBarProps {
  /** Whether the rail is showing (docked or as the open drawer): drives ☰'s label and aria-expanded. */
  navOpen: boolean;
  onToggleNav: () => void;
  toggleRef?: Ref<HTMLButtonElement>;
  /**
   * Show the brand beside ☰: whenever the rail is not docked, so the product name never leaves the
   * screen. On wide screens ☰ + brand span the rail's 232px, so the drawer's brand row lands on them.
   */
  showBrand: boolean;
}

/**
 * The status bar: ☰ for the rail, whose seat you are in, the sandbox clock that drives every SLA
 * (with its fast-forward), then the environment tag, alerts, theme and reset. Segments are separated
 * like an instrument panel.
 */
export function TopBar({ navOpen, onToggleNav, toggleRef, showBrand }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card dark:border-sidebar-border dark:bg-sidebar">
      <div className="flex h-14 w-full items-stretch">
        <button
          ref={toggleRef}
          type="button"
          onClick={onToggleNav}
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
          aria-controls={SIDEBAR_ID}
          data-testid="nav-toggle"
          className="inline-flex w-12 shrink-0 items-center justify-center text-muted-foreground outline-none transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring dark:text-sidebar-foreground"
        >
          <Menu aria-hidden className="size-5" />
        </button>

        {/* Gone while the rail is docked (the rail carries the brand then); it changes under the sliding rail. */}
        <div inert={!showBrand} className={cn("flex shrink-0 overflow-hidden", showBrand ? "lg:w-[184px]" : "invisible w-0")}>
          <Link
            href="/"
            aria-label="Tesseract home"
            className="flex shrink-0 items-center gap-2.5 pr-3 pl-1 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:pr-4 lg:w-[184px] lg:pr-2"
          >
            <RecordMark className="size-7 shrink-0 text-foreground" />
            <span className="hidden min-w-0 flex-col leading-none sm:flex">
              <span className="font-wide text-[1.0625rem] font-semibold text-foreground">Tesseract</span>
              <span className="mt-1 hidden truncate text-xs text-muted-foreground lg:block dark:text-sidebar-muted">
                Lives Group master data
              </span>
            </span>
          </Link>
        </div>
        <Divider />

        <PersonaSwitcher />
        <Divider />
        <SimClock />
        <Divider className="hidden lg:block" />

        <div className="ml-auto flex items-center gap-1 pr-2 pl-2 sm:pr-4">
          <EnvironmentTag className="mr-1.5 hidden md:inline-flex" />
          <NotificationBell />
          <ThemeToggle />
          <Divider className="mx-1.5 my-3.5" />
          <ResetDemoButton />
        </div>
      </div>
    </header>
  );
}
