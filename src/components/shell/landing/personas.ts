export interface LandingPersona {
  id: "amy" | "weijie" | "priya" | "marcus";
  shortName: string;
  /** Pain point, paraphrased from the case brief (Appendix B) */
  pain: string;
  /** What changes for them in OneRecord */
  change: string;
  href: string;
  startsOn: string;
}

export const LANDING_PERSONAS: LandingPersona[] = [
  {
    id: "amy",
    shortName: "Amy",
    pain: "Doesn't know every SAP field, so she has guessed at the ones she wasn't sure of.",
    change: "Pastes an old email; the form fills itself and asks only for what's missing.",
    href: "/requests/new",
    startsOn: "New request",
  },
  {
    id: "weijie",
    shortName: "Wei Jie",
    pain: "A request sitting in his inbox for four days isn't him being slow. It's him not seeing it.",
    change: "Approves from a Teams card, with a reminder before anything goes overdue.",
    href: "/approvals",
    startsOn: "Approvals",
  },
  {
    id: "priya",
    shortName: "Priya",
    pain: "Keys every approved record into SAP B1 by hand, and catches a near-duplicate only if she remembers it.",
    change: "Checks a clean record once, then imports it with a ready-made DTW file.",
    href: "/mdm",
    startsOn: "MDM console",
  },
  {
    id: "marcus",
    shortName: "Marcus",
    pain: "Nobody told his new team the process, so their first requests sat with the wrong people for two weeks.",
    change: "His business unit and its approvers are set up in Admin; the next request routes itself.",
    href: "/admin",
    startsOn: "Admin",
  },
];
