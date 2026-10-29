import {
  ChartNoAxesCombined,
  Database,
  FilePlus2,
  Files,
  House,
  Inbox,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  Activity,
  BookOpenCheck,
  ListChecks,
  Network,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "approvals" | "mdm";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which live count to show next to the item */
  badge?: NavBadgeKey;
  /** Who usually works here, shown as a hint in the collapsed tooltip */
  hint: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
  /** Pin the group to the foot of the rail (reference pages, apart from daily work) */
  atEnd?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/", label: "Home", icon: House, hint: "Overview" }],
  },
  {
    label: "Requests",
    items: [
      { href: "/requests/new", label: "New request", icon: FilePlus2, hint: "Raise a customer, vendor, item or cost-centre request" },
      { href: "/requests", label: "My requests", icon: Files, hint: "Track where each request is" },
      { href: "/approvals", label: "Approvals", icon: Stamp, badge: "approvals", hint: "Steps waiting on you" },
    ],
  },
  {
    label: "Master data",
    items: [
      { href: "/mdm", label: "MDM console", icon: ShieldCheck, badge: "mdm", hint: "Final checks before SAP B1" },
      { href: "/sap", label: "SAP B1", icon: Database, hint: "SAP Business One" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/pulse", label: "Regional Pulse", icon: Activity, hint: "Products A/B/C across five countries" },
      { href: "/triage", label: "Inbox triage", icon: Inbox, hint: "Sort the shared mailbox" },
    ],
  },
  {
    label: "Configure",
    items: [{ href: "/admin", label: "Admin", icon: SlidersHorizontal, hint: "Forms, routes and business units" }],
  },
  {
    label: "About",
    atEnd: true,
    items: [
      { href: "/impact", label: "Business case", icon: ChartNoAxesCombined, hint: "Costs, savings and payback" },
      { href: "/architecture", label: "Architecture", icon: Network, hint: "How it lands in SAP B1" },
      { href: "/scope", label: "Scope & roadmap", icon: ListChecks, hint: "What v1 does and does not do" },
      { href: "/assumptions", label: "Assumptions", icon: BookOpenCheck, hint: "Every assumption and its basis" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The single nav item that owns a pathname: the longest href that matches. */
export function activeNavHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of NAV_ITEMS) {
    const match =
      item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
    if (match && (best === null || item.href.length > best.length)) best = item.href;
  }
  return best;
}
