import { cn } from "@/lib/utils";

export interface SapCodeProps {
  code: string | null | undefined;
  /** "chip" (default) for inline codes; "plain" for dense tables */
  variant?: "chip" | "plain";
  className?: string;
}

/** SAP codes, request ids, hashes: always monospace with tabular figures. */
export function SapCode({ code, variant = "chip", className }: SapCodeProps) {
  if (!code) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  return (
    <code
      translate="no"
      className={cn(
        "num font-mono text-[0.8125em] font-medium tracking-tight whitespace-nowrap text-foreground",
        variant === "chip" && "rounded-[5px] border border-border bg-muted/70 px-1.5 py-px",
        className,
      )}
    >
      {code}
    </code>
  );
}
