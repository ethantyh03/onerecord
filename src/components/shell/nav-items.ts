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
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/", label: "Home", icon: House, hint: "How OneRecord works" }],
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
      { href: "/sap", label: "SAP B1", icon: Database, hint: "Simulated SAP Business One sandbox" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/pulse", label: "Regional Pulse", icon: Activity, hint: "Products A/B/C across five countries" },
      { href: "/triage", label: "Inbox triage", icon: Inbox, hint: "Sort the shared mailbox" },
      { href: "/impact", label: "Impact", icon: ChartNoAxesCombined, hint: "Business case and payback" },
    ],
  },
  {
    label: "The case",
    items: [
      { href: "/architecture", label: "Architecture", icon: Network, hint: "How it lands in SAP B1" },
      { href: "/scope", label: "Scope & roadmap", icon: ListChecks, hint: "What v1 does and does not do" },
      { href: "/assumptions", label: "Assumptions", icon: BookOpenCheck, hint: "Every number's source, A1–A28" },
    ],
  },
  {
    label: "Configure",
    items: [{ href: "/admin", label: "Admin", icon: SlidersHorizontal, hint: "Forms, routes and business units" }],
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
