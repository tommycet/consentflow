#!/usr/bin/env bash
# Mux the take-3 Cap.so export with the edge-tts narration.
# Take 3: record start -> reset -> sleep 0.6 -> scenes.py; raw track 131.799s
# vs 129.504s narration. Trim the 0.6s head, cap at narration length.
set -euo pipefail

cd /root/consentflow/demo

ffmpeg -y -ss 0.6 -i cap-export3.mp4 -i narration.m4a \
  -map 0:v:0 -map 1:a:0 \
  -t 129.504 \
  -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  consentflow-demo-final.mp4

echo "--- result"
ffprobe -v error -show_entries stream=codec_type,width,height,duration \
  -show_entries format=duration,size -of default=nw=1 consentflow-demo-final.mp4
ls -la consentflow-demo-final.mp4
