"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { BusinessUnit, ProductGroup, RoleId, StageDef } from "@/lib/types";
import { PRODUCT_LABELS } from "@/lib/types";
import { NEW_BU_TEMPLATE } from "@/config/default-config";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ASSIGNABLE_ROLES, FieldLabel, NativeSelect, PersonOptions, deepClone, roleLabel, useSaveConfig } from "./shared";
import { StageEditor, newStage } from "./stage-editor";

/** Roles every BU fills with its own people; the rest default to the shared group functions. */
const BU_SPECIFIC_ROLES: RoleId[] = ["bu_head", "business_support"];

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
  const [draft, setDraft] = useState<Draft>(() => (editing ? toDraft(editing) : blankDraft(shared, presetCode)));
  const [tried, setTried] = useState(false);
  const isEdit = !!editing;

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

  function fillDemo() {
    setDraft(toDraft(NEW_BU_TEMPLATE));
    setTried(false);
  }

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
                : "Its people start getting the right approvals as soon as you save. No IT ticket."}
            </SheetDescription>
          </div>
          {!isEdit ? (
            <Button type="button" variant="ghost" size="sm" onClick={fillDemo} data-testid="admin-fill-demo" className="shrink-0 text-primary">
              <Sparkles /> Fill demo values
            </Button>
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
              <p className="rounded-lg border border-dashed border-border-strong px-2.5 py-1.5 text-xs leading-snug text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">Group functions (Finance, QA/RA, MDM…) are prefilled with the shared team. Change any of them.</p>
          </div>
          <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
            {ASSIGNABLE_ROLES.map((role) => (
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
                  <PersonOptions people={config.people} role={role} />
                </NativeSelect>
                {role === "bu_head" && show("bu_head") ? <p className="mt-1 text-xs text-destructive">{errors.bu_head}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="bu-stages">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 id="bu-stages" className="text-sm font-semibold text-foreground">
                Extra stages for this BU
              </h3>
              <p className="text-xs text-muted-foreground">Run after the normal approvals and before the MDM final check, for every request from this BU.</p>
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
            <p className="rounded-lg border border-dashed border-border-strong px-3 py-3 text-[0.8125rem] text-muted-foreground">
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

      <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-3.5">
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
