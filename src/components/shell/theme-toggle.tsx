"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setTheme, useTheme } from "@/components/common/use-theme";

/** Dark console by default; one click to the light theme when the room or projector is bright. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const toLight = theme === "dark";
  const label = toLight ? "Light theme for bright rooms" : "Dark theme";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => setTheme(toLight ? "light" : "dark")}
            aria-label={label}
            data-testid="theme-toggle"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors",
              "hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              className,
            )}
          />
        }
      >
        {toLight ? (
          <Sun aria-hidden className="size-[1.125rem]" strokeWidth={2} />
        ) : (
          <Moon aria-hidden className="size-[1.125rem]" strokeWidth={2} />
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
