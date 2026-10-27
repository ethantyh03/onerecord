import type { MessageKind } from "@/lib/types";

/**
 * Inbox triage: transparent rules that separate inbound messages into the three demand streams
 * (PO = demand, PR = pipeline, enquiry = leading indicator) plus follow-ups and MDM setup requests.
 *
 * Method (see analytics/triage/README.md):
 *   1. Pattern detectors fire weighted signals for one class each; every signal carries a reason.
 *   2. Scores are summed per class. The highest score wins; ties break by TRIAGE_PRECEDENCE.
 *   3. confidence = 1 − exp(−margin / 2.5), where margin = top score − runner-up score.
 *
 * Definitions and precedence (mdm > followup > po > pr > enquiry):
 *   - mdm      asks to set up / extend / change a customer, vendor, item or cost-centre record. An explicit
 *              master-data request outweighs an order in the same email (the order cannot be booked until
 *              the record exists), so its weight is larger than a PO number's.
 *   - followup is about an existing order, PO, delivery, invoice, backorder, return or credit note. A PO
 *              number inside such a message is a reference, not a new order.
 *   - po       a confirmed order that carries a PO number.
 *   - pr       intent to buy a specific product/quantity (quote accepted, please proceed, PO to follow) with
 *              no PO number yet.
 *   - enquiry  price / availability / spec / lead-time questions with no commitment (a quantity may be
 *              mentioned hypothetically).
 *
 * Rules were tuned only on analytics/triage/devset.json and src/data/inbox.json.
 */

const INTERNAL_DOMAIN = "livesgroup.example";

/** Tie-break order, most specific first. */
export const TRIAGE_PRECEDENCE: MessageKind[] = ["mdm", "followup", "po", "pr", "enquiry"];

/** Signal weights, in one place so the README and the code agree. */
export const TRIAGE_WEIGHTS = {
  mdmRequest: 8,
  mdmCodeMention: 1,
  internalSender: 1,
  poNumber: 5,
  poNumberExisting: 1,
  poWording: 1,
  quantity: 0.5,
  commitment: 3,
  poToFollow: 2,
  reorder: 2,
  supplyRequest: 2,
  enquiryTopic: 2,
  enquiryTopicExtra: 1,
  question: 1,
  noCommitment: 2,
  followDelivery: 3,
  followProblem: 3,
  followAmend: 3,
  followDocs: 3,
  followBilling: 2,
  followSoft: 2,
  mdmHint: 3,
  followReference: 2,
} as const;

// ---------------------------------------------------------------- detectors

