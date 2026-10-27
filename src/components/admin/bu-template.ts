import type { AppConfig, BusinessUnit } from "@/lib/types";
import { NEW_BU_TEMPLATE } from "@/config/default-config";

/**
 * The onboarding sheet for the newly acquired business (MLS), if the Add-BU form should start from it:
 * MLS is not configured yet and either the admin clicked "Set up MLS" or used "Add business unit" while
 * MLS people are still waiting for a setup. Returns null when the form should start blank.
 */
export function onboardingTemplateFor(config: Pick<AppConfig, "businessUnits" | "people">, presetCode?: string): BusinessUnit | null {
  const t = NEW_BU_TEMPLATE;
  if (config.businessUnits.some((b) => b.id === t.id)) return null;
  if (presetCode) return presetCode === t.id ? t : null;
  return config.people.some((p) => p.entity === t.id) ? t : null;
}

const PENDING_ENTITY_NAMES: Record<string, string> = {
  [NEW_BU_TEMPLATE.id]: `${NEW_BU_TEMPLATE.name.split(" — ").pop()}, newly acquired`,
};

/** Spell out an entity code that has no BU setup yet, e.g. "MLS (Meridian Life Sciences, newly acquired)". */
export function pendingEntityLabel(entity: string): string {
  const name = PENDING_ENTITY_NAMES[entity];
  return name ? `${entity} (${name})` : entity;
}

/** Short name for a select option, e.g. "MLS — Meridian Life Sciences" (the name the BU gets once set up). */
export function pendingEntityName(entity: string): string {
  return entity === NEW_BU_TEMPLATE.id ? NEW_BU_TEMPLATE.name : entity;
}
