import type { Metadata } from "next";
import { Suspense } from "react";
import { ApprovalsLoading, ApprovalsWorkspace } from "@/components/approvals/ApprovalsWorkspace";

export const metadata: Metadata = {
  title: "Approvals",
  description: "Waiting on me, the Teams approval card, the Outlook actionable message and the card JSON.",
};

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<ApprovalsLoading />}>
      <ApprovalsWorkspace />
    </Suspense>
  );
}
