import { beforeEach, describe, expect, it, vi } from "vitest";

// A Map-backed localStorage (and a minimal window) must exist before the store module loads.
const storage = vi.hoisted(() => {
  const mem = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  };
  const g = globalThis as unknown as { localStorage: typeof shim; window: { localStorage: typeof shim } };
  g.localStorage = shim;
  g.window = { localStorage: shim };
  return mem;
});

import { STORAGE_KEY, STORAGE_VERSION, freshSandboxData, isValidSandboxData, useSandbox } from "@/lib/store";
import { buildSeed } from "@/lib/seed";
import {
  hoursForBusinessDays,
  selectMyRequests,
  selectNow,
  selectPipelineStats,
  selectStuckDemand,
  selectWaitingOn,
} from "@/lib/selectors";
import { verifyChain } from "@/lib/engine/audit";
import { stepElapsedBusinessDays } from "@/lib/engine/sla";
import { DEFAULT_CONFIG } from "@/config/default-config";
import type { MdmRequest } from "@/lib/types";

const NOW = "2026-10-28T02:00:00.000Z"; // Wed 10:00 SGT

const S = () => useSandbox.getState();
const req = (id: string) => S().requests.find((r) => r.id === id) as MdmRequest;
const stepByRole = (id: string, role: string) => req(id).steps.find((s) => s.role === role)!;

/** Approve every active step (as its assignee) until the request leaves approval. */
function approveAll(id: string) {
  for (let guard = 0; guard < 20; guard++) {
    const r = req(id);
    if (r.status !== "in_approval" && r.status !== "needs_info") return;
    const active = r.steps.filter((s) => s.status === "pending" && s.stageId !== "mdm-final");
    if (!active.length) return;
    for (const st of active) {
      S().setPersona(st.assigneeId);
      expect(S().approveStep(id, st.id, "Looks good").ok).toBe(true);
    }
  }
}

