"""Generate portraits with Codex: expression fixes, missing expressions,
and new faces for the named generals.

Two kinds of job:
  edit  an existing portrait is the reference; the same character is
        redrawn with ONLY the expression changed (keeps a set consistent)
  new   a new character, in the house style of a reference portrait

Every render is on flat magenta (#FF00FF); process_portrait_art.py keys it
out to the game's transparent 1024x1536 WebP. Raw renders land in
<out_dir>/<file>.png.

Usage:
  python scripts/art/gen_portrait_art.py <out_dir> [file,file,...] [--workers 6]
"""
import argparse
import concurrent.futures as cf
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = "public/assets/portraits/"

RULES = "Do not write code, do not run commands, do not try to copy or save files: just generate the image, then reply with the full path of the generated image."
HEAD = "You are generating game art. Use your built-in image generation tool to create ONE image. " + RULES + "\n\n"
BG = ("Background: one flat, solid, pure magenta (#FF00FF) everywhere behind the character — no gradient, "
      "no shadow, no glow, no scenery. Portrait orientation, 2:3 (1024x1536). No text, no border, no frame.")

EDIT = HEAD + """The attached image is a character portrait from our game. Create ONE new image of EXACTLY the same character: the same face shape, the same eyes and eye colour, the same nose and mouth, the same skin tone, the same hair (colour, length, style, every lock), the same scars and marks, the same age, the same outfit, armour and weapon, the same painted art style and brushwork, the same warm lighting, and the same camera framing: the same crop, the same head size, the same head position in the frame, the same pose and shoulders. It must look like the next frame of the same painting.

Change ONLY the facial expression, to: {expr}

""" + BG

NEW = HEAD + """Create ONE new character portrait for our game in exactly the painted art style of the attached reference portrait: the same brushwork and line work, the same warm, low lighting, the same level of detail and finish, and the same framing — head and shoulders, the shoulders reaching the bottom edge, the face in the upper half of the picture, a three-quarter view turned slightly to the right. It is a different person from the reference.

The character: {desc}

""" + BG

