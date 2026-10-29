"use client";

import { UserRoundCheck } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { firstName } from "@/components/common";
import { cn } from "@/lib/utils";

const MDM_PERSONA_ID = "priya";

/** "Switch to Priya": the same one-click persona switch /sap and /admin offer on their read-only banners. */
export function SwitchToMdmButton({ className }: { className?: string }) {
  const people = useSandbox((s) => s.config.people);
  const setPersona = useSandbox((s) => s.setPersona);
  const mdmPerson = people.find((p) => p.id === MDM_PERSONA_ID) ?? people.find((p) => p.roles.includes("mdm"));
  if (!mdmPerson) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      data-testid="mdm-switch-persona"
      className={cn("shrink-0", className)}
      onClick={() => setPersona(mdmPerson.id)}
    >
      <UserRoundCheck aria-hidden />
      Switch to {firstName(mdmPerson.name)}
    </Button>
  );
}

