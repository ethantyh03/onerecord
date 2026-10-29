import { cn } from "@/lib/utils";
import { FOOTER_TEXT } from "./copy";

export { FOOTER_TEXT };

/** The production-framing line under every screen, set as a quiet console footer. */
export function FooterStrip({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border bg-canvas px-4 py-2 text-xs leading-snug text-subtle sm:px-6 lg:px-8",
        className,
      )}
    >
      <p className="w-full max-w-[1600px]">{FOOTER_TEXT}</p>
    </footer>
  );
}
