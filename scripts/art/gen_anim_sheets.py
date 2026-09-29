"""Generate unit animation renders with Codex image generation.

One Codex run per (class, state): the class's idle frame (or its full-res
source, where one survives) is attached as the reference, and the render
comes back as N poses in a row on flat #FF00FF magenta — the format
process_anim_sheet.py turns into an engine sheet.

Usage:
  python scripts/art/gen_anim_sheets.py <out_dir> <class>[,<class>...] <state>[,<state>...] [--jobs 4]

Raw renders land in <out_dir>/<class>_<state>.png. Nothing in the game
tree is touched; process them with process_anim_sheet.py after review.
"""
import argparse
import concurrent.futures as cf
import os
import re
import shutil
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

FRAMES = {"walk": 4, "attack": 5, "hit": 2, "death": 4}

LOOK = {
    "swordsman": "a young brown-haired swordsman in a red cape and a leather tunic over dark clothes, holding a short sword",
    "spearton": "a bronze-helmeted spearman in a brown tunic and leather armour, with a tall spear and a round bronze shield",
    "knight": "a young brown-haired knight in red plate armour over a dark coat, holding a tall spear with a small red pennant",
    "archer": "a hooded archer in a dark green cloak and leather armour, carrying a longbow and a quiver",
    "shinobi": "a hooded, masked shinobi in dark grey-black cloth with two short blades",
    "sentinel": "a hooded monk in pale cream robes with a dark sash, holding a tall wooden staff",
    "dactyl_rider": "an armoured rider with a tall lance, mounted on a green winged raptor-like dactyl",
    "swordmaster": "a long-haired swordswoman with a high ponytail in dark navy robes, holding a long thin katana low",
    "boss": "a hulking dark warlord in black horned armour with a crimson cape and a heavy greatsword",
    "lenscaster": "a dark-haired woman in a blue-grey coat and a brown apron, holding a glowing amber lens",
}

ATTACK = {
    "swordsman": "1 wind-up, sword drawn back; 2 stepping in, swinging; 3 impact, blade swept forward at chest height; 4 follow-through; 5 recovering to guard",
    # Spears stab OVERHAND and steeply down, never level: a level spear is
    # longer than a 32px frame is wide, and the first renders lost the
    # spearhead on the impact frame.
    "spearton": "an overhand hoplite stab. 1 spear raised above the shoulder, point angled steeply down-forward, shield forward; 2 stepping in; 3 impact, the spear driven down-forward at a steep angle, point low in front of the shield; 4 pulling the spear back up; 5 recovering to guard with the spear upright",
    "knight": "an overhand stab. 1 spear raised above the shoulder, point angled steeply down-forward; 2 stepping in; 3 impact, the spear driven down-forward at a steep angle, point low in front; 4 pulling the spear back up; 5 recovering to guard with the spear upright",
    "archer": "1 nocking an arrow; 2 drawing the bow fully, aimed right; 3 release, string snapping forward, arrow gone; 4 follow-through; 5 lowering the bow",
    "shinobi": "1 crouched, blades crossed; 2 springing forward; 3 impact, both blades slashing forward; 4 follow-through; 5 recovering to a crouch",
    "sentinel": "1 staff drawn back, gathering focus; 2 stepping in; 3 impact, staff thrust forward with a soft glow at its tip; 4 follow-through; 5 recovering",
    "dactyl_rider": "1 rider draws the lance back, the dactyl crouches; 2 the dactyl lunges; 3 impact, lance thrust forward, the dactyl snapping; 4 pulling back; 5 recovering",
    "swordmaster": "1 low stance, hand on the hilt; 2 drawing; 3 impact, a fast horizontal slash, blade extended forward; 4 follow-through; 5 returning to the low stance",
    "boss": "1 greatsword raised high overhead; 2 swinging down; 3 impact, blade low in front; 4 follow-through; 5 hauling the blade back up to guard",
    "lenscaster": "1 lifting the lens; 2 raising it toward the right; 3 the lens held out at arm's length, blazing amber; 4 holding focus as the glow fades; 5 lowering the lens",
}

