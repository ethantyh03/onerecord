"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, Building2, CheckCheck, Eye, FileJson, Mail, MessageSquare, ShieldAlert } from "lucide-react";
import { ConsolePanel, EmptyState, Notice, PageHeader, PersonAvatar, SapCode, SyntheticBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { firstName } from "@/components/common/format";
import { useHasHydrated, useSandbox } from "@/lib/store";
import { buById, canActOnStep, selectWaitingOn, useCurrentPerson, useNow, useWaitingOn } from "@/lib/selectors";
import { stepElapsedBusinessDays } from "@/lib/engine/sla";
import type { ApprovalStep, MdmRequest, Person } from "@/lib/types";
import { CardJsonView } from "./CardJsonView";
import { OutlookView } from "./OutlookView";
import { QuestionsForYou, type QuestionEntry } from "./PhoneQuestions";
import { OutOfOfficePanel, SimTimePanel } from "./SidePanels";
import { RouteStrip, TeamsWindow } from "./TeamsWindow";
import { WaitingList, type WaitingEntry } from "./WaitingList";

const ACTIVE: ReadonlySet<ApprovalStep["status"]> = new Set(["pending", "question"]);
const IN_FLIGHT: ReadonlySet<MdmRequest["status"]> = new Set(["in_approval", "needs_info", "mdm_review"]);

type Tab = "teams" | "outlook" | "json";

/** The step to show for a request: mine first, then any active step, then the latest decision. */
function stepFor(request: MdmRequest, meId: string): ApprovalStep | undefined {
  const mine = request.steps.find((s) => ACTIVE.has(s.status) && s.assigneeId === meId);
  if (mine) return mine;
  const active = request.steps.find((s) => ACTIVE.has(s.status));
  if (active) return active;
  const decided = request.steps.filter((s) => s.decidedAt).sort((a, b) => Date.parse(b.decidedAt ?? "") - Date.parse(a.decidedAt ?? ""));
  return decided[0] ?? request.steps[0];
}

export function ApprovalsWorkspace() {
  const hydrated = useHasHydrated();
  if (!hydrated) return <ApprovalsLoading />;
  return <Approvals />;
}

export function ApprovalsLoading() {
  return (
    <div className="w-full space-y-4" aria-busy="true" aria-label="Loading approvals">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-[32rem] max-w-full" />
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[620px]" />
      </div>
    </div>
  );
}

function Approvals() {
  const me = useCurrentPerson();
  const params = useSearchParams();
  const router = useRouter();
  const paramId = params.get("id");
  const requests = useSandbox((s) => s.requests);
  const config = useSandbox((s) => s.config);
  const setPersona = useSandbox((s) => s.setPersona);
  const waitingRaw = useWaitingOn(me.id);
  const now = useNow(15_000);

  const [selection, setSelection] = useState<{
    personaId: string;
    requestId: string;
    stepId: string;
  } | null>(null);
  const [tabState, setTab] = useState<Tab>("teams");
  const [answeredKeys, setAnsweredKeys] = useState<string[]>([]);

  const waiting: WaitingEntry[] = useMemo(() => {
    const budget = config.sla.stepBusinessDays;
    return waitingRaw
      .map(({ request, step }) => ({
        request,
        step,
        remaining: step.status === "question" ? Number.POSITIVE_INFINITY : budget - stepElapsedBusinessDays(step, now),
      }))
      .sort((a, b) => a.remaining - b.remaining || a.request.id.localeCompare(b.request.id));
  }, [waitingRaw, config.sla.stepBusinessDays, now]);

  // Which card is open: an explicit click, else ?id=, else the most urgent item.
  const selected = useMemo((): {
    request: MdmRequest;
    step: ApprovalStep;
  } | null => {
    if (selection && selection.personaId === me.id) {
      // Closed explicitly: show the queue again (falls through to the most urgent item, if any).
      if (!selection.requestId) return waiting[0] ? { request: waiting[0].request, step: waiting[0].step } : null;
      const request = requests.find((r) => r.id === selection.requestId);
      const step = request?.steps.find((s) => s.id === selection.stepId);
      if (request && step) return { request, step };
    }
    if (paramId) {
      const request = requests.find((r) => r.id === paramId);
      const step = request ? stepFor(request, me.id) : undefined;
      if (request && step) return { request, step };
    }
    return waiting[0] ? { request: waiting[0].request, step: waiting[0].step } : null;
  }, [selection, me.id, paramId, requests, waiting]);

  const questions: QuestionEntry[] = useMemo(() => {
    const out: QuestionEntry[] = [];
    for (const request of requests) {
      if (request.requestorId !== me.id) continue;
      for (const step of request.steps) {
        if (!step.question) continue;
        const key = `${request.id}:${step.id}`;
        const open = step.status === "question" && !step.question.answer && IN_FLIGHT.has(request.status);
        if (open || answeredKeys.includes(key)) out.push({ request, step });
      }
    }
    return out.sort((a, b) => Number(b.step.status === "question") - Number(a.step.status === "question"));
  }, [requests, me.id, answeredKeys]);

  /** Open a card and keep its id in the URL, so a persona switch stays on the same request. */
  function openCard(request: MdmRequest, step: ApprovalStep) {
    setSelection({ personaId: me.id, requestId: request.id, stepId: step.id });
    if (paramId !== request.id)
      router.replace(`/approvals?id=${encodeURIComponent(request.id)}`, {
        scroll: false,
      });
  }

  const bu = buById({ config }, me.entity);
  const selectedKey = selected ? `${selected.request.id}:${selected.step.id}` : null;
  const tab: Tab = tabState;

  return (
    <div className="w-full">
      <PageHeader
        title="Approvals"
        subtitle={`Everything waiting on ${me.name}, closest deadline first. Approve, reject or ask a question right on the card, in Teams or Outlook.`}
        meta={<SyntheticBadge label="Teams, Outlook and the clock are simulated" />}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4" aria-label="Your queue and settings">
          {!bu ? (
            <Notice ruled tone="warn" icon={<Building2 />} lead="BU not configured yet — ask MDM to add it.">
              {me.entity} isn&apos;t set up as a business unit, so {firstName(me.name)}&apos;s requests use the group&apos;s shared
              approvers for now.
            </Notice>
          ) : null}
          {/* One panel: the queue, then the demo clock and out-of-office as hairline-divided sections of it. */}
          <ConsolePanel title="Waiting on me" titleId="waiting-heading" count={waiting.length} subtitle="Closest deadline first">
            <WaitingList
              items={waiting}
              selectedKey={selectedKey}
              onSelect={(e) => openCard(e.request, e.step)}
              people={config.people}
              domains={config.domains}
              personName={firstName(me.name)}
            />
            <SimTimePanel />
            <OutOfOfficePanel me={me} />
          </ConsolePanel>
        </aside>

        <div className="min-w-0 space-y-5">
          {questions.length > 0 ? (
            <QuestionsForYou
              me={me}
              entries={questions}
              people={config.people}
              now={now}
              onAnswered={(key) => setAnsweredKeys((keys) => (keys.includes(key) ? keys : [...keys, key]))}
            />
          ) : null}

          {selected ? (
            <section
              aria-label={`Approval card for ${selected.request.id}`}
              className="space-y-3"
              // Pin the card being worked on, so a decision shows its outcome instead of jumping to the next item.
              onClickCapture={() => {
                if (selection?.personaId === me.id && selection.requestId === selected.request.id && selection.stepId === selected.step.id)
                  return;
                setSelection({
                  personaId: me.id,
                  requestId: selected.request.id,
                  stepId: selected.step.id,
                });
              }}
            >
              <ViewerNote
                request={selected.request}
                step={selected.step}
                me={me}
                people={config.people}
                onClose={() => {
                  setSelection({ personaId: me.id, requestId: "", stepId: "" });
                  if (paramId) router.replace("/approvals", { scroll: false });
                }}
              />
              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <TabsList>
                    <TabsTrigger value="teams" data-testid="tab-teams" className="px-3">
                      <MessageSquare aria-hidden="true" />
                      Teams
                    </TabsTrigger>
                    <TabsTrigger value="outlook" data-testid="tab-outlook" className="px-3">
                      <Mail aria-hidden="true" />
                      Outlook
                    </TabsTrigger>
                    <TabsTrigger value="json" data-testid="tab-json" className="px-3">
                      <FileJson aria-hidden="true" />
                      Card JSON
                    </TabsTrigger>
                  </TabsList>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {tab === "teams"
                      ? "Where approvers already work. Power Automate posts this card in production."
                      : tab === "outlook"
                        ? "The same decision as an Outlook actionable message, for people who live in email."
                        : "The production card template with this request's values bound."}
                  </p>
                </div>
                <TabsContent value="teams" className="mt-3">
                  <TeamsWindow request={selected.request} step={selected.step} me={me} />
                </TabsContent>
                <TabsContent value="outlook" className="mt-3">
                  <OutlookView request={selected.request} step={selected.step} me={me} />
                </TabsContent>
                <TabsContent value="json" className="mt-3">
                  <CardJsonView request={selected.request} step={selected.step} />
                </TabsContent>
              </Tabs>
              <RouteStrip request={selected.request} people={config.people} highlightStepId={selected.step.id} />
            </section>
          ) : (
            <NothingWaiting me={me} requests={requests} onSwitch={setPersona} onOpen={openCard} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Shown above the card when the persona is looking at a step that isn't theirs to decide. */
function ViewerNote({
  request,
  step,
  me,
  people,
  onClose,
}: {
  request: MdmRequest;
  step: ApprovalStep;
  me: Person;
  people: Person[];
  onClose: () => void;
}) {
  const config = useSandbox((s) => s.config);
  const requests = useSandbox((s) => s.requests);
  const mine = step.assigneeId === me.id || step.originalAssigneeId === me.id;
  if (mine || !ACTIVE.has(step.status)) return null;
  const assignee = people.find((p) => p.id === step.assigneeId);
  const sod = canActOnStep({ requests, config }, request.id, step.id, me.id);
  // A ruled line above the card, not a tinted box: the eye says "viewing", the shield (coral) says segregation of duties.
  return (
    <Notice
      ruled
      tone={sod.ok ? "neutral" : "stuck"}
      icon={sod.ok ? <Eye className="text-muted-foreground" /> : <ShieldAlert />}
      action={
        <Button
          variant="ghost"
          size="sm"
          data-testid="viewer-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          Close
        </Button>
      }
    >
      You&apos;re viewing {assignee?.name ?? "the approver"}&apos;s card for {request.id}. It isn&apos;t waiting on you.
      {!sod.ok ? <span className="block font-medium text-stuck-ink">{sod.reason}</span> : null}
    </Notice>
  );
}

const SWITCH_PRIORITY = ["weijie", "ploy", "priya", "aisha", "siti", "daniel", "rachel", "hafiz", "meiling", "kyaw"];

function NothingWaiting({
  me,
  requests,
  onSwitch,
  onOpen,
}: {
  me: Person;
  requests: MdmRequest[];
  onSwitch: (id: string) => void;
  onOpen: (request: MdmRequest, step: ApprovalStep) => void;
}) {
  const people = useSandbox((s) => s.config.people);
  const others = useMemo(() => {
    const rank = (id: string) => {
      const i = SWITCH_PRIORITY.indexOf(id);
      return i === -1 ? SWITCH_PRIORITY.length : i;
    };
    return people
      .filter((p) => p.persona && p.id !== me.id)
      .map((p) => ({
        person: p,
        count: selectWaitingOn({ requests }, p.id).length,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => rank(a.person.id) - rank(b.person.id))
      .slice(0, 4);
  }, [people, requests, me.id]);

  const own = useMemo(
    () =>
      requests
        .filter((r) => r.requestorId === me.id && IN_FLIGHT.has(r.status))
        .map((r) => ({
          request: r,
          step: r.steps.find((s) => s.status === "pending"),
        }))
        .filter((x): x is { request: MdmRequest; step: ApprovalStep } => Boolean(x.step))
        .slice(0, 3),
    [requests, me.id],
  );

  return (
    <div className="space-y-4">
      <EmptyState
        icon={CheckCheck}
        title={`Nothing is waiting on ${firstName(me.name)}`}
        description={
          others.length > 0
            ? "New approvals land here and in Teams. To see a decision being made, switch to an approver who has something waiting."
            : "New approvals land here and in Teams."
        }
        action={
          others.length > 0 ? (
            // A short ruled list (name left, count right), not a row of pills.
            <ul className="mx-auto w-[min(100%,22rem)] divide-y divide-border border-y border-border text-left">
              {others.map(({ person, count }) => (
                <li key={person.id}>
                  <button
                    type="button"
                    data-testid={`switch-${person.id}`}
                    onClick={() => onSwitch(person.id)}
                    className="group/sw flex min-h-10 w-full items-center gap-2.5 px-1 py-2 text-sm text-secondary-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <PersonAvatar person={person} size="xs" />
                    <span className="font-medium">Switch to {firstName(person.name)}</span>
                    <span className="num ml-auto text-xs text-subtle">{count} waiting</span>
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 shrink-0 text-subtle transition-colors group-hover/sw:text-foreground"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null
        }
      />
      {own.length > 0 ? (
        <section aria-labelledby="own-heading" className="panel overflow-hidden">
          <div className="panel-header py-2.5">
            <div className="min-w-0">
              <h2 id="own-heading" className="panel-title">
                Your requests, from the approver&apos;s side
              </h2>
              <p className="text-sm leading-5 text-muted-foreground">
                Open the card your approvers see. Segregation of duties stops you approving your own request, even if you try.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {own.map(({ request, step }) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="text-sm">
                  <SapCode code={request.id} variant="plain" />
                </span>
                <span className="min-w-[12rem] flex-1">
                  <span className="block truncate text-sm text-foreground">{request.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{step.label}</span>
                </span>
                <Button variant="outline" size="sm" data-testid={`open-own-${request.id}`} onClick={() => onOpen(request, step)}>
                  Open approver card
                </Button>
                <Link
                  href={`/requests/view?id=${encodeURIComponent(request.id)}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Track
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
