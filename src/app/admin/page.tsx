import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminWorkspace } from "@/components/admin/admin-workspace";

export const metadata: Metadata = {
  title: "Admin settings",
  description: "Configure business units, approval routes, required fields, delegates and SLAs without IT. Every change is versioned.",
};

function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading admin settings">
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-5 w-[36rem] max-w-full" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Skeleton className="h-[520px] w-full rounded-xl" />
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminWorkspace />
    </Suspense>
  );
}
