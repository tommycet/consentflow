#!/usr/bin/env bash
# Mux the corrected Cap.so export (take 2) with the edge-tts narration.
#
# Take 2 timing: `record start` -> reset -> sleep 0.6 -> scenes.py, and the raw
# display track ran 131.907s vs 129.504s of narration. Trim 0.6s off the head
# and cap at the narration duration. No stream_loop, no atempo.
set -euo pipefail

cd /root/consentflow/demo

VIDEO_IN=cap-export2.mp4
AUDIO_IN=narration.m4a
OFFSET=0.6
DUR=129.504

ffmpeg -y -ss "$OFFSET" -i "$VIDEO_IN" -i "$AUDIO_IN" \
  -map 0:v:0 -map 1:a:0 \
  -t "$DUR" \
  -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  consentflow-demo-v2.mp4

echo "--- result"
ffprobe -v error -show_entries stream=codec_type,width,height,duration \
  -show_entries format=duration,size -of default=nw=1 consentflow-demo-v2.mp4
ls -la consentflow-demo-v2.mp4
