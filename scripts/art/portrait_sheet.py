"""Contact sheets of the portrait sets, for consistency audits.

One row per character: the default portrait (as the game resolves it,
DEFAULT_VARIANT_FOR) then every expression file, each on mid grey with its
filename. Pass character ids to limit the sheet.

Usage:
  python scripts/art/portrait_sheet.py <out.png> [id,id,...] [--size 220] [--faces]
    --faces  crop to the head (the top half) to compare features up close
"""
import argparse
import glob
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "public", "assets", "portraits")


def sets() -> dict:
    out: dict = {}
    for f in sorted(glob.glob(os.path.join(DIR, "*.webp")) + glob.glob(os.path.join(DIR, "*.png"))):
        name = os.path.basename(f).rsplit(".", 1)[0]
        cid = name.split("_", 1)[0]
        out.setdefault(cid, []).append((name, f))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("ids", nargs="?", default="")
    ap.add_argument("--size", type=int, default=220)
    ap.add_argument("--faces", action="store_true")
    a = ap.parse_args()
    all_sets = sets()
    ids = [i for i in a.ids.split(",") if i] or sorted(all_sets)
    w = a.size
    h = int(w * (0.85 if a.faces else 1.5))
    cols = max(len(all_sets[i]) for i in ids if i in all_sets)
    sheet = Image.new("RGB", (cols * w, len(ids) * (h + 18)), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for r, cid in enumerate(ids):
        for c, (name, f) in enumerate(all_sets.get(cid, [])):
            im = Image.open(f).convert("RGBA")
            # Fit 2:3 (square sources letterboxed) on mid grey.
            bg = Image.new("RGBA", im.size, (110, 110, 110, 255))
            bg.alpha_composite(im)
            im = bg.convert("RGB")
            iw, ih = im.size
            if a.faces:
                # The head: the top half of a 2:3 bust (scaled for square sources).
                top = 0.04 if ih > iw else 0.02
                im = im.crop((int(iw * 0.1), int(ih * top), int(iw * 0.9), int(ih * top + iw * 0.8 * 0.85)))
            im.thumbnail((w, h))
            x, y = c * w + (w - im.size[0]) // 2, r * (h + 18) + 18
            sheet.paste(im, (x, y))
            d.text((c * w + 3, r * (h + 18) + 3), f"{name} {iw}x{ih}", fill=(255, 220, 90))
    sheet.save(a.out)
    print(a.out, len(ids), "characters")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
