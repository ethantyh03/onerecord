import { cn } from "@/lib/utils";
import { FOOTER_TEXT } from "./copy";

export { FOOTER_TEXT };

export function FooterStrip({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border bg-canvas px-6 py-2.5 text-[0.75rem] leading-snug text-muted-foreground lg:px-8",
        className,
      )}
    >
      <p className="mx-auto w-full max-w-[1600px]">{FOOTER_TEXT}</p>
    </footer>
  );
}
