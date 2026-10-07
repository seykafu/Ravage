"""Generate painted combat effects (slashes, impacts, healing) with Codex.

Effects are drawn on PURE BLACK, not magenta: the game blends them
additively, where black is simply nothing — no keying, no fringe on the
glow. Each render is one row of N frames; process_vfx_art.py cuts it into
the engine strip.

Usage:
  python scripts/art/gen_vfx_art.py <out_dir> [id,id,...]
"""
import argparse
import concurrent.futures as cf
import os
import re
import shutil
import subprocess
import sys

RULES = "Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image."

LAYOUT = """Layout rules:
- All {n} frames in ONE horizontal row, left to right, evenly spaced, each frame in its own square cell of the same size, the effect centred in its cell at the same scale in every frame.
- Background: pure, flat black (#000000) everywhere. No gradient, no ground, no characters, no weapons, no text, no numbers, no borders.
- The effect never touches its cell's edges.
- Wide landscape image, about {n} times as wide as it is tall."""

VFX = {
    "slash": (5, "a single sword-slash effect, painted game VFX: a bright curved crescent of light sweeping from upper left to lower right, a hot white leading edge fading into pale silver and a faint cool-blue glow, motion-blurred. Frame 1 a thin sliver beginning the arc; 2 half the arc; 3 the full crescent, brightest; 4 the arc breaking into fading streaks; 5 faint wisps almost gone."),
    "slash_crit": (5, "a heavy critical sword-slash effect, painted game VFX: a wide crescent of blazing gold and white light sweeping from upper left to lower right, sparks flying off its outer edge, motion-blurred. Frame 1 a thin blazing sliver; 2 half the arc with the first sparks; 3 the full crescent at its brightest, sparks spraying; 4 the arc tearing into streaks and sparks; 5 a few fading embers."),
    "impact": (4, "a hit-impact burst, painted game VFX: frame 1 a small hot white star flash; frame 2 a bright starburst with sharp rays and a ring of sparks; frame 3 the burst expanding and breaking into scattered sparks; frame 4 a few fading embers. White and warm gold."),
    "heal": (5, "a healing effect, painted game VFX: soft green and gold motes of light and small glowing sparkles rising in a gentle spiral above a faint glowing ring on the ground. Frame 1 the ring appearing; 2 the first motes rising; 3 a full gentle column of rising sparkles, brightest; 4 the sparkles drifting higher and thinning; 5 a few last motes fading."),
}

PATH_RE = re.compile(r"([A-Za-z]:[\\/][^`'\"\n]*?generated_images[\\/][^`'\"\n]*?\.png)")


def run(vid: str, work: str) -> str:
    n, desc = VFX[vid]
    prompt = (
        "You are generating game art. Use your built-in image generation tool to create ONE image. " + RULES +
        f"\n\nThe image: a {n}-frame animation strip of {desc}\n\n" + LAYOUT.format(n=n)
    )
    out = os.path.join(work, f"{vid}.png")
    text = ""
    for _ in range(2):
        proc = subprocess.run(
            ["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", work, "-"],
            input=prompt, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
            shell=(os.name == "nt"),
        )
        text = (proc.stdout or "") + (proc.stderr or "")
        paths = [p for p in PATH_RE.findall(text) if os.path.exists(p)]
        if paths:
            shutil.copyfile(paths[-1], out)
            return f"{vid}: ok"
        if "usage limit" in text.lower():
            break
    with open(os.path.join(work, f"{vid}.log"), "w", encoding="utf-8") as f:
        f.write(text)
    return f"{vid}: FAILED (log saved)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("ids", nargs="?", default=",".join(VFX))
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    ids = [i for i in a.ids.split(",") if i]
    with cf.ThreadPoolExecutor(max_workers=len(ids)) as ex:
        for msg in ex.map(lambda i: run(i, a.out_dir), ids):
            print(msg, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
