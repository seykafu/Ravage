"""Turn the camp's Codex renders into game assets.

Props are drawn at the unit sprites' pixel density: the camp shows every
art pixel at 2 world px, exactly as it shows the 32x40 unit sheets at
64x80, so a tent's pixels and a soldier's are the same size. Each prop is
keyed off its magenta, cropped, LANCZOS-downscaled (premultiplied) to fit
its cell with the base on the bottom edge, and its alpha hardened.

The flames are a strip of 8 poses, sliced evenly, scaled together so the
fire never changes size from frame to frame, bottom-aligned on a shared
baseline and centred on each flame's base.

The sky is a painted backdrop and is only re-encoded.

Usage:
  python scripts/art/process_camp_art.py <raw_dir> [id,id,...]

Writes public/assets/camp/*.png (+ sky.webp) and keeps every raw render in
art_sources/camp/<id>_src.png.
"""
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_anim_sheet import ROOT, key_magenta, resize_premultiplied  # noqa: E402

OUT = os.path.join(ROOT, "public", "assets", "camp")
KEEP = os.path.join(ROOT, "art_sources", "camp")

# id -> (output name, cell width, cell height) in art px.
PROPS = {
    "camp_firepit": ("firepit", 60, 30),
    "camp_tent": ("tent", 76, 58),
    "camp_log": ("log", 46, 16),
    "camp_crates": ("crates", 40, 34),
    "camp_lantern": ("lantern", 16, 48),
    "camp_pine": ("pine", 48, 88),
    # The wagon: the painted wagon the camp already had, at the new density.
    "wagon_painted": ("wagon", 108, 72),
    "memorial_painted": ("memorial", 26, 38),
}
FLAME_FRAMES = 8
FLAME_CELL = (34, 50)


def crop_to_content(keyed: np.ndarray) -> np.ndarray:
    m = keyed[..., 3] >= 128
    rows, cols = m.sum(axis=1), m.sum(axis=0)
    ys = np.nonzero(rows > max(1, rows.max() * 0.005))[0]
    xs = np.nonzero(cols > max(1, cols.max() * 0.005))[0]
    return keyed[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def harden(a: np.ndarray) -> np.ndarray:
    a[..., 3] = np.where(a[..., 3] >= 96, 255, 0)
    a[a[..., 3] == 0] = 0
    return a


def fit_prop(keyed: np.ndarray, W: int, H: int) -> np.ndarray:
    crop = crop_to_content(keyed)
    ch, cw = crop.shape[:2]
    scale = min((W - 1) / cw, (H - 1) / ch)
    small = resize_premultiplied(crop, scale)
    sh, sw = small.shape[:2]
    out = np.zeros((H, W, 4), dtype=np.float32)
    ox, oy = (W - sw) // 2, H - sh
    out[oy:oy + sh, ox:ox + sw] = small
    return harden(out)


def source_rgba(aid: str, raw_dir: str) -> np.ndarray:
    if aid == "wagon_painted":
        im = Image.open(os.path.join(ROOT, "art_sources", "camp", "wagon_painted.webp")).convert("RGBA")
        return np.asarray(im).astype(np.float32)
    if aid == "memorial_painted":
        im = Image.open(os.path.join(ROOT, "art_sources", "camp", "memorial_painted.webp")).convert("RGBA")
        return np.asarray(im).astype(np.float32)
    raw = os.path.join(raw_dir, f"{aid}.png")
    os.makedirs(KEEP, exist_ok=True)
    shutil.copyfile(raw, os.path.join(KEEP, f"{aid}_src.png"))
    return key_magenta(np.asarray(Image.open(raw).convert("RGB")))


def flames(raw_dir: str) -> None:
    raw = os.path.join(raw_dir, "camp_flames.png")
    os.makedirs(KEEP, exist_ok=True)
    shutil.copyfile(raw, os.path.join(KEEP, "camp_flames_src.png"))
    keyed = key_magenta(np.asarray(Image.open(raw).convert("RGB")))
    W = keyed.shape[1]
    step = W / FLAME_FRAMES
    parts = []
    for i in range(FLAME_FRAMES):
        sub = keyed[:, int(i * step):int((i + 1) * step)]
        m = sub[..., 3] >= 128
        ys, xs = np.nonzero(m)
        if len(ys) == 0:
            raise SystemExit(f"empty flame frame {i}")
        # The flame's base: the bottom tenth of its rows.
        bot = ys.max()
        base = xs[ys >= bot - max(2, (bot - ys.min()) // 10)]
        parts.append((sub, ys.min(), bot, float(base.mean())))
    tallest = max(b - t + 1 for _, t, b, _ in parts)
    cw, chh = FLAME_CELL
    scale = (chh - 1) / tallest
    sheet = np.zeros((chh, cw * FLAME_FRAMES, 4), dtype=np.float32)
    for i, (sub, top, bot, bx) in enumerate(parts):
        crop = sub[top:bot + 1]
        small = resize_premultiplied(crop, scale)
        sh, sw = small.shape[:2]
        cx = bx * scale
        ox = int(round(cw / 2 - cx))
        cell = np.zeros((chh, cw, 4), dtype=np.float32)
        x0, x1 = max(0, -ox), min(sw, cw - ox)
        cell[chh - sh:, x0 + ox:x1 + ox] = small[:, x0:x1]
        sheet[:, i * cw:(i + 1) * cw] = harden(cell)
    Image.fromarray(sheet.astype(np.uint8), "RGBA").save(os.path.join(OUT, "flames.png"))
    print(f"flames: {FLAME_FRAMES} frames of {cw}x{chh}, scale {scale:.4f}")


def sky(raw_dir: str) -> None:
    raw = os.path.join(raw_dir, "camp_sky.png")
    os.makedirs(KEEP, exist_ok=True)
    shutil.copyfile(raw, os.path.join(KEEP, "camp_sky_src.png"))
    Image.open(raw).convert("RGB").save(os.path.join(OUT, "sky.webp"), "WEBP", quality=88, method=6)
    print("sky: re-encoded")


def main() -> int:
    raw_dir = sys.argv[1]
    ids = sys.argv[2].split(",") if len(sys.argv) > 2 else [*PROPS, "camp_flames", "camp_sky"]
    os.makedirs(OUT, exist_ok=True)
    for aid in ids:
        if aid == "camp_flames":
            flames(raw_dir)
            continue
        if aid == "camp_sky":
            sky(raw_dir)
            continue
        name, W, H = PROPS[aid]
        out = fit_prop(source_rgba(aid, raw_dir), W, H)
        Image.fromarray(out.astype(np.uint8), "RGBA").save(os.path.join(OUT, f"{name}.png"))
        print(f"{name}: {W}x{H}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
