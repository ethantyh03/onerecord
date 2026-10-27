"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSandbox } from "@/lib/store";
import { selectWaitingOn } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { NAV_GROUPS, activeNavHref, type NavBadgeKey } from "./nav-items";

function useNavCounts(): Record<NavBadgeKey, number> {
  const approvals = useSandbox((s) => selectWaitingOn(s, s.personaId).length);
  const mdm = useSandbox((s) => s.requests.reduce((n, r) => (r.status === "mdm_review" ? n + 1 : n), 0));
  return { approvals, mdm };
}

export interface SidebarNavProps {
  /** Called after a link is chosen (closes the mobile sheet) */
  onNavigate?: () => void;
  className?: string;
}

export function SidebarNav({ onNavigate, className }: SidebarNavProps) {
  const pathname = usePathname() ?? "/";
  const active = activeNavHref(pathname);
  const counts = useNavCounts();
  const configVersion = useSandbox((s) => s.config.version);

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      <Link
        href="/"
        onClick={onNavigate}
        className="mx-3 mt-4 mb-5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <BrandMark className="size-8 text-sidebar-primary" />
        <span className="flex flex-col leading-none">
          <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-sidebar-accent-foreground">
            OneRecord
          </span>
          <span className="mt-1 text-[0.6875rem] text-sidebar-muted">Lives Group master data</span>
        </span>
      </Link>

      <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? gi} className={cn(gi > 0 && "mt-5")}>
            {group.label ? (
              <p className="mb-1.5 px-2.5 text-[0.6875rem] font-medium text-sidebar-muted">{group.label}</p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active === item.href;
                const count = item.badge ? counts[item.badge] : 0;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      title={item.hint}
                      className={cn(
                        "group/nav relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {isActive ? (
                        <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-sidebar-primary" />
                      ) : null}
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-[1.0625rem] shrink-0",
                          isActive ? "text-sidebar-primary" : "text-sidebar-muted group-hover/nav:text-sidebar-foreground",
                        )}
                        strokeWidth={2}
                      />
                      <span className="truncate">{item.label}</span>
                      {count > 0 ? (
                        <span
                          className={cn(
                            "num ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold",
                            item.badge === "approvals"
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "bg-sidebar-foreground/15 text-sidebar-accent-foreground",
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
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3.5 text-[0.6875rem] leading-relaxed text-sidebar-muted">
        <p>
          Sandbox for this browser only. Config <span className="num">v{configVersion}</span>.
        </p>
      </div>
    </div>
  );
}
