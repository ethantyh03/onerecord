"""Synthesise each storyboard beat with edge-tts (one voice throughout), write <beat>.mp3 + <beat>.srt
(sentence timings) into deliverables/video/vo/, and store the measured durations back in storyboard.json.
Usage: python recording/tts.py [beat ...]   (no args = all beats)"""
import json, subprocess, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
FFPROBE = r"C:/Users/ethan/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffprobe.exe"
sb_path = ROOT / "recording" / "storyboard.json"
sb = json.loads(sb_path.read_text(encoding="utf-8"))
voice, rate = sb["tts"]["voice"], sb["tts"]["rate"]
out = ROOT / "deliverables" / "video" / "vo"
out.mkdir(parents=True, exist_ok=True)
only = set(sys.argv[1:])
for b in sb["beats"]:
    if only and b["id"] not in only:
        continue
    mp3, srt = out / f"{b['id']}.mp3", out / f"{b['id']}.srt"
    subprocess.run([sys.executable, "-m", "edge_tts", "--voice", voice, f"--rate={rate}", "--text", b["vo"],
                    "--write-media", str(mp3), "--write-subtitles", str(srt)], check=True)
    d = float(subprocess.check_output([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)]).decode().strip())
    b["voSeconds"] = round(d, 2)
    b["words"] = len(b["vo"].split())
    print(f"{b['id']:8s} {d:6.2f}s {b['words']} words")
sb_path.write_text(json.dumps(sb, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("total VO", round(sum(b["voSeconds"] for b in sb["beats"]), 2))
