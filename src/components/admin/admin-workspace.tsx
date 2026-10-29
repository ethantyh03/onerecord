"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSandbox } from "@/lib/store";
import { useCurrentPerson } from "@/lib/selectors";
import { Notice, PageHeader, StatusText } from "@/components/common";
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

  // Arriving from a long, scrolled page (e.g. the demo scene list), the browser clamps the old scroll to this
  // page's first-paint height and Next keeps it (the header is "in view"), leaving the title ~32px under the
  // top bar. Snap a small leftover offset back to the top once on arrival. DOM only: no state is touched.
  useEffect(() => {
    if (window.scrollY > 0 && window.scrollY < 120 && !window.location.hash) window.scrollTo({ top: 0 });
  }, []);

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
          <StatusText tone="ok" data-testid="admin-config-version">
            Config v{config.version} live
          </StatusText>
        }
      />

      {!isAdmin ? (
        // A ruled line directly under the title's hairline: who you are viewing as, and the one-click switch.
        <Notice
          ruled
          tone="neutral"
          className="-mt-6 border-t-0"
          data-testid="admin-non-admin-banner"
          action={
            admins[0] ? (
              <Button size="sm" variant="outline" onClick={() => setPersona(admins[0].id)} data-testid="admin-switch-to-admin">
                Switch to {admins[0].name.split(" ")[0]}
              </Button>
            ) : null
          }
        >
          You&rsquo;re viewing as <span className="font-medium text-foreground">{me.name}</span>. Only the MDM team
          {admins.length ? ` (${admins.map((a) => a.name).join(", ")})` : ""} changes these settings in production; in this prototype you can still try them.
        </Notice>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <Tabs value={tab} onValueChange={(v) => changeTab(String(v))} className="min-w-0 gap-5">
          <div className="overflow-x-auto border-b border-border">
            <TabsList variant="line" className="h-10 gap-0 pb-1 2xl:gap-1">
              {ADMIN_TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="h-8 px-2 2xl:px-2.5" data-testid={`admin-tab-${t.id}`}>
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
          <Notice size="sm" tone="neutral" lead="In production:" className="pt-1" data-testid="admin-production-note">
            these settings live in a SharePoint config list that the MDM team edits; Power Automate reads them at run time.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
