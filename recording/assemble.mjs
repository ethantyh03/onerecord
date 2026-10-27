// Assemble the demo video from the recorded beats + TTS voice-over.
// Usage: node recording/assemble.mjs [--cuts]      (--cuts = hard cuts instead of 0.25 s crossfades)
// Inputs:  deliverables/video/beats/<beat>.mp4 + .json (from record.mjs), deliverables/video/vo/<beat>.mp3/.srt
// Outputs: deliverables/video/OneRecord-demo.mp4, OneRecord-demo-silent.mp4, OneRecord-demo.srt, voiceover-script.md
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, OUT, FFMPEG, FFPROBE, FPS, captionChunks } from "./lib.mjs";
import { BEATS, ORDER } from "./beats.mjs";

const XF = process.argv.includes("--cuts") ? 0 : 0.25;
const sb = JSON.parse(fs.readFileSync(path.join(ROOT, "recording", "storyboard.json"), "utf8"));
const run = (args, label) => {
  const r = spawnSync(FFMPEG, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) { console.error(r.stderr); throw new Error(`ffmpeg failed: ${label}`); }
  return r.stderr;
};
const probe = (f) => +spawnSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim();

// ---- timeline -------------------------------------------------------------------------------
const beats = ORDER.map((id) => {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, "beats", `${id}.json`), "utf8"));
  const video = path.join(OUT, "beats", `${id}.mp4`);
  const vo = path.join(OUT, "vo", `${id}.mp3`);
  const sbBeat = sb.beats.find((b) => b.id === id);
  const vd = probe(video);
  if (Math.abs(vd - meta.duration) > 0.1) console.warn(`! ${id}: video ${vd.toFixed(2)}s vs planned ${meta.duration}s`);
  const voDur = probe(vo);
  if (meta.voOffset + voDur > meta.duration + 0.01) console.warn(`! ${id}: VO (${voDur.toFixed(2)}s + ${meta.voOffset}s) longer than the beat (${meta.duration}s); it will be clipped`);
  return { id, video, vo, D: meta.duration, voOffset: meta.voOffset, sbBeat, voDur, def: BEATS[id] };
});
let t = 0;
// Crossfade length into beat k: 0.25 s by default; a beat can ask for a shorter one (BEATS[id].xfadeIn, e.g. amy, so Home and New request don't ghost).
const xfInto = (k) => (XF && k > 0 && k < beats.length ? (beats[k].def.xfadeIn ?? XF) : 0);
for (const [k, b] of beats.entries()) { b.start = t; t += b.D - (k < beats.length - 1 ? xfInto(k + 1) : 0); }
const total = t;
// keep storyboard.json's slot times in step with the real cut
for (const b of beats) { b.sbBeat.slotStart = +b.start.toFixed(2); b.sbBeat.slotEnd = +(b.start + b.D).toFixed(2); b.sbBeat.voStart = +(b.start + b.voOffset).toFixed(2); }
fs.writeFileSync(path.join(ROOT, "recording", "storyboard.json"), JSON.stringify(sb, null, 2) + "\n", "utf8");
console.log(`timeline: ${beats.map((b) => `${b.id} ${b.D.toFixed(2)}`).join(" · ")}  → total ${total.toFixed(2)}s (${XF ? "0.25 s crossfades" : "hard cuts"})`);

const tmp = path.join(OUT, "_tmp");
fs.mkdirSync(tmp, { recursive: true });

// ---- 1. voice-over track (each beat padded/trimmed to its length, crossfaded like the picture) --------
{
  const args = ["-y", "-v", "error"];
  beats.forEach((b) => args.push("-i", b.vo));
  const f = [];
  beats.forEach((b, k) => {
    const ms = Math.round(b.voOffset * 1000);
    f.push(`[${k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${ms}:all=1,apad=whole_dur=${b.D},atrim=0:${b.D},asetpts=N/SR/TB[a${k}]`);
  });
  let last = "a0";
  for (let k = 1; k < beats.length; k++) {
    const o = `ax${k}`;
    f.push(XF ? `[${last}][a${k}]acrossfade=d=${xfInto(k)}:c1=tri:c2=tri[${o}]` : `[${last}][a${k}]concat=n=2:v=0:a=1[${o}]`);
    last = o;
  }
  args.push("-filter_complex", f.join(";"), "-map", `[${last}]`, "-c:a", "pcm_s16le", path.join(tmp, "vo-raw.wav"));
  run(args, "vo track");
  // two-pass loudnorm to -16 LUFS
  const m = run(["-hide_banner", "-i", path.join(tmp, "vo-raw.wav"), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], "loudnorm measure");
  const j = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
  run(["-y", "-v", "error", "-i", path.join(tmp, "vo-raw.wav"), "-af",
    `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`,
    "-c:a", "pcm_s16le", path.join(tmp, "vo.wav")], "loudnorm apply");
  console.log(`loudnorm: input ${j.input_i} LUFS → target -16 LUFS`);
}

