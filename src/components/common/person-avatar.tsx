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

/**
 * Initials disc, neutral: the console's own grey with only a faint trace of the person's colour, so
 * people never compete with state colour (coral, amber, green). People are round; records are square.
 * The Microsoft look-alikes draw their own saturated avatars (mocks/shared.tsx).
 */
export function PersonAvatar({ person, size = "md", className, away }: PersonAvatarProps) {
  const color = person?.avatarColor || "#4b6470";
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.02em] text-foreground select-none",
        "shadow-[inset_0_0_0_1px_var(--border-strong)]",
        SIZES[size],
        className,
      )}
      style={{ background: `color-mix(in oklch, ${color} 14%, var(--secondary))` }}
    >
      {person ? initials(person.name) : "?"}
      {away ? (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-warn" />
      ) : null}
    </span>
  );
}
