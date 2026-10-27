/**
 * Demo scene loader (final model P0-19, storyboard §7.1).
 *
 * Every scene starts from resetSandbox() and then replays scripted store actions, so the same
 * scene always produces the same state (request ids start at REQ-1100 after a reset). Simulated
 * times are pinned per action, so timelines read like a real morning instead of "everything at 09:00".
 *
 * Call loadScene() from a click handler only: it mutates the store (never from useEffect on mount).
 */
import { useSandbox, loadState, SIM_BASE_MS } from "@/lib/store";
import { MDM_STAGE_ID } from "@/lib/engine/routing";
import { IVD_CONSUMABLE_CATEGORY, NEW_BU_TEMPLATE } from "@/config/default-config";
import { K2EDTA_ITEM } from "@/lib/seed";
import type { AppConfig, ApprovalStep, BusinessUnit, FieldValue, MdmRequest } from "@/lib/types";

export type SceneId = "amy-intake" | "admin-marcus" | "marcus-dup" | "weijie-teams" | "priya-sap" | "pulse";

export interface Scene {
  id: SceneId;
  title: string;
  /** Persona the scene leaves selected. */
  persona: string;
  /** Route the scene opens (ids filled in by loadScene). */
  route: string;
  description: string;
  /** The §7.1 voice-over line for this beat. */
  voiceoverHint: string;
  /** Storyboard time code (§7.1). */
  timecode: string;
  /** What to click, in order, once the scene has loaded. */
  checklist: string[];
  /** Simulated clock (SGT, Wed 28 Oct 2026) right after the scene loads. */
  clock: string;
}

/** National University Hospital, the pinned existing customer master (C-SG-00017). */
export const NUH = {
  code: "C-SG-00017",
  name: "National University Hospital",
  taxId: "198500123K",
} as const;

/** Summary written to the config history when MLS is added (the admin page uses the same text). */
export const ADD_MLS_SUMMARY = `Added business unit ${NEW_BU_TEMPLATE.name}: approvers per role and extra step “${
  NEW_BU_TEMPLATE.extraStages[0]?.label ?? "Molecular regulatory pre-check"
}” for new products`;

/** Returns a copy of `config` with `bu` appended (unchanged copy when a unit with that id exists). */
export function withBusinessUnit(config: AppConfig, bu: BusinessUnit = NEW_BU_TEMPLATE): AppConfig {
  const next = JSON.parse(JSON.stringify(config)) as AppConfig;
  if (!next.businessUnits.some((b) => b.id === bu.id)) {
    next.businessUnits = [...next.businessUnits, JSON.parse(JSON.stringify(bu)) as BusinessUnit];
  }
  return next;
}

/** Amy's live demo item (App C), with every required field filled. */
export const AMY_K2EDTA_ITEM: Record<string, FieldValue> = {
  itemName: K2EDTA_ITEM,
  category: IVD_CONSUMABLE_CATEGORY,
  productGroup: "B",
  manufacturer: "Meditube Industries Sdn Bhd",
  regLicenceNo: "HSA-DE-0012345",
  regCertificate: "HSA-registration-K2EDTA-4mL.pdf",
  uom: "PCK",
  packSize: 100,
  costPrice: 78,
  salesPrice: 120,
  storage: "Ambient (15–30 °C)",
  entity: "SPD",
  countries: "SG, MY",
};

/** Marcus extends National University Hospital to MLS with revised credit terms (A28). */
export const MARCUS_EXTEND: Record<string, FieldValue> = {
  existingCode: NUH.code,
  existingName: NUH.name,
  extendToEntity: NEW_BU_TEMPLATE.id,
  changesCreditTerms: "Yes",
  paymentTerms: "Net 60",
  creditLimit: 45000,
  reason:
    "MLS will supply PCR reagents and molecular test kits to NUH's diagnostic lab from Q1 2027. NUH already exists in SAP B1, so we are extending the existing account to MLS instead of opening a second one. Public-hospital payment cycle needs Net 60.",
};

