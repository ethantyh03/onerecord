import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Figure, Headline, SlideFrame, type SlideProps } from "../primitives";

// ---------------------------------------------------------------- S05 · root causes

const CAUSES: { today: string; so: string; big: ReactNode }[] = [
  {
    today: "Free-text email, no standard form",
    so: "Requests arrive incomplete and bounce",
    big: (
      <>
        <Figure size={40}>40%</Figure> <span className="text-muted-foreground">bounce at least once</span>
      </>
    ),
  },
  {
    today: "No way to check what already exists",
    so: "Duplicates slip into SAP",
    big: (
      <>
        <Figure size={40}>6%</Figure> <span className="text-muted-foreground">of new customers (A13)</span>
      </>
    ),
  },
  {
    today: "Forwarded to approvers one at a time, no reminders",
    so: "Nobody knows where a request is",
    big: (
      <>
        <span className="text-muted-foreground">Median</span> <Figure size={40}>14 days</Figure>{" "}
        <span className="text-muted-foreground">to set up</span>
      </>
    ),
  },
  {
    today: "Bank details and credit terms in ordinary email",
    so: "No trustworthy record of who approved what",
    big: <span className="text-muted-foreground">no audit trail</span>,
  },
  {
    today: "A new business unit means redrafting templates, with IT",
    so: "Marcus's team's requests sat for two weeks",
    big: (
      <>
        <Figure size={40}>2 weeks</Figure> <span className="text-muted-foreground">idle</span>
      </>
    ),
  },
];

export function S05RootCauses({ position }: SlideProps) {
  const cols = "grid grid-cols-[640px_620px_1fr] gap-x-[48px]";
  return (
    <SlideFrame position={position} label="40%, 6% and 14 days are labelled assumptions (A13, A26), illustrative. Marcus's two weeks: case brief, App B.">
      <Headline size={60}>
        Every symptom in the brief starts in the same place: master data is requested by email.
      </Headline>
      <div className="absolute top-[300px] left-[112px] w-[1696px]">
        <div className={cn(cols, "border-b border-border-strong pb-3 text-[20px] leading-none text-subtle")}>
          <span>Today (brief §3–4, App B)</span>
          <span>So</span>
          <span>How big</span>
        </div>
        {CAUSES.map((c) => (
          <div key={c.today} className={cn(cols, "items-baseline border-b border-border py-[19px] text-[28px] leading-[34px]")}>
            <span className="text-foreground">{c.today}</span>
            <span className="text-secondary-foreground">{c.so}</span>
            <span className="text-[24px] leading-[34px]">{c.big}</span>
          </div>
        ))}
        <p
          className="mt-[34px] font-semibold text-foreground"
          style={{ fontSize: 34, lineHeight: 1.15, fontStretch: "112%", letterSpacing: "-0.015em" }}
        >
          And the regional numbers are built on these same records.
        </p>
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- S06 · principles

const RULES: { rule: string; because: string }[] = [
  {
    rule: "Build on what Lives already owns.",
    because:
      "Microsoft 365 is the front door; SAP Business One stays the system of record. SAP Business One's built-in approvals are document-centric.",
  },
  { rule: "One record per real customer.", because: "Check for duplicates before approval; report on de-duplicated customers." },
  {
    rule: "Fix the process before buying software.",
    because: "Approvers decide in parallel, in Teams, on a two-business-day clock.",
  },
  { rule: "The MDM team owns the rules.", because: "A new business unit, field or approval step without an IT ticket." },
];

export function S06Principles({ position }: SlideProps) {
  return (
    <SlideFrame
      position={position}
      label="Checked against a better email template, SAP B1 approvals, Teams Approvals alone, Power Apps alone and an MDM suite (appendix A1)."
    >
      <Headline size={60}>A good fix uses what Lives already owns and stops bad data before anyone approves it.</Headline>
      <ol className="absolute top-[318px] left-[112px] w-[1696px] border-t border-border-strong">
        {RULES.map((r, i) => (
          <li key={r.rule} className="grid grid-cols-[72px_700px_1fr] items-baseline gap-x-[40px] border-b border-border py-[30px]">
            <span className="num text-subtle" style={{ fontSize: 34, lineHeight: 1, fontStretch: "112%" }}>
              {i + 1}
            </span>
            <span
              className="font-semibold text-foreground"
              style={{ fontSize: 38, lineHeight: 1.12, fontStretch: "112%", letterSpacing: "-0.018em" }}
            >
              {r.rule}
            </span>
            <span className="text-[27px] leading-[35px] text-muted-foreground">{r.because}</span>
          </li>
        ))}
      </ol>
    </SlideFrame>
  );
}
