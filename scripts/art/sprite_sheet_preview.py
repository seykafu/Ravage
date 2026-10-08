"""Preview unit sprite sheets: every state's frames for each class, enlarged.

Usage: python scripts/art/sprite_sheet_preview.py <out.png> <class>[,<class>...] [--scale 3]
"""
import argparse
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATES = [("idle", 2), ("walk", 4), ("attack", 5), ("hit", 2), ("death", 4)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("classes")
    ap.add_argument("--scale", type=int, default=3)
    a = ap.parse_args()
    k = a.scale
    classes = a.classes.split(",")
    cols = sum(n for _, n in STATES) + len(STATES)
    W, H = 32 * k, 40 * k
    sheet = Image.new("RGBA", (cols * W, len(classes) * (H + 14)), (58, 66, 84, 255))
    d = ImageDraw.Draw(sheet)
    for r, cls in enumerate(classes):
        x = 0
        for state, n in STATES:
            path = os.path.join(ROOT, "public", "assets", "sprites", cls, f"{state}.png")
            d.text((x + 2, r * (H + 14)), f"{cls} {state}", fill=(255, 220, 90))
            if os.path.exists(path):
                im = Image.open(path).convert("RGBA")
                for i in range(n):
                    f = im.crop((i * 32, 0, i * 32 + 32, 40)).resize((W, H), Image.NEAREST)
                    sheet.alpha_composite(f, (x + i * W, r * (H + 14) + 14))
            x += (n + 1) * W
    sheet.save(a.out)
    print(a.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