// ---- 2. picture (crossfades) + mux ------------------------------------------------------------
const final = path.join(OUT, "OneRecord-demo.mp4");
{
  const args = ["-y", "-v", "error"];
  beats.forEach((b) => args.push("-i", b.video));
  args.push("-i", path.join(tmp, "vo.wav"));
  const f = [];
  beats.forEach((b, k) => f.push(`[${k}:v]fps=${FPS},settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v${k}]`));
  let last = "v0";
  for (let k = 1; k < beats.length; k++) {
    const o = `vx${k}`;
    f.push(XF ? `[${last}][v${k}]xfade=transition=fade:duration=${xfInto(k)}:offset=${beats[k].start.toFixed(3)}[${o}]` : `[${last}][v${k}]concat=n=2:v=1:a=0[${o}]`);
    last = o;
  }
  args.push("-filter_complex", f.join(";"), "-map", `[${last}]`, "-map", `${beats.length}:a`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-g", String(FPS * 2),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", total.toFixed(3), "-movflags", "+faststart", final);
  run(args, "final");
  run(["-y", "-v", "error", "-i", final, "-map", "0:v", "-c", "copy", "-an", "-movflags", "+faststart", path.join(OUT, "OneRecord-demo-silent.mp4")], "silent");
}

// ---- 3. captions (.srt) -----------------------------------------------------------------------
const tc = (s, sep = ",") => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${sep}${String(r).padStart(3, "0")}`;
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
{
  const cues = [];
  for (const b of beats) {
    for (const c of captionChunks(b.sbBeat, b.voOffset, b.D)) {
      cues.push({ a: b.start + c.start, z: b.start + Math.min(c.showUntil, c.end + 0.5), text: c.text });
    }
  }
  for (let i = 0; i < cues.length - 1; i++) cues[i].z = Math.min(cues[i].z, cues[i + 1].a - 0.02);
  const srt = cues.map((c, i) => `${i + 1}\n${tc(c.a)} --> ${tc(c.z)}\n${c.text}\n`).join("\n");
  fs.writeFileSync(path.join(OUT, "OneRecord-demo.srt"), srt, "utf8");
}

// ---- 4. voice-over script for the student's own narration -------------------------------------
{
  const voTotal = beats.reduce((a, b) => a + b.voDur, 0);
  const intro =
    `Read this over the silent cut (\`OneRecord-demo-silent.mp4\`, **${mmss(total)}**). Each beat below gives its window in the video and the moment to **start speaking** ` +
    `(the TTS take, ${sb.tts.voice} at ${sb.tts.rate}, starts there in \`OneRecord-demo.mp4\`). The TTS voice-over itself runs **${mmss(voTotal)}**; the rest is holds. ` +
    `The hard ceiling is 2:55. The same text is in \`recording/storyboard.json\`, and the captions are in \`OneRecord-demo.srt\`.`;
  const header = fs.readFileSync(path.join(ROOT, "recording", "vo-script-header.md"), "utf8").replace("{{INTRO}}", intro);
  const parts = [header.trimEnd(), "", "---", ""];
  beats.forEach((b, k) => {
    const end = b.start + b.D - (k < beats.length - 1 ? xfInto(k + 1) : 0);
    parts.push(`### ${k + 1}. ${b.sbBeat.title} (${mmss(b.start)}–${mmss(end)})`);
    parts.push(`**Start speaking at ${mmss(b.start + b.voOffset)}** (${(b.start + b.voOffset).toFixed(1)} s) · TTS line lasts ${b.voDur.toFixed(1)} s · window ${(end - b.start).toFixed(1)} s`);
    parts.push("");
    parts.push(`**On screen:** ${b.def.onScreen}`);
    parts.push("");
    parts.push(`> ${b.sbBeat.read}`);
    if (b.sbBeat.note) parts.push("", b.sbBeat.note);
    parts.push("");
  });
  parts.push("---", "");
  parts.push(`**TTS takes** (in \`deliverables/video/vo/\`, ${sb.tts.voice} at ${sb.tts.rate}): ` +
    beats.map((b) => `${b.id} ${b.voDur.toFixed(1)} s`).join(" · ") + ` · **total ${mmss(voTotal)}**. Video: **${mmss(total)}** (${total.toFixed(1)} s).`);
  parts.push("");
  parts.push("**Re-render after a change.** Edit the beat in `recording/beats.mjs` (or its VO in `recording/storyboard.json`, then `python recording/tts.py <beat>`), " +
    "re-record just that beat with `node recording/record.mjs <beat>`, and re-run `node recording/assemble.mjs`. For example, if the live URL on the close card changes: " +
    "rebuild/restart the app, then `node recording/record.mjs close && node recording/assemble.mjs` (about 2 minutes).");
  fs.writeFileSync(path.join(OUT, "voiceover-script.md"), parts.join("\n") + "\n", "utf8");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`done: ${final} (${probe(final).toFixed(2)}s)`);
