// Story beats: dialog cards bracketing each battle. Each beat is a single screen
// with a portrait (or none), a speaker name, a body, and an optional ambient color.

import type { ArcId, RouteRef } from "../data/contentIds";

export type PortraitId =
  | "amar" | "lucian" | "ning" | "maya" | "leo" | "ranatoli" | "selene"
  | "kian" | "ndari" | "nebu"
  | "dawn" | "fergus" | "ndara" | "archbold" | "khione" | "mira" | "tali"
  | "rose" | "coyne"
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
    | "sadness" | "sadness2" | "grudeBattle1" | "death";
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
      { speaker: "Lieutenant", body: "Seven of them. Inside the palace by midnight. The king sleeps with his door cracked an inch. Vanity, not strategy. They cut for the throat." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "And the one in the throne hall." },
      { speaker: "Lieutenant", body: "First in. Last out, if any of them come out." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping", body: "He thinks the plan is his own. Let him keep that. It will be the only thing his side ever takes from us." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "Move the harbor people one tide early. If Nebu lives past morning, he will look outward, and outward is us." },
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
      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "lecturing", body: "Steel up, Amar. We bleed together or we feast together. Anything in between is shame." },
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
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "You're a key man, Amar. The harvest plan, the steel quotas. His Majesty has spent ten years on what you carry. We need you back on your feet." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "...The harvest." },
      N("You smile because Kian is watching. You don't tell him that the word means nothing to you, that you can't remember it at all.")
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
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "I'll be back at sundown to check on you. Your foreman at the forge is named Lucian. Tell him the King sent you. He hates that, which means you'll know him as soon as he scowls." },
      N("Inside the forge a broad-shouldered man hammers a horseshoe flat, with force that ends arguments before they start. Nearby a lean younger woman bags crossbow bolts, humming."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "You'll be Amar. Word came up the road. I'm Lucian; I run the line. Ning, on the rivet press. She'll ignore you a day, then never stop talking." },
      { speaker: "Amar", portraitId: "amar", body: "Amar. Kian said the King thought I'd be of use here. I don't —" },
      N("He almost says \"I don't remember much yet.\" He stops himself just in time. Lucian notices the catch and says nothing about it."),
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
      { speaker: "Runner", body: "Eastern road. Twenty of them, at least. They're flying a sash: orange, bone, orange. Same on every arm." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "That's not bandit. Bandits don't wear matching anything." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "What does it mean?" },
      { speaker: "Lucian", portraitId: "lucian", body: "Means somebody's paying them. Somebody who wants to be recognized." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we recognize them back. South of the road, behind the fences. Ning takes the fence line. Lucian and I bracket the wagons." },
      N("On the way out you pass a stranger at the corner table. She doesn't look up. She has already set coins down for a bill nobody has brought yet.")
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
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "The woman the sash points at. I'd name her, but you'd hear it all year and start feeling how she feels about you. Learn it from the world." },
      { speaker: "Maya", portraitId: "maya", body: "I'm Maya. I was traveling east. I've changed my mind." },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin", body: "Stay. Please stay. You read that fight like a book you'd already finished." },
      { speaker: "Lucian", portraitId: "lucian", body: "Why us." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile", body: "Because the boy in front cuts like a man who learned in a palace, and that's the kind of company I keep." },
      N("Amar doesn't blink. Lucian does: once, slowly, the way he does when he is making a quiet note of something to come back to later."),
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
      N("A small errand: deliver a package to a small farm two days north. It was Lucian's idea: get Maya out of town before the man with the sashes hears she is traveling with you."),
      N("At the gate, a rider waits. Polished armor in a town that doesn't polish armor."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "Amar! The General's compliments. He thought you might want company on the marsh road. Bandits, you know how it is." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "...Who is he." },
      { speaker: "Lucian", portraitId: "lucian", body: "King's man. Old friend of Amar's, supposedly. Says it often enough I've started to believe him." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "He's watching you the way I watch a draw I haven't read yet." },
      { speaker: "Amar", portraitId: "amar", body: "He's watching me the way he always has. Stay near Lucian. Marsh road is narrow. Single file once we hit the puddles." },
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
      N("Six bodies in the reeds, none of them yours. At the fire, Kian binds a forearm cut he took fairly, and will show the General as proof he was useful."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "Amar. That fourth one, the archer at the tree. You set him up like you'd seen the cover already." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Boy's been sparring with old soldiers since he could lift a stick. He saw me set the same cover at the wagons last week. Picks things up." },
      { speaker: "Kian", portraitId: "kian", body: "Mm." },
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "I'll take first watch. The General will want a full report. I want it accurate." },
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
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "Mountain bandits. A village they already burned. The leaders are siblings: Ndara, who plans, and her brother Ndari, who breaks things in front of her." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "Ndara. Like the queen Madame Dawn? That Ndara?" },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "Different woman. Same kind of trouble. The brother is the one you'll see first. He likes the front of a fight. The sister is the one you have to actually catch." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Bring everything. We won't be picking over bodies. They'll be picking over ours." }
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
      N("Ndari falls at the gate, holding the line so his sister can run. He goes down still grinning, the kind of grin that meant he had known the odds all along."),
      { speaker: "Ndari", portraitId: "ndari", expression: "scornful", body: "Tell her I held it. Tell her she owes me a drink." },
      N("Ndara escapes on a Dactyl as the last torches burn out. Her question hangs in the cold air."),
      { speaker: "Ndara", portraitId: "ndara", expression: "grim", body: "Why are you fighting on King Nebu's side, Amar?" },
      N("Leo doesn't seem to have heard. Lucian heard. Lucian sees you flinch."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "She didn't mistake you for anyone. And you've known that since she said it." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "Lucian — " },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Not tonight. The rest can wait. But for the first time, Amar, you have a witness." }
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
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "Then it'll be a quiet week for you. Take the road early, take it slow. The drivers are civilians. Keep them whole." },
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
      { speaker: "Amar", portraitId: "amar", body: "Maya. The captain. Search him." },
      N("She's already done it. The leather ledger is already in her hand. She passes it to Lucian, not Amar. She knows the squad still looks to Lucian first, by reflex."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Three columns. Route, schedule, payment date. The handwriting in the margin. Amar, you'd know this. You said you wouldn't, but you would." },
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
      { speaker: "Fergus", portraitId: "fergus", body: "An abandoned monastery in the high passes, north of Drennig, two days' climb. Raiders moved in last winter, started taking tax collectors. The Crown wants it cleared." },
      { speaker: "Amar", portraitId: "amar", body: "How many?" },
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "Half a dozen, maybe. A leader. Bring rope. The inner sanctum sits behind a bell tower, and whoever's holding it knows the climb." },
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
      N("Selene goes over the balcony, gone into the mist before Leo turns his Dactyl. Left behind: five bodies, and a question Amar can't answer in front of the others."),
      N("The camp is colder than the road. Maya takes first watch; Ning sleeps mid-stew; Leo finally lies down. Lucian and Amar stay up. The fire pops twice."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "She knew you. From the gate to the balcony, she knew you, and you knew her, and you fought her at half what I've watched you do to a bandit half her size." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded", body: "Lucian." },
      { speaker: "Lucian", portraitId: "lucian", body: "I'm not asking. I'm telling you I'm not asking. I'm telling you that whatever you say next, I have already decided what to do about it. Speak when you're ready." },
      N("Amar speaks for an hour. The coup. The seven. The hospital in Thuling. Selene by name, Ranatoli by name, the five he hasn't seen since. The throne hall. The plan."),
      N("Lucian listens until Amar is done. He does not interrupt once. He does not move. When Amar finally stops talking, the fire has gone down to embers."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "I thought it was something like that. I have a wife and daughter, Amar. Mira's forty-one, Tali's eight. Edge of Thuling, in a house these hands built." },
      { speaker: "Lucian", portraitId: "lucian", body: "If you're rebuilding this country into somewhere a girl named Tali can grow up without flinching, tell me when it's time to move. Until then, I'll cover you." },
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
        body: "And Amar, tomorrow, on the climb back, walk on my shield side. I'm done covering one flank at a time.",
        promote: "lucian"
      },
      N("Tomorrow the squad climbs back down the pass to Thuling. Two days later, Fergus has another contract waiting at the keep: a tax dispute three days' ride northeast, in a mining town called Orinhal.")
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
      N("At the Orinhal gate: not a riot but a famine: unarmed foremen and families between the King's tax detail and the last winter grain. Beyond, green cloaks: Madame Dawn's partisans."),
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
      N("The tax collectors break first. Townspeople emerge as the last of the King's men run. A woman finds her husband alive. The squad has to look away."),
      N("A figure in a gray cloak walks through the square as if she belongs there. She does not introduce herself to anyone but Amar."),
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral", body: "I'm Ndara. Not the bandit at the mountain village. Same name, different woman, you'll get used to it. I serve a queen called Madame Dawn. She has been watching you for a long time, Amar." },
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
      N("An hour's ride from the river crossing, they stop. Lucian's bolt went shallow but bent; Maya cuts it out with a knife nobody knew she had. Ning can't look away."),
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "That bolt was for me. That whole lane. He pushed me into the rock." },
      { speaker: "Lucian", portraitId: "lucian", expression: "dying", body: "(through gritted teeth) The lane was for whoever was standing in it. You were standing in it. Stop apologizing and finish that damn bandage." },
      N("A prisoner gives up Fergus by name. The General knew about Amar, and ordered the squad spent on impossible contracts until it stopped coming back. Lucian decided weeks ago."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "All right. I'll do this once and then we move." },
      // Maya's promotion fires when she steps out of the alias.
      {
        speaker: "Maya",
        portraitId: "maya",
        expression: "steel_cold_confession_face",
        body: "I'm Maya, that's true. Dawn planted me to read Amar, eleven months ago. Ride at dawn or die in Thuling tomorrow. Sorry for the shape. Not the answer.",
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
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we ride. Lucian, you take Mira and Tali to the cousin's farm. Catch up to us on the road." },
      N("Lucian rides for his house at Thuling's edge; the squad turns west. The plan is to collect Mira and Tali and make Dawn's harbor by first light. It is about to need adjusting.")
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
      N("Three in the morning. The squad rides back into Thuling at a hard pace. The streets are wrong: too quiet, too lit. The night watch is doubled. Torches in places torches don't usually go."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Kian beat us here. The watch is his. He's at Lucian's door already." },
      { speaker: "Lucian", portraitId: "lucian", expression: "alarmed",
        body: "Mira. Tali." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then we don't ride past. We ride through. Maya, take the back lane and get Mira and Tali out the rear gate while we hold the front. Lucian, you're with me." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
        body: "He'll have the front blockaded. Twelve men minimum. He'll talk first. He always talks first." },
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Then let him talk. We listen with arrows nocked." },
      { speaker: "Leo", portraitId: "leo", expression: "ready",
        body: "Maya, give me three minutes' head start. I'll ride my Dactyl over the back gate and clear whatever's between you and the lane." },
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
      N("They clear the western gate at a run. Leo catches up with Maya on the Dactyl; Mira and Tali head north via the cousin's farm. Lucian rides in silence."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(quietly) I told her it was a trip. Mira asked to bring her cat. I said no. Should have said yes. She'd have had something to hold." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "We can send for the cat. I'll write the cousin's wife once we make Grude." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(small smile) ...That'd be all right. Thank you, Maya." },
      N("Amar rides at the front, not trusting himself to speak. The cliffs come at sundown. The whole ride he's hunted for a version where Kian doesn't fall. He hasn't found one."),
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Amar. The cliffs are four hours up the harbor road. We have time to plan, or time to grieve. Pick one." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Plan. We grieve on the boat. Maya, what do we know about the staircase down to Dawn's ship?" },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Two narrow landings. Three archers top, two guards each landing, Kian center on the lower. In from the plateau, out through the ship. The middle is what costs." },
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
      N("The road ends on a plateau above Para Harbor. Dawn's ship waits below, sails ready. The only way down: the cliff staircase, where Kian and the King's elite are waiting."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Six guards visible. Kian on the lower landing. Two crown archers midway with a line on the whole descent. Elite tier, not Thuling watchmen. We push down and trade." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
        body: "I'll take the rear and the bottleneck on the upper stair. Anything that gets behind the squad goes through me first." },
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Lucian, you're shoulder-bolted from the ravine. You're not at full strength." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(simple) I know, Ning. I've thought about it. I'm taking the rear." },
      N("One breath alone at the cliff edge. The light is the gold of the life before the hospital. Amar thinks of his father, of Selene, of Lucian and his daughter."),
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Down the staircase together. Nobody breaks formation. Maya leads, Ning covers from above, Leo flanks east on the Dactyl, Lucian holds rear. I take Kian. Nobody else. Confirm." },
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
      N("The squad boards at moonrise. The captain, Khione, says only her name and orders the lines cut. Kian's body is still on the landing. No one looks back."),
      N("Below decks, the captain's mate brings a lantern and a bowl of water. The squad has time to stop moving for the first time in twelve hours. That's when Maya sees the dark spread across the back of Lucian's tunic."),
      { speaker: "Maya", portraitId: "maya", expression: "alarmed",
        body: "Lucian. Off your feet. NOW. Ning, the bandages from my pack, the brown cord, MOVE." },
      { speaker: "Lucian", portraitId: "lucian", expression: "dying",
        body: "(quietly, sitting down against the bulkhead) It's all right. It's all right, it's all right. The bolt went through. Front to back. Clean shot. Sit me up against the wall, Maya. I want to see Amar." },
      N("They move him slowly. The bolt did not go clean through. It clipped the lung on the way out. Lucian knows this. He has seen this kind of wound before. He is not afraid."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Amar. Come here, your highness. Closer than that. Right next to me. Good." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(quietly) Lucian. I'm sorry. I should have seen the archer at the cliff edge. I had Kian's eyes, I wasn't watching the —" },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Stop. Three things. One: Mira and Tali. Write them every season, especially when there's nothing to say. They need a man who remembers their father. Promise me." },
      { speaker: "Amar", portraitId: "amar", body: "Every season. I promise." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Two. Maya's the smartest of us, including you. Listen to her. Three. Fight for the people beside you, not colony, empire, or throne. Kian was right about that." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Lucian." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(soft) ...You're going to be all right, Amar. You're a good man under the man you've been hiding under. I saw that the first day at the forge. Take care of them. Take care of yourself." },
      N("Lucian's breathing slows. Ning holds his hand; Maya keeps pressure long after it stops mattering; Leo guards the door. Lucian dies looking at Amar. The boat keeps moving."),
      N("An hour later the harbor lights are gone, open sea in every direction. The captain finds Amar at the stern and speaks, her first words since her name."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Madame Dawn extends her sympathies. Fourteen months. Grude by late summer next year. The food is plain, the wine good. We do not stop." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Captain. I want a sea burial for Lucian. Off the western rail, before the sun comes up. With the squad present and the ship stopped." },
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "We do not stop, your highness. But we will slow. The squad will be present. The western rail at dawn." },
      N("In the gray hour the squad gathers at the rail. Lucian goes into the sea wrapped in the Thuling flag Maya carried from his house. Ning lets him go. Silence."),
      N("The ship turns west. At the stern, Amar takes out the practice sword Lucian carved the night they met at the forge. He holds it, and doesn't put it back."),
      N("Khione confirms it: fourteen months west across open water. The squad has the run of the ship. There is not enough sky for the dactyl. The crossing has begun.")
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
      N("The first month is grief. The squad moves through it the way the ship moves through still water: slowly, at no pace of their own, without comment."),
      N("The second month is reading. Maya works through the Grude pamphlets she stowed before boarding, court rulings and council lists, making notes in three inks. She shares nothing yet."),
      N("In the fourth month Ning teaches herself to fletch in shifting wind. Khione wordlessly hands her a windrose, a chart of the wind's turns. Ning works it out alone."),
      N("The seventh month: Leo and the dactyl Ash, whom the squad calls Kid, walk the ship's full length. Ash stops fearing the deck. Leo stops fearing his choice."),
      N("The ninth month: Amar takes out Lucian's wooden practice sword, holds it an hour, and carves a single word into the grip. He shows no one what it says."),
      N("In the eleventh month Maya breaks her own rule: she sits across from Amar with a stack of Grude maps and one folded paper. She doesn't open it. Neither speaks."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I promised you I'd wait until you asked. You haven't asked. I want to ask you a question instead. May I tell you ONE thing about your old life, one thing, before we land?" },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "...One thing. Yes." },
      { speaker: "Maya", portraitId: "maya",
        body: "The man you called father was your mother's brother. Your father died before your birth. Your mother lives. Her letter's under this map. Know before Dawn tells you." },
      N("Amar doesn't ask whose letter it is. He doesn't have to. He sits with Maya for a long time without speaking. The lantern burns down. Maya leaves the letter under the map and goes to bed without looking back."),
      N("Three months later Khione brings the ship into Grude's east port. The city climbs a hill in terraces, taller than anything they've seen. It smells like a different country."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Ten minutes to dockside. Madame Dawn's papers pass every customs platform on this coast. The captain won't look twice. (Pause.) Unless he's been told what to look for." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "He's been told. The crossbow stance from a hundred meters out is wrong for routine customs. Amar, formation. Ning, fletching check. Leo, dactyl on the gangway with us, not in the hold. We're walking off the ship in arrowhead." },
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
      N("Dawn's safe house is the upstairs of a candle-maker's shop. The candle-maker nods to Khione and doesn't look at the squad. Two flights up, Ndara stands pouring tea."),
      { speaker: "Ndara", portraitId: "ndara", expression: "neutral",
        body: "The mountain village. My brother held the gate and died at it. (Pause.) I'm Dawn's lieutenant. A job I did, not chose. Let me apologize, then pour you tea." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "...Ndara. Your brother said your name was Ndara on the ridge before he fell. I — I have been thinking about him for eleven months." },
      { speaker: "Ndara", portraitId: "ndara",
        body: "I have been thinking about him for eleven months as well. Tea, your highness." },
      N("Maya takes the tea first, her signal that the room is safe. The squad sits. Dawn enters and stands at the window, back to them, a long moment before speaking."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Eighty years ago Archbold's great-grandfather wanted Anthros's iron, so he crowned Nebu, a Para noble. Anthros is a colony. Your iron forged the swords on that dock." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "(quietly, to the squad) I've known this for nine years. I'm sorry I didn't tell any of you. I needed the ground under your feet to be the ground under MY feet first." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Your father's coup was against the colonial arrangement. Grude killed him. I found you in that hospital ward. Maya, Lucian, Ndara, Kian: all of them pulling you here." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(quietly) ...You said \"my son\" from the window." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "(holds his eyes) I did. The rest keeps until morning, Amar. There's a great deal of it. Lucian's brother meets you here tomorrow at noon. Sleep first." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "Lucian had a brother in Grude?" },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "Lucian had a brother in Grude: Aren, my inland courier. He has a letter Lucian wrote before the bolt. (Pause.) Tomorrow, Amar. Sleep tonight." },
      N("No one speaks for a long time. Ning picks up tea first; Leo follows; Maya is halfway through hers. Amar watches the harbor lights. Dawn leaves before midnight. Ndara stays."),
      { speaker: "Ndara", portraitId: "ndara", expression: "neutral",
        body: "(quiet) I will take the watch. None of you have slept since the ship. Sleep here. Nothing comes through this door tonight. I am personally responsible for that." },
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
      N("Three weeks in the safe house, and the squad has begun to live in Grude. Amar still hasn't taken the conversation Dawn promised him. Neither has pressed it."),
      N("And then on a Tuesday at sundown Dawn comes into the common room with a folded map under her arm and asks the squad to come up to her study, and the three weeks end."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Tonight: nine years land in one hour. Twelve strikes: nephews, wardens, ledger-keepers, prison master. We're not killing an empire; we're proving it CAN die. Not asking. Inviting." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "We're in. What's our target?" },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "The youngest nephew's residence, off Oran Lane. Lightly garrisoned. The boy's never known fear, his captain's an incompetent. Rose has mapped the plaza. She'll lead you in." },
      N("Dawn's study door opens on a woman the squad doesn't know: mid-thirties, teal officer's coat, throwing blades. She nods without smiling. She has the Maya look: careful, measuring."),
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "Squad, this is Rose. She has been one of my lieutenants for twelve years. She and Maya were in the same officer cohort. Rose, the squad you've been writing reports about for eleven months." },
      { speaker: "Rose", portraitId: "rose", expression: "neutral",
        body: "(small nod) Amar. Maya. Ning. Leo. I've read everything Maya sent for eleven months. Tonight will be hard. The plaza layout once more, then we move." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Rose. Hi. (Quiet, between them.) ...It's good to see you in person. Eleven years through letters. It's a lot." },
      { speaker: "Rose", portraitId: "rose", expression: "brisk",
        body: "(half-smile, only at Maya) It is. Talk later. We move at 11:14." },
      N("Rose walks the squad through the plaza plan three times: positions, angles, cover, precise and forward-leaning. Dawn watches without interrupting once: this is the person she trusts most alive."),
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
    // Death cue — Rose's death scene. The dedicated Death track scores
    // the burial + Dawn's grief; heavier + more final than the broader
    // "emotional" Spine cue this arc used before. Latter-half (B12+)
    // sympathetic-character deaths use this track.
    music: "death",
    backdrop: "grude",
    next: "story:before_origin",
    beats: [
      N("Dawn doesn't move for an hour. Ndara brings a cart; she, Amar, Maya, and Leo lift Rose in. Dawn walks beside it all the way home. Nobody speaks."),
      N("All twelve targets are dead. By morning, flyers name them across the city; by sundown, the empire formally admits an armed opposition exists. Dawn has been right about everything."),
      N("Rose is buried at dawn beneath the lemon tree behind the candle-maker's shop. Dawn speaks for less than a minute: no tears, no tremor, the same flat briefing voice."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Rose Eseldra. Thirty-two years with me. She trained Maya. She took four bolts for me. The plaza takes her name. The lemon tree stays. I have meetings." },
      N("For four days Dawn vanishes into meetings, refusing Maya's knock, leaving Ndara's tea cold. Then Amar finds her on the courtyard bench, sits beside her, and neither speaks."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "(eventually) She wanted to retire next year. A cottage on the south coast. The plan worked, Amar. Twelve for twelve; Rose our only loss. The math doesn't help." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...Dawn. You don't have to do the math. Not tonight." },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "I do, though. I knew Rose thirty-two years. If I don't count what she was for, nobody does. Tomorrow, the work. Tonight, the cup. Thank you." },
      N("Amar sits with her until dark. Near midnight Dawn puts her face in her hands; he doesn't look until she lifts it. Leaving, she pauses at the door."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Amar. Tomorrow afternoon, the study. Maya and Ndara as well. There is much you do not know about who you are. Tonight proved it cannot wait. ...Sleep well." },
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
      N("Dawn's study fills the safe house's top floor: one window, papers, a map of the western sea under four stones. She has set out four chairs. She does not stand."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Sit. Amar, the chair by the window. You have earned the courtesy of being seen. Maya and Ndara already know; they're here so you won't carry this alone." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "Three weeks you've put this off, Dawn. A year at sea, eleven years before that. Say it plainly. I'm tired of learning my own life last." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Plainly, then. Softening would only be more handling.\n\nI am your mother, Amar. I carried you, named you, held you every night for your first eleven months." },
      N("Amar does not say anything. The light from the one window is on his face, exactly as Dawn arranged it. Nobody in the room looks away from him, because Dawn told them not to."),
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "(quietly) ...You said \"my son\" from the window at the harbor. I told myself it was a way of speaking." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Your father is alive. Archbold, King of Grude, the emperor you've been fighting. You're the trueborn child of this rebellion's leader and the man it exists to destroy." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "Maya told me on the ship that my father died before I was born. She sat across a table from me and she said it to my face." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I told you what I was told, Amar. Eleven years serving Madame Dawn. I'd sworn your father was dead. She lied to me too. We learn this together." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Maya is owed her anger. I lied to her deliberately. A sentence never spoken can't be tortured out. Ignorance kept her safe. Not proud. I'd do it again." },
      { speaker: "Ndara", portraitId: "ndara", expression: "neutral",
        body: "(evenly, to Amar) I have known since before the mountain village. It does not get lighter for being held a long time. But it can be set down now. Let her finish." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Thirty-two years ago I was a Grude council daughter in Archbold's court. I read the ledgers, what Anthros was for: iron, harvests, managed starvation. I carried its heir." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "I could not raise you inside what I meant to destroy. At eleven months I sent you to my brother in Anthros. You believed he was your father." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "You arranged all of it. The forge. Lucian. Maya in the squad. Kian, somehow. You have been moving me across a board since before I could walk, and every person I have ever loved was a piece you placed." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "I placed the squad; the rest you built. No apology for reaching for my son. Rose is the latest cost, not the last. Know what you're joining —" },
      N("Dawn stops. Below them, faint through the floorboards, the candle-maker downstairs is tapping a fast, uneven rhythm on a ceiling beam with the handle of a broom. Three taps, two, three. Ndara is already on her feet."),
      { speaker: "Ndara", portraitId: "ndara", expression: "commanding",
        body: "That is the far-watch signal. Soldiers on the street, moving with purpose, more than a patrol. They have found the house." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Then the rest of the conversation waits. Amar, down the stairs, into the street, before they can stack the door. Whatever you are, you are also still the person they are here for. Move." }
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
      N("In the emptied street, Ndara counts what the enemy left behind: nothing. The household guard carried away even their fallen. This is not the enemy the squad fought in Anthros."),
      N("When they do go up, Dawn has moved the four chairs back against the wall. She is at the window with her hands folded, watching the street where Castor's men were."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "You have heard what matters; the rest can wait for morning. But I will give you the sentence I was reaching for when the broom started." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "Everything you did as a man of Anthros, you also did as the empire's heir striking his father's house. Both true, for life. Decide what that man does." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...Lucian told me, dying: fight for the people next to you. Not the colony, not the empire, not a flag. The only instruction in two years without strings." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Then your foreman was the better strategist. I have known since Maya's third report. Keep his instruction, Amar. You will need something of your own when this worsens." },
      N("Maya catches Amar on the stairs afterward. She is not calculating anything; for once she just looks tired."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Eleven years of a false story about your father, and I never caught the seam. If Dawn can fool me, who's fooling her? I'll watch the watchers. Sleep." },
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
      N("Maya works six days, barely sleeping. She grids three months of stolen supply manifests across the study floor and reads them for the one hand that touched everything."),
      { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
        body: "Madame Dawn. Three months, every message in this house crossed one desk before yours. One man sees its whole shape: not you, not me. Your quartermaster. Coyne." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Nine years Coyne ran my supply line. He buried my couriers. (A pause.) ...And he's the only answer to how Castor found that door. Say the rest, Maya." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I didn't. I need you to send someone steady to bring Coyne in before he reads the room. Quietly, no alarm, before he can —" },
      N("The study door opens without a knock. One of Dawn's couriers, breathless from the stairs, face carrying the worst news it has ever carried."),
      { speaker: "Courier", body: "Madame, it's Ndara. The courtyard. She's down, she's breathing, but she won't — she won't wake up, Madame, we can't wake her." },
      N("Ndara reached the same name an hour earlier, alone as always, and went to question Coyne herself. The squad finds her answer on the cobblestones. Coyne is gone."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "(very quietly) Carry Ndara upstairs. A cot, not the floor. Khione will sit with her." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "Find me Coyne. He hasn't left. The river and harbour gates are watched, and he knows it. He'll take the courtyard's back gate. He won't be alone." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then he doesn't reach the gate. Squad, the courtyard. Now. Whoever Coyne's bought, they're standing between us and the man who put Castor's crossbows in that street. Move." }
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
    next: "story:before_proposal",
    beats: [
      N("Coyne is buried outside the walls, unmarked, in silence. Dawn does not attend. The lemon tree, blood at its roots twice this month, goes on being a lemon tree."),
      N("Ndara is moved to the bright upstairs room. Khione sits with her for two nights. On the third morning she finds Amar on the stairs and tells him the truth."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Her body mends. The head wound no physician can answer. She may wake tomorrow, a season, or never. I'm sorry. She's the steady one. Be steadier without her." },
      N("That afternoon Dawn gathers the squad in the study. No chairs offered. The four from the parentage conversation are stacked against the wall. The careful, inviting register is simply gone."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "Thirty years I asked. Rose, buried. Ndara, I cannot wake her. I am done asking. The empire's knife served me nine years. The war is in my courtyard." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "I tell you, not ask. The rebellion needs no more martyrs. It needs a face. The throne of Anthros, its heir in the open. What it costs, tomorrow." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...You buried Rose three weeks ago telling me grief shouldn't be rushed. Now you can't get to the next move fast enough." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Yes. Betrayal inside a house teaches you the kind version of the plan is a luxury paid in other people's lives. Better you learn it watching me. Tomorrow." },
      N("Dawn leaves the study first, which she has never done. The squad stands among the stacked chairs. Maya is the one who finally speaks, and she speaks quietly, and only to the people in the room."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "She's not wrong, and that should frighten you. She just became harder to refuse. Whatever she offers tomorrow, Amar, walk in knowing your own answer. Not hers." },
      N("The squad sleeps badly. Upstairs, Ndara breathes and does not wake, and the rebellion waits for morning with a harder woman at its head.")
    ]
  },
  // -------- Pre-Battle 16 (Dawn's proposal) --------
  // The conversation Dawn promised at the end of post_inner_coup. She
  // asks Amar to claim the Anthros throne as the rebellion's open heir
  // once Archbold falls. Amar gives her a "not yet." She accepts the
  // deferral — and sends the squad across the river on a night errand.
  // Routes into B16's prep.
  before_proposal: {
    id: "before_proposal",
    title: "What kind of son",
    subtitle: "Dawn's study, the morning after the courtyard",
    music: "emotional",
    backdrop: "study",
    next: "prep:b16_proposal",
    beats: [
      N("Dawn's table holds the map of Anthros this time, not the western sea: Para, Thuling, the eastern range, and more villages in her precise hand than Amar knew existed."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Archbold will fall. Then Anthros has no throne: a hundred million frightened people, a wound the next strong man walks into. I've watched it on three continents." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "Anthros needs a face when the empire falls, trueborn blood a farmer can follow. You're the only claimant, Amar: line and rebellion both. Thirty years of arranging." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "You're asking me to be a king." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Anthros will have a throne whether you take it or not, and everyone else who could is worse. Yes: I am asking my son to be a king." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Lucian told me, dying: don't fight for a throne, fight for the people beside you. You're asking me to pick up what he told me to put down." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Your foreman counseled a soldier; I counsel a king. Fight only for those beside you and the unseen starve. Decide whose son you are: mine, his, your own." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then you'll have \"not yet.\" Not no, not yes. Not fear, either. Everyone who's told me who I am had half the picture. I'll answer holding the whole." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "\"Not yet\" I can work with. Earn it: a courier across the river tonight, carrying names of cells loyal to your father. Take the squad. Bring his crate back." },
      N("It is not routine, though Dawn doesn't know that yet, and neither does Amar. The squad walks out with a map rolled shut and a question rolled open.")
    ]
  },
  // -------- Post-Battle 16 (after the bridge; Khione's warning) --------
  // The bridge ambush has landed the empire's new posture — kill, not
  // retrieve. The arc closes by planting B17: Khione, who has sat with
  // the comatose Ndara and carries something heavier than grief, tells
  // Amar there is a part of the story Dawn has never told him, and
  // that he should hear it before he answers her about the throne.
  post_proposal: {
    id: "post_proposal",
    title: "The arithmetic on the bridge",
    subtitle: "Back across the river, the courier's crate delivered",
    music: "emotional",
    backdrop: "grude",
    next: "story:before_lie",
    beats: [
      N("The crate arrives: colony cell-names, as Dawn promised. A success by every measure but theirs: they walked onto that bridge as people and off as numbers in Archbold's ledger."),
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "He sent an assassin, Maya. A knife in the dark. Three weeks ago I had no father. Tonight I know my price: one professional, two hired men." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Your father is easy, Amar. His want points one way. Tonight, think about Dawn: she's wanted you on a throne before you could walk. That isn't a comfort." },
      N("Amar can't sleep. He goes up to sit with Ndara and finds Khione already in the chair by the cot, as most nights, watching thirty steady years lie still."),
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "You have the look, your highness. The sum on the woman downstairs came out wrong. Nineteen years in Dawn's rebellion. I love her like a tide. Never safe." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "Khione. If there's something you're circling, walk to it. I've had a generous night for circling." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "Your mother told no one the whole story. Kian had half; I have it all. Before you answer her about any throne, find me on the water." },
      N("Khione goes back to watching Ndara breathe. Amar sits with his mother's question and the answer Khione has promised. Below, Dawn sleeps, her plan finally moving. The squad does not.")
    ]
  },
  // -------- Pre-Battle 17 (Khione tells the whole of it) --------
  // Amar takes Khione up on her offer — "come find me on the water."
  // Khione tells him the part Dawn has told no one: the rebellion's
  // strategy is to spend Anthros, with the heir as the spark. Kian's
  // cliff warning was right and only kindly under-sized. The squad
  // resolves to break with Dawn and leave Grude — and Othren's
  // loyalists are already forming on the quay. Routes into B17's prep.
  before_lie: {
    id: "before_lie",
    title: "On the water, where her walls are thinner",
    subtitle: "Khione's ship at the quay, before dawn",
    music: "emotional",
    backdrop: "grude",
    next: "prep:b17_lie",
    beats: [
      N("Amar goes to the quay before dawn. Maya goes too. She hasn't let him walk anywhere alone since the bridge. On deck, Khione doesn't look surprised to see two."),
      { speaker: "Khione", portraitId: "khione", expression: "serene_neutral",
        body: "You came, and brought the squad. Good. This is not a thing to carry alone. I will tell it plainly; it is the only way I know." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "Dawn's rebellion isn't to free Anthros. It's to SPEND it. She does want her son crowned. But the road runs through the colony's burning. She costed that already." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "...Spend it how. Say the whole shape of it, Khione." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "Archbold must answer an heir with an army: burn Anthros. The fire isn't the cost, Amar; it is Dawn's plan: turn Grude against him, end the empire." },
      { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
        body: "She split the strategy: I held a piece, Ndara, Rose. Only Dawn held the sum, and Thuling's inside it. Kian said a hundred thousand dead. He was being generous." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "She held me for eleven months. Crossed an ocean for me. Called me her son. And the whole time, her king's road ran straight through Lucian's town." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "Both are true, your highness. Your mother's cruelty: real love, real arithmetic, neither moving the other. This choice is only yours. Decide it elsewhere. Dawn's house has ears." },
      N("Word travels fast: the rebellion won't let its heir stroll onto a boat. Loyalists line the quay before Khione's gangway, Marshal Othren at their centre, and he won't step aside."),
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then we don't ask him to. Squad: the gangway, the ship, open water. We're leaving Grude now. We'll decide what's next somewhere my mother hasn't drawn the map." }
    ]
  },
  // -------- Post-Battle 17 (the break; Dawn lets him go) --------
  // The squad is aboard and the ship clears the quay. Dawn comes down
  // to the emptied dock — alone, unarmed — for the last word. She does
  // not deny the plan and she does not beg; she states the arithmetic
  // and the love both, lets her son go, and leaves Amar in open water
  // with the first genuinely unwritten choice of his life ahead of him.
  // Routes forward into B18 — the Seven Paths divergence.
  post_lie: {
    id: "post_lie",
    title: "She loves you. She lied.",
    subtitle: "Khione's ship, pulling out of Grude harbour",
    music: "sadness",
    backdrop: "grude",
    next: "story:before_path_chosen",
    beats: [
      N("Khione casts off. Onto the emptying quay, alone, walks Madame Dawn, not to stop the ship, only waiting until the gap is too wide for anything to sound like negotiation."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "I deny nothing. Khione has it exact. Thirty years I've hunted a version that frees Anthros without burning it. There is none. I've grieved longer than you've lived." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "I let you reach that ship. Othren is mine. Khione, mine these nineteen years. Thirty years planning to spend everything; I cannot spend you. Go. Outrun my arithmetic." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(across the widening water) You could have told me. Any night of the crossing. Any morning in the study. You could have set the whole of it on the table and let me choose with my eyes open." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Yes. The lie was a year of mornings I chose silence, knowing it was wrong. I loved you entirely and lied to you entirely. Carry both, Amar." },
      N("The water widens. Neither waves; they hold each other's eyes until the mist takes the dock. Then Dawn is gone, Grude with her, and the ship turns onto open sea."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "(after a long quiet) It isn't her board anymore, Amar. Not anyone's. The next move is yours. Whatever you choose, we're standing next to you. Lucian's instruction." },
      N("The ship runs west; Grude sinks behind. Ahead, nothing is written: no warrant, no map, no army. Only the sea, the squad, and a question only Amar can answer.")
    ]
  },

  // ============== Battle 18 — Seven Names, One Choice ==============
  // The path divergence. before_path_chosen frames the fork from inside the
  // ship's hold: Amar lays out the seven names he's carrying and the squad
  // forces the question into the open. It routes into the B18 battle (a
  // boarding party the empire sends after Khione's ship), and B18's victory
  // routes to post_path_chosen, which hands off to ChoiceScene.
  before_path_chosen: {
    id: "before_path_chosen",
    title: "Seven Names",
    subtitle: "The hold of Khione's ship, three days out",
    music: "emotional",
    backdrop: "grude",
    next: "prep:b18_path_chosen",
    beats: [
      N("Three days at sea. The squad has slept; the shaking has stopped. Khione holds the wheel. Below, four sit around a crate, nobody saying the thing that saying makes real."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Landfall in four days, Amar. The squad goes where you point. Empire wants you dead, rebellion wants you spent. Only you decide what you're FOR. What are we?" },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "I keep counting names. Selene: kill him, clean. Lucian: rebuild slow. You, Maya: burn every throne. Khonu: serve something bigger. Tev: walk away. Yul never asked sides. Sera —" },
      { speaker: "Ning", portraitId: "ning", expression: "startled",
        body: "Sera said the kindest thing the head wound did was let you put a life down. (Quietly.) I remember. You told me on the wall at Orinhal. You didn't think I was listening." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "Seven names. Seven people who decided what I'm for: Dawn, my father, Nebu, Fergus, Kian. All handed me the answer pre-written. I'm tired of other people's sums, Maya." },
      { speaker: "Leo", portraitId: "leo", expression: "wounded_pride",
        body: "(from the shadows) My father handed me a list; I flew the other way. No regrets. Pick the name you can stand, Captain. We're coming either way." },
      N("A sail closing fast, flying imperial colours. The empire hasn't let Amar go. The choice must wait one more fight, but it has been asked. Four days to landfall.")
    ]
  },

  // -------- Post-Battle 18 — the choice is made --------
  // The boarding party is beaten back. The squad stands in the wreck of the
  // fight and Amar, finally, answers the question. This arc is the hinge:
  // its `next: "choice"` routes to ChoiceScene, where the player commits to
  // one of the seven paths and the campaign forks.
  post_path_chosen: {
    id: "post_path_chosen",
    title: "One Choice",
    subtitle: "The deck of Khione's ship, the boarding party broken",
    music: "emotional",
    backdrop: "grude",
    next: "choice",
    beats: [
      N("The last boarder goes over the rail, and the imperial cutter sheers off, captain dead. Khione never let go of the wheel. Ahead, the coast. Four days become four hours."),
      { speaker: "Khione", portraitId: "khione", expression: "serene_neutral",
        body: "That coast belongs to nobody, Amar, the last one that does. Ashore, everything has owners with claims on you. Decide whose you answer before the keel touches sand." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Three days counting names. I've stopped on one. Maya, you said the squad goes where I point. Ning, Leo, stand with me while I point." },
      N("He holds seven answers: vengeance, restoration, revolution, duty, exile, mercy, forgetting. The coast rises to meet whichever he keeps. Pick the one Amar can answer to. Then the sword.")
    ]
  },

  // ═══════════ B19 epilogues — one per path; only one is ever reached ═══════════
  // Each closes its opener and rolls credits: the slice's seven possible
  // endings. Kept lean — the battle's outro carried the plot; these carry
  // the feeling.

  post_path_opener_vengeance: {
    id: "post_path_opener_vengeance",
    title: "The First Name",
    subtitle: "A fire on the canyon rim, after",
    music: "death",
    backdrop: "caravan",
    next: "prep:b20_dawn_war",
    beats: [
      N("They burn Castor's writ of retrieval on the campfire, because none of them wants to carry it and none of them can quite throw it away unburned."),
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "Selene told me once: kill the man who did it. That's all that's clean. (Watching the paper curl.) She was wrong about the clean part. She was right about everything else." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Second name's a garrison colonel. Three days' ride. (She banks the fire.) Sleep first, Amar. The list keeps. That's the terrible thing about lists. They keep." },
      N("The hunter's road runs on, name by name, toward a king. Amar rides it awake, keeping his own ledger. His answer, and he can still answer to it. For now.")
    ]
  },

  post_path_opener_restoration: {
    id: "post_path_opener_restoration",
    title: "The First Stone",
    subtitle: "Khonu's village, that night",
    music: "everydayLife",
    backdrop: "thuling",
    next: "prep:b20_dawn_war",
    beats: [
      N("Dinner is at the long table in the headman's house, and it is loud, and nobody at it is afraid. It has been a month since the village ate loudly."),
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "The old man says there's a bridge out at the east field, and a well gone sour, and a militia that's four boys and a scythe. (Grinning.) He says it like a list of chores. For US." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "It IS a list of chores. That's the whole path, Ning. No thrones, just the next broken thing, fixed, and the one after. (A breath.) Lucian would already be at the bridge." },
      N("In the morning they start on the well. Slow, small, and it holds, the way Lucian said real things hold. Something neither kingdom nor rebellion quietly begins to stand.")
    ]
  },

  post_path_opener_revolution: {
    id: "post_path_opener_revolution",
    title: "Smoke Travels",
    subtitle: "A ridge above the border road, next morning",
    music: "grudeBattle1",
    backdrop: "grude",
    next: "prep:b20_dawn_war",
    beats: [
      N("The smoke column stands up over the border country like a flag no one has to sew. By noon, riders they've never met are passing them the news of their own strike, grown taller in the telling."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Two more depots, a tax office, the registry of who owes what. Burn the paper, Amar, and the debt was never real. That's the secret they guard hardest." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "No lists of names, Maya. We burn what owns people, never people. That's the line. The day we cross it, we're just Dawn with worse logistics." },
      N("She holds his eyes, nods, and means it. The revolution rides for the tax office with its one line drawn: everything burns except the line.")
    ]
  },

  post_path_opener_duty: {
    id: "post_path_opener_duty",
    title: "Three Letters",
    subtitle: "The regimental camp, lamplight",
    music: "sadness",
    backdrop: "field_night_camp",
    next: "prep:b20_dawn_war",
    beats: [
      N("The relief column's surgeon takes the wounded. The quartermaster takes the casualty report. The captaincy takes the rest of the night, at a folding table, in regulation format."),
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Ferren. Odal. Little Iska, who lied about her age to the recruiter. (He signs the third letter.) Khonu carried a bag of letters like these for twenty years. I thought it was paperwork. It's the whole rank." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "The column's calling you the captain who held the bridge and wrote the letters himself, same night. (Quietly.) Armies remember that longer than victories, Amar. Sleep. Reveille's at six." },
      N("At six he is up with the column in his father's old colors, reading orders before signing. The narrowest of the seven roads, the straightest. He can answer to it.")
    ]
  },

  post_path_opener_exile: {
    id: "post_path_opener_exile",
    title: "North of the Names",
    subtitle: "The cold country, days on",
    music: "sadness2",
    backdrop: "mountain",
    next: "credits",
    beats: [
      N("Past the pass the country empties out until even the road gives up pretending. He rides north through it alone, and the quiet stops feeling like held breath and starts feeling like weather."),
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "(to the horse, eventually) Tev said the bravest thing is to walk away whole. (A long while.) He didn't say you'd keep counting the people you walked from. Maya. Ning. Leo. (A breath.) Maybe the counting IS the whole." },
      N("Behind him the war calls his name and gets no answer. Ahead, a cold coast that never has. He buries the last trail marker and rides for the second place."),
      N("It is not peace. It is the honest distance from everything that isn't. Of the seven answers it is the loneliest, and it is his, all the way north, every cold mile of it.")
    ]
  },

  post_path_opener_mercy: {
    id: "post_path_opener_mercy",
    title: "Adjacent Cots",
    subtitle: "Greywall Fort, become a hospital",
    music: "emotional",
    backdrop: "monastery",
    next: "prep:b20_dawn_war",
    beats: [
      N("By morning the armoury is a ward. Imperial wounded and rebel wounded lie in adjacent cots, fed from the same pot, complaining about the same porridge, which the squad privately counts as the first treaty of the war."),
      { speaker: "Ning", portraitId: "ning", expression: "startled",
        body: "The holdout captain asked for you. Not to fight. (Beat.) He wants to know what you intend to DO with a war you refuse to win. He asked it like it kept him up all night." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Good. It should keep him up. It keeps me up. (Rolling his sleeves.) Tell him the answer's in the ward, third cot from the door. His own sergeant. Alive. That's the whole doctrine, Captain. Come see it work." },
      N("Word of the fort surrendering UP travels faster than victory. Two more garrisons ask terms. Yul never asked which side a wound was on; neither does the war's strangest army.")
    ]
  },

  post_path_opener_forgetting: {
    id: "post_path_opener_forgetting",
    title: "The Sword by the Door",
    subtitle: "The cottage, the morning after",
    music: "everydayLife",
    backdrop: "cliffs",
    next: "credits",
    beats: [
      N("The tide takes the blood off the sand by midnight, the way it takes everything. Morning finds the sword still by the door, the potion beside it."),
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "(looking at the sword) Sera said the wound's kindness was letting me put a life down. She never said it stays a choice. Every morning. This one too." },
      N("He does not pick it up. The potion goes on the shelf. Medicine is just medicine. The sword stays, his to not-take, one morning at a time."),
      N("The boat goes out with the tide. The war grinds on, hunting a name its owner set down. Softest of the seven answers; the costliest. He pays daily, and fishes.")
    ]
  },

  // ═══════════ War arc epilogue — after B22, Grude Burns ═══════════
  // The last authored beat of the war stretch. Lands the cost of the
  // three battles and points the campaign at the sky (the Ravage fleet,
  // B23+). Routes to credits until the fleet arc ships.
  post_grude_burns: {
    id: "post_grude_burns",
    title: "The Held City",
    subtitle: "The upper district, the morning after",
    music: "emotional",
    backdrop: "grude",
    next: "credits",
    beats: [
      N("Morning comes up through the smoke and finds the upper district still standing. Scorched, gap-toothed, ash to the ankles on the market row. Standing."),
      N("The squad walks the row at first light. On every scorched door, chalk names: who lived here, what stood here, what the city refuses to forget. Nobody organized it. Nobody had to."),
      { speaker: "Leo", portraitId: "leo", expression: "resolute",
        body: "Three battles in nine days. Serrick, the road, now this. (He counts on his fingers, then stops.) I stopped being scared somewhere around the fence line. I can't decide if that's good." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "It isn't good or bad, Leo. It's spending. Everyone here is spending something. (She looks at Amar.) The question is always who keeps the ledger." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "Then we keep our own. Every name on those doors goes in it. Not Dawn's arithmetic. Ours: what it cost, and what it bought, and who it saved." },
      N("East of the city, past the harbour, the horizon has been the wrong colour for three days. Sailors won't put out. Birds are flying inland. The war believes it is the biggest thing in the world."),
      N("The sky is about to disagree. To be continued.")
    ]
  }
};
