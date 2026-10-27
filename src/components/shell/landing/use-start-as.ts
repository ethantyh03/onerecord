"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSandbox } from "@/lib/store";

/** Switch persona, then open that persona's starting screen. */
export function useStartAs() {
  const router = useRouter();
  return useCallback(
    (personId: string, href: string) => {
      const store = useSandbox.getState();
      const person = store.config.people.find((p) => p.id === personId);
      if (store.personaId !== personId) {
        store.setPersona(personId);
        if (person) toast(`Now viewing as ${person.name}`, { description: person.title });
      }
      router.push(href);
    },
    [router],
  );
}