/** PO-number candidates. The number token must carry ≥3 digits (so "PO to follow", "PO Box" do not count). */
const PO_CAND_RE =
  /\b(L?PO|P\.\s?O\.?|purchase\s+order)(?:\s*(?:no\.?|number|num\.?|#)(?=[\s#:.\-\d]))?(?:\s*is\b)?\s*[#:.\-/]?\s*([A-Z0-9][A-Z0-9/\-]*)/gi;
const QTY_RE =
  /\b(\d{1,3}(?:,\d{3})+|\d{1,6})\s*(boxes|box|bx|kits?|units?|pcs|pieces|pk|packs?|cartons?|ctns?|cases?|bottles?|btls?|vials?|tests?|sets?|ea|nos|cartridges?|strips?|tubes?|rolls?|x)(?=\s|[.,;:)!?]|$)/i;
const QTY_LABEL_RE = /\b(?:qty|quantity)\.?\s*[:=]?\s*(\d{1,6})\b/i;
const SKU_RE = /\b[IV]-[A-Z]{1,2}-\d{5,6}\b|\bcat(?:alog(?:ue)?)?\.?\s*(?:no\.?|#)\s*[:]?\s*[A-Z0-9][A-Z0-9-]{3,}/i;

const PO_WORDING_RE =
  /\b(?:(?:please|pls|kindly)\s+(?:find|see)\b|attached\s+(?:is\s+)?(?:our\s+)?(?:L?PO|P\.O|purchase\s+order)|(?:please|pls|kindly)\s+(?:process|supply|accept|acknowledge)|as\s+per\s+(?:our\s+)?(?:L?PO|purchase\s+order)|confirm(?:ed)?\s+(?:our\s+)?order|pleased\s+to\s+issue|issue[sd]?\s+(?:our\s+)?(?:PO|purchase\s+order)|ship\s+to|deliver(?:y)?\s+to)\b/i;

const COMMIT_RE =
  /\b(?:accept(?:ed|ing)?\s+(?:your\s+|the\s+|this\s+|our\s+)?(?:quot(?:e|ation)|offer|proposal)|quot(?:e|ation)\b[^.\n]{0,40}?\b(?:accepted|approved|is\s+(?:fine|ok(?:ay)?|acceptable)|ok)\b|agree(?:d)?\s+(?:with\s+)?(?:the\s+|your\s+)?(?:price|offer|quot(?:e|ation))|setuju|(?:intend|plan|would\s+like|['’]d\s+like|wish|wants?|ready|decided|going)\s+to\s+(?:place\s+(?:an?\s+)?order|order|purchase|buy|proceed|take)|(?:please|pls|kindly|can)\s+(?:proceed|go\s+ahead)|go\s+ahead\s+with|go\s+with\s+(?:this|the|your)\s+(?:quot(?:e|ation)|offer)|proceed\s+with|(?:we\s+)?(?:will|confirm\s+we\s+will)\s+take\s+(?:\d|them|it|the)|(?:please|pls|kindly)\s+(?:book|reserve|hold)|confirm(?:ing)?\s+(?:our\s+|the\s+)?(?:quot(?:e|ation)|intent|order\s+intent)|confirm\s+to\s+(?:buy|purchase|order)|(?:can|may|could)\s+(?:i|we)\s+(?:order|buy|purchase|place\s+(?:an?\s+)?order)|(?:we\s+|i\s+)?(?:will|['’]ll)\s+(?:order|buy|purchase)\b|place\s+(?:an?\s+)?order\s+for)/i;
const PO_TO_FOLLOW_RE =
  /\b(?:(?:L?PO|P\.O\.?|purchase\s+order|official\s+L?O)(?:\s+(?:no\.?|number))?\s+(?:will|to\s+follow|follows|coming|menyusul|in\s+progress|issuance|pending|is\s+being|being|later|tmr|tomorrow|next\s+week|soon)|(?:raise|issue|send|release|give)\w*\s+(?:the\s+|our\s+|a\s+|an\s+)?(?:official\s+)?(?:L?PO|L?O|purchase\s+order)\b(?!\s*(?:no\.?|number|#)?\s*[:#\-]?\s*[A-Z0-9/\-]*\d)|(?:our|the)\s+PO\s+is\s+(?:released|approved|ready|issued))/i;
const REORDER_RE = /\b(?:re-?order|repeat\s+order|same\s+(?:items?|order|as\s+(?:last|before|previous))|as\s+(?:per\s+)?(?:last|previous)\s+(?:order|time|month))\b/i;
const SUPPLY_REQ_RE = /\b(?:please|pls|kindly)\s+(?:supply|deliver|send|arrange)\s+(?:us\s+)?(?:\d|the\s+following)/i;

const ENQUIRY_RE =
  /\b(?:price|prices|pricing|harga|how\s+much|cost(?!\s+cent)|discount|quot(?:e|ation)\s+(?:for|request|me)|quote\s+me|RFQ|request\s+for\s+quot(?:e|ation)|(?:send|share|give|bagi|provide)\s+(?:us\s+|me\s+)?(?:a\s+|the\s+|your\s+|latest\s+)?(?:quot(?:e|ation)|price\s+list|brochure|catalog(?:ue)?|IFU|datasheet|specs?)|price\s+list|availability|available|in\s+stock|got\b[^.?\n]{0,40}\bstock|have\s+stock|stock\s+for|lead\s+time|how\s+long|brochure|catalog(?:ue)?|IFU|datasheet|spec(?:ification)?s?|compatib(?:le|ility)|shelf\s+life|demo|MOQ|minimum\s+order|payment\s+terms|registration\s+status|do\s+you\s+(?:also\s+)?(?:carry|have|supply|distribute|sell|offer|stock)|(?:can|could)\s+(?:you\s+)?supply|may\s+I\s+know|(?:would\s+like|want)\s+to\s+(?:know|ask|enquire|inquire|check)|nak\s+tanya|enquir(?:y|e)|inquir(?:y|e)|interested|evaluating|comparing)\b/gi;
const NO_COMMIT_RE =
  /\b(?:if\s+(?:we|i)?\s*(?:order|buy|take|purchase|need)|not\s+(?:an?\s+)?order\s+yet|not\s+(?:yet\s+)?decided|before\s+we\s+(?:consider|decide|commit)|indicative|budget(?:ary)?\s+(?:planning|quote|pricing|price)|preparing\s+(?:\d{4}\s+|our\s+|the\s+)?budget|considering|comparing\s+suppliers)\b/i;
const QUESTION_START_RE = /(?:^|[.!\n]\s*)(?:do|does|can|could|would|is|are|what|how|which|may|any)\b[^.\n]{3,}/i;

const FU_DELIVERY_RE =
  /\b(?:when\s+(?:will|can|do|you)\b[^?\n.]{0,60}?\b(?:deliver(?:ed|y)?|arrive|reach|come|ship(?:ped)?|dispatch(?:ed)?)|deliver(?:y|ed)?\s+status|(?:been|be)\s+(?:delivered|shipped|dispatched)|not\s+(?:yet\s+)?(?:receive[d]?|arrived?|delivered|come)\b|(?:not\s+yet|never|still\s+(?:not|never))\s+(?:receive[d]?|arrive[d]?|come|came|deliver(?:ed)?)|(?:haven['’]?t|have\s+not|hasn['’]?t|has\s+not|didn['’]?t|did\s+not|yet\s+to)\s+(?:yet\s+)?(?:got|get|gotten|receive[d]?|arrive[d]?|come)|still\s+waiting|any\s+news|(?:order|PO|delivery|shipment)\s+status|expedite|where\s+is\s+(?:my|our|the)\s+(?:order|delivery|shipment|goods|parcel)|tracking(?:\s+(?:no|number))?|ETA|status\s+of\s+(?:our|my|the)\s+(?:order|po|delivery|shipment)|any\s+update\s+on|update\s+(?:us\s+)?on\s+(?:the\s+)?(?:delivery|status|our\s+order)|overdue|was\s+due|due\s+last|chasing|deliver(?:y|ed)?\s+(?:late|delay(?:ed)?)|delayed)\b/i;
const FU_PROBLEM_RE =
  /\b(?:back\s*-?\s*order(?:ed|s)?|partial(?:ly)?|received\s+only|only\s+received|only\s+(?:half|part)|\d+\s+out\s+of\s+\d+|missing|short\s+(?:delivery|supply|shipment)|defective|faulty|expired|not\s+working|refund|complain(?:t)?|short[- ]?(?:shipped|delivered|supplied)|balance\s+(?:when|qty|quantity|items?|boxes)|remaining\s+(?:boxes|items|qty|quantity|units|goods)|damaged|broken|leaking|wrong\s+(?:item|product|size|qty|quantity|unit\s+price|price|amount|batch)|received\s+wrong|does\s+not\s+match|mismatch|discrepanc(?:y|ies)|exchange|replace(?:ment)?|return(?:ed|ing)?|pick\s*-?\s*up|short\s+expiry|expiry\s+only|near\s+expiry|recall)\b/i;
const FU_AMEND_RE = /\b(?:amend|revise|change|cancel|update)\w*\s+(?:our\s+|the\s+|this\s+|my\s+)?(?:L?PO|P\.O\.?|purchase\s+order|order|SO|sales\s+order)\b/i;
const FU_DOCS_RE =
  /\b(?:delivery\s+order|DO[-#]?\s?\d{3,}|COA|certificate\s+of\s+analysis|(?:shipment|goods|batch|delivery|items?|kits?|boxes)\s+(?:received|delivered|arrived)|(?:received|delivered)\s+(?:this\s+morning|yesterday|today|last))\b/i;
const FU_BILLING_RE =
  /\b(?:invoices?|INV[-#]?\s?\d+|credit\s+note|debit\s+note|statement\s+of\s+account|SOA|payment\s+(?:made|done|sent|transferred|for)|(?:made|make)\s+payment|remittance|overcharge[ds]?|reconcile)\b/i;
const FU_REF_RE =
  /\b(?:(?:our|my|the)\s+(?:order|PO|delivery|shipment)\s+(?:last|from|dated|on|of)|(?:order(?:ed)?|we\s+order|delivery|shipment)\s+(?:last|yesterday|this\s+morning)|last\s+(?:order|delivery|shipment)|(?:goods|items)\s+of\s+(?:our\s+)?order|SO[-#]?\s?\d{4,})\b/i;
/** Softer delivery questions: also common inside a brand-new PO, so they only mark a PO number as "existing"
 *  when the message has no quantity and no order wording. */
const FU_SOFT_RE =
  /\b(?:(?:advise|confirm|share|provide|update)\s+(?:us\s+)?(?:on\s+)?(?:the\s+)?deliver(?:y)?\s+(?:date|schedule|time)|deliver(?:y)?\s+date\s+for\s+(?:this|our|the|above)|received\s+our\s+(?:L?PO|order|purchase\s+order))\b/i;
/** "Proforma invoice" is a pre-order document, not a bill on an existing order. */
const PROFORMA_RE = /pro-?\s?forma\s+invoices?|invoices?\s+pro-?\s?forma|pro-?\s?forma/gi;

const MDM_OBJECTS =
  "customer|vendor|supplier|item\\s+code|account|cost\\s+cent(?:re|er)|ship\\s*-?\\s*to|bill\\s*-?\\s*to|delivery\\s+address|billing\\s+address|branch|sales\\s+org|record|customer\\s+code|profile";
const MDM_SETUP_RE = new RegExp(`\\b(?:set\\s*-?\\s*up|create|open|register|add|extend)\\b[^.\\n]{0,40}?\\b(?:${MDM_OBJECTS})\\b`, "i");
const MDM_PHRASE_RE =
  /\b(?:new\s+(?:customer|vendor|supplier|item)\s*(?:code|account|set\s*-?\s*up|creation|registration|record)|(?:customer|vendor|item)\s+code\s+(?:needed|request|required|creation)|vendor\s+(?:master|registration)|master\s+data|new\s+cost\s+cent(?:re|er)|customer\s+(?:set\s*-?\s*up|creation|registration)|open\s+(?:an?\s+)?account|account\s+opening|credit\s+application|KYC)\b/i;
const MDM_ATTRS =
  "bill\\s*-?\\s*to|billing\\s+address|ship\\s*-?\\s*to|delivery\\s+address|(?:company|legal|registered)\\s+name|bank\\s+(?:details|account|info)|contact\\s+(?:person|details|no)|purchasing\\s+contact|(?:tax|GST|SST|VAT)\\s*(?:code|id|no\\.?|number|reg)|registration\\s+(?:no|number)|address|entity|credit\\s+(?:terms|limit)";
const MDM_CHANGE_RE = new RegExp(`\\b(?:update|change|amend|revise|correct|replace|remove)\\w*\\b[^.\\n]{0,50}?\\b(?:${MDM_ATTRS})\\b`, "i");
const MDM_CHANGE_REV_RE = new RegExp(`\\b(?:${MDM_ATTRS})\\b[^.\\n]{0,40}?\\b(?:change[ds]?|moved|has\\s+changed|will\\s+change)\\b`, "i");
/** Weaker MDM hints: a new contact detail, or "update your records" (which can also be about a payment). */
const MDM_HINT_RE =
  /\b(?:new\s+(?:purchasing\s+|billing\s+|contact\s+|office\s+)?(?:email|e-mail|phone|fax|tel(?:ephone)?|contact\s+(?:person|no|number)|bank\s+account|account\s+no)|update\s+(?:your|ur|the)\s+(?:records?|system|database|master)|(?:item|customer|material|vendor)\s+master|(?:add|create|set\s*-?\s*up|open|register)\b[^.\n]{0,60}?\b(?:in|into|to)\s+(?:the|your|ur)\s+system)\b/i;
const MDM_CODE_RE = /\b(?:item|customer|vendor)\s+code\b/i;

// ---------------------------------------------------------------- helpers

function snippet(s: string, max = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function firstQuestion(text: string): string | undefined {
  const m = /[^.!?\n]*\?/.exec(text);
  return m && m[0].trim().length > 1 ? snippet(m[0]) : undefined;
}

/** First PO number in the text, formatted for display ("PO-778812", "LPO SMH/2026/1187", "77120"). */
function findPoNumber(text: string): string | undefined {
  const re = new RegExp(PO_CAND_RE.source, PO_CAND_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const token = m[2].replace(/[/\-]+$/, "");
    if ((token.match(/\d/g) ?? []).length >= 3) {
      if (/^purchase/i.test(m[1])) return token;
      const shown = m[0].replace(/\s+/g, " ").trim().replace(/[/\-.]+$/, "");
      return shown.replace(/^(l?po|p\.\s?o\.?)/i, (p) => p.toUpperCase());
    }
    re.lastIndex = m.index + 1;
  }
  return undefined;
}

const LABEL: Record<MessageKind, string> = {
  po: "a PO",
  pr: "a purchase request",
  enquiry: "an enquiry",
  followup: "a follow-up",
  mdm: "an MDM request",
};

interface Signal {
  kind: MessageKind;
  weight: number;
  reason: string;
}

/** Classify an inbound message. Never throws; with no signals it returns a low-confidence enquiry. */
export function classifyMessage(m: { subject: string; body: string; from: string }): {
  kind: MessageKind;
  reasons: string[];
  confidence: number;
} {
  const subject = typeof m?.subject === "string" ? m.subject : "";
  const body = typeof m?.body === "string" ? m.body : "";
  const from = typeof m?.from === "string" ? m.from : "";
  // Email addresses inside the text would trip word rules (e.g. "…-demo.example"), so drop them.
  const text = `${subject}\n${body}`.replace(/\S+@\S+/g, " ");
  const W = TRIAGE_WEIGHTS;
  const signals: Signal[] = [];
  const add = (kind: MessageKind, weight: number, reason: string) => signals.push({ kind, weight, reason });
  const q = (s: string, max = 50) => `"${snippet(s, max)}"`;

  // ---- shared facts
  const po = findPoNumber(text);
  const qtyM = QTY_RE.exec(text);
  const qtyLabel = QTY_LABEL_RE.exec(text);
  const qty = qtyM ? `${qtyM[1]} ${qtyM[2].toLowerCase()}` : qtyLabel ? qtyLabel[1] : undefined;
  const sku = SKU_RE.exec(text)?.[0];
  const internal = from.toLowerCase().trim().endsWith(`@${INTERNAL_DOMAIN}`);

  // ---- follow-up: an existing order, delivery or bill
  const fuDelivery = FU_DELIVERY_RE.exec(text)?.[0];
  const fuProblem = FU_PROBLEM_RE.exec(text)?.[0];
  const fuAmend = FU_AMEND_RE.exec(text)?.[0];
  const fuDocs = FU_DOCS_RE.exec(text)?.[0];
  const fuBilling = FU_BILLING_RE.exec(text.replace(PROFORMA_RE, " "))?.[0];
  const fuRef = FU_REF_RE.exec(text)?.[0];
  const fuSoft = FU_SOFT_RE.exec(text)?.[0];
  const poWording = PO_WORDING_RE.exec(text)?.[0];
  if (fuDelivery) add("followup", W.followDelivery, `Refers to an existing order or delivery (${q(fuDelivery)})`);
  if (fuProblem) add("followup", W.followProblem, `Raises a problem with an existing order (${q(fuProblem)})`);
  if (fuAmend) add("followup", W.followAmend, `Changes or cancels an existing order (${q(fuAmend)})`);
  if (fuDocs) add("followup", W.followDocs, `Refers to an existing order (delivery documents: ${q(fuDocs)})`);
  if (fuBilling) add("followup", W.followBilling, `Refers to an existing order (billing: ${q(fuBilling)})`);
  if (fuRef) add("followup", W.followReference, `Refers to an existing order (${q(fuRef)})`);
  if (fuSoft) add("followup", W.followSoft, `Asks about delivery of an order already sent (${q(fuSoft)})`);
  // A plain "invoice" word in an order with quantities is usually a billing instruction, not a query.
  const billingIsQuery = !!fuBilling && (!/^invoices?$/i.test(fuBilling) || !qty);
  const softIsChase = !!fuSoft && !qty && !poWording;
  const aboutExisting = !!(fuDelivery || fuProblem || fuAmend || fuDocs || fuRef || billingIsQuery || softIsChase);

  // ---- PO: a PO number that is not just a reference to an existing order
  if (po) {
    if (aboutExisting) {
      add("followup", W.poNumberExisting, `Contains PO number ${po}`);
      add("po", W.poNumberExisting, `Contains PO number ${po} (but the message is about an existing order)`);
    } else {
      add("po", W.poNumber, `Contains PO number ${po}`);
      if (poWording) add("po", W.poWording, `Order wording (${q(poWording)})`);
      if (qty) add("po", W.quantity, `States quantity ${qty}`);
      if (sku) add("po", 0, `Mentions product code ${sku}`);
    }
  }

  // ---- PR: intent to buy, no PO number yet
  const commit = COMMIT_RE.exec(text)?.[0];
  const poToFollow = PO_TO_FOLLOW_RE.exec(text)?.[0];
  const reorder = REORDER_RE.exec(text)?.[0];
  const supplyReq = SUPPLY_REQ_RE.exec(text)?.[0];
  if (commit) add("pr", W.commitment, `Accepts a quote or states intent to order (${q(commit)})`);
  if (poToFollow) add("pr", W.poToFollow, `PO still to come (${q(poToFollow)})`);
  if (reorder) add("pr", W.reorder, `Repeat-order wording (${q(reorder)})`);
  if (supplyReq && !po) add("pr", W.supplyRequest, `Asks us to supply goods (${q(supplyReq)})`);
  if (qty) add("pr", W.quantity, `States quantity ${qty}`);
  if (sku) add("pr", 0, `Mentions product code ${sku}`);

  // ---- enquiry: questions without commitment
  const topics = [...new Set([...text.matchAll(ENQUIRY_RE)].map((x) => x[0].toLowerCase().replace(/\s+/g, " ")))];
  if (topics.length) {
    add("enquiry", W.enquiryTopic + (topics.length > 1 ? W.enquiryTopicExtra : 0), `Asks about ${topics.slice(0, 3).join(", ")}`);
  }
  const hasQuestion = text.includes("?") || QUESTION_START_RE.test(text);
  if (hasQuestion) add("enquiry", W.question, `Asks a question (${q(firstQuestion(text) ?? "question")})`);
  const noCommit = NO_COMMIT_RE.exec(text)?.[0];
  if (noCommit) add("enquiry", W.noCommitment, `No commitment yet (${q(noCommit)})`);

  // ---- MDM: set up / change a record
  const mdmSetup = MDM_SETUP_RE.exec(text)?.[0] ?? MDM_PHRASE_RE.exec(text)?.[0];
  const mdmChange = MDM_CHANGE_RE.exec(text)?.[0] ?? MDM_CHANGE_REV_RE.exec(text)?.[0];
  if (mdmSetup) add("mdm", W.mdmRequest, `Requests master-data setup (${q(mdmSetup)})`);
  else if (mdmChange) add("mdm", W.mdmRequest, `Requests a master-data change (${q(mdmChange)})`);
  else if (MDM_HINT_RE.test(text)) add("mdm", W.mdmHint, `Asks to update a record detail (${q(MDM_HINT_RE.exec(text)![0])})`);
  else {
    const code = MDM_CODE_RE.exec(text)?.[0];
    if (code) add("mdm", W.mdmCodeMention, `Mentions a ${code.toLowerCase()}`);
  }
  if (internal) add("mdm", W.internalSender, `Sent from inside Lives Group (${INTERNAL_DOMAIN})`);

  // ---- score, rank, explain
  const score = (k: MessageKind) => signals.filter((s) => s.kind === k).reduce((t, s) => t + s.weight, 0);
  const ranked = TRIAGE_PRECEDENCE.map((k) => ({ k, s: score(k) })).sort(
    (a, b) => b.s - a.s || TRIAGE_PRECEDENCE.indexOf(a.k) - TRIAGE_PRECEDENCE.indexOf(b.k),
  );
  const [top, second] = ranked;

  if (!signals.some((s) => s.weight > 0 && s.kind !== "mdm") && top.s <= W.internalSender) {
    return {
      kind: "enquiry",
      reasons: ["No PO number, quantity, question or setup request found — filed as a general enquiry for review"],
      confidence: 0.2,
    };
  }

  const kind = top.k;
  const reasons = signals
    .filter((s) => s.kind === kind)
    .sort((a, b) => b.weight - a.weight)
    .map((s) => s.reason);
  if (kind === "po" && !qty) reasons.push("No quantity stated — check the attached order");
  if (kind === "pr") reasons.push(qty ? "No PO number yet — pipeline, not demand" : "No quantity stated yet — no PO number");
  if (kind === "enquiry" && !commit && !po) reasons.push("No PO number or commitment to buy");
  if (second.s > 0 && top.s - second.s < 2) {
    const why = kind === "mdm" ? "the record must exist before anything else can be booked" : "its signals are stronger";
    reasons.push(`Also looks like ${LABEL[second.k]} — filed as ${LABEL[kind]} (${why})`);
  }

  const margin = top.s - second.s;
  const confidence = Math.min(0.98, Math.max(0.05, 1 - Math.exp(-margin / 2.5)));
  return { kind, reasons: [...new Set(reasons)], confidence: Math.round(confidence * 100) / 100 };
}