# file -> (kind, reference, text)
JOBS = {
    # ---- expression fixes: redrawn from the set's own master ----------------
    "maya_alarmed": ("edit", P + "maya_guarded_neutral.webp",
                     "sudden alarm — eyes widened, brows raised and drawn together, lips parted as if calling a sharp warning. Urgent, not cute: she is a grown woman in her mid-twenties, with the same mature face as the reference."),
    "lucian_neutral": ("edit", P + "lucian_fatherly_smile.webp",
                       "calm and neutral — a seasoned soldier's quiet, steady watchfulness; mouth closed and relaxed, no smile."),
    "lucian_grim_resolve": ("edit", P + "lucian_fatherly_smile.webp",
                            "grim resolve — jaw set, brows lowered, eyes hard and determined, mouth a firm straight line."),
    "khione_revelation": ("edit", P + "khione_neutral.webp",
                          "a hard revelation — eyes a little wider, lips parted as she speaks a terrible old truth, an ancient weariness behind it."),
    "khione_serene_neutral": ("edit", P + "khione_neutral.webp",
                              "serene — eyes gently half-closed, the faintest calm smile, utterly at peace."),
    "rose_neutral": ("edit", P + "rose_brisk.webp",
                     "composed and neutral — attentive, mouth closed, a calm, level gaze."),
    "ning_neutral": ("edit", P + "ning_exhausted.webp",
                     "calm and neutral — open, attentive eyes, mouth closed and relaxed, no tears, no sweat, rested."),
    # ---- the expressions the script asks for that never had art ---------------
    "kian_wounded": ("edit", P + "kian_neutral.webp",
                     "wounded by a betrayal — brows knitted, eyes glistening, mouth tight with hurt; no smile at all."),
    "kian_fatherly_smile": ("edit", P + "kian_neutral.webp",
                            "a fond, proud, fatherly smile — soft eyes, a mentor looking at the student he loved; warm, not smug."),
    "kian_alarmed": ("edit", P + "kian_neutral.webp",
                     "alarmed — eyes wide, brows raised, mouth open in sudden shock; no smile."),
    "kian_cold_contempt": ("edit", P + "kian_neutral.webp",
                           "cold contempt — chin raised, eyes narrowed, one lip slightly curled; no smile."),
    "ndari_grim_resolve": ("edit", P + "ndari_regal_neutral.webp",
                           "grim resolve — jaw set, brows lowered, eyes hard and determined."),
    "ndari_knowing_smile": ("edit", P + "ndari_regal_neutral.webp",
                            "a knowing half-smile — one corner of the mouth raised, eyes amused, as if he knows something you don't."),
    # ---- a face in the house style (was a near-photographic one) ----------------
    "coyne": ("new", P + "fergus_neutral.webp",
              "Quartermaster Coyne, who ran a rebel network's supplies for nine years and sold it out: a man in his late forties with greying dark hair swept back, a short greying beard, tired, clever, watchful eyes, ink stains on his fingers; a worn brown leather coat over a plain linen shirt, a ledger strap across his chest. Expression: guarded and calculating."),
    # ---- the named generals (all wore the royal-guard stand-in) ----------------
    "castor": ("new", P + "fergus_neutral.webp",
               "Lord Castor, commander of the King of Grude's household guard: a man of about fifty, grey at the temples, short dark hair, a close-trimmed beard shot with grey, courteous, duty-bound and faintly sad eyes; dark steel plate armour with gold trim and a gold sun emblem on the breastplate, a deep crimson cloak at the shoulders. Expression: calm, polite, unreadable."),
    "othren": ("new", P + "ndara_military_neutral.webp",
               "Marshal Othren, the rebel leader Madame Dawn's most loyal marshal: a broad, weathered man in his late fifties, close-cropped iron-grey hair, a granite jaw with grey stubble, an old scar through one eyebrow; a worn dark-green rebel officer's coat over leather and mail, a brass marshal's pin at the collar. Expression: stern, certain, unshakeable."),
    "wren": ("new", P + "kian_neutral.webp",
             "Wren, called the King's Knife, a professional assassin: a woman in her thirties with a plain, forgettable face, short choppy ash-brown hair, light freckles and calm grey eyes, an unsettlingly relaxed half-smile; a dark grey hooded leather coat, the hilt of a knife over one shoulder. Expression: relaxed, faintly amused, dangerous."),
    "serrick": ("new", P + "fergus_neutral.webp",
                "General Serrick, the King of Grude's field general: a heavy, broad-shouldered man in his fifties with a shaved head, a thick iron-grey moustache, a heavy jaw and deep-set immovable eyes; heavy gilded plate armour with a gold sun emblem, a high steel gorget, a general's crimson sash. Expression: impassive, correct, immovable."),
    "brask": ("new", P + "kian_neutral.webp",
              "Captain Brask, who leads the King's fire teams: a lean, wiry man in his forties with quick, restless eyes, singed short dark hair, soot streaked across his face and an old burn scar down one side of his neck; a scorched leather apron over light imperial armour, a lit slow-match cord at his shoulder glowing orange. Expression: a thin, unbothered smile."),
    "vasse": ("new", P + "fergus_neutral.webp",
              "Colonel Vasse, the last colonel of a broken imperial army: a gaunt man in his late forties, hollow cheeks, several days unshaven, tired red-rimmed eyes full of grief, a stained bandage at one temple; dented, mud-stained steel armour with a faded gold sun emblem and a torn crimson cloak. Expression: grim, grieving, defiant."),
    "sarto": ("new", P + "fergus_neutral.webp",
              "Warden Sarto, who has kept a great alarm bell for thirty years: an old man in his late sixties with a deeply weathered face, a long white beard, bushy white eyebrows and stubborn pale eyes; old-fashioned heavy plate armour with a bronze bell emblem on the breastplate, a heavy grey wool mantle. Expression: stubborn, proud, steady."),
    "herald": ("new", P + "kian_neutral.webp",
               "the Herald of the Ravage — NOT human, an alien envoy from a fleet that crosses the stars: its head is a smooth, elongated carapace of deep teal-black armour plates, like a beetle's shell or a closed helm, with no mouth, no nose and no hair; two narrow slits of glowing mint-green light (#7affd9) for eyes and a thin line of the same mint light down its brow ridge; the plates are ancient and scarred; a high collar of layered teal-black plates studded with tiny mint-green lights. Calm, measuring, utterly alien."),
    "ravage_commander": ("new", P + "kian_neutral.webp",
                         "the Ravage Commander — NOT human, the alien warlord of a fleet that crosses the stars, larger and older than its herald: a massive head of heavy, ridged teal-black carapace crowned with a crest of jagged plates, no mouth, no nose, no hair, three slits of glowing mint-green light (#7affd9) across the face, faint mint light glowing in the cracks between the plates, heavy layered shoulder plates. Regal, cold, enormous, utterly alien."),
}

PATH_RE = re.compile(r"([A-Za-z]:[\\/][^`'\"\n]*?generated_images[\\/][^`'\"\n]*?\.png)")


def run(fid: str, work: str) -> str:
    kind, ref, text = JOBS[fid]
    prompt = (EDIT if kind == "edit" else NEW).format(expr=text, desc=text)
    ref_png = os.path.join(work, "ref", os.path.basename(ref).rsplit(".", 1)[0] + ".png")
    if not os.path.exists(ref_png):
        from PIL import Image
        os.makedirs(os.path.dirname(ref_png), exist_ok=True)
        im = Image.open(os.path.join(ROOT, ref)).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
        bg.alpha_composite(im)
        bg.convert("RGB").save(ref_png)
    out = os.path.join(work, f"{fid}.png")
    text_out = ""
    for _ in range(2):
        proc = subprocess.run(
            ["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", work, "--image", ref_png, "-"],
            input=prompt, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
            shell=(os.name == "nt"),
        )
        text_out = (proc.stdout or "") + (proc.stderr or "")
        paths = [p for p in PATH_RE.findall(text_out) if os.path.exists(p)]
        if paths:
            shutil.copyfile(paths[-1], out)
            return f"{fid}: ok"
        if "usage limit" in text_out.lower():
            break
    with open(os.path.join(work, f"{fid}.log"), "w", encoding="utf-8") as f:
        f.write(text_out)
    return f"{fid}: FAILED (log saved)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("ids", nargs="?", default=",".join(JOBS))
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    ids = [i for i in a.ids.split(",") if i]
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        for msg in ex.map(lambda i: run(i, a.out_dir), ids):
            print(msg, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
