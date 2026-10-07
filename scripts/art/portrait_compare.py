"""Side-by-side of portraits — existing files and fresh renders — on mid grey.

Usage:
  python scripts/art/portrait_compare.py <out.png> <img> [<img> ...] [--size 300] [--faces]
    <img>: a path, or a portrait name (looked up in public/assets/portraits)
"""
import argparse
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "public", "assets", "portraits")


def load(src: str) -> Image.Image:
    path = src if os.path.exists(src) else os.path.join(DIR, src + ".webp")
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (110, 110, 110, 255))
    bg.alpha_composite(im)
    return bg.convert("RGB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("imgs", nargs="+")
    ap.add_argument("--size", type=int, default=300)
    ap.add_argument("--faces", action="store_true")
    a = ap.parse_args()
    w = a.size
    h = int(w * (0.85 if a.faces else 1.5))
    sheet = Image.new("RGB", (w * len(a.imgs), h + 18), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for i, src in enumerate(a.imgs):
        im = load(src)
        iw, ih = im.size
        if a.faces:
            top = 0.04 if ih > iw else 0.02
            im = im.crop((int(iw * 0.1), int(ih * top), int(iw * 0.9), int(ih * top + iw * 0.8 * 0.85)))
        im.thumbnail((w, h))
        sheet.paste(im, (i * w + (w - im.size[0]) // 2, 18))
        d.text((i * w + 3, 3), os.path.basename(src)[:40], fill=(255, 220, 90))
    sheet.save(a.out)
    print(a.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
