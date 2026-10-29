import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Optional bare icon (no tile around it). Pass one only when it says what will appear here. */
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Usually one Button that starts the next action */
  action?: ReactNode;
  /** "md": centred, for a page or a large area. "sm": one left-aligned line inside a list or panel. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * An empty list is an invitation to act: say what goes here and how to get it (Blueprint's
 * NonIdealState). Plain muted text, an optional bare icon, one action. No dashed box, no icon tile.
 */
export function EmptyState({ icon: Icon, title, description, action, size = "md", className }: EmptyStateProps) {
  if (size === "sm") {
    return (
      <div className={cn("flex items-start gap-2.5 px-4 py-3.5 text-sm", className)}>
        {Icon ? <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle" strokeWidth={2} /> : null}
        <div className="min-w-0">
          <p className="font-medium text-muted-foreground">{title}</p>
          {description ? <p className="mt-0.5 leading-snug text-subtle">{description}</p> : null}
          {action ? <div className="mt-2.5">{action}</div> : null}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {Icon ? <Icon aria-hidden className="mb-3 size-5 text-subtle" strokeWidth={1.75} /> : null}
      <p className="font-wide text-[0.9375rem] leading-6 font-semibold text-secondary-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-[52ch] text-sm leading-snug text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
