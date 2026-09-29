"""Turn a generated full-resolution animation render into an engine sheet.

The unit sprites are 32x40 pixel frames in horizontal strips
(public/assets/sprites/<class>/<state>.png). Source art arrives as a large
render: N poses of one character in a row on flat #FF00FF magenta. This is
the same pipeline art_sources/README.md documents for the idle sheets,
extended to N frames and to matching an EXISTING idle sheet exactly:

  1. Chroma-key the magenta (with de-spill on the anti-aliased rim).
  2. Split the poses: the N largest connected blobs are the poses, and
     every other pixel belongs to the nearest one — so a spear thrust
     that reaches past the next figure's shoulder, which no column split
     can separate, still lands in its own frame and nowhere else. Falls
     back to runs of occupied columns, then to N equal slices.
  3. One scale for the whole sheet, so the figure never breathes in size
     from frame to frame: the idle frame's BODY height over the render's
     most upright pose (a flinch or a lunge is crouched; matching one of
     those to a standing idle blew the figure up). Body = rows at least a
     quarter as wide as the widest row, so a spear or a raised sword
     (thin) doesn't count and can't shrink the figure.
     --fit shrinks any single frame that is still wider than the cell —
     the last frames of a death, lying full length — rather than cutting
     the head off at the cell edge.
  4. Premultiplied LANCZOS downscale (plain RGBA resize bleeds the magenta
     behind every edge into the rim), feet on the idle's foot row, legs
     centred where the idle's legs are.
  5. Alpha hardened to binary (>= 96 -> 255), as every shipped sheet is.

Usage:
  python scripts/art/process_anim_sheet.py <raw.png> <class> <state> <frames>
      [--scale-frame K | --scale-median] [--preview out.png]

Writes public/assets/sprites/<class>/<state>.png and keeps the raw render
in art_sources/sprites/<class>_<state>_src.png (sources are never lost).
"""
import argparse
import os
import shutil
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CELL_W, CELL_H = 32, 40
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def key_magenta(rgb: np.ndarray) -> np.ndarray:
    """RGBA float array with magenta keyed out and its spill removed."""
    r, g, b = rgb[..., 0].astype(float), rgb[..., 1].astype(float), rgb[..., 2].astype(float)
    # How magenta a pixel is: red and blue both high, green low, red ~ blue.
    m = np.minimum(r, b) - g - 0.5 * np.abs(r - b)
    alpha = np.clip(1.0 - (m - 45.0) / 95.0, 0.0, 1.0)  # m <= 45 opaque, >= 140 clear
    # De-spill: wherever red AND blue both stand above green, that excess
    # is magenta the render bled in — rims, and glints the image model
    # tinted pink. Pull it back out. Nothing in the unit palettes is
    # magenta or purple (the navy robes have red at green's level), so
    # this only ever strips contamination.
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    r2 = np.clip(r - spill, 0, 255)
    b2 = np.clip(b - spill, 0, 255)
    out = np.stack([r2, g, b2, alpha * 255.0], axis=-1)
    return out


def body_metrics(mask: np.ndarray):
    rows = mask.sum(axis=1)
    ys = np.nonzero(rows)[0]
    if len(ys) == 0:
        return None
    thr = max(2, 0.25 * rows.max())
    body_rows = np.nonzero(rows >= thr)[0]
    top, bot = int(body_rows.min()), int(ys.max())
    h = bot - top + 1
    band = mask[max(0, bot - int(h * 0.45)):bot + 1]
    _, cx = np.nonzero(band)
    xs = np.nonzero(mask.sum(axis=0))[0]
    return {"top": top, "bottom": bot, "h": h, "legs_cx": float(cx.mean()),
            "x0": int(xs.min()), "x1": int(xs.max()), "y0": int(ys.min())}


def split_frames(mask: np.ndarray, n: int):
    """Column ranges, one per pose."""
    W = mask.shape[1]
    cols = mask.sum(axis=0) > 0
    runs, x = [], 0
    while x < W:
        if cols[x]:
            s = x
            while x < W and cols[x]:
                x += 1
            runs.append([s, x])
        else:
            x += 1
    # Drop specks, then merge fragments into their nearest neighbour until
    # we have n (a spear tip separated from its figure by a gap of air).
    runs = [r for r in runs if (r[1] - r[0]) > W * 0.004 or mask[:, r[0]:r[1]].sum() > 400]
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    if len(runs) == n:
        # Widen each range halfway into the gaps so a figure is never cut.
        out = []
        for i, (a, b) in enumerate(runs):
            lo = 0 if i == 0 else (runs[i - 1][1] + a) // 2
            hi = W if i == n - 1 else (b + runs[i + 1][0]) // 2
            out.append((lo, hi))
        return out, "gaps"
    step = W / n
    return [(int(i * step), int((i + 1) * step)) for i in range(n)], "equal"


