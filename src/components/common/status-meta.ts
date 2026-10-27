import type { RequestStatus, StepStatus } from "@/lib/types";

export type AnyStatus = RequestStatus | StepStatus;
export type StatusTone = "neutral" | "brand" | "warn" | "stuck" | "ok";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** lucide icon name, resolved in StatusBadge */
  icon: "draft" | "progress" | "question" | "rejected" | "review" | "done" | "cancelled" | "waiting" | "pending" | "skipped";
  description: string;
}

/** One table for request and step statuses ("rejected" is shared and reads the same in both). */
export const STATUS_META: Record<AnyStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral", icon: "draft", description: "Not yet submitted." },
  in_approval: { label: "In approval", tone: "brand", icon: "progress", description: "Approvers are reviewing it." },
  needs_info: {
    label: "Needs info",
    tone: "warn",
    icon: "question",
    description: "An approver asked a question; that step's clock is paused.",
  },
  rejected: { label: "Rejected", tone: "stuck", icon: "rejected", description: "Stopped by an approver." },
  mdm_review: {
    label: "MDM review",
    tone: "brand",
    icon: "review",
    description: "Business approvals are done; waiting on the MDM final check.",
  },
  created: { label: "Created in SAP B1", tone: "ok", icon: "done", description: "Live in SAP Business One." },
  cancelled: { label: "Cancelled", tone: "neutral", icon: "cancelled", description: "Withdrawn by the requestor." },
  waiting: { label: "Waiting", tone: "neutral", icon: "waiting", description: "Starts after the previous stage." },
  pending: { label: "Pending", tone: "brand", icon: "pending", description: "Waiting on this approver's decision." },
  approved: { label: "Approved", tone: "ok", icon: "done", description: "Approved." },
  question: {
    label: "Question asked",
    tone: "warn",
    icon: "question",
    description: "Waiting on the requestor's answer; the clock is paused.",
  },
  skipped: { label: "Skipped", tone: "neutral", icon: "skipped", description: "Did not apply to this request." },
};

export function statusMeta(status: AnyStatus): StatusMeta {
  return STATUS_META[status] ?? { label: String(status), tone: "neutral", icon: "waiting", description: "" };
}
