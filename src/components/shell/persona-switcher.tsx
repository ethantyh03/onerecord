"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronsUpDown } from "lucide-react";
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

/** The four people the story follows, in story order, with what each one does. */
const STORY: { id: string; does: string }[] = [
  { id: "amy", does: "raises requests" },
  { id: "weijie", does: "approves" },
  { id: "priya", does: "MDM final check" },
  { id: "marcus", does: "new business unit" },
];
const STORY_IDS = new Set(STORY.map((s) => s.id));

function PersonRow({ person, current, does }: { person: Person; current: boolean; does?: string }) {
  return (
    <>
      <PersonAvatar person={person} size="md" away={person.outOfOffice} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-foreground">
          {person.name}
          {does ? <span className="font-normal text-muted-foreground"> · {does}</span> : null}
        </span>
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

  const [showMore, setShowMore] = useState(false);

  const { story, approvers, others } = useMemo(() => {
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name);
    return {
      story: STORY.flatMap((s) => {
        const p = people.find((x) => x.id === s.id);
        return p ? [{ person: p, does: s.does }] : [];
      }),
      approvers: people.filter((p) => !STORY_IDS.has(p.id) && p.persona).sort(byName),
      others: people.filter((p) => !STORY_IDS.has(p.id) && !p.persona).sort(byName),
    };
  }, [people]);
  const currentIsHidden = !STORY_IDS.has(personaId);
  const expanded = showMore || currentIsHidden;
  const moreCount = approvers.length + others.length;

  function choose(person: Person) {
    if (person.id === personaId) return;
    useSandbox.getState().setPersona(person.id);
    toast(`Now viewing as ${person.name}`, { description: person.title, position: "bottom-left" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group/persona flex h-full max-w-[24rem] min-w-0 items-center gap-2.5 px-3 text-left outline-none transition-colors sm:px-4",
          "hover:bg-secondary/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-popup-open:bg-secondary/70",
          className,
        )}
        aria-label={current ? `Viewing as ${current.name}. Switch persona` : "Choose a persona"}
      >
        <PersonAvatar person={current} size="md" away={current?.outOfOffice} />
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="text-xs text-subtle">Viewing as</span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-sm font-semibold text-foreground">{current?.name ?? "Choose a persona"}</span>
            <span className="hidden truncate text-xs text-muted-foreground xl:inline">{current?.title ?? ""}</span>
          </span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-subtle group-hover/persona:text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="max-h-[min(36rem,80dvh)] w-[24rem] overflow-y-auto p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 pt-2 pb-1">The four in the story</DropdownMenuLabel>
          {story.map(({ person, does }) => (
            <DropdownMenuItem
              key={person.id}
              onClick={() => choose(person)}
              className="gap-2.5 px-2 py-1.5"
            >
              <PersonRow person={person} current={person.id === personaId} does={does} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {moreCount > 0 ? (
          <>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              closeOnClick={false}
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={expanded}
              className="px-2 py-1.5 text-[0.8125rem] font-medium text-muted-foreground"
            >
              <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Hide other people" : `Show ${moreCount} other people (approvers and requestors)`}
            </DropdownMenuItem>
          </>
        ) : null}
        {expanded && approvers.length > 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 pt-2 pb-1">Other approvers</DropdownMenuLabel>
            {approvers.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => choose(p)} className="gap-2.5 px-2 py-1.5">
                <PersonRow person={p} current={p.id === personaId} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
        {expanded && others.length > 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 pt-2 pb-1">Everyone else</DropdownMenuLabel>
            {others.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => choose(p)} className="gap-2.5 px-2 py-1.5">
                <PersonRow person={p} current={p.id === personaId} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