export const SCENES: Scene[] = [
  {
    id: "amy-intake",
    clock: "09:00",
    title: "Clean in: Amy raises a new item",
    persona: "amy",
    route: "/requests/new?domain=item",
    timecode: "0:22–0:47",
    description:
      "Fresh sandbox, Amy selected, empty New Item form. She pastes her old email, the form fills, and the IVD rule adds the licence and QA/RA.",
    voiceoverHint:
      "Amy pastes her old email and the form fills itself. Because her blood collection tube is regulated as an IVD medical device, the licence number becomes mandatory and Quality is added to the route automatically: the exact step she missed last time. Before she submits, she sees who approves, in parallel, and when it'll be live.",
    checklist: [
      "In the paste panel, click “Amy's old email”, then “Fill the form”. The chip shows one sensitive value removed.",
      "Point at the filled fields and the “cached for demo” badge.",
      "Category reads “Lab consumable – IVD medical device”: the licence no. and certificate turn required and the QA/RA chip slides into the route.",
      "Pick a storage condition, type the licence no. and attach the sample certificate. Hold on the route: QA/RA · BU Head · Business Support in parallel → MDM, expected live Tue 3 Nov.",
      "Submit. The receipt mentions 3 waiting orders linked (S$36,000).",
    ],
  },
  {
    id: "admin-marcus",
    clock: "09:00",
    title: "Admin adds Marcus's business unit",
    persona: "priya",
    route: "/admin?tab=business-units",
    timecode: "0:47–0:51",
    description:
      "Priya (MDM, admin) on the business-units tab. MLS — Meridian Life Sciences is not configured yet. A 4-second insert.",
    voiceoverHint:
      "Marcus's team is new. The MDM team added his business unit and its approvers themselves, with no IT ticket.",
    checklist: [
      "Click “Add business unit” (the form prefills MLS — Meridian Life Sciences).",
      "Show the approvers per role: Henry (BU head), Siti (Business Support), plus the shared Finance and QA/RA roles.",
      "Show the extra step “Molecular regulatory pre-check” (QA/RA), only when a product group is filled in, so it applies to new products, not customer extensions.",
      "Save. The config version goes up by one.",
    ],
  },
  {
    id: "marcus-dup",
    clock: "09:00",
    title: "Clean in: Marcus is stopped from creating a duplicate",
    persona: "marcus",
    route: "/requests/new?draft=",
    timecode: "0:51–1:02",
    description:
      "MLS already added. Marcus has a New Customer draft for “Natl Univ Hosp” (SG, tax ID 198500123K, entity MLS). The duplicate check fires against National University Hospital (C-SG-00017).",
    voiceoverHint:
      "When he requests a hospital that already exists under another name, OneRecord catches it before any approver sees it, and he extends the existing record instead.",
    checklist: [
      "Click into the customer name (or retype the last letter) so the duplicate check runs.",
      "Hold on the amber card: National University Hospital · C-SG-00017 · same tax ID.",
      "Click “Extend to my entity”. The form switches to an extension of C-SG-00017 for MLS.",
    ],
  },
  {
    id: "weijie-teams",
    clock: "10:05",
    title: "Clean in: Wei Jie approves in Teams",
    persona: "weijie",
    route: "/approvals",
    timecode: "1:02–1:20",
    description:
      "Marcus's extension of National University Hospital to MLS (Net 60, S$45,000 credit limit) is submitted; Siti approved Business Support at 09:48. It now waits on Wei Jie (Finance).",
    voiceoverHint:
      "Approvals arrive in Teams, where approvers already work, with reminders before anything goes stale. Credit terms and bank details never travel in the message. Only Finance can see them, and every view and decision is logged. Marcus always knows where his request stands.",
    checklist: [
      "Open the Teams card: credit terms show “•••• · view in OneRecord (Finance only)”.",
      "Open the details: the values are visible to Wei Jie (Finance).",
      "2-second flip: switch persona to Amy (values masked), then back to Wei Jie.",
      "Click Approve. The tracker step turns green; the chip reads “Reminder after 1 business day”.",
    ],
  },
  {
    id: "priya-sap",
    clock: "14:10",
    title: "Lands in SAP B1: Priya imports Amy's item",
    persona: "priya",
    route: "/mdm?id=",
    timecode: "1:24–2:02",
    description:
      "Amy's K2EDTA item request was submitted at 09:14 (3 waiting orders linked, S$36,000) and approved in parallel by Daniel, Siti and Dr Ploy by 13:26. It sits in Priya's MDM queue.",
    voiceoverHint:
      "Once approved, Priya generates an import file in SAP's Data Transfer Workbench format, with SAP's own field names, and loads it after a final check. The moment it's live, Amy is told, and this number drops: customer orders that were waiting on that one record.",
    checklist: [
      "Click “Generate SAP B1 import”. Hold on the DTW preview with its two header rows.",
      "Open the simulated Item Master Data window (SIMULATED banner), then the Service Layer tab: validator ✓, “Phase 2 — not sent”.",
      "Click “Mark created in SAP B1”. Toast: Amy is told her item is live.",
      "Cut to Regional Pulse: stuck demand counts down S$345,800 → S$309,800 (S$36k unblocked).",
    ],
  },
  {
    id: "pulse",
    clock: "09:00",
    title: "Clean out: Regional Pulse",
    persona: "weijie",
    route: "/pulse",
    timecode: "2:02–2:32",
    description: "Fresh sandbox, Wei Jie on Regional Pulse. Synthetic, illustrative data throughout.",
    voiceoverHint:
      "Across five countries and Products A, B and C, growth compares October 2025 to September 2026 with the same twelve months a year earlier, on de-duplicated customers. Orders, open requests and MDM setups are kept separate. Merge the duplicates, and three small records become one top hospital account. On our illustrative data, the seasonal forecast catches the dengue peak the rolling average misses, and each country gets owners, actions and dollars at stake.",
    checklist: [
      "Hold 2 s on the header: window and growth formula.",
      "Country × product matrix, then the streams legend (orders · open requests · MDM setups).",
      "Flip the merge toggle: the Malaysian hero account rises to the top.",
      "Forecast replay for SG × Product A, then one country action card.",
    ],
  },
];

