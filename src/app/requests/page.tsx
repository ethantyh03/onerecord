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
    <div className="mx-auto w-full max-w-[1320px] space-y-5" aria-busy="true" aria-label="Loading requests">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
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