def split_components(keyed: np.ndarray, mask: np.ndarray, n: int):
    """One RGBA image per pose, other poses' pixels removed; None if unsure."""
    lab, k = ndimage.label(mask, structure=np.ones((3, 3), dtype=bool))
    if k < n:
        return None
    sizes = ndimage.sum(mask, lab, index=np.arange(1, k + 1))
    big = np.argsort(sizes)[::-1][:n] + 1
    if sizes[big[-1] - 1] < 0.25 * sizes[big[0] - 1]:
        return None  # a pose broken into pieces, or a stray blob as big as one
    cx = ndimage.center_of_mass(mask, lab, index=big)
    big = [b for _, b in sorted(zip([c[1] for c in cx], big))]
    frame_of = np.zeros(k + 1, dtype=np.int32) - 1
    for i, b in enumerate(big):
        frame_of[b] = i
    # Everything else — specks, a detached spear tip, the soft rim the
    # threshold left out — goes to the pose whose blob is nearest.
    core = np.isin(lab, big)
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    owner = frame_of[lab[iy, ix]]
    out = []
    for i in range(n):
        own = (owner == i) & (keyed[..., 3] > 0)
        ys, xs = np.nonzero(own & mask)
        y0, y1 = max(0, ys.min() - 4), min(mask.shape[0], ys.max() + 5)
        x0, x1 = max(0, xs.min() - 4), min(mask.shape[1], xs.max() + 5)
        img = keyed[y0:y1, x0:x1].copy()
        img[~own[y0:y1, x0:x1]] = 0
        out.append(img)
    return out


