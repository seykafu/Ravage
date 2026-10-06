"""Turn the ring scene's Codex renders into game assets.

  ring_cliff  re-encoded as public/assets/story/ring_cliff.webp (a painting:
              drawn with LINEAR filtering, so no pixel processing)
  ring        keyed off its magenta, de-spilled, cropped and downscaled to
              public/assets/story/ring.png with soft (not hardened) edges —
              it is a painted close-up, not pixel art

Raw renders are kept in art_sources/story/<id>_src.png.

Usage:
  python scripts/art/process_ring_art.py <raw_dir>
"""
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_anim_sheet import ROOT, key_magenta, resize_premultiplied  # noqa: E402

OUT = os.path.join(ROOT, "public", "assets", "story")
KEEP = os.path.join(ROOT, "art_sources", "story")
RING_SIZE = 420  # px on the long side: ~2x its on-screen size at native resolution


def main() -> int:
    raw = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(KEEP, exist_ok=True)

    shutil.copyfile(os.path.join(raw, "ring_cliff.png"), os.path.join(KEEP, "ring_cliff_src.png"))
    Image.open(os.path.join(raw, "ring_cliff.png")).convert("RGB").save(
        os.path.join(OUT, "ring_cliff.webp"), "WEBP", quality=88, method=6)

    shutil.copyfile(os.path.join(raw, "ring.png"), os.path.join(KEEP, "ring_src.png"))
    keyed = key_magenta(np.asarray(Image.open(os.path.join(raw, "ring.png")).convert("RGB")))
    m = keyed[..., 3] >= 24
    ys, xs = np.nonzero(m)
    pad = 6
    crop = keyed[max(0, ys.min() - pad):ys.max() + pad + 1, max(0, xs.min() - pad):xs.max() + pad + 1]
    scale = RING_SIZE / max(crop.shape[:2])
    small = resize_premultiplied(crop, scale)
    small[small[..., 3] < 8] = 0
    Image.fromarray(np.clip(small, 0, 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "ring.png"))
    print("ring_cliff.webp, ring.png", small.shape[1], "x", small.shape[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