describe("seed scenario", () => {
  const seed = buildSeed(NOW);

  it("has a verifiable hash-chained audit trail in time order", () => {
    expect(seed.audit.length).toBeGreaterThan(100);
    expect(verifyChain(seed.audit)).toEqual({ ok: true });
    for (let i = 1; i < seed.audit.length; i++) {
      expect(Date.parse(seed.audit[i].at)).toBeGreaterThanOrEqual(Date.parse(seed.audit[i - 1].at));
    }
  });

  it("never puts a timestamp in the future", () => {
    const t = Date.parse(NOW);
    for (const r of seed.requests) {
      for (const iso of [r.createdAt, r.submittedAt, r.sapCreatedAt, r.closedAt, ...r.steps.flatMap((s) => [s.activatedAt, s.decidedAt])]) {
        if (iso) expect(Date.parse(iso)).toBeLessThanOrEqual(t);
      }
    }
    for (const p of seed.prs) expect(Date.parse(p.createdAt)).toBeLessThanOrEqual(t);
    for (const e of seed.audit) expect(Date.parse(e.at)).toBeLessThanOrEqual(t);
  });

  it("pins REQ-1042 at MDM review, blocking PR-5521 and PR-5527", () => {
    const r = seed.requests.find((x) => x.id === "REQ-1042")!;
    expect(r.status).toBe("mdm_review");
    expect(r.requestorId).toBe("amy");
    expect(r.country).toBe("MY");
    expect(r.data.itemName).toBe("Dengue IgG/IgM Combo 30T");
    expect(r.steps.find((s) => s.role === "qa_ra")?.addedBecause).toMatch(/IVD reagent/);
    expect(r.blockedPrIds.sort()).toEqual(["PR-5521", "PR-5527"]);
    const prs = seed.prs.filter((p) => p.blockedByRequestId === "REQ-1042");
    expect(prs.map((p) => [p.id, p.customerName, p.sgd, p.status]).sort()).toEqual([
      ["PR-5521", "Sunway Medical Centre", 48600, "blocked"],
      ["PR-5527", "Penang General Hospital", 21400, "blocked"],
    ]);
  });

  it("pins REQ-1038 pending Wei Jie with the Finance Director step to follow", () => {
    const r = seed.requests.find((x) => x.id === "REQ-1038")!;
    expect(r.domainId).toBe("customer");
    expect(r.data.creditLimit).toBe(80000);
    expect(r.data.bankAccountNo).toBeTruthy();
    expect(r.steps.find((s) => s.role === "finance")).toMatchObject({ assigneeId: "weijie", status: "pending" });
    expect(r.steps.find((s) => s.role === "finance_director")).toMatchObject({ assigneeId: "rachel", status: "waiting" });
  });

  it("has an open question and a step ~2.5 business days old", () => {
    const questions = seed.requests.flatMap((r) => r.steps.filter((s) => s.status === "question"));
    expect(questions).toHaveLength(1);
    const ages = seed.requests.flatMap((r) => r.steps.filter((s) => s.status === "pending").map((s) => stepElapsedBusinessDays(s, NOW)));
    expect(ages.some((a) => a >= 2.4 && a < 3)).toBe(true);
    expect(ages.every((a) => a < 3)).toBe(true);
  });

  it("covers every domain, country and status; ~30 completed history rows", () => {
    expect(new Set(seed.requests.map((r) => r.domainId))).toEqual(new Set(["customer", "vendor", "item", "costcentre", "extend"]));
    expect(new Set(seed.requests.map((r) => r.country))).toEqual(new Set(["SG", "MY", "TH", "VN", "MM"]));
    const statuses = new Set(seed.requests.map((r) => r.status));
    for (const s of ["in_approval", "needs_info", "mdm_review", "created", "rejected", "cancelled"]) expect(statuses.has(s as never)).toBe(true);
    expect(seed.requests.filter((r) => r.seeded && r.status === "created")).toHaveLength(30);
    expect(seed.requests.map((r) => r.id)).toContain("REQ-1001");
  });

  it("has 12 blocked PRs ≈ S$310k across all five countries, plus 20 open/converted", () => {
    const blocked = seed.prs.filter((p) => p.status === "blocked");
    expect(blocked).toHaveLength(12);
    const total = blocked.reduce((a, p) => a + p.sgd, 0);
    expect(total).toBeGreaterThan(290_000);
    expect(total).toBeLessThan(330_000);
    expect(new Set(blocked.map((p) => p.country)).size).toBe(5);
    expect(seed.prs.filter((p) => p.status !== "blocked")).toHaveLength(20);
    for (const p of blocked) {
      const blocker = seed.requests.find((r) => r.id === p.blockedByRequestId);
      expect(blocker?.blockedPrIds).toContain(p.id);
    }
  });

  it("numbers SAP codes so the next ones match the pinned formats", () => {
    const codes = seed.sapRecords.map((r) => r.code);
    expect(codes).toContain("C-SG-00017");
    expect(codes).toContain("I-A-000812");
    expect(codes).toContain("C-MY-00122");
    expect(codes).toContain("CC-SG-0030");
    expect(codes).toContain("V-MY-00044");
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("gives a 2–6 business-day median to SAP creation", () => {
    const stats = selectPipelineStats({ requests: seed.requests, config: DEFAULT_CONFIG, clockOffsetMs: Date.parse(NOW) - Date.now() });
    expect(stats.medianDaysToCreate).toBeGreaterThanOrEqual(2);
    expect(stats.medianDaysToCreate).toBeLessThanOrEqual(6);
    expect(stats.inFlight).toBe(11);
  });

  it("holds its invariants whatever time of week the visitor arrives", () => {
    const base = Date.parse("2026-10-26T00:00:00.000Z"); // Mon 08:00 SGT
    for (let h = 0; h < 7 * 24; h += 5) {
      const now = new Date(base + h * 3_600_000).toISOString();
      const s = buildSeed(now);
      expect(verifyChain(s.audit).ok).toBe(true);
      const t = Date.parse(now);
      for (const r of s.requests) {
        if (r.submittedAt) expect(Date.parse(r.createdAt)).toBeLessThanOrEqual(Date.parse(r.submittedAt));
        for (const st of r.steps) {
          if (st.activatedAt && r.submittedAt) expect(Date.parse(st.activatedAt)).toBeGreaterThanOrEqual(Date.parse(r.submittedAt));
          if (st.decidedAt) {
            expect(Date.parse(st.decidedAt)).toBeGreaterThanOrEqual(Date.parse(st.activatedAt!));
            expect(Date.parse(st.decidedAt)).toBeLessThanOrEqual(t);
          }
        }
      }
      const pendingAges = s.requests.flatMap((r) => r.steps.filter((x) => x.status === "pending").map((x) => stepElapsedBusinessDays(x, now)));
      expect(Math.max(...pendingAges)).toBeLessThan(3); // nothing escalates on the first tick
      const tubes = s.requests.find((r) => r.id === "REQ-1034")!.steps.find((x) => x.role === "bu_head")!;
      expect(stepElapsedBusinessDays(tubes, now)).toBeGreaterThanOrEqual(2.4); // +1 business day escalates it
    }
  });

  it("is deterministic for a given now", () => {
    const again = buildSeed(NOW);
    expect(again.audit[again.audit.length - 1].hash).toBe(seed.audit[seed.audit.length - 1].hash);
  });
});

describe("store", () => {
  beforeEach(() => {
    S().resetSandbox();
  });

  it("hydrates and seeds on first load", () => {
    expect(S().hydrated).toBe(true);
    expect(S().requests.length).toBe(44);
    expect(S().personaId).toBe("amy");
    expect(S().idCounter).toBe(1045);
    const raw = storage.get(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).version).toBe(STORAGE_VERSION);
    expect(isValidSandboxData(JSON.parse(raw!).state)).toBe(true);
  });

  it("submit → approve all → markCreatedInSap releases linked PRs and lowers stuck demand", () => {
    S().setPersona("amy");
    const id = S().createDraft("item", {
      itemName: "Dengue NS1 Ag Rapid Test 25T",
      category: "IVD reagent",
      productGroup: "A",
      manufacturer: "Hangzhou Clearview Diagnostics Co., Ltd.",
      uom: "KIT",
      packSize: 25,
      costPrice: 19.5,
      salesPrice: 29,
      storage: "Refrigerated (2–8 °C)",
      countries: "SG, MY",
    });
    expect(id).toBe("REQ-1045");
    expect(req(id).data.entity).toBe("SPD");

    // regLicenceNo is required for IVD reagents.
    const first = S().submitRequest(id);
    expect(first.ok).toBe(false);
    expect(first.errors.regLicenceNo).toBeTruthy();
    S().updateDraft(id, { regLicenceNo: "DE0509888" });

    // Link a blocked PR to this request, as intake would when a PR is waiting on the item.
    useSandbox.setState((s) => ({
      prs: s.prs.map((p) => (p.id === "PR-5508" ? { ...p, blockedByRequestId: id, itemName: "Dengue NS1 Ag Rapid Test 25T" } : p)),
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, blockedPrIds: ["PR-5508"] } : r.id === "REQ-1036" ? { ...r, blockedPrIds: ["PR-5517"] } : r,
      ),
    }));

    const res = S().submitRequest(id);
    expect(res).toEqual({ ok: true, errors: {} });
    const submitted = req(id);
    expect(submitted.status).toBe("in_approval");
    expect(submitted.steps.find((s) => s.role === "qa_ra")?.addedBecause).toMatch(/IVD reagent/);
    const pending = submitted.steps.filter((s) => s.status === "pending");
    expect(pending.map((s) => s.assigneeId).sort()).toEqual(["daniel", "ploy", "siti"]);
    for (const st of pending) {
      expect(S().notifications.some((n) => n.toId === st.assigneeId && n.requestId === id && n.channel === "teams" && n.kind === "approval")).toBe(true);
      expect(S().notifications.some((n) => n.toId === st.assigneeId && n.requestId === id && n.channel === "outlook" && n.kind === "approval")).toBe(true);
    }

    approveAll(id);
    expect(req(id).status).toBe("mdm_review");
    expect(S().notifications.some((n) => n.toId === "priya" && n.requestId === id && n.kind === "approval")).toBe(true);

    const before = selectStuckDemand(S());
    S().setPersona("priya");
    const files = S().generateDtw(id);
    expect(files[0].fileName).toBe("oItems.csv");
    const auditLen = S().audit.length;
    S().generateDtw(id); // idempotent
    expect(S().audit.length).toBe(auditLen);

    const rec = S().markCreatedInSap(id);
    expect(rec.code).toBe("I-A-000813");
    expect(rec.fields.ItemCode).toBe("I-A-000813");
    expect(rec.fields.ItemName).toBe("Dengue NS1 Ag Rapid Test 25T");
    expect(req(id)).toMatchObject({ status: "created", sapCode: "I-A-000813" });
    const pr = S().prs.find((p) => p.id === "PR-5508")!;
    expect(pr).toMatchObject({ status: "open", itemCode: "I-A-000813" });
    const after = selectStuckDemand(S());
    expect(before.totalSgd - after.totalSgd).toBe(pr.sgd);
    expect(after.count).toBe(before.count - 1);

    const note = S().notifications.find((n) => n.toId === "amy" && n.requestId === id && n.kind === "created" && n.channel === "teams");
    expect(note?.body).toBe("Your item I-A-000813 is live in SAP B1 — Kallang Community Hospital's PR-5508 can now be converted.");
    expect(S().notifications.some((n) => n.toId === "amy" && n.requestId === id && n.kind === "created" && n.channel === "outlook")).toBe(true);

    // Creating twice returns the same record without side effects.
    const len = S().audit.length;
    expect(S().markCreatedInSap(id).code).toBe("I-A-000813");
    expect(S().audit.length).toBe(len);
    expect(verifyChain(S().audit).ok).toBe(true);
  });

  it("REQ-1038: Wei Jie → Finance Director → MDM → SAP releases Bangkok Riverside's PRs", () => {
    const before = selectStuckDemand(S());
    S().setPersona("weijie");
    expect(selectWaitingOn(S(), "weijie").map((w) => w.request.id)).toContain("REQ-1038");
    expect(S().approveStep("REQ-1038", stepByRole("REQ-1038", "finance").id, "Bank details verified by call-back").ok).toBe(true);
    expect(stepByRole("REQ-1038", "finance_director")).toMatchObject({ status: "pending", assigneeId: "rachel" });
    S().setPersona("rachel");
    expect(S().approveStep("REQ-1038", stepByRole("REQ-1038", "finance_director").id).ok).toBe(true);
    expect(req("REQ-1038").status).toBe("mdm_review");

    S().setPersona("priya");
    const rec = S().markCreatedInSap("REQ-1038");
    expect(rec.code).toBe("C-TH-00065");
    expect(rec.fields).toMatchObject({ CardCode: "C-TH-00065", CardName: "Bangkok Riverside Hospital", FederalTaxID: "0107561000234" });
    const prs = S().prs.filter((p) => ["PR-5512", "PR-5513"].includes(p.id));
    expect(prs.every((p) => p.status === "open" && p.customerCode === "C-TH-00065")).toBe(true);
    const after = selectStuckDemand(S());
    expect(before.totalSgd - after.totalSgd).toBe(64800 + 12600);
    expect(after.byCountry.TH.count).toBe(before.byCountry.TH.count - 2);
    expect(stepByRole("REQ-1038", "mdm").status).toBe("approved");
  });

  it("REQ-1042: creating Amy's dengue item notifies her about Sunway and Penang", () => {
    S().setPersona("priya");
    const rec = S().markCreatedInSap("REQ-1042");
    expect(rec.code).toBe("I-A-000813");
    const note = S().notifications.find((n) => n.toId === "amy" && n.requestId === "REQ-1042" && n.channel === "teams" && n.kind === "created");
    expect(note?.body).toBe(
      "Your item I-A-000813 is live in SAP B1 — Sunway Medical Centre's PR-5521 and Penang General Hospital's PR-5527 can now be converted.",
    );
    expect(selectStuckDemand(S()).totalSgd).toBe(309_800 - 70_000);
  });

  it("double approve is a no-op: one audit event", () => {
    S().setPersona("weijie");
    const stepId = stepByRole("REQ-1038", "finance").id;
    const len = S().audit.length;
    expect(S().approveStep("REQ-1038", stepId).ok).toBe(true);
    const second = S().approveStep("REQ-1038", stepId);
    expect(second.ok).toBe(false);
    expect(S().audit.length).toBe(len + 1);
    expect(S().audit.filter((e) => e.requestId === "REQ-1038" && e.action === "approved" && e.actorId === "weijie")).toHaveLength(1);
  });

  it("question pauses the clock and the answer returns to the same approver", () => {
    const qStep = req("REQ-1036").steps.find((s) => s.status === "question")!;
    expect(qStep.assigneeId).toBe("ploy");
    expect(req("REQ-1036").status).toBe("needs_info");
    S().setPersona("amy");
    expect(S().answerQuestion("REQ-1036", qStep.id, "Yes — the 20T kit is on the same HSA listing (change notification CN-2026-0412).").ok).toBe(true);
    const after = req("REQ-1036").steps.find((s) => s.id === qStep.id)!;
    expect(after).toMatchObject({ status: "pending", assigneeId: "ploy" });
    expect(after.pausedMs).toBeGreaterThan(0);
    expect(after.pausedAt).toBeUndefined();
    expect(req("REQ-1036").status).toBe("in_approval");
    expect(S().notifications.some((n) => n.toId === "ploy" && n.kind === "answer" && n.channel === "teams")).toBe(true);

    // Ask again, from the approver.
    S().setPersona("ploy");
    expect(S().askQuestion("REQ-1036", qStep.id, "Please attach the change notification.").ok).toBe(true);
    expect(req("REQ-1036").status).toBe("needs_info");
    expect(S().notifications.some((n) => n.toId === "amy" && n.kind === "question" && n.channel === "outlook")).toBe(true);
  });

  it("fast-forward reminds then escalates once per step, never repeated", () => {
    const step = stepByRole("REQ-1034", "bu_head");
    expect(step.assigneeId).toBe("aisha");
    expect(step.reminderSentAt).toBeTruthy();

    const r1 = S().fastForward(hoursForBusinessDays(selectNow(S()), 1));
    expect(r1.escalations).toBeGreaterThanOrEqual(1);
    const escalated = stepByRole("REQ-1034", "bu_head");
    expect(escalated).toMatchObject({ assigneeId: "henry", originalAssigneeId: "aisha" });
    expect(S().notifications.some((n) => n.toId === "henry" && n.channel === "teams" && n.kind === "escalation" && n.requestId === "REQ-1034")).toBe(true);
    expect(S().notifications.some((n) => n.toId === "aisha" && n.channel === "outlook" && n.kind === "escalation" && n.requestId === "REQ-1034")).toBe(true);
    expect(S().audit.some((e) => e.requestId === "REQ-1034" && e.action === "escalated")).toBe(true);

    expect(S().fastForward(0)).toEqual({ reminders: 0, escalations: 0 });

    S().fastForward(200);
    // Exactly one escalation per step, ever.
    const perStep = new Map<string, number>();
    for (const e of S().audit.filter((x) => x.action === "escalated")) {
      const k = `${e.requestId}|${e.detail!.split(":")[0]}`;
      perStep.set(k, (perStep.get(k) ?? 0) + 1);
    }
    expect(perStep.size).toBeGreaterThan(5);
    expect([...perStep.values()].every((n) => n === 1)).toBe(true);
    expect(S().fastForward(200)).toEqual({ reminders: 0, escalations: 0 });
    expect(verifyChain(S().audit).ok).toBe(true);
  });

  it("out of office moves pending steps to the delegate", () => {
    S().setPersona("priya");
    S().setOutOfOffice("weijie", "rachel");
    expect(S().config.people.find((p) => p.id === "weijie")).toMatchObject({ outOfOffice: true, delegateId: "rachel" });
    expect(stepByRole("REQ-1038", "finance")).toMatchObject({ assigneeId: "rachel", originalAssigneeId: "weijie" });
    expect(selectWaitingOn(S(), "weijie")).toHaveLength(0);
    S().setOutOfOffice("weijie", null);
    expect(S().config.people.find((p) => p.id === "weijie")?.outOfOffice).toBe(false);
  });

  it("logs sensitive reveals, config changes and keeps the chain valid", () => {
    S().setPersona("weijie");
    S().logSensitiveReveal("REQ-1038", "bankAccountNo");
    expect(S().audit[S().audit.length - 1]).toMatchObject({ action: "sensitive_revealed", actorId: "weijie", detail: "Revealed Bank account no. (masked by default)" });

    S().setPersona("priya");
    const cfg = S().config;
    S().updateConfig({ ...cfg, sla: { ...cfg.sla, stepBusinessDays: 1 } }, "Tighter step SLA");
    expect(S().config.version).toBe(2);
    expect(S().config.history.at(-1)).toMatchObject({ version: 2, byId: "priya", summary: "Tighter step SLA" });
    expect(S().audit.at(-1)).toMatchObject({ requestId: "CONFIG", action: "config_changed" });
    expect(verifyChain(S().audit).ok).toBe(true);
  });

  it("masks sensitive values in the submitted snapshot", () => {
    const ev = S().audit.find((e) => e.requestId === "REQ-1038" && e.action === "submitted")!;
    expect(ev.after?.bankAccountNo).toMatch(/^••••/);
    expect(ev.after?.creditLimit).toMatch(/^••••/);
    expect(ev.after?.customerName).toBe("Bangkok Riverside Hospital");
  });

  it("selectors: my requests and waiting-on", () => {
    expect(selectMyRequests(S(), "amy").map((r) => r.id)).toEqual(expect.arrayContaining(["REQ-1032", "REQ-1036", "REQ-1042"]));
    expect(selectWaitingOn(S(), "priya").map((w) => w.request.id).sort()).toEqual(["REQ-1035", "REQ-1042"]);
    const stuck = selectStuckDemand(S());
    expect(stuck.totalSgd).toBe(309_800);
    expect(Object.keys(stuck.byCountry).sort()).toEqual(["MM", "MY", "SG", "TH", "VN"]);
    expect(stuck.byCountry.MY.maxDaysWaiting).toBeGreaterThanOrEqual(1);
  });

  it("a rejected step closes the request and tells the requestor", () => {
    S().setPersona("kyaw");
    const st = stepByRole("REQ-1043", "business_support");
    expect(S().rejectStep("REQ-1043", st.id, "").ok).toBe(false);
    expect(S().rejectStep("REQ-1043", st.id, "Sunway already has a QTS ship-to; use C-MY-00031 as is.").ok).toBe(true);
    expect(req("REQ-1043").status).toBe("rejected");
    expect(S().notifications.some((n) => n.toId === "nurul" && n.kind === "rejected" && n.channel === "outlook")).toBe(true);
  });
});

