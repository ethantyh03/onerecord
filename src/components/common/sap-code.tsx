import { cn } from "@/lib/utils";

export interface SapCodeProps {
  code: string | null | undefined;
  /**
   * Kept for compatibility: both render the same now, without a box (mono already marks an
   * identifier, so a SAP code needs no chip).
   */
  variant?: "chip" | "plain";
  className?: string;
}

/**
 * Identifiers: SAP codes, request ids, tax ids, hashes. Martian Mono at 0.9em of the surrounding
 * text (it is a wide face), tabular figures. Mono means "this is a machine value", so it is used for
 * nothing else, and it needs no chip around it. Missing = "—".
 */
export function SapCode({ code, className }: SapCodeProps) {
  if (!code) {
    return <span className={cn("text-subtle", className)}>—</span>;
  }
  return (
    <code
      translate="no"
      className={cn(
        "font-mono text-[0.9em] font-normal tracking-normal whitespace-nowrap text-foreground tabular-nums",
        className,
      )}
    >
      {code}
    </code>
  );
}
