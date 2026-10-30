/**
 * Blind evaluation of the inbox-triage rules.
 *
 * Run (from the repository root):  npx tsx analytics/triage/eval_triage.ts
 *
 * Reads  analytics/triage/testset.json  (60 hand-labelled messages, 12 per type, written BEFORE the
 *        rules in src/lib/engine/triage.ts were read; never used to tune them)
 * Writes src/data/triage_eval.json      (contract: TriageEval in src/data/contract.ts)
 *        analytics/triage/eval_detail.json (every prediction, hard/easy split; for the team, not the app)
 */
import * as fs from "fs";
import * as path from "path";
import { classifyMessage } from "../../src/lib/engine/triage";
import type { MessageKind } from "../../src/lib/types";

interface TestMessage {
  id: string;
  subject: string;
  body: string;
  from: string;
  label: MessageKind;
  note: string;
  country?: string;
  hard?: boolean;
}
interface TestSetFile {
  name: string;
  sha256: string;
  messages: TestMessage[];
}

const LABELS: MessageKind[] = ["po", "pr", "enquiry", "followup", "mdm"];
const LABEL_TEXT: Record<MessageKind, string> = {
  po: "PO",
  pr: "purchase request",
  enquiry: "enquiry",
  followup: "follow-up",
  mdm: "MDM request",
};

const ROOT = process.cwd();
const TESTSET = path.resolve(ROOT, "analytics/triage/testset.json");
const OUT = path.resolve(ROOT, "src/data/triage_eval.json");
const DETAIL = path.resolve(ROOT, "analytics/triage/eval_detail.json");

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

