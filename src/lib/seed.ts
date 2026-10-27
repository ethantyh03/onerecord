/**
 * Seed scenario for the OneRecord sandbox.
 *
 * buildSeed(nowIso) produces a self-consistent world relative to "now":
 * - 30 completed requests over the past ~90 days (REQ-1001…1030), median ≈ 3–4 business days to SAP B1
 * - 14 recent requests (REQ-1031…1044) across every domain, country and status, including the pinned
 *   demo requests REQ-1038 (customer pending Wei Jie) and REQ-1042 (item at MDM review)
 * - 15 purchase requests blocked by MDM setup (≈ S$346k across all five countries; 3 K2EDTA PRs not yet linked) and 20 open/converted PRs
 * - SAP B1 records (pre-OneRecord masters plus everything created through OneRecord)
 * - a verifiable hash-chained audit trail and Teams / Outlook notifications
 *
 * Pure: no store, no browser APIs, deterministic for a given nowIso.
 */
import type {
  AppConfig,
  AppNotification,
  ApprovalStep,
  AuditEvent,
  BusinessUnit,
  CountryCode,
  DomainConfig,
  DuplicateDecision,
  FieldValue,
  MdmRequest,
  ProductGroup,
  PurchaseRequest,
  RequestStatus,
  SapRecord,
} from "@/lib/types";
import { DEFAULT_CONFIG, PRIMARY_NAME_FIELD, REGULATED_CATEGORIES } from "@/config/default-config";
import { SYSTEM_ACTOR_ID } from "@/config/people";
import { addBusinessDays, businessDaysBetween, stepElapsedBusinessDays } from "@/lib/engine/sla";
import { buildRoute, expectedCompletion } from "@/lib/engine/routing";
import { appendAudit } from "@/lib/engine/audit";
import { maskValue } from "@/lib/engine/masking";
import { assignSapCode, sapKeyFor } from "@/lib/engine/codes";

// =============================================================================================
// Shared helpers (also used by the store)
// =============================================================================================

