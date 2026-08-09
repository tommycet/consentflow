#!/usr/bin/env bash
# Mux the Cap.so export with the edge-tts narration.
#
# The Cap recording starts ~1.5s before the scene driver begins (record start ->
# sleep 1.5 -> scenes.py), and the raw display track runs 141s vs 129.504s of
# narration. So: trim 1.5s off the head, keep exactly the narration duration.
# No stream_loop, no atempo — visuals and narration are already length-matched.
set -euo pipefail

cd /root/consentflow/demo

VIDEO_IN=cap-export.mp4
AUDIO_IN=narration.m4a
# Cap kept recording between the `record start` call and the scene driver
# launching in a separate shell invocation, so the real head offset is ~10s,
# not the 1.5s sleep. Measured from frame deltas against two anchors:
#   hero scroll onset   scene 12.26s -> export ~22.4s
#   participant nav     scene 49.85s -> export ~59.9s
# Both give offset ~= 10.0s. A frame-accurate sweep of the participant-page
# transition put it at 59.75-60.00s, so the precise offset is 10.15s.
# Verify with verify_sync.py after any re-record.
OFFSET=10.15
DUR=129.504

ffmpeg -y -ss "$OFFSET" -i "$VIDEO_IN" -i "$AUDIO_IN" \
  -map 0:v:0 -map 1:a:0 \
  -t "$DUR" \
  -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  consentflow-demo.mp4

echo "--- result"
ffprobe -v error -show_entries stream=codec_type,width,height,duration \
  -show_entries format=duration,size -of default=nw=1 consentflow-demo.mp4
ls -la consentflow-demo.mp4
