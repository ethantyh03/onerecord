import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { IntakeWorkspace } from "@/components/intake/intake-workspace";

export const metadata: Metadata = {
  title: "New request",
  description: "Smart intake: paste-to-fill, live duplicate check, approval route preview and expected live date in SAP B1.",
};

function IntakeLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading the request form">
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-5 w-[32rem] max-w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<IntakeLoading />}>
      <IntakeWorkspace />
    </Suspense>
  );
}
