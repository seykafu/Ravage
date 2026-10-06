"""Contact sheet of a cineProbe run: every frame, small, labelled with its time.

Usage: python scripts/capture/contact.py <frames_dir> <out.png> [cols=5] [width=384]
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
w = int(sys.argv[4]) if len(sys.argv) > 4 else 384
files = sorted(glob.glob(os.path.join(src, "*.png")))
h = w * 9 // 16
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (20, 20, 20))
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((w, h))
    d = ImageDraw.Draw(im)
    t = os.path.basename(f)[:-4]
    # cineProbe frames are t<tenths>; sampled record.mjs frames <shot>_<frame>.
    label = f"{int(t[1:]) / 10:.1f}s" if t[0] == "t" and t[1:].isdigit() else t
    d.text((4, 4), label, fill=(255, 255, 0))
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
print(out, len(files), "frames")
