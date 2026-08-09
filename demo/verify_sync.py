"""Verify narration/visual sync by sampling frames at every clip boundary.

For each narration clip we extract the frame at (clip_start + 2s) and describe
what should be on screen there. Blank-frame detection: if one color covers
>95% of the frame the scene never rendered.
"""
import json
import subprocess
import sys
from pathlib import Path

VIDEO = sys.argv[1] if len(sys.argv) > 1 else "consentflow-demo.mp4"
OUT = Path("frames")
OUT.mkdir(exist_ok=True)

EXPECT = {
    "01_hero": "landing hero — 'Consent that stays in your hands'",
    "02_arch": "architecture diagram / flow steps",
    "03_evidence": "integration rails, contract addresses, security",
    "04_participant": "participant page, showcase wallet connected",
    "05_consent": "study id + purpose filled, create on-chain",
    "06_researcher": "researcher page, queue access request",
    "07_audit": "audit trail with filters",
    "08_docs": "docs page sidebar section",
}


def dur(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip())


clips = json.load(open("narration.json"))
t = 0.0
rows = []
for c in clips:
    d = dur(f"audio/{c['id']}.mp3")
    probe_at = t + min(2.5, d / 2)
    png = OUT / f"{c['id']}.png"
    subprocess.run(
        ["ffmpeg", "-y", "-ss", f"{probe_at:.2f}", "-i", VIDEO,
         "-frames:v", "1", str(png)],
        capture_output=True,
    )
    ok = png.exists() and png.stat().st_size > 0
    verdict = "NO_FRAME"
    if ok:
        from PIL import Image
        im = Image.open(png).convert("RGB")
        cols = sorted(im.getcolors(im.size[0] * im.size[1]), reverse=True)
        cov = 100 * cols[0][0] / (im.size[0] * im.size[1])
        verdict = f"top_color={cols[0][1]} cov={cov:.1f}% distinct={len(cols)}"
        if cov > 95:
            verdict = "BLANK " + verdict
    rows.append((c["id"], f"{t:6.2f}", f"{probe_at:6.2f}", verdict, EXPECT[c["id"]]))
    t += d

print(f"{'clip':16s} {'start':>7s} {'probe':>7s}  verdict")
for r in rows:
    print(f"{r[0]:16s} {r[1]:>7s} {r[2]:>7s}  {r[3]}")
    print(f"{'':16s} {'':>7s} {'':>7s}  expect: {r[4]}")
print(f"\nnarration total {t:.2f}s | video {dur(VIDEO):.2f}s")
