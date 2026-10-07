"""Generate unit animation renders with Codex image generation.

One Codex run per (class, state): the class's idle frame (or its full-res
source, where one survives) is attached as the reference, and the render
comes back as N poses in a row on flat #FF00FF magenta — the format
process_anim_sheet.py turns into an engine sheet.

Tier 2 (promotion) classes each belong to one character, and start with
no art at all. Their IDLE is generated first from two references — the
Tier 1 class's idle (scale, style, silhouette) and the character's
portrait (who they are). Every later state then uses that new idle as its
character reference, plus the Tier 1 class's render of the same state as
a pose guide, so a promoted unit moves exactly as it did before and only
looks grander.

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

FRAMES = {"idle": 2, "walk": 4, "attack": 5, "hit": 2, "death": 4}

# Tier 2 class -> (Tier 1 class it grows out of, the character's portrait).
TIER2 = {
    "spearton_lord": ("spearton", "lucian_neutral"),
    "robinhelm": ("archer", "ning_neutral"),
    "shinobi_master": ("shinobi", "maya"),
    "dactyl_king": ("dactyl_rider", "leo_neutral"),
    "guardian": ("sentinel", "ranatoli_neutral"),
    "prismarch": ("lenscaster", "veya_neutral"),
    "khan": ("knight", "corin_neutral"),
}

# Bespoke sprites: one named character each (the bosses, who all shared
# the "boss" sheet, and the Ravage's troops, who wore human soldiers'
# sheets). Same recipe as Tier 2 — the idle from a base class's idle
# (scale, style, stance) plus a portrait (who they are), every other state
# from that idle with the base class's render as a pose guide — but the
# character is themself, not a promotion of the base class.
BESPOKE = {
    "nebu": ("boss", "nebu_neutral"),
    "ndari": ("boss", "ndari_regal_neutral"),
    "castor": ("boss", "castor"),
    "wren": ("shinobi", "wren"),
    "othren": ("knight", "othren"),
    "serrick": ("boss", "serrick"),
    "archbold": ("boss", "archbold_neutral"),
    "dawn": ("boss", "dawn_measured_neutral"),
    "herald": ("boss", "herald"),
    "ravage_commander": ("boss", "ravage_commander"),
    "ravage_trooper": ("swordsman", "herald"),
    "ravage_lancer": ("spearton", "herald"),
    "ravage_marksman": ("archer", "herald"),
}

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
    # Tier 2: the character, promoted. Grander, same silhouette family.
    "spearton_lord": "Lucian, a bearded man with wavy dark hair, promoted to Spearton Lord: a bronze Corinthian helmet with a tall dark-blue horsehair crest, an ornate bronze scale cuirass, a dark navy cloak, a tall spear and a large round bronze shield with an embossed rim",
    "robinhelm": "Ning, a young woman with dark hair, promoted to Robinhelm: a deep green hooded cloak with gold-trimmed edges, a single red robin feather at the hood, brown leather armour, a tall recurved greatbow and a quiver of red-fletched arrows",
    "shinobi_master": "Maya, a young woman with a long black ponytail, promoted to Shinobi Master: a black cloth mask over the lower face, a long navy-blue scarf whose tails stream behind her, fitted dark navy garb with black leather wraps, and a long dagger in each hand",
    "dactyl_king": "Leo, a brown-haired youth with a navy scarf, promoted to Dactyl King, riding a larger, fiercer winged dactyl: the dactyl is deep green with a bony crowned crest and gold-trimmed barding; Leo wears studded brown leather armour and a navy scarf and holds a tall lance",
    "guardian": "Ranatoli, a broad bearded man with short black hair, promoted to Guardian: heavy dark steel plate over chainmail, a navy scarf, a flanged steel mace in the right hand and a large round steel shield bearing a gold rampant lion on the left arm",
    "prismarch": "Veya, a woman with grey-streaked dark hair tied up and brass goggles pushed up on her head, promoted to Prismarch: a long blue-grey coat over a light blue shirt and a brown leather tool apron, holding a tall brass staff crowned with a glowing amber prism",
    "khan": "Corin, a man with short dark hair, promoted to Khan: red lacquered lamellar armour, a grey fur-trimmed mantle over the shoulders, a spiked steppe helm with a red horsehair plume, and a tall spear with a red tassel below the blade",
    # Bespoke: the named bosses and the Ravage's troops.
    "nebu": "King Nebu IV, a broad bearded king with long dark greying hair and a spiked gold crown, a gold-and-brown regal coat over dark plate, a fur-lined mantle, holding a heavy broadsword",
    "ndari": "Ndari, a huge dark-skinned mountain warlord with long black hair and a thick black beard, a heavy black fur mantle over dark iron armour with a red sash, holding a heavy greatsword",
    "castor": "Lord Castor, a man of about fifty with grey-templed short dark hair and a close-trimmed grey-shot beard, dark steel plate armour with gold trim, a gold sun emblem on the chest, a deep crimson cloak, holding a longsword",
    "wren": "Wren, a lean woman with short choppy ash-brown hair in a dark grey hooded leather coat, a long knife in each hand",
    "othren": "Marshal Othren, a broad older man with close-cropped iron-grey hair and grey stubble, a worn dark-green rebel officer's coat over leather and mail, holding a tall spear",
    "serrick": "General Serrick, a heavy bald man with a thick iron-grey moustache, heavy gilded plate armour with a gold sun emblem and a crimson sash, holding a heavy greatsword",
    "archbold": "King Archbold, a lean king of about sixty with long silver-streaked hair and a short grey beard, a long brown-and-gold royal mantle over dark armour, holding an ornate longsword",
    "dawn": "Madame Dawn, a woman of about fifty with long auburn hair streaked with grey, a long dark-brown leather coat with brass fittings over a high collar, holding a slim rapier",
    "herald": "the Herald of the Ravage, a tall, thin alien warrior: a smooth elongated teal-black carapace head with two glowing mint-green eye slits, a body of segmented teal-black armour plates studded with small mint lights, holding a long curved blade of dark metal edged with mint light",
    "ravage_commander": "the Ravage Commander, a massive alien warlord: a heavy ridged teal-black carapace head crowned with jagged plates and three glowing mint-green eye slits, heavy layered teal-black armour plates with mint light in the cracks, holding a huge dark greatblade edged with mint light",
    "ravage_trooper": "a Ravage trooper, a lean alien soldier: segmented teal-black carapace armour, a smooth eyeless helm-like head with one glowing mint-green visor slit, holding a short dark curved blade edged with mint light",
    "ravage_lancer": "a Ravage lancer, an alien soldier: segmented teal-black carapace armour, a smooth helm-like head with a glowing mint-green visor slit, holding a tall dark lance with a mint-lit point and a small curved carapace shield",
    "ravage_marksman": "a Ravage marksman, an alien soldier: teal-black carapace armour, a hooded carapace head with a glowing mint-green visor slit, holding a dark recurved bow strung with a line of mint light",
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
    "spearton_lord": "an overhand hoplite stab. 1 spear raised above the shoulder, point angled steeply down-forward, shield forward; 2 stepping in; 3 impact, the spear driven down-forward at a steep angle, point low in front of the shield; 4 pulling the spear back up; 5 recovering to guard with the spear upright",
    "robinhelm": "1 nocking an arrow; 2 drawing the greatbow fully, aimed right; 3 release, string snapping forward, arrow gone; 4 follow-through; 5 lowering the bow",
    "shinobi_master": "1 crouched, daggers crossed; 2 springing forward, scarf streaming; 3 impact, both daggers slashing forward; 4 follow-through; 5 recovering to a crouch",
    "dactyl_king": "1 rider draws the lance back, the dactyl crouches; 2 the dactyl lunges; 3 impact, lance thrust forward and down, the dactyl snapping; 4 pulling back; 5 recovering",
    "guardian": "1 shield forward, mace raised behind it; 2 stepping in behind the shield; 3 impact, the mace brought down in front of the shield; 4 follow-through; 5 recovering behind the shield",
    "prismarch": "1 lifting the prism staff; 2 raising it toward the right; 3 the staff held out at arm's length, the prism blazing amber; 4 holding focus as the glow fades; 5 lowering the staff",
    "khan": "an overhand stab. 1 spear raised above the shoulder, point angled steeply down-forward; 2 stepping in; 3 impact, the spear driven down-forward at a steep angle, point low in front; 4 pulling the spear back up; 5 recovering to guard with the spear upright",
}

for _cls, (_base, _face) in BESPOKE.items():
    ATTACK.setdefault(_cls, ATTACK[_base])

STATE_BRIEF = {
    "idle": "a 2-frame IDLE: the character standing at ease, weapon held ready, in the same three-quarter side stance as the first reference; frame 2 is the same pose with a subtle breath, shoulders and chest raised a hair. Both frames otherwise identical in position and size.",
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


TIER2_IDLE = """You are generating game sprite art. Use your built-in image generation tool to create ONE image. Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image.

