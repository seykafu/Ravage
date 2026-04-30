// Story beats: dialog cards bracketing each battle. Each beat is a single screen
// with a portrait (or none), a speaker name, a body, and an optional ambient color.

import type { ArcId, RouteRef } from "../data/contentIds";

export type PortraitId =
  | "amar" | "lucian" | "ning" | "maya" | "leo" | "ranatoli" | "selene"
  | "kian" | "ndari" | "nebu"
  | "dawn" | "fergus" | "ndara" | "archbold" | "khione" | "mira" | "tali"
  | "narrator";

export interface DialogBeat {
  speaker?: string;
  portraitId?: PortraitId;
  // Optional expression slug. If omitted, the default portrait is used.
  // The slug must match a file at public/assets/portraits/<id>_<expression>.png
  // and be registered in src/assets/expressions.ts.
  expression?: string;
  body: string;
  ambient?: number;
  // Story-gated promotion trigger. When set, advancing past the LAST page
  // of this beat launches PromotionScene for this character before the
  // next beat shows. The promotion is applied to the save mid-arc, so any
  // subsequent battle picks up the upgraded class + ability + stats.
  // See docs/RAVAGE_DESIGN.md §5.3 for the per-character beat table.
  // No-op if the character has already been promoted (idempotent across
  // dev replays via DevJumpScene).
  promote?: PortraitId;
}

export interface StoryArc {
  id: ArcId;
  title: string;        // banner shown at top of the story screen
  subtitle?: string;    // smaller subline
  beats: DialogBeat[];
  // After the arc, where to go next. Discriminated by prefix; see RouteRef
  // in src/data/contentIds.ts. A typo or pointer to a non-existent battle
  // or arc is now a compile-time error rather than a silent overworld
  // fall-through at runtime.
  next: RouteRef;
  music:
    | "everydayAnthros" | "adventureAnthros" | "adventure1" | "lifeInGrude" | "danger" | "battlePrep"
    | "mainTheme" | "emotional" | "everydayLife" | "trailer" | "ravageDaredevil";
  // Optional backdrop key — must match a key in BACKDROPS (see BackdropArt).
  // If omitted, StoryScene falls back to the generic Thuling sky.
  // NOTE: this is the camelCase BACKDROPS key, NOT the bg_<label> BackdropKey
  // used by battles. StoryScene uses the camel name directly.
  backdrop?:
    | "palaceCoup" | "thuling" | "farmland" | "mountain" | "swamp"
    | "caravan" | "monastery" | "orinhal" | "cliffs" | "grude" | "finalBoss"
    | "factory" | "field_night_camp" | "rusty_house" | "study" | "tavern";
}

const N = (body: string, ambient?: number): DialogBeat => ({ portraitId: "narrator", body, ambient });

