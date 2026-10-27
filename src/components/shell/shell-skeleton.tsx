import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "./brand-mark";
import { FooterStrip } from "./footer-strip";

/** Server-renderable placeholder that mirrors the shell while the sandbox loads from this browser. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col bg-sidebar px-3 pt-4 lg:flex">
        <div className="mb-5 flex items-center gap-2.5 px-2 py-1.5">
          <BrandMark className="size-8 text-sidebar-primary" />
          <span className="flex flex-col leading-none">
            <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-sidebar-accent-foreground">
              OneRecord
            </span>
            <span className="mt-1 text-[0.6875rem] text-sidebar-muted">Lives Group master data</span>
          </span>
        </div>
        <div className="space-y-2 px-2.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={i === 1 || i === 4 || i === 6 || i === 9 ? "pt-4" : undefined}>
              <div className="h-5 rounded-md bg-sidebar-accent/70" style={{ width: `${56 + ((i * 37) % 36)}%` }} />
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
        <div className="flex h-16 items-center justify-between gap-4 border-b bg-card px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-56 rounded-lg" />
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
        <main className="flex-1 px-6 py-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px] space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-9 w-[min(560px,80%)]" />
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
            Loading your demo sandbox
          </p>
        </main>
        <FooterStrip />
      </div>
    </div>
  );
}
