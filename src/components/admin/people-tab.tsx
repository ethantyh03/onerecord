"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import type { Person, RoleId } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { PersonAvatar } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { NativeSelect, PERSON_ROLES, roleLabel, SectionHeader, useSaveConfig } from "./shared";

function defaultDelegate(p: Person, people: Person[]): string | undefined {
  const ok = (id?: string) => !!id && id !== p.id && people.some((x) => x.id === id);
  if (ok(p.delegateId)) return p.delegateId;
  const peer = people.find((x) => x.id !== p.id && x.roles.some((r) => r !== "requestor" && p.roles.includes(r)));
  if (peer) return peer.id;
  return ok(p.managerId) ? p.managerId : people.find((x) => x.id !== p.id)?.id;
}

export function PeopleTab() {
  const config = useSandbox((s) => s.config);
  const setOutOfOffice = useSandbox((s) => s.setOutOfOffice);
  const save = useSaveConfig();
  const [editing, setEditing] = useState<{ id: string; roles: RoleId[] } | null>(null);
  const people = config.people;
  const byName = (id?: string) => people.find((p) => p.id === id)?.name ?? "—";

  function setOoo(p: Person, on: boolean, delegateId?: string) {
    if (on) {
      const d = delegateId ?? defaultDelegate(p, people);
      if (!d) return;
      setOutOfOffice(p.id, d);
      toast.success(`${p.name} is out of office`, { description: `Pending and upcoming approvals now go to ${byName(d)}.` });
    } else {
      setOutOfOffice(p.id, null);
      toast.success(`${p.name} is back in office`, { description: "New approvals go to them again." });
    }
  }

  function setDelegate(p: Person, delegateId: string) {
    if (p.outOfOffice) {
      setOutOfOffice(p.id, delegateId);
      toast.success(`Approvals for ${p.name} now go to ${byName(delegateId)}`);
      return;
    }
    save(
      { ...config, people: people.map((x) => (x.id === p.id ? { ...x, delegateId: delegateId || undefined } : x)) },
      `Delegate for ${p.name} set to ${delegateId ? byName(delegateId) : "nobody"}`,
    );
  }

  function saveRoles() {
    if (!editing) return;
    const p = people.find((x) => x.id === editing.id);
    if (!p) return;
    const added = editing.roles.filter((r) => !p.roles.includes(r));
    const removed = p.roles.filter((r) => !editing.roles.includes(r));
    setEditing(null);
    if (!added.length && !removed.length) return;
    const parts = [
      added.length ? `added ${added.map(roleLabel).join(", ")}` : "",
      removed.length ? `removed ${removed.map(roleLabel).join(", ")}` : "",
    ].filter(Boolean);
    const roles = PERSON_ROLES.filter((r) => editing.roles.includes(r));
    save({ ...config, people: people.map((x) => (x.id === p.id ? { ...x, roles } : x)) }, `Roles for ${p.name}: ${parts.join("; ")}`);
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="People & delegates"
        description="Roles decide which steps someone can approve. Mark someone out of office and their pending approvals move to the delegate at once."
      />

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Person</TableHead>
              <TableHead>BU · country</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-center">Out of office</TableHead>
              <TableHead className="pr-4">Delegate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => {
              const isEditing = editing?.id === p.id;
              const configured = config.businessUnits.some((b) => b.id === p.entity);
              return (
                <TableRow key={p.id} data-testid={`admin-person-${p.id}`}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <PersonAvatar person={p} size="md" away={p.outOfOffice} />
                      <div className="min-w-0 leading-tight">
                        <div className="font-medium text-foreground">{p.name}</div>
                        <div className="max-w-[18rem] truncate text-xs text-muted-foreground">{p.title}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[0.8125rem]">
                    <span className={cn("font-mono text-xs font-semibold", configured ? "text-foreground" : "text-warn-ink")}>{p.entity}</span>
                    <span className="text-muted-foreground"> · {p.country}</span>
                    {!configured ? <div className="text-xs text-warn-ink">BU not configured yet</div> : null}
                  </TableCell>
                  <TableCell className="max-w-[22rem] whitespace-normal">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-1" data-testid={`admin-person-${p.id}-roles-editor`}>
                        {PERSON_ROLES.map((r) => {
                          const on = editing.roles.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setEditing({ id: p.id, roles: on ? editing.roles.filter((x) => x !== r) : [...editing.roles, r] })}
                              className={cn(
                                "h-6 rounded-sm border px-1.5 text-xs font-medium transition-colors",
                                on ? "border-foreground/40 bg-primary-soft text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {roleLabel(r)}
                            </button>
                          );
                        })}
                        <Button size="icon-xs" aria-label="Save roles" onClick={saveRoles} data-testid={`admin-person-${p.id}-roles-save`}>
                          <Check />
                        </Button>
                        <Button size="icon-xs" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        {p.roles.length ? (
                          <span className="text-[0.8125rem] text-secondary-foreground">{p.roles.map((r) => roleLabel(r)).join(" · ")}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Escalations only</span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Edit roles for ${p.name}`}
                          onClick={() => setEditing({ id: p.id, roles: [...p.roles] })}
                          data-testid={`admin-person-${p.id}-roles-edit`}
                        >
                          <Pencil />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={!!p.outOfOffice}
                      aria-label={`${p.name} out of office`}
                      onCheckedChange={(on) => setOoo(p, on)}
                      data-testid={`admin-person-${p.id}-ooo`}
                    />
                  </TableCell>
                  <TableCell className="pr-4">
                    <NativeSelect
                      size="sm"
                      className="w-48"
                      value={p.delegateId ?? ""}
                      aria-label={`Delegate for ${p.name}`}
                      onChange={(e) => setDelegate(p, e.target.value)}
                      data-testid={`admin-person-${p.id}-delegate`}
                    >
                      {!p.outOfOffice ? <option value="">No delegate</option> : null}
                      {people
                        .filter((x) => x.id !== p.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </NativeSelect>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Out-of-office changes take effect immediately and are logged in the audit trail. In production, people and roles come from Entra ID groups.
      </p>
    </div>
  );
}
