"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SapCode } from "@/components/common/sap-code";
import { cn } from "@/lib/utils";
import { useStartAs } from "./use-start-as";

/** Three entities each keyed the same hospital their own way. OneRecord resolves them to one. */
const SPELLINGS = [
  { entity: "SPD", typed: "Natl Univ Hosp" },
  { entity: "QTS", typed: "National University Hosp." },
  { entity: "QTG", typed: "Nat'l University Hospital" },
];

function GoldenRecord() {
  return (
    <figure className="relative rounded-2xl border bg-card p-4 shadow-float">
      <figcaption className="text-[0.8125rem] font-medium text-muted-foreground">
        Three entities, three spellings of one hospital
      </figcaption>

      <ul className="mt-3 space-y-1.5">
        {SPELLINGS.map((s) => (
          <li
            key={s.entity}
            className="flex items-center gap-3 rounded-lg border border-dashed border-border-strong/80 bg-muted/45 px-3 py-1.5"
          >
            <span className="w-9 shrink-0 text-xs font-semibold text-muted-foreground">{s.entity}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-secondary-foreground line-through decoration-stuck/55 decoration-[1.5px]">
              {s.typed}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ok-ink">
              <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
              Matched
            </span>
          </li>
        ))}
      </ul>

      <div aria-hidden className="relative my-1.5 flex h-5 justify-center">
        <svg viewBox="0 0 120 24" className="h-5 w-24 text-border-strong" fill="none" preserveAspectRatio="none">
          <path d="M20 0c0 14 40 10 40 24M60 0v24M100 0c0 14-40 10-40 24" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary-soft px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-foreground">National University Hospital</p>
          <SapCode code="C-SG-00017" className="bg-card" />
        </div>
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.8125rem]">
          <dt className="text-muted-foreground">UEN</dt>
          <dd className="num font-mono text-[0.78rem] text-foreground">198500123K</dd>
          <dt className="text-muted-foreground">Address</dt>
          <dd className="text-foreground">5 Lower Kent Ridge Road, Singapore 119074</dd>
          <dt className="text-muted-foreground">Used by</dt>
          <dd className="text-foreground">SPD, QTS and QTG</dd>
        </dl>
      </div>
    </figure>
  );
}

export function LandingHero() {
  const startAs = useStartAs();

  return (
    <section className="grid items-center gap-x-12 gap-y-8 pt-1 pb-2 xl:grid-cols-[minmax(0,1fr)_360px] xl:pt-3">
      <div className="max-w-[50rem]">
        <h1 className="text-[clamp(2.25rem,3.2vw,3.5rem)] leading-[1.04] font-bold tracking-[-0.035em] text-foreground">
          <span className="block">Messy master data hides money.</span>
          <span className="mt-1 block">One hospital, one record.</span>
        </h1>
        <p className="mt-5 max-w-[64ch] text-base leading-relaxed text-secondary-foreground">
          One front door for new customers, vendors, items and cost centres across Lives Group. Requests arrive
          complete, approvers decide inside Teams, SAP Business One gets a clean import file instead of hand-keyed data,
          and the regional numbers are built on records the business can trust.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" className="h-11 gap-2 px-4 text-[0.9375rem]" onClick={() => startAs("amy", "/requests/new")}>
            Start as Amy
            <ArrowRight aria-hidden className="size-4" />
          </Button>
          <Link
            href="/pulse"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-4 text-[0.9375rem]")}
          >
            See Regional Pulse
          </Link>
        </div>
      </div>

      <GoldenRecord />
    </section>
  );
}
