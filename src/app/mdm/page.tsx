import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MdmConsole } from "@/components/mdm/MdmConsole";

export const metadata: Metadata = {
  title: "MDM console",
  description: "MDM final check: duplicate re-check, field review against SAP B1 limits, DTW import and the Service Layer payload preview.",
};

function MdmLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading the MDM console">
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-5 w-[36rem] max-w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[148px] rounded-xl" />
        <Skeleton className="h-[148px] rounded-xl" />
        <Skeleton className="h-[148px] rounded-xl" />
      </div>
      <Skeleton className="h-[360px] w-full rounded-xl" />
    </div>
  );
}

export default function MdmPage() {
  return (
    <Suspense fallback={<MdmLoading />}>
      <MdmConsole />
    </Suspense>
  );
}
