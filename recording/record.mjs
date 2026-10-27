// Record beats of the demo video. Usage: node recording/record.mjs [beat ...]   (no args = all beats)
// Each beat → deliverables/video/beats/<beat>.mp4 (silent, exact beat length) + <beat>.json.
// Then run: node recording/assemble.mjs
import fs from "node:fs";
import path from "node:path";
import { recordBeat, ROOT, BASE } from "./lib.mjs";
import { BEATS, ORDER } from "./beats.mjs";

const sb = JSON.parse(fs.readFileSync(path.join(ROOT, "recording", "storyboard.json"), "utf8"));
const want = process.argv.slice(2).length ? process.argv.slice(2) : ORDER;
const res = await fetch(BASE + "/demo").catch(() => null);
if (!res || !res.ok) { console.error(`App not reachable at ${BASE}`); process.exit(1); }
let failed = 0;
for (const id of want) {
  const def = BEATS[id];
  const sbBeat = sb.beats.find((b) => b.id === id);
  if (!def || !sbBeat) { console.error(`unknown beat ${id}`); failed++; continue; }
  const t = Date.now();
  try {
    const meta = await recordBeat(def, sbBeat);
    console.log(`${id}: ${meta.duration}s, ${meta.frames} frames, ${((Date.now() - t) / 1000).toFixed(1)}s wall${meta.log.length ? "\n  ! " + meta.log.join("\n  ! ") : ""}`);
  } catch (e) {
    failed++;
    console.error(`${id}: FAILED ${e.stack || e}`);
  }
}
process.exit(failed ? 1 : 0);
