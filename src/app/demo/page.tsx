"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clapperboard, ExternalLink, Loader2, Play, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader, PersonAvatar } from "@/components/common";
import { useSandbox } from "@/lib/store";
import { SCENES, loadScene, nudgeClock, type Scene, type SceneId } from "@/lib/scenes";
import { cn } from "@/lib/utils";

const LAST_KEY = "onerecord-demo-last-loaded";

/** Storyboard beats that are not store scenes: pitch frames and short inserts. */
interface OpenBeat {
  kind: "open";
  key: string;
  timecode: string;
  title: string;
  href: string;
  /** Reset the sandbox and pick this persona before opening. */
  resetAs?: string;
  description: string;
  checklist: string[];
  voiceover: string;
  extraLink?: { label: string; href: string };
}

interface SceneBeat {
  kind: "scene";
  key: SceneId;
  scene: Scene;
}

type Beat = OpenBeat | SceneBeat;

const sceneBeat = (id: SceneId): SceneBeat => {
  const scene = SCENES.find((s) => s.id === id)!;
  return { kind: "scene", key: id, scene };
};

const BEATS: Beat[] = [
  {
    kind: "open",
    key: "hook",
    timecode: "0:00–0:12",
    title: "Hook: 18 days",
    href: "/pitch/hook",
    description:
      "Full-screen black frame. The day counter plays on load (about 8 seconds). Press R to replay, Esc to come back here.",
    checklist: [
      "Start recording, then click Open here (opening from the console avoids a page reload flash).",
      "Let the counter reach 18 and hold for a beat.",
    ],
    voiceover:
      "Amy needed one new item code. It took eighteen days, a bounced request and three approvers one at a time — and her sales order still failed.",
    extraLink: { label: "Final frame", href: "/pitch/hook?still=1" },
  },
  {
    kind: "open",
    key: "frame",
    timecode: "0:12–0:22",
    title: "Frame: clean in, money out",
    href: "/",
    resetAs: "amy",
    description: "Resets the sandbox, selects Amy and opens Home.",
    checklist: [
      "Hold on the headline: “Messy master data hides money. One hospital, one record.”",
      "Point at the badge above it: Runs on Microsoft 365 · lands in SAP Business One.",
      "Point at the three spellings (Natl Univ Hosp · National University Hosp. · Nat'l University Hospital) merging into National University Hospital, C-SG-00017.",
      "Let the process strip below run to step 6, Regional Pulse.",
    ],
    voiceover:
      "Lives Group's master data is created by email. Records arrive incomplete and duplicated, so the regional numbers built on them can't be trusted. OneRecord fixes both ends.",
  },
  sceneBeat("amy-intake"),
  sceneBeat("admin-marcus"),
  sceneBeat("marcus-dup"),
  sceneBeat("weijie-teams"),
  {
    kind: "open",
    key: "architecture",
    timecode: "1:20–1:24",
    title: "Insert: how it lands in SAP B1",
    href: "/architecture",
    description: "A 4-second hold on the swimlane. No reset; it doesn't depend on demo state.",
    checklist: ["Hold on the highlighted path and the who-builds colours."],
    voiceover:
      "SAP Business One's built-in approvals are document-centric: no structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests. So approvals live in Microsoft 365 and SAP stays the system of record.",
  },
  sceneBeat("priya-sap"),
  sceneBeat("pulse"),
  {
    kind: "open",
    key: "close",
    timecode: "2:32–2:45",
    title: "Close: one hospital, one record",
    href: "/pitch/close",
    description: "Full-screen brand frame with the three numbers, the tagline and the links. Esc comes back here.",
    checklist: ["Open the frame and hold until the voice-over ends."],
    voiceover:
      "Built on the Microsoft 365 Lives already owns, live in about six weeks, paid back in about six months. One hospital, one record.",
    extraLink: { label: "Final frame", href: "/pitch/close?still=1" },
  },
];

