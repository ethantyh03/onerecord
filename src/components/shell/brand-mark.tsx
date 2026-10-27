import { cn } from "@/lib/utils";

/**
 * OneRecord mark: three offset strokes (the same hospital typed three ways)
 * resolving into one solid record.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)} fill="none">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="currentColor" fillOpacity="0.12" />
      <path d="M7 10.5h9" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 16h7" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 21.5h9" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 10.5c2.6 0 3.2 5.5 5.5 5.5M16.5 21.5c2.6 0 3.2-5.5 5.5-5.5M14 16h8"
        stroke="currentColor"
        strokeOpacity="0.65"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="23.5" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}
