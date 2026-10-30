/**
 * Tesseract shared contract. Every module codes against these types.
 * Change only via the lead integrator — parallel builders must not edit this file.
 */

// ---------- Reference data ----------
export type CountryCode = "SG" | "MY" | "TH" | "VN" | "MM";
export const COUNTRIES: { code: CountryCode; name: string; tz: string; utcOffset: string; fyStartMonth: number }[] = [
  { code: "SG", name: "Singapore", tz: "Asia/Singapore", utcOffset: "UTC+8", fyStartMonth: 4 },
  { code: "MY", name: "Malaysia", tz: "Asia/Kuala_Lumpur", utcOffset: "UTC+8", fyStartMonth: 1 },
  { code: "TH", name: "Thailand", tz: "Asia/Bangkok", utcOffset: "UTC+7", fyStartMonth: 10 },
  { code: "VN", name: "Vietnam", tz: "Asia/Ho_Chi_Minh", utcOffset: "UTC+7", fyStartMonth: 1 },
  { code: "MM", name: "Myanmar", tz: "Asia/Yangon", utcOffset: "UTC+6:30", fyStartMonth: 4 },
];

/** Business entities / BUs. SPD, QTS, QTG are seeded; admins can add more (e.g. Marcus's new BU). */
export type EntityCode = string;
export type ProductGroup = "A" | "B" | "C";
export const PRODUCT_LABELS: Record<ProductGroup, string> = {
  A: "Product A · IVD reagents & test kits",
  B: "Product B · Lab consumables",
  C: "Product C · Instruments & equipment",
};

export type RoleId =
  | "requestor"
  | "bu_head"
  | "sales_manager"
  | "business_support"
  | "finance"
  | "finance_director"
  | "financial_controller"
  | "procurement"
  | "qa_ra"
  | "mdm"
  | "admin";

export interface Person {
  id: string; // e.g. "amy"
  name: string; // "Amy Lim"
  title: string; // "Product Manager, SPD"
  roles: RoleId[];
  entity: EntityCode;
  country: CountryCode;
  email: string; // fictional, e.g. amy.lim@livesgroup.example
  /** Shown in the persona switcher */
  persona: boolean;
  /** Out-of-office delegate (person id) */
  delegateId?: string;
  outOfOffice?: boolean;
  managerId?: string; // escalation target
  avatarColor: string; // tailwind-safe hex
}

// ---------- Config (admin-editable, versioned) ----------
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "select"
  | "date"
  | "file"
  | "country"
  | "entity";

export type ConditionOp = "equals" | "in" | "gt" | "isEmpty" | "notEmpty";
export interface Condition {
  field: string; // field key in request.data
  op: ConditionOp;
  value?: string | number | string[];
}

export interface FieldDef {
  key: string; // camelCase, unique within domain
  label: string;
  type: FieldType;
  required: boolean;
  /** Field becomes required when this condition holds (e.g. category in [IVD, Medical device] -> regLicenceNo) */
  requiredIf?: Condition;
  /** Field only shown when this condition holds */
  showIf?: Condition;
  options?: string[];
  pattern?: string; // regex source
  patternHint?: string;
  maxLength?: number; // mirror SAP field sizes, e.g. CardName 100
  sensitive?: boolean; // bank details, credit limit, payment terms
  /** SAP B1 technical field this maps to in DTW, e.g. "CardName" or "BPBankAccounts.AccountNo" */
  sapField?: string;
  helpText?: string;
  section?: string; // UI grouping
}

export interface StepDef {
  id: string;
  label: string; // "Business Support — address & tax ID"
  role: RoleId;
  /** Step only included when condition holds (e.g. creditLimit gt 50000 -> finance_director) */
  condition?: Condition;
}

export interface StageDef {
  id: string;
  label: string;
  /** parallel: all steps active at once; sequential: steps one after another */
  mode: "parallel" | "sequential";
  steps: StepDef[];
}

export interface DomainConfig {
  id: string; // "customer" | "vendor" | "item" | "costcentre" | "extend" | custom
  label: string; // "New Customer"
  description: string;
  icon: string; // lucide icon name
  sapObject: string; // DTW object e.g. "oBusinessPartners", "oItems", "oProfitCenter"
  codePrefix: string; // "C" | "V" | "I" | "CC"
  fields: FieldDef[];
  /** Stages run in order; MDM final check is always appended by the engine */
  stages: StageDef[];
  dupCheck: boolean;
  enabled: boolean;
}

export interface BusinessUnit {
  id: EntityCode; // "SPD"
  name: string; // "SPD — Diagnostics"
  description: string;
  mainProduct: ProductGroup | null;
  /** Who fills each role for requests raised in this BU */
  roleAssignments: Partial<Record<RoleId, string>>;
  /** Extra stages appended (before MDM) for every request in this BU, e.g. Marcus's regulatory step */
  extraStages: StageDef[];
}

export interface SlaConfig {
  stepBusinessDays: number; // 2
  reminderAfterBusinessDays: number; // 1
  escalateAfterBusinessDays: number; // 3
}

export interface ConfigChange {
  version: number;
  at: string; // ISO
  byId: string;
  summary: string;
}

export interface AppConfig {
  version: number;
  domains: DomainConfig[];
  businessUnits: BusinessUnit[];
  people: Person[];
  sla: SlaConfig;
  history: ConfigChange[];
}

// ---------- Requests & approvals ----------
export type RequestStatus =
  | "draft"
  | "in_approval"
  | "needs_info" // an approver asked a question; clock paused on that step
  | "rejected"
  | "mdm_review" // all business approvals done; waiting on MDM final check
  | "created" // created in SAP B1
  | "cancelled";

