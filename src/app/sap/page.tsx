import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SapWorkspace } from "./_components/SapWorkspace";

export const metadata: Metadata = {
  title: "SAP Business One",
  description: "SAP Business One: DTW import wizard, master data forms and the Service Layer payload preview.",
};

function SapLoading() {
  return (
    <div className="w-full space-y-4" aria-busy="true" aria-label="Loading SAP Business One">
      <Skeleton className="h-9 w-96 max-w-full" />
      <Skeleton className="h-5 w-[36rem] max-w-full" />
      <Skeleton className="h-[520px] w-full rounded-[6px]" />
    </div>
  );
}

export default function SapPage() {
  return (
    <Suspense fallback={<SapLoading />}>
      <SapWorkspace />
    </Suspense>
  );
}