STATE_BRIEF = {
    "walk": "a 4-frame WALK CYCLE, walking to the right: 1 contact, left foot forward; 2 passing; 3 contact, right foot forward; 4 passing. The weapon is carried as in the reference.",
    "attack": "a 5-frame ATTACK, striking to the right: {attack}. Keep every pose compact: each pose, weapon included, fits in a box no wider than the figure is tall; a long weapon is angled steeply, never held level.",
    "hit": "a 2-frame HIT REACTION: 1 flinching backward (to the left) from a blow, head down, knees bent; 2 recovering back toward a ready stance. Still facing right.",
    "death": "a 4-frame DEATH: 1 staggering backward from a fatal blow; 2 dropping to the knees; 3 collapsing; 4 lying flat and still on the ground, stretched out horizontally, feet toward the left.",
}

PROMPT = """You are generating game sprite art. Use your built-in image generation tool to create ONE image. Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image.

The image: {brief}

The character is the one in the attached reference image: {look}. Match the reference exactly: the same design, face, hair, costume, colours, weapon and proportions, and the same chunky painted pixel-art style with a dark outline, lit from the upper left.

Layout rules:
- Side view facing RIGHT.
- All {n} poses in ONE horizontal row, left to right, evenly spaced, every pose at the same scale, feet on one shared baseline.
- Each pose shows the full figure and the whole weapon; no pose overlaps or touches another.
- Background: one flat, solid, pure magenta (#FF00FF) everywhere. No gradient, no ground line, no shadows, no dust, no motion trails, no effects outside the figure, no text, no numbers, no borders.
- Wide landscape image."""

PATH_RE = re.compile(r"([A-Za-z]:[\\/][^`'\"\n]*?generated_images[\\/][^`'\"\n]*?\.png)")


def reference(cls: str, work: str) -> str:
    src = os.path.join(ROOT, "art_sources", "sprites", f"{cls}_idle_src.png")
    if os.path.exists(src):
        return src
    out = os.path.join(work, "ref", f"{cls}.png")
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        idle = Image.open(os.path.join(ROOT, "public", "assets", "sprites", cls, "idle.png")).convert("RGBA")
        frame = idle.crop((0, 0, 32, 40))
        bg = Image.new("RGBA", (32, 40), (255, 0, 255, 255))
        bg.alpha_composite(frame)
        bg.convert("RGB").resize((256, 320), Image.NEAREST).save(out)
    return out


def run(cls: str, state: str, work: str) -> str:
    n = FRAMES[state]
    brief = STATE_BRIEF[state].format(attack=ATTACK[cls])
    prompt = PROMPT.format(brief=brief, look=LOOK[cls], n=n)
    ref = reference(cls, work)
    out = os.path.join(work, f"{cls}_{state}.png")
    for attempt in range(2):
        proc = subprocess.run(
            ["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", work, "--image", ref, "-"],
            input=prompt, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
            shell=(os.name == "nt"),
        )
        text = (proc.stdout or "") + (proc.stderr or "")
        paths = [p for p in PATH_RE.findall(text) if os.path.exists(p)]
        if paths:
            shutil.copyfile(paths[-1], out)
            return f"{cls}/{state}: ok ({os.path.getsize(out) // 1024} KB)"
    with open(os.path.join(work, f"{cls}_{state}.log"), "w", encoding="utf-8") as f:
        f.write(text)
    return f"{cls}/{state}: FAILED (log saved)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("classes")
    ap.add_argument("states")
    ap.add_argument("--jobs", type=int, default=4)
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    jobs = [(c, s) for c in args.classes.split(",") for s in args.states.split(",")]
    with cf.ThreadPoolExecutor(max_workers=args.jobs) as ex:
        for msg in ex.map(lambda j: run(j[0], j[1], args.out_dir), jobs):
            print(msg, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
