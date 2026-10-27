"use client";

import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./person-avatar";

export interface PersonChipProps {
  personId: string;
  /** Show the job title under the name */
  showTitle?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Avatar + name for any person in the sandbox config (personas and approvers). */
export function PersonChip({ personId, showTitle = false, size = "sm", className }: PersonChipProps) {
  const person = useSandbox((s) => s.config.people.find((p) => p.id === personId));

  if (!person) {
    return <span className={cn("text-sm text-muted-foreground", className)}>Unassigned</span>;
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 align-middle", className)} title={person.title}>
      <PersonAvatar person={person} size={size === "sm" ? "sm" : "md"} away={person.outOfOffice} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn("truncate font-medium text-foreground", size === "sm" ? "text-[0.8125rem]" : "text-sm")}>
          {person.name}
        </span>
        {showTitle ? <span className="truncate text-xs text-muted-foreground">{person.title}</span> : null}
      </span>
    </span>
  );
}
