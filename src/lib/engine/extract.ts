import type { CountryCode, DomainConfig, FieldDef, FieldValue } from "@/lib/types";
import { isEmptyValue, isFieldRequired, isFieldVisible, toNumber } from "./conditions";

/**
 * Paste-to-fill, offline path: a transparent rules engine that turns a pasted email or spreadsheet rows into
 * draft field values. It is also the fallback whenever the LLM path is unavailable.
 *
 * Order of evidence per field: spreadsheet cell (header → value) → "Label: value" → field-specific patterns in
 * free text → inference from other fields (e.g. product group from category). Select fields only ever receive
 * one of their configured options.
 */

// ---------------------------------------------------------------------------------------------
// Redaction (runs before any text leaves the browser for an LLM)

const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b/g;
const SWIFT_CTX_RE =
  /\b(swift|bic)((?:\s*\/\s*(?:swift|bic))?(?:\s*code)?(?:\s*no\.?)?\s*[:#=-]?\s*)([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/gi;
const CREDIT_RE =
  /(credit\s*(?:limit|line)\b[^0-9\n]{0,24}?)((?:S\$|SGD|RM|MYR|THB|USD|US\$|\$)?\s*\d[\d,]*(?:\.\d+)?(?:\s*[kKmM]\b)?)/gi;
const LONG_DIGITS_RE = /(\+?)\b\d(?:[ -]?\d){7,}\b/g;
const ACCOUNT_CTX = /\b(?:acc(?:oun)?t|a\/c|bank|iban|beneficiary)\b/i;
const SAFE_CTX =
  /\b(?:tel|phone|mobile|mob|fax|hp|whatsapp|call|uen|tax|tin|gst|sst|vat|mst|brn|reg(?:istration)?|licen[cs]e|po|pr|invoice|inv|order|zip|postcode|postal|ref)\b/i;

/**
 * Strip bank account numbers (8+ digits, spaces/hyphens allowed), IBANs, SWIFT/BIC codes and credit-limit amounts.
 * Phone numbers, tax/registration IDs, postcodes and order references are kept: digits preceded by "+" or by a
 * phone/tax/order keyword on the same line are not treated as account numbers unless an account keyword is nearer.
 */
export function redactSensitive(text: string): { text: string; redactions: number } {
  let count = 0;
  let out = typeof text === "string" ? text : String(text ?? "");
  out = out.replace(IBAN_RE, () => {
    count++;
    return "[REDACTED IBAN]";
  });
  out = out.replace(SWIFT_CTX_RE, (_m, word: string, sep: string) => {
    count++;
    return `${word}${sep}[REDACTED SWIFT]`;
  });
  out = out.replace(CREDIT_RE, (_m, prefix: string) => {
    count++;
    return `${prefix}[REDACTED AMOUNT]`;
  });
  out = out.replace(LONG_DIGITS_RE, (m: string, plus: string, offset: number, whole: string) => {
    if (plus) return m;
    const lineBefore = whole.slice(Math.max(0, offset - 40), offset).split("\n").pop() ?? "";
    if (!ACCOUNT_CTX.test(lineBefore) && SAFE_CTX.test(lineBefore)) return m;
    count++;
    return "[REDACTED ACCOUNT]";
  });
  return { text: out, redactions: count };
}

// ---------------------------------------------------------------------------------------------
// Reference data

const COUNTRY_WORDS: [RegExp, CountryCode][] = [
  [/\bsingapore\b|\bs'pore\b/i, "SG"],
  [/\bmalaysia\b/i, "MY"],
  [/\bthailand\b/i, "TH"],
  [/\bviet\s?nam\b/i, "VN"],
  [/\bmyanmar\b|\bburma\b/i, "MM"],
];
const COUNTRY_CODES: CountryCode[] = ["SG", "MY", "TH", "VN", "MM"];

const CITIES: [string, CountryCode][] = [
  ["Kuala Lumpur", "MY"],
  ["Petaling Jaya", "MY"],
  ["Shah Alam", "MY"],
  ["Subang Jaya", "MY"],
  ["Ampang", "MY"],
  ["George Town", "MY"],
  ["Penang", "MY"],
  ["Johor Bahru", "MY"],
  ["Ipoh", "MY"],
  ["Melaka", "MY"],
  ["Seremban", "MY"],
  ["Kota Kinabalu", "MY"],
  ["Kuching", "MY"],
  ["Bangkok", "TH"],
  ["Nonthaburi", "TH"],
  ["Chiang Mai", "TH"],
  ["Khon Kaen", "TH"],
  ["Hat Yai", "TH"],
  ["Phuket", "TH"],
  ["Ho Chi Minh City", "VN"],
  ["Hanoi", "VN"],
  ["Ha Noi", "VN"],
  ["Da Nang", "VN"],
  ["Hai Phong", "VN"],
  ["Can Tho", "VN"],
  ["Yangon", "MM"],
  ["Mandalay", "MM"],
  ["Naypyidaw", "MM"],
];

const INTERNAL_DOMAIN = "livesgroup.example";
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function toCountry(raw: string): CountryCode | undefined {
  const s = raw.trim();
  const up = s.toUpperCase();
  if ((COUNTRY_CODES as string[]).includes(up)) return up as CountryCode;
  for (const [re, code] of COUNTRY_WORDS) if (re.test(s)) return code;
  for (const [city, code] of CITIES) if (new RegExp(`\\b${city}\\b`, "i").test(s)) return code;
  return undefined;
}

/** Split a free-text address into street / city / postcode / country. */
export function parseAddress(
  raw: string,
  fallbackCountry: string,
): { street: string; city: string; zipCode: string; country: string } {
  let s = String(raw ?? "").replace(/\s*[\r\n]+\s*/g, ", ").trim();
  let country: string | undefined;
  for (const [re, code] of COUNTRY_WORDS) {
    if (re.test(s)) {
      country = code;
      break;
    }
  }
  let city = "";
  for (const [name, code] of CITIES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(s)) {
      city = name;
      country = country ?? code;
      break;
    }
  }
  country = country ?? fallbackCountry;
  if (country === "SG") city = "Singapore";

  const zips = [...s.matchAll(/\b\d{5,6}\b/g)];
  const zipCode = zips.length ? zips[zips.length - 1][0] : "";
  if (zipCode) s = s.replace(new RegExp(`[,\\s]*\\b${zipCode}\\b`), "");
  s = s.replace(/[,\s]*\b(?:Singapore|Malaysia|Thailand|Viet\s?Nam|Myanmar)\b[,.\s]*$/i, "");
  if (city && country !== "SG") s = s.replace(new RegExp(`[,\\s]*\\b${city}\\b[,.\\s]*$`, "i"), "");
  return { street: s.replace(/^[,\s]+|[,.\s]+$/g, ""), city, zipCode, country };
}

// ---------------------------------------------------------------------------------------------
// Value cleaning

const LEGAL_PART = /^(?:ltd|pte|sdn|bhd|berhad|inc|co|corp|llc|plc|jsc|limited|company|pcl)\b\.?/i;
const ABBREV_END =
  /(?:^|[\s(,])(?:dr|mr|mrs|ms|prof|st|no|co|pte|sdn|bhd|jln|jl|blk|ave|rd|inc|ltd|corp|vs|approx|dept|univ|natl|hosp|gen|med|ctr|intl|mt|e\.g|i\.e|etc)$/i;

/** Trim surrounding punctuation; keep a final period only when it ends an abbreviation such as "Ltd.". */
function tidy(s: string): string {
  let t = s.replace(/\s+/g, " ").trim().replace(/^[\s:=\-–—,;]+/, "").replace(/[\s,;:]+$/, "");
  while (t.endsWith(".") && !ABBREV_END.test(t.slice(0, -1))) t = t.slice(0, -1).trimEnd();
  return t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

/** End of the first sentence: a period followed by whitespace + capital (or end), not after an abbreviation or inside a number. */
function cutSentence(s: string): string {
  const re = /\.(?=\s+[A-Z("'“]|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const before = s.slice(0, m.index);
    if (ABBREV_END.test(before)) continue;
    return s.slice(0, m.index);
  }
  return s;
}

/** Organisation / person names stop at the first comma, unless the comma precedes a legal suffix ("Co., Ltd."). */
function cutName(s: string): string {
  const parts = s.split(/\s*,\s*/);
  let out = parts[0];
  for (let i = 1; i < parts.length && LEGAL_PART.test(parts[i]); i++) out += `, ${parts[i]}`;
  return tidy(out);
}

function cleanTemperature(raw: string): string | undefined {
  const s = raw.replace(/\s+/g, " ");
  const range = /(-?\d{1,2})\s*(?:°\s*C?|deg(?:rees)?\s*C?|C)?\s*(?:-|–|~|to)\s*(-?\d{1,2})\s*(?:°\s*C|deg(?:rees)?\s*C?|C\b|°)/i.exec(s);
  if (range) return `${range[1]}–${range[2]}°C`;
  const single = /(-?\d{1,2})\s*(?:°\s*C|deg(?:rees)?\s*C?|C\b)/i.exec(s);
  if (single) return `${single[1]}°C`;
  if (/room\s*temp|ambient/i.test(s)) return "Room temperature";
  if (/frozen|freezer/i.test(s)) return "Frozen";
  if (/refrigerat|fridge|chill/i.test(s)) return "2–8°C";
  return undefined;
}

const UOM_WORDS: Record<string, string> = {
  box: "BOX",
  boxes: "BOX",
  bx: "BOX",
  kit: "KIT",
  kits: "KIT",
  pack: "PK",
  packs: "PK",
  pk: "PK",
  bottle: "BTL",
  bottles: "BTL",
  btl: "BTL",
  vial: "VIAL",
  vials: "VIAL",
  each: "EA",
  ea: "EA",
  piece: "EA",
  pieces: "EA",
  pc: "EA",
  pcs: "EA",
  unit: "EA",
  units: "EA",
  case: "CS",
  carton: "CTN",
  set: "SET",
};

function cleanUom(raw: string): string | undefined {
  const w = raw.trim().split(/[\s,./]+/)[0]?.toLowerCase() ?? "";
  if (!w) return undefined;
  return UOM_WORDS[w] ?? (/^[a-z]{2,6}$/.test(w) ? w.toUpperCase() : undefined);
}

function cleanPaymentTerms(raw: string): string | undefined {
  const s = raw.toLowerCase();
  if (/\bcod\b|cash on delivery|cash/.test(s)) return "COD";
  const m = /(?:net\s*)?(\d{1,3})\s*(?:days?|d\b)?/.exec(s);
  return m ? `Net ${Number(m[1])}` : undefined;
}

function cleanYesNo(raw: string): string | undefined {
  if (/^\s*(?:y|yes|true|1)\b/i.test(raw)) return "Yes";
  if (/^\s*(?:n|no|false|0|none|not)\b/i.test(raw)) return "No";
  return undefined;
}

function cleanPhone(raw: string): string | undefined {
  const m = /\+?\d[\d ()-]{5,18}\d/.exec(raw);
  if (!m) return undefined;
  const v = m[0].replace(/\s+/g, " ").trim();
  return v.replace(/\D/g, "").length >= 7 ? v : undefined;
}

function cleanEmail(raw: string): string | undefined {
  return raw.match(EMAIL_RE)?.[0];
}

function cleanEntity(raw: string): string | undefined {
  const m = /\b([A-Z][A-Z0-9]{1,5})\b/.exec(raw.trim().toUpperCase());
  return m ? m[1] : undefined;
}

function countriesList(text: string): string | undefined {
  const found: { code: CountryCode; at: number }[] = [];
  for (const code of COUNTRY_CODES) {
    const m = new RegExp(`(?:^|[^A-Za-z0-9])${code}(?![A-Za-z0-9])`).exec(text);
    if (m) found.push({ code, at: m.index + m[0].length - code.length });
  }
  for (const [re, code] of COUNTRY_WORDS) {
    const m = new RegExp(re.source, "i").exec(text);
    if (m && !found.some((f) => f.code === code)) found.push({ code, at: m.index });
  }
  if (!found.length) return undefined;
  return found
    .sort((a, b) => a.at - b.at)
    .map((f) => f.code)
    .join(", ");
}

/** Map a raw value to one of a select field's options, or undefined when none fits. */
export function matchOption(raw: FieldValue | undefined, options: string[]): string | undefined {
  if (isEmptyValue(raw) || !options.length) return undefined;
  const v = String(raw).trim();
  const lv = v.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lv);
  if (exact) return exact;
  const yn = cleanYesNo(v);
  if (yn) {
    const o = options.find((x) => x.toLowerCase() === yn.toLowerCase());
    if (o) return o;
  }
  const lead = options.find((o) => {
    const lo = o.toLowerCase();
    return lo.startsWith(lv) && lo.length > lv.length && !/[a-z0-9]/.test(lo[lv.length]);
  });
  if (lead) return lead;
  if (/^[abc]$/i.test(v)) {
    const product = options.find((o) => new RegExp(`\\bproduct\\s*${v}\\b`, "i").test(o));
    if (product) return product;
  }
  const temp = cleanTemperature(v);
  if (temp) {
    const nums = (s: string) => (s.match(/-?\d+/g) ?? []).join(",");
    const t = options.find((o) => nums(o) && nums(o) === nums(temp));
    if (t) return t;
  }
  const byLength = [...options].sort((a, b) => b.length - a.length);
  const contained = byLength.find((o) => o.length >= 2 && new RegExp(`\\b${escapeRe(o.toLowerCase())}\\b`).test(lv));
  if (contained) return contained;
  if (lv.length >= 3) {
    const containing = byLength.find((o) => o.toLowerCase().includes(lv));
    if (containing) return containing;
  }
  return undefined;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------------------------
// Field rules

type Found = { value: FieldValue; confidence: number };
type Rule = {
  /** Label / column-header synonyms (lowercase). The field's own label is always added. */
  labels: string[];
  /** Clean a labelled value. Returning undefined discards it (and free-text patterns are tried next). */
  clean?: (raw: string) => FieldValue | undefined;
  /** Find the value in free text. */
  find?: (text: string) => Found | undefined;
};

const CONF = { cell: 0.95, label: 0.92, strong: 0.88, pattern: 0.8, medium: 0.72, weak: 0.62 } as const;

function capture(re: RegExp, text: string, confidence: number, clean?: (s: string) => FieldValue | undefined): Found | undefined {
  const m = re.exec(text);
  if (!m || m[1] === undefined) return undefined;
  const v = clean ? clean(m[1]) : tidy(m[1]);
  return isEmptyValue(v ?? null) ? undefined : { value: v as FieldValue, confidence };
}

const num = (s: string): number | undefined => {
  const m = /-?\d[\d,]*(?:\.\d+)?\s*[kKmM]?\b/.exec(s.replace(/(?:S\$|SGD|RM|MYR|THB|USD|US\$|\$)\s*/gi, ""));
  if (!m) return undefined;
  const n = toNumber(m[0].replace(/\s+/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

const NAME_END = String.raw`(?=\s*(?:,|\.(?:\s|$)|;|\(|\n|\s(?:for|in|at|with|under|to)\b|$))`;

function orgAfter(trigger: string, text: string, confidence: number): Found | undefined {
  const re = new RegExp(`\\b(?:${trigger})\\s*[:\\-–]?\\s*([A-Z][A-Za-z0-9&'.\\- ]{2,80}?)${NAME_END}`);
  return capture(re, text, confidence, cutName);
}

const IVD_CONSUMABLE = "Lab consumable – IVD medical device";

function categoryFromText(text: string): string | undefined {
  // Blood collection tubes (K2EDTA etc.) are lab consumables regulated as IVD medical devices.
  if (/\bK\s?[23]\s?EDTA\b|\bEDTA\b|\bblood\s+collection\s+tubes?\b|\bvacu(?:um|tainer)\s+tubes?\b/i.test(text)) return IVD_CONSUMABLE;
  if (/\bconsumables?\b/i.test(text) && /\bIVD\b|\bmedical\s+devices?\b/i.test(text)) return IVD_CONSUMABLE;
  if (/\bIVD\b|\breagents?\b|\brapid\s+tests?\b|\btest\s+kits?\b|\bassays?\b|\bantigen\b|\bantibody\b/i.test(text)) return "IVD reagent";
  if (/\bmedical\s+devices?\b/i.test(text)) return "Medical device";
  if (/\banaly[sz]ers?\b|\binstruments?\b|\bcentrifuges?\b|\bmicroscopes?\b|\bequipment\b/i.test(text)) return "Instrument";
  if (/\bconsumables?\b|\bpipette\s+tips?\b|\bgloves?\b|\bpetri\b|\bcryovials?\b/i.test(text)) return "Lab consumable";
  return undefined;
}

function productGroupFor(category: string | undefined): string | undefined {
  if (!category) return undefined;
  const c = category.toLowerCase();
  if (/consumable/.test(c)) return "B";
  if (/ivd|reagent|test kit/.test(c)) return "A";
  if (/consumable/.test(c)) return "B";
  if (/instrument|equipment|device/.test(c)) return "C";
  return undefined;
}

const RULES: Record<string, Rule> = {
  // ----- item
  itemName: {
    labels: ["item name", "item description", "product name", "item", "product", "description", "material", "sku name"],
    clean: (s) => tidy(s) || undefined,
    find: (t) =>
      capture(
        /\b(?:create|set\s*up|new|add)\s+(?:an?\s+)?(?:new\s+)?item(?:\s+code)?\s+for\s+(?:(?:the|a|our)\s+)?(?:new\s+)?([A-Z][^.,;\n]{3,99})/,
        t,
        CONF.medium,
      ),
  },
  category: {
    labels: ["category", "item category", "product category", "product type", "item type"],
    clean: (s) => categoryFromText(s) ?? tidy(s),
    find: (t) => {
      const c = categoryFromText(t);
      return c ? { value: c, confidence: CONF.medium } : undefined;
    },
  },
  productGroup: {
    labels: ["product group", "item group", "product line"],
    clean: (s) => /\b([ABC])\b/i.exec(s.replace(/product\s*/i, ""))?.[1]?.toUpperCase() ?? tidy(s),
    find: (t) => capture(/\bproduct\s*(?:group\s*)?([ABC])\b/, t, CONF.strong),
  },
  manufacturer: {
    labels: ["manufacturer", "mfr", "brand", "maker", "principal", "made by", "manufactured by"],
    clean: (s) => cutName(s.replace(/\s*\((?:[A-Z]{2})\)\s*\.?$/, "").replace(/\s*\((?:[A-Z]{2})\)\s*(?=,|$)/, "")) || undefined,
    find: (t) => {
      const f = orgAfter("manufactured by|made by|manufacturer|principal is", t, CONF.pattern);
      return f ? { ...f, value: String(f.value).replace(/\s*\([A-Z]{2}\)$/, "") } : undefined;
    },
  },
  uom: {
    labels: ["uom", "unit of measure", "unit of measurement", "inventory uom", "sales uom", "unit"],
    clean: cleanUom,
    find: (t) =>
      capture(/\b(?:uom|unit\s+of\s+measure(?:ment)?)\s*[:=]?\s*([A-Za-z]{2,6})\b/i, t, CONF.strong, cleanUom) ??
      capture(/\d+\s*(?:tests?|T|pcs|pieces|strips|cartridges|vials|ml|mL)\s*(?:\/|per)\s*(box|kit|pack|bottle|vial|case|carton)\b/i, t, CONF.weak, cleanUom),
  },
  packSize: {
    labels: ["pack size", "pack", "packing", "packaging", "pack/size", "pkg"],
    clean: (s) => packOf(s) ?? (tidy(s) || undefined),
    find: (t) => {
      const p = packOf(t);
      return p ? { value: p, confidence: CONF.pattern } : undefined;
    },
  },
  costPrice: {
    labels: ["cost price", "cost", "purchase price", "buying price", "unit cost", "landed cost", "cost per unit"],
    clean: num,
    find: (t) => capture(/\b(?:cost(?:\s*price)?|purchase\s*price|buying\s*price|unit\s*cost|landed\s*cost)\b([^\n]{0,40})/i, t, CONF.pattern, num),
  },
  salesPrice: {
    labels: ["selling price", "sales price", "sell price", "selling", "list price", "unit price", "price", "srp", "resale price"],
    clean: num,
    find: (t) =>
      capture(/\b(?:selling(?:\s*price)?|sell(?:ing)?\s*(?:price|at)|sales\s*price|list\s*price|srp|resale\s*price)\b([^\n]{0,40})/i, t, CONF.pattern, num),
  },
  storage: {
    labels: ["storage", "storage condition", "storage conditions", "storage temp", "storage temperature", "store at", "temperature"],
    clean: (s) => cleanTemperature(s) ?? (tidy(s) || undefined),
    find: (t) => capture(/\b(?:storage|store[sd]?\s+at|keep\s+at)\b(?:\s*(?:temp(?:erature)?|conditions?))?\s*[:=]?\s*([^.;,\n]{2,30})/i, t, CONF.pattern, cleanTemperature),
  },
  regLicenceNo: {
    labels: [
      "reg licence no",
      "regulatory licence no",
      "licence no",
      "license no",
      "licence number",
      "license number",
      "registration no",
      "product registration no",
      "hsa licence",
      "hsa license",
      "hsa reg no",
      "mda licence",
      "mda license",
      "mda reg no",
      "licence",
      "license",
    ],
    clean: (s) => /\b([A-Z]{1,5}[-/ ]?\d{4,14}[A-Z0-9-]*)\b/i.exec(s)?.[1]?.toUpperCase() ?? undefined,
    find: (t) =>
      capture(
        /\b(?:HSA|MDA|Thai\s*FDA|FDA|DAV)\s*(?:licen[cs]e|reg(?:istration)?|product\s+reg(?:istration)?)?\s*(?:no\.?|number|#)?\s*[:=]?\s*([A-Z]{1,5}[-/ ]?\d{4,14}[A-Z0-9-]*)\b/i,
        t,
        CONF.strong,
      ) ?? capture(/\b(D[ENA]\d{7})\b/, t, CONF.medium),
  },
  countries: {
    labels: ["countries", "countries sold in", "markets", "sold in", "for countries"],
    clean: (s) => countriesList(s),
    find: (t) => {
      const c = countriesList(t);
      return c ? { value: c, confidence: CONF.medium } : undefined;
    },
  },

  // ----- shared
  entity: {
    labels: ["entity", "business unit", "bu", "requesting entity", "company code"],
    clean: cleanEntity,
    find: (t) =>
      capture(/\b(?:[Ee]ntity|BU|[Bb]usiness [Uu]nit)\s*[:=]?\s*([A-Z][A-Z0-9]{1,5})\b/, t, CONF.strong) ??
      capture(/\b(SPD|QTS|QTG)\b/, t, CONF.medium),
  },
  country: {
    labels: ["country", "country code", "location"],
    clean: (s) => toCountry(s),
    find: (t) => {
      for (const [re, code] of COUNTRY_WORDS) if (re.test(t)) return { value: code, confidence: CONF.medium };
      for (const [city, code] of CITIES) if (new RegExp(`\\b${city}\\b`).test(t)) return { value: code, confidence: CONF.weak };
      return undefined;
    },
  },
  taxId: {
    labels: [
      "uen",
      "tax id",
      "tax no",
      "tax number",
      "tax code",
      "gst reg no",
      "gst registration no",
      "gst no",
      "tin",
      "brn",
      "business registration no",
      "company reg no",
      "registration no",
      "reg no",
      "sst no",
      "mst",
      "vat no",
      "federal tax id",
    ],
    clean: (s) => tidy(s).split(/\s{2,}|,/)[0] || undefined,
    find: (t) =>
      capture(
        /\b(?:UEN|GST\s*(?:reg(?:istration)?\s*)?(?:no\.?|number)?|TIN|BRN|SST\s*no\.?|MST|tax\s*(?:id|no\.?|number))\s*[:#]?\s*([A-Z0-9](?:[A-Z0-9-]|\s(?=\d)){5,20})/i,
        t,
        CONF.strong,
      ) ?? capture(/\b(\d{8,9}[A-Z]|[TSR]\d{2}[A-Z]{2}\d{4}[A-Z])\b/, t, CONF.pattern),
  },
  street: {
    labels: ["address", "street", "street address", "billing address", "bill-to address", "registered address", "office address"],
    clean: (s) => parseAddress(s, "").street || undefined,
    find: (t) =>
      capture(
        /\b(\d{1,5}[A-Z]?,?\s+(?:[A-Z][A-Za-z']+\s+){1,5}(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Crescent|Way|Close|Link|Place|Walk|Park)\b|\b(?:\d{1,5}[A-Z]?,?\s+)?(?:Jalan|Jln|Lorong|Thanon|Soi|Duong|Pho)\s+[A-Z][A-Za-z0-9' /]{2,40}?)(?=\s*(?:,|\.|\n|$))/,
        t,
        CONF.weak,
      ),
  },
  city: { labels: ["city", "town"], clean: (s) => tidy(s) || undefined },
  zipCode: {
    labels: ["postcode", "postal code", "post code", "zip", "zip code"],
    clean: (s) => /\b(\d{5,6})\b/.exec(s)?.[1],
    find: (t) =>
      capture(/\bSingapore\s+(\d{6})\b/, t, CONF.pattern) ??
      capture(new RegExp(`\\b(\\d{5})\\s+(?:${CITIES.map(([c]) => c).join("|")})\\b`), t, CONF.pattern),
  },
  phone: {
    labels: ["phone", "phone no", "tel", "tel no", "telephone", "contact no", "contact number", "mobile", "hp", "office phone"],
    clean: cleanPhone,
    find: (t) =>
      capture(/\b(?:tel|phone|telephone|mobile|hp|contact\s+no)\.?\s*(?:no\.?)?\s*[:=]?\s*(\+?\d[\d ()-]{5,18}\d)/i, t, CONF.strong, cleanPhone) ??
      capture(/(\+(?:65|60|66|84|95)[\d ()-]{6,16}\d)/, t, CONF.pattern, cleanPhone),
  },
  email: {
    labels: ["email", "e-mail", "email address", "e-mail address"],
    clean: cleanEmail,
    find: (t) => {
      const external = (t.match(EMAIL_RE) ?? []).find((e) => !e.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`));
      return external ? { value: external, confidence: CONF.pattern } : undefined;
    },
  },
  contactPerson: {
    labels: ["contact person", "contact", "attn", "attention", "pic", "person in charge", "contact name"],
    clean: (s) => cutName(s) || undefined,
    find: (t) =>
      capture(
        /\b(?:contact(?:\s+person)?|attn|attention|pic)\b\s*[:\-–]?\s*((?:(?:Dr|Mr|Mrs|Ms|Mdm|Prof)\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/,
        t,
        CONF.medium,
      ),
  },
  segment: {
    labels: ["segment", "customer segment", "customer type", "customer group"],
    clean: (s) => segmentOf(s) ?? tidy(s),
    find: (t) => {
      const s = segmentOf(t);
      return s ? { value: s, confidence: CONF.weak } : undefined;
    },
  },
  paymentTerms: {
    labels: ["payment terms", "payment term", "credit terms", "terms"],
    clean: cleanPaymentTerms,
    find: (t) =>
      capture(/\b(?:payment|credit)\s+terms?\b\s*(?:of|:|=)?\s*([^,.;\n]{1,24})/i, t, CONF.pattern, cleanPaymentTerms) ??
      capture(/\b(net\s*\d{1,3}|cod|cash on delivery)\b/i, t, CONF.medium, cleanPaymentTerms),
  },
  creditLimit: {
    labels: ["credit limit", "credit line", "limit"],
    clean: num,
    find: (t) => capture(/\bcredit\s*(?:limit|line)\b([^\n]{0,40})/i, t, CONF.strong, num),
  },
  currency: {
    labels: ["currency", "ccy", "billing currency"],
    clean: (s) => /\b(SGD|MYR|THB|VND|MMK|USD)\b/i.exec(s)?.[1]?.toUpperCase(),
    find: (t) => capture(/\b(?:currency|billed\s+in|invoice\s+in|bill\s+in)\s*[:=]?\s*(SGD|MYR|THB|VND|MMK|USD)\b/i, t, CONF.pattern),
  },
  bankName: {
    labels: ["bank name", "bank", "beneficiary bank"],
    clean: (s) => cutName(s) || undefined,
    find: (t) =>
      capture(
        /\b(DBS(?:\s+Bank)?|OCBC(?:\s+Bank)?|UOB|Maybank|CIMB(?:\s+Bank)?|Public\s+Bank|RHB(?:\s+Bank)?|Hong\s+Leong\s+Bank|Bangkok\s+Bank|Kasikornbank|Siam\s+Commercial\s+Bank|Krungthai\s+Bank|Vietcombank|BIDV|Techcombank|KBZ\s+Bank|AYA\s+Bank|CB\s+Bank|HSBC|Standard\s+Chartered|Citibank)\b/i,
        t,
        CONF.medium,
      ),
  },
  bankAccountNo: {
    labels: ["bank account no", "bank account number", "bank account", "account no", "account number", "acct no", "a/c no", "a/c"],
    clean: (s) => /\d[\d -]{5,24}\d/.exec(s)?.[0]?.trim(),
    find: (t) => capture(/\b(?:a\/c|acc(?:oun)?t)\s*(?:no\.?|number|#)?\s*[:=]?\s*(\d[\d -]{5,24}\d)/i, t, CONF.strong),
  },
  swift: {
    labels: ["swift", "swift code", "bic", "swift/bic", "bic/swift", "swift bic"],
    clean: (s) => /\b([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/.exec(s.toUpperCase())?.[1],
    find: (t) => capture(/\b(?:swift|bic)(?:\s*\/\s*(?:swift|bic))?(?:\s*code)?\s*[:=]?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/i, t, CONF.strong),
  },

  // ----- vendor
  vendorName: {
    labels: ["vendor name", "vendor", "supplier name", "supplier", "company name", "company", "name"],
    clean: (s) => cutName(s) || undefined,
    find: (t) => orgAfter("new\\s+(?:vendor|supplier)|(?:vendor|supplier)\\s+account\\s+for|set\\s*up\\s+(?:a\\s+)?(?:new\\s+)?(?:vendor|supplier)", t, CONF.medium),
  },
  suppliesRegulated: {
    labels: ["supplies regulated products", "regulated products", "regulated", "supplies regulated"],
    clean: cleanYesNo,
    find: (t) => {
      if (/\b(?:non[- ]?regulated|not\s+regulated|no\s+regulated)\b/i.test(t)) return { value: "No", confidence: CONF.medium };
      if (/\b(?:IVD|medical\s+devices?|regulated\s+products?|HSA|MDA|reagents?)\b/i.test(t)) return { value: "Yes", confidence: CONF.weak };
      return undefined;
    },
  },

  // ----- customer
  customerName: {
    labels: ["customer name", "customer", "company name", "company", "account name", "hospital name", "hospital", "institution", "organisation", "organization", "name"],
    clean: (s) => cutName(s) || undefined,
    find: (t) =>
      orgAfter(
        "new\\s+customer|customer\\s+account\\s+for|open\\s+(?:an?\\s+)?account\\s+for|set\\s*up\\s+(?:a\\s+)?(?:new\\s+)?customer|create\\s+(?:a\\s+)?(?:new\\s+)?customer(?:\\s+code)?\\s+for",
        t,
        CONF.medium,
      ),
  },

  // ----- cost centre
  centreCode: {
    labels: ["cost centre code", "cost center code", "centre code", "center code", "prccode", "profit centre code", "profit center code"],
    clean: (s) => /\b([A-Z0-9][A-Z0-9-]{1,7})\b/i.exec(s)?.[1]?.toUpperCase(),
    find: (t) => capture(/\b(?:cost\s*cent(?:re|er)|profit\s*cent(?:re|er))\s*code\s*[:=]?\s*([A-Z0-9][A-Z0-9-]{1,7})\b/i, t, CONF.strong),
  },
  centreName: {
    labels: ["cost centre name", "cost center name", "centre name", "center name", "profit centre name", "name", "description"],
    clean: (s) => tidy(s) || undefined,
    find: (t) => capture(/\b(?:new\s+)?cost\s*cent(?:re|er)\s+(?:for|called|named)\s+([A-Z][^.,;\n]{2,40})/, t, CONF.medium),
  },
  owner: {
    labels: ["budget owner", "owner", "cost centre owner", "cost center owner", "centre owner", "manager"],
    clean: (s) => cutName(s) || undefined,
    find: (t) => capture(/\b(?:owner|owned\s+by|budget\s+holder)\s*[:\-–]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/, t, CONF.medium),
  },
  dimension: {
    labels: ["dimension", "dim"],
    clean: (s) => tidy(s) || undefined,
    find: (t) => capture(/\bdim(?:ension)?\s*[:=#]?\s*([1-5])\b/i, t, CONF.pattern),
  },

  // ----- extend
  existingCode: {
    labels: ["existing code", "existing sap code", "sap code", "card code", "cardcode", "customer code", "bp code"],
    clean: (s) => /\b([CV]-[A-Z]{2}-\d{5})\b/i.exec(s)?.[1]?.toUpperCase() ?? (tidy(s) || undefined),
    find: (t) => capture(/\b([CV]-(?:SG|MY|TH|VN|MM)-\d{5})\b/, t, CONF.strong),
  },
  existingName: {
    labels: ["existing name", "existing customer", "customer name", "customer", "account name", "name"],
    clean: (s) => cutName(s) || undefined,
    find: (t) => orgAfter("extend|existing\\s+customer|existing\\s+account", t, CONF.medium),
  },
  extendToEntity: {
    labels: ["extend to entity", "extend to", "new entity", "add entity", "to entity", "target entity"],
    clean: cleanEntity,
    find: (t) => capture(/\bextend(?:ed|ing)?\b[^.\n]{0,80}?\bto\s+(?:entity\s+)?([A-Z][A-Z0-9]{1,5})\b/, t, CONF.pattern),
  },
  newShipToAddress: {
    labels: ["new ship-to address", "ship-to address", "ship to address", "ship-to", "ship to", "delivery address", "deliver to"],
    clean: (s) => tidy(s) || undefined,
    find: (t) => capture(/\b(?:ship[- ]?to|deliver(?:y)?\s+(?:address|to))(?:\s+address)?\s*[:=]?\s*([^\n]{8,200}?)(?=\.(?:\s|$)|\n|$)/i, t, CONF.medium),
  },
  changesCreditTerms: {
    labels: ["changes credit terms", "change credit terms", "credit terms change", "credit terms changed"],
    clean: cleanYesNo,
    find: (t) => {
      if (/\b(?:no\s+change\s+(?:to|in)|same|unchanged|keep(?:ing)?\s+(?:the\s+)?(?:existing|current))\s+(?:the\s+)?(?:credit|payment)\s*(?:terms|limit)\b/i.test(t)) {
        return { value: "No", confidence: CONF.pattern };
      }
      if (/\b(?:change|increase|revise|raise|new|update)\s+(?:the\s+|our\s+)?(?:credit\s*(?:terms|limit)|payment\s*terms)\b/i.test(t)) {
        return { value: "Yes", confidence: CONF.medium };
      }
      return undefined;
    },
  },
  reason: {
    labels: ["reason", "purpose", "justification", "business reason", "background"],
    clean: (s) => tidy(s) || undefined,
    find: (t) => capture(/\b(?:because|reason(?:\s+is)?|purpose(?:\s+is)?)\s*[:\-–]?\s*([^.\n]{8,200})/i, t, CONF.weak),
  },
};

function packOf(s: string): string | undefined {
  const m =
    /\b(\d+)\s*(tests?|T|pcs|pieces|strips|cartridges|vials|bottles|kits|reactions|rxns?|ml|mL)\s*(?:\/|per|x)\s*(box|kit|pack|case|carton|bottle|bx)\b/i.exec(s);
  if (!m) return undefined;
  const unit = /^t$/i.test(m[2]) ? "tests" : m[2].toLowerCase() === "test" ? "tests" : m[2];
  return `${m[1]} ${unit}/${m[3].toLowerCase() === "bx" ? "box" : m[3].toLowerCase()}`;
}

function segmentOf(s: string): string | undefined {
  if (/\b(?:public|government|govt|restructured|general)\s+hospital/i.test(s)) return "Public hospital";
  if (/\bprivate\s+hospital|\bspecialist\s+(?:hospital|centre|center)/i.test(s)) return "Private hospital";
  if (/\b(?:diagnostic|pathology|clinical|reference)\s+lab(?:oratory|oratories|s)?\b/i.test(s)) return "Diagnostic lab";
  if (/\b(?:poly)?clinics?\b|\bGP\b|\bklinik\b/i.test(s)) return "Clinic";
  if (/\buniversity\b|\bresearch\b|\bacademic\b|\binstitute\b/i.test(s)) return "Research/academic";
  if (/\bindustr(?:y|ial)\b|\bpharma(?:ceutical)?s?\b|\bmanufactur/i.test(s)) return "Industry";
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Label and table scanning

function normLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

function labelsFor(f: FieldDef): string[] {
  const own = normLabel(f.label);
  const base = RULES[f.key]?.labels ?? [];
  return [...new Set([...base, own, f.key.toLowerCase()].filter((x) => x.length >= 2))];
}

/** Excel / Sheets copy: header row + first data row, tab-separated. Also "Label<TAB>value" lines. */
function scanTable(text: string, fields: FieldDef[]): { pairs: Map<string, string>; consumed: Set<number> } {
  const pairs = new Map<string, string>();
  const consumed = new Set<number>();
  const lines = text.split(/\r?\n/);
  const keyOf = (cell: string): string | undefined => {
    const n = normLabel(cell);
    if (!n) return undefined;
    return fields.find((f) => labelsFor(f).some((l) => normLabel(l) === n))?.key;
  };
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("\t")) continue;
    const cells = lines[i].split("\t");
    const keys = cells.map(keyOf);
    const mapped = keys.filter(Boolean).length;
    if (mapped >= 2) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && lines[j].includes("\t")) {
        const row = lines[j].split("\t");
        keys.forEach((k, c) => {
          if (k && row[c] !== undefined && row[c].trim() && !pairs.has(k)) pairs.set(k, row[c].trim());
        });
        consumed.add(i).add(j);
        i = j;
        continue;
      }
    }
    if (cells.length === 2 && keys[0] && cells[1].trim()) {
      if (!pairs.has(keys[0])) pairs.set(keys[0], cells[1].trim());
      consumed.add(i);
    }
  }
  return { pairs, consumed };
}

/** "Label: value" pairs anywhere in the text (also "Label = value"). Values run to the next label, line end or sentence end. */
function scanLabels(text: string, fields: FieldDef[]): Map<string, string> {
  const out = new Map<string, string>();
  const synToKey = new Map<string, string>();
  for (const f of fields) for (const l of labelsFor(f)) if (!synToKey.has(normLabel(l))) synToKey.set(normLabel(l), f.key);
  const syns = [...synToKey.keys()].sort((a, b) => b.length - a.length);
  if (!syns.length) return out;
  const alt = syns.map((s) => escapeRe(s).replace(/(?:\\\/|\s)+/g, (m) => (m.includes("/") ? "\\s*\\/\\s*" : "[\\s\\-_]*"))).join("|");
  // A leading non-alphanumeric group stands in for a lookbehind (unsupported on older Safari).
  const re = new RegExp(`(^|[^A-Za-z0-9])(${alt})(?:\\s*\\([^)\\n]{0,40}\\))?\\s*(?:no\\.?|number|#)?\\s*[:=：]`, "gi");

  const hits: { key: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = synToKey.get(normLabel(m[2]));
    if (key) hits.push({ key, start: m.index + m[1].length, end: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++;
  }
  hits.forEach((h, i) => {
    if (out.has(h.key)) return;
    const stop = i + 1 < hits.length ? hits[i + 1].start : text.length;
    let region = text.slice(h.end, stop);
    const lines = region.split(/\r?\n/);
    let value = lines[0].trim();
    if (!value) {
      // value on the following line(s), e.g. a multi-line address block
      const block: string[] = [];
      for (const l of lines.slice(1)) {
        if (!l.trim()) {
          if (block.length) break;
          continue;
        }
        block.push(l.trim());
      }
      value = block.join(", ");
    }
    region = cutSentence(value).split(/;|\s\|\s/)[0];
    const v = tidy(region);
    if (v) out.set(h.key, v);
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Type normalisation

function finalize(f: FieldDef, v: FieldValue | undefined): FieldValue | undefined {
  if (isEmptyValue(v ?? null)) return undefined;
  const s = String(v).trim();
  switch (f.type) {
    case "number": {
      const n = typeof v === "number" ? v : num(s);
      return n !== undefined && Number.isFinite(n) ? n : undefined;
    }
    case "email":
      return cleanEmail(s);
    case "phone":
      return cleanPhone(s);
    case "country":
      return toCountry(s);
    case "entity":
      return cleanEntity(s);
    case "select":
      return f.options?.length ? matchOption(s, f.options) : s;
    case "date": {
      const t = Date.parse(s);
      return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
    }
    case "file":
      return undefined;
    default:
      return s;
  }
}

/** Free-text fallback for admin-added fields without a dedicated rule. */
function genericFind(f: FieldDef, text: string): Found | undefined {
  switch (f.type) {
    case "email":
      return RULES.email.find?.(text);
    case "phone":
      return RULES.phone.find?.(text);
    case "country":
      return RULES.country.find?.(text);
    case "entity":
      return RULES.entity.find?.(text);
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Public API

/**
 * Rules-based extraction of a domain's fields from pasted text. Never throws.
 * missing = required (incl. conditionally required) visible fields still empty after extraction.
 */
export function extractFieldsRules(
  text: string,
  domain: DomainConfig,
): { values: Record<string, FieldValue>; confidence: Record<string, number>; missing: string[] } {
  const values: Record<string, FieldValue> = {};
  const confidence: Record<string, number> = {};
  const fields = domain.fields ?? [];
  const src = typeof text === "string" ? text.replace(/\u0000/g, "") : "";

  try {
    if (src.trim()) {
      const { pairs: cells, consumed } = scanTable(src, fields);
      const prose = src
        .split(/\r?\n/)
        .map((l, i) => (consumed.has(i) ? "" : l))
        .join("\n");
      const labelled = scanLabels(prose, fields);
      const set = (f: FieldDef, v: FieldValue | undefined, c: number) => {
        const fin = finalize(f, v);
        if (fin === undefined) return false;
        values[f.key] = fin;
        confidence[f.key] = Math.round(c * 100) / 100;
        return true;
      };

      for (const f of fields) {
        const rule = RULES[f.key];
        const clean = rule?.clean ?? ((s: string) => tidy(s) || undefined);
        const cell = cells.get(f.key);
        if (cell !== undefined && set(f, clean(cell), CONF.cell)) continue;
        const lab = labelled.get(f.key);
        if (lab !== undefined && set(f, clean(lab), CONF.label)) continue;
        const found = rule?.find ? rule.find(prose) : genericFind(f, prose);
        if (found) set(f, found.value, found.confidence);
      }

      // Inference from other fields
      const has = (k: string) => fields.some((f) => f.key === k);
      const fieldOf = (k: string) => fields.find((f) => f.key === k)!;
      if (has("productGroup") && values.productGroup === undefined) {
        set(fieldOf("productGroup"), productGroupFor(values.category as string | undefined), CONF.medium);
      }
      if (has("uom") && values.uom === undefined && typeof values.packSize === "string") {
        set(fieldOf("uom"), cleanUom(values.packSize.split("/")[1] ?? ""), CONF.weak);
      }
      const rawAddress = cells.get("street") ?? labelled.get("street");
      if (rawAddress) {
        const a = parseAddress(rawAddress, "");
        if (has("zipCode") && values.zipCode === undefined && a.zipCode) set(fieldOf("zipCode"), a.zipCode, CONF.pattern);
        if (has("city") && values.city === undefined && a.city) set(fieldOf("city"), a.city, CONF.pattern);
        if (has("country") && values.country === undefined && a.country) set(fieldOf("country"), a.country, CONF.pattern);
      }
      if (has("city") && values.city === undefined && values.country === "SG") set(fieldOf("city"), "Singapore", CONF.medium);
    }
  } catch {
    // A malformed paste must never break the form: keep whatever was extracted so far.
  }

  const missing = fields
    .filter((f) => isFieldVisible(f, values) && isFieldRequired(f, values) && isEmptyValue(values[f.key]))
    .map((f) => f.key);
  return { values, confidence, missing };
}
