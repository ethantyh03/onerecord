"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, RotateCcw } from "lucide-react";
import type { BusinessUnit, FieldDef, ProductGroup, RoleId, StageDef } from "@/lib/types";
import { PRODUCT_LABELS } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ASSIGNABLE_ROLES, FieldLabel, NativeSelect, PersonOptions, deepClone, roleLabel, useSaveConfig } from "./shared";
import { StageEditor, newStage } from "./stage-editor";
import { onboardingTemplateFor } from "./bu-template";

/** Roles every BU fills with its own people; the rest default to the shared group functions. */
const BU_SPECIFIC_ROLES: RoleId[] = ["bu_head", "business_support"];
/** Group functions named on the collapsed "shared group team" row. */
const SUMMARY_ROLES: RoleId[] = ["finance", "qa_ra"];

type Draft = {
  id: string;
  name: string;
  description: string;
  mainProduct: ProductGroup | null;
  roleAssignments: Partial<Record<RoleId, string>>;
  extraStages: StageDef[];
};

function blankDraft(shared: Partial<Record<RoleId, string>>, code = ""): Draft {
  const roleAssignments: Partial<Record<RoleId, string>> = {};
  for (const r of ASSIGNABLE_ROLES) if (!BU_SPECIFIC_ROLES.includes(r) && shared[r]) roleAssignments[r] = shared[r];
  return { id: code, name: "", description: "", mainProduct: null, roleAssignments, extraStages: [] };
}

function toDraft(bu: BusinessUnit): Draft {
  return deepClone({
    id: bu.id,
    name: bu.name,
    description: bu.description,
    mainProduct: bu.mainProduct,
    roleAssignments: bu.roleAssignments,
    extraStages: bu.extraStages,
  });
}

export interface BuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing BU to edit; omit to add a new one. */
  editing?: BusinessUnit;
  /** Prefill the code (e.g. an entity people already belong to). */
  presetCode?: string;
  onSaved?: (buId: string) => void;
}

