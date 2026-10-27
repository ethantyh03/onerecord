import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Usually one Button that starts the next action */
  action?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** An empty list is an invitation to act: say what goes here and how to get it. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, size = "md", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "md" ? "gap-3 rounded-xl border border-dashed border-border-strong bg-card/60 px-6 py-12" : "gap-2 px-4 py-8",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-primary-soft text-primary",
          size === "md" ? "size-11" : "size-9",
        )}
      >
        <Icon aria-hidden className={size === "md" ? "size-5" : "size-4"} strokeWidth={2} />
      </span>
      <div className="max-w-sm space-y-1">
        <p className={cn("font-semibold text-foreground", size === "md" ? "text-base" : "text-sm")}>{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
