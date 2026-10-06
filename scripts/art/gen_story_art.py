"""Generate the art for the story cinematics with Codex.

Each image is a prompt plus a style reference already in the game:
  throne_hall   the palace throne hall the night of the coup (16:9 painting)
  harbor_night  Para Harbor from the cliffs at moonrise (16:9 painting)
  open_sea      open ocean, no land, a big morning sky (16:9 painting)
  ship          Khione's ship, broadside, bow to the right (on flat magenta)
  ravage_ship   a Ravage sky-ship, descending (on flat magenta)

Raw renders land in <out_dir>/<id>.png; process them with
process_story_art.py after review.

Usage:
  python scripts/art/gen_story_art.py <out_dir> [id,id,...]
"""
import argparse
import concurrent.futures as cf
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RULES = "Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image."
HEAD = "You are generating game art. Use your built-in image generation tool to create ONE image. " + RULES + "\n\n"
PAINTING = "a wide 16:9 painted scene in exactly the painterly style of the attached reference (same brushwork, same level of detail, same palette handling)"
MAGENTA = "Background: one flat, solid, pure magenta (#FF00FF) everywhere around the object, including every gap between ropes, masts and sails. No sea, no sky, no ground, no shadow, no glow or haze outside the object's own edges, no other objects, no text, no border."

ASSETS = {
    "throne_hall": {
        "ref": "public/assets/backdrops/palaceCoup.webp",
        "prompt": HEAD + "The image: " + PAINTING + """. The great throne hall of a royal palace at night, seen from the entrance looking down its whole length. A long polished marble floor, tall stone columns on both sides, long crimson banners with a gold sun emblem hanging between them, iron braziers burning orange. Cold blue moonlight falls in shafts from tall arched windows on the left through drifting smoke. At the far end, centred, a raised dais with steps and a tall gold throne. Tense, dramatic and cinematic: the night something is about to happen. The lower 40% of the picture is open, empty floor.

IMPORTANT: no people, no figures, no bodies, no text, no border, no frame."""
    },
    "harbor_night": {
        "ref": "public/assets/backdrops/cliffs.webp",
        "prompt": HEAD + "The image: " + PAINTING + """. Night, seen from high on a clifftop path looking down over a harbour town and out to sea. A large full moon is rising low over the sea, right of centre, laying a long silver path across the water; thin clouds around it are lit silver. Bottom left, at the foot of tall dark cliffs, the warm lamp-lit windows of a harbour town, a stone quay and a small lighthouse with its lamp lit. The middle and the right of the picture are open, dark, moonlit sea with nothing on it. Quiet, cold and beautiful.

IMPORTANT: no ships, no boats, no people, no birds, no text, no border, no frame."""
    },
    "open_sea": {
        "ref": "public/assets/backdrops/cliffs.webp",
        "prompt": HEAD + "The image: " + PAINTING + """. The open ocean in the morning, far from any land: a wide sea of long rolling swells under a huge bright sky full of tall white and gold clouds. The horizon is a straight line at about 55% of the picture's height. Sunlight glitters on the water in a broad band in the middle. Fresh, vast and lonely.

IMPORTANT: no land, no ships, no boats, no people, no birds, no text, no border, no frame."""
    },
    "ship": {
        "ref": "art_sources/camp/wagon_painted.webp",
        "prompt": HEAD + """The image: one sailing ship, in the richly painted style of the attached reference. A sturdy three-masted merchant ship seen exactly from the side (broadside), its bow pointing to the RIGHT. Full pale sails filled with wind, a dark weathered wooden hull with a gilded rail, a row of small lit portholes, a warm lantern hanging at the stern and another at the bow, rigging lines, and a long dark-red pennant flying from the main mast toward the left. The hull is cut off cleanly along a straight horizontal waterline at the bottom, as if it sits in the water, but no water is drawn. The whole ship fills about 85% of the picture's width.

""" + MAGENTA
    },
    "ravage_ship": {
        "ref": "public/assets/backdrops/finalBoss.webp",
        "prompt": HEAD + """The image: one colossal alien sky-ship, painted in the dark, painterly fantasy style of the attached reference (painted, not a glossy 3D render). Seen from the side and slightly below as it descends: a long, heavy, armoured hull shaped like a blade or a closed seed pod, built of overlapping plates of deep teal-black metal, ancient and scarred. Rows of small mint-green lights run along its belly, and a ring of brighter mint-green light glows under its centre. No wings, no sails, no windows, no people. Ominous and enormous. It fills about 85% of the picture's width.

""" + MAGENTA
    },
}

PATH_RE = re.compile(r"([A-Za-z]:[\\/][^`'\"\n]*?generated_images[\\/][^`'\"\n]*?\.png)")


def run(aid: str, work: str) -> str:
    a = ASSETS[aid]
    ref_png = os.path.join(work, "ref", os.path.basename(a["ref"]).rsplit(".", 1)[0] + ".png")
    if not os.path.exists(ref_png):
        from PIL import Image
        os.makedirs(os.path.dirname(ref_png), exist_ok=True)
        im = Image.open(os.path.join(ROOT, a["ref"])).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
        bg.alpha_composite(im)
        bg.convert("RGB").save(ref_png)
    out = os.path.join(work, f"{aid}.png")
    text = ""
    for _ in range(2):
        proc = subprocess.run(
            ["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", work, "--image", ref_png, "-"],
            input=a["prompt"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
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
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    ids = args.ids.split(",")
    with cf.ThreadPoolExecutor(max_workers=len(ids)) as ex:
        for msg in ex.map(lambda i: run(i, args.out_dir), ids):
            print(msg, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
