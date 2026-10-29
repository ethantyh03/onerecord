/**
 * Display formatting shared by every screen. Pure functions, no React.
 * All simulated times are shown in Singapore time (SGT, UTC+8).
 */

export const SGT_TZ = "Asia/Singapore";

const sgtDateTime = new Intl.DateTimeFormat("en-SG", {
  timeZone: SGT_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const sgtDate = new Intl.DateTimeFormat("en-SG", {
  timeZone: SGT_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const sgtTime = new Intl.DateTimeFormat("en-SG", {
  timeZone: SGT_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const sgtWeekdayDate = new Intl.DateTimeFormat("en-SG", {
  timeZone: SGT_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});

function toDate(v: string | number | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function valid(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/** ICU's en-SG short month for September is "Sept"; every other month is three letters, so show "Sep". */
function noSept(s: string): string {
  return s.replace(/Sept(?![a-z])/g, "Sep");
}

/** "Wed 28 Oct, 10:42" in SGT */
export function formatSgtDateTime(v: string | number | Date): string {
  const d = toDate(v);
  if (!valid(d)) return "—";
  const parts = Object.fromEntries(sgtDateTime.formatToParts(d).map((p) => [p.type, p.value]));
  return noSept(`${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`);
}

/** "28 Oct 2026" in SGT */
export function formatSgtDate(v: string | number | Date): string {
  const d = toDate(v);
  return valid(d) ? noSept(sgtDate.format(d)) : "—";
}

/** "10:42" in SGT */
export function formatSgtTime(v: string | number | Date): string {
  const d = toDate(v);
  return valid(d) ? sgtTime.format(d) : "—";
}

/** "Wed 28 Oct" in SGT */
export function formatSgtDay(v: string | number | Date): string {
  const d = toDate(v);
  return valid(d) ? noSept(sgtWeekdayDate.format(d)) : "—";
}

/** S$310,400 (whole dollars) or, with compact, S$310k / S$1.2M */
export function formatSgd(amount: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(amount)) return "S$0";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (opts.compact) {
    if (abs >= 1_000_000) return `${sign}S$${trimZero((abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1))}M`;
    if (abs >= 10_000) return `${sign}S$${Math.round(abs / 1_000)}k`;
    if (abs >= 1_000) return `${sign}S$${trimZero((abs / 1_000).toFixed(1))}k`;
  }
  return `${sign}S$${Math.round(abs).toLocaleString("en-SG")}`;
}

/** 1.25 → "1.3", 2 → "2", 0.04 → "0" */
export function formatDays(days: number): string {
  if (!Number.isFinite(days)) return "0";
  return trimZero(Math.abs(days).toFixed(1));
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Relative time against the simulated clock: "just now", "12 min ago", "3 h ago", "2 d ago" */
export function formatAgo(atIso: string, nowIso: string): string {
  const diff = new Date(nowIso).getTime() - new Date(atIso).getTime();
  if (!Number.isFinite(diff)) return "";
  if (diff < 0) return formatSgtDateTime(atIso);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d} d ago`;
  return formatSgtDate(atIso);
}

/** "Amy Lim" → "AL"; honorifics are skipped ("Dr Ploy Srisuk" → "PS") */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(dr|mr|mrs|ms|prof)$/i.test(w));
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? (words[1][0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** First name for friendly copy. Handles family-name-first names used in the seed. */
export function firstName(name: string): string {
  const known: Record<string, string> = {
    "Tan Wei Jie": "Wei Jie",
    "Nguyen Thi Lan": "Lan",
    "Kyaw Zin Htet": "Kyaw",
    "Chua Mei Ling": "Mei Ling",
    "Lim Jun Hao": "Jun Hao",
    "Dr Ploy Srisuk": "Ploy",
  };
  if (known[name]) return known[name];
  return name.split(/\s+/)[0] ?? name;
}
