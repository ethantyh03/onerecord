import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type LightScopeProps = ComponentProps<"div">;

/**
 * Keeps a subtree in the light theme inside the dark console: every token (bg-card, text-foreground,
 * border, primary ...) resolves to its light value and dark: utilities switch off. Wrap the look-alike
 * screens with it (Microsoft Teams window and phone, Outlook, SAP Business One) so they keep their
 * native light look; the contrast with the console is part of the story.
 *
 * It sets the light text colour but no background: give it bg-card / bg-background if the mock does
 * not paint its own. Portalled popups (tooltips, menus) still follow the console theme.
 */
export function LightScope({ className, ...props }: LightScopeProps) {
  return <div data-theme-scope="light" className={cn("theme-light", className)} {...props} />;
}
