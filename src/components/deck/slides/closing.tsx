"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { LINKS } from "@/lib/links";
import { DecodeText } from "../decode-text";
import { Headline, MetaColumns, SlideFrame, type SlideProps } from "../primitives";

// ---------------------------------------------------------------- S12 · pilot

const KPIS: { kpi: string; today: string; target: string }[] = [
  { kpi: "Requests through Tesseract", today: "0% (email)", target: "≥ 90%" },
  { kpi: "Median setup time", today: "14 days", target: "≤ 4 business days" },
  { kpi: "Requests bounced for missing information", today: "40%", target: "< 15%" },
  { kpi: "Duplicates stopped at intake", today: "not measured", target: "counted weekly" },
  { kpi: "Customer orders waiting on a setup (S$)", today: "tracked live", target: "falling" },
];

export function S12Pilot({ position }: SlideProps) {
  const cols = "grid grid-cols-[820px_1fr_1fr] gap-x-[40px]";
  return (
    <SlideFrame position={position} label="Baselines are labelled assumptions (A13, A26).">
      <Headline size={60}>We prove it in a six-week pilot, decided at a week-6 gate.</Headline>
      <MetaColumns
        className="absolute top-[256px] left-[112px] w-[1696px]"
        colClassName="first:border-l-0 first:pl-0"
        cols={[
          { top: "Length", bottom: "6 weeks" },
          { top: "Countries", bottom: "Singapore + Malaysia" },
          { top: "Domains", bottom: "Customers + items" },
          { top: "Business units", bottom: "SPD + QTS" },
          { top: "Week 1", bottom: "Rerun the analysis on real SAP B1 extracts" },
        ]}
      />
      <div className="absolute top-[370px] left-[112px] w-[1696px]">
        <div className={cn(cols, "border-b border-border-strong pb-3 text-[20px] leading-none text-subtle")}>
          <span>KPI</span>
          <span>Today</span>
          <span>Target by week 6</span>
        </div>
        {KPIS.map((k) => (
          <div key={k.kpi} className={cn(cols, "num items-baseline border-b border-border py-[15px] text-[28px] leading-[34px]")}>
            <span className="text-foreground">{k.kpi}</span>
            <span className="text-muted-foreground">{k.today}</span>
            <span className="font-semibold text-foreground">{k.target}</span>
          </div>
        ))}
      </div>
      <div className="absolute top-[770px] left-[112px] grid w-[1696px] grid-cols-[1fr_1fr] border-t-2 border-border-strong pt-7">
        <div className="pr-10">
          <p className="text-[22px] leading-none text-subtle">Week-6 gate</p>
          <p className="mt-3 text-[30px] leading-[38px] text-secondary-foreground">
            Median over 6 business days, or adoption under 70% → <span className="font-semibold text-foreground">fix or stop</span>
          </p>
        </div>
        <div className="border-l border-border-strong pl-10">
          <p className="text-[22px] leading-none text-subtle">Targets met</p>
          <p className="mt-3 text-[30px] leading-[38px] text-secondary-foreground">
            → Thailand, Vietnam, Myanmar, then vendors and cost centres
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- S13 · risks

const RISKS: { risk: string; doo: string; watch: string }[] = [
  {
    risk: "People keep emailing",
    doo: "After 4 weeks the MDM mailbox auto-replies with the form link; a champion per entity and country; 30-minute onboarding",
    watch: "Share of requests through Tesseract",
  },
  {
    risk: "Approvers miss one more notification",
    doo: "One-click approval in Teams; reminder after 1 business day, escalation after 3",
    watch: "SLA scoreboard: who is waiting on whom",
  },
  {
    risk: "Sensitive values leak",
    doo: "Bank and credit values never on the card; Finance and MDM only; every view logged; nobody approves their own request",
    watch: "Audit trail",
  },
  {
    risk: "Our numbers don't hold on real data",
    doo: "Week-1 rerun on SAP B1 extracts; the matcher suggests, MDM decides",
    watch: "The week-6 gate",
  },
];

export function S13Risks({ position }: SlideProps) {
  const cols = "grid grid-cols-[440px_1fr_420px] gap-x-[48px]";
  return (
    <SlideFrame position={position}>
      <Headline size={60}>The biggest risk is habit, so we take away the email path instead of asking people to change.</Headline>
      <div className="absolute top-[300px] left-[112px] w-[1696px]">
        <div className={cn(cols, "border-b border-border-strong pb-3 text-[20px] leading-none text-subtle")}>
          <span>Risk</span>
          <span>What we do</span>
          <span>What we watch weekly</span>
        </div>
        {RISKS.map((r) => (
          <div key={r.risk} className={cn(cols, "items-baseline border-b border-border py-[24px]")}>
            <span
              className="font-semibold text-foreground"
              style={{ fontSize: 30, lineHeight: 1.15, fontStretch: "108%", letterSpacing: "-0.012em" }}
            >
              {r.risk}
            </span>
            <span className="text-[26px] leading-[35px] text-secondary-foreground">{r.doo}</span>
            <span className="text-[26px] leading-[35px] text-muted-foreground">{r.watch}</span>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- S14 · close (T1 bookend)

const host = (url: string) => url.replace(/^https?:\/\//, "");

/** The three numbers to remember, as on slide 10: a big figure, a small label. Each figure is in the numbers ledger. */
const CLOSE_FIGURES: { figure: string; label: string; flex?: number }[] = [
  { figure: "≤ 4 business days", label: "median setup time, from 14 days", flex: 1.4 },
  { figure: "≈1,750 hours", label: "back a year", flex: 1.1 },
  { figure: "≈6 months", label: "payback", flex: 0.9 },
];

export function S14Close({ mode, play, position }: SlideProps) {
  const animated = mode === "live" && play;
  const [decoded, setDecoded] = useState(!animated);
  const tr = animated ? { duration: 0.45, delay: 0.1 } : { duration: 0 };
  return (
    <SlideFrame position={position} label="From labelled assumptions (A12–A26); synthetic, illustrative data.">
      <motion.div initial={false} animate={{ opacity: decoded ? 1 : 0 }} transition={tr}>
        <p
          className="absolute top-[92px] left-[112px] max-w-[1500px] text-foreground"
          style={{ fontSize: 40, lineHeight: 1.2, fontStretch: "106%", letterSpacing: "-0.012em", textWrap: "balance" }}
        >
          <span className="font-semibold">Our ask:</span> approve phase 1 (S$39.9k, mostly internal time, no new licences for
          the workflow) and a six-week pilot in Singapore and Malaysia, decided at the week-6 gate.
        </p>
        <dl className="absolute top-[284px] left-[112px] flex w-[1696px]">
          {CLOSE_FIGURES.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "flex min-w-0 flex-col-reverse border-l border-border-strong px-10",
                i === 0 ? "border-l-0 pl-0" : "",
                i === CLOSE_FIGURES.length - 1 ? "pr-0" : "",
              )}
              style={{ flex: f.flex ?? 1 }}
            >
              <dt className="mt-3 text-[26px] leading-[32px] text-muted-foreground">{f.label}</dt>
              <dd
                className="num font-semibold whitespace-nowrap text-foreground"
                style={{ fontSize: 56, lineHeight: 1, fontStretch: "112%", letterSpacing: "-0.025em" }}
              >
                {f.figure}
              </dd>
            </div>
          ))}
        </dl>
        <MetaColumns
          className="absolute top-[476px] left-[112px] w-[1696px]"
          colClassName="first:border-l-0 first:pl-0 [&_dd]:normal-case [&_dd]:tracking-normal"
          cols={[
            { top: "Live prototype", bottom: host(LINKS.liveUrl) },
            { top: "Code", bottom: host(LINKS.github) },
            { top: "Demo video", bottom: host(LINKS.youtube) },
            { top: "Team CTFudders", bottom: "SMU DSA 2026" },
          ]}
        />
      </motion.div>

      <h2
        className="absolute bottom-[78px] left-[104px] font-medium text-foreground/95"
        style={{ fontSize: 176, lineHeight: 0.98, fontStretch: "112%", letterSpacing: "-0.04em" }}
      >
        <DecodeText text="One hospital." play={animated} duration={700} />
        <br />
        <DecodeText text="One record." play={animated} duration={760} onDone={() => setDecoded(true)} />
      </h2>
    </SlideFrame>
  );
}
