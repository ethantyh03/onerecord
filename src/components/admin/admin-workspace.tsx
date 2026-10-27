"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Database, Eye } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { useCurrentPerson } from "@/lib/selectors";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalRoutesTab } from "./approval-routes-tab";
import { BusinessUnitsTab } from "./business-units-tab";
import { FieldsTab } from "./fields-tab";
import { HistoryTab } from "./history-tab";
import { PeopleTab } from "./people-tab";
import { RouteTestPanel, type RouteTestState } from "./route-test-panel";
import { SlaTab } from "./sla-tab";
import { ADMIN_TABS, type AdminTabId } from "./shared";

const TAB_IDS = new Set<string>(ADMIN_TABS.map((t) => t.id));

export function AdminWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const config = useSandbox((s) => s.config);
  const setPersona = useSandbox((s) => s.setPersona);
  const me = useCurrentPerson();
  const isAdmin = me.roles.includes("admin");

  const fromUrl = params.get("tab");
  const [tab, setTab] = useState<AdminTabId>(fromUrl && TAB_IDS.has(fromUrl) ? (fromUrl as AdminTabId) : "business-units");
  const [routeTest, setRouteTest] = useState<RouteTestState>(() => ({
    domainId: config.domains.some((d) => d.id === "item") ? "item" : (config.domains[0]?.id ?? ""),
    buId: config.people.some((p) => p.entity === "MLS") ? "MLS" : (config.businessUnits[0]?.id ?? ""),
    values: {},
  }));

  function changeTab(next: string) {
    if (!TAB_IDS.has(next)) return;
    setTab(next as AdminTabId);
    const qs = new URLSearchParams(params.toString());
    qs.set("tab", next);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }

  const admins = config.people.filter((p) => p.roles.includes("admin"));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin settings"
        subtitle="Change who approves what, which fields are required and how long approvers have. The MDM team does it here, with no IT ticket and no code change."
        meta={
          <span
            className="inline-flex h-6 items-center gap-1.5 rounded-full border border-ok/30 bg-ok-soft px-2.5 text-xs font-semibold text-ok-ink"
            data-testid="admin-config-version"
          >
            <span className="size-1.5 rounded-full bg-ok" aria-hidden />
            Config v{config.version} live
          </span>
        }
      />

      {!isAdmin ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-[0.8125rem]"
          data-testid="admin-non-admin-banner"
          role="note"
        >
          <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-muted-foreground">
            You&rsquo;re viewing as <span className="font-medium text-foreground">{me.name}</span>. Only the MDM team
            {admins.length ? ` (${admins.map((a) => a.name).join(", ")})` : ""} changes these settings in production; in this prototype you can still try them.
          </p>
          {admins[0] ? (
            <Button size="sm" variant="outline" onClick={() => setPersona(admins[0].id)} data-testid="admin-switch-to-admin">
              Switch to {admins[0].name.split(" ")[0]}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Tabs value={tab} onValueChange={(v) => changeTab(String(v))} className="min-w-0 gap-5">
          <div className="overflow-x-auto border-b border-border">
            <TabsList variant="line" className="h-10 gap-1 pb-1">
              {ADMIN_TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="h-8 px-2.5" data-testid={`admin-tab-${t.id}`}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="business-units">
            <BusinessUnitsTab onBuSaved={(buId) => setRouteTest((s) => ({ ...s, buId }))} />
          </TabsContent>
          <TabsContent value="routes">
            <ApprovalRoutesTab />
          </TabsContent>
          <TabsContent value="fields">
            <FieldsTab />
          </TabsContent>
          <TabsContent value="people">
            <PeopleTab />
          </TabsContent>
          <TabsContent value="sla">
            <SlaTab />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>

        <aside className="space-y-3 xl:sticky xl:top-20">
          <RouteTestPanel state={routeTest} onChange={setRouteTest} />
          <p
            className="flex gap-2 rounded-xl border border-dashed border-border-strong px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground"
            data-testid="admin-production-note"
          >
            <Database className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold text-foreground">In production:</span> these settings live in a SharePoint config list that the MDM team
              edits; Power Automate reads them at run time.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
