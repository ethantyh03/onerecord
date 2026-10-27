"use client";

import { useSandbox } from "@/lib/store";
import { initials } from "@/components/common/format";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

export { useSimNow } from "@/components/common/use-sim-now";
export { formatAgo, formatSgd, firstName } from "@/components/common/format";

/** Segoe-first stack used by the Microsoft-style mocks. */
export const MS_FONT =
  '"Segoe UI", "Segoe UI Web (West European)", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif';

/** Teams-like palette (colours only; no logos). */
export const TEAMS = {
  purple: "#5b5fc7",
  purpleHover: "#4f52b2",
  purpleDark: "#444791",
  purpleTint: "#e8ebfa",
  rail: "#ebebeb",
  canvas: "#f5f5f5",
  text: "#242424",
  subtle: "#616161",
  stroke: "#e0e0e0",
} as const;

export function usePeople(): Person[] {
  return useSandbox((s) => s.config.people);
}

export function findPerson(people: Person[], id: string | undefined): Person | undefined {
  return id ? people.find((p) => p.id === id) : undefined;
}

/** Fluent-style avatar (initials on the person's colour) with an optional presence dot. */
export function MsAvatar({
  person,
  name,
  size = 32,
  presence,
  className,
}: {
  person?: Person;
  name?: string;
  size?: number;
  presence?: "available" | "away" | "busy" | "offline";
  className?: string;
}) {
  const label = person?.name ?? name ?? "Unknown";
  const dot =
    presence === "available" ? "#13a10e" : presence === "away" ? "#eaa300" : presence === "busy" ? "#c4314b" : "#8a8886";
  const dotSize = Math.max(8, Math.round(size * 0.32));
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        background: person?.avatarColor ?? "#8a8886",
      }}
      aria-hidden="true"
    >
      {initials(label)}
      {presence ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-white"
          style={{ width: dotSize, height: dotSize, background: dot }}
        />
      ) : null}
    </span>
  );
}
