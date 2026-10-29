"use client";

import { ArrowRight } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/common/person-avatar";
import { LANDING_PERSONAS } from "./personas";
import { useStartAs } from "./use-start-as";

export function PersonaCards() {
  const startAs = useStartAs();
  const people = useSandbox((s) => s.config.people);
  const personaId = useSandbox((s) => s.personaId);

  return (
    <section aria-labelledby="personas-title">
      <div className="mb-3">
        <h2 id="personas-title" className="panel-title text-base">
          Walk through it as one of the four people in the case
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Each start opens the screen where that person does their part. Switch any time from the top bar.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LANDING_PERSONAS.map((lp) => {
          const person = people.find((p) => p.id === lp.id);
          const current = personaId === lp.id;
          return (
            <li
              key={lp.id}
              className={cn("panel relative flex flex-col overflow-hidden", current && "border-border-strong")}
            >
              {/* The persona you are viewing as: the same 2px bar the rail uses for the current page */}
              {current ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}
              <div className="panel-header justify-start gap-3 py-3">
                <PersonAvatar person={person} size="md" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[0.9375rem] font-semibold text-foreground">{person?.name ?? lp.shortName}</p>
                  <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">{person?.title ?? ""}</p>
                </div>
              </div>

              <div className="px-4 pt-3.5 pb-4">
                <p className="text-[0.9375rem] leading-snug text-foreground">{lp.pain}</p>
                <p className="mt-3 border-l-2 border-ok/60 pl-3 text-sm leading-snug text-secondary-foreground">
                  {lp.change}
                </p>
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <span className="text-xs text-subtle">Opens {lp.startsOn}</span>
                <Button
                  variant={current ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => startAs(lp.id, lp.href)}
                >
                  Start as {lp.shortName}
                  <ArrowRight aria-hidden className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