The image: {brief}

The character: {look}.
- The FIRST attached image is this unit's current, pre-promotion battle sprite (a class sprite). Match its art style exactly — the same chunky painted pixel-art look with a dark outline, lit from the upper left — and its proportions, stance and figure scale. The promoted character is the same kind of warrior, visibly grander.
- The SECOND attached image is the character's portrait: take their face, hair, skin tone, build and colours from it.

Layout rules:
- Three-quarter side view facing RIGHT.
- The 2 poses in ONE horizontal row, evenly spaced, same scale, feet on one shared baseline, full figure and whole weapon visible, not touching.
- Background: one flat, solid, pure magenta (#FF00FF) everywhere. No gradient, no ground, no shadows, no effects, no text, no borders.
- Wide landscape image."""

POSE_NOTE = """
The SECOND attached image is a pose guide: the same animation drawn for the class this unit's sprite grew from. Perform exactly its poses, in its order and at its pace, but draw the character of the FIRST image. Never copy the second image's costume or colours."""


BESPOKE_IDLE = """You are generating game sprite art. Use your built-in image generation tool to create ONE image. Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image.

The image: {brief}

The character: {look}.
- The FIRST attached image is a class sprite this character used to share with others. Match its art style exactly — the same chunky painted pixel-art look with a dark outline, lit from the upper left — and its proportions, stance and figure scale. But draw THIS character, not that one.
- The SECOND attached image is the character's portrait: take their face, hair, skin tone, build, costume and colours from it.

Layout rules:
- Three-quarter side view facing RIGHT.
- The 2 poses in ONE horizontal row, evenly spaced, same scale, feet on one shared baseline, full figure and whole weapon visible, not touching.
- Background: one flat, solid, pure magenta (#FF00FF) everywhere. No gradient, no ground, no shadows, no effects, no text, no borders.
- Wide landscape image."""


def portrait(name: str) -> str:
    return os.path.join(ROOT, "public", "assets", "portraits", f"{name}.webp")


def portrait_png(name: str, work: str) -> str:
    out = os.path.join(work, "ref", f"portrait_{name}.png")
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        Image.open(portrait(name)).convert("RGB").save(out)
    return out


def run(cls: str, state: str, work: str) -> str:
    n = FRAMES[state]
    brief = STATE_BRIEF[state].format(attack=ATTACK.get(cls, ""))
    images: list = []
    grown = TIER2.get(cls) or BESPOKE.get(cls)
    if grown and state == "idle":
        base, face = grown
        prompt = (TIER2_IDLE if cls in TIER2 else BESPOKE_IDLE).format(brief=brief, look=LOOK[cls])
        images = [reference(base, work), portrait_png(face, work)]
    else:
        prompt = PROMPT.format(brief=brief, look=LOOK[cls], n=n)
        images = [reference(cls, work)]
        if grown:
            guide = os.path.join(ROOT, "art_sources", "sprites", f"{grown[0]}_{state}_src.png")
            if os.path.exists(guide):
                images.append(guide)
                prompt += POSE_NOTE
    out = os.path.join(work, f"{cls}_{state}.png")
    args = ["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", work]
    for img in images:
        args += ["--image", img]
    args.append("-")
    for attempt in range(2):
        proc = subprocess.run(
            args,
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
