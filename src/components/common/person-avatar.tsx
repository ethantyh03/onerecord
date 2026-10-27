import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { initials } from "./format";

const SIZES = {
  xs: "size-5 text-[0.5625rem]",
  sm: "size-6 text-[0.625rem]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-12 text-base",
} as const;

export interface PersonAvatarProps {
  person: Pick<Person, "name" | "avatarColor"> | undefined;
  size?: keyof typeof SIZES;
  className?: string;
  /** Show the out-of-office marker */
  away?: boolean;
}

/** Initials disc in the person's colour (darkened so white initials always read). */
export function PersonAvatar({ person, size = "md", className, away }: PersonAvatarProps) {
  const color = person?.avatarColor || "#4b6470";
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.02em] text-white select-none",
        "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)]",
        SIZES[size],
        className,
      )}
      style={{ background: `color-mix(in oklch, ${color} 74%, black)` }}
    >
      {person ? initials(person.name) : "?"}
      {away ? (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-warn" />
      ) : null}
    </span>
  );
}
