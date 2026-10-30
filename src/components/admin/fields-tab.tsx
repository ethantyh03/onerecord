"use client";

import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import type { FieldDef } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { SapCode } from "@/components/common";
import { PlannedBadge } from "@/components/mdm/PlannedBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeRule, DomainSwitch, SectionHeader, useSaveConfig } from "./shared";

const TYPE_LABELS: Record<FieldDef["type"], string> = {
  text: "Text",
  textarea: "Long text",
  number: "Number",
  email: "Email",
  phone: "Phone",
  select: "Pick list",
  date: "Date",
  file: "Attachment",
  country: "Country",
  entity: "Business unit",
};

export function FieldsTab() {
  const config = useSandbox((s) => s.config);
  const save = useSaveConfig();
  const [domainId, setDomainId] = useState(config.domains[0]?.id ?? "");
  const domain = config.domains.find((d) => d.id === domainId) ?? config.domains[0];
  const labelOf = (key: string) => domain.fields.find((f) => f.key === key)?.label ?? key;

  function patchField(key: string, patch: Partial<FieldDef>, summary: string) {
    const next = {
      ...config,
      domains: config.domains.map((d) =>
        d.id === domain.id ? { ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) } : d,
      ),
    };
    save(next, summary);
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Fields & rules"
        description="Flip a switch to make a field mandatory or masked. Each change is saved as a new config version straight away."
        actions={
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg" />}>
            <Button variant="outline" size="sm" disabled data-testid="admin-add-domain">
              <Plus /> Add a whole new domain
            </Button>
            <PlannedBadge />
          </TooltipTrigger>
          <TooltipContent>Adding a new request domain is planned</TooltipContent>
        </Tooltip>
        }
      />

      <DomainSwitch domains={config.domains} value={domain.id} onChange={setDomainId} testIdPrefix="admin-fields-domain" />

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Field</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Required</TableHead>
              <TableHead className="text-center">Sensitive</TableHead>
              <TableHead>Required when</TableHead>
              <TableHead>SAP B1 field</TableHead>
              <TableHead className="pr-4 text-right">Max length</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domain.fields.map((f) => (
              <TableRow key={f.key} data-testid={`admin-field-row-${domain.id}-${f.key}`}>
                <TableCell className="pl-4">
                  <div className="font-medium text-foreground">{f.label}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="mono-id">{f.key}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{TYPE_LABELS[f.type] ?? f.type}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={f.required}
                    aria-label={`${f.label} required`}
                    onCheckedChange={(checked) =>
                      patchField(
                        f.key,
                        { required: checked },
                        `Fields · ${domain.label}: “${f.label}” is now ${checked ? "required" : "optional"}`,
                      )
                    }
                    data-testid={`admin-field-required-${domain.id}-${f.key}`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={!!f.sensitive}
                    aria-label={`${f.label} sensitive`}
                    onCheckedChange={(checked) =>
                      patchField(
                        f.key,
                        { sensitive: checked },
                        `Fields · ${domain.label}: “${f.label}” is ${checked ? "now masked for non-Finance roles" : "no longer masked"}`,
                      )
                    }
                    data-testid={`admin-field-sensitive-${domain.id}-${f.key}`}
                  />
                </TableCell>
                <TableCell className="max-w-[16rem] text-[0.8125rem]">
                  {f.required ? (
                    <span className="text-muted-foreground">Always</span>
                  ) : f.requiredIf ? (
                    <span className="whitespace-normal text-warn-ink">{describeRule(f.requiredIf, labelOf)}</span>
                  ) : (
                    <span className="text-muted-foreground">Optional</span>
                  )}
                </TableCell>
                <TableCell>
                  {f.sapField ? (
                    <SapCode code={f.sapField} className="text-[0.75rem]" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Attached in Tesseract</span>
                  )}
                </TableCell>
                <TableCell className="num pr-4 text-right text-muted-foreground">{f.maxLength ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Max lengths mirror SAP B1 column sizes, so a record that passes here imports cleanly. Sensitive fields are masked for everyone except Finance and MDM.
      </p>
    </div>
  );
}
