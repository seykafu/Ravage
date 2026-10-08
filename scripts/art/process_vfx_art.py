"""Turn Codex effect renders (gen_vfx_art.py) into engine strips.

Each render is one row of N frames on pure black. It is cut into N equal
cells; one square crop, the same for every cell (centred on the union of
what is lit in all of them, so the effect doesn't jump between frames), is
taken from each and scaled to 128x128. Black becomes transparent: each
pixel's alpha is its brightness and its colour is un-premultiplied, so the
strip draws with ordinary blending and reads as glowing light over any
background. (The game first drew the black strips additively, but the
battle's world camera renders into a buffer with no alpha outside the
board, where additive blending paints the black square in.)

Output: public/assets/vfx/<id>.png (128*N x 128). Raw render kept in
art_sources/vfx/<id>_src.png.

Usage:
  python scripts/art/process_vfx_art.py <raw_dir> [id,id,...]
"""
import glob
import os
import shutil
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "assets", "vfx")
KEEP = os.path.join(ROOT, "art_sources", "vfx")
FRAMES = {"slash": 5, "slash_crit": 5, "impact": 4, "heal": 5}
CELL = 128


def main() -> int:
    raw = sys.argv[1]
    ids = sys.argv[2].split(",") if len(sys.argv) > 2 else [
        os.path.basename(f)[:-4] for f in sorted(glob.glob(os.path.join(raw, "*.png")))
    ]
    os.makedirs(KEEP, exist_ok=True)
    for vid in ids:
        n = FRAMES[vid]
        src = os.path.join(raw, f"{vid}.png")
        shutil.copyfile(src, os.path.join(KEEP, f"{vid}_src.png"))
        im = Image.open(src).convert("RGB")
        a = np.asarray(im).astype(np.float32)
        lit = a.max(axis=2) > 14
        cw = im.width / n
        # The union of every cell's lit area, in cell coordinates.
        x0, y0, x1, y1 = cw, im.height, 0, 0
        for i in range(n):
            cell = lit[:, int(i * cw):int((i + 1) * cw)]
            ys, xs = np.nonzero(cell)
            if len(xs) == 0:
                continue
            x0, x1 = min(x0, xs.min()), max(x1, xs.max())
            y0, y1 = min(y0, ys.min()), max(y1, ys.max())
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        side = max(x1 - x0, y1 - y0) * 1.08 + 8
        # A soft fade at each cell's border: a neighbour's sparks that
        # strayed into the crop die out instead of ending in a hard edge.
        yy, xx = np.mgrid[0:CELL, 0:CELL]
        edge = np.minimum.reduce([xx, yy, CELL - 1 - xx, CELL - 1 - yy]).astype(np.float32)
        fade = np.clip(edge / (CELL * 0.12), 0, 1)[..., None]
        strip = Image.new("RGBA", (CELL * n, CELL), (0, 0, 0, 0))
        for i in range(n):
            left = i * cw + cx - side / 2
            box = (round(left), round(cy - side / 2), round(left + side), round(cy + side / 2))
            frame = im.crop(box).resize((CELL, CELL), Image.LANCZOS)
            rgb = np.asarray(frame).astype(np.float32) * fade
            alpha = np.clip(rgb.max(axis=2) / 255.0 * 1.1, 0, 1)
            col = np.clip(rgb / np.maximum(alpha, 1e-3)[..., None], 0, 255)
            rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
            strip.paste(Image.fromarray(rgba, "RGBA"), (i * CELL, 0))
        strip.save(os.path.join(OUT, f"{vid}.png"), optimize=True)
        print(f"{vid}.png {n} frames")
    return 0


if __name__ == "__main__":
    sys.exit(main())
