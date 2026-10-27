"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import type { FieldValue } from "@/lib/types";
import { canSeeSensitive, maskValue } from "@/lib/engine/masking";
import { useSandbox } from "@/lib/store";
import { useCurrentPerson } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface MaskedValueProps {
  value: FieldValue | undefined;
  requestId: string;
  fieldKey: string;
  className?: string;
}

function display(value: FieldValue | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-SG");
  return value;
}

/**
 * Sensitive field (bank details, credit limit, payment terms).
 * Finance and MDM roles can reveal it with the eye button; every reveal is audit-logged.
 * Everyone else sees the masked value and a lock.
 */
export function MaskedValue({ value, requestId, fieldKey, className }: MaskedValueProps) {
  const person = useCurrentPerson();
  const allowed = person ? canSeeSensitive(person) : false;
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const revealed = allowed && person != null && revealedFor === person.id;
  const empty = value === null || value === undefined || value === "";

  const masked = empty ? "—" : maskValue(value ?? null);

  function reveal() {
    if (!person) return;
    setRevealedFor(person.id);
    useSandbox.getState().logSensitiveReveal(requestId, fieldKey);
    toast("Reveal recorded in the audit trail", {
      description: `${person.name} viewed ${fieldKey} on ${requestId}.`,
    });
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle", className)}>
      <span
        className={cn(
          "num font-mono text-[0.8125rem] tracking-tight",
          revealed ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={revealed ? undefined : "Masked value"}
      >
        {revealed ? display(value) : masked}
      </span>

      {empty ? null : allowed ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={revealed ? () => setRevealedFor(null) : reveal}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={revealed ? "Hide value" : "Reveal value (recorded in the audit trail)"}
              />
            }
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </TooltipTrigger>
          <TooltipContent>{revealed ? "Hide value" : "Reveal: recorded in the audit trail"}</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                tabIndex={0}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/80 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Visible to Finance & MDM only"
              />
            }
          >
            <Lock className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Visible to Finance &amp; MDM only</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
