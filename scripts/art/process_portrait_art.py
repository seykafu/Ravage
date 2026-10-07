"""Turn Codex portrait renders into game portraits.

Each <raw_dir>/<file>.png (painted on flat magenta) is keyed to real
alpha, de-spilled, brought to the portrait spec (1024x1536, 2:3) and
written to public/assets/portraits/<file>.webp, its soft edges recoloured
from the solid figure beside them (no pink fringe on fine hair). The raw
render is kept in
art_sources/portraits/<file>_src.png.

Usage:
  python scripts/art/process_portrait_art.py <raw_dir> [file,file,...]
"""
import glob
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_anim_sheet import ROOT, key_magenta  # noqa: E402

OUT = os.path.join(ROOT, "public", "assets", "portraits")
KEEP = os.path.join(ROOT, "art_sources", "portraits")
SIZE = (1024, 1536)


def _blur(a: np.ndarray, r: int) -> np.ndarray:
    """Box blur, two passes each way: close enough to a gaussian."""
    def box(x: np.ndarray, axis: int) -> np.ndarray:
        c = np.cumsum(np.pad(x, [(r + 1, r) if i == axis else (0, 0) for i in range(2)]), axis=axis)
        hi = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
        return (hi - lo) / (2 * r + 1)
    x = a.astype(np.float64)
    for _ in range(2):
        x = box(box(x, 0), 1)
    return x


def clean_edge(rgba: np.ndarray, raw: np.ndarray, rim: int = 8, reach: int = 6) -> np.ndarray:
    """Recolour the silhouette's rim from the clean figure beside it.

    Fine hair is drawn half into the magenta: its strands and their dark
    ink outlines come out part magenta. The key makes the faint ones
    translucent, but reads the dark outlines as solid, and the de-spill
    can't tell a pink-tinted strand from a warm one — so fine hair kept a
    pink fringe. Near the edge of the figure (within `rim` px of clear
    background), any pixel that is translucent or still carries magenta
    in the render takes the colour of the clean, solid pixels around it,
    keeping its alpha.
    """
    alpha = rgba[..., 3] / 255.0
    r, g, b = raw[..., 0].astype(float), raw[..., 1].astype(float), raw[..., 2].astype(float)
    tinted = (np.minimum(r, b) - g) > 20
    near_edge = _blur((alpha == 0).astype(float), rim // 2) > 1e-4
    clean = (alpha > 0.92) & ~tinted
    target = near_edge & (alpha > 0) & ((alpha <= 0.92) | tinted)
    w = _blur(clean.astype(float), reach)
    out = rgba.copy()
    has = target & (w > 1e-3)
    for c in range(3):
        ext = _blur(rgba[..., c] * clean, reach) / np.maximum(w, 1e-6)
        out[..., c] = np.where(has, ext, out[..., c])
    # Strays with no clean neighbour in reach: drop the tint (grey them).
    lone = target & ~has
    luma = 0.3 * out[..., 0] + 0.59 * out[..., 1] + 0.11 * out[..., 2]
    for c in range(3):
        out[..., c] = np.where(lone, luma, out[..., c])
    return out


def main() -> int:
    raw = sys.argv[1]
    ids = sys.argv[2].split(",") if len(sys.argv) > 2 else [
        os.path.basename(f)[:-4] for f in sorted(glob.glob(os.path.join(raw, "*.png")))
    ]
    os.makedirs(KEEP, exist_ok=True)
    for fid in ids:
        src = os.path.join(raw, f"{fid}.png")
        shutil.copyfile(src, os.path.join(KEEP, f"{fid}_src.png"))
        im = Image.open(src).convert("RGB")
        if im.size != SIZE:
            # Cover the 2:3 frame, anchored at the top (the head).
            s = max(SIZE[0] / im.size[0], SIZE[1] / im.size[1])
            im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
            x = (im.size[0] - SIZE[0]) // 2
            im = im.crop((x, 0, x + SIZE[0], SIZE[1]))
        rgb = np.asarray(im)
        keyed = clean_edge(key_magenta(rgb), rgb)
        keyed[keyed[..., 3] < 8] = 0
        out = Image.fromarray(np.clip(keyed, 0, 255).astype(np.uint8), "RGBA")
        out.save(os.path.join(OUT, f"{fid}.webp"), "WEBP", quality=88, alpha_quality=100, method=6)
        print(f"{fid}.webp")
    return 0


if __name__ == "__main__":
    sys.exit(main())
