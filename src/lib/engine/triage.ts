import type { MessageKind } from "@/lib/types";

/**
 * Inbox triage: transparent rules that separate inbound messages into the three demand streams
 * (PO = demand, PR = pipeline, enquiry = leading indicator) plus follow-ups and MDM setup requests.
 * Every classification carries human-readable reasons.
 */

const INTERNAL_DOMAIN = "livesgroup.example";

const PO_RE = /\b(?:PO[-#: ]?\d{4,}|purchase\s+order\s*(?:no\.?|number|#)?\s*[:#]?\s*\d{4,})\b/i;
const QTY_RE =
  /\b(\d{1,6})\s*(boxes|box|kits?|units?|pcs|pieces|packs?|cartons?|cases?|bottles?|vials?|tests?|sets?|ea|nos|cartridges?|strips?|tubes?)\b/i;
const QTY_LABEL_RE = /\bqty\.?\s*[:=]?\s*(\d{1,6})\b/i;
const SKU_RE = /\b[IV]-[A-Z]{1,2}-\d{5,6}\b|\bcat(?:alog(?:ue)?)?\.?\s*(?:no\.?|#)\s*[:]?\s*[A-Z0-9][A-Z0-9-]{3,}/i;
const PRODUCT_RE = /\b(?:kits?|reagents?|rapid\s+tests?|assays?|analy[sz]ers?|pipette\s+tips|tubes|gloves|consumables?|cartridges?|controls?|calibrators?)\b/i;
const QUOTE_RE =
  /\b(?:accept(?:ed|ing)?\s+(?:your|the)\s+(?:quot(?:e|ation))|quot(?:e|ation)\b[^.\n]{0,40}?\b(?:accepted|approved|is\s+fine|is\s+ok(?:ay)?)|(?:intend|plan|would\s+like|['’]d\s+like|wish|want|need)\s+to\s+(?:order|purchase|buy|proceed)|please\s+proceed\s+with|go\s+ahead\s+with|confirm(?:ing)?\s+(?:our|the)\s+(?:quot(?:e|ation)|intent))/i;
const QUESTION_WORD_RE = /(?:^|[.!?\n]\s*)(?:do|does|did|can|could|would|will|what|how|is|are|when|where|which|may|any)\b[^?\n]*\?/i;
const ENQUIRY_RE = /\b(?:price|pricing|availability|available|lead\s+time|in\s+stock|brochure|spec(?:ification)?s?|quote\s+me|send\s+(?:me\s+)?a\s+quot(?:e|ation))\b/i;
const FOLLOWUP_STRONG_RE =
  /\b(?:when\s+will\b[^?\n]{0,60}?\b(?:deliver(?:ed|y)?|arrive|ship(?:ped)?|dispatch(?:ed)?)|deliver(?:y|ed)?\s+(?:status|date)|been\s+(?:delivered|shipped|dispatched)|not\s+(?:yet\s+)?(?:received|arrived|delivered)|still\s+waiting|tracking(?:\s+number)?|ETA\b|status\s+of\s+(?:our|my|the)\s+(?:order|po|delivery|shipment)|overdue|partial(?:ly)?\s+deliver(?:ed|y)|short[- ]?shipped|damaged|wrong\s+item)/i;
const FOLLOWUP_WEAK_RE = /\b(?:invoice|credit\s+note|statement\s+of\s+account|(?:our|my|the)\s+(?:order|PO|delivery|shipment)\s+(?:last|from|dated|on))\b/i;
const MDM_RE =
  /\b(?:new\s+(?:customer|vendor|supplier|item)\s*(?:code|account|set\s*-?\s*up|creation|registration)?|(?:item|customer|vendor)\s+code|set\s*-?\s*up\s+(?:a\s+)?(?:new\s+)?(?:customer|vendor|supplier|item|account)|create\s+(?:a\s+)?(?:new\s+)?(?:customer|vendor|supplier|item|account|cost\s+cent(?:re|er))|open\s+(?:an?\s+)?(?:new\s+)?account|(?:vendor|supplier)\s+registration|extend\s+(?:the\s+)?(?:customer|account|record)|master\s+data|new\s+cost\s+cent(?:re|er))/i;

function snippet(s: string, max = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function firstQuestion(text: string): string | undefined {
  const m = /[^.!?\n]*\?/.exec(text);
  return m ? snippet(m[0]) : undefined;
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
  const text = `${subject}\n${body}`;

  const po = PO_RE.exec(text)?.[0];
  const qtyM = QTY_RE.exec(text);
  const qtyLabel = QTY_LABEL_RE.exec(text);
  const qty = qtyM ? `${qtyM[1]} ${qtyM[2].toLowerCase()}` : qtyLabel ? qtyLabel[1] : undefined;
  const sku = SKU_RE.exec(text)?.[0];
  const product = PRODUCT_RE.exec(text)?.[0];
  const quote = QUOTE_RE.exec(text)?.[0];
  const question = text.includes("?") || QUESTION_WORD_RE.test(text) ? firstQuestion(text) ?? "question" : undefined;
  const enquiryWords = ENQUIRY_RE.exec(text)?.[0];
  const followStrong = FOLLOWUP_STRONG_RE.exec(text)?.[0];
  const followWeak = FOLLOWUP_WEAK_RE.exec(text)?.[0];
  const mdm = MDM_RE.exec(text)?.[0];
  const internal = from.toLowerCase().trim().endsWith(`@${INTERNAL_DOMAIN}`);

  const r = {
    po: po ? `Contains PO number ${po.replace(/^po/i, "PO")}` : "",
    qty: qty ? `States quantity ${qty}` : "",
    sku: sku ? `Mentions product code ${sku}` : "",
    quote: quote ? `Accepts a quote or states intent to order ("${snippet(quote, 50)}")` : "",
    question: question ? `Asks a question ("${question}")` : "",
    enquiry: enquiryWords ? `Asks about ${enquiryWords.toLowerCase()}` : "",
    followStrong: followStrong ? `Refers to an existing order or delivery ("${snippet(followStrong, 50)}")` : "",
    followWeak: followWeak ? `Refers to an existing order or billing ("${snippet(followWeak, 50)}")` : "",
    mdm: mdm ? `Requests master-data setup ("${snippet(mdm, 50)}")` : "",
    internal: internal ? `Sent from inside Lives Group (${INTERNAL_DOMAIN})` : "",
  };
  const out = (kind: MessageKind, confidence: number, ...reasons: string[]) => ({
    kind,
    reasons: reasons.filter(Boolean),
    confidence: Math.round(Math.min(0.98, confidence) * 100) / 100,
  });

  if (po && followStrong) return out("followup", 0.9, r.po, r.followStrong);
  if (po && qty) return out("po", sku || product ? 0.97 : 0.95, r.po, r.qty, r.sku);
  if (followStrong) return out("followup", 0.85, r.followStrong, r.po);
  if (po && followWeak) return out("followup", 0.75, r.po, r.followWeak);
  if (po) return out("po", 0.75, r.po, "No quantity stated — check the attached order");
  if (mdm) return out("mdm", internal ? 0.92 : 0.85, r.mdm, r.internal);
  if (quote && qty) return out("pr", sku || product ? 0.9 : 0.85, r.quote, r.qty, r.sku, "No PO number yet — pipeline, not demand");
  if (followWeak) return out("followup", 0.7, r.followWeak);
  if (question && !qty) return out("enquiry", 0.8, r.question, r.enquiry, "No quantity or PO number");
  if (quote) return out("pr", 0.65, r.quote, "No quantity stated yet");
  if (qty && (sku || product) && !question) {
    return out("pr", 0.6, r.qty, r.sku || `Mentions product (${product})`, "No PO number — treated as purchase intent");
  }
  if (question || enquiryWords) return out("enquiry", 0.65, r.question || r.enquiry, r.qty);
  return out("enquiry", 0.4, "No PO number, quantity, question or setup request found — filed as a general enquiry for review");
}
