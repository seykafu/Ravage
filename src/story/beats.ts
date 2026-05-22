// Story beats: dialog cards bracketing each battle. Each beat is a single screen
// with a portrait (or none), a speaker name, a body, and an optional ambient color.

import type { ArcId, RouteRef } from "../data/contentIds";

export type PortraitId =
  | "amar" | "lucian" | "ning" | "maya" | "leo" | "ranatoli" | "selene"
  | "kian" | "ndari" | "nebu"
  | "dawn" | "fergus" | "ndara" | "archbold" | "khione" | "mira" | "tali"
  | "rose"
  // Generic enemy-class portrait, valid as a dialogue speaker for
  // minor named officers who reuse the stand-in art (e.g. Lord Castor,
  // B14) rather than carrying a bespoke portrait. Mirrors the B12/B13
  // stand-in-portrait precedent for one-battle Grude officers.
  | "royal_guard"
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
    | "mainTheme" | "emotional" | "everydayLife" | "trailer" | "ravageDaredevil"
    | "sadness" | "sadness2" | "grudeBattle1";
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
      N("Half a continent away, a man named Amar tightens a strap on his forearm guard and steps into a corridor he has spent ten years walking toward.")
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
        "Anthros: a hundred million people crowded along the spine of the world. One king. One palace. One harvest, year after year, that never feeds them all."
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
      N("You smile because Kian is watching. You don't tell him that the word means nothing to you — that you can't remember it at all.")
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
      N("Amar reaches Thuling at dawn, riding in the back of a supply wagon. Kian rides up front. At the town gate he stops, watches Amar climb down, and turns his horse back toward Para without getting off it."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "I'll be back at sundown to check on you. Your foreman at the forge is named Lucian. Tell him the King sent you — he hates that, which means you'll know him as soon as he scowls." },
      N("Inside the forge, a broad-shouldered man in his thirties is hammering a horseshoe flat. He swings with an easy, heavy force — the kind that ends an argument before it can start. A lean younger woman works the rivet press nearby, bagging crossbow bolts and humming to herself."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "You'll be Amar, then. Word came up the road last night. I'm Lucian — I run the line. The girl on the rivet press is Ning, the bowyer's apprentice. She'll mostly ignore you for the first day, then never stop talking once she decides you're not a problem." },
      { speaker: "Amar", portraitId: "amar", body: "Amar. Kian said the King thought I'd be of use here. I don't —" },
      N("He almost says \"I don't remember much yet.\" He stops himself just in time. Lucian notices the catch — and says nothing about it."),
      { speaker: "Amar", portraitId: "amar", body: "I don't know much yet." },
      { speaker: "Lucian", portraitId: "lucian", body: "You don't have to. Pick up the hammer. We'll find out together what you do know." },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin", body: "Don't drop it on your foot. Mira did that her first day. Lucian's wife. She still walks crooked." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Ning. ENOUGH about my wife's damn foot." },
      N("By the end of the first day, Amar is working both the farmland and the forge. His hands remember things he can't explain."),
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
      N("On the morning of the third day, bandits attack the wagons in the eastern field.")
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
      N("On the way out, you pass a woman at the corner table — someone you've never seen before. She doesn't look up from her drink. She has already set coins on the table for a bill no one has brought her yet.")
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
      N("Amar doesn't blink. Lucian does — once, slowly, the way he does when he is making a quiet note of something to come back to later."),
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
      N("A small errand: deliver a package to a small farm two days north. It was Lucian's idea — get Maya out of town before the man with the sashes hears she is traveling with you."),
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
    next: "story:before_caravan",
    beats: [
      N("Ndari falls at the gate, holding the line so his sister can run. He goes down still grinning — the kind of grin that meant he had known the odds all along."),
      { speaker: "Ndari", portraitId: "ndari", expression: "scornful", body: "Tell her I held it. Tell her she owes me a drink." },
      N("Ndara escapes on a Dactyl as the last torches burn out. Her question hangs in the cold air."),
      { speaker: "Ndara", portraitId: "ndara", expression: "grim", body: "Why are you fighting on King Nebu's side, Amar?" },
      N("Leo doesn't seem to have heard. Lucian heard. Lucian sees you flinch."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "She didn't mistake you for anyone. And you've known that since she said it." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "Lucian — " },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Not tonight. The rest can wait. But for the first time, Amar — you have a witness." }
    ]
  },
  // -------- Pre-Battle 6 (Caravan ambush briefing) --------
  // Fergus assigns the contract. The squad takes it. The "routine" framing
  // is intentional — the player should feel the discrepancy between the
  // pitch and what unfolds in the canyon.
  before_caravan: {
    id: "before_caravan",
    title: "A week later",
    subtitle: "Thuling — Fergus's office at the keep",
    music: "adventureAnthros",
    backdrop: "rusty_house",
    next: "prep:b06_caravan",
    beats: [
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "A simple one this time. Two wagons, grain and steel, three days east through the foothills. Drop them at Brielwatch and come home. The kind of work that buys a soldier a roof." },
      { speaker: "Lucian", portraitId: "lucian", body: "Brielwatch hasn't seen a bandit raid since spring." },
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "Then it'll be a quiet week for you. Take the road early, take it slow. The drivers are civilians — keep them whole." },
      N("On the way out of the keep, Maya falls in beside Amar without looking at him."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "Three days east, full road. Anyone who wanted to find us between here and Brielwatch would know exactly where we'd be on the third afternoon." },
      { speaker: "Amar", portraitId: "amar", body: "You think it's a setup." },
      { speaker: "Maya", portraitId: "maya", body: "I think Fergus has never used the word 'simple' to mean simple." },
      N("On the third afternoon, in the canyon east of Brielwatch, the ambush springs.")
    ]
  },
  // -------- Post-Battle 6 (the ledger) --------
  // The reveal: bandits weren't bandits, they were paid by Nebu's court.
  // Sets up Amar's growing distrust of Fergus and lays the groundwork for
  // the monastery assignment (which is also a setup).
  post_caravan: {
    id: "post_caravan",
    title: "After the canyon",
    subtitle: "Roadside, two miles from Brielwatch",
    music: "emotional",
    backdrop: "field_night_camp",
    next: "story:before_monastery",
    beats: [
      N("Eight bodies on the road. The drivers check each other over, twice, and are amazed to find everyone still alive. The wagons roll on after a short argument about who pays for the broken axle on the second one."),
      { speaker: "Amar", portraitId: "amar", body: "Maya. The captain — search him." },
      N("She's already done it. The leather ledger is already in her hand. She passes it to Lucian, not Amar — she knows the squad still looks to Lucian first, by reflex."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Three columns. Route, schedule, payment date. The handwriting in the margin — Amar, you'd know this. You said you wouldn't, but you would." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "...That's the King's accounting hand. Officer codebook. Only palace clerks are taught it." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "Then this wasn't a bandit ambush. This was a contract." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "Why us?" },
      { speaker: "Lucian", portraitId: "lucian", body: "Because someone in Nebu's court would prefer that the squad delivering Fergus's ledger arrived as a set of bodies. We keep this." },
      N("The ledger goes into Lucian's saddlebag. The squad rides for Brielwatch. Nobody mentions the ledger again until Fergus's next contract arrives.")
    ]
  },
  // -------- Pre-Battle 7 (the monastery briefing) --------
  // Fergus's next contract — by now Amar's squad knows it's not what
  // it sounds like. They take it anyway, because the alternative is to
  // tip Fergus off that they've stopped trusting him.
  before_monastery: {
    id: "before_monastery",
    title: "Five days later",
    subtitle: "Thuling — at the keep gate, before dawn",
    music: "danger",
    backdrop: "thuling",
    next: "prep:b07_monastery",
    beats: [
      { speaker: "Fergus", portraitId: "fergus", body: "An abandoned monastery in the high passes — north of Drennig, two days' climb. Raiders moved in last winter, started taking tax collectors. The Crown wants it cleared." },
      { speaker: "Amar", portraitId: "amar", body: "How many?" },
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "Half a dozen, maybe. A leader. Bring rope — the inner sanctum sits behind a bell tower, and whoever's holding it knows the climb." },
      N("Lucian counts the words Fergus didn't use. \"Wanted poster.\" \"Bounty.\" \"Name.\" Lucian says nothing. The squad sets out before noon."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "He didn't tell us who's leading them. He'd tell us, if it were anyone we could be paid to bring back." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we'll find out at the door." },
      N("The road to the monastery is two days of switchbacks above a frozen river. By the second night, the squad can see torchlight at the top of the bell tower.")
    ]
  },
  // -------- Post-Battle 7 (Lucian's "I have a wife and a daughter") --------
  // The night Amar finally tells Lucian everything. Lucian's response is
  // the script's defining beat for him: he doesn't recoil, doesn't
  // bargain, doesn't ask for anything. He just covers.
  // **Lucian's promotion fires here** (per docs/RAVAGE_DESIGN.md §5.3).
  post_monastery: {
    id: "post_monastery",
    title: "Camp below the monastery",
    music: "emotional",
    backdrop: "field_night_camp",
    next: "story:before_orinhal",
    beats: [
      N("Selene goes over the bell tower balcony with a coil of rope already in her hand. She doesn't look back. By the time Leo turns his Dactyl around to the courtyard, she is gone into the high mist — and the squad is left with five bodies and a question Amar can't answer in front of the others."),
      N("That night the camp is colder than the road. Maya takes first watch up the slope. Ning falls asleep before her stew is done. Leo checks his Dactyl's wing-leather one more time than necessary and then, finally, lies down. Lucian stays up. Amar stays up. The fire pops twice."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "She knew you. From the gate to the balcony, she knew you, and you knew her, and you fought her at half what I've watched you do to a bandit half her size." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded", body: "Lucian." },
      { speaker: "Lucian", portraitId: "lucian", body: "I'm not asking. I'm telling you I'm not asking. I'm telling you that whatever you say next, I have already decided what to do about it. Speak when you're ready." },
      N("Amar speaks for an hour. The coup. The seven. The hospital in Thuling and the smell of wet hay in the cart and the wound he opened himself the morning of the farmland fight. Selene by name. Ranatoli by name. The five he hasn't seen since. The throne hall. The plan."),
      N("Lucian listens until Amar is done. He does not interrupt once. He does not move. When Amar finally stops talking, the fire has gone down to embers."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "I thought it was something like that. I have a wife and a daughter, Amar. Mira is forty-one this winter. Tali is eight. They live at the edge of Thuling in a house I built with the same hands I'm holding this stew with." },
      { speaker: "Lucian", portraitId: "lucian", body: "If you want to rebuild this country into somewhere safer for them — somewhere a girl named Tali can grow up without learning to flinch when the King's clerks visit — you tell me when it's time to move. Until then, I'll cover you." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "I haven't asked anything of you." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "I know. That's why I'm offering. Sleep, Amar. We've got work in the morning." },
      // Lucian's Tier 2 promotion fires here, after the offer. The promote
      // beat triggers PromotionScene as a paused overlay — Lucian becomes
      // a Spearton Lord with the Phalanx ability, +5 HP / +2 PWR/ARM/SPD /
      // +1 MOV stat boost. Mechanically he's earned the Tier 2; narratively
      // it lands at the moment he commits to Amar's larger fight.
      {
        speaker: "Lucian",
        portraitId: "lucian",
        expression: "grim_resolve",
        body: "And Amar — tomorrow, on the climb back, walk on my shield side. I'm done covering one flank at a time.",
        promote: "lucian"
      },
      N("Tomorrow the squad climbs back down the pass to Thuling. Two days later, Fergus has another contract waiting at the keep — a tax dispute three days' ride northeast, in a mining town called Orinhal.")
    ]
  },
  // -------- Pre-Battle 8 (Orinhal — the choice in the square) --------
  // Fergus assigns the contract. The squad rides to Orinhal expecting
  // a riot and finds a famine. The "choice" in the script — to break
  // ranks and side with Dawn's partisans — is foreshadowed by Lucian's
  // discomfort with the orders, made by Leo at the gate.
  before_orinhal: {
    id: "before_orinhal",
    title: "Three days northeast of Thuling",
    subtitle: "The road into Orinhal",
    music: "danger",
    backdrop: "orinhal",
    next: "prep:b08_orinhal",
    beats: [
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "Tax riot in a mining town. Disperse the crowd, arrest the ringleaders, restore the King's peace. Routine work for soldiers of your tier." },
      { speaker: "Lucian", portraitId: "lucian", body: "Orinhal hasn't paid full tax in three years. It's a starvation case, not a riot." },
      { speaker: "Fergus", portraitId: "fergus", body: "The orders aren't yours to weigh, Lucian. Disperse the crowd." },
      N("Two days on the road. Maya rides at the back of the column without speaking, the way she always rides when she's already three steps ahead of everyone else."),
      N("At the Orinhal gate at noon: not a riot but a famine. A hundred unarmed foremen and their families standing between the King's tax detail and the last sacks of winter grain. A line of green cloaks at the far end of the square — Madame Dawn's partisans, sent ahead to hold the line."),
      { speaker: "Leo", portraitId: "leo", expression: "wounded_pride", body: "My father would have had me arrest them. (a long pause) I'm not arresting anyone today." },
      N("Leo dismounts, walks his Dactyl to the partisan side, and looks back at the squad. The squad follows.")
    ]
  },
  // -------- Post-Battle 8 (Ndara's offer; Lucian's silver) --------
  // Aftermath of Orinhal. The script's two key beats: (1) Ndara
  // appears with Madame Dawn's invitation to meet, (2) Lucian
  // distributes the recovered tax silver back to the townspeople.
  // **Leo's promotion fires here** — committing to the squad's choice
  // of conscience over orders is the moment Leo earns his Tier 2.
  post_orinhal: {
    id: "post_orinhal",
    title: "After the square",
    subtitle: "Orinhal, late afternoon",
    music: "emotional",
    backdrop: "orinhal",
    next: "story:before_ravine",
    beats: [
      N("The tax collectors break before the squad does. Townspeople begin coming out from behind shutters and barrel stacks once the last of the King's men have run. A woman finds her husband alive at the edge of the square and they hold each other in a way the squad has to look away from."),
      N("A figure in a gray cloak walks through the square as if she belongs there. She does not introduce herself to anyone but Amar."),
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral", body: "I'm Ndara. Not the bandit at the mountain village — same name, different woman, you'll get used to it. I serve a queen called Madame Dawn. She has been watching you for a long time, Amar." },
      { speaker: "Amar", portraitId: "amar", body: "...Watching me how." },
      { speaker: "Ndara", portraitId: "ndara", body: "She wants to meet when you're ready. She'll be ready before you are. Ride safely, all of you." },
      N("Ndara leaves before Amar can answer. Lucian gathers the squad's contract pay into a leather sack, walks the line of foremen at the gate, and presses a coin into each man's hand on the way out."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "We were paid to put you down. We were paid wrong. That's the difference settled." },
      // Leo's promotion fires after his choice has played out — turning
      // his Dactyl from the King's tax detail to the partisans is the
      // moment he earns Tier 2.
      {
        speaker: "Leo",
        portraitId: "leo",
        expression: "wounded_pride",
        body: "I'm not riding back to the keep tonight. I'll meet you on the road home. There's something I have to do without my father's name on my back.",
        promote: "leo"
      },
      N("Leo doesn't say where he's going. He's back at the campfire by midnight, the covering on his Dactyl freshly repainted in the squad's own colors instead of Fergus's crest.")
    ]
  },
  // -------- Pre-Battle 9 (Fergus's trap) --------
  // Fergus sends them out again before they can report Orinhal. The
  // squad knows it's a trap. They go anyway because the alternative
  // is admitting they don't trust the General.
  before_ravine: {
    id: "before_ravine",
    title: "The same day, late",
    subtitle: "Outside Thuling — Fergus's outrider waiting on the road",
    music: "danger",
    backdrop: "thuling",
    next: "prep:b09_ravine",
    beats: [
      N("They don't even reach the keep. Fergus's outrider intercepts them on the road north of Orinhal with a fresh contract, sealed and dated three hours ago."),
      { speaker: "Outrider", body: "Bandit column moving on the border village of Tharin. Twenty men, mounted. The General orders intercept and destroy. Coordinates inside the seal." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "He's not letting us return to report Orinhal. He's keeping us moving until we miss a step." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "If we refuse, he knows we know. If we go, we go knowing." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we go knowing. Maya, you read the map for traps. Ning, full quiver. Leo, fly point. We don't get caught with our backs to anything." },
      N("The coordinates lead to a narrow ravine an hour east. The squad rides in carefully, weapons already half-drawn. Inside thirty seconds of the river bend, an arrow lane opens from the cliffs above and the trap snaps shut behind them.")
    ]
  },
  // -------- Post-Battle 9 (Lucian wounded; Maya speaks) --------
  // Lucian takes the crossbow bolt for Ning (script-mandated, narrative
  // injury — he keeps fighting). Maya finally identifies herself as
  // Madame Dawn's. **Maya's and Ning's promotions fire here** — Maya's
  // for committing to the squad as her real self instead of the
  // peasant alias, Ning's for the moment Lucian takes a hit she would
  // otherwise have died from.
  post_ravine: {
    id: "post_ravine",
    title: "Out of the ravine",
    subtitle: "A clearing two miles south of the trap",
    music: "emotional",
    backdrop: "field_night_camp",
    beats: [
      N("They pull away from the fight at the river crossing and ride hard for an hour before stopping. Lucian takes his shirt off in the clearing without asking; the bolt went in shallow, but the iron head has bent. Maya cuts it out with a knife she didn't mention she had until just now. Ning is the one who can't stop watching."),
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "That bolt was for me. That whole lane. He pushed me into the rock." },
      { speaker: "Lucian", portraitId: "lucian", expression: "dying", body: "(through gritted teeth) The lane was for whoever was standing in it. You were standing in it. Stop apologizing and finish that damn bandage." },
      N("A prisoner taken at the river crossing answers a question of Maya's that she asked very quietly. He gives up Fergus by name, gives up the date the General learned about Amar's coup, and gives up the standing order to expend the squad on increasingly impossible contracts until they don't come back. The squad listens in silence. Lucian doesn't even react — he had already decided weeks ago."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "All right. I'll do this once and then we move." },
      // Maya's promotion fires when she steps out of the alias.
      {
        speaker: "Maya",
        portraitId: "maya",
        expression: "steel_cold_confession_face",
        body: "I'm Maya. That's true. I am not from the eastern farmland. I am an officer of Madame Dawn's, planted in this squad eleven months ago to read who Amar really was. I have read enough. Dawn is offering safe passage tonight. We ride for her harbor at dawn or we die in Thuling tomorrow. I'm sorry for the shape of the truth. I am not sorry for the answer.",
        promote: "maya"
      },
      N("Nobody speaks for a long time. Lucian, of all people, smiles."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Maya. If I had a sister, I would want her to be exactly that complicated about it. We ride." },
      // Ning's promotion fires after she processes the bolt incident —
      // the moment she stops being the bowyer's apprentice afraid of
      // her own draw and starts being the squad's archer who kept her
      // line after Lucian took a hit for her.
      {
        speaker: "Ning",
        portraitId: "ning",
        expression: "focused_bow",
        body: "If we ride for Dawn at dawn, then I'm walking the rear watch tonight. Nobody is taking another bolt for me. I learned what that feels like. I'm done being slow.",
        promote: "ning"
      },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we ride. Lucian — you take Mira and Tali to the cousin's farm. Catch up to us on the road." },
      N("Lucian rides for his house at the edge of Thuling. The rest of the squad packs camp in silence and turns west toward the Para road. The plan was to meet Lucian back at his door, walk Mira and Tali out the back gate, and ride for Madame Dawn's harbor at first light. The plan is about to need adjusting.")
    ],
    next: "story:before_leaving_thuling"
  },
  // -------- Pre-Battle 10 (Kian's blockade at Lucian's house) --------
  // Bridges post_ravine into B10's escape battle. The squad arrives
  // back at Lucian's door at 3am. Kian is already there. The arc is
  // brief — most of the dramatic work happens in B10's round-1
  // dialogue trigger ("kian_blockade") so the player encounters the
  // setup as part of the battle, not as a separate read-screen.
  before_leaving_thuling: {
    id: "before_leaving_thuling",
    title: "Lucian's door, three in the morning",
    subtitle: "The squad rides back into Thuling for the family",
    music: "danger",
    backdrop: "thuling",
    next: "prep:b10_leaving_thuling",
    beats: [
      N("Three in the morning. The squad rides back into Thuling at a hard pace. The streets are wrong — too quiet, too lit. The night watch is doubled. Torches in places torches don't usually go."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Kian beat us here. The watch is his. He's at Lucian's door already." },
      { speaker: "Lucian", portraitId: "lucian", expression: "alarmed",
        body: "Mira. Tali." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then we don't ride past. We ride through. Maya, take the back lane and get Mira and Tali out the rear gate while we hold the front. Lucian — you're with me." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
        body: "He'll have the front blockaded. Twelve men minimum. He'll talk first. He always talks first." },
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Then let him talk. We listen with arrows nocked." },
      { speaker: "Leo", portraitId: "leo", expression: "ready",
        body: "Maya — give me three minutes' head start. I'll ride my Dactyl over the back gate and clear whatever's between you and the lane." },
      N("Maya peels off west; Leo rides east along the rear of the row. The rest of the squad walks their horses up to Lucian's front door at a slow pace. Kian's voice carries before they round the last corner.")
    ]
  },
  // -------- Post-Battle 10 (the squad clears the gate; Mira & Tali safe) --------
  // Brief breath between B10's escape and B11's cliff confrontation.
  // The arc handles the "Mira and Tali made it" beat (sets up the
  // weight of Lucian's death in post_cliffs) and gives Maya the
  // clean call to ride for the harbor before the King's reinforcements
  // arrive.
  post_leaving_thuling: {
    id: "post_leaving_thuling",
    title: "The western road, before sunrise",
    subtitle: "The squad rides for Para Harbor",
    music: "danger",
    backdrop: "thuling",
    next: "story:before_cliffs",
    beats: [
      N("They clear the western gate at a run and don't slow until the Thuling spires are below the horizon behind them. Leo catches up an hour later with Maya behind him on the Dactyl, both of them breathing hard. Mira and Tali rode for the cousin's farm with two of Lucian's foreman friends; the cousin will move them north before sunrise. Lucian rides without speaking for a long time."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(quietly, after a while) I told her this morning that we were going on a trip. Mira asked if she could bring her cat. I said no. I should have said yes. The cat would have ridden quiet in her lap. She'd have had something to hold onto." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "We can send for the cat. I'll write the cousin's wife once we make Grude." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(small smile) ...That'd be all right. Thank you, Maya." },
      N("Amar rides at the front and doesn't trust himself to speak. Kian's promise — the cliffs, sundown — has been working its way around in his head for the entire ride. He keeps trying to find a version of the next twelve hours where Kian doesn't have to fall. He hasn't found one."),
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Amar. The cliffs are four hours up the harbor road. We have time to plan, or time to grieve. Pick one." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Plan. We grieve on the boat. Maya — what do we know about the staircase down to Dawn's ship?" },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Two landings, both narrow. He'll position there. Three crown archers at the top, two guards on each landing, Kian center on the lower one. Standard royal-elite formation. We come in from the cliff plateau, we go out through the ship at the bottom. The middle is what costs." },
      N("The squad rides on toward Para Harbor in the long blue hour before sunrise. The road climbs.")
    ]
  },
  // -------- Pre-Battle 11 (the cliff plateau at sundown) --------
  // Sets the visual frame for the cliff battle. Squad arrives on the
  // plateau at sundown; Kian's contingent is already on the staircase
  // below them. The colony-truth reveal is held back to B11's round-1
  // dialogue (it's the in-fight beat that anchors the chapter), so
  // this arc focuses on the squad's last preparations + Lucian's
  // quiet acknowledgment of where he stands.
  before_cliffs: {
    id: "before_cliffs",
    title: "Sundown above Para Harbor",
    subtitle: "The cliff plateau, the staircase, the ship below",
    music: "ravageDaredevil",
    backdrop: "cliffs",
    next: "prep:b11_cliffs",
    beats: [
      N("The harbor road ends at a stone plateau two hundred feet above Para Harbor. Madame Dawn's ship is tied up at the south dock — a long-hulled merchant ship with three masts, its crew already aboard, lanterns lit, sails ready to be cut loose. The only way down is the slate staircase carved into the cliff face. Kian is on the lower landing. The King's elite are with him. They have been waiting a while."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Six guards visible. Kian on the lower landing. Two crown archers on the middle landing — they have line on the entire descent. Standard formation but the elite tier; these aren't Thuling watchmen. We push down the stairs and we trade." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
        body: "I'll take the rear and the bottleneck on the upper stair. Anything that gets behind the squad goes through me first." },
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Lucian — you're shoulder-bolted from the ravine. You're not at full strength." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(simple) I know, Ning. I've thought about it. I'm taking the rear." },
      N("Amar walks to the cliff edge for one breath alone. The light over the harbor is the exact gold he remembers from sundowns in the life he had before the hospital. He thinks of his father. He thinks of Selene's hand on the practice yard rail. He thinks of Lucian putting his daughter to bed in the house they will never go back to."),
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "(to the squad, returning) We go down the staircase together. We don't break formation for any reason. Maya leads, Ning covers from the upper landing, Leo flanks east on the Dactyl. Lucian holds the rear. I take Kian. Nobody else takes Kian. Confirm." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Confirmed." },
      { speaker: "Ning", portraitId: "ning", body: "Confirmed." },
      { speaker: "Leo", portraitId: "leo", expression: "ready", body: "Confirmed." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Confirmed, your highness." },
      N("Lucian's smile is the one he uses when he's said something on purpose. Amar catches it, holds his eyes a second longer than usual, and turns toward the stairs. The squad descends.")
    ]
  },
  // -------- Post-Battle 11 (Lucian's death, the boat, the crossing) --------
  // The first half's emotional climax. Lucian's wound from B11 (the
  // crossbow bolt at the end of the battle, narrated in the
  // before_victory dialogue) lands here. He dies in the cabin of
  // Dawn's ship as the boat clears the harbor. The arc ends with
  // the squad on the open sea, no land in sight, the year of travel
  // to Grude beginning. Closes out the playable slice for now;
  // routes to credits with a "to be continued" sting.
  post_cliffs: {
    id: "post_cliffs",
    title: "Below decks, the boat moving",
    subtitle: "The crossing to Grude begins",
    // Sadness over the broader "emotional" cue — Lucian's death is the
    // arc's gravitational center and the dedicated sadness track lands
    // the right weight (cue is reserved in the Music palette comment
    // for grief beats).
    music: "sadness",
    backdrop: "cliffs",
    next: "story:before_ravage",
    beats: [
      N("The squad reaches the ship at moonrise. Dawn's captain is a woman in her fifties who introduces herself as Khione, says nothing else, and orders the lines cut the moment Amar's boots clear the dock. The boat pulls away from the harbor faster than a ship its size should be able to. Kian's body is still on the lower landing. The squad does not look back."),
      N("Below decks, the captain's mate brings a lantern and a bowl of water. The squad has time to stop moving for the first time in twelve hours. That's when Maya sees the dark spread across the back of Lucian's tunic."),
      { speaker: "Maya", portraitId: "maya", expression: "alarmed",
        body: "Lucian. Off your feet. NOW. Ning — the bandages from my pack, the brown cord, MOVE." },
      { speaker: "Lucian", portraitId: "lucian", expression: "dying",
        body: "(quietly, sitting down against the bulkhead) It's all right. It's all right, it's all right. The bolt went through. Front to back. Clean shot. Sit me up against the wall, Maya. I want to see Amar." },
      N("They move him slowly. The bolt did not go clean through. It clipped the lung on the way out. Lucian knows this. He has seen this kind of wound before. He is not afraid."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Amar. Come here, your highness. Closer than that. Right next to me. Good." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(quietly) Lucian. I'm sorry. I should have seen the archer at the cliff edge. I had Kian's eyes, I wasn't watching the —" },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Stop. Stop. Listen to me. Three things, fast, before I forget them. One. Mira and Tali — you write to them every season. Even if there's nothing to say. Especially if there's nothing to say. They need to know there's a man out there who remembers their father. Promise me." },
      { speaker: "Amar", portraitId: "amar", body: "Every season. I promise." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Two. Maya is the smartest person in this squad. Including you. Listen to her like you used to listen to me. Three. Don't fight for the colony. Don't fight for the empire. Don't fight for Dawn's flag. Don't fight for the throne your father lost. Fight for the people standing next to you. Kian was right about that. He was wrong about almost everything else. He was right about that." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Lucian." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(soft) ...You're going to be all right, Amar. You're a good man under the man you've been hiding under. I saw that the first day at the forge. Take care of them. Take care of yourself." },
      N("Lucian's breathing slows over the next quarter hour. The squad sits in the lantern-light around him without moving. Ning holds his hand. Maya keeps pressure on the wound long after pressure stops mattering. Leo sits at the door of the cabin with his back to it because nobody trusts the captain's crew yet and he doesn't want anyone walking in. Amar is the one Lucian dies looking at. The boat continues to move."),
      N("Up on the deck, an hour later, the harbor lights are gone and open sea is the only thing in any direction. The captain finds Amar at the stern rail. She speaks for the first time since she gave them her name."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Madame Dawn extends her sympathies. The voyage is fourteen months. We will reach Grude in late summer next year. The squad has the run of the ship. The food is plain. The wine is good. We do not stop on the way." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Captain. I want a sea burial for Lucian. Off the western rail, before the sun comes up. With the squad present and the ship stopped." },
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "We do not stop, your highness. But we will slow. The squad will be present. The western rail at dawn." },
      N("The ship slows in the gray hour. The squad gathers at the western rail. Lucian goes into the sea wrapped in the flag the cousin's wife stitched two summers ago for the Thuling festival — Maya took it off the wall of his house on her way out the back gate and rode with it folded under her saddle the whole night. Nobody says anything. Ning is the one who lets the bundle slip from her hands. The water takes it without sound."),
      N("The ship turns west again. The squad stands at the rail until the sun is fully up. Then Amar walks to the stern, opens his pack, and takes out the small wooden practice sword Lucian carved for him on the night they met at the forge. He holds it for a long time. He doesn't put it back in the pack."),
      N("Khione confirms it: fourteen months west across open water. The squad has the run of the ship. The weather will be hard for a long stretch in the middle. The crew will keep its distance unless asked. There is wine if the squad wants wine. There is not enough sky for the dactyl, who refuses to settle until the third week. The crossing has begun.")
    ]
  },
  // -------- Pre-Battle 12 (the long crossing + first sight of Grude) --------
  // Bridges post_cliffs across the fourteen-month sea voyage and lands
  // the squad at the gangway of Khione's ship in Grude's east port.
  // Compresses the year into a handful of montage beats — the script's
  // original "year of travel" framing in one arc rather than a full
  // mini-season of per-month chapters. Closes on the alarm bells that
  // open B12.
  before_ravage: {
    id: "before_ravage",
    title: "Fourteen months west",
    subtitle: "The crossing, then the gangway at Grude",
    music: "emotional",
    backdrop: "grude",
    next: "prep:b12_ravage",
    beats: [
      N("The first month is grief. The squad moves through it the way the ship moves through still water — slowly, at no pace of their own, without comment."),
      N("The second month is reading. Maya, mostly. She sits cross-legged on the foredeck with stacks of Grude political pamphlets she had stowed in the cargo hold before they boarded — old court rulings, harbor regulations, council membership lists. She makes notes in three colors of ink. She doesn't share them yet."),
      N("The fourth month is Ning teaching herself to fletch arrows in a shifting wind. Khione hands her a windrose — a chart of how the wind turns — one afternoon, without a word, and walks away. Ning works it out alone over the next four weeks."),
      N("The seventh month is Leo and the dactyl finally walking the full length of the ship together without incident. The dactyl — Ash, the squad has been calling him Kid — stops being afraid of the deck. Leo stops being afraid he made the wrong call."),
      N("The ninth month is Amar taking out Lucian's wooden practice sword in the cabin he shares with Leo, holding it for an hour, and quietly carving a single word into the underside of the grip. He doesn't show anyone what the word is."),
      N("The eleventh month, Maya breaks her own rule and sits down across from Amar in the mess one night with a stack of Grude maps and a single sheet of paper. She doesn't open the paper. She doesn't speak. Amar looks at the paper. Amar looks at Maya."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I promised you I'd wait until you asked. You haven't asked. I want to ask you a question instead. May I tell you ONE thing about your old life — one — before we land?" },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "...One thing. Yes." },
      { speaker: "Maya", portraitId: "maya",
        body: "Your father didn't die in the war you remember him dying in. He died before you were born. The man you called your father was your mother's older brother, who raised you because your mother was elsewhere doing something complicated. Your mother is alive. She wrote me the letter that's under this map. I'm not going to read it. You're not going to read it tonight. But I wanted you to know it exists, before Madame Dawn meets us at the gangway and tries to be the first one to tell you anything." },
      N("Amar doesn't ask whose letter it is. He doesn't have to. He sits with Maya for a long time without speaking. The lantern burns down. Maya leaves the letter under the map and goes to bed without looking back."),
      N("Three months later, in late summer, Khione brings the ship around the southern headland into Grude's east port. The squad lines the rail. The city is taller than anything they have ever seen. The buildings climb a hill in three terraces. The signage is in three languages. The harbor smells like a different country."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Ten minutes to dockside. Madame Dawn's papers are good at every customs platform on the coast — we're flying her flag in the foreflag and the empire's in the back. The captain on the platform won't look twice. (Pause.) Unless he's been told what to look for." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "He's been told. The crossbow stance from a hundred meters out is wrong for routine customs. Amar — formation. Ning, fletching check. Leo, dactyl on the gangway with us, not in the hold. We're walking off the ship in arrowhead." },
      N("The gangway lowers. The squad steps off into the empire. The alarm bell at the customs platform begins to ring before Amar's boots clear the wood.")
    ]
  },
  // -------- Post-Battle 12 (Dawn's safe house, the rest of the speech) --------
  // The squad reaches Dawn's inner-district safe house, takes off armor
  // for the first time in fourteen months, and listens. Dawn finishes
  // the colony-truth speech she started from the window. The "my son"
  // remark from the battle gets contextualized but NOT fully resolved —
  // the family-tie reveal lands in B14. Closes on the squad's first
  // night under a roof in Grude.
  post_ravage: {
    id: "post_ravage",
    title: "The safe house, second floor",
    subtitle: "Dawn finishes the speech she started from the window",
    music: "lifeInGrude",
    backdrop: "grude",
    next: "story:before_dawn_rebellion",
    beats: [
      N("Dawn's safe house is the upstairs of a candle-maker's shop on a quiet inner-district street. The candle-maker downstairs nods to Khione without speaking and does not look at the squad at all. Up two flights of stairs is a long room with a bay window facing the harbor, a low table, four sleeping mats already made up with fresh linens, and tea steeping in a clay pot. Ndara stands at the table pouring."),
      { speaker: "Ndara", portraitId: "ndara", expression: "neutral",
        body: "The mountain village. Eleven months ago. You came after my brother. He held the gate for me. He went down at the gate. I ride a dactyl. I asked you the question on my way out. (Pause.) I am Madame Dawn's lieutenant. I have been since before any of you were born. The mountain village was not a job I chose. It was a job I did. I would like to apologize to the squad for what I cannot give back, and then I would like to pour you tea." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "...Ndara. Your brother said your name was Ndara on the ridge before he fell. I — I have been thinking about him for eleven months." },
      { speaker: "Ndara", portraitId: "ndara",
        body: "I have been thinking about him for eleven months as well. Tea, your highness." },
      N("Maya takes the tea first, which is how Maya signals to the squad that the room is safe. The squad sits. Dawn enters from a side door and stands at the window with her back to them for a long moment before she speaks."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Eighty years ago, King Archbold of Grude — that's the great-grandfather of the man on the throne now, also called Archbold — looked across the western sea at the long peninsula you call Anthros and decided he wanted the iron under it. He didn't have the army for an outright conquest. So he found a local strongman in Para — a minor noble named Nebu — and he installed him as king. Nebu's grandson, the man your father tried to kill, is the one your generation knows. The arrangement has been in place since before any of you were alive. Anthros is a colony. Grude is the empire. The harvest failures your villages have been blaming on the Para crown for sixty years are because the iron under Anthros is being shipped here, to the empire, to be turned into the swords that just tried to kill you on the dock." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "(quietly, to the squad) I've known this for nine years. I'm sorry I didn't tell any of you. I needed the ground under your feet to be the ground under MY feet first." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Your father knew it, Amar. Your father's coup wasn't against Nebu. It was against the colonial arrangement. The reason he died in his own throne hall is that Grude noticed. The reason YOU survived your own coup eleven years later is that I was paying close attention to which boy in the hospital ward was the one who'd been calling himself a forge worker — and I sent for you. Through Maya. Through Lucian, indirectly. Through Ndara at the village. Through Kian, in his own awful way. (Pause.) I have been pulling you toward this room for a long time, Amar. I owe you the courtesy of saying it out loud now that you're here." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(quietly) ...You said \"my son\" from the window." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "(holds his eyes) I did. I'd like to leave the rest of THAT conversation for the morning, Amar. There is a great deal of it, and you have a great deal still to process tonight, and Lucian's brother is here in Grude to meet you tomorrow at noon and I'd rather you sleep first." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "Lucian had a brother in Grude?" },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "Lucian had a brother in Grude. His name is Aren. He runs the inland courier route for my organization. He has known about the squad for eleven months. He has a letter from Lucian, written in the cabin before the bolt. (Pause.) Tomorrow, Amar. Sleep tonight." },
      N("The squad doesn't speak for a long time. Ning is the one who eventually picks up her tea. Leo follows. Maya is already halfway through hers. Amar sits with the cup between his hands and watches the harbor lights through the bay window. Dawn excuses herself before midnight. Ndara stays."),
      { speaker: "Ndara", portraitId: "ndara", expression: "neutral",
        body: "(quiet, to the room) I will take the watch tonight. None of you slept on the ship. None of you slept on the dock. Sleep here. There is no second wave coming through this door tonight. I am personally responsible for that." },
      N("The squad sleeps under a roof for the first time in fourteen months. The dactyl, in the courtyard below, settles at last. The harbor lights go out one by one. The empire continues around them in the dark.")
    ]
  },
  // -------- Pre-Battle 13 (the rebellion plan + Rose's introduction) --------
  // Bridges three weeks of quiet life-in-Grude into the night the
  // rebellion lands. Squad has settled into the safe house, met
  // Madame Dawn's lieutenants properly, started training together
  // in the courtyard. Tonight is the night Dawn moves. Rose is
  // introduced HERE so the player has a baseline read on her
  // before B13's combat starts — without this arc her death would
  // land as a bullet point.
  before_dawn_rebellion: {
    id: "before_dawn_rebellion",
    title: "Three weeks in Grude",
    subtitle: "The safe house common room, the night the rebellion moves",
    music: "lifeInGrude",
    backdrop: "grude",
    next: "prep:b13_dawn_rebellion",
    beats: [
      N("Three weeks in the safe house. The squad has slept on real beds. The dactyl has settled into the courtyard. Ndara has poured a great deal of tea. Amar has not yet taken the second-room conversation Dawn promised him at the gate — Dawn has not pressed the matter, and Amar has not asked, and the gap between them has been a quiet adult thing both of them have agreed to honor for now. Maya has been reading. Ning has been training with Dawn's archers in a courtyard a quarter mile away. Leo's dactyl is friends with three of Dawn's couriers' horses now. The squad has begun, in small ways, to live in Grude."),
      N("And then on a Tuesday at sundown Dawn comes into the common room with a folded map under her arm and asks the squad to come up to her study, and the three weeks end."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Tonight. I have been assembling for nine years. Twelve coordinated strikes across this city in a single hour, starting at 11:14 PM when the river bell rings second watch. The targets are King Archbold's three nephews, the four customs wardens who personally collect the colony's iron tax, four ledger-keepers who can identify the financiers, and one man who runs the prison the original organizers' families have been held in for seven years. The aim is not to kill an empire in one night. The aim is to make the empire know it CAN be killed. After tonight the rest of Grude knows there is a war. We are not asking the squad to participate. We are inviting it." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "We're in. What's our target?" },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "The youngest nephew's residence. Upper district, off Oran Lane. Lightly garrisoned — the boy has never had to be afraid in this city, and the captain assigned to him is a politically-promoted incompetent. Rose has been mapping the plaza for weeks. She'll lead you in." },
      N("The door to Dawn's study opens and a woman the squad has not yet been introduced to walks in. Mid-thirties, dark hair pulled back, a long teal officer's coat over a homespun shirt, a thin sword at her hip and a row of throwing blades along her belt. She nods to the squad without smiling. She has the Maya look — the careful, measuring read."),
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "Squad, this is Rose. She has been one of my lieutenants for twelve years. She and Maya were in the same officer cohort. Rose, the squad you've been writing reports about for eleven months." },
      { speaker: "Rose", portraitId: "rose", expression: "neutral",
        body: "(small nod) Amar. Maya. Ning. Leo. (Pause.) I'm glad to finally put faces to names. I have read everything Maya has sent for eleven months. I have a great deal of respect for each of you. Tonight will be hard. I would like to walk you through the plaza layout one more time before we move." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Rose. Hi. (Quiet, between them.) ...It's good to see you in person. Eleven years through letters. It's a lot." },
      { speaker: "Rose", portraitId: "rose", expression: "brisk",
        body: "(half-smile, only at Maya) It is. Talk later. We move at 11:14." },
      N("Rose unfolds the map. She walks the squad through the plaza three times — captain's positions, archer angles, fountain cover, the two stone benches, the south alley approach. She is precise. She is forward-leaning. She is very obviously the person Dawn trusts more than anyone else alive. The squad does not need to be told this; they can see it in the way Dawn watches Rose work the map without interrupting once."),
      { speaker: "Rose", portraitId: "rose", expression: "brisk",
        body: "Eight minutes from approach to plaza-clear. We move." },
      N("The squad collects their weapons. Madame Dawn pulls Amar aside at the door for half a sentence Maya does not hear. Rose is already on the stairs. The river bell, somewhere in the distance, begins to ring second watch.")
    ]
  },
  // -------- Post-Battle 13 (the morning after Rose) --------
  // The chapter's emotional core lands here. Lucian's death at
  // post_cliffs was about Lucian saying his three things and going.
  // Rose's death is about Dawn — Dawn's grief, her forty-eight
  // hours of silence, the moment she breaks. The squad is the
  // witness, not the bereaved.
  post_dawn_rebellion: {
    id: "post_dawn_rebellion",
    title: "After the plaza",
    subtitle: "Three days of quiet in the safe house",
    music: "emotional",
    backdrop: "grude",
    next: "story:before_origin",
    beats: [
      N("Dawn does not move from the plaza for an hour. The squad keeps a perimeter without being asked. Ndara arrives at some point with a horse-drawn cart and a cloak the same teal as Rose's coat. The four of them — Ndara, Amar, Maya, Leo — lift Rose into the cart. Dawn walks alongside the cart on foot the whole way back to the safe house. Ning takes the rear with her bow nocked. Nobody speaks."),
      N("The other eleven strikes in Dawn's plan succeeded. All twelve targets are dead. The city wakes up the next morning to flyers nailed to every public board, written in three languages, listing the names of the dead and the names of the original organizers whose families had been held in the prison and the names of the colony villages whose harvests had been taxed for the iron under their feet. By noon the upper district is in chaos. By sundown the empire has issued its first formal acknowledgment that an organized armed opposition exists. Dawn has been right about everything she said the rebellion would do."),
      N("Rose is buried at dawn the next day in the small private courtyard behind the candle-maker's shop, in the shade of the lemon tree. Dawn is the one who speaks. She speaks for less than a minute. Nobody who is there will remember exactly what she said afterward, only that she did not weep and her hands did not shake and her voice was the same flat, measured tone the squad has heard her use in every briefing and every meeting since they arrived in Grude."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Rose Eseldra. Born in the Tarvas valley fifty-one years ago. Joined the resistance at nineteen. Officer at twenty-two. Lieutenant at twenty-six. With me for thirty-two years. Loved by — (pause) — by the people who knew her. By me. By Maya, who she trained. By many others. Killed by four bolts she stepped in front of for me. The plaza will be renamed in her honor in due course. The lemon tree will stay. The squad has the rest of the morning to themselves. I have meetings." },
      N("Dawn walks back into the safe house and is in meetings for the rest of the day and the day after that. The squad doesn't see her at meals. Maya knocks on her study door at sundown on the second day and is not let in. Ndara makes tea every evening that Dawn does not drink. The fourth night, Amar finds Dawn at the courtyard wall, sitting on the bench under the lemon tree, with the empty teacup from a previous evening in her hand. He sits down next to her without asking. They do not speak for a long time."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "(eventually) She wanted to retire next year. Twelve more months. We had picked a cottage on the south coast. She was going to teach combat history to officers' children. I was going to come visit. I haven't been to the south coast in nine years. I was looking forward to the visits more than she was, I think. She was looking forward to the cottage. (Long pause.) The plan worked, Amar. Every piece of it. Twelve targets, twelve down. Rose is the only one of ours who fell. The math is the best math we have ever produced. I have done the math twice. I cannot make myself feel better about the math." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...Dawn. You don't have to do the math. Not tonight." },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "I do, though. (Quiet.) I am the only person alive who knew Rose for thirty-two years. I am the only person alive who can do the math on what Rose was for. If I don't do it, no one does. (Pause.) Tomorrow we go back to work. The empire will respond inside a week and we have to be ready. Tonight I sit here with the cup. (Pause.) Thank you for sitting." },
      N("Amar sits with her until the lemon tree is in shadow and the courtyard goes dark. He doesn't speak again. Dawn never quite weeps, but there is a moment near midnight where she sets the cup down and puts her face in her hands for a quarter of an hour, and Amar simply does not look at her until she lifts her head again. When she stands up to go inside, she pauses at the back door."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Amar. There is a conversation you and I have been not having for three weeks. I would like to have it tomorrow afternoon. In the study. Maya should be there. Ndara should be there. There is a great deal you do not yet know about who you are, and tonight has clarified that I do not have indefinite time to put off telling you. (Pause.) ...Sleep well." },
      N("She goes inside. Amar stays in the courtyard another hour. The empire continues, somewhere beyond the candle-maker's wall, in the dark.")
    ]
  },
  // -------- Pre-Battle 14 (the study; the parentage reveal) --------
  // The conversation Dawn promised at the end of post_dawn_rebellion.
  // Dawn finally names Amar's parents: she is his mother, and King
  // Archbold of Grude is his father. The arc also reconciles the
  // earlier before_ravage beat where Maya told Amar his father "died
  // before you were born" — that was a cover story Dawn fed her own
  // officer, not the truth. The conversation is cut off by the
  // candle-maker's warning rhythm: Archbold's household guard has
  // found the safe house. Routes into B14's prep.
  before_origin: {
    id: "before_origin",
    title: "The conversation Dawn promised",
    subtitle: "Dawn's study, the afternoon after the plaza",
    music: "emotional",
    backdrop: "study",
    next: "prep:b14_origin",
    beats: [
      N("Dawn's study takes up the back half of the safe house's top floor. One window, a great deal of paper, a map of the western sea pinned flat under four stones. Dawn is already seated when the squad comes up. She has set out four chairs. She does not stand."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Sit, all of you. Amar in the chair by the window — I want the light on you for this. You have earned the courtesy of being seen. Maya and Ndara already know most of what I am going to say. They are here so that you are not the only person in this room carrying it when I am done." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "You've put this off for three weeks, Dawn. You put it off across a year at sea, and eleven years before that. Whatever it is — say it plainly. I am tired of being the last person told the truth about my own life." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Plainly, then. I will not soften it. Softening it would only be one more way of handling you, and you have been handled enough.\n\nI am your mother, Amar. You were born to me thirty-one years ago, on the Grude coast, in the spring. I carried you, I named you, and for the first eleven months of your life I held you every night myself." },
      N("Amar does not say anything. The light from the one window is on his face, exactly as Dawn arranged it. Nobody in the room looks away from him, because Dawn told them not to."),
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "(quietly) ...You said \"my son\" from the window at the harbor. I told myself it was a way of speaking." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "It was not a way of speaking. (A breath.) There is a second half, and it is heavier than the first. Your father is alive. His name is Archbold. He is the King of Grude — the emperor whose household guard you have spent two years cutting to pieces. You are the trueborn child of the woman leading this rebellion and the man it exists to bring down. There is no kinder arrangement of those facts. I have looked for one for thirty-one years and there is none." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "Maya told me on the ship that my father died before I was born. She sat across a table from me and she said it to my face." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I told you what I had been told, Amar. (She looks at Dawn, and it is not a warm look.) I have served Madame Dawn for eleven years and I would have sworn on my life that your father was a dead man. Apparently I was a cover story's length away from the truth, the same as you. So. We learn this part together." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Maya is owed that anger and I will take it. I gave my own officer the false version on purpose. The truth of your father is the single most dangerous sentence in my organization, and a sentence that is never spoken aloud cannot be tortured out of anyone who does not know it. I kept Maya safe by keeping Maya ignorant. I am not proud of it. I would do it again." },
      { speaker: "Ndara", portraitId: "ndara", expression: "neutral",
        body: "(evenly, to Amar) I have known since before the mountain village. It does not get lighter for being held a long time. But it can be set down now. Let her finish." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Thirty-two years ago I was not the woman who runs this rebellion. I was a daughter of the Grude high council, married into Archbold's court, close enough to the throne to read the empire's ledgers myself. I read them. I learned what the colony of Anthros was for — the iron, the harvests, the eighty years of managed starvation. And I learned that I was carrying the heir to all of it." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "I could not raise a child inside the thing I had decided to destroy. Archbold would have made you into the next link of the chain — or, once I turned, into a hostage against me. So eleven months after you were born I did the hardest sum of my life. I sent you across the sea, to Anthros, to my older brother. He raised you as an ordinary man of a colony that did not know it was a colony. He let you believe he was your father. He was a good man and he kept the promise until the day he died. You became, entirely on your own, a man who tried to free Anthros from an empire — without ever knowing the empire was half your own blood." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "You arranged all of it. The forge. Lucian. Maya in the squad. Kian, somehow. You have been moving me across a board since before I could walk, and every person I have ever loved was a piece you placed." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "I placed the squad. I did not place what the squad became to you, or you to them — that you built yourselves, and it is the one thing in your life that is wholly your own. I will not apologize for reaching for my son across thirty years and an ocean. I will apologize, once, for how much it cost the people standing between us. Rose is the most recent name on that list. She is not the last. I want you to understand what you are joining before — " },
      N("Dawn stops. Below them, faint through the floorboards, the candle-maker downstairs is tapping a fast, uneven rhythm on a ceiling beam with the handle of a broom. Three taps, two, three. Ndara is already on her feet."),
      { speaker: "Ndara", portraitId: "ndara", expression: "commanding",
        body: "That is the far-watch signal. Soldiers on the street, moving with purpose, more than a patrol. They have found the house." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Then the rest of the conversation waits. Amar — down the stairs, into the street, before they can stack the door. Whatever you are, you are also still the person they are here for. Move." }
    ]
  },
  // -------- Post-Battle 14 (the unfinished conversation) --------
  // Aftermath of the safe-house street fight. Dawn closes what the
  // alarm cut off — not the whole of it, but enough to land the
  // chapter's thesis: Amar is exactly half rebellion and half empire,
  // and both halves now know he exists. Seeds B15 (a traitor inside
  // Dawn's own camp).
  post_origin: {
    id: "post_origin",
    title: "Exactly half",
    subtitle: "The safe house, after Castor's detail withdraws",
    music: "emotional",
    backdrop: "grude",
    next: "story:before_inner_coup",
    beats: [
      N("The squad does not go back upstairs right away. They stand in the emptied street while Ndara walks the cobbles, counting the enemy gear left behind and finding, in the end, that the household guard carried even their own fallen away. A retrieval detail leaves nothing. It is not the same kind of enemy the squad fought in Anthros."),
      N("When they do go up, Dawn has moved the four chairs back against the wall. She is at the window with her hands folded, watching the street where Castor's men were."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "I will not make you sit through the rest of the speech tonight. You have heard the load-bearing parts of it. The rest is detail, and detail can wait for a morning when no one has just tried to walk you out of the city. But I will give you the one sentence I was reaching for when the broom started." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "Everything you have done — the coup in Para, the squad, the year at sea, the plaza three nights ago — you did believing you were a man of Anthros striking up at an empire. You were only ever doing half of it. The other half was an empire's heir striking at his own father's house. Both of those things are true at once. They will be true for the rest of your life. The work in front of us is deciding what a person who is exactly half of each does with the whole of himself." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(after a long moment) ...Lucian told me, dying, to fight for the people standing next to me. Not the colony, not the empire, not a flag. The people. (Quiet.) That's the only instruction I've been given in two years that didn't come with a board attached to it." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "(a small pause) Then your foreman was a better strategist than I am, and I have known that since Maya's third report. Hold onto his instruction, Amar. You will need something that is yours when the rest of this gets worse." },
      N("Maya catches Amar on the stairs afterward. She is not calculating anything; for once she just looks tired."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "She fed me a false version of your father for eleven years and I never once caught the seam. That frightens me more than Castor did. If Dawn can run a cover story past me for a decade — someone else in this house could be running one past her right now. I am going to start watching the people who watch us. Sleep. I will not be." },
      N("The squad sleeps under the candle-maker's roof again, in a city that now contains a king who knows his son is here. Somewhere below the floorboards Maya does not sleep, and begins, very quietly, to count the people Dawn trusts.")
    ]
  },
  // -------- Pre-Battle 15 (Maya's hunt closes; Ndara is found) --------
  // Maya's count of the people Dawn trusts (post_origin) lands on
  // Quartermaster Coyne — the safe house's own supply officer, and the
  // leak that put Castor's detail on the door at B14. Ndara works it
  // out an hour ahead of Maya, goes to face Coyne alone, and is found
  // in the courtyard alive but not waking. The squad moves on the
  // courtyard before Coyne can finish leaving. Routes into B15's prep.
  before_inner_coup: {
    id: "before_inner_coup",
    title: "The people who watch us",
    subtitle: "Dawn's study, six days after Castor",
    music: "danger",
    backdrop: "study",
    next: "prep:b15_inner_coup",
    beats: [
      N("Maya spends six days doing what she told Amar she would do. She does not sleep much. She pulls three months of the safe house's supply manifests out of a locked drawer she was not given the key to, and she lays them across the study floor in a grid, and she reads them the way she read the bandit cohort at the eastern road two years ago — looking for the one hand that touched everything."),
      { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
        body: "Madame Dawn. Every message into this house and every message out of it, for three months, passed one desk before it reached yours. Reroute orders, courier schedules, the laundry rota — all of it. One man sees the whole shape of this safe house, and it is not you, and it is not me. It is your quartermaster. It is Coyne." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Coyne has run my Grude supply line for nine years. He buried two of my couriers with his own hands when the empire took them. (A pause — and the pause is the tell.) ...And he is also the only answer that fits the question of how Lord Castor found a door that six people in the world knew the location of. Say the rest of it, Maya. You did not lay out a floor of paper to stop at a name." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I didn't. I need you to send someone steady to bring Coyne in before he reads the room — quietly, no alarm, before he can —" },
      N("The study door opens without a knock. It is one of Dawn's couriers, and the courier's face is doing the thing a face does when it has just run up two flights of stairs with the worst news it has ever carried."),
      { speaker: "Courier", body: "Madame — it's Ndara. The courtyard. She's down, she's breathing, but she won't — she won't wake up, Madame, we can't wake her." },
      N("Ndara, it turns out, did not need Maya's floor of paper. She reached the same name an hour earlier, the way Ndara reaches everything — alone, and directly. She went to the courtyard to put the question to Coyne herself. The squad finds the answer she got written across the cobblestones by the lemon tree, and Coyne is no longer anywhere in the house that Dawn's people are looking."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "(very quietly) Carry Ndara upstairs. A cot, not the floor. Khione will sit with her." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "And find me Coyne. He has not left — the river gate is watched and the harbour gate is watched, and a man who has spent nine years learning my house knows that. He will be going out the one door he is certain of. The courtyard's back gate. (To the squad.) He will not be alone. A man does not betray a rebellion and forget to hire a way out." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then he doesn't reach the gate. Squad — the courtyard. Now. Whoever Coyne's bought, they're standing between us and the man who put Castor's crossbows in that street. Move." }
    ]
  },
  // -------- Post-Battle 15 (Ndara does not wake; Dawn hardens) --------
  // Coyne is dead. Ndara survives, in a coma. The betrayal from inside
  // her own house is the thing that finally hardens Madame Dawn — she
  // stops asking the squad to follow and starts telling them. The arc
  // closes on the shift in her, and on the demand she is about to make
  // of Amar (the Anthros throne — set up here, delivered at B16).
  post_inner_coup: {
    id: "post_inner_coup",
    title: "The asking stops",
    subtitle: "The safe house, the morning after the courtyard",
    music: "emotional",
    backdrop: "grude",
    next: "credits",
    beats: [
      N("Coyne is buried outside the city walls, in unmarked ground, by people who do not speak on the way there or the way back. Dawn does not attend. The courtyard is scrubbed. The lemon tree, which has now had blood at its roots twice in a month, goes on being a lemon tree."),
      N("Ndara is moved to the bright upstairs room with the bay window. Khione sits with her through the first night and the second. On the third morning she finds Amar on the stairs and tells him the truth as she has it."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Her body is mending. The blow to her head is the question, and it is not a question I can answer and neither can any physician in this district. She may wake tomorrow. She may wake in a season. She may not. I have seen each of those three endings with my own eyes, on other cots, and I have never once been able to tell which was coming. I am sorry. I know she is the steady one. You will all have to be steadier without her for a while." },
      N("Dawn gathers the squad in the study that afternoon. She does not sit, and she does not offer chairs. The four chairs from the parentage conversation are stacked against the wall. When she speaks, the squad hears the change in it before they hear the words — the careful, inviting register she has used since the harbour is simply gone."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "For thirty years I have asked. I asked people to join. I asked them to risk. I asked Rose to walk a plaza and I asked Ndara to trust a house, and I have just buried one of those askings and I cannot wake the other. I am done asking. The empire put a knife inside my own walls and the knife had served me nine years. Politeness is a thing I could afford when the war was far away. It is not far away. It is in the courtyard." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "So I will tell you instead of asking you, and you may measure for yourselves whether you can still stand to follow a woman who has stopped pretending the difference. The rebellion does not need another martyr and it does not need another safe house. It needs a face the colony will rise behind — a true one, with real blood in it. (She looks at Amar, and does not soften it.) It needs the throne of Anthros to have an heir standing in the open. We will discuss what that requires of you, Amar, tomorrow. Tonight, rest. The discussion will not be a gentle one." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...You buried Rose three weeks ago telling me grief shouldn't be rushed. Now you can't get to the next move fast enough." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "(a beat) Yes. That is exactly what betrayal from inside a house does to a person, Amar. It teaches them that the slow, kind version of the plan is a luxury bought with other people's lives. I would rather you learn that from watching me than the way I learned it. Tomorrow." },
      N("Dawn leaves the study first, which she has never done. The squad stands among the stacked chairs. Maya is the one who finally speaks, and she speaks quietly, and only to the people in the room."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "She's not wrong. That's the part that should frighten you. She has just become a great deal harder to argue with — and a great deal harder to refuse. Whatever she puts in front of you tomorrow, Amar: walk in already knowing your own answer. Don't let her hand you hers." },
      N("The squad does not sleep especially well. Upstairs, Ndara breathes slowly in the bright room and does not wake, and the rebellion waits for morning with a harder woman at the head of it than the one who crossed the sea to fetch them.")
    ]
  }
};
