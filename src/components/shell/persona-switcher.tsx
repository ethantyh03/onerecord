"use client";

import { useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import type { Person } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { useCurrentPerson } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonAvatar } from "@/components/common/person-avatar";

function PersonRow({ person, current }: { person: Person; current: boolean }) {
  return (
    <>
      <PersonAvatar person={person} size="md" away={person.outOfOffice} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-foreground">{person.name}</span>
        <span className="truncate text-xs text-muted-foreground">{person.title}</span>
      </span>
      {current ? <Check aria-hidden className="size-4 text-primary" /> : null}
    </>
  );
}

/** Stands in for sign-in: choose whose seat you are in. */
export function PersonaSwitcher({ className }: { className?: string }) {
  const people = useSandbox((s) => s.config.people);
  const personaId = useSandbox((s) => s.personaId);
  const current = useCurrentPerson();

  const { personas, approvers } = useMemo(
    () => ({
      personas: people.filter((p) => p.persona),
      approvers: people.filter((p) => !p.persona).sort((a, b) => a.name.localeCompare(b.name)),
    }),
    [people],
  );

  function choose(person: Person) {
    if (person.id === personaId) return;
    useSandbox.getState().setPersona(person.id);
    toast(`Now viewing as ${person.name}`, { description: person.title });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group/persona flex h-10 max-w-[18rem] min-w-0 items-center gap-2.5 rounded-lg border border-transparent py-1 pr-2 pl-1 text-left outline-none transition-colors",
          "hover:border-border hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40 data-popup-open:border-border data-popup-open:bg-muted/60",
          className,
        )}
        aria-label={current ? `Viewing as ${current.name}. Switch persona` : "Choose a persona"}
      >
        <PersonAvatar person={current} size="md" away={current?.outOfOffice} />
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-sm font-semibold text-foreground">{current?.name ?? "Choose a persona"}</span>
          <span className="truncate text-xs text-muted-foreground">{current?.title ?? ""}</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="w-80 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 pt-1.5 pb-1">Personas</DropdownMenuLabel>
          {personas.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => choose(p)} className="gap-2.5 rounded-md px-2 py-1.5">
              <PersonRow person={p} current={p.id === personaId} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {approvers.length > 0 ? (
          <>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 pt-1 pb-1">Approvers</DropdownMenuLabel>
              {approvers.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => choose(p)} className="gap-2.5 rounded-md px-2 py-1.5">
                  <PersonRow person={p} current={p.id === personaId} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
