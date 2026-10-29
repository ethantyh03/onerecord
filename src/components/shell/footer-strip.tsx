import { cn } from "@/lib/utils";
import { FOOTER_TEXT, footerText } from "./copy";

export { FOOTER_TEXT };

/**
 * The environment line under every screen, set as a quiet console footer. `configVersion` is the live
 * config version; the loading skeleton leaves it out (the sandbox has not loaded yet).
 */
export function FooterStrip({ className, configVersion }: { className?: string; configVersion?: number }) {
  return (
    <footer
      className={cn(
        "border-t border-border bg-canvas px-4 py-2 text-xs leading-snug text-subtle sm:px-6 lg:px-8",
        className,
      )}
    >
      <p className="w-full max-w-[1600px]">{footerText(configVersion)}</p>
    </footer>
  );
}
