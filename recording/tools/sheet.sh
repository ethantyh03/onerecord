#!/bin/sh
# Contact sheet: sheet.sh <beat> <fps-interval-seconds> [start]  → deliverables/video/explore/sheet_<beat>_<n>.jpg (3x3 tiles)
FF=/c/Users/ethan/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin
B=$1; I=${2:-1}; S=${3:-0.5}
cd "$(dirname "$0")/../../deliverables/video" || exit 1
$FF/ffmpeg.exe -v error -y -ss $S -i beats/$B.mp4 -vf "fps=1/$I,scale=640:360,drawtext=fontfile=explore/arial.ttf:text='%{pts\:hms}':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=3x3" explore/sheet_${B}_%d.jpg
ls explore/sheet_${B}_*