function main(): void {
  if (!fs.existsSync(TESTSET)) {
    throw new Error(`Test set not found at ${TESTSET}. Run from the repo root.`);
  }
  const set = JSON.parse(fs.readFileSync(TESTSET, "utf-8")) as TestSetFile;
  const msgs = set.messages;

  const idx = new Map<MessageKind, number>(LABELS.map((l, i) => [l, i]));
  const confusion: number[][] = LABELS.map(() => LABELS.map(() => 0));

  type Row = TestMessage & { predicted: MessageKind; ok: boolean; reasons: string[]; confidence: number };
  const rows: Row[] = [];
  const unknownPredictions: { id: string; predicted: string }[] = [];

  for (const m of msgs) {
    const res = classifyMessage({ subject: m.subject, body: m.body, from: m.from });
    const predicted = res.kind;
    const reasons = Array.isArray(res.reasons) ? res.reasons.map(String) : [];
    const confidence = typeof res.confidence === "number" ? res.confidence : NaN;
    const a = idx.get(m.label);
    const p = idx.get(predicted);
    if (a === undefined) throw new Error(`Bad label ${m.label} on ${m.id}`);
    if (p === undefined) unknownPredictions.push({ id: m.id, predicted: String(predicted) });
    else confusion[a][p] += 1;
    rows.push({ ...m, predicted, ok: predicted === m.label, reasons, confidence });
  }

  const n = rows.length;
  const correct = rows.filter((r) => r.ok).length;
  const accuracy = safeDiv(correct, n);

  const perClass = LABELS.map((kind, i) => {
    const tp = confusion[i][i];
    const actualN = confusion[i].reduce((s, v) => s + v, 0) + unknownPredictions.filter((u) => rows.find((r) => r.id === u.id)?.label === kind).length;
    const predN = confusion.reduce((s, row) => s + row[i], 0);
    const precision = safeDiv(tp, predN);
    const recall = safeDiv(tp, actualN);
    const f1 = safeDiv(2 * precision * recall, precision + recall);
    return { kind, precision: round3(precision), recall: round3(recall), n: actualN, f1 };
  });
  const macroF1 = perClass.reduce((s, c) => s + c.f1, 0) / LABELS.length;

  const hardRows = rows.filter((r) => r.hard);
  const easyRows = rows.filter((r) => !r.hard);
  const hardAcc = safeDiv(hardRows.filter((r) => r.ok).length, hardRows.length);
  const easyAcc = safeDiv(easyRows.filter((r) => r.ok).length, easyRows.length);

  // ---- up to 6 error examples, spread across distinct (actual -> predicted) confusions, most frequent first
  const errorsAll = rows.filter((r) => !r.ok);
  const pairCount = new Map<string, number>();
  for (const e of errorsAll) {
    const k = `${e.label}>${e.predicted}`;
    pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
  }
  const sortedErrors = [...errorsAll].sort((x, y) => {
    const cx = pairCount.get(`${x.label}>${x.predicted}`) ?? 0;
    const cy = pairCount.get(`${y.label}>${y.predicted}`) ?? 0;
    return cy - cx || x.id.localeCompare(y.id);
  });
  const picked: Row[] = [];
  const seenPairs = new Set<string>();
  for (const e of sortedErrors) {
    const k = `${e.label}>${e.predicted}`;
    if (!seenPairs.has(k)) {
      picked.push(e);
      seenPairs.add(k);
    }
    if (picked.length >= 6) break;
  }
  for (const e of sortedErrors) {
    if (picked.length >= 6) break;
    if (!picked.includes(e)) picked.push(e);
  }

  const why = (e: Row): string => {
    const rule = e.reasons.length ? `Rules saw: ${e.reasons.slice(0, 2).join("; ").replace(/\.$/, "")}.` : "Rules gave no reason.";
    return `${rule} Actually a ${LABEL_TEXT[e.label]}: ${e.note.replace(/^Hard:\s*/i, "")}`;
  };
  const errors = picked.map((e) => ({
    id: e.id,
    subject: e.subject,
    actual: e.label,
    predicted: e.predicted,
    why: why(e),
  }));

  const per100 = Math.round(accuracy * 100);
  const hardPer100 = Math.round(hardAcc * 100);
  const out = {
    isMock: false,
    status: "final" as const,
    testSet:
      `${n} hand-labelled messages (${LABELS.map((l) => `${perClass.find((c) => c.kind === l)?.n ?? 0} ${l}`).join(", ")}) ` +
      `in regional English (Singlish, Malaysian, Thai/Vietnamese/Myanmar English, terse, forwarded threads), ` +
      `written blind before the rules were read and never used to tune them. ${hardRows.length} are deliberately tricky ` +
      `(PO numbers inside follow-ups, enquiries with quantities, MDM asks inside orders). ` +
      `Accuracy on tricky ones: ${round3(hardAcc)}; on plain ones: ${round3(easyAcc)}.`,
    testSetSize: n,
    accuracy: round3(accuracy),
    macroF1: round3(macroF1),
    labels: LABELS,
    confusion,
    perClass: perClass.map(({ kind, precision, recall, n: cn }) => ({ kind, precision, recall, n: cn })),
    plain:
      `On ${n} messages written without seeing the rules, the rules put ${per100} of every 100 in the right stream ` +
      `(${hardPer100} of 100 on the ${hardRows.length} deliberately tricky ones). A person still confirms every routing.`,
    errors,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n", "utf-8");

  const detail = {
    testSet: set.name,
    testSetSha256: set.sha256,
    n,
    accuracy: round3(accuracy),
    accuracyHard: round3(hardAcc),
    accuracyEasy: round3(easyAcc),
    nHard: hardRows.length,
    nEasy: easyRows.length,
    macroF1: round3(macroF1),
    perClass: perClass.map((c) => ({ ...c, f1: round3(c.f1) })),
    confusionPairs: Object.fromEntries([...pairCount.entries()].sort((a, b) => b[1] - a[1])),
    unknownPredictions,
    predictions: rows.map((r) => ({
      id: r.id,
      label: r.label,
      predicted: r.predicted,
      ok: r.ok,
      hard: !!r.hard,
      country: r.country,
      confidence: r.confidence,
      reasons: r.reasons,
      subject: r.subject,
    })),
  };
  fs.writeFileSync(DETAIL, JSON.stringify(detail, null, 1) + "\n", "utf-8");

  // ---- console report
  const pad = (s: string, w: number) => (s + " ".repeat(w)).slice(0, w);
  console.log(`Blind triage eval: n=${n}  accuracy=${round3(accuracy)}  macroF1=${round3(macroF1)}  hard=${round3(hardAcc)} (${hardRows.length})  easy=${round3(easyAcc)} (${easyRows.length})`);
  console.log(pad("actual\\pred", 12) + LABELS.map((l) => pad(l, 9)).join(""));
  LABELS.forEach((l, i) => console.log(pad(l, 12) + confusion[i].map((v) => pad(String(v), 9)).join("")));
  for (const c of perClass) console.log(`${pad(c.kind, 9)} P=${c.precision.toFixed(3)} R=${c.recall.toFixed(3)} F1=${c.f1.toFixed(3)} n=${c.n}`);
  if (unknownPredictions.length) console.log("Predictions outside the 5 labels:", unknownPredictions);
  console.log(`Errors (${errorsAll.length}):`);
  for (const e of sortedErrors) console.log(`  ${e.id} ${e.label} -> ${e.predicted}${e.hard ? " [hard]" : ""} | ${e.subject} | ${e.reasons.join("; ")}`);
  console.log(`Wrote ${OUT}\nWrote ${DETAIL}`);
}

main();