const voiceOf = (b: Beat) => (b.kind === "scene" ? b.scene.voiceoverHint : b.voiceover);
const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export default function DemoConsolePage() {
  const router = useRouter();
  const people = useSandbox((s) => s.config.people);
  const resetSandbox = useSandbox((s) => s.resetSandbox);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastLoaded(window.sessionStorage.getItem(LAST_KEY));
    } catch {
      /* storage unavailable: no highlight */
    }
  }, []);

  const remember = (key: string) => {
    setLastLoaded(key);
    try {
      window.sessionStorage.setItem(LAST_KEY, key);
    } catch {
      /* storage unavailable */
    }
  };

  const totalWords = useMemo(() => BEATS.reduce((a, b) => a + wordCount(voiceOf(b)), 0), []);
  const minutes = totalWords / 150;

  async function onLoadScene(id: SceneId) {
    if (busy) return;
    setBusy(id);
    try {
      const route = await loadScene(id);
      remember(id);
      // Leave /demo at the top so a short target page isn't left with a clamped scroll offset.
      window.scrollTo(0, 0);
      router.push(route);
    } catch (err) {
      toast.error("Couldn't load the scene", {
        description: err instanceof Error ? err.message : "Reset the demo and try again.",
      });
      setBusy(null);
    }
  }

  function onOpen(beat: OpenBeat) {
    if (beat.resetAs) {
      const s = useSandbox.getState();
      const previousOffsetMs = s.clockOffsetMs;
      s.resetSandbox();
      useSandbox.getState().setPersona(beat.resetAs);
      nudgeClock(previousOffsetMs);
    }
    remember(beat.key);
    window.scrollTo(0, 0);
    router.push(beat.href);
  }

  function onReset() {
    const previousOffsetMs = useSandbox.getState().clockOffsetMs;
    resetSandbox();
    nudgeClock(previousOffsetMs);
    toast.success("Demo reset", { description: "Back to the starting scenario: Wed 28 Oct, 09:00 SGT, Amy selected." });
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Director's console"
        subtitle="Every scene resets the sandbox, then replays the same scripted steps, so each retake starts from an identical state. Load a scene, follow its checklist, and read the line under it."
        actions={
          <>
            <a href="#script" className={buttonVariants({ variant: "ghost" })}>
              Full script
            </a>
            <Button variant="outline" onClick={onReset} data-testid="demo-reset">
              <RotateCcw aria-hidden />
              Reset demo
            </Button>
          </>
        }
      />

      <section
        aria-label="Recording setup"
        className="mb-8 flex flex-wrap items-start gap-x-8 gap-y-3 rounded-lg border border-border bg-card px-5 py-4 text-sm shadow-raised"
      >
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Clapperboard aria-hidden className="size-4 text-primary" />
          Before you record
        </div>
        <ul className="flex flex-1 flex-wrap gap-x-8 gap-y-1.5 text-muted-foreground">
          <li>Screen 1920×1080, browser zoom 125%</li>
          <li>Load every scene once first, so nothing shows a loading state on camera</li>
          <li>Hard ceiling 2:55 for the cut</li>
          <li>The clock, Teams, Outlook and SAP B1 are simulated</li>
        </ul>
      </section>

      <ol className="relative space-y-4" aria-label="Storyboard">
        {BEATS.map((beat) => {
          const isScene = beat.kind === "scene";
          const title = isScene ? beat.scene.title : beat.title;
          const timecode = isScene ? beat.scene.timecode : beat.timecode;
          const description = isScene ? beat.scene.description : beat.description;
          const checklist = isScene ? beat.scene.checklist : beat.checklist;
          const personaId = isScene ? beat.scene.persona : beat.resetAs;
          const persona = personaId ? people.find((p) => p.id === personaId) : undefined;
          const route = isScene ? beat.scene.route.replace(/=$/, "=…") : beat.href;
          const loading = busy === beat.key;
          const wasLast = lastLoaded === beat.key;

          return (
            <li
              key={beat.key}
              className={cn(
                "grid gap-x-6 gap-y-4 rounded-lg border bg-card p-5 shadow-raised lg:grid-cols-[6.5rem_minmax(0,1fr)_auto]",
                wasLast ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
              )}
              data-testid={`demo-beat-${beat.key}`}
            >
              <div className="flex items-baseline gap-3 lg:block">
                <div className="text-lg font-semibold tracking-[-0.01em] text-foreground tabular-nums">{timecode.split("–")[0]}</div>
                <div className="text-xs text-muted-foreground tabular-nums">to {timecode.split("–")[1]}</div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h2 className="text-base font-semibold text-foreground">{title}</h2>
                  {wasLast ? (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-medium text-primary">
                      Loaded last
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
                  {persona ? (
                    <span className="inline-flex items-center gap-1.5">
                      <PersonAvatar person={persona} size="xs" />
                      <span className="text-foreground">{persona.name}</span>
                    </span>
                  ) : null}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{route}</code>
                  {isScene ? <span>Clock: Wed 28 Oct, {beat.scene.clock} SGT (simulated)</span> : null}
                </div>
                <p className="mt-2 max-w-[80ch] text-sm text-muted-foreground">{description}</p>

                <div className="mt-4 grid gap-5 xl:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-foreground">What to click</h3>
                    <ol className="space-y-1.5 text-sm text-foreground">
                      {checklist.map((step, i) => (
                        <li key={step} className="flex gap-2.5">
                          <span className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold text-muted-foreground tabular-nums">
                            {i + 1}
                          </span>
                          <span className="min-w-0">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <figure className="border-l-2 border-primary/50 pl-4">
                    <figcaption className="mb-2 text-xs font-semibold text-foreground">Voice-over</figcaption>
                    <blockquote className="max-w-[68ch] text-[0.9375rem] leading-relaxed text-foreground/90">
                      “{voiceOf(beat)}”
                    </blockquote>
                  </figure>
                </div>
              </div>

              <div className="flex flex-row gap-2 lg:flex-col lg:items-stretch">
                {isScene ? (
                  <Button
                    onClick={() => onLoadScene(beat.key)}
                    disabled={!!busy}
                    data-testid={`scene-load-${beat.key}`}
                    className="min-w-32"
                  >
                    {loading ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
                    {loading ? "Loading…" : "Load scene"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => onOpen(beat)}
                    disabled={!!busy}
                    data-testid={`beat-open-${beat.key}`}
                    className="min-w-32"
                  >
                    <ExternalLink aria-hidden />
                    {beat.resetAs ? "Reset and open" : "Open"}
                  </Button>
                )}
                {!isScene && beat.extraLink ? (
                  <Link
                    href={beat.extraLink.href}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    data-testid={`beat-still-${beat.key}`}
                  >
                    {beat.extraLink.label}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <section id="script" className="mt-10 scroll-mt-24 rounded-lg border border-border bg-card p-6 shadow-raised">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Full voice-over script</h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {totalWords} words, about {Math.floor(minutes)}:{String(Math.round((minutes % 1) * 60)).padStart(2, "0")} at 150
            words a minute before pauses
          </p>
        </div>
        <ol className="mt-4 space-y-3">
          {BEATS.map((b) => (
            <li key={b.key} className="grid gap-x-4 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                {(b.kind === "scene" ? b.scene.timecode : b.timecode).split("–")[0]}
              </span>
              <p className="max-w-[80ch] text-[0.9375rem] leading-relaxed text-foreground">{voiceOf(b)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
