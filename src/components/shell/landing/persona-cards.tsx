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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="personas-title" className="text-lg font-semibold tracking-[-0.015em] text-foreground">
            Walk through it as one of the four people in the case
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each start opens the screen where that person does their part. Switch any time from the top bar.
          </p>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LANDING_PERSONAS.map((lp) => {
          const person = people.find((p) => p.id === lp.id);
          const current = personaId === lp.id;
          return (
            <li
              key={lp.id}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-5 shadow-raised",
                current && "border-primary/35 ring-1 ring-primary/15",
              )}
            >
              <div className="flex items-center gap-3">
                <PersonAvatar person={person} size="lg" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate font-semibold text-foreground">{person?.name ?? lp.shortName}</p>
                  <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">{person?.title ?? ""}</p>
                </div>
              </div>

              <p className="mt-4 text-[0.9375rem] leading-snug text-foreground">{lp.pain}</p>
              <p className="mt-2.5 border-l-2 border-ok/50 pl-3 text-[0.8125rem] leading-snug text-secondary-foreground">
                {lp.change}
              </p>

              <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                <span className="text-xs text-muted-foreground">Opens {lp.startsOn}</span>
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
