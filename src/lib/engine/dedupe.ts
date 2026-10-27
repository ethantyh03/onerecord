import type { CountryCode, CustomerMaster, DuplicateMatch } from "@/lib/types";

export type DupInput = {
  name: string;
  country?: CountryCode;
  taxId?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
};

// ---------------------------------------------------------------------------------------------
// Name normalisation

/** Abbreviation → expansion (token level). "st" is handled separately: it only means "saint" as the leading token. */
const EXPANSIONS: Record<string, string> = {
  hosp: "hospital",
  hosps: "hospitals",
  hospl: "hospital",
  natl: "national",
  univ: "university",
  uni: "university",
  gen: "general",
  genl: "general",
  med: "medical",
  ctr: "centre",
  cntr: "centre",
  center: "centre",
  centers: "centres",
  intl: "international",
  dept: "department",
  mt: "mount",
  lab: "laboratory",
  labs: "laboratories",
  diag: "diagnostic",
  spec: "specialist",
  kl: "kuala lumpur",
  jb: "johor bahru",
  hcmc: "ho chi minh city",
};

/** Legal-form tokens that are dropped wherever they appear. */
const LEGAL_ANYWHERE = new Set(["pte", "ltd", "sdn", "bhd", "berhad", "plc", "inc", "jsc", "llc", "tnhh", "pcl", "limited", "corp"]);
/** Legal-form words that are only dropped from the end of a name ("Co", "Company", "Public Company"). */
const LEGAL_TRAILING = new Set(["co", "company", "corporation", "public", "private", "incorporated"]);

/** Facility-type and filler words: on their own they say nothing about which organisation is meant. */
const GENERIC = new Set([
  "the",
  "of",
  "and",
  "hospital",
  "hospitals",
  "clinic",
  "clinics",
  "polyclinic",
  "medical",
  "centre",
  "centres",
  "laboratory",
  "laboratories",
  "general",
  "specialist",
  "specialists",
  "health",
  "healthcare",
  "diagnostic",
  "diagnostics",
  "klinik",
  "makmal",
  "benh",
  "vien",
]);

function stripDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function normalizeDetailed(raw: string): { normalized: string; expansions: string[] } {
  let s = stripDiacritics(String(raw ?? "")).toLowerCase();
  s = s.replace(/\bnat['’`]l\b/g, "natl").replace(/\bint['’`]l\b/g, "intl").replace(/\bs['’`]pore\b/g, "singapore");
  s = s.replace(/['’`]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9\s]+/g, " ");
  let tokens = s.split(/\s+/).filter(Boolean);

  // Vietnamese "Công ty" (company) prefix
  if (tokens[0] === "cong" && tokens[1] === "ty") tokens = tokens.slice(2);
  else if (tokens[0] === "cty") tokens = tokens.slice(1);

  tokens = tokens.filter((t) => !LEGAL_ANYWHERE.has(t));
  while (tokens.length > 1 && LEGAL_TRAILING.has(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length === 1 && LEGAL_TRAILING.has(tokens[0])) tokens = [];

  const expansions: string[] = [];
  const out: string[] = [];
  tokens.forEach((t, i) => {
    let x = EXPANSIONS[t];
    if (t === "st" && i === 0) x = "saint";
    if (x && x !== t) {
      expansions.push(`${cap(t)} → ${x.split(" ").map(cap).join(" ")}`);
      out.push(...x.split(" "));
    } else {
      out.push(t);
    }
  });
  return { normalized: out.join(" "), expansions };
}

function cap(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Lowercase, strip accents and punctuation, drop legal suffixes (Pte Ltd, Sdn Bhd, Co Ltd, PLC, Inc, JSC,
 * Company Limited…) and expand common abbreviations (Hosp, Natl/Nat'l, Univ, Gen, Med, Ctr/Cntr/Center, Intl,
 * Dept, leading St → Saint).
 */
export function normalizeName(s: string): string {
  return normalizeDetailed(s).normalized;
}

// ---------------------------------------------------------------------------------------------
// Similarity primitives

/** Jaro-Winkler similarity (prefix scale 0.1, up to 4 chars, boost applied above 0.7 as in rapidfuzz). */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a.length ? 1 : 0;
  const l1 = a.length;
  const l2 = b.length;
  if (!l1 || !l2) return 0;
  const window = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1);
  const m1 = new Array<boolean>(l1).fill(false);
  const m2 = new Array<boolean>(l2).fill(false);
  let matches = 0;
  for (let i = 0; i < l1; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(l2, i + window + 1);
    for (let j = lo; j < hi; j++) {
      if (!m2[j] && a[i] === b[j]) {
        m1[i] = m2[j] = true;
        matches++;
        break;
      }
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  for (let i = 0, k = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3;
  if (jaro <= 0.7) return jaro;
  let prefix = 0;
  while (prefix < Math.min(4, l1, l2) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function lcsLength(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Normalised Indel similarity (rapidfuzz fuzz.ratio / 100). */
function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  if (!total) return 1;
  return (2 * lcsLength(a, b)) / total;
}

/** rapidfuzz-style token_set_ratio in 0..1 (tokens split on whitespace; no case folding). */
export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).sort();
  const diffA = [...ta].filter((t) => !tb.has(t)).sort();
  const diffB = [...tb].filter((t) => !ta.has(t)).sort();
  if (inter.length && (!diffA.length || !diffB.length)) return 1;
  const sect = inter.join(" ");
  const combA = [sect, diffA.join(" ")].filter(Boolean).join(" ");
  const combB = [sect, diffB.join(" ")].filter(Boolean).join(" ");
  const scores = [ratio(combA, combB)];
  if (sect) scores.push(ratio(sect, combA), ratio(sect, combB));
  return Math.max(...scores);
}

// ---------------------------------------------------------------------------------------------
// Name score

/** Per-token Jaro-Winkler below this counts as "different word", not a typo. */
const TOKEN_MATCH_MIN = 0.88;
/** Names made only of generic words can never reach the match threshold. */
const GENERIC_ONLY_CAP = 0.5;

/** Length-weighted share of `from`'s tokens that have a close (typo-tolerant) counterpart in `to`. */
function coverage(from: string[], to: string[]): number {
  let total = 0;
  let hit = 0;
  for (const t of from) {
    let best = 0;
    for (const u of to) best = Math.max(best, t === u ? 1 : jaroWinkler(t, u));
    total += t.length;
    if (best >= TOKEN_MATCH_MIN) hit += t.length * best;
  }
  return total ? hit / total : 0;
}

/**
 * Name similarity in 0..1 on normalised names.
 * Character-level evidence = max(Jaro-Winkler, token-set ratio). It is bounded by how much of the distinctive
 * (non-generic) wording the two names share, so "National Heart Centre" vs "National University Hospital" or a
 * bare "Hospital" cannot score highly just from a shared prefix or a generic word.
 */
export function nameSimilarity(a: string, b: string): number {
  return nameSimilarityNormalized(normalizeName(a), normalizeName(b));
}

function nameSimilarityNormalized(na: string, nb: string): number {
  if (!na || !nb) return 0;
  const ta = na.split(" ");
  const tb = nb.split(" ");
  const da = ta.filter((t) => !GENERIC.has(t));
  const db = tb.filter((t) => !GENERIC.has(t));
  const chars = Math.max(jaroWinkler(na, nb), tokenSetRatio(na, nb));
  if (!da.length || !db.length) return Math.min(chars, GENERIC_ONLY_CAP);
  if (na === nb) return 1;
  const distinctive = (coverage(da, db) + coverage(db, da)) / 2;
  return Math.min(chars, distinctive);
}

/** Single-token input such as "NUH" that spells the record's initials. */
function initialsMatch(inputNorm: string, recNorm: string): boolean {
  if (!/^[a-z]{3,6}$/.test(inputNorm)) return false;
  const initials = recNorm
    .split(" ")
    .filter((t) => t !== "the" && t !== "of" && t !== "and")
    .map((t) => t[0])
    .join("");
  return initials === inputNorm;
}

// ---------------------------------------------------------------------------------------------
// Pair scoring

const FREE_MAIL = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.com.sg",
  "yahoo.com.my",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "singnet.com.sg",
  "streamyx.com",
]);

const normTax = (s?: string) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const digits = (s?: string) => (s ?? "").replace(/\D/g, "");
const emailDomain = (s?: string) => {
  const m = /@([^\s@>]+)\s*$/.exec((s ?? "").trim().toLowerCase());
  return m ? m[1] : "";
};

const SIGNAL_BONUS = 0.03;
const TAX_ID_FLOOR = 0.97;
const INITIALS_SCORE = 0.88;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Score a candidate against an existing master record.
 * name = similarity of normalised names; exact tax ID lifts the score to ≥ 0.97 ("Same tax ID");
 * same postcode, phone number and (non-free-mail) email domain add 0.03 each; capped at 1.0.
 */
export function scorePair(input: DupInput, rec: CustomerMaster): { score: number; reasons: string[] } {
  const inName = normalizeDetailed(input.name ?? "");
  const recNorm = normalizeName(rec.cardName);
  const reasons: string[] = [];

  let name = nameSimilarityNormalized(inName.normalized, recNorm);
  if (name >= 0.6) {
    const pct = Math.round(name * 100);
    const viaExpansion =
      pct === 100 && inName.expansions.length > 0 && input.name.trim().toLowerCase() !== rec.cardName.trim().toLowerCase();
    reasons.push(viaExpansion ? `100% name match after expanding ${inName.expansions.join(", ")}` : `${pct}% name match`);
  }
  if (initialsMatch(inName.normalized, recNorm) && name < INITIALS_SCORE) {
    name = INITIALS_SCORE;
    reasons.push(`Initials match (${input.name.trim().toUpperCase()} = ${rec.cardName})`);
  }

  let score = name;
  const tax = normTax(input.taxId);
  if (tax.length >= 5 && tax === normTax(rec.licTradNum)) {
    score = Math.max(score, TAX_ID_FLOOR);
    reasons.unshift("Same tax ID");
  }

  const zip = digits(input.zipCode);
  if (zip.length >= 4 && zip === digits(rec.zipCode)) {
    score += SIGNAL_BONUS;
    reasons.push("Same postcode");
  }
  const p1 = digits(input.phone);
  const p2 = digits(rec.phone1);
  if (p1.length >= 7 && p2.length >= 7 && p1.slice(-8) === p2.slice(-8)) {
    score += SIGNAL_BONUS;
    reasons.push("Same phone number");
  }
  const d1 = emailDomain(input.email);
  if (d1 && !FREE_MAIL.has(d1) && d1 === emailDomain(rec.email)) {
    score += SIGNAL_BONUS;
    reasons.push(`Same email domain (${d1})`);
  }

  return { score: round3(Math.min(1, score)), reasons };
}

/**
 * Live duplicate check. Candidates are blocked on country (when given), plus any record with the same tax ID.
 * Names shorter than 3 normalised characters only surface exact tax ID hits. Returns the top `limit` (default 3)
 * matches scoring ≥ `threshold` (default 0.75), best first.
 */
export function findDuplicates(
  input: DupInput,
  masters: CustomerMaster[],
  opts?: { limit?: number; threshold?: number },
): DuplicateMatch[] {
  const limit = opts?.limit ?? 3;
  const threshold = opts?.threshold ?? 0.75;
  const tax = normTax(input.taxId);
  const hasTax = tax.length >= 5;
  const nameOk = normalizeName(input.name ?? "").replace(/\s/g, "").length >= 3;
  if (!nameOk && !hasTax) return [];

  const out: DuplicateMatch[] = [];
  for (const rec of masters) {
    const taxHit = hasTax && normTax(rec.licTradNum) === tax;
    if (!taxHit && (!nameOk || (input.country && rec.country !== input.country))) continue;
    const { score, reasons } = scorePair(nameOk ? input : { ...input, name: "" }, rec);
    if (score >= threshold) out.push({ record: rec, score, reasons });
  }
  out.sort((x, y) => y.score - x.score || x.record.cardCode.localeCompare(y.record.cardCode));
  return out.slice(0, Math.max(0, limit));
}