def resize_premultiplied(rgba: np.ndarray, scale: float) -> np.ndarray:
    h, w = rgba.shape[:2]
    a = rgba[..., 3:4] / 255.0
    pm = np.concatenate([rgba[..., :3] * a, rgba[..., 3:4]], axis=-1)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    chans = [np.asarray(Image.fromarray(pm[..., c].astype(np.float32), mode="F").resize((nw, nh), Image.LANCZOS))
             for c in range(4)]
    out = np.stack(chans, axis=-1)
    out = np.clip(out, 0, 255)
    alpha = out[..., 3:4] / 255.0
    rgb = np.where(alpha > 0.001, out[..., :3] / np.maximum(alpha, 0.001), 0)
    return np.concatenate([np.clip(rgb, 0, 255), out[..., 3:4]], axis=-1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("raw")
    ap.add_argument("cls")
    ap.add_argument("state")
    ap.add_argument("frames", type=int)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--scale-frame", type=int, help="frame whose body height sets the scale (default: tallest)")
    g.add_argument("--scale-median", action="store_true", help="median body height over frames")
    ap.add_argument("--fit", action="store_true", help="shrink frames wider than the cell to fit it")
    ap.add_argument("--body-scale", type=float, default=1.0, help="nudge the fitted scale")
    ap.add_argument("--preview")
    ap.add_argument("--ref-class", help="measure against this class's idle (a new class has none yet)")
    ap.add_argument("--ref-scale", type=float, default=1.0,
                    help="target body height as a multiple of the reference idle's")
    args = ap.parse_args()

    idle_path = os.path.join(ROOT, "public", "assets", "sprites", args.ref_class or args.cls, "idle.png")
    idle = np.asarray(Image.open(idle_path).convert("RGBA"))[:, :CELL_W]
    ref = body_metrics(idle[..., 3] >= 96)
    ref["h"] = round(ref["h"] * args.ref_scale)

    raw = Image.open(args.raw).convert("RGB")
    keyed = key_magenta(np.asarray(raw))
    mask = keyed[..., 3] >= 128
    parts = split_components(keyed, mask, args.frames)
    how = "blobs"
    if parts is None:
        ranges, how = split_frames(mask, args.frames)
        parts = [keyed[:, lo:hi] for lo, hi in ranges]

    frames = []
    for sub in parts:
        m = sub[..., 3] >= 128
        met = body_metrics(m)
        if met is None:
            print("empty frame", file=sys.stderr)
            return 1
        frames.append((sub, met))

    hs = [f[1]["h"] for f in frames]
    if args.scale_median:
        src_h = float(np.median(hs))
    elif args.scale_frame is not None:
        src_h = float(hs[args.scale_frame])
    else:
        src_h = float(max(hs))
    scale = ref["h"] / src_h * args.body_scale

    sheet = np.zeros((CELL_H, CELL_W * args.frames, 4), dtype=np.float32)
    report = []
    for i, (sub, met) in enumerate(frames):
        small = resize_premultiplied(sub, scale)
        sm = body_metrics(small[..., 3] >= 96)
        if sm is None:
            report.append(f"frame {i}: vanished at this scale")
            continue
        fitted = ""
        width = sm["x1"] - sm["x0"] + 1
        if args.fit and width > CELL_W - 2:
            k = (CELL_W - 2) / width
            small = resize_premultiplied(sub, scale * k)
            sm = body_metrics(small[..., 3] >= 96)
            fitted = f"  fitted x{k:.2f}"
        # Feet on the idle's foot row; legs where the idle's legs are —
        # or, for a frame shrunk to fit, centred in the cell.
        dy = ref["bottom"] - sm["bottom"]
        if fitted:
            dx = round((CELL_W - 1) / 2 - (sm["x0"] + sm["x1"]) / 2)
        else:
            dx = round(ref["legs_cx"] - sm["legs_cx"])
            # A frame that fits the cell but would hang off one side (a
            # thrust reaching past the edge) is nudged back inside. A few
            # px of drift mid-lunge doesn't read; a sword with no tip does.
            if sm["x1"] - sm["x0"] + 1 <= CELL_W:
                dx = min(max(dx, -sm["x0"]), CELL_W - 1 - sm["x1"])
            else:
                # Wider than the cell (a horizontal spear is longer than a
                # frame is wide): step back up to 8px so the business end
                # stays in frame, and let the butt behind the body go.
                over = sm["x1"] + dx - (CELL_W - 1)
                if over > 0:
                    dx -= min(over, 8)
        cell = np.zeros((CELL_H, CELL_W, 4), dtype=np.float32)
        H, W = small.shape[:2]
        for y in range(H):
            ty = y + dy
            if not 0 <= ty < CELL_H:
                continue
            x0, x1 = max(0, -dx), min(W, CELL_W - dx)
            if x0 < x1:
                cell[ty, x0 + dx:x1 + dx] = small[y, x0:x1]
        clipped = (sm["x0"] + dx < 0) or (sm["x1"] + dx >= CELL_W) or (sm["y0"] + dy < 0)
        cell[..., 3] = np.where(cell[..., 3] >= 96, 255, 0)
        cell[cell[..., 3] == 0] = 0
        sheet[:, i * CELL_W:(i + 1) * CELL_W] = cell
        report.append(f"frame {i}: body {sm['h']}px (idle {ref['h']}), "
                      f"width {sm['x1'] - sm['x0'] + 1}px{fitted}{'  CLIPPED at the cell edge' if clipped else ''}")

    out_dir = os.path.join(ROOT, "public", "assets", "sprites", args.cls)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{args.state}.png")
    Image.fromarray(sheet.astype(np.uint8), "RGBA").save(out_path)
    src_keep = os.path.join(ROOT, "art_sources", "sprites", f"{args.cls}_{args.state}_src.png")
    if os.path.abspath(args.raw) != os.path.abspath(src_keep):
        shutil.copyfile(args.raw, src_keep)

    if args.preview:
        full = Image.open(out_path).convert("RGBA")
        idle_img = Image.open(idle_path).convert("RGBA").crop((0, 0, CELL_W, CELL_H))
        strip = Image.new("RGBA", (CELL_W * (args.frames + 1) + 4, CELL_H), (70, 110, 70, 255))
        strip.alpha_composite(idle_img, (0, 0))
        strip.alpha_composite(full, (CELL_W + 4, 0))
        strip.resize((strip.width * 6, strip.height * 6), Image.NEAREST).save(args.preview)

    print(f"{args.cls}/{args.state}: {args.frames} frames split by {how}, scale {scale:.4f}")
    for line in report:
        print("  " + line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
