"use client";

import { Fragment, type MouseEvent, type Ref } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { selectWaitingOn } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { RecordMark } from "./brand-mark";
import { NAV_GROUPS, activeNavHref, type NavBadgeKey } from "./nav-items";
import { SIDEBAR_ID, SLIDE_HIDE, SLIDE_SHOW } from "./sidebar-state";

function useNavCounts(): Record<NavBadgeKey, number> {
  const approvals = useSandbox((s) => selectWaitingOn(s, s.personaId).length);
  const mdm = useSandbox((s) => s.requests.reduce((n, r) => (r.status === "mdm_review" ? n + 1 : n), 0));
  return { approvals, mdm };
}

/** A click that follows the link in this tab (not a new-tab / new-window click). */
function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export interface SidebarNavProps {
  /** Called when a link is chosen, with its href (the drawer closes, or becomes the docked rail) */
  onNavigate?: (href: string) => void;
  /**
   * Drawer mode: the open drawer covers the status bar's ☰, so its brand row starts with its own ☰
   * at the same spot, which closes it. Docked rails leave this out (the status bar's ☰ collapses them).
   */
  onClose?: () => void;
  closeRef?: Ref<HTMLButtonElement>;
  className?: string;
}

/**
 * The console rail: brand, grouped navigation separated by hairlines (the About group sits at the
 * foot), and the sandbox note. Text labels always stay visible; the active item carries a 2px signal
 * bar on the rail's edge and a raised row.
 */
export function SidebarNav({ onNavigate, onClose, closeRef, className }: SidebarNavProps) {
  const pathname = usePathname() ?? "/";
  const active = activeNavHref(pathname);
  const counts = useNavCounts();
  const drawer = Boolean(onClose);
  const follow = (href: string) => (e: MouseEvent) => {
    if (isPlainClick(e)) onNavigate?.(href);
  };

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-14 shrink-0 items-stretch border-b border-sidebar-border">
        {/* The drawer's ☰ sits exactly where the status bar's ☰ is; the slot folds away when the rail docks. */}
        <div
          inert={!drawer}
          className={cn("flex shrink-0 overflow-hidden", drawer ? cn("visible w-12", SLIDE_SHOW) : cn("invisible w-0", SLIDE_HIDE))}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            aria-expanded={drawer}
            aria-controls={SIDEBAR_ID}
            data-testid="nav-close"
            className="inline-flex w-12 shrink-0 items-center justify-center text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring"
          >
            <Menu aria-hidden className="size-5" />
          </button>
        </div>
        <Link
          href="/"
          onClick={follow("/")}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 pr-2 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring",
            drawer ? cn("pl-1", SLIDE_SHOW) : cn("pl-4", SLIDE_HIDE),
          )}
        >
          <RecordMark className="size-7 shrink-0 text-sidebar-primary" />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="font-wide text-[1.0625rem] font-semibold text-sidebar-accent-foreground">Tesseract</span>
            <span className="mt-1 truncate text-xs text-sidebar-muted">Lives Group master data</span>
          </span>
        </Link>
      </div>

      <nav aria-label="Main" className="scrollbar-thin flex flex-1 flex-col overflow-y-auto overscroll-contain py-2">
        {NAV_GROUPS.map((group, gi) => (
          <Fragment key={group.label ?? gi}>
            {/* Pushes an end group to the foot of the rail; collapses to nothing when the rail scrolls. */}
            {group.atEnd ? <div aria-hidden className="grow" /> : null}
            <div
              className={cn(
                gi > 0 &&
                  "mt-2 border-t border-sidebar-border pt-2.5 [@media(max-height:760px)]:mt-1.5 [@media(max-height:760px)]:pt-1.5",
              )}
            >
              {group.label ? <p className="px-4 pb-1 text-xs font-medium text-sidebar-muted">{group.label}</p> : null}
              <ul>
                {group.items.map((item) => {
                  const isActive = active === item.href;
                  const count = item.badge ? counts[item.badge] : 0;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={follow(item.href)}
                        aria-current={isActive ? "page" : undefined}
                        title={item.hint}
                        className={cn(
                          "group/nav relative flex h-9 items-center gap-3 px-4 text-sm outline-none transition-colors [@media(max-height:760px)]:h-8",
                          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring",
                          isActive
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        {isActive ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-sidebar-primary" /> : null}
                        <Icon
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover/nav:text-sidebar-foreground",
                          )}
                          strokeWidth={2}
                        />
                        <span className="truncate">{item.label}</span>
                        {count > 0 ? (
                          <span
                            className={cn(
                              "num ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1.5 text-xs font-semibold",
                              item.badge === "approvals"
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "bg-sidebar-foreground/12 text-sidebar-accent-foreground",
                            )}
                          >
                            <span aria-hidden>{count}</span>
                            <span className="sr-only">
                              {item.badge === "approvals" ? `, ${count} waiting on you` : `, ${count} ready for MDM review`}
                            </span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Fragment>
        ))}
      </nav>
    </div>
  );
}