describe("persistence", () => {
  beforeEach(() => {
    S().resetSandbox();
  });

  /** Blank the in-memory state (this also writes through to storage), then put `raw` in storage and rehydrate. */
  async function reloadWith(raw: string) {
    useSandbox.setState({ requests: [], audit: [], hydrated: false });
    storage.set(STORAGE_KEY, raw);
    await useSandbox.persist.rehydrate();
  }

  it("corrupted localStorage JSON reseeds", async () => {
    await reloadWith("{not json");
    expect(S().hydrated).toBe(true);
    expect(S().requests.length).toBe(44);
    expect(verifyChain(S().audit).ok).toBe(true);
    const raw = storage.get(STORAGE_KEY)!;
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(isValidSandboxData(JSON.parse(raw).state)).toBe(true);
  });

  it("valid JSON with the wrong shape reseeds", async () => {
    for (const bad of ['"hello"', "null", "42", "[]", JSON.stringify({ state: { requests: "nope" }, version: STORAGE_VERSION })]) {
      await reloadWith(bad);
      expect(S().hydrated).toBe(true);
      expect(S().requests.length).toBe(44);
    }
  });

  it("an older storage version reseeds", async () => {
    const data = freshSandboxData();
    await reloadWith(JSON.stringify({ state: { ...data, requests: [] }, version: 0 }));
    expect(S().requests.length).toBe(44);
    expect(JSON.parse(storage.get(STORAGE_KEY)!).version).toBe(STORAGE_VERSION);
  });

  it("is SSR-safe: without window the store loads empty, unhydrated, with persistence off", async () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = { window: g.window, localStorage: g.localStorage };
    delete g.window;
    delete g.localStorage;
    vi.resetModules();
    try {
      const mod = await import("@/lib/store");
      const st = mod.useSandbox.getState();
      expect(st.hydrated).toBe(false);
      expect(st.requests).toEqual([]);
      expect(st.config.people.length).toBeGreaterThan(0);
      expect((mod.useSandbox as unknown as { persist?: unknown }).persist).toBeUndefined();
    } finally {
      g.window = saved.window;
      g.localStorage = saved.localStorage;
      vi.resetModules();
    }
  });

  it("a valid payload round-trips (state survives a reload)", async () => {
    S().setPersona("weijie");
    S().approveStep("REQ-1038", stepByRole("REQ-1038", "finance").id);
    const auditLen = S().audit.length;
    const saved = storage.get(STORAGE_KEY)!;
    await reloadWith(saved);
    expect(S().hydrated).toBe(true);
    expect(S().personaId).toBe("weijie");
    expect(S().audit.length).toBe(auditLen);
    expect(stepByRole("REQ-1038", "finance").status).toBe("approved");
    expect(verifyChain(S().audit).ok).toBe(true);
  });
});
