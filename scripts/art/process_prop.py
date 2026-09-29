"""Turn a generated full-resolution prop render into a diorama prop sprite.

The ¾ board stands props up as billboards. The original obstacle art in
public/assets/obstacles/ is painted for the flat, top-down board (a tree
is a canopy seen from above), so the diorama has its own standing
versions in public/assets/obstacles/tall/.

Pipeline (the sprite pipeline's rules): chroma-key flat #FF00FF magenta,
crop to the prop, premultiplied LANCZOS downscale to fit a W x H box with
the base on the bottom edge and centred, alpha hardened to binary.

Usage:
  python scripts/art/process_prop.py <raw.png> <id> <width> <height>

Writes public/assets/obstacles/tall/<id>.png and keeps the raw render in
art_sources/obstacles/<id>_tall_src.png.
"""
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_anim_sheet import ROOT, key_magenta, resize_premultiplied  # noqa: E402


def main() -> int:
    if len(sys.argv) != 5:
        print(__doc__)
        return 2
    raw, pid, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    keyed = key_magenta(np.asarray(Image.open(raw).convert("RGB")))
    m = keyed[..., 3] >= 128
    # The largest blob is the prop; stray specks elsewhere are dropped by
    # cropping to the bounding box of rows/columns that carry real mass.
    rows, cols = m.sum(axis=1), m.sum(axis=0)
    ys = np.nonzero(rows > max(2, rows.max() * 0.01))[0]
    xs = np.nonzero(cols > max(2, cols.max() * 0.01))[0]
    crop = keyed[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    ch, cw = crop.shape[:2]
    scale = min((W - 1) / cw, (H - 1) / ch)
    small = resize_premultiplied(crop, scale)
    sh, sw = small.shape[:2]
    out = np.zeros((H, W, 4), dtype=np.float32)
    ox, oy = (W - sw) // 2, H - sh
    out[oy:oy + sh, ox:ox + sw] = small
    out[..., 3] = np.where(out[..., 3] >= 96, 255, 0)
    out[out[..., 3] == 0] = 0
    dst_dir = os.path.join(ROOT, "public", "assets", "obstacles", "tall")
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, f"{pid}.png")
    Image.fromarray(out.astype(np.uint8), "RGBA").save(dst)
    keep_dir = os.path.join(ROOT, "art_sources", "obstacles")
    os.makedirs(keep_dir, exist_ok=True)
    shutil.copyfile(raw, os.path.join(keep_dir, f"{pid}_tall_src.png"))
    print(f"{pid}: {sw}x{sh} in a {W}x{H} cell, scale {scale:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
