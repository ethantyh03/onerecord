"use client";

import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import type { FieldDef } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { Phase2Badge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { describeRule, useSaveConfig } from "./shared";

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Fields &amp; rules</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Flip a switch to make a field mandatory or masked. Each change is saved as a new config version straight away.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg" />}>
            <Button variant="outline" size="sm" disabled data-testid="admin-add-domain">
              <Plus /> Add a whole new domain
            </Button>
            <Phase2Badge label="Roadmap" />
          </TooltipTrigger>
          <TooltipContent>Roadmap: the config schema already supports it</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Request type">
        {config.domains.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={d.id === domain.id}
            onClick={() => setDomainId(d.id)}
            data-testid={`admin-fields-domain-${d.id}`}
            className={cn(
              "h-8 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
              d.id === domain.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-raised">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                  <div className="font-mono text-[0.6875rem] text-muted-foreground">{f.key}</div>
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
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.75rem] text-foreground">{f.sapField}</code>
                  ) : (
                    <span className="text-xs text-muted-foreground">Attached in OneRecord</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">{f.maxLength ?? "—"}</TableCell>
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
