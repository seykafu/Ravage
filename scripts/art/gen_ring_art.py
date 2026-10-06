"""Generate the art for the ring scene (the wedding codas) with Codex.

Two images, each from a prompt plus a style reference already in the game:
  ring_cliff  the clifftop at sunset the scene plays on (16:9 painting)
  ring        the ring Amar holds out (painted object on flat magenta)

Raw renders land in <out_dir>/<id>.png; process them with
process_ring_art.py after review.

Usage:
  python scripts/art/gen_ring_art.py <out_dir> [id,id,...]
"""
import argparse
import concurrent.futures as cf
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RULES = "Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image."

ASSETS = {
    "ring_cliff": {
        "ref": "public/assets/backdrops/cliffs.webp",
        "prompt": """You are generating game art. Use your built-in image generation tool to create ONE image. """ + RULES + """

The image: a wide 16:9 painted landscape in exactly the painterly style of the attached reference (same brushwork, same level of detail). A grassy clifftop high above a calm sea, at sunset. The sun sits low on the sea horizon, right of centre, and the sky is deep amber, rose and violet with a few long thin clouds lit gold from below; the sea far below holds a long glittering path of light. The clifftop runs across the whole bottom third of the picture as an open, flat, grassy ledge with a few wildflowers, its edge falling away to the sea on the right. One windswept tree leans in from the far left edge. The middle of the ledge, from about 35% to 70% of the width, is open grass with nothing on it.

IMPORTANT: no people, no figures, no animals, no buildings, no boats, no text, no border, no frame."""
    },
    "ring": {
        "ref": "art_sources/camp/wagon_painted.webp",
        "prompt": """You are generating game art. Use your built-in image generation tool to create ONE image. """ + RULES + """

The image: one gold ring, in the richly painted style of the attached reference. A simple, slightly worn band of warm gold set with a single round stone the deep amber-red of a sunset, seen at a three-quarter angle so both the band's curve and the stone show. Warm low sunlight from the right catches the gold along one edge and glints in the stone; a small bright sparkle on the stone. Large and centred, filling about 70% of the picture.

Background: one flat, solid, pure magenta (#FF00FF) everywhere. No hand, no box, no cushion, no shadow, no surface, no other objects, no text, no border."""
    },
}

PATH_RE = re.compile(r"([A-Za-z]:[\\/][^`'\"\n]*?generated_images[\\/][^`'\"\n]*?\.png)")


def run(aid: str, work: str) -> str:
    a = ASSETS[aid]
    ref_png = os.path.join(work, "ref", os.path.basename(a["ref"]).rsplit(".", 1)[0] + ".png")
    if not os.path.exists(ref_png):
        from PIL import Image
        os.makedirs(os.path.dirname(ref_png), exist_ok=True)
        im = Image.open(os.path.join(ROOT, a["ref"])).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
        bg.alpha_composite(im)
        bg.convert("RGB").save(ref_png)
    out = os.path.join(work, f"{aid}.png")
    text = ""
    for _ in range(2):
        proc = subprocess.run(
            ["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", work, "--image", ref_png, "-"],
            input=a["prompt"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
            shell=(os.name == "nt"),
        )
        text = (proc.stdout or "") + (proc.stderr or "")
        paths = [p for p in PATH_RE.findall(text) if os.path.exists(p)]
        if paths:
            shutil.copyfile(paths[-1], out)
            return f"{aid}: ok"
    with open(os.path.join(work, f"{aid}.log"), "w", encoding="utf-8") as f:
        f.write(text)
    return f"{aid}: FAILED (log saved)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("ids", nargs="?", default=",".join(ASSETS))
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    ids = args.ids.split(",")
    with cf.ThreadPoolExecutor(max_workers=len(ids)) as ex:
        for msg in ex.map(lambda i: run(i, args.out_dir), ids):
            print(msg, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