export const SCENE_IDS = SCENES.map((s) => s.id);

export function isSceneId(v: unknown): v is SceneId {
  return typeof v === "string" && (SCENE_IDS as string[]).includes(v);
}

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

// =============================================================================================
// Scripted actions
// =============================================================================================

const MIN_MS = 60_000;
const store = () => useSandbox.getState();

/** Pin the simulated clock to 09:00 SGT Wed 28 Oct 2026 + `minutes` (it then runs at real speed). */
function clockAt(minutes: number): void {
  loadState({ simBaseMs: SIM_BASE_MS + minutes * MIN_MS, seededAtRealMs: Date.now(), clockOffsetMs: 0 });
}

function as(personaId: string): void {
  store().setPersona(personaId);
  if (store().personaId !== personaId) throw new Error(`Scene setup: unknown persona "${personaId}"`);
}

function request(id: string): MdmRequest {
  const r = store().requests.find((x) => x.id === id);
  if (!r) throw new Error(`Scene setup: request ${id} not found`);
  return r;
}

function submit(id: string): void {
  const res = store().submitRequest(id);
  if (!res.ok) {
    const why = Object.entries(res.errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    throw new Error(`Scene setup: ${id} did not submit (${why})`);
  }
}

const pendingBusinessSteps = (r: MdmRequest): ApprovalStep[] =>
  r.steps.filter((s) => s.stageId !== MDM_STAGE_ID && s.status === "pending");

/** Approve one pending step as its assignee, at 09:00 + `minutes`. */
function approveAsAssignee(requestId: string, step: ApprovalStep, minutes: number, comment?: string): void {
  clockAt(minutes);
  as(step.assigneeId);
  const res = store().approveStep(requestId, step.id, comment);
  if (!res.ok) throw new Error(`Scene setup: ${step.label} not approved (${res.reason ?? res.error ?? "unknown"})`);
}

function addMlsBusinessUnit(): void {
  as("priya");
  const cfg = store().config;
  if (cfg.businessUnits.some((b) => b.id === NEW_BU_TEMPLATE.id)) return;
  store().updateConfig(withBusinessUnit(cfg), ADD_MLS_SUMMARY);
}

/**
 * useSimNow (top-bar clock) only re-reads the clock when clockOffsetMs changes or on a 20 s tick.
 * Set a 1–2 ms offset that differs from the last rendered one so it refreshes at once (invisible:
 * the clock shows offsets only from one minute up).
 */
export function nudgeClock(previousOffsetMs: number = store().clockOffsetMs): void {
  loadState({ clockOffsetMs: previousOffsetMs === 1 ? 2 : 1 });
}

/** Lets the persist middleware finish its (synchronous) write and React settle before navigating. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 60);
  });
}

const PARALLEL_ORDER: Record<string, { at: number; comment?: string }> = {
  bu_head: { at: 62, comment: "Good margin, approved." },
  business_support: { at: 101, comment: "UoM and pack size checked against the supplier quote." },
  qa_ra: { at: 266, comment: "HSA licence matches the certificate." },
};

/**
 * Resets the sandbox, replays the scene's scripted actions and returns the route to open.
 * Throws (with a readable reason) if a scripted step is refused, so the console can show it.
 */
export async function loadScene(id: SceneId): Promise<string> {
  const scene = sceneById(id);
  if (!scene) throw new Error(`Unknown scene "${id}"`);

  const previousOffsetMs = store().clockOffsetMs;
  store().resetSandbox();
  let route = scene.route;

  switch (id) {
    case "amy-intake": {
      as("amy");
      break;
    }

    case "admin-marcus": {
      as("priya");
      break;
    }

    case "marcus-dup": {
      clockAt(-25); // Priya added MLS at 08:35
      addMlsBusinessUnit();
      clockAt(0);
      as("marcus");
      const draftId = store().createDraft("customer", {
        customerName: "Natl Univ Hosp",
        country: "SG",
        taxId: NUH.taxId,
        entity: NEW_BU_TEMPLATE.id,
      });
      route = `/requests/new?draft=${encodeURIComponent(draftId)}`;
      break;
    }

    case "weijie-teams": {
      clockAt(-25);
      addMlsBusinessUnit();
      clockAt(22); // Marcus submits at 09:22
      as("marcus");
      const reqId = store().createDraft("extend", MARCUS_EXTEND);
      submit(reqId);
      // Approve everything ahead of Finance (Business Support, Siti, at 09:48).
      for (let guard = 0; guard < 6; guard++) {
        const r = request(reqId);
        const pending = pendingBusinessSteps(r);
        if (pending.some((s) => s.role === "finance")) break;
        const next = pending[0];
        if (!next) throw new Error(`Scene setup: ${reqId} has no Finance step pending`);
        approveAsAssignee(reqId, next, 48 + guard * 5, "MLS entity and NUH address confirmed.");
      }
      const fin = pendingBusinessSteps(request(reqId)).find((s) => s.role === "finance");
      if (!fin) throw new Error(`Scene setup: ${reqId} is not waiting on Finance`);
      clockAt(65); // now 10:05
      as(fin.assigneeId === "weijie" ? "weijie" : fin.assigneeId);
      break;
    }

    case "priya-sap": {
      clockAt(14); // Amy submits at 09:14
      as("amy");
      const reqId = store().createDraft("item", AMY_K2EDTA_ITEM);
      submit(reqId);
      for (let guard = 0; guard < 8; guard++) {
        const pending = pendingBusinessSteps(request(reqId));
        if (pending.length === 0) break;
        // Parallel steps: approve in a natural order, each at its own time.
        const sorted = [...pending].sort(
          (a, b) => (PARALLEL_ORDER[a.role]?.at ?? 300) - (PARALLEL_ORDER[b.role]?.at ?? 300),
        );
        for (const step of sorted) {
          const plan = PARALLEL_ORDER[step.role];
          approveAsAssignee(reqId, step, plan?.at ?? 280 + guard * 10, plan?.comment);
        }
      }
      const r = request(reqId);
      if (r.status !== "mdm_review") throw new Error(`Scene setup: ${reqId} is ${r.status}, not at MDM review`);
      clockAt(310); // now 14:10
      as("priya");
      route = `/mdm?id=${encodeURIComponent(reqId)}`;
      break;
    }

    case "pulse": {
      as("weijie");
      break;
    }
  }

  nudgeClock(previousOffsetMs);
  await settle();
  return route;
}
