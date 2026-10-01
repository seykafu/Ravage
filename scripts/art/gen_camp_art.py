"""Generate the camp's art with Codex image generation.

One Codex run per asset: the prompt plus a style reference from the art
already in the game, rendered on flat #FF00FF magenta (props) or as a
full painted scene (the backdrop). Raw renders land in <out_dir>/<id>.png;
process them with process_prop.py / process_camp_art.py after review.

Usage:
  python scripts/art/gen_camp_art.py <out_dir> [id,id,...] [--jobs 4]
"""
import argparse
import concurrent.futures as cf
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RULES = """Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image."""

PROP = """You are generating game art. Use your built-in image generation tool to create ONE image. {rules}

The image: {what}

Style: the chunky painted pixel-art style of the attached reference image, with a dark outline, lit warmly from the RIGHT by a campfire off-picture (so the right side of the object is lit orange-gold and the left side falls into cool blue-grey night shadow). Seen from the front and slightly above, the three-quarter view a tactics game uses.

Rules: one single object, centred, the whole object in frame with its base near the bottom. Background: one flat, solid, pure magenta (#FF00FF) everywhere. No ground, no grass patch, no shadow on the ground, no other objects, no people, no text, no border."""

ASSETS = {
    "camp_sky": {
        "ref": "public/assets/backdrops/field_night_camp.webp",
        "prompt": """You are generating game art. Use your built-in image generation tool to create ONE image. """ + RULES + """

The image: a wide 16:9 painted night landscape in exactly the style of the attached reference (same palette, same painterly brushwork, same deep blue night). A starry night sky with the Milky Way and a few thin wispy clouds, a thin crescent moon in the upper right, distant blue-grey mountain ridges, and a dark pine forest treeline running across the picture at about 45% of its height. Below the treeline: an open, empty, dark grassy meadow that fades to near-black at the bottom of the picture.

IMPORTANT: no campfire, no fire, no glow on the ground, no tents, no bedrolls, no logs, no rocks in the foreground, no people, no animals, no buildings, no light sources of any kind on the ground, no text, no border. The lower half must be plain dark meadow so a game can draw its own camp on top of it."""
    },
    "camp_firepit": {
        "ref": "art_sources/camp/fire_painted.webp",
        "what": "a campfire pit: a ring of rough grey stones around a small pile of charred, crossed logs with glowing red-orange embers between them. NO flames at all, no smoke. The ring is an ellipse seen from slightly above, wider than it is tall."
    },
    "camp_flames": {
        "ref": "art_sources/camp/fire_painted.webp",
        "prompt": """You are generating game sprite art. Use your built-in image generation tool to create ONE image. """ + RULES + """

The image: an 8-frame looping animation strip of campfire FLAMES ONLY, in the chunky pixel-art style of the flames in the attached reference image: bright yellow-white core, orange body, red tips, a few small flying sparks. NO logs, NO stones, NO smoke, NO ground — only the flames.

Layout rules: all 8 frames in ONE horizontal row, left to right, evenly spaced, every frame the SAME width and about the SAME height (the flame dances and leans a little left and right from frame to frame but never shrinks to a small flame or grows to a huge one), the bottom of every flame on one shared baseline, no frame touching another. Background: one flat, solid, pure magenta (#FF00FF) everywhere. No text, no numbers, no borders. Wide landscape image."""
    },
    "camp_tent": {
        "ref": "art_sources/camp/wagon_painted.webp",
        "what": "a canvas A-frame camping tent with a wooden ridge pole and guy ropes staked into the ground, the front flap tied open showing a dark interior, weathered cream canvas the same colour as the reference wagon's cover. Three-quarter view, the open front facing the lower left."
    },
    "camp_log": {
        "ref": "public/assets/obstacles/tall/tree.png",
        "what": "a single fallen tree log lying on its side, used as a bench to sit on by a campfire: rough brown bark, a pale cut end with tree rings on the left end, a little moss. About four times as long as it is tall, lying horizontally."
    },
    "camp_crates": {
        "ref": "art_sources/camp/wagon_painted.webp",
        "what": "a small pile of travel supplies: two stacked wooden crates with iron corners, a wooden barrel beside them, and a tied burlap sack leaning against the barrel."
    },
    "camp_lantern": {
        "ref": "public/assets/obstacles/tall/pillar.png",
        "what": "a tall wooden post driven into the ground with a short arm at the top, and an iron lantern with amber glass panes hanging from the arm by a chain. The lantern glass glows warm amber. About four times as tall as it is wide."
    },
    "camp_pine": {
        "ref": "public/assets/obstacles/tall/tree.png",
        "what": "one tall dark evergreen pine tree with layered drooping boughs and a short trunk visible at the base, deep blue-green needles. About twice as tall as it is wide."
    },
}

PATH_RE = re.compile(r"([A-Za-z]:[\\/][^`'\"\n]*?generated_images[\\/][^`'\"\n]*?\.png)")


def run(aid: str, work: str) -> str:
    a = ASSETS[aid]
    prompt = a.get("prompt") or PROP.format(rules=RULES, what=a["what"])
    ref = os.path.join(ROOT, a["ref"])
    ref_png = os.path.join(work, "ref", os.path.basename(a["ref"]).rsplit(".", 1)[0] + ".png")
    if not os.path.exists(ref_png):
        from PIL import Image
        os.makedirs(os.path.dirname(ref_png), exist_ok=True)
        im = Image.open(ref).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
        bg.alpha_composite(im)
        if bg.width < 256:
            bg = bg.resize((bg.width * 6, bg.height * 6), Image.NEAREST)
        bg.convert("RGB").save(ref_png)
    out = os.path.join(work, f"{aid}.png")
    text = ""
    for _ in range(2):
        proc = subprocess.run(
            ["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", work, "--image", ref_png, "-"],
            input=prompt, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
            shell=(os.name == "nt"),
        )
        text = (proc.stdout or "") + (proc.stderr or "")
        paths = [p for p in PATH_RE.findall(text) if os.path.exists(p)]
        if paths:
            shutil.copyfile(paths[-1], out)
            return f"{aid}: ok"
    with open(os.path.join(work, f"{aid}.log"), "w", encoding="utf-8") as f:
        f.write(text)
    return f"{aid}: FAILED (log saved)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("ids", nargs="?", default=",".join(ASSETS))
    ap.add_argument("--jobs", type=int, default=4)
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    ids = args.ids.split(",")
    with cf.ThreadPoolExecutor(max_workers=args.jobs) as ex:
        for msg in ex.map(lambda i: run(i, args.out_dir), ids):
            print(msg, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
