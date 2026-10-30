import { Fragment } from "react";
import { Menu } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RecordMark } from "./brand-mark";
import { FooterStrip } from "./footer-strip";
import { NAV_GROUPS } from "./nav-items";

/**
 * Server-renderable placeholder that mirrors the console frame while the sandbox loads from this browser.
 * `rail`: whether this page docks the rail on wide screens (every page but Home), so Home never flashes one.
 */
export function ShellSkeleton({ rail = true }: { rail?: boolean }) {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      {rail ? <SkeletonRail /> : null}
      <div className={cn("flex min-w-0 flex-1 flex-col", rail && "lg:pl-[232px]")}>
        <div className="flex h-14 items-stretch border-b border-border bg-card dark:border-sidebar-border dark:bg-sidebar">
          <span aria-hidden className="flex w-12 shrink-0 items-center justify-center text-muted-foreground dark:text-sidebar-foreground">
            <Menu className="size-5" />
          </span>
          <span className={cn("flex shrink-0 items-center gap-2.5 pr-3 pl-1 sm:pr-4 lg:w-[184px] lg:pr-2", rail && "lg:hidden")}>
            <RecordMark className="size-7 shrink-0 text-foreground" />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-wide text-[1.0625rem] font-semibold text-foreground">Tesseract</span>
              <span className="mt-1 hidden truncate text-xs text-muted-foreground lg:block dark:text-sidebar-muted">
                Lives Group master data
              </span>
            </span>
          </span>
          <span aria-hidden className="w-px shrink-0 bg-border dark:bg-sidebar-border" />
          <div className="flex min-w-0 flex-1 items-center gap-4 px-4">
            <Skeleton className="size-8 rounded-sm" />
            <div className="hidden space-y-1.5 sm:block">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <span aria-hidden className="mx-2 h-full w-px bg-border dark:bg-sidebar-border" />
            <Skeleton className="hidden h-8 w-56 lg:block" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="mr-1.5 hidden h-6 w-24 md:block xl:w-48" />
              <Skeleton className="size-9" />
              <Skeleton className="size-9" />
              <Skeleton className="h-9 w-9 2xl:w-32" />
            </div>
          </div>
        </div>
        <SkeletonMain />
        <FooterStrip />
      </div>
    </div>
  );
}

function SkeletonRail() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <RecordMark className="size-7 text-sidebar-primary" />
        <span className="flex flex-col leading-none">
          <span className="font-wide text-[1.0625rem] font-semibold text-sidebar-accent-foreground">Tesseract</span>
          <span className="mt-1 text-xs text-sidebar-muted">Lives Group master data</span>
        </span>
      </div>
      {/* Mirrors the rail's groups (the end group sits at the foot), so nothing jumps when it loads. */}
      <div className="flex flex-1 flex-col px-4 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <Fragment key={group.label ?? gi}>
            {group.atEnd ? <div aria-hidden className="grow" /> : null}
            <div className={cn("space-y-3", gi > 0 && "pt-6")}>
              {group.items.map((item, ii) => (
                <div
                  key={item.href}
                  className="h-4 rounded-sm bg-sidebar-accent"
                  style={{ width: `${56 + (((gi * 5 + ii) * 37) % 36)}%` }}
                />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="h-3 w-40 rounded-sm bg-sidebar-accent" />
      </div>
    </aside>
  );
}

function SkeletonMain() {
  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
      <div className="w-full max-w-[1600px] space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-[min(520px,80%)]" />
          <Skeleton className="h-4 w-[min(720px,90%)]" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
      <p className="sr-only" role="status">
        Loading Tesseract…
      </p>
    </main>
  );
}
