import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestsWorkspace } from "@/components/tracker/requests-workspace";

export const metadata: Metadata = {
  title: "Requests",
  description: "My requests and the whole master-data pipeline: status, who each request is waiting on, SLA and the customer orders it holds up.",
};

function RequestsLoading() {
  return (
    <div className="w-full space-y-5" aria-busy="true" aria-label="Loading requests">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-6 sm:grid-cols-2 lg:flex">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="min-w-0 space-y-3 border-l border-border-strong pl-4 lg:flex-1 lg:first:flex-[1.45]">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<RequestsLoading />}>
      <RequestsWorkspace />
    </Suspense>
  );
}
