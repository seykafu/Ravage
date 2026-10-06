"""Turn the story cinematics' Codex renders into game assets.

  throne_hall, harbor_night, open_sea
              paintings: re-encoded as public/assets/story/<id>.webp (drawn
              with LINEAR filtering, so no pixel processing)
  ship, ravage_ship
              keyed off their magenta, de-spilled, cropped and downscaled to
              public/assets/story/<id>.webp with soft edges — painted objects,
              not pixel art

Raw renders are kept in art_sources/story/<id>_src.png.

Usage:
  python scripts/art/process_story_art.py <raw_dir> [id,id,...]
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
PAINTINGS = ["throne_hall", "harbor_night", "open_sea"]
# Long side in px: about 1.5x the largest the scenes draw them.
OBJECTS = {"ship": 960, "ravage_ship": 1400}


def main() -> int:
    raw = sys.argv[1]
    ids = sys.argv[2].split(",") if len(sys.argv) > 2 else PAINTINGS + list(OBJECTS)
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(KEEP, exist_ok=True)
    for aid in ids:
        src = os.path.join(raw, f"{aid}.png")
        shutil.copyfile(src, os.path.join(KEEP, f"{aid}_src.png"))
        if aid in PAINTINGS:
            Image.open(src).convert("RGB").save(os.path.join(OUT, f"{aid}.webp"), "WEBP", quality=86, method=6)
            print(f"{aid}.webp")
            continue
        keyed = key_magenta(np.asarray(Image.open(src).convert("RGB")))
        m = keyed[..., 3] >= 24
        ys, xs = np.nonzero(m)
        pad = 6
        crop = keyed[max(0, ys.min() - pad):ys.max() + pad + 1, max(0, xs.min() - pad):xs.max() + pad + 1]
        scale = OBJECTS[aid] / max(crop.shape[:2])
        small = resize_premultiplied(crop, scale)
        small[small[..., 3] < 8] = 0
        # Lossy WebP keeps the alpha and is a fifth of the PNG's size.
        Image.fromarray(np.clip(small, 0, 255).astype(np.uint8), "RGBA").save(
            os.path.join(OUT, f"{aid}.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
        print(f"{aid}.webp", small.shape[1], "x", small.shape[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
