import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestDetail, RequestDetailSkeleton } from "@/components/tracker/request-detail";

export const metadata: Metadata = {
  title: "Request tracker",
  description: "Delivery tracker for one master-data request: approvals, MDM check, SAP B1 creation, waiting orders and the audit trail.",
};

export default function RequestViewPage() {
  return (
    <Suspense fallback={<RequestDetailSkeleton />}>
      <RequestDetail />
    </Suspense>
  );
}