// Keyed by ArcId so missing/extra/typo'd arcs fail at compile time. Pair with
// StoryArc.id: ArcId so the key and the inner id can't drift apart.
export const ARCS: Record<ArcId, StoryArc> = {
  // -------- Cold open: Madame Dawn, the night of the coup --------
  // Plays once on New Game, before pre_palace. The player meets the woman
  // pulling the strings before they meet the boy who thinks the plan is his.
  // Withholds the family tie (revealed at Battle 14) and the Grude/Anthros
  // colony reveal (Battle 11) — only frames Dawn as a coordinator far away.
  cold_open_dawn: {
    id: "cold_open_dawn",
    title: "Elsewhere",
    subtitle: "A study, a long way from Para",
    music: "trailer",
    backdrop: "study",
    next: "story:pre_palace",
    beats: [
      N("In a study lit by one lamp, a woman finishes a letter she will never send. She folds it twice and lays it under a stone."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "Tell me again." },
      { speaker: "Lieutenant", body: "Seven of them. Inside the palace by midnight. The king sleeps with his door cracked an inch — vanity, not strategy. They cut for the throat." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "And the one in the throne hall." },
      { speaker: "Lieutenant", body: "First in. Last out, if any of them come out." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping", body: "He thinks the plan is his own. Let him keep that. It will be the only thing his side ever takes from us." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "Move the harbor people one tide early. If Nebu lives past morning, he will look outward — and outward is us." },
      N("Half a continent away, a man named Amar tightens a strap on his vambrace and steps into a corridor that has been waiting for him for ten years.")
    ]
  },
  // -------- Pre-Battle 1 (Palace Coup) --------
  pre_palace: {
    id: "pre_palace",
    title: "Year 2640 of the Anthros Monarch",
    subtitle: "Para — the night of the coup",
    // Ravage Daredevil — heist/coup energy for the briefing in the throne-hall
    // antechamber. Plays from the start of this arc through the BattlePrepScene
    // crossfade into Battle 1's "entering the stronghold" track.
    music: "ravageDaredevil",
    backdrop: "palaceCoup",
    next: "prep:b01_palace_coup",
    beats: [
      N(
        "Anthros: a hundred million people pressed against the spine of the world. One king. One palace. One harvest, year after year, that does not feed them."
      ),
      N(
        "You have planned this for ten months. Tonight your seven comrades are scattered through the back corridors. You and the vanguard reached the throne hall first."
      ),
      { speaker: "Selene", portraitId: "selene", body: "If we don't break the line in the first minute, we don't break it at all. Hold to the right." },
      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "lecturing", body: "Steel up, Amar. We bleed together or we feast together — anything in between is shame." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then bleed only what you can spare. We are taking a country tonight." }
    ]
  },
  // -------- Post-Battle 1 --------
  post_palace: {
    id: "post_palace",
    title: "A day later",
    subtitle: "A hospital outside the palace",
    music: "emotional",
    backdrop: "rusty_house",
    next: "story:thuling_arrival",
    beats: [
      N("You wake in white sheets. There is no pain. There is no memory."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "Easy. You took a hard one to the head. The King's own physicians have looked after you. You're going to be fine." },
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "You're a key man, Amar. The harvest plan, the steel quotas — His Majesty has spent ten years on what you carry. We need you back on your feet." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "...The harvest." },
      N("You smile because Kian is watching. You do not say that the word means nothing.")
    ]
  },
  // -------- Story interlude: arriving in Thuling --------
  thuling_arrival: {
    id: "thuling_arrival",
    title: "Thuling",
    subtitle: "A factory town at the foot of the eastern range",
    music: "everydayLife",
    backdrop: "factory",
    next: "prep:b02_farmland",
    beats: [
      N("Within a single day you are working both farmland and forge. Your hands know things your mouth does not."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Pinch the hammer here. Lighter grip. The arm wants to pull through, not push down." },
      { speaker: "Lucian", portraitId: "lucian", body: "...You already knew that." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile", body: "Lucky guess." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Sure. Lucky guess." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Either you've held a hammer before, or your mother was a smith." },
      { speaker: "Amar", portraitId: "amar", body: "She wasn't a smith." },
      { speaker: "Lucian", portraitId: "lucian", body: "Mm. Was she?" },
      { speaker: "Amar", portraitId: "amar", body: "She was a teacher." },
      { speaker: "Lucian", portraitId: "lucian", body: "Of?" },
      { speaker: "Amar", portraitId: "amar", body: "Of children." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Of children who learn how to swing hammers, apparently." },
      N("Kian shadows you between shifts. He smiles. He always smiles."),
      N("On the morning of the third day, bandits come for the wagons in the eastern field.")
    ]
  },
  // -------- Post-Battle 2 --------
  post_farmland: {
    id: "post_farmland",
    title: "After the field",
    music: "emotional",
    backdrop: "field_night_camp",
    next: "story:before_dawn_bandits",
    beats: [
      { speaker: "Lucian", portraitId: "lucian", body: "Hand." },
      N("He hands you a rag. He doesn't ask where the wound came from. He doesn't ask why it was so easy for you to drop the second bandit when his back was open."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "You handled yourself well. Some of that looked... rehearsed." },
      { speaker: "Amar", portraitId: "amar", body: "Anyone bleeds when you cut them right. I think I just got lucky." },
      N("You show him the cut on your waist. You opened it yourself this morning, with the kind of precision a farmer should not have. He believes you. For now."),
      { speaker: "Lucian", portraitId: "lucian", body: "Amar." },
      { speaker: "Amar", portraitId: "amar", body: "Yes?" },
      { speaker: "Lucian", portraitId: "lucian", body: "Next time you cut yourself for show, do it on the off-hand. People notice when you favor the wrong arm." },
      { speaker: "Amar", portraitId: "amar", body: "...Thank you." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Don't thank me. Buy me a drink." }
    ]
  },
  // -------- Pre-Battle 3 (Madame Dawn's bandits arrive) --------
  // Two days after the farmland fight. Word reaches Thuling that another
  // wave of bandits is forming up on the eastern road, this time wearing
  // a uniform sash. Maya is foreshadowed but unnamed — the player meets
  // her on the field. The arc transitions from a quiet drink at the
  // tavern into the rising danger cue as the alarm goes up.
  before_dawn_bandits: {
    id: "before_dawn_bandits",
    title: "Two days later",
    subtitle: "Thuling, dusk",
    music: "danger",
    backdrop: "tavern",
    next: "prep:b03_dawn_bandits",
    beats: [
      N("Lucian buys the drink. Ning insists on paying for the second one and is overruled. The third comes from a runner who does not sit down."),
      { speaker: "Runner", body: "Eastern road. Twenty of them, at least. They're flying a sash — orange, bone, orange. Same on every arm." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "That's not bandit. Bandits don't wear matching anything." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "What does it mean?" },
      { speaker: "Lucian", portraitId: "lucian", body: "Means somebody's paying them. Somebody who wants to be recognized." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we recognize them back. South of the road, behind the fences. Ning takes the fence line. Lucian and I bracket the wagons." },
      N("On the way out you pass a woman at the corner table you have not seen before. She does not look up from her drink. She has already laid coins for the bill she has not been given.")
    ]
  },
  // -------- Post-Battle 3 (Maya stays) --------
  // Quiet aftermath at a fire south of the road. Maya names herself,
  // explains nothing, asks to stay. Lucian's caution reads as
  // approval the rest of the squad won't recognize for a year.
  post_dawn_bandits: {
    id: "post_dawn_bandits",
    title: "After the second wave",
    subtitle: "A fire south of the eastern road",
    music: "emotional",
    backdrop: "field_night_camp",
    next: "story:before_swamp",
    beats: [
      N("The stranger from the corner table walks the line of bodies once and stops at the spearton with the orange sash."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "Two of these are deserters from the Crown Archers. The other three are new. She's recruiting harder than she was a month ago." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "She." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "The woman the sash points at. I'd say her name, but you'd hear it again every week for the next year, and you'd start to feel about her the way she feels about you. Easier to learn it from the world." },
      { speaker: "Maya", portraitId: "maya", body: "I'm Maya. I was traveling east. I've changed my mind." },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin", body: "Stay. Please stay. You read that fight like a book you'd already finished." },
      { speaker: "Lucian", portraitId: "lucian", body: "Why us." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile", body: "Because the boy in front cuts like a man who learned in a palace, and that's the kind of company I keep." },
      N("Amar does not blink. Lucian does — once, slowly, the way he blinks when he is filing a thing away for later."),
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile", body: "Welcome." }
    ]
  },
  // -------- Pre-Battle 4 (Swamp ambush, Kian rejoining) --------
  // A few days later. The squad is sent out on what should be a routine
  // ride; Kian rides up from the keep at first light to escort them in.
  // Maya doesn't trust him on sight. Lucian doesn't trust her not
  // trusting him. The marsh is the obvious road — the only road.
  before_swamp: {
    id: "before_swamp",
    title: "A few days later",
    subtitle: "The road north out of Thuling",
    music: "adventureAnthros",
    backdrop: "thuling",
    next: "prep:b04_swamp",
    beats: [
      N("A small errand. A package to a smallholding two days north. Lucian's idea — get Maya out of town before the man with the sashes hears she's traveling with you."),
      N("At the gate, a rider waits. Polished armor in a town that doesn't polish armor."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "Amar! The General's compliments. He thought you might want company on the marsh road. Bandits, you know how it is." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "...Who is he." },
      { speaker: "Lucian", portraitId: "lucian", body: "King's man. Old friend of Amar's, supposedly. Says it often enough I've started to believe him." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "He's watching you the way I watch a draw I haven't read yet." },
      { speaker: "Amar", portraitId: "amar", body: "He's watching me the way he always has. Stay near Lucian. Marsh road is narrow — single file once we hit the puddles." },
      N("The marsh swallows the morning sun three minutes after you enter it.")
    ]
  },
  // -------- Post-Battle 4 (Lucian asks for the truth) --------
  // Camp on the dry side of the marsh. Lucian performs a public lie for
  // Kian, then waits until Kian leaves the fire to ask Amar for the
  // private one. The first time Amar admits anything out loud.
  post_swamp: {
    id: "post_swamp",
    title: "Camp on the far side of the marsh",
    music: "emotional",
    backdrop: "field_night_camp",
    next: "story:before_mountain",
    beats: [
      N("Six bodies in the reeds. None of them yours. Kian binds a cut on his forearm at the fire — a cut he took from the second spearton, fairly, and a cut he'll show the General as proof he was useful."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "Amar — that fourth one, the archer at the tree. You set him up like you'd seen the cover already." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Boy's been sparring with old soldiers since he could lift a stick. He saw me set the same cover at the wagons last week. Picks things up." },
      { speaker: "Kian", portraitId: "kian", body: "Mm." },
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "I'll take first watch. The General will want a full report — I want it accurate." },
      N("Kian takes his bedroll to the far edge of the camp. He is in earshot if he wants to be. Lucian waits until the fire pops twice."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Now the real one." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded", body: "Lucian — " },
      { speaker: "Lucian", portraitId: "lucian", body: "I am not asking who you were. I am asking what to do when he stops believing the lie I just told him for you." },
      { speaker: "Amar", portraitId: "amar", body: "I don't know." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Good. That's an honest answer. Sleep. Tomorrow we deliver a package, and the day after that, the General will find another job for you. He always does." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "(quiet, from the other side of the fire) The General always does." }
    ]
  },
  // -------- Pre-Battle 5 (Mountain Bandits / Ndara & Ndari) --------
  before_mountain: {
    id: "before_mountain",
    title: "Two months later",
    subtitle: "The eastern range, above the snowline",
    music: "adventureAnthros",
    backdrop: "mountain",
    next: "prep:b05_mountain_ndari",
    beats: [
      N("General Fergus has work for your squad. The kind of work that pays in gold and uses up the men who do it."),
      { speaker: "Leo", portraitId: "leo", expression: "wounded_pride", body: "My father wants me to go with you. Do not argue. He doesn't argue twice." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "Mountain bandits. A village they already burned. The leaders are siblings — Ndara, who plans, and her brother Ndari, who breaks things in front of her." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "Ndara. Like the queen Madame Dawn — that Ndara?" },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "Different woman. Same kind of trouble. The brother is the one you'll see first — he likes the front of a fight. The sister is the one you have to actually catch." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Bring everything. We won't be picking over bodies — they'll be picking over ours." }
    ]
  },
  // -------- Post-Battle 5 (Ndara escapes; Ndari falls covering her) --------
  post_mountain: {
    id: "post_mountain",
    title: "On the path home",
    music: "emotional",
    backdrop: "field_night_camp",
    next: "credits",
    beats: [
      N("Ndari falls at the gate, holding the line so his sister can run. He goes down still grinning — the kind of grin that meant he had always known the math."),
      { speaker: "Ndari", portraitId: "ndari", expression: "scornful", body: "Tell her I held it. Tell her she owes me a drink." },
      N("Ndara escapes on a Dactyl as the last torches gutter out. Her question stays in the cold air."),
      { speaker: "Ndara", portraitId: "ndara", expression: "grim", body: "Why are you fighting on King Nebu's side, Amar?" },
      N("Leo doesn't seem to have heard. Lucian heard. Lucian sees you flinch."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "She didn't mistake you for anyone. And you've known that since she said it." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "Lucian — " },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Not tonight. The rest can wait. But for the first time, Amar — you have a witness." },
      N("(End of the playable vertical slice. The remaining sixteen battles are scaffolded — the full story continues across the Caravan, the Monastery, the cliffs of Para, the year of travel in Grude, and the Ravage Fleet at the end of the world.)")
    ]
  }
};