export function BuSheet(props: BuSheetProps) {
  // Remount the form whenever the sheet opens for a different target so it always starts clean.
  const key = `${props.open}-${props.editing?.id ?? "new"}-${props.presetCode ?? ""}`;
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[720px]"
        data-testid="admin-bu-sheet"
      >
        {props.open ? <BuForm key={key} {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function BuForm({ editing, presetCode, onOpenChange, onSaved }: BuSheetProps) {
  const config = useSandbox((s) => s.config);
  const save = useSaveConfig();
  const shared = config.businessUnits[0]?.roleAssignments ?? {};
  // Computed once per open (the form remounts on open): MLS people are waiting, so start from its onboarding sheet.
  const [template] = useState(() => (editing ? null : onboardingTemplateFor(config, presetCode)));
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? toDraft(editing) : template ? toDraft(template) : blankDraft(shared, presetCode),
  );
  const [fromTemplate, setFromTemplate] = useState(!!template);
  const [showOtherRoles, setShowOtherRoles] = useState(false);
  const [tried, setTried] = useState(false);
  const isEdit = !!editing;
  /** BU stages apply to every request type, so a step condition can use any domain's field (first label wins). */
  const conditionFields = useMemo(() => {
    const byKey = new Map<string, FieldDef>();
    for (const d of config.domains) for (const f of d.fields) if (!byKey.has(f.key)) byKey.set(f.key, f);
    return [...byKey.values()];
  }, [config.domains]);

  const code = draft.id.trim().toUpperCase();
  const errors: Record<string, string> = {};
  if (!/^[A-Z0-9]{2,6}$/.test(code)) errors.code = "2–6 capital letters or digits, e.g. MLS";
  else if (!isEdit && config.businessUnits.some((b) => b.id === code)) errors.code = `${code} already exists`;
  if (!draft.name.trim()) errors.name = "Give the business unit a name";
  if (!draft.roleAssignments.bu_head) errors.bu_head = "Every BU needs a BU Head to approve its requests";
  draft.extraStages.forEach((s, i) => {
    if (!s.label.trim()) errors[`stage-${i}`] = "Name this stage";
  });
  const valid = Object.keys(errors).length === 0;
  const show = (k: string) => (tried ? errors[k] : undefined);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setRole = (role: RoleId, personId: string) =>
    setDraft((d) => {
      const roleAssignments = { ...d.roleAssignments };
      if (personId) roleAssignments[role] = personId;
      else delete roleAssignments[role];
      return { ...d, roleAssignments };
    });

  function applyTemplate() {
    if (!template) return;
    setDraft(toDraft(template));
    setFromTemplate(true);
    setTried(false);
  }

  function startBlank() {
    setDraft(blankDraft(shared));
    setFromTemplate(false);
    setTried(false);
  }

  const personName = (id?: string) => (id ? (config.people.find((p) => p.id === id)?.name ?? id) : undefined);
  const personTitle = (id?: string) => (id ? config.people.find((p) => p.id === id)?.title : undefined);
  const otherRoles = ASSIGNABLE_ROLES.filter((r) => !BU_SPECIFIC_ROLES.includes(r));
  const sharedSummary = SUMMARY_ROLES.map((r) => `${roleLabel(r)}: ${personName(draft.roleAssignments[r]) ?? "group default"}`);
  const moreCount = otherRoles.length - SUMMARY_ROLES.length;

  const roleSelect = (role: RoleId) => (
    <div key={role}>
      <FieldLabel htmlFor={`bu-role-${role}`} hint={BU_SPECIFIC_ROLES.includes(role) ? "BU's own" : undefined}>
        {roleLabel(role)}
      </FieldLabel>
      <NativeSelect
        id={`bu-role-${role}`}
        value={draft.roleAssignments[role] ?? ""}
        aria-invalid={role === "bu_head" && !!show("bu_head")}
        onChange={(e) => setRole(role, e.target.value)}
        data-testid={`bu-role-${role}`}
      >
        <option value="">{role === "bu_head" ? "Choose a person…" : "Use the group default"}</option>
        <PersonOptions people={config.people} role={role} nameOnly />
      </NativeSelect>
      {role === "bu_head" && show("bu_head") ? (
        <p className="mt-1 text-xs text-destructive">{errors.bu_head}</p>
      ) : personTitle(draft.roleAssignments[role]) ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{personTitle(draft.roleAssignments[role])}</p>
      ) : null}
    </div>
  );

  function onSave() {
    setTried(true);
    if (!valid) return;
    const roleAssignments: Partial<Record<RoleId, string>> = {};
    for (const [r, p] of Object.entries(draft.roleAssignments)) if (p) roleAssignments[r as RoleId] = p;
    const bu: BusinessUnit = {
      id: code,
      name: draft.name.trim(),
      description: draft.description.trim(),
      mainProduct: draft.mainProduct,
      roleAssignments,
      extraStages: draft.extraStages.map((s) => ({
        ...s,
        label: s.label.trim(),
        // Keep each step's condition (e.g. MLS pre-check only for product requests) exactly as drafted.
        steps: s.steps.map((st) => ({ ...st, label: st.label.trim() || `${roleLabel(st.role)} review` })),
      })),
    };
    const businessUnits = isEdit ? config.businessUnits.map((b) => (b.id === bu.id ? bu : b)) : [...config.businessUnits, bu];
    const stagesText = bu.extraStages.length ? ` with ${bu.extraStages.map((s) => s.label).join(" and ")}` : "";
    const summary = isEdit ? `Updated BU ${bu.name}${stagesText}` : `Added BU ${bu.name}${stagesText}`;
    save({ ...config, businessUnits }, summary);
    onSaved?.(bu.id);
    onOpenChange(false);
  }

  return (
    <>
      <SheetHeader className="border-b border-border px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 pr-8">
          <div>
            <SheetTitle className="text-lg font-semibold">{isEdit ? `Edit ${editing!.name}` : "Add business unit"}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Changes apply to requests submitted from now on. In-flight requests keep their route."
                : fromTemplate
                  ? `Prefilled from ${template?.id ?? "the new BU"}'s onboarding sheet. Check it and save: its people get the right approvals straight away.`
                  : "Its people start getting the right approvals as soon as you save."}
            </SheetDescription>
          </div>
          {!isEdit && template ? (
            fromTemplate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={startBlank}
                data-testid="admin-start-blank"
                className="shrink-0 text-muted-foreground"
              >
                <RotateCcw /> Start blank
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={applyTemplate} data-testid="admin-fill-demo" className="shrink-0 text-primary">
                Use {template.id} onboarding sheet
              </Button>
            )
          ) : null}
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
        <section className="space-y-3.5" aria-labelledby="bu-basics">
          <h3 id="bu-basics" className="text-sm font-semibold text-foreground">
            About the business unit
          </h3>
          <div className="grid gap-3.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div>
              <FieldLabel htmlFor="bu-code">Code</FieldLabel>
              <Input
                id="bu-code"
                value={draft.id}
                disabled={isEdit}
                maxLength={6}
                placeholder="MLS"
                aria-invalid={!!show("code")}
                className="font-mono uppercase"
                onChange={(e) => set("id", e.target.value.toUpperCase())}
                data-testid="bu-code"
              />
              {show("code") ? <p className="mt-1 text-xs text-destructive">{errors.code}</p> : null}
            </div>
            <div>
              <FieldLabel htmlFor="bu-name" hint="Shown everywhere, e.g. “MLS — Meridian Life Sciences”">
                Name
              </FieldLabel>
              <Input
                id="bu-name"
                value={draft.name}
                placeholder="MLS — Meridian Life Sciences"
                aria-invalid={!!show("name")}
                onChange={(e) => set("name", e.target.value)}
                data-testid="bu-name"
              />
              {show("name") ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="bu-description">What it sells</FieldLabel>
            <Textarea
              id="bu-description"
              rows={2}
              value={draft.description}
              placeholder="Molecular diagnostics and PCR workflow products"
              onChange={(e) => set("description", e.target.value)}
              data-testid="bu-description"
            />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="bu-product">Main product group</FieldLabel>
              <NativeSelect
                id="bu-product"
                value={draft.mainProduct ?? ""}
                onChange={(e) => set("mainProduct", (e.target.value || null) as ProductGroup | null)}
                data-testid="bu-main-product"
              >
                <option value="">Mixed / not set</option>
                {(Object.keys(PRODUCT_LABELS) as ProductGroup[]).map((g) => (
                  <option key={g} value={g}>
                    {PRODUCT_LABELS[g]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <FieldLabel>Countries</FieldLabel>
              <p className="pt-1 text-xs leading-snug text-muted-foreground">
                All five markets (SG, MY, TH, VN, MM). Each request carries its own country, so one BU can sell anywhere.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="bu-roles">
          <div>
            <h3 id="bu-roles" className="text-sm font-semibold text-foreground">
              Who approves for this BU
            </h3>
            <p className="text-xs text-muted-foreground">
              The BU names its own head and business support. Group functions use the shared team unless you change them.
            </p>
          </div>
          <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">{BU_SPECIFIC_ROLES.map(roleSelect)}</div>
          <div className="border-y border-border">
            <button
              type="button"
              className="flex w-full items-center gap-3 py-2 text-left text-[0.8125rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-expanded={showOtherRoles}
              aria-controls="bu-other-roles"
              onClick={() => setShowOtherRoles((v) => !v)}
              data-testid="bu-other-roles-toggle"
            >
              <span className="shrink-0 font-medium text-foreground">Shared group team</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {sharedSummary.join(" · ")}
                {moreCount > 0 ? ` · +${moreCount} more` : ""}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                {showOtherRoles ? "Hide" : "Change"}
                <ChevronDown className={showOtherRoles ? "size-3.5 rotate-180 transition-transform" : "size-3.5 transition-transform"} aria-hidden />
              </span>
            </button>
            {showOtherRoles ? (
              <div id="bu-other-roles" className="grid gap-x-4 gap-y-2.5 border-t border-border py-3 sm:grid-cols-2">
                {otherRoles.map(roleSelect)}
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="bu-stages">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 id="bu-stages" className="text-sm font-semibold text-foreground">
                Extra stages for this BU
              </h3>
              <p className="text-xs text-muted-foreground">Run after the normal approvals and before the MDM final check. Add “Only when…” to limit a step, e.g. to product requests.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("extraStages", [...draft.extraStages, newStage((code || "bu").toLowerCase())])}
              data-testid="bu-add-stage"
            >
              <Plus /> Add stage
            </Button>
          </div>
          {draft.extraStages.length === 0 ? (
            <p className="border-y border-border py-3 text-[0.8125rem] text-muted-foreground">
              No extra stages. Requests follow the standard route for their type.
            </p>
          ) : (
            <div>
              {draft.extraStages.map((stage, i) => (
                <div key={stage.id}>
                  <StageEditor
                    stage={stage}
                    index={i}
                    testIdPrefix="bu"
                    fields={conditionFields}
                    isLast={i === draft.extraStages.length - 1}
                    onChange={(s) => set("extraStages", draft.extraStages.map((x, j) => (j === i ? s : x)))}
                    onRemove={() => set("extraStages", draft.extraStages.filter((_, j) => j !== i))}
                  />
                  {show(`stage-${i}`) ? <p className="mt-1 text-xs text-destructive">{errors[`stage-${i}`]}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-border px-6 py-3.5">
        <p className="text-xs text-muted-foreground">Saving creates config v{config.version + 1}.</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} data-testid="bu-save" aria-disabled={tried && !valid}>
            {isEdit ? "Save changes" : "Save business unit"}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}