export interface SeedData {
  requests: MdmRequest[];
  prs: PurchaseRequest[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  sapRecords: SapRecord[];
}

export type AuditDraft = Omit<AuditEvent, "seq" | "prevHash" | "hash">;

const isBlank = (v: FieldValue | undefined) => v === null || v === undefined || String(v).trim() === "";

/** Display name of the record a request creates (customer, vendor, item, centre or extended customer). */
export function recordName(domainId: string, data: Record<string, FieldValue>): string {
  const key = PRIMARY_NAME_FIELD[domainId];
  const v = key ? data[key] : undefined;
  if (!isBlank(v)) return String(v).trim();
  for (const k of ["customerName", "vendorName", "itemName", "centreName", "existingName", "name"]) {
    if (!isBlank(data[k])) return String(data[k]).trim();
  }
  return "";
}

/** "New Item: Dengue NS1 Ag Rapid Test 25T", "Extend: Sungai Permai Medical Centre → QTS", or "New Vendor (untitled)". */
export function requestTitle(domain: Pick<DomainConfig, "id" | "label"> | undefined, data: Record<string, FieldValue>): string {
  const label = domain?.label ?? "Request";
  const name = recordName(domain?.id ?? "", data);
  if (domain?.id === "extend") {
    const to = isBlank(data.extendToEntity) ? "" : ` → ${String(data.extendToEntity).trim()}`;
    return name ? `Extend: ${name}${to}` : `${label} (untitled)`;
  }
  return name ? `${label}: ${name}` : `${label} (untitled)`;
}

/** Copy of request data with sensitive fields masked, for audit before/after snapshots. */
export function maskedSnapshot(
  domain: DomainConfig | undefined,
  data: Record<string, FieldValue>,
  keys?: string[],
): Record<string, FieldValue> {
  const sensitive = new Set((domain?.fields ?? []).filter((f) => f.sensitive).map((f) => f.key));
  const out: Record<string, FieldValue> = {};
  for (const k of keys ?? Object.keys(data)) {
    const v = data[k] ?? null;
    out[k] = sensitive.has(k) && !isBlank(v) ? maskValue(v) : v;
  }
  return out;
}

const REGULATED: readonly string[] = REGULATED_CATEGORIES;

/**
 * SAP B1 fields for a created record, keyed by SAP technical name (as imported via DTW).
 * The assigned code always wins over a requestor-proposed key.
 */
export function sapFieldsFor(
  domain: DomainConfig,
  req: Pick<MdmRequest, "id" | "data">,
  code: string,
): Record<string, string> {
  const f: Record<string, string> = {};
  const keyFields = new Set<string>();
  switch (domain.sapObject) {
    case "oBusinessPartners":
      f.CardCode = code;
      f.CardType = domain.codePrefix === "V" ? "cSupplier" : "cCustomer";
      keyFields.add("CardCode");
      break;
    case "oItems":
      f.ItemCode = code;
      f.ItemType = "itItems";
      f.InventoryItem = "tYES";
      f.SalesItem = "tYES";
      f.PurchaseItem = "tYES";
      keyFields.add("ItemCode");
      break;
    case "oProfitCenter":
      f.CenterCode = sapKeyFor(code);
      f.Active = "tYES";
      keyFields.add("CenterCode");
      break;
    default:
      f.Code = code;
  }
  for (const field of domain.fields) {
    if (!field.sapField || keyFields.has(field.sapField)) continue;
    const v = req.data[field.key];
    if (isBlank(v)) continue;
    f[field.sapField] = String(v).trim();
  }
  if (domain.sapObject === "oItems") {
    const regulated = REGULATED.includes(String(req.data.category ?? "")) || String(req.data.productGroup ?? "") === "A";
    f.ManageBatchNumbers = regulated ? "tYES" : "tNO";
  }
  if (domain.sapObject === "oProfitCenter" && !isBlank(req.data.centreCode)) {
    f.U_ProposedCode = String(req.data.centreCode).trim();
  }
  f.U_OneRecordRef = req.id;
  return f;
}

/** Entities a business partner record is shared with (U_Entities, comma-separated; legacy U_Entity read too). */
export function entitiesOf(rec: Pick<SapRecord, "fields"> | undefined): string[] {
  if (!rec) return [];
  return String(rec.fields.U_Entities ?? rec.fields.U_Entity ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fold an "extend" request into the existing SAP record (assumption A28): one BP record is shared by all entities,
 * so an extension UPDATES it — adds the entity to U_Entities, applies Finance-approved payment terms / credit limit
 * when changesCreditTerms = Yes, and records a new ship-to when one is given. The CardCode never changes.
 */
export function applyExtension(rec: SapRecord, data: Record<string, FieldValue>, requestId: string): SapRecord {
  const fields = { ...rec.fields };
  const entities = new Set(entitiesOf(rec));
  if (!isBlank(data.extendToEntity)) entities.add(String(data.extendToEntity).trim());
  fields.U_Entities = [...entities].join(", ");
  delete fields.U_Entity;
  if (String(data.changesCreditTerms ?? "").trim().toLowerCase() === "yes") {
    if (!isBlank(data.paymentTerms)) fields.PayTermsGrpCode = String(data.paymentTerms).trim();
    if (!isBlank(data.creditLimit)) fields.CreditLimit = String(data.creditLimit).trim();
  }
  if (!isBlank(data.newShipToAddress)) {
    fields.ShipToDefault = `SHIP-${String(data.extendToEntity ?? "").trim() || "NEW"}`;
    fields.U_ShipToAddress = String(data.newShipToAddress).trim();
  }
  fields.U_OneRecordRef = requestId;
  return { ...rec, fields };
}

/** The domain id whose PRs a created record unblocks: customer codes for BP domains, item codes for items. */
export function unblockField(domain: DomainConfig): "customerCode" | "itemCode" | null {
  if (domain.sapObject === "oItems") return "itemCode";
  if (domain.sapObject === "oBusinessPartners" && domain.codePrefix !== "V") return "customerCode";
  return null;
}

/** The Teams approval card + Outlook actionable message an approver receives when their step activates. */
export function approvalNotifications(
  req: Pick<MdmRequest, "id" | "title">,
  step: Pick<ApprovalStep, "id" | "label" | "assigneeId">,
  requestorName: string,
  at: string,
  read = false,
): Omit<AppNotification, "id">[] {
  return [
    {
      at,
      toId: step.assigneeId,
      channel: "teams",
      kind: "approval",
      title: `Approval requested · ${req.id}`,
      body: `${requestorName} needs your approval: ${req.title}. Your step: ${step.label}.`,
      requestId: req.id,
      stepId: step.id,
      read,
    },
    {
      at,
      toId: step.assigneeId,
      channel: "outlook",
      kind: "approval",
      title: `[Action required] ${req.id} — ${req.title}`,
      body: `${requestorName} submitted ${req.id}. Approve, reject or ask a question directly from this message. Step: ${step.label}.`,
      requestId: req.id,
      stepId: step.id,
      read,
    },
  ];
}

/** Every SAP code already issued or reserved, for numbering the next one. */
export function knownSapCodes(
  data: { sapRecords: Pick<SapRecord, "code">[]; requests: Pick<MdmRequest, "id" | "sapCode">[]; reservedCodes?: Record<string, string> },
  exceptRequestId?: string,
): string[] {
  const codes = data.sapRecords.map((r) => r.code);
  for (const r of data.requests) if (r.sapCode) codes.push(r.sapCode);
  for (const [reqId, code] of Object.entries(data.reservedCodes ?? {})) if (reqId !== exceptRequestId) codes.push(code);
  return codes;
}

// =============================================================================================
// Seed internals
// =============================================================================================

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SGT = 8 * HOUR;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const plusMinutes = (iso: string, m: number) => new Date(Date.parse(iso) + m * 60_000).toISOString();
const later = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);

function sgtDay(iso: string): number {
  return new Date(Date.parse(iso) + SGT).getUTCDay();
}
function sgtHour(iso: string): number {
  return new Date(Date.parse(iso) + SGT).getUTCHours();
}
/** Same SGT calendar day as iso, at hh:mm SGT. */
function atSgt(iso: string, hour: number, minute: number): string {
  const d = new Date(Date.parse(iso) + SGT);
  d.setUTCHours(hour, minute, 0, 0);
  return new Date(d.getTime() - SGT).toISOString();
}
/** Next SGT weekday (strictly after iso's day) at 09:mm. */
function nextWorkdayMorning(iso: string, minute: number): string {
  let t = Date.parse(atSgt(iso, 9, minute)) + DAY;
  while ([0, 6].includes(sgtDay(new Date(t).toISOString()))) t += DAY;
  return new Date(t).toISOString();
}
/** Move an instant forward into SGT office hours (Mon–Fri 09:00–18:00). */
function snapToOfficeHours(iso: string, minute: number): string {
  const dow = sgtDay(iso);
  if (dow === 0 || dow === 6) return nextWorkdayMorning(atSgt(iso, 0, 0), minute);
  const h = sgtHour(iso);
  if (h < 9) return atSgt(iso, 9, minute);
  if (h >= 18) return nextWorkdayMorning(iso, minute);
  return iso;
}

/** Previous office close (17:mm SGT): same day if already past 18:00 on a weekday, else the previous weekday. */
function prevOfficeEnd(iso: string, minute: number): string {
  const dow = sgtDay(iso);
  if (dow >= 1 && dow <= 5 && sgtHour(iso) >= 18) return atSgt(iso, 17, minute);
  let t = Date.parse(atSgt(iso, 17, minute)) - DAY;
  while ([0, 6].includes(sgtDay(new Date(t).toISOString()))) t -= DAY;
  return new Date(t).toISOString();
}

/**
 * Move an instant to the nearest SGT office-hours moment (Mon–Fri 09:00–18:00) that stays within [lo, hi].
 * Instants already in office hours, or with no admissible candidate, are kept (clamped to hi).
 */
function snapNearOffice(iso: string, minute: number, lo?: string, hi?: string): string {
  const t = Date.parse(iso);
  const loT = lo ? Date.parse(lo) : -Infinity;
  const hiT = hi ? Date.parse(hi) : Infinity;
  const dow = sgtDay(iso);
  const h = sgtHour(iso);
  let out = t;
  if (!(dow >= 1 && dow <= 5 && h >= 9 && h < 18)) {
    const candidates = [Date.parse(snapToOfficeHours(iso, minute)), Date.parse(prevOfficeEnd(iso, minute))]
      .filter((x) => x >= loT && x <= hiT)
      .sort((a, b) => Math.abs(a - t) - Math.abs(b - t));
    if (candidates.length) out = candidates[0];
  }
  return new Date(Math.max(loT, Math.min(hiT, out))).toISOString();
}

function defKey(step: ApprovalStep): string {
  const i = step.id.indexOf(".");
  return i >= 0 ? step.id.slice(i + 1) : step.id;
}

const COMMENTS: Partial<Record<string, string[]>> = {
  bu_head: [
    "Approved — key account for the region.",
    "Commercially sound; pricing in line with the tender.",
    "OK to proceed.",
    "Approved. Please make sure the price list is updated before the first order.",
  ],
  business_support: [
    "Address and tax ID verified against the registry.",
    "UoM, pricing and warehouse set-up checked.",
    "Details complete and consistent with the quotation.",
    "Verified; delivery address confirmed with the customer.",
  ],
  finance: [
    "Credit terms checked against the latest audited accounts.",
    "Bank details verified by call-back to a known number.",
    "Terms approved as requested.",
  ],
  finance_director: ["Credit limit approved; review again after two quarters of trading."],
  financial_controller: ["Mapped to the correct dimension and GL range.", "Approved for the new budget line."],
  procurement: ["Supplier vetted; quotation and trade references on file.", "Approved — preferred supplier for the category."],
  qa_ra: [
    "Licence verified on the regulator's register.",
    "Product registration and IFU checked; batch tracking required.",
    "Supplier licence and quality agreement on file.",
  ],
  mdm: ["Final check passed; no duplicates found.", "Checked against existing records; created via DTW import."],
};

interface Ctx {
  now: string;
  config: AppConfig;
  rng: () => number;
  events: AuditDraft[];
  notifications: AppNotification[];
  nid: number;
}

const ago = (ctx: Ctx, bd: number) => addBusinessDays(ctx.now, -bd);
const pick = <T,>(ctx: Ctx, xs: T[]): T => xs[Math.floor(ctx.rng() * xs.length) % xs.length];

function domainOf(ctx: Ctx, id: string): DomainConfig {
  const d = ctx.config.domains.find((x) => x.id === id);
  if (!d) throw new Error(`Seed references unknown domain "${id}"`);
  return d;
}
function buOf(ctx: Ctx, entity: string): BusinessUnit | undefined {
  return ctx.config.businessUnits.find((b) => b.id === entity);
}
function nameOf(ctx: Ctx, id: string): string {
  return ctx.config.people.find((p) => p.id === id)?.name ?? id;
}

function audit(ctx: Ctx, e: AuditDraft) {
  ctx.events.push(e);
}

function notify(ctx: Ctx, n: Omit<AppNotification, "id">) {
  ctx.nid += 1;
  ctx.notifications.push({ ...n, id: `ntf-seed-${String(ctx.nid).padStart(4, "0")}` });
}

/** Teams + Outlook pair for an approver whose step just became active. */
function notifyApprover(ctx: Ctx, req: MdmRequest, step: ApprovalStep, at: string, read: boolean) {
  for (const n of approvalNotifications(req, step, nameOf(ctx, req.requestorId), at, read)) notify(ctx, n);
}

// =============================================================================================
// Reference data (fictional)
// =============================================================================================

interface CustomerRef {
  code: string;
  name: string;
  entity: string;
  country: CountryCode;
  taxId: string;
  street: string;
  city: string;
  zip: string;
  phone: string;
  segment: string;
  createdAt: string;
}

const BASELINE_CUSTOMERS: CustomerRef[] = [
  { code: "C-SG-00017", name: "National University Hospital", entity: "SPD", country: "SG", taxId: "198500123K", street: "5 Lower Kent Ridge Road", city: "Singapore", zip: "119074", phone: "+65 6779 5555", segment: "Public hospital", createdAt: "2019-03-11T02:15:00.000Z" },
  { code: "C-SG-00064", name: "Kallang Community Hospital", entity: "SPD", country: "SG", taxId: "200307781M", street: "21 Kallang Bahru", city: "Singapore", zip: "339337", phone: "+65 6294 7020", segment: "Public hospital", createdAt: "2021-06-02T03:40:00.000Z" },
  { code: "C-SG-00088", name: "Novena Diagnostic Imaging Centre", entity: "QTS", country: "SG", taxId: "199804567D", street: "10 Sinaran Drive, #03-11", city: "Singapore", zip: "307506", phone: "+65 6352 6188", segment: "Diagnostic lab", createdAt: "2023-02-20T06:05:00.000Z" },
  { code: "C-MY-00031", name: "Sungai Permai Medical Centre", entity: "SPD", country: "MY", taxId: "199801033618", street: "8 Jalan Permai Utama, Taman Sungai Permai", city: "Subang Jaya", zip: "47500", phone: "+60 3-5639 4180", segment: "Private hospital", createdAt: "2020-01-14T01:30:00.000Z" },
  { code: "C-MY-00058", name: "Pulau Mutiara General Hospital", entity: "SPD", country: "MY", taxId: "196201000088", street: "Jalan Mutiara Indah", city: "George Town", zip: "10450", phone: "+60 4-281 6620", segment: "Public hospital", createdAt: "2021-09-07T02:50:00.000Z" },
  { code: "C-TH-00041", name: "Bangkok Metro Lab", entity: "SPD", country: "TH", taxId: "0105551023874", street: "1120 Rama IV Road, Khlong Toei", city: "Bangkok", zip: "10110", phone: "+66 2 671 4400", segment: "Diagnostic lab", createdAt: "2022-04-25T03:20:00.000Z" },
  { code: "C-VN-00022", name: "Hue Central Diagnostics", entity: "SPD", country: "VN", taxId: "3301245789", street: "16 Le Loi Street", city: "Hue", zip: "530000", phone: "+84 234 3822 165", segment: "Diagnostic lab", createdAt: "2022-11-08T02:10:00.000Z" },
  { code: "C-MM-00009", name: "Yangon General Diagnostics", entity: "QTG", country: "MM", taxId: "104876213", street: "No. 82 Bogyoke Aung San Road, Pabedan Township", city: "Yangon", zip: "11141", phone: "+95 1 377 210", segment: "Diagnostic lab", createdAt: "2023-07-17T04:00:00.000Z" },
];

interface ItemRef {
  code: string;
  name: string;
  group: ProductGroup;
  category: string;
  entity: string;
  price: number;
}

const BASELINE_ITEMS: ItemRef[] = [
  { code: "I-A-000774", name: "HbA1c Reagent Kit 100T", group: "A", category: "IVD reagent", entity: "SPD", price: 140 },
  { code: "I-A-000791", name: "CX-240 Reagent Starter Pack", group: "A", category: "IVD reagent", entity: "QTS", price: 210 },
  { code: "I-B-000512", name: "Serological Pipettes 10 mL, Sterile (200s)", group: "B", category: "Lab consumable", entity: "QTG", price: 64 },
  { code: "I-C-000198", name: "Chemistry Analyser CX-240", group: "C", category: "Instrument", entity: "QTS", price: 64800 },
];

function baselineSapRecords(): SapRecord[] {
  const recs: SapRecord[] = BASELINE_CUSTOMERS.map((c) => ({
    code: c.code,
    object: "oBusinessPartners",
    name: c.name,
    createdAt: c.createdAt,
    fields: {
      CardCode: c.code,
      CardName: c.name,
      CardType: "cCustomer",
      FederalTaxID: c.taxId,
      Phone1: c.phone,
      GroupCode: c.segment,
      "BPAddresses.Street": c.street,
      "BPAddresses.City": c.city,
      "BPAddresses.ZipCode": c.zip,
      "BPAddresses.Country": c.country,
      U_Entities: c.entity,
    },
  }));
  recs.push(
    {
      code: "V-VN-00012",
      object: "oBusinessPartners",
      name: "Saigon Medical Logistics Co., Ltd.",
      createdAt: "2022-08-03T02:00:00.000Z",
      fields: {
        CardCode: "V-VN-00012",
        CardName: "Saigon Medical Logistics Co., Ltd.",
        CardType: "cSupplier",
        FederalTaxID: "0312876540",
        Phone1: "+84 28 3920 4410",
        "BPAddresses.Street": "45 Ton Duc Thang, District 1",
        "BPAddresses.ZipCode": "700000",
        "BPAddresses.Country": "VN",
        U_Regulated: "No",
      },
    },
    {
      code: "V-MM-00006",
      object: "oBusinessPartners",
      name: "Yangon Medical Supplies Co., Ltd.",
      createdAt: "2023-01-16T03:30:00.000Z",
      fields: {
        CardCode: "V-MM-00006",
        CardName: "Yangon Medical Supplies Co., Ltd.",
        CardType: "cSupplier",
        FederalTaxID: "103459872",
        Phone1: "+95 1 253 940",
        "BPAddresses.Street": "No. 7 Pyay Road, Kamayut Township",
        "BPAddresses.ZipCode": "11041",
        "BPAddresses.Country": "MM",
        U_Regulated: "Yes",
      },
    },
  );
  for (const it of BASELINE_ITEMS) {
    recs.push({
      code: it.code,
      object: "oItems",
      name: it.name,
      createdAt: "2024-05-06T02:00:00.000Z",
      fields: {
        ItemCode: it.code,
        ItemName: it.name,
        ItemType: "itItems",
        ItemsGroupCode: it.group,
        U_Category: it.category,
        U_Entity: it.entity,
        "Items_Prices.Price": String(it.price),
        ManageBatchNumbers: it.group === "A" ? "tYES" : "tNO",
      },
    });
  }
  const ccs: [string, string, string, CountryCode][] = [
    ["CC-TH-0011", "SPD Bangkok Hospital Sales", "SPD", "TH"],
    ["CC-VN-0008", "QTS Vietnam Field Service", "QTS", "VN"],
    ["CC-MM-0004", "QTG Myanmar Distribution", "QTG", "MM"],
  ];
  for (const [code, name, entity, country] of ccs) {
    recs.push({
      code,
      object: "oProfitCenter",
      name,
      createdAt: "2024-01-02T01:00:00.000Z",
      fields: { CenterCode: sapKeyFor(code), CenterName: name, InWhichDimension: "1", U_Entity: entity, U_Country: country, Active: "tYES" },
    });
  }
  return recs;
}

/** Code floors for numbering issued before OneRecord went live (not every legacy record is in this extract). */
const LEGACY_CODE_FLOORS = [
  "C-SG-00118",
  "C-MY-00119",
  "C-TH-00062",
  "C-VN-00046",
  "C-MM-00017",
  "V-SG-00037",
  "V-MY-00042",
  "V-TH-00020",
  "I-A-000807",
  "I-B-000531",
  "I-C-000213",
  "CC-SG-0029",
  "CC-MY-0016",
];

// =============================================================================================
// Historical requests (completed through OneRecord)
// =============================================================================================

interface HistSpec {
  domainId: string;
  requestorId: string;
  entity: string;
  country: CountryCode;
  data: Record<string, FieldValue>;
}

function cust(
  name: string,
  country: CountryCode,
  entity: string,
  taxId: string,
  street: string,
  city: string,
  zipCode: string,
  phone: string,
  segment: string,
  contactPerson: string,
  domain: string,
  terms: string,
  creditLimit: number,
  currency: string,
): Record<string, FieldValue> {
  return {
    customerName: name,
    country,
    entity,
    taxId,
    street,
    city,
    zipCode,
    phone,
    email: `accounts@${domain}.example`,
    contactPerson,
    segment,
    paymentTerms: terms,
    creditLimit,
    currency,
    bankName: null,
    bankAccountNo: null,
    swift: null,
  };
}

function item(
  itemName: string,
  category: string,
  productGroup: ProductGroup,
  manufacturer: string,
  uom: string,
  packSize: number,
  costPrice: number,
  salesPrice: number,
  storage: string,
  regLicenceNo: string | null,
  entity: string,
  countries: string,
): Record<string, FieldValue> {
  return { itemName, category, productGroup, manufacturer, uom, packSize, costPrice, salesPrice, storage, regLicenceNo, entity, countries };
}

const AMBIENT = "Ambient (15–30 °C)";
const COLD = "Refrigerated (2–8 °C)";

/** In creation order (oldest first). */
const HISTORY: HistSpec[] = [
  { domainId: "customer", requestorId: "jasmine", entity: "SPD", country: "SG", data: cust("Harbourfront Specialist Clinic", "SG", "SPD", "201609874H", "1 Maritime Square, #09-52", "Singapore", "099253", "+65 6273 8810", "Clinic", "Dr Andrew Lee", "harbourfrontclinic", "Net 30", 15000, "SGD") },
  { domainId: "item", requestorId: "amy", entity: "SPD", country: "SG", data: item("Malaria Pf/Pan Ag Rapid Test 25T", "IVD reagent", "A", "Hangzhou Clearview Diagnostics Co., Ltd.", "KIT", 25, 24.5, 38, AMBIENT, "DE0508821", "SPD", "SG, MY, MM") },
  { domainId: "vendor", requestorId: "meifong", entity: "QTG", country: "SG", data: { vendorName: "Jurong Scientific Pte Ltd", country: "SG", taxId: "201220456W", street: "8 Jurong Port Road, #04-02", zipCode: "619108", phone: "+65 6265 3311", email: "receivables@jurongscientific.example", suppliesRegulated: "No", bankName: "Straits Commercial Bank", bankAccountNo: "072-418833-4", swift: "STCBSGSG", paymentTerms: "Net 45" } },
  { domainId: "customer", requestorId: "faiz", entity: "SPD", country: "MY", data: cust("Klinik Seri Ampang", "MY", "SPD", "201801034219", "No. 12, Jalan Mamanda 9, Taman Dato Ahmad Razali", "Ampang", "68000", "+60 3-4270 1189", "Clinic", "Dr Farid Osman", "klinikseriampang", "Net 30", 12000, "MYR") },
  { domainId: "item", requestorId: "jasmine", entity: "QTG", country: "SG", data: item("Pipette Tips 200 µL, Filtered (960s)", "Lab consumable", "B", "Jiangsu Labware Co., Ltd.", "CS", 960, 55, 88, AMBIENT, null, "QTG", "SG, MY, VN") },
  { domainId: "customer", requestorId: "kittipong", entity: "QTG", country: "TH", data: cust("Chiang Mai Hillside Hospital", "TH", "QTG", "0505557001234", "222 Huay Kaew Road, Suthep", "Chiang Mai", "50200", "+66 53 210 900", "Private hospital", "Khun Anan Boonmee", "cmhillside", "Net 45", 35000, "THB") },
  { domainId: "costcentre", requestorId: "benjamin", entity: "SPD", country: "MY", data: { centreCode: "MY-SPD04", centreName: "SPD Klang Valley Key Accounts", entity: "SPD", country: "MY", owner: "Ahmad Faiz Rahim", dimension: "2" } },
  { domainId: "item", requestorId: "amy", entity: "SPD", country: "SG", data: item("Hepatitis B sAg Rapid Test 40T", "IVD reagent", "A", "Seoul BioAssay Co., Ltd.", "KIT", 40, 28, 44, COLD, "DE0509034", "SPD", "SG, VN, MM") },
  { domainId: "customer", requestorId: "minhduc", entity: "QTS", country: "VN", data: cust("Da Nang Coastal Hospital", "VN", "QTS", "0401987654", "74 Hai Phong Street, Hai Chau District", "Da Nang", "550000", "+84 236 3821 480", "Public hospital", "Dr Le Thi Thu", "danangcoastal", "Net 60", 45000, "VND") },
  { domainId: "extend", requestorId: "nurul", entity: "QTS", country: "MY", data: { existingCode: "C-MY-00058", existingName: "Pulau Mutiara General Hospital", extendToEntity: "QTS", newShipToAddress: "Pathology Department, Block B, Jalan Mutiara Indah, 10450 George Town", changesCreditTerms: "No", reason: "Pulau Mutiara General Hospital is buying a benchtop centrifuge from QTS; the customer exists only under SPD." } },
  { domainId: "customer", requestorId: "thandar", entity: "QTG", country: "MM", data: cust("Mandalay City Hospital", "MM", "QTG", "105233871", "No. 35, 26th Street, Chanayethazan Township", "Mandalay", "05021", "+95 2 403 118", "Public hospital", "Dr Aung Kyaw Moe", "mandalaycityhospital", "Cash on delivery", 10000, "USD") },
  { domainId: "item", requestorId: "nurul", entity: "QTS", country: "MY", data: item("Benchtop Centrifuge CF-16R", "Instrument", "C", "Suzhou Precision Lab Instruments Co., Ltd.", "EA", 1, 6400, 9800, AMBIENT, null, "QTS", "MY, SG, TH") },
  { domainId: "customer", requestorId: "amy", entity: "SPD", country: "SG", data: cust("Tampines Family Clinic Group", "SG", "SPD", "201511203E", "9 Tampines Central 1, #04-12", "Singapore", "529536", "+65 6786 2290", "Clinic", "Ms Rachel Ng", "tampinesfamilyclinic", "Net 30", 20000, "SGD") },
  { domainId: "vendor", requestorId: "meifong", entity: "QTG", country: "MY", data: { vendorName: "Selangor Cold Chain Logistics Sdn Bhd", country: "MY", taxId: "201401022876", street: "Lot 5, Jalan Pelabur 23/1, Seksyen 23", zipCode: "40300", phone: "+60 3-5541 7720", email: "billing@selangorcoldchain.example", suppliesRegulated: "No", bankName: "Malaya Union Bank", bankAccountNo: "5140 2287 6611", swift: "MUBKMYKL", paymentTerms: "Net 30" } },
  { domainId: "item", requestorId: "amy", entity: "SPD", country: "SG", data: item("CRP Latex Reagent 2×50 mL", "IVD reagent", "A", "Seoul BioAssay Co., Ltd.", "KIT", 100, 33, 52, COLD, "DE0509377", "SPD", "SG, TH") },
  { domainId: "customer", requestorId: "kittipong", entity: "SPD", country: "TH", data: cust("Khon Kaen Provincial Lab", "TH", "SPD", "0405560009871", "54 Sri Chan Road, Nai Mueang", "Khon Kaen", "40000", "+66 43 236 500", "Diagnostic lab", "Khun Pranee Srisawat", "khonkaenlab", "Net 45", 20000, "THB") },
  { domainId: "item", requestorId: "jasmine", entity: "QTG", country: "SG", data: item("Microcentrifuge Tubes 1.5 mL (500s)", "Lab consumable", "B", "Jiangsu Labware Co., Ltd.", "PCK", 500, 42, 70, AMBIENT, null, "QTG", "SG, MM, VN") },
  { domainId: "customer", requestorId: "faiz", entity: "SPD", country: "MY", data: cust("Ipoh Specialist Diagnostics Sdn Bhd", "MY", "SPD", "201901017654", "38 Jalan Raja Dr Nazrin Shah", "Ipoh", "30250", "+60 5-255 8812", "Diagnostic lab", "Mr Lim Kok Wai", "ipohdiagnostics", "Net 45", 25000, "MYR") },
  { domainId: "customer", requestorId: "jasmine", entity: "QTG", country: "SG", data: cust("Kent Ridge BioLabs Pte Ltd", "SG", "QTG", "201733456N", "71 Science Park Drive, #02-05", "Singapore", "118254", "+65 6872 4410", "Research/academic", "Dr Wong Mei Xin", "kentridgebiolabs", "Net 30", 30000, "SGD") },
  { domainId: "item", requestorId: "faiz", entity: "SPD", country: "MY", data: item("Troponin I Rapid Test 20T", "IVD reagent", "A", "Hangzhou Clearview Diagnostics Co., Ltd.", "KIT", 20, 61, 96, COLD, "GB8102233-58817", "SPD", "MY, SG") },
  { domainId: "vendor", requestorId: "meifong", entity: "QTS", country: "TH", data: { vendorName: "Bangkok Lab Supply Co., Ltd.", country: "TH", taxId: "0105562004418", street: "455 Phahonyothin Road, Sam Sen Nai, Phaya Thai", zipCode: "10400", phone: "+66 2 279 8840", email: "ar@bangkoklabsupply.example", suppliesRegulated: "Yes", bankName: "Chao Phraya Commercial Bank", bankAccountNo: "301-2-44871-6", swift: "CPCBTHBK", paymentTerms: "Net 60" } },
  { domainId: "customer", requestorId: "minhduc", entity: "QTG", country: "VN", data: cust("Saigon Precision Lab JSC", "VN", "QTG", "0315678234", "201 Nguyen Thi Minh Khai, District 3", "Ho Chi Minh City", "700000", "+84 28 3930 7712", "Diagnostic lab", "Mr Nguyen Hoang Nam", "saigonprecisionlab", "Net 45", 28000, "VND") },
  { domainId: "item", requestorId: "jasmine", entity: "QTG", country: "SG", data: item("Cryovials 2 mL, Sterile (100s)", "Lab consumable", "B", "Jiangsu Labware Co., Ltd.", "PCK", 100, 27, 46, AMBIENT, null, "QTG", "SG, TH") },
  { domainId: "costcentre", requestorId: "benjamin", entity: "QTG", country: "SG", data: { centreCode: "SG-QTG03", centreName: "QTG Singapore Research Accts", entity: "QTG", country: "SG", owner: "Aisha Karim", dimension: "2" } },
  { domainId: "customer", requestorId: "nurul", entity: "QTS", country: "MY", data: cust("Johor Straits Medical Centre", "MY", "QTS", "200701029983", "2 Jalan Ibrahim Sultan, Stulang Laut", "Johor Bahru", "80300", "+60 7-225 3000", "Private hospital", "Puan Norhayati Salleh", "johorstraits", "Net 60", 40000, "MYR") },
  { domainId: "item", requestorId: "nurul", entity: "QTS", country: "MY", data: item("Coagulation Analyser CG-90", "Instrument", "C", "Shenzhen Kanglu Medical Electronics Co., Ltd.", "EA", 1, 17200, 26500, AMBIENT, null, "QTS", "MY, VN, TH") },
  { domainId: "extend", requestorId: "jasmine", entity: "QTG", country: "TH", data: { existingCode: "C-TH-00041", existingName: "Bangkok Metro Lab", extendToEntity: "QTG", newShipToAddress: null, changesCreditTerms: "No", reason: "Bangkok Metro Lab is moving its consumables spend to QTG; it already buys reagents from SPD." } },
  { domainId: "customer", requestorId: "thandar", entity: "SPD", country: "MM", data: cust("Yangon Northpoint Diagnostics", "MM", "SPD", "105611208", "No. 140 Kabar Aye Pagoda Road, Bahan Township", "Yangon", "11201", "+95 1 559 204", "Diagnostic lab", "Daw Thida Win", "northpointdx", "Net 30", 12000, "USD") },
  { domainId: "vendor", requestorId: "meifong", entity: "SPD", country: "MY", data: { vendorName: "Biomedix Supplies Sdn Bhd", country: "MY", taxId: "201601009812", street: "No. 3, Jalan PJU 7/16A, Mutiara Damansara", zipCode: "47800", phone: "+60 3-7728 4100", email: "finance@biomedix.example", suppliesRegulated: "Yes", bankName: "Malaya Union Bank", bankAccountNo: "5140 9921 0034", swift: "MUBKMYKL", paymentTerms: "Net 45" } },
  { domainId: "item", requestorId: "amy", entity: "SPD", country: "SG", data: item("Chikungunya IgM Rapid Test 30T", "IVD reagent", "A", "Hangzhou Clearview Diagnostics Co., Ltd.", "KIT", 30, 26, 41, COLD, "DE0509612", "SPD", "SG, MY, MM") },
];

interface Segment {
  ids: string[];
  parallel: boolean;
  mdm: boolean;
}

function segmentsOf(steps: ApprovalStep[]): Segment[] {
  const stageIdx = [...new Set(steps.map((s) => s.stageIndex))].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (const k of stageIdx) {
    const inStage = steps.filter((s) => s.stageIndex === k);
    const mdm = inStage.some((s) => s.role === "mdm");
    if (inStage[0].stageMode === "parallel") out.push({ ids: inStage.map((s) => s.id), parallel: true, mdm });
    else for (const s of inStage) out.push({ ids: [s.id], parallel: false, mdm });
  }
  return out;
}

function buildHistorical(ctx: Ctx, existingCodes: string[], sapRecords: SapRecord[]): MdmRequest[] {
  const n = HISTORY.length;
  const reqs: MdmRequest[] = HISTORY.map((spec, i) => {
    const id = `REQ-${1001 + i}`;
    const domain = domainOf(ctx, spec.domainId);
    const bu = buOf(ctx, spec.entity);
    const daysAgo = 88 - (i * 72) / (n - 1);
    let createdAt = atSgt(new Date(Date.parse(ctx.now) - daysAgo * DAY).toISOString(), 9 + Math.floor(ctx.rng() * 8), Math.floor(ctx.rng() * 60));
    createdAt = snapToOfficeHours(createdAt, Math.floor(ctx.rng() * 50));
    const submittedAt = plusMinutes(createdAt, 12 + Math.floor(ctx.rng() * 40));

    const route = buildRoute({ domain, bu, data: spec.data, people: ctx.config.people });
    const expectedBy = expectedCompletion(route, submittedAt, ctx.config.sla);
    const steps = route.map((s) => ({ ...s }));
    const byId = new Map(steps.map((s) => [s.id, s]));

    // Target 1.6–4.6 business days before office-hour snapping (lands at ~2–6 after snapping).
    const total = 1.6 + 3.0 * Math.pow(ctx.rng(), 1.15);
    const segs = segmentsOf(steps);
    const weights = segs.map((s) => (s.mdm ? 0.3 + 0.25 * ctx.rng() : 0.7 + 0.6 * ctx.rng()));
    const sumW = weights.reduce((a, b) => a + b, 0);

    let cursor = submittedAt;
    let dtwAt = submittedAt;
    segs.forEach((seg, k) => {
      const dur = Math.min(2.2, Math.max(0.12, (total * weights[k]) / sumW));
      const start = cursor;
      let end = start;
      const last = Math.floor(ctx.rng() * seg.ids.length);
      seg.ids.forEach((sid, j) => {
        const step = byId.get(sid)!;
        const frac = j === last ? 1 : 0.35 + 0.6 * ctx.rng();
        const decided = snapToOfficeHours(addBusinessDays(start, dur * frac), Math.floor(ctx.rng() * 55));
        step.activatedAt = start;
        step.decidedAt = decided;
        step.status = "approved";
        if (ctx.rng() < 0.55) step.comment = pick(ctx, COMMENTS[step.role] ?? ["Approved."]);
        if (businessDaysBetween(start, decided) >= ctx.config.sla.reminderAfterBusinessDays) {
          step.reminderSentAt = addBusinessDays(start, ctx.config.sla.reminderAfterBusinessDays);
        }
        end = later(end, decided);
      });
      if (seg.mdm) dtwAt = plusMinutes(end, -(6 + Math.floor(ctx.rng() * 14)));
      cursor = end;
    });
    const createdInSapAt = cursor;

    const req: MdmRequest = {
      id,
      domainId: domain.id,
      title: requestTitle(domain, spec.data),
      requestorId: spec.requestorId,
      entity: spec.entity,
      country: spec.country,
      createdAt,
      submittedAt,
      status: "created",
      data: { ...spec.data },
      configVersion: ctx.config.version,
      steps,
      expectedBy,
      dtwGeneratedAt: later(dtwAt, submittedAt),
      sapCreatedAt: createdInSapAt,
      closedAt: createdInSapAt,
      blockedPrIds: [],
      seeded: true,
    };
    return req;
  });

  // Assign SAP codes in the order records were actually created in SAP B1.
  const codes = [...existingCodes];
  const byCreation = [...reqs].sort((a, b) => Date.parse(a.sapCreatedAt!) - Date.parse(b.sapCreatedAt!));
  for (const req of byCreation) {
    const domain = domainOf(ctx, req.domainId);
    const code = assignSapCode(domain, req, codes);
    req.sapCode = code;
    codes.push(code);
    if (domain.id === "extend") {
      const idx = sapRecords.findIndex((r) => r.code === code);
      if (idx >= 0) sapRecords[idx] = applyExtension(sapRecords[idx], req.data, req.id);
    } else {
      sapRecords.push({
        code,
        object: domain.sapObject,
        name: recordName(domain.id, req.data),
        createdAt: req.sapCreatedAt!,
        requestId: req.id,
        fields: sapFieldsFor(domain, req, code),
      });
    }
  }

  // Audit trail for each completed request.
  for (const req of reqs) {
    const domain = domainOf(ctx, req.domainId);
    audit(ctx, {
      requestId: req.id,
      at: req.submittedAt!,
      actorId: req.requestorId,
      action: "submitted",
      detail: `Submitted · ${req.steps.length} approval steps · expected by ${req.expectedBy!.slice(0, 10)}`,
      after: maskedSnapshot(domain, req.data),
    });
    for (const s of req.steps) {
      if (s.reminderSentAt) {
        audit(ctx, {
          requestId: req.id,
          at: s.reminderSentAt,
          actorId: SYSTEM_ACTOR_ID,
          action: "reminder",
          detail: `Reminder sent to ${nameOf(ctx, s.assigneeId)} · ${s.label}`,
        });
      }
      if (s.role === "mdm") {
        audit(ctx, {
          requestId: req.id,
          at: req.dtwGeneratedAt!,
          actorId: s.assigneeId,
          action: "dtw_generated",
          detail: `DTW import file generated for ${req.sapCode}`,
        });
      }
      audit(ctx, {
        requestId: req.id,
        at: s.decidedAt!,
        actorId: s.assigneeId,
        action: "approved",
        detail: s.comment ? `${s.label} · “${s.comment}”` : s.label,
      });
    }
    audit(ctx, {
      requestId: req.id,
      at: req.sapCreatedAt!,
      actorId: req.steps.find((s) => s.role === "mdm")?.assigneeId ?? "priya",
      action: "created_in_sap",
      detail:
        domain.id === "extend"
          ? `${req.sapCode} extended to ${String(req.data.extendToEntity ?? "")} in SAP B1`
          : `${req.sapCode} created in SAP B1 via DTW import`,
    });
  }
  return reqs;
}

// =============================================================================================
// Recent requests (REQ-1031…1044)
// =============================================================================================

type StepPlan =
  | { s: "approved"; ago: number; comment?: string }
  | { s: "rejected"; ago: number; comment: string }
  | { s: "question"; askedAgo: number; text: string }
  | { s: "pending" }
  | { s: "skipped" };

interface RecentSpec {
  id: string;
  domainId: string;
  requestorId: string;
  entity: string;
  country: CountryCode;
  createdAgo: number;
  submittedAgo: number;
  status: RequestStatus;
  data: Record<string, FieldValue>;
  plan: Record<string, StepPlan>;
  blockedPrIds: string[];
  closedAgo?: number;
  cancelReason?: string;
  duplicateDecision?: DuplicateDecision;
  aiFilledKeys?: string[];
  /** Keep the exact submission age (SLA demo timing) instead of snapping it to office hours. */
  exactSubmit?: boolean;
}

const RECENT: RecentSpec[] = [
  {
    id: "REQ-1031",
    domainId: "vendor",
    requestorId: "meifong",
    entity: "QTG",
    country: "MM",
    createdAgo: 5.4,
    submittedAgo: 5.2,
    status: "cancelled",
    closedAgo: 4.6,
    cancelReason: "Withdrawn: the supplier already exists as V-MM-00006 Yangon Medical Supplies Co., Ltd. (its trading name). Using the existing vendor.",
    data: { vendorName: "Ayeyarwady Scientific Co., Ltd.", country: "MM", taxId: "103459872", street: "No. 7 Pyay Road, Kamayut Township", zipCode: "11041", phone: "+95 1 253 940", email: "accounts@ayeyarwadyscientific.example", suppliesRegulated: "Yes", bankName: "Irrawaddy Commerce Bank", bankAccountNo: "0081 2200 4417 5", swift: "IRCBMMMY", paymentTerms: "Net 30" },
    plan: { "vend-proc": { s: "skipped" }, "vend-qa": { s: "skipped" } },
    blockedPrIds: [],
  },
  {
    id: "REQ-1032",
    domainId: "customer",
    requestorId: "amy",
    entity: "SPD",
    country: "SG",
    createdAgo: 4.3,
    submittedAgo: 4.1,
    status: "created",
    closedAgo: 1.0,
    data: cust("Novena Diagnostics Lab Pte Ltd", "SG", "SPD", "201912345K", "10 Sinaran Drive, #08-21", "Singapore", "307506", "+65 6255 1840", "Diagnostic lab", "Ms Grace Tan", "novenadx", "Net 30", 25000, "SGD"),
    plan: {
      "cust-bu": { s: "approved", ago: 3.4, comment: "New lab group with a strong infectious-disease panel. Approved." },
      "cust-bs": { s: "approved", ago: 3.1, comment: "UEN and address verified on the business registry." },
      "cust-fin": { s: "approved", ago: 2.2, comment: "Net 30 / S$25k approved on the latest management accounts." },
      mdm: { s: "approved", ago: 1.0, comment: "Checked against C-SG-00088 (different UEN); created via DTW import." },
    },
    blockedPrIds: ["PR-5501"],
    duplicateDecision: {
      matchCode: "C-SG-00088",
      matchName: "Novena Diagnostic Imaging Centre",
      score: 0.86,
      reasons: ["86% name match", "Same postcode"],
      choice: "override",
      justification: "Different company (UEN 201912345K vs 199804567D). The existing record is the imaging centre in the same building.",
    },
  },
  {
    id: "REQ-1033",
    domainId: "customer",
    requestorId: "faiz",
    entity: "SPD",
    country: "MY",
    createdAgo: 3.9,
    submittedAgo: 3.8,
    status: "rejected",
    closedAgo: 3.1,
    data: cust("Hospital Besar Pulau Mutiara", "MY", "SPD", "196201000088", "Jalan Mutiara Indah", "George Town", "10450", "+60 4-281 6620", "Public hospital", "Encik Rosli Hamid", "pmgh", "Net 60", 45000, "MYR"),
    plan: {
      "cust-bu": { s: "skipped" },
      "cust-bs": {
        s: "rejected",
        ago: 3.1,
        comment: "Same tax ID as C-MY-00058 Pulau Mutiara General Hospital — this is the hospital's Malay name, already set up under SPD. Please use the existing code.",
      },
    },
    blockedPrIds: [],
    duplicateDecision: {
      matchCode: "C-MY-00058",
      matchName: "Pulau Mutiara General Hospital",
      score: 0.97,
      reasons: ["Same tax ID", "Same postcode", "Same phone"],
      choice: "override",
      justification: "Registering under the official Malay name used on the MOH tender portal.",
    },
  },
  {
    id: "REQ-1034",
    domainId: "item",
    requestorId: "jasmine",
    entity: "QTG",
    country: "SG",
    createdAgo: 3.6,
    submittedAgo: 2.5,
    exactSubmit: true,
    status: "in_approval",
    data: item("Conical Centrifuge Tubes 50 mL, Sterile (500s)", "Lab consumable", "B", "Jiangsu Labware Co., Ltd.", "CS", 500, 78, 116, AMBIENT, null, "QTG", "SG, MM, TH"),
    plan: {
      "item-bs": { s: "approved", ago: 1.8, comment: "Case of 500, ambient storage; price list QTG-2026 updated." },
      "item-bu": { s: "pending" },
    },
    blockedPrIds: ["PR-5503", "PR-5515"],
  },
  {
    id: "REQ-1035",
    domainId: "item",
    requestorId: "nurul",
    entity: "QTS",
    country: "MY",
    createdAgo: 3.3,
    submittedAgo: 2.2,
    status: "mdm_review",
    data: item("Haematology Analyser 5-Part Diff HX-560", "Instrument", "C", "Shenzhen Kanglu Medical Electronics Co., Ltd.", "EA", 1, 38500, 58000, AMBIENT, null, "QTS", "VN, MY"),
    plan: {
      "item-bu": { s: "approved", ago: 1.4, comment: "Approved — anchor placement for the Da Nang tender." },
      "item-bs": { s: "approved", ago: 0.6, comment: "Serial-number tracking and service warehouse set up." },
      mdm: { s: "pending" },
    },
    blockedPrIds: ["PR-5510"],
  },
  {
    id: "REQ-1036",
    domainId: "item",
    requestorId: "amy",
    entity: "SPD",
    country: "SG",
    createdAgo: 3.2,
    submittedAgo: 1.3,
    status: "needs_info",
    data: item("Influenza A/B Antigen Rapid Test 20T", "IVD reagent", "A", "Seoul BioAssay Co., Ltd.", "KIT", 20, 21.5, 32.5, COLD, "DE0509217", "SPD", "SG"),
    plan: {
      "item-bu": { s: "approved", ago: 0.9, comment: "Approved ahead of the flu season." },
      "item-bs": { s: "approved", ago: 0.8, comment: "UoM and cold-chain handling confirmed." },
      "item-qa": {
        s: "question",
        askedAgo: 0.6,
        text: "The HSA listing DE0509217 covers the 25-test pack. Is the 20-test kit on the same listing, or has a change notification been filed? If filed, please share the reference.",
      },
    },
    blockedPrIds: ["PR-5508", "PR-5517"],
  },
  {
    id: "REQ-1037",
    domainId: "vendor",
    requestorId: "meifong",
    entity: "QTG",
    country: "TH",
    createdAgo: 3.1,
    submittedAgo: 1.6,
    status: "in_approval",
    data: { vendorName: "Siam BioSupply Co., Ltd.", country: "TH", taxId: "0105559087123", street: "199 Rama IX Road, Huai Khwang", zipCode: "10310", phone: "+66 2 248 9100", email: "ar@siambiosupply.example", suppliesRegulated: "Yes", bankName: "Chao Phraya Commercial Bank", bankAccountNo: "406-1-22981-3", swift: "CPCBTHBK", paymentTerms: "Net 45" },
    plan: {
      "vend-proc": { s: "approved", ago: 1.1, comment: "Three quotes compared; best landed cost for Thai reagent imports." },
      "vend-qa": { s: "approved", ago: 0.4, comment: "Thai FDA import licence and GDP certificate verified." },
      "vend-fin": { s: "pending" },
    },
    blockedPrIds: [],
  },
  {
    id: "REQ-1038",
    domainId: "customer",
    requestorId: "kittipong",
    entity: "QTS",
    country: "TH",
    createdAgo: 3.0,
    submittedAgo: 2.9,
    status: "in_approval",
    data: {
      ...cust("Bangkok Riverside Hospital", "TH", "QTS", "0107561000234", "88/12 Charoen Nakhon Road, Khlong San", "Bangkok", "10600", "+66 2 431 7800", "Private hospital", "Khun Siriporn Wattanakul", "bangkokriverside", "Net 60", 80000, "THB"),
      bankName: "Chao Phraya Commercial Bank",
      bankAccountNo: "214-3-08876-5",
      swift: "CPCBTHBK",
    },
    plan: {
      "cust-bu": { s: "approved", ago: 1.2, comment: "Strategic account: CX-240 placement plus reagent pull-through. Approved." },
      "cust-bs": { s: "approved", ago: 0.7, comment: "Tax ID matches the Revenue Department record; billing address confirmed." },
      "cust-fin": { s: "pending" },
    },
    blockedPrIds: ["PR-5512", "PR-5513"],
  },
  {
    id: "REQ-1039",
    domainId: "costcentre",
    requestorId: "benjamin",
    entity: "QTS",
    country: "MY",
    createdAgo: 2.4,
    submittedAgo: 1.4,
    status: "in_approval",
    data: { centreCode: "MY-QTS02", centreName: "QTS Penang Service Hub", entity: "QTS", country: "MY", owner: "Nurul Huda Ismail", dimension: "2" },
    plan: {
      "cc-bu": { s: "approved", ago: 1.0, comment: "Budget confirmed for FY2027 field-service expansion." },
      "cc-fc": { s: "pending" },
    },
    blockedPrIds: [],
  },
  {
    id: "REQ-1040",
    domainId: "customer",
    requestorId: "minhduc",
    entity: "SPD",
    country: "VN",
    createdAgo: 2.3,
    submittedAgo: 0.9,
    status: "in_approval",
    data: {
      ...cust("Hanoi Central Lab", "VN", "SPD", "0109234567", "45 Tran Hung Dao Street, Hoan Kiem District", "Hanoi", "100000", "+84 24 3826 4417", "Diagnostic lab", "Dr Pham Quoc Bao", "hanoicentrallab", "Net 45", 30000, "VND"),
      bankName: "Mekong Trade Bank",
      bankAccountNo: "0021000456789",
      swift: "MKTBVNVX",
    },
    plan: {
      "cust-bu": { s: "approved", ago: 0.6, comment: "Approved — reference lab for northern Vietnam." },
      "cust-bs": { s: "pending" },
    },
    blockedPrIds: ["PR-5519"],
  },
  {
    id: "REQ-1041",
    domainId: "vendor",
    requestorId: "meifong",
    entity: "QTS",
    country: "VN",
    createdAgo: 2.2,
    submittedAgo: 0.5,
    status: "in_approval",
    data: { vendorName: "Mekong Lab Logistics JSC", country: "VN", taxId: "0316789012", street: "128 Nguyen Van Linh, District 7", zipCode: "700000", phone: "+84 28 5412 3399", email: "billing@mekonglablogistics.example", suppliesRegulated: "No", bankName: "Mekong Trade Bank", bankAccountNo: "0071001234567", swift: "MKTBVNVX", paymentTerms: "Net 30" },
    plan: { "vend-proc": { s: "pending" } },
    blockedPrIds: [],
  },
  {
    id: "REQ-1042",
    domainId: "item",
    requestorId: "amy",
    entity: "SPD",
    country: "MY",
    createdAgo: 2.1,
    submittedAgo: 2.0,
    status: "mdm_review",
    data: item("Dengue IgG/IgM Combo 30T", "IVD reagent", "A", "Hangzhou Clearview Diagnostics Co., Ltd.", "KIT", 30, 18.4, 27, COLD, "GB8102574-61208", "SPD", "MY, SG"),
    plan: {
      "item-qa": { s: "approved", ago: 1.1, comment: "MDA registration GB8102574-61208 verified; IFU in English and Bahasa Malaysia on file." },
      "item-bu": { s: "approved", ago: 1.6, comment: "Approved — dengue season demand from Sungai Permai and Pulau Mutiara." },
      "item-bs": { s: "approved", ago: 0.3, comment: "KIT of 30 tests, 2–8 °C storage, MY price list updated." },
      mdm: { s: "pending" },
    },
    blockedPrIds: ["PR-5521", "PR-5527"],
    aiFilledKeys: ["itemName", "category", "productGroup", "manufacturer", "uom", "packSize", "costPrice", "salesPrice", "storage"],
  },
  {
    id: "REQ-1043",
    domainId: "extend",
    requestorId: "nurul",
    entity: "QTS",
    country: "MY",
    createdAgo: 0.4,
    submittedAgo: 0.3,
    status: "in_approval",
    data: {
      existingCode: "C-MY-00031",
      existingName: "Sungai Permai Medical Centre",
      extendToEntity: "QTS",
      newShipToAddress: "Level 2, Clinical Laboratory, 8 Jalan Permai Utama, Taman Sungai Permai, 47500 Subang Jaya",
      changesCreditTerms: "No",
      reason: "Sungai Permai is buying a CG-90 coagulation analyser from QTS (PR-5531); the customer exists only under SPD.",
    },
    plan: { "ext-bs": { s: "pending" } },
    blockedPrIds: ["PR-5531"],
    duplicateDecision: {
      matchCode: "C-MY-00031",
      matchName: "Sungai Permai Medical Centre",
      score: 1,
      reasons: ["100% name match", "Same postcode"],
      choice: "extend",
    },
  },
  {
    id: "REQ-1044",
    domainId: "customer",
    requestorId: "thandar",
    entity: "QTG",
    country: "MM",
    createdAgo: 0.25,
    submittedAgo: 0.2,
    status: "in_approval",
    data: cust("Yangon Asia Royal Clinic", "MM", "QTG", "105942781", "No. 14 Baho Road, Sanchaung Township", "Yangon", "11111", "+95 1 538 055", "Clinic", "Daw Khin Myat Noe", "asiaroyalclinic", "Cash on delivery", 15000, "USD"),
    plan: { "cust-bu": { s: "pending" }, "cust-bs": { s: "pending" } },
    blockedPrIds: ["PR-5533"],
  },
];

function buildRecent(ctx: Ctx, codes: string[], sapRecords: SapRecord[]): MdmRequest[] {
  return RECENT.map((spec) => {
    const domain = domainOf(ctx, spec.domainId);
    const bu = buOf(ctx, spec.entity);
    const mins = () => 5 + Math.floor(ctx.rng() * 50);
    const submittedAt = spec.exactSubmit
      ? ago(ctx, spec.submittedAgo)
      : snapNearOffice(ago(ctx, spec.submittedAgo), mins(), undefined, plusMinutes(ctx.now, -30));
    const createdAt = snapNearOffice(ago(ctx, spec.createdAgo), mins(), undefined, plusMinutes(submittedAt, -6));
    const decision = (bdAgo: number, start: string) =>
      snapNearOffice(later(ago(ctx, bdAgo), plusMinutes(start, 20)), mins(), plusMinutes(start, 12), plusMinutes(ctx.now, -10));
    const route = buildRoute({ domain, bu, data: spec.data, people: ctx.config.people });
    const expectedBy = expectedCompletion(route, submittedAt, ctx.config.sla);
    const steps = route.map((s) => ({ ...s }));

    // Walk stages in order, applying the plan.
    let stageStart = submittedAt;
    const stageIdx = [...new Set(steps.map((s) => s.stageIndex))].sort((a, b) => a - b);
    for (const k of stageIdx) {
      const inStage = steps.filter((s) => s.stageIndex === k);
      const sequential = inStage[0].stageMode === "sequential";
      let cursor = stageStart;
      let stageEnd = stageStart;
      let stageDone = true;
      for (const step of inStage) {
        const p = spec.plan[defKey(step)];
        const start = sequential ? cursor : stageStart;
        if (!p) {
          stageDone = false;
          if (sequential) break;
          continue;
        }
        step.activatedAt = start;
        if (p.s === "approved" || p.s === "rejected") {
          step.status = p.s;
          step.decidedAt = decision(p.ago, start);
          if (p.comment) step.comment = p.comment;
          stageEnd = later(stageEnd, step.decidedAt);
          cursor = step.decidedAt;
          if (p.s === "rejected") stageDone = false;
        } else if (p.s === "question") {
          step.status = "question";
          const askedAt = decision(p.askedAgo, start);
          step.pausedAt = askedAt;
          step.question = { text: p.text, askedAt };
          stageDone = false;
        } else if (p.s === "pending") {
          step.status = "pending";
          stageDone = false;
        } else {
          step.status = "skipped";
          stageDone = false;
        }
      }
      if (!stageDone) break;
      stageStart = stageEnd;
    }

    const req: MdmRequest = {
      id: spec.id,
      domainId: domain.id,
      title: requestTitle(domain, spec.data),
      requestorId: spec.requestorId,
      entity: spec.entity,
      country: spec.country,
      createdAt,
      submittedAt,
      status: spec.status,
      data: { ...spec.data },
      configVersion: ctx.config.version,
      steps,
      expectedBy,
      blockedPrIds: [...spec.blockedPrIds],
    };
    if (spec.duplicateDecision) req.duplicateDecision = { ...spec.duplicateDecision };
    if (spec.aiFilledKeys) req.aiFilledKeys = [...spec.aiFilledKeys];
    if (spec.closedAgo !== undefined) req.closedAt = decision(spec.closedAgo, submittedAt);

    // Reminders already due on pending steps (so the next SLA tick doesn't re-send them).
    for (const s of steps) {
      if (s.status !== "pending" || !s.activatedAt) continue;
      if (stepElapsedBusinessDays(s, ctx.now) >= ctx.config.sla.reminderAfterBusinessDays) {
        s.reminderSentAt = addBusinessDays(s.activatedAt, ctx.config.sla.reminderAfterBusinessDays);
      }
    }

    if (spec.status === "created") {
      const mdmStep = steps.find((s) => s.role === "mdm");
      const at = mdmStep?.decidedAt ?? req.closedAt ?? ctx.now;
      const code = assignSapCode(domain, req, codes);
      codes.push(code);
      req.sapCode = code;
      req.sapCreatedAt = at;
      req.closedAt = at;
      req.dtwGeneratedAt = plusMinutes(at, -9);
      sapRecords.push({
        code,
        object: domain.sapObject,
        name: recordName(domain.id, req.data),
        createdAt: at,
        requestId: req.id,
        fields: sapFieldsFor(domain, req, code),
      });
    }
    return req;
  });
}

function auditAndNotifyRecent(ctx: Ctx, reqs: MdmRequest[]) {
  const readBefore = Date.parse(ago(ctx, 1));
  for (const req of reqs) {
    const domain = domainOf(ctx, req.domainId);
    const requestor = nameOf(ctx, req.requestorId);

    if (req.aiFilledKeys?.length) {
      audit(ctx, {
        requestId: req.id,
        at: plusMinutes(req.createdAt, 2),
        actorId: req.requestorId,
        action: "ai_prefill",
        detail: `Paste-to-fill populated ${req.aiFilledKeys.length} fields from a pasted email`,
      });
    }
    if (req.duplicateDecision) {
      const d = req.duplicateDecision;
      const action = d.choice === "override" ? "duplicate_override" : d.choice === "extend" ? "duplicate_extend" : "duplicate_use_existing";
      audit(ctx, {
        requestId: req.id,
        at: plusMinutes(req.createdAt, 4),
        actorId: req.requestorId,
        action,
        detail:
          d.choice === "override"
            ? `Possible duplicate ${d.matchCode} ${d.matchName} (${Math.round(d.score * 100)}%) overridden: “${d.justification ?? ""}”`
            : `Possible duplicate ${d.matchCode} ${d.matchName} (${Math.round(d.score * 100)}%) → requested an extension instead`,
      });
    }
    audit(ctx, {
      requestId: req.id,
      at: req.submittedAt!,
      actorId: req.requestorId,
      action: "submitted",
      detail: `Submitted · ${req.steps.length} approval steps · expected by ${req.expectedBy!.slice(0, 10)}`,
      after: maskedSnapshot(domain, req.data),
    });

    for (const s of req.steps) {
      if (!s.activatedAt) continue;
      const pendingNow = s.status === "pending";
      // Approval request to whoever held the step.
      if (pendingNow) notifyApprover(ctx, req, s, s.activatedAt, false);
      else {
        notify(ctx, {
          at: s.activatedAt,
          toId: s.assigneeId,
          channel: "teams",
          kind: "approval",
          title: `Approval requested · ${req.id}`,
          body: `${requestor} needs your approval: ${req.title}. Your step: ${s.label}.`,
          requestId: req.id,
          stepId: s.id,
          read: true,
        });
      }
      if (s.reminderSentAt) {
        audit(ctx, {
          requestId: req.id,
          at: s.reminderSentAt,
          actorId: SYSTEM_ACTOR_ID,
          action: "reminder",
          detail: `Reminder sent to ${nameOf(ctx, s.assigneeId)} · ${s.label}`,
        });
        notify(ctx, {
          at: s.reminderSentAt,
          toId: s.assigneeId,
          channel: "teams",
          kind: "reminder",
          title: `Reminder · ${req.id} is waiting on you`,
          body: `${req.title} has been with you for 1 business day. The step escalates to your manager after 3.`,
          requestId: req.id,
          stepId: s.id,
          read: false,
        });
      }
      if (s.status === "approved" && s.decidedAt) {
        audit(ctx, {
          requestId: req.id,
          at: s.decidedAt,
          actorId: s.assigneeId,
          action: "approved",
          detail: s.comment ? `${s.label} · “${s.comment}”` : s.label,
        });
      }
      if (s.status === "rejected" && s.decidedAt) {
        audit(ctx, {
          requestId: req.id,
          at: s.decidedAt,
          actorId: s.assigneeId,
          action: "rejected",
          detail: `${s.label} · “${s.comment ?? ""}”`,
        });
        for (const channel of ["teams", "outlook"] as const) {
          notify(ctx, {
            at: s.decidedAt,
            toId: req.requestorId,
            channel,
            kind: "rejected",
            title: `${req.id} was rejected`,
            body: `${nameOf(ctx, s.assigneeId)} rejected ${req.title}: “${s.comment ?? ""}”`,
            requestId: req.id,
            stepId: s.id,
            read: true,
          });
        }
      }
      if (s.status === "question" && s.question) {
        audit(ctx, {
          requestId: req.id,
          at: s.question.askedAt,
          actorId: s.assigneeId,
          action: "question",
          detail: `${s.label} · “${s.question.text}”`,
        });
        for (const channel of ["teams", "outlook"] as const) {
          notify(ctx, {
            at: s.question.askedAt,
            toId: req.requestorId,
            channel,
            kind: "question",
            title: `${nameOf(ctx, s.assigneeId)} has a question on ${req.id}`,
            body: `“${s.question.text}” The step's SLA clock is paused until you answer.`,
            requestId: req.id,
            stepId: s.id,
            read: false,
          });
        }
      }
    }

    // All business approvals done → requestor hears it's with MDM.
    const mdmStep = req.steps.find((s) => s.role === "mdm");
    if (mdmStep?.activatedAt && (req.status === "mdm_review" || req.status === "created")) {
      notify(ctx, {
        at: mdmStep.activatedAt,
        toId: req.requestorId,
        channel: "teams",
        kind: "info",
        title: `${req.id} is fully approved`,
        body: `All business approvals are done. ${nameOf(ctx, mdmStep.assigneeId)} (MDM) is doing the final check before creating it in SAP B1.`,
        requestId: req.id,
        read: Date.parse(mdmStep.activatedAt) < readBefore,
      });
    }

    if (req.status === "created" && req.sapCreatedAt && req.sapCode) {
      const mdmId = mdmStep?.assigneeId ?? "priya";
      audit(ctx, { requestId: req.id, at: req.dtwGeneratedAt!, actorId: mdmId, action: "dtw_generated", detail: `DTW import file generated for ${req.sapCode}` });
      audit(ctx, { requestId: req.id, at: req.sapCreatedAt, actorId: mdmId, action: "created_in_sap", detail: `${req.sapCode} created in SAP B1 via DTW import` });
      for (const channel of ["teams", "outlook"] as const) {
        notify(ctx, {
          at: req.sapCreatedAt,
          toId: req.requestorId,
          channel,
          kind: "created",
          title: `${req.sapCode} is live in SAP B1`,
          body: `Your customer ${req.sapCode} is live in SAP B1 — ${recordName(req.domainId, req.data)}'s ${req.blockedPrIds.join(" and ")} can now be converted.`,
          requestId: req.id,
          read: false,
        });
      }
    }

    if (req.status === "cancelled" && req.closedAt) {
      audit(ctx, { requestId: req.id, at: req.closedAt, actorId: req.requestorId, action: "cancelled", detail: RECENT.find((r) => r.id === req.id)?.cancelReason ?? "Cancelled by the requestor" });
      for (const s of req.steps.filter((x) => x.activatedAt)) {
        notify(ctx, {
          at: req.closedAt,
          toId: s.assigneeId,
          channel: "teams",
          kind: "info",
          title: `${req.id} was withdrawn`,
          body: `${requestor} withdrew ${req.title}. No action needed.`,
          requestId: req.id,
          read: true,
        });
      }
    }
  }

  // Wei Jie checked REQ-1038's bank details while reviewing.
  const r1038 = reqs.find((r) => r.id === "REQ-1038");
  const fin = r1038?.steps.find((s) => s.role === "finance");
  if (r1038 && fin?.activatedAt) {
    audit(ctx, {
      requestId: r1038.id,
      at: snapNearOffice(later(ago(ctx, 0.3), plusMinutes(fin.activatedAt, 30)), 22, plusMinutes(fin.activatedAt, 15), plusMinutes(ctx.now, -5)),
      actorId: fin.assigneeId,
      action: "sensitive_revealed",
      detail: "Revealed Bank account no. (masked by default)",
    });
  }
}

// =============================================================================================
// Purchase requests
// =============================================================================================

interface PrSpec {
  id: string;
  ago: number; // business days
  customer: string;
  country: CountryCode;
  entity: string;
  product: ProductGroup;
  item: string;
  units: number;
  sgd: number;
  status: PurchaseRequest["status"];
  blockedBy?: string;
  /** customer / item not yet set up while blocked */
  missing?: "customer" | "item";
}

/** Amy's live demo item name; the seeded PRs above wait on it and auto-link when her request is submitted. */
export const K2EDTA_ITEM = "K2EDTA Blood Collection Tube 4 mL, 100/pk";

const RECENT_PRS: PrSpec[] = [
  { id: "PR-5493", ago: 9.0, customer: "Harbourfront Specialist Clinic", country: "SG", entity: "SPD", product: "A", item: "Troponin I Rapid Test 20T", units: 60, sgd: 5760, status: "open" },
  { id: "PR-5496", ago: 7.5, customer: "Klinik Seri Ampang", country: "MY", entity: "SPD", product: "A", item: "Malaria Pf/Pan Ag Rapid Test 25T", units: 300, sgd: 11400, status: "open" },
  { id: "PR-5498", ago: 6.0, customer: "Saigon Precision Lab JSC", country: "VN", entity: "QTG", product: "B", item: "Pipette Tips 200 µL, Filtered (960s)", units: 90, sgd: 7920, status: "open" },
  { id: "PR-5500", ago: 5.0, customer: "Khon Kaen Provincial Lab", country: "TH", entity: "SPD", product: "A", item: "CRP Latex Reagent 2×50 mL", units: 150, sgd: 7800, status: "open" },
  { id: "PR-5501", ago: 4.4, customer: "Novena Diagnostics Lab Pte Ltd", country: "SG", entity: "SPD", product: "A", item: "Hepatitis B sAg Rapid Test 40T", units: 120, sgd: 5280, status: "open", blockedBy: "REQ-1032" },
  { id: "PR-5503", ago: 3.8, customer: "Mandalay City Hospital", country: "MM", entity: "QTG", product: "B", item: "Conical Centrifuge Tubes 50 mL, Sterile (500s)", units: 100, sgd: 11600, status: "blocked", blockedBy: "REQ-1034", missing: "item" },
  { id: "PR-5506", ago: 3.6, customer: "Johor Straits Medical Centre", country: "MY", entity: "QTS", product: "C", item: "Benchtop Centrifuge CF-16R", units: 2, sgd: 19600, status: "open" },
  { id: "PR-5508", ago: 3.5, customer: "Kallang Community Hospital", country: "SG", entity: "SPD", product: "A", item: "Influenza A/B Antigen Rapid Test 20T", units: 520, sgd: 16900, status: "blocked", blockedBy: "REQ-1036", missing: "item" },
  { id: "PR-5510", ago: 3.4, customer: "Da Nang Coastal Hospital", country: "VN", entity: "QTS", product: "C", item: "Haematology Analyser 5-Part Diff HX-560", units: 1, sgd: 58000, status: "blocked", blockedBy: "REQ-1035", missing: "item" },
  { id: "PR-5512", ago: 3.2, customer: "Bangkok Riverside Hospital", country: "TH", entity: "QTS", product: "C", item: "Chemistry Analyser CX-240", units: 1, sgd: 64800, status: "blocked", blockedBy: "REQ-1038", missing: "customer" },
  { id: "PR-5513", ago: 3.1, customer: "Bangkok Riverside Hospital", country: "TH", entity: "QTS", product: "A", item: "CX-240 Reagent Starter Pack", units: 60, sgd: 12600, status: "blocked", blockedBy: "REQ-1038", missing: "customer" },
  { id: "PR-5515", ago: 3.0, customer: "Chiang Mai Hillside Hospital", country: "TH", entity: "QTG", product: "B", item: "Conical Centrifuge Tubes 50 mL, Sterile (500s)", units: 80, sgd: 9400, status: "blocked", blockedBy: "REQ-1034", missing: "item" },
  { id: "PR-5516", ago: 2.9, customer: "Yangon Northpoint Diagnostics", country: "MM", entity: "SPD", product: "A", item: "Chikungunya IgM Rapid Test 30T", units: 110, sgd: 4510, status: "open" },
  { id: "PR-5517", ago: 2.8, customer: "Tampines Family Clinic Group", country: "SG", entity: "SPD", product: "A", item: "Influenza A/B Antigen Rapid Test 20T", units: 240, sgd: 7800, status: "blocked", blockedBy: "REQ-1036", missing: "item" },
  { id: "PR-5519", ago: 2.6, customer: "Hanoi Central Lab", country: "VN", entity: "SPD", product: "A", item: "HbA1c Reagent Kit 100T", units: 160, sgd: 22400, status: "blocked", blockedBy: "REQ-1040", missing: "customer" },
  { id: "PR-5521", ago: 2.4, customer: "Sungai Permai Medical Centre", country: "MY", entity: "SPD", product: "A", item: "Dengue IgG/IgM Combo 30T", units: 1800, sgd: 48600, status: "blocked", blockedBy: "REQ-1042", missing: "item" },
  { id: "PR-5523", ago: 2.3, customer: "Kent Ridge BioLabs Pte Ltd", country: "SG", entity: "QTG", product: "B", item: "Cryovials 2 mL, Sterile (100s)", units: 200, sgd: 9200, status: "open" },
  { id: "PR-5527", ago: 2.2, customer: "Pulau Mutiara General Hospital", country: "MY", entity: "SPD", product: "A", item: "Dengue IgG/IgM Combo 30T", units: 800, sgd: 21400, status: "blocked", blockedBy: "REQ-1042", missing: "item" },
  { id: "PR-5529", ago: 1.5, customer: "Bangkok Metro Lab", country: "TH", entity: "SPD", product: "A", item: "HbA1c Reagent Kit 100T", units: 80, sgd: 11200, status: "open" },
  { id: "PR-5531", ago: 0.8, customer: "Sungai Permai Medical Centre", country: "MY", entity: "QTS", product: "C", item: "Coagulation Analyser CG-90", units: 1, sgd: 26500, status: "blocked", blockedBy: "REQ-1043", missing: "customer" },
  { id: "PR-5533", ago: 0.6, customer: "Yangon Asia Royal Clinic", country: "MM", entity: "QTG", product: "B", item: "Microcentrifuge Tubes 1.5 mL (500s)", units: 140, sgd: 9800, status: "blocked", blockedBy: "REQ-1044", missing: "customer" },
  // Amy's live demo item (App C): orders already waiting for an item code that doesn't exist yet. No MDM request
  // covers them, so they are blocked with no blockedByRequestId until her request is submitted (auto-link).
  { id: "PR-5534", ago: 4.2, customer: "Sungai Permai Medical Centre", country: "MY", entity: "SPD", product: "B", item: K2EDTA_ITEM, units: 120, sgd: 14400, status: "blocked", missing: "item" },
  { id: "PR-5536", ago: 2.7, customer: "Mount Faber Specialist Clinic", country: "SG", entity: "SPD", product: "B", item: K2EDTA_ITEM, units: 80, sgd: 9600, status: "blocked", missing: "item" },
  { id: "PR-5538", ago: 1.2, customer: "Thomson Road Diagnostic Lab", country: "SG", entity: "SPD", product: "B", item: K2EDTA_ITEM, units: 100, sgd: 12000, status: "blocked", missing: "item" },
  { id: "PR-5535", ago: 0.4, customer: "Hue Central Diagnostics", country: "VN", entity: "SPD", product: "A", item: "Malaria Pf/Pan Ag Rapid Test 25T", units: 200, sgd: 7600, status: "open" },
];

function buildPrs(ctx: Ctx, historical: MdmRequest[], recent: MdmRequest[], sapRecords: SapRecord[]): PurchaseRequest[] {
  const customerCode = new Map<string, string>();
  const itemCode = new Map<string, string>();
  for (const r of sapRecords) {
    if (r.object === "oBusinessPartners" && r.fields.CardType === "cCustomer") customerCode.set(r.name, r.code);
    if (r.object === "oItems") itemCode.set(r.name, r.code);
  }

  const prs: PurchaseRequest[] = [];

  // Converted PRs: each was waiting on a historical request, then released and converted to a sales order.
  const itemPrices = new Map<string, number>([
    ...BASELINE_ITEMS.map((i) => [i.name, i.price] as [string, number]),
    ...historical.filter((r) => r.domainId === "item").map((r) => [String(r.data.itemName), Number(r.data.salesPrice)] as [string, number]),
  ]);
  const existedBy = (r: SapRecord, iso: string) => Date.parse(r.createdAt) <= Date.parse(iso);
  const custByEntity = (entity: string, asOf: string, country?: CountryCode) =>
    sapRecords.filter(
      (r) =>
        r.object === "oBusinessPartners" &&
        r.fields.CardType === "cCustomer" &&
        r.code !== "C-SG-00017" &&
        existedBy(r, asOf) &&
        (r.fields.U_Entities ?? r.fields.U_Entity ?? "").split(",").map((s) => s.trim()).includes(entity) &&
        (!country || r.fields["BPAddresses.Country"] === country),
    );
  const itemsByEntity = (entity: string, asOf: string) =>
    sapRecords.filter((r) => r.object === "oItems" && (r.fields.U_Entity ?? "") === entity && existedBy(r, asOf));

  const sources = historical.filter((r) => r.domainId === "customer" || r.domainId === "item").filter((_, i) => i % 2 === 0).slice(0, 10);
  const converted: PurchaseRequest[] = sources.map((req) => {
    const createdAt = snapNearOffice(
      addBusinessDays(req.createdAt, -(0.3 + 0.6 * ctx.rng())),
      5 + Math.floor(ctx.rng() * 50),
      undefined,
      plusMinutes(req.createdAt, -30),
    );
    if (req.domainId === "customer") {
      const items = itemsByEntity(req.entity, createdAt);
      const it = items[Math.floor(ctx.rng() * items.length) % Math.max(1, items.length)];
      const price = itemPrices.get(it?.name ?? "") ?? 50;
      const units = price > 5000 ? 1 : 40 + Math.floor(ctx.rng() * 16) * 10;
      return {
        id: "",
        customerName: String(req.data.customerName),
        customerCode: req.sapCode,
        country: req.country,
        entity: req.entity,
        product: (it?.fields.ItemsGroupCode as ProductGroup) ?? "A",
        itemName: it?.name ?? "HbA1c Reagent Kit 100T",
        itemCode: it?.code,
        units,
        sgd: Math.round(units * price),
        createdAt,
        status: "converted" as const,
        blockedByRequestId: req.id,
      };
    }
    const country = (String(req.data.countries ?? "").split(",")[0]?.trim() || req.country) as CountryCode;
    const custs = custByEntity(req.entity, createdAt, country);
    const pool = custs.length ? custs : custByEntity(req.entity, createdAt);
    const c = pool[Math.floor(ctx.rng() * pool.length) % Math.max(1, pool.length)];
    const price = Number(req.data.salesPrice) || 50;
    const units = price > 5000 ? 1 : 60 + Math.floor(ctx.rng() * 20) * 10;
    return {
      id: "",
      customerName: c?.name ?? "Sungai Permai Medical Centre",
      customerCode: c?.code ?? "C-MY-00031",
      country: (c?.fields["BPAddresses.Country"] as CountryCode) ?? req.country,
      entity: req.entity,
      product: (String(req.data.productGroup) as ProductGroup) || "A",
      itemName: String(req.data.itemName),
      itemCode: req.sapCode,
      units,
      sgd: Math.round(units * price),
      createdAt,
      status: "converted" as const,
      blockedByRequestId: req.id,
    };
  });
  converted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  converted.forEach((pr, i) => {
    pr.id = `PR-${5440 + i * 5 + Math.floor(ctx.rng() * 3)}`;
    const req = historical.find((r) => r.id === pr.blockedByRequestId);
    if (req) req.blockedPrIds = [...req.blockedPrIds, pr.id];
  });
  prs.push(...converted);

  // Recent PRs: open pipeline and demand stuck behind in-flight MDM requests.
  const all = [...historical, ...recent];
  for (const s of RECENT_PRS) {
    const blocker = s.blockedBy ? all.find((r) => r.id === s.blockedBy) : undefined;
    const released = blocker?.status === "created";
    const pr: PurchaseRequest = {
      id: s.id,
      customerName: s.customer,
      country: s.country,
      entity: s.entity,
      product: s.product,
      itemName: s.item,
      units: s.units,
      sgd: s.sgd,
      createdAt: snapNearOffice(ago(ctx, s.ago), 5 + Math.floor(ctx.rng() * 50), undefined, plusMinutes(ctx.now, -30)),
      status: s.status,
    };
    const cc = customerCode.get(s.customer);
    const ic = itemCode.get(s.item);
    if (cc && !(s.missing === "customer" && !released)) pr.customerCode = cc;
    if (ic && !(s.missing === "item" && !released)) pr.itemCode = ic;
    if (s.blockedBy) pr.blockedByRequestId = s.blockedBy;
    prs.push(pr);
  }
  return prs;
}

// =============================================================================================
// Entry point
// =============================================================================================

/**
 * Build the demo world relative to nowIso. Deterministic for a given nowIso and config.
 * Every timestamp is ≤ nowIso; the audit chain is ordered by time and verifies.
 */
export function buildSeed(nowIso: string, config: AppConfig = DEFAULT_CONFIG): SeedData {
  const ctx: Ctx = { now: nowIso, config, rng: mulberry32(20261028), events: [], notifications: [], nid: 0 };

  const sapRecords = baselineSapRecords();
  const historical = buildHistorical(ctx, [...LEGACY_CODE_FLOORS, ...sapRecords.map((r) => r.code)], sapRecords);

  const codes = [...LEGACY_CODE_FLOORS, ...sapRecords.map((r) => r.code), ...historical.map((r) => r.sapCode ?? "")];
  const recent = buildRecent(ctx, codes, sapRecords);
  auditAndNotifyRecent(ctx, recent);

  const prs = buildPrs(ctx, historical, recent, sapRecords);

  // Config go-live is the first audited event.
  const goLive = config.history[0];
  if (goLive) {
    ctx.events.push({
      requestId: "CONFIG",
      at: goLive.at,
      actorId: goLive.byId,
      action: "config_changed",
      detail: `v${goLive.version} · ${goLive.summary}`,
      after: { version: goLive.version },
    });
  }

  // Chain events in time order (stable for ties).
  const ordered = ctx.events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => Date.parse(a.e.at) - Date.parse(b.e.at) || a.i - b.i)
    .map((x) => x.e);
  let chain: AuditEvent[] = [];
  for (const e of ordered) chain = appendAudit(chain, e);

  const notifications = [...ctx.notifications].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const requests = [...historical, ...recent].sort((a, b) => a.id.localeCompare(b.id));

  return { requests, prs, audit: chain, notifications, sapRecords };
}

/** Next free request number after the seeded ids. */
export function nextRequestNumber(requests: Pick<MdmRequest, "id">[]): number {
  let max = 1000;
  for (const r of requests) {
    const m = /^REQ-(\d+)$/.exec(r.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}