export type StepStatus = "waiting" | "pending" | "approved" | "rejected" | "question" | "skipped";

export interface StepQuestion {
  text: string;
  askedAt: string;
  answer?: string;
  answeredAt?: string;
}

export interface ApprovalStep {
  id: string;
  stageId: string;
  stageLabel: string;
  stageIndex: number;
  stageMode: "parallel" | "sequential";
  role: RoleId;
  label: string;
  assigneeId: string;
  /** Set when a delegate/escalation took over */
  originalAssigneeId?: string;
  status: StepStatus;
  activatedAt?: string;
  decidedAt?: string;
  comment?: string;
  reminderSentAt?: string;
  escalatedAt?: string;
  /** total ms the SLA clock was paused (questions) */
  pausedMs: number;
  pausedAt?: string;
  question?: StepQuestion;
  /** reason the step was added, e.g. "Category = IVD → QA/RA required" */
  addedBecause?: string;
}

export type DuplicateChoice = "use_existing" | "extend" | "override";
export interface DuplicateDecision {
  matchCode: string; // existing SAP code e.g. C-SG-00017
  matchName: string;
  score: number; // 0..1
  reasons: string[];
  choice: DuplicateChoice;
  justification?: string;
}

export type FieldValue = string | number | null;

export interface MdmRequest {
  id: string; // "REQ-1042"
  domainId: string;
  title: string; // e.g. "New Item: Dengue NS1 Ag Rapid Test 25T"
  requestorId: string;
  entity: EntityCode;
  country: CountryCode;
  createdAt: string;
  submittedAt?: string;
  status: RequestStatus;
  data: Record<string, FieldValue>;
  configVersion: number;
  steps: ApprovalStep[];
  duplicateDecision?: DuplicateDecision;
  /** Filled by paste-to-fill: which fields came from AI extraction */
  aiFilledKeys?: string[];
  expectedBy?: string; // ISO date from route preview
  dtwGeneratedAt?: string;
  sapCode?: string; // "C-SG-00123"
  sapCreatedAt?: string;
  closedAt?: string;
  /** customer PRs waiting on this record ("stuck demand") */
  blockedPrIds: string[];
  /** seeded history rows are read-only background */
  seeded?: boolean;
}

// ---------- Demand streams (customer side; NOT MDM) ----------
export type MessageKind = "po" | "pr" | "enquiry" | "followup" | "mdm";

export interface PurchaseRequest {
  id: string; // "PR-5521"
  customerName: string;
  customerCode?: string; // missing when the customer isn't set up yet
  country: CountryCode;
  entity: EntityCode;
  product: ProductGroup;
  itemName: string;
  itemCode?: string; // missing when the item isn't set up yet
  units: number;
  sgd: number;
  createdAt: string;
  status: "open" | "blocked" | "converted";
  /** MDM request this PR is waiting on */
  blockedByRequestId?: string;
}

// ---------- Audit (append-only, hash-chained) ----------
export interface AuditEvent {
  seq: number;
  requestId: string; // or "CONFIG" for config changes
  at: string;
  actorId: string;
  action: string; // "submitted" | "approved" | "rejected" | "question" | "answered" | "reminder" | "escalated" | "dtw_generated" | "created_in_sap" | "sensitive_revealed" | "duplicate_override" | "config_changed" ...
  detail?: string;
  before?: Record<string, FieldValue>;
  after?: Record<string, FieldValue>;
  prevHash: string;
  hash: string; // sha256(prevHash + canonical JSON of the event without hash)
}

// ---------- Notifications (rendered as Teams / Outlook mocks) ----------
export interface AppNotification {
  id: string;
  at: string;
  toId: string;
  channel: "teams" | "outlook";
  kind: "approval" | "reminder" | "escalation" | "question" | "answer" | "created" | "rejected" | "info";
  title: string;
  body: string;
  requestId?: string;
  stepId?: string;
  read: boolean;
}

// ---------- SAP B1 (simulated) ----------
export interface SapRecord {
  code: string; // CardCode / ItemCode / PrcCode
  object: string; // "oBusinessPartners" | "oItems" | "oProfitCenter" ...
  name: string;
  createdAt: string;
  requestId?: string;
  /** SAP technical field -> value, as imported via DTW */
  fields: Record<string, string>;
}

/** One DTW template file (header row 1 = SAP field names, row 2 = DB column names, then data) */
export interface DtwFile {
  fileName: string; // e.g. "oBusinessPartners.csv"
  object: string;
  headers: string[]; // SAP field names
  dbHeaders: string[]; // DB column names (2nd header row in DTW templates)
  rows: string[][];
}

// ---------- Master data (seeded, read-only, from analytics/) ----------
export interface CustomerMaster {
  cardCode: string; // C-SG-00017
  cardName: string;
  entity: EntityCode;
  country: CountryCode;
  licTradNum?: string; // tax / UEN
  street?: string;
  zipCode?: string;
  phone1?: string;
  email?: string;
  goldenId: string; // from entity resolution crosswalk
  segment: string; // "Public hospital" | "Private hospital" | "Diagnostic lab" | "Clinic" | "Research/academic" | "Industry"
  hasTransactions: boolean;
}

export interface ItemMaster {
  itemCode: string;
  itemName: string;
  productGroup: ProductGroup;
  category: string; // "IVD reagent" | "Medical device" | "Lab consumable" | "Instrument" ...
  entity: EntityCode;
}

export interface DuplicateMatch {
  record: CustomerMaster;
  score: number; // 0..1
  reasons: string[]; // ["Same tax ID", "93% name match", "Same postcode"]
}
