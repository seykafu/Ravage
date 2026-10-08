// Story beats: dialog cards bracketing each battle. Each beat is a single screen
// with a portrait (or none), a speaker name, a body, and an optional ambient color.

import type { ArcId, RouteRef } from "../data/contentIds";

export type PortraitId =
  | "amar" | "lucian" | "ning" | "maya" | "leo" | "ranatoli" | "selene"
  | "veya" | "corin"
  | "kian" | "ndari" | "nebu"
  | "dawn" | "fergus" | "ndara" | "archbold" | "khione" | "mira" | "tali"
  | "rose" | "coyne"
  // The named generals and the Ravage's two speakers — their own faces
  // (they wore the royal-guard / raider / reaver stand-ins until 2026-10).
  | "castor" | "othren" | "wren" | "serrick" | "brask" | "vasse" | "sarto"
  | "herald" | "ravage_commander"
  // Generic enemy-class portraits, valid as dialogue speakers for
  // minor named officers who reuse the stand-in art rather than
  // carrying a bespoke portrait: royal_guard for imperial officers
  // (Lord Castor, Serrick, Brask), raider for Dawn's soldiery
  // (Marshal Othren), reaver for the Ravage (the Herald, the
  // Commander). All are painted portraits in the manifest.
  | "royal_guard" | "raider" | "reaver" | "bandit" | "crown_archer"
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
  // Mid-arc music switch. When set, StoryScene crossfades to this track
  // as the beat appears (same-track requests no-op, so only genuine
  // changes are audible). Lets a single arc turn — e.g. the main theme
  // swelling when Ranatoli walks out of the prison row in
  // post_grude_burns — without splitting the scene into two arcs.
  music?: StoryArc["music"];
  // A staged picture over the arc's backdrop, from this beat to the end of
  // the arc (scenes/story/RingTableau). "ring": the wedding codas' sunset —
  // Amar and the one he marries on a clifftop over the sea, and the ring he
  // holds out. "home": the same clifftop later, the two of them side by
  // side watching the sun go down. `partner` is the RomanceOption id.
  tableau?: { kind: "ring" | "home"; partner: string };
  // Only in the story of this marriage (a RomanceOption id): the beat is
  // skipped unless Amar married `partner`. Lets a shared arc (the epilogue's
  // road home) carry each spouse's own lines.
  partner?: string;
  // A staged picture behind the dialogue from this beat on, until the arc
  // ends or another stage replaces it (scenes/story/Cinematics): the ship
  // on the open sea through the crossing, Lucian's burial at sea...
  stage?: StageId;
}

// A short film at a turn of the story (scenes/story/Cinematics): Codex
// paintings, the squad's battle sprites, plain words on screen. Skippable.
export type CinematicId = "coup" | "escape" | "grude_burns" | "sky_fleet";
// A staged picture behind the dialogue (DialogBeat.stage).
export type StageId =
  | "throne" | "voyage" | "burial" | "grude_arrival"
  // Kian waiting on the cliff at sundown; Leo's dactyl crossing to the
  // partisans at Orinhal; Rose falling in front of Dawn.
  | "kian_duel" | "leo_defects" | "rose_falls";

export interface StoryArc {
  id: ArcId;
  title: string;        // banner shown at top of the story screen
  subtitle?: string;    // smaller subline
  beats: DialogBeat[];
  // A cinematic before the first beat, or after the last (CinematicId).
  cinematic?: CinematicId;
  endCinematic?: CinematicId;
  // After the arc, where to go next. Discriminated by prefix; see RouteRef
  // in src/data/contentIds.ts. A typo or pointer to a non-existent battle
  // or arc is now a compile-time error rather than a silent overworld
  // fall-through at runtime.
  next: RouteRef;
  music:
    | "adventureAnthros" | "lifeInGrude" | "danger" | "battlePrep"
    | "mainTheme" | "emotional" | "everydayLife" | "trailer" | "ravageDaredevil"
    | "sadness" | "sadness2" | "grudeBattle1" | "death"
    // The ending suite — all five war-path codas share this closing
    // texture so the endings converge musically even as they diverge
    // in content.
    | "emotionalLife";
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
// The ring at sunset: narration over the clifftop picture (see DialogBeat.tableau).
const RING = (partner: string, body: string): DialogBeat => ({ portraitId: "narrator", body, tableau: { kind: "ring", partner } });
// The same clifftop, later — only in the story of this marriage.
const HOME = (partner: string, body: string): DialogBeat => ({ portraitId: "narrator", body, partner, tableau: { kind: "home", partner } });
// A beat only in the story of this marriage (see DialogBeat.partner).
const WED = (partner: string, beat: DialogBeat): DialogBeat => ({ ...beat, partner });
// A beat that raises a staged picture behind the dialogue (DialogBeat.stage).
const STAGE = (stage: StageId, beat: DialogBeat): DialogBeat => ({ ...beat, stage });

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
    subtitle: "The same night, far from the palace",
    music: "trailer",
    backdrop: "study",
    // The hook: the palace in the rain, the eight rebels going over the
    // wall, the throne-hall doors (scenes/story/Cinematics "coup").
    cinematic: "coup",
    next: "story:pre_palace",
    beats: [
      N("The same night. Far from the palace, one lamp is still burning in a quiet study."),
      N("This is Madame Dawn. She leads rebels and spies in half the cities of the world. Tonight she is not in the fight. She is waiting to hear how it goes."),
      N("She finishes a letter she will never send, folds it twice, and puts it under a stone."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "Tell me again." },
      { speaker: "Lieutenant", body: "Eight of them, inside the palace by midnight. The King sleeps with his door open an inch. Pride, not strategy. They'll go straight for him." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "And the one leading them." },
      { speaker: "Lieutenant", body: "Amar. First in. Last out, if any of them come out." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping", body: "He thinks the plan is all his own. Let him keep thinking that. (She looks at the lamp.) He'll need something that's his." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral", body: "Move our people out of the harbor one tide early. If King Nebu lives past morning, he'll hunt for whoever helped. He'll find us." },
      N("Far away, in the King's palace, a young man named Amar tightens the strap on his arm guard. He has planned this night for ten months."),
      N("He has never heard the name Madame Dawn. He will.")
    ]
  },
  // -------- Pre-Battle 1 (Palace Coup) --------
  // Back to the palace: the three at the throne-hall doors (the "throne"
  // stage), the plan in two lines, and in.
  pre_palace: {
    id: "pre_palace",
    title: "The Throne Hall Doors",
    subtitle: "Para, the King's palace. Midnight.",
    // Ravage Daredevil — heist/coup energy for the briefing in the throne-hall
    // antechamber. Plays from the start of this arc through the BattlePrepScene
    // crossfade into Battle 1's "entering the stronghold" track.
    music: "ravageDaredevil",
    backdrop: "palaceCoup",
    next: "prep:b01_palace_coup",
    beats: [
      STAGE("throne", N(
        "Back in the palace. The other five rebels are spread through the back corridors. You, Selene and Ranatoli reached the throne hall first."
      )),
      N(
        "Behind these doors: King Nebu and his royal guard. Win here, and the coup is won."
      ),
      { speaker: "Selene", portraitId: "selene", body: "If we don't break their line in the first minute, we never will. I'll hold the right." },
      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "lecturing", body: "Steel up, Amar. We bleed together or we feast together. Anything in between is shame." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Bleed only where you have to. We're taking a country tonight." }
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
      N("Amar reaches Thuling at dawn in the back of a supply wagon. Kian rides up front. At the town gate, Kian watches Amar climb down, then turns his horse back toward Para without getting off it."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "I'll be back at sundown to check on you. Your foreman at the forge is named Lucian. Tell him the King sent you. He hates that. You'll know him by the scowl." },
      N("Inside the forge a broad-shouldered man hammers a horseshoe flat, with force that ends arguments before they start. Nearby a lean younger woman bags crossbow bolts, humming."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "You'll be Amar. Word came up the road. I'm Lucian. I run the line. That's Ning, on the rivet press. She'll ignore you a day, then never stop talking." },
      { speaker: "Amar", portraitId: "amar", body: "Amar. Kian said the King thought I'd be of use here. I don't —" },
      N("Amar almost says \"I don't remember much yet.\" He stops himself just in time. Lucian notices the pause and says nothing about it."),
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
      N("You show Kian the cut on your waist. You made it yourself this morning, more neatly than a farmer should know how. He believes you. For now."),
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
      N("Lucian buys the drink. Ning tries to pay for the second and loses the argument. Before a third, a runner comes in. He doesn't sit down."),
      { speaker: "Runner", body: "Eastern road. Twenty of them, at least. They're wearing a sash: orange, bone-white, orange. Same on every arm." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "That's not bandit. Bandits don't wear matching anything." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "What does it mean?" },
      { speaker: "Lucian", portraitId: "lucian", body: "Means somebody's paying them. Somebody who wants to be recognized." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we recognize them back. South of the road, behind the fences. Ning takes the fence line. Lucian and I take the wagons, one each side." },
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
      N("The stranger from the tavern's corner table walks the line of bodies once and stops at the spearton with the orange sash."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "Two of these are deserters from the Crown Archers. The other three are new. She's recruiting harder than she was a month ago." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "She." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "The woman behind the sash. You'll learn her name soon enough without me saying it." },
      { speaker: "Maya", portraitId: "maya", body: "I'm Maya. I was traveling east. I've changed my mind." },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin", body: "Stay. Please stay. You knew where everyone was going to be before they did." },
      { speaker: "Lucian", portraitId: "lucian", body: "Why us." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile", body: "Because the boy in front cuts like a man who learned in a palace, and that's the kind of company I keep." },
      N("Amar doesn't blink. Lucian does: once, slowly, the way he does when he's saving something to think about later."),
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
      N("A small errand: take a package to a farm two days north. It was Lucian's idea. He wants Maya out of town before the man with the sashes hears she's traveling with you."),
      N("At the gate, a rider waits. Polished armor in a town that doesn't polish armor."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "Amar! The General's compliments. He thought you might want company on the marsh road. Bandits, you know how it is." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "...Who is he." },
      { speaker: "Lucian", portraitId: "lucian", body: "King's man. Old friend of Amar's, supposedly. Says it often enough I've started to believe him." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "He's watching you the way I watch a card player I haven't read yet." },
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
      N("Six bodies in the reeds, none of them yours. At the fire, Kian binds a real cut on his forearm. He'll show it to the General as proof he was useful."),
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "Amar. That fourth one, the archer at the tree. You set him up like you already knew where he'd hide." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Boy's been sparring with old soldiers since he could lift a stick. He saw me pull the same move at the wagons last week. Picks things up." },
      { speaker: "Kian", portraitId: "kian", body: "Mm." },
      { speaker: "Kian", portraitId: "kian", expression: "knowing_smile", body: "I'll take first watch. The General will want a full report. I want it accurate." },
      N("Kian takes his bedroll to the far edge of camp, still close enough to listen if he wants. Lucian waits until the fire pops twice."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Now. The real question." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded", body: "Lucian — " },
      { speaker: "Lucian", portraitId: "lucian", body: "I'm not asking who you were. I'm asking what we do when he stops believing the lie I just told for you." },
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
      { speaker: "Leo", portraitId: "leo", expression: "wounded_pride", body: "My father's sending me with you. Don't argue, it's not worth it. He doesn't argue twice." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "Mountain bandits. A village they already burned. The leaders are siblings: Ndara, who plans, and her brother Ndari, who fights out in front of her." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "Ndara? Like Madame Dawn's Ndara? That one?" },
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
      N("Ndari falls at the gate, holding the line so his sister can run. He goes down still grinning, like he'd known the odds all along."),
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
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "Three days east, one road. Anyone who wanted to find us would know exactly where we'd be on the third afternoon." },
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
      N("Eight bodies on the road. The drivers check each other over twice, amazed that everyone is still alive. The wagons roll on after a short argument over who pays for the second wagon's broken axle."),
      { speaker: "Amar", portraitId: "amar", body: "Maya. The captain. Search him." },
      N("Maya has already searched him. A leather ledger is in her hand. She passes it to Lucian, not Amar. She knows the squad still looks to Lucian first, out of habit."),
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Three columns. Route, schedule, payment date. The handwriting in the margin. Amar, you'd know this. You said you wouldn't, but you would." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked", body: "...That's the King's accounting handwriting. Officer code. Only palace clerks learn it." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "Then this wasn't a bandit ambush. This was a contract." },
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "Why us?" },
      { speaker: "Lucian", portraitId: "lucian", body: "Because somebody in Nebu's court wanted this ledger to arrive on a dead man. We keep it." },
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
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "Half a dozen, maybe. A leader. Bring rope. The inner chapel sits behind a bell tower, and whoever's holding it knows the climb." },
      N("Lucian counts the words Fergus didn't use. \"Wanted poster.\" \"Bounty.\" \"Name.\" Lucian says nothing. The squad sets out before noon."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "He didn't tell us who's leading them. If there were a bounty to collect, he would have." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we'll find out at the door." },
      N("The road to the monastery is two days of steep, winding trail above a frozen river. By the second night, the squad can see torchlight at the top of the bell tower.")
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
      N("Selene, Amar's comrade from the coup, jumps from the balcony into the mist before Leo can turn his Dactyl. Left behind: five bodies, and a question Amar can't answer in front of the others."),
      N("The camp is colder than the road. Maya takes first watch. Ning falls asleep over her stew. Leo finally lies down. Lucian and Amar stay up. The fire pops twice."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "She knew you. From the gate to the balcony, she knew you, and you knew her. And you fought her at half strength. I've seen you hit bandits half her size harder." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded", body: "Lucian." },
      { speaker: "Lucian", portraitId: "lucian", body: "I'm not asking. I'm telling you I'm not asking. I'm telling you that whatever you say next, I have already decided what to do about it. Speak when you're ready." },
      N("Amar speaks for an hour. The coup. His seven comrades. The hospital in Thuling. Selene by name, Ranatoli by name, the five others he hasn't seen since. The throne hall. The plan."),
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
      { speaker: "Fergus", portraitId: "fergus", expression: "false_sincerity", body: "Tax riot in a mining town. Disperse the crowd, arrest the ringleaders, restore the King's peace. Routine work for soldiers of your rank." },
      { speaker: "Lucian", portraitId: "lucian", body: "Orinhal hasn't paid full tax in three years. It's a starvation case, not a riot." },
      { speaker: "Fergus", portraitId: "fergus", body: "The orders aren't yours to weigh, Lucian. Disperse the crowd." },
      N("Two days on the road. Maya rides at the back of the column without speaking. She always rides like that when she's three steps ahead of everyone else."),
      N("At the Orinhal gate they find a famine, not a riot. Unarmed foremen and families stand between the King's tax collectors and the last winter grain. Beyond, green cloaks: Madame Dawn's partisans."),
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
      STAGE("leo_defects", N("The tax collectors break first. Townspeople emerge as the last of the King's men run. A woman finds her husband alive. The squad has to look away.")),
      N("A figure in a gray cloak walks through the square as if she belongs there. She does not introduce herself to anyone but Amar."),
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral", body: "I'm Ndara. Not the bandit from the mountain village — same name, different woman, you'll get used to it. I serve a queen called Madame Dawn. She's been watching you a long time, Amar." },
      { speaker: "Amar", portraitId: "amar", body: "...Watching me how." },
      { speaker: "Ndara", portraitId: "ndara", body: "She wants to meet when you're ready. She'll be ready before you are. Ride safely, all of you." },
      N("Ndara leaves before Amar can answer. Lucian puts the squad's contract pay in a leather sack. On the way out, he walks the line of foremen at the gate and presses a coin into each man's hand."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "We got paid to come here and put you down. Wrong job. This settles the difference." },
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
      N("Leo doesn't say where he's going. He's back at the campfire by midnight. His Dactyl's covering is freshly repainted in the squad's own colors, not Fergus's crest.")
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
      N("The squad never reaches the keep. Fergus's outrider stops them on the road north of Orinhal with a new contract, sealed and dated three hours ago."),
      { speaker: "Outrider", body: "Bandit column moving on the border village of Tharin. Twenty men, mounted. The General orders intercept and destroy. Coordinates inside the seal." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance", body: "He's not letting us return to report Orinhal. He's keeping us moving until we miss a step." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve", body: "Refuse, and he knows we know. So we go. At least we go knowing." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we go knowing. Maya, you read the map for traps. Ning, full quiver. Leo, fly ahead. We don't get caught with our backs to anything." },
      N("The coordinates lead to a narrow ravine an hour east. The squad rides in slowly, weapons half-drawn. Thirty seconds past the river bend, archers on the cliffs open an arrow lane, and the trap snaps shut behind them.")
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
      N("An hour's ride from the river crossing, they stop. Lucian took a bolt: shallow, but bent. Maya cuts it out with a knife nobody knew she had. Ning can't look away."),
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "That bolt was for me. That whole lane. He pushed me into the rock." },
      { speaker: "Lucian", portraitId: "lucian", expression: "dying", body: "(through gritted teeth) The lane was for whoever was standing in it. You were standing in it. Stop apologizing and finish that damn bandage." },
      N("A prisoner names Fergus. The General knew about Amar. He kept sending the squad on impossible contracts until one day it wouldn't come back. Lucian chose his side weeks ago."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral", body: "All right. I'll do this once and then we move." },
      // Maya's promotion fires when she steps out of the alias.
      {
        speaker: "Maya",
        portraitId: "maya",
        expression: "steel_cold_confession_face",
        body: "My name really is Maya. The rest — Madame Dawn sent me eleven months ago, to watch Amar. Now you know. So we ride at first light, or we're all dead in Thuling by tomorrow night. I'm sorry about the lying. Not about the rest.",
        promote: "maya"
      },
      N("Nobody speaks for a long time. Lucian, of all people, smiles."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Maya. If I had a sister, I'd want her exactly that complicated. We ride." },
      // Ning's promotion fires after she processes the bolt incident —
      // the moment she stops being the bowyer's apprentice afraid of
      // her own draw and starts being the squad's archer who kept her
      // line after Lucian took a hit for her.
      {
        speaker: "Ning",
        portraitId: "ning",
        expression: "focused_bow",
        body: "Then I'm walking rear watch tonight. Nobody's taking another bolt for me. I felt what that feels like. Once is all I need.",
        promote: "ning"
      },
      { speaker: "Amar", portraitId: "amar", expression: "resolute", body: "Then we ride. Lucian, you take Mira and Tali to the cousin's farm. Catch up to us on the road." },
      N("Lucian rides for his house at the edge of Thuling. The squad turns west. The plan: get Mira and Tali, then reach Dawn's harbor by first light. The plan is about to change.")
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
        body: "Then let him talk. We listen with arrows on the string." },
      { speaker: "Leo", portraitId: "leo", expression: "ready",
        body: "Maya, give me three minutes' head start. I'll ride my Dactyl over the back gate and clear whatever's between you and the lane." },
      N("Maya peels off west. Leo rides east behind the row of houses. The rest of the squad walks their horses slowly up to Lucian's front door. They hear Kian's voice before they round the last corner.")
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
      N("They clear the western gate at a run. Leo, on his Dactyl, catches up with Maya. Mira and Tali head north to the cousin's farm. Lucian rides in silence."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(quietly) I told Tali it was a trip. She asked to bring the cat. I said no. Should've said yes. She'd have had something to hold." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "We can send for the cat. I'll write the cousin's wife once we reach Grude." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(small smile) ...That'd be all right. Thank you, Maya." },
      N("Amar rides at the front, not trusting himself to speak. They reach the cliffs at sundown. The whole ride, he's looked for a way this ends without Kian falling. He hasn't found one."),
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Amar. Four hours to the cliffs. Talk to us. Please. You haven't said a word since the gate." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "When we're on the water, Ning. Not before. Maya — the staircase down to Dawn's ship. What do we know?" },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Two narrow landings. Three archers up top. Two guards per landing. Kian in the middle of the lower one. In from the plateau, out through the ship. The middle's the bad part." },
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
      STAGE("kian_duel", N("The road ends on a plateau above Para Harbor. Dawn's ship waits below, sails ready. The only way down: the cliff staircase, where Kian and the King's elite are waiting.")),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Six guards visible. Kian on the lower landing. Two crown archers halfway down, covering every step. Elite, not Thuling watchmen. We push down and trade blows." },
      { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
        body: "I'll take the rear and the bottleneck on the upper stair. Anything that gets behind the squad goes through me first." },
      { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
        body: "Lucian. Your shoulder. You're not at full strength and you know it." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(simple) I know, Ning. I've thought about it. I'm taking the rear." },
      N("Amar takes one breath alone at the cliff edge. The gold light recalls his life before the hospital. He thinks of his father, of Selene, of Lucian and his daughter."),
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Down the staircase together. Nobody breaks formation. Maya leads, Ning covers from above, Leo flanks east on the Dactyl, Lucian holds rear. I take Kian. Nobody else. Confirm." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Confirmed." },
      { speaker: "Ning", portraitId: "ning", body: "Confirmed." },
      { speaker: "Leo", portraitId: "leo", expression: "ready", body: "Confirmed." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile", body: "Confirmed, your highness." },
      N("Lucian smiles the way he does when he means more than he says. Amar catches it, holds his eye a second longer than usual, and turns toward the stairs. The squad heads down.")
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
    // The ship slipping out of Para Harbor under the moon.
    cinematic: "escape",
    next: "story:before_ravage",
    beats: [
      N("The squad boards at moonrise. The captain, Khione, says only her name and orders the lines cut. Kian's body is still on the landing. No one looks back."),
      N("Below decks, the captain's mate brings a lantern and a bowl of water. For the first time in twelve hours, the squad stops moving. That's when Maya sees the blood spreading across the back of Lucian's tunic."),
      { speaker: "Maya", portraitId: "maya", expression: "alarmed",
        body: "Lucian. Off your feet. NOW. Ning, the bandages from my pack, the brown cord, MOVE." },
      { speaker: "Lucian", portraitId: "lucian", expression: "dying",
        body: "(quietly, sitting down against the bulkhead) It's all right. It's all right, it's all right. The bolt went through. Front to back. Clean shot. Sit me up against the wall, Maya. I want to see Amar." },
      N("They move him slowly. The bolt did not go clean through. It clipped the lung on the way out. Lucian knows this. He has seen this kind of wound before. He is not afraid."),
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Amar. Come here, your highness. Closer than that. Right next to me. Good." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(quietly) Lucian. I'm sorry. I should have seen the archer at the cliff edge. I watched Kian, I wasn't watching the —" },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Stop. Three things. One: Mira and Tali. Write them every season, especially when there's nothing to say. They need a man who remembers their father. Promise me." },
      { speaker: "Amar", portraitId: "amar", body: "Every season. I promise." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "Two. Maya's the smartest of us, including you. Listen to her. Three. Fight for the people beside you, not colony, empire, or throne. Kian was right about that." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Lucian." },
      { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
        body: "(soft) ...You'll be all right, Amar. There's a good man under there. I saw him the first day, at the forge. Take care of them. Take care of yourself." },
      N("Lucian's breathing slows. Ning holds his hand. Maya presses the wound long after it stops mattering. Leo guards the door. Lucian dies looking at Amar. The boat keeps moving."),
      N("An hour later the harbor lights are gone, open sea all around. Khione finds Amar at the stern and speaks, for the first time since giving her name."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Madame Dawn sends her sympathies. Fourteen months at sea. Grude by late summer next year. The food is plain, the wine good. We do not stop." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Captain. I want a sea burial for Lucian. Off the western rail, before the sun comes up. With the squad present and the ship stopped." },
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "We do not stop, your highness. But we will slow. The squad will be present. The western rail at dawn." },
      STAGE("burial", N("In the gray hour the squad gathers at the rail. Lucian goes into the sea wrapped in the Thuling flag Maya carried from his house. Ning lets him go. Silence.")),
      N("The ship turns west. At the stern, Amar takes out the practice sword Lucian carved the night they met at the forge. He holds it, and doesn't put it back."),
      N("Khione confirms it: fourteen months west across open water. The squad is free to roam the ship. The dactyl has nowhere to fly. The crossing has begun.")
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
      STAGE("voyage", N("The first month is grief. The squad drifts through it the way the ship drifts on still water: slowly, quietly, carried along.")),
      N("The second month is reading. Maya works through the Grude pamphlets she stowed before boarding, court rulings and council lists, making notes in three inks. She shares nothing yet."),
      N("In the fourth month Ning teaches herself to make arrows for shifting wind. Khione silently hands her a windrose, a chart of the wind's turns. Ning works it out alone."),
      N("The seventh month: Leo and the dactyl Ash, whom the squad calls Kid, walk the whole ship. Ash stops fearing the deck. Leo stops fearing he was wrong to leave his father."),
      N("The ninth month: Amar takes out Lucian's wooden practice sword, holds it an hour, and carves a single word into the grip. He shows no one what it says."),
      N("In the eleventh month Maya breaks her own rule: she sits across from Amar with a stack of Grude maps and one folded paper. She doesn't open it. Neither speaks."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I promised I'd wait until you asked. You haven't asked. So I'm asking instead. Can I tell you one thing about your old life? One. Before we land." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "...One thing. Yes." },
      { speaker: "Maya", portraitId: "maya",
        body: "The man you called your father was your mother's brother. Your father died before you were born. Your mother didn't. Her letter's under the map. I wanted you to have it before Dawn decides when you're ready." },
      N("Amar doesn't ask whose letter it is. He doesn't have to. He sits with Maya for a long time without speaking. The lantern burns down. Maya leaves the letter under the map and goes to bed without looking back."),
      STAGE("grude_arrival", N("Three months later Khione brings the ship into Grude's east port. The city climbs a hill in terraces, taller than anything they've seen. It smells like a different country.")),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Ten minutes to dockside. Madame Dawn's papers pass every customs platform on this coast. The customs captain will not look twice. (Pause.) Unless he has been told what to look for." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "He's been told. Crossbows raised a hundred meters out. Routine customs doesn't do that. Amar, formation. Ning, fletching check. Leo, dactyl on the gangway with us, not in the hold. We walk off in arrowhead." },
      N("The gangway lowers. The squad steps off into the empire. The alarm bell at the customs platform starts ringing before Amar is off the gangway.")
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
        body: "The mountain village. At Orinhal I said the bandit there was a different Ndara. It was me. My brother Ndari held the gate, and died holding it. (She keeps pouring.) I'm Dawn's lieutenant. I'm sorry. Drink your tea." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "...Ndara. He said your name on the ridge, before he fell. I've been thinking about him for eleven months." },
      { speaker: "Ndara", portraitId: "ndara",
        body: "So have I. Tea, your highness." },
      N("Maya takes the tea first, her signal that the room is safe. The squad sits. Dawn enters and stands at the window, back to them, a long moment before speaking."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Eighty years ago King Archbold's great-grandfather wanted Anthros's iron, so he crowned Nebu, a Para noble. Anthros is a colony. Your iron forged the swords on that dock." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "(quietly, to the squad) I've known for nine years. I'm sorry. There was never a day when telling you would have made any of us safer. There should have been. There wasn't." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Your father's coup was against Grude's rule. Grude killed him. I found you in that hospital ward. Maya, Lucian, Ndara, Kian: all of them were bringing you here." },
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
        body: "(quiet) I'll take the watch. None of you have slept since the ship. Nothing comes through that door tonight. Sleep." },
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
      N("Three weeks in the safe house, and the squad has begun to live in Grude. Dawn promised Amar a talk about his past. Neither has brought it up."),
      N("Then, on a Tuesday at sundown, Dawn comes into the common room with a folded map under her arm. She asks the squad up to her study. The quiet three weeks are over."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Tonight nine years of work lands in one hour. Twelve strikes: the King's nephews, wardens, ledger-keepers, the prison master. We won't kill the empire tonight. We'll prove it can die. I'm not ordering anyone. I'm inviting you." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "We're in. What's our target?" },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "The youngest nephew's residence, off Oran Lane. Lightly garrisoned. The boy's never known fear, his captain's an incompetent. Rose has mapped the plaza. She'll lead you in." },
      N("Dawn's study door opens on a woman the squad doesn't know: mid-thirties, teal officer's coat, throwing blades. She nods without smiling. She has the Maya look: careful, measuring."),
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "Squad, this is Rose. She has been one of my lieutenants for twelve years. She and Maya trained as officers together. Rose, the squad you've been writing reports about for eleven months." },
      { speaker: "Rose", portraitId: "rose", expression: "neutral",
        body: "(small nod) Amar. Maya. Ning. Leo. I've read everything Maya sent for eleven months. Tonight will be hard. The plaza layout once more, then we move." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Rose. Hi. (Quiet, between them.) ...It's good to see you in person. Eleven years through letters. It's a lot." },
      { speaker: "Rose", portraitId: "rose", expression: "brisk",
        body: "(half-smile, only at Maya) It is. Talk later. We move at 11:14." },
      N("Rose walks the squad through the plaza plan three times: positions, angles, cover. She is precise and quick. Dawn watches and never interrupts. Rose is the person she trusts most in the world."),
      { speaker: "Rose", portraitId: "rose", expression: "brisk",
        body: "Eight minutes from approach to plaza-clear. We move." },
      N("The squad collects their weapons. At the door, Madame Dawn pulls Amar aside for a few quiet words Maya doesn't hear. Rose is already on the stairs. Far off, the river bell begins to ring second watch.")
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
      STAGE("rose_falls", N("Dawn doesn't move for an hour. Ndara brings a cart; she, Amar, Maya, and Leo lift Rose in. Dawn walks beside it all the way home. Nobody speaks.")),
      N("All twelve targets are dead. By morning, flyers across the city name them. By sundown, the empire formally admits an armed rebellion exists. Dawn has been right about everything."),
      N("Rose is buried at first light beneath the lemon tree behind the candle-maker's shop. Dawn speaks for less than a minute: no tears, no tremor, the same flat briefing voice."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Rose Eseldra. Thirty-two years with me. She trained Maya. She took four bolts for me. The plaza takes her name. The lemon tree stays. I have meetings." },
      N("For four days Dawn vanishes into meetings. She ignores Maya's knock and lets Ndara's tea go cold. Then Amar finds her on the courtyard bench, sits beside her, and neither speaks."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "(eventually) She wanted to retire next year. A cottage on the south coast. The plan worked, Amar. Twelve for twelve; Rose our only loss. The math doesn't help." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...Dawn. You don't have to do the math. Not tonight." },
      { speaker: "Madame Dawn", portraitId: "dawn",
        body: "I do, though. Thirty-two years. If I don't count what she was worth, who will? (She lifts the cup.) Go to bed, Amar. Thank you for sitting." },
      N("Amar sits with her until dark. Near midnight Dawn puts her face in her hands. He looks away until she lifts it. Leaving, she pauses at the door."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Amar. Tomorrow afternoon, the study. Maya and Ndara as well. There's a great deal you don't know about who you are, and it can't wait any longer. ...Sleep well." },
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
        body: "Sit. Amar, the chair by the window, where I can see you. You've earned that. Maya and Ndara already know. They're here so you won't carry this alone." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "Three weeks you've put this off, Dawn. A year at sea, eleven years before that. Say it plainly. I'm tired of learning my own life last." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Plainly, then. Softening it would only be more managing.\n\nI am your mother, Amar. I carried you, named you, held you every night for your first eleven months." },
      N("Amar does not say anything. The light from the one window is on his face, exactly as Dawn arranged it. Nobody in the room looks away from him, because Dawn told them not to."),
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "(quietly) ...You said \"my son\" from the window at the harbor. I told myself it was a way of speaking." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Your father is alive. Archbold. King of Grude. You've been at war with him since the harbor." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "Maya told me on the ship that my father died before I was born. She sat across a table from me and she said it to my face." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I told you what I was told. She lied to me too, Amar. Eleven years, and she lied to me too." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Maya's earned her anger. Yes, I lied to her. What she didn't know, nobody could torture out of her. (Beat.) I'm not proud of it. I'd do it again." },
      { speaker: "Ndara", portraitId: "ndara", expression: "neutral",
        body: "(evenly, to Amar) I've known since before the mountain village. Holding it never made it lighter. Let her finish." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Thirty-two years ago I was a council member's daughter at Archbold's court. I read the ledgers: what Anthros was for. Iron, harvests, starvation by design. I carried the empire's heir." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "I could not raise you inside what I meant to destroy. At eleven months I sent you to my brother in Anthros. You believed he was your father." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "You arranged all of it. The forge. Lucian. Maya. Kian, somehow. You've been moving me around a board since before I could walk. Everyone I've ever loved was a piece you placed." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "I placed them. What grew was yours. (Beat.) I won't apologize for reaching for my son. Rose was the newest cost. She will not be the last. You should know what you are joining —" },
      N("Dawn stops. A faint knocking comes up through the floorboards. Downstairs, the candle-maker is tapping a ceiling beam with a broom handle, fast and uneven. Three taps, two, three. Ndara is already on her feet."),
      { speaker: "Ndara", portraitId: "ndara", expression: "commanding",
        body: "That is the far-watch signal. Soldiers on the street, moving with purpose, more than a patrol. They have found the house." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Then the rest waits. Amar, down the stairs and into the street before they're lined up at the door. Whoever you turn out to be, you're still the one they came for. Move." },
      N("On the workshop landing below, a broad woman in a scorched leather apron calmly lifts a bronze rig off the wall rack. Veya: Archbold's court lens-maker, until Dawn stole her from the palace two winters ago. She made every sighting-glass the rebellion uses."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "(from the stairs, without turning) Veya goes with you. She has been asking me to send her into the field since the plaza. I have run out of reasons to keep her indoors." },
      { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
        body: "Household guard. Vasse-forge plate, court pattern. I sat through nine years of their inspections. Light goes through the throat seam if you ask it politely. Stay out of my line of fire and I'll show you." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "You grind lenses and you're volunteering for a street fight. Why?" },
      { speaker: "Veya", portraitId: "veya", expression: "grim_resolve",
        body: "Because I spent a career helping men see farther so they could take more. After the plaza, my name's on their lists anyway. So. From here I aim the other way. Downstairs, your highness. They're at the door." }
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
      N("When they go back up, Dawn has moved the four chairs against the wall. She is at the window with her hands folded, watching the street where Lord Castor's men were."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "You've heard the part that matters. The rest waits. But here's the sentence the candle-maker's broom cut off." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "Everything you did as a man of Anthros, you also did as the empire's heir, attacking his own father's house. Both are true, and will be for the rest of your life. Decide what that man does next." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...Lucian told me to fight for the people next to me. Not a colony. Not an empire. (Beat.) It's the only thing anyone's told me in two years that didn't come with strings on it." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Then Lucian was a better strategist than I am. Keep what he told you. You'll want something of your own when this gets worse." },
      N("In the workshop, Veya wipes the rig's front lens with her apron and sets it back on the rack. Four of Castor's guards went down and not one of them reached her. She is trying very hard not to look pleased about it."),
      { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
        body: "Throat seam. Told you. Nine years I signed off on that plate, and the court never once asked me where it fails. Their loss is your gain, if you'll have a middle-aged optician with strong opinions." },
      N("Nobody says no. Ning is already asking her how the rig works. From tonight, the squad is five."),
      N("Maya catches Amar on the stairs afterward. She is not calculating anything; for once she just looks tired."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Eleven years on a false story and I never found the hole in it. If Dawn can fool me, who's fooling Dawn? (Beat.) Go to sleep, Amar. One of us should." },
      N("The squad sleeps under the candle-maker's roof again. Somewhere in this city, a king now knows his son is here. Downstairs, Maya does not sleep. Very quietly, she starts going through everyone Dawn trusts.")
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
      N("Maya works six days, barely sleeping. She lays out three months of stolen supply records across the study floor, looking for the one person who touched them all."),
      { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
        body: "Madame Dawn. Three months of supply records. Every message in this house crosses one desk before it reaches yours. One man sees all of it. Not you. Not me. Coyne." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Nine years Coyne ran my supply line. He buried my couriers. (A pause.) ...And he's the only answer to how Castor found that door. Say the rest, Maya." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I didn't. I need you to send someone steady to bring Coyne in before he reads the room. Quietly, no alarm, before he can —" },
      N("The study door opens without a knock. One of Dawn's couriers, out of breath from the stairs. The worst news is written on their face."),
      { speaker: "Courier", body: "Madame, it's Ndara. The courtyard. She's down, she's breathing, but she won't — she won't wake up, Madame, we can't wake her." },
      N("Ndara worked out the same name an hour earlier. Alone as always, she went to question Coyne herself. The squad finds her on the cobblestones. Coyne is gone."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "(very quietly) Carry Ndara upstairs. A cot, not the floor. Khione will sit with her." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "Find me Coyne. He hasn't left. The river and harbour gates are watched, and he knows it. He'll take the courtyard's back gate. He won't be alone." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then he doesn't reach it. Squad — courtyard. Now. Move." }
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
      N("Coyne is buried outside the walls, unmarked, in silence. Dawn does not attend. The lemon tree has seen blood at its roots twice this month. It goes on being a lemon tree."),
      N("Ndara is moved to the bright upstairs room. Khione sits with her for two nights. On the third morning Khione finds Amar on the stairs and tells him the truth."),
      { speaker: "Khione", portraitId: "khione", expression: "neutral",
        body: "Her body mends. The head wound is beyond any physician I would trust. She may wake tomorrow. She may wake in a season. She may not wake. (Beat.) I am sorry. I know what she is to this house." },
      N("That afternoon Dawn gathers the squad in the study. She offers no chairs. The four from the day she named Amar's parents are stacked against the wall. Her careful, inviting tone is gone."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "For thirty years I asked people to follow me. Rose is buried behind the shop. Ndara won't wake. (Beat.) I'm done asking." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "So I'm telling you. The rebellion has enough martyrs. What it needs is a face — the throne of Anthros, and its heir standing in the open. We'll speak of what that costs tomorrow." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "...You buried Rose three weeks ago telling me grief shouldn't be rushed. Now you can't get to the next move fast enough." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Yes. (Beat.) Being betrayed under my own roof taught me what a kind plan costs, and who ends up paying for it. Tomorrow, Amar." },
      N("Dawn leaves the study first, which she has never done. The squad stands among the stacked chairs. Maya is the one who finally speaks, and she speaks quietly, and only to the people in the room."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "She's not wrong. That's the part that should frighten you. (Beat.) Whatever she offers tomorrow — walk in already knowing your answer. If you hear her out first, you'll say yes." },
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
        body: "Archbold will fall. Then Anthros has no throne. A hundred million frightened people, and the next strong man walks right in. I've watched it happen on three continents." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "ideologue_intensity",
        body: "When the empire falls, Anthros will need a face. Blood a farmer can point to. You're the only heir alive who is both the royal line and the rebellion. I've spent thirty years arranging that." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "You're asking me to be a king." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "Anthros will have a throne whether you take it or not. Everyone else who could take it is worse. Yes. I am asking my son to be a king." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Lucian died telling me not to fight for thrones. You're asking me to pick up the exact thing he told me to put down." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Your foreman was advising a soldier. I'm advising a king. Fight only for the people you can see, and the people you can't see starve. (Beat.) Decide whose son you are. Mine, his, or your own." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then my answer is not yet. Not no. Not yes. (Beat.) Everyone who's ever told me who I am had half the picture. When I answer you, I'll be holding all of it." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "\"Not yet\" I can work with. Earn it. Tonight a courier crosses the river with the names of cells loyal to your father. Take the squad. Bring me the courier's crate." },
      N("The errand will not be routine. Neither Dawn nor Amar knows that yet. The squad walks out with a rolled-up map and an unanswered question.")
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
      N("The crate arrives with the colony cell-names, as Dawn promised. A success to everyone but the squad. They walked onto that bridge as people. They walked off it as numbers in Archbold's ledger."),
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "He sent an assassin. Three weeks ago I didn't have a father. Now I know what he'll pay to be rid of a son. One professional and two hired men." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Your father's simple. He wants you dead. At least you know where you stand. Dawn's wanted you on a throne since before you could walk. (Beat.) Think about which of those frightens you more." },
      N("Amar can't sleep. He goes up to sit with Ndara, still in her coma. Khione is already in the chair by the cot, as most nights, watching a marshal who held steady for thirty years lie still."),
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "You have the look, your highness. (She does not turn from the cot.) Nineteen years I have sailed for Dawn. I love her the way I love the sea. I have never once called her safe." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "If you're circling something, Khione, walk to it. It's been a long night already." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "Your mother has never told anyone the whole story. Kian told you half of it, on the cliff stairs. I carry all of it. Before you answer her about thrones, come find me on my ship." },
      N("Khione goes back to watching Ndara breathe. Amar sits with his mother's question and the answer Khione has promised. Below, Dawn sleeps, her plan finally moving. The squad lies awake.")
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
        body: "Dawn's rebellion was never built to free Anthros. It was built to spend it. She wants her son crowned. That much is true. But her road to the crown needs Anthros to burn, and she made her peace with that fire long ago." },
      { speaker: "Amar", portraitId: "amar", expression: "shocked",
        body: "Spend it how. (Beat.) All of it, Khione. Say all of it." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "When an heir raises an army, Archbold must answer it. His answer will be to burn Anthros. And the fire is not the price of Dawn's plan, Amar. The fire is the plan. Grude watches its king burn a country, and turns on him, and the empire ends." },
      { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
        body: "She split the plan into pieces. I held one. Ndara held one. Rose held one. Nobody but Dawn ever saw the whole. (Flat.) Thuling burns too, Amar. Kian guessed a hundred thousand dead. He was guessing low." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "She held me for eleven months. Crossed an ocean for me. Called me her son. (Beat.) And the whole time, the road to my crown ran through Lucian's town." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "Both things are true, your highness. That is your mother: real love and real arithmetic. Neither one has ever changed the other. (Beat.) Decide nothing here. Dawn's house has ears." },
      N("Word travels fast: the rebellion won't let its heir stroll onto a boat. Loyalists line the quay before Khione's gangway, Marshal Othren at their centre, and he won't step aside."),
      N("At the end of the line, on foot beside a grey warhorse, stands a lancer in dark red armour. A small silver rose is pinned to his cloak. Captain Corin Eseldra: nine years in Dawn's cavalry, Rose's younger brother. He is looking at the rose, not the squad."),
      { speaker: "Corin", portraitId: "corin", expression: "torn",
        body: "Marshal. One question before I hold this dock for you. The plan the heir is running from — the one that burns a colony. Was my sister's post at the plaza part of it? (Silence.) That silence is my answer." },
      { speaker: "Corin", portraitId: "corin", expression: "resolute",
        body: "Rose took four bolts believing Dawn would never spend her. She was spent anyway. (He walks his horse across the line.) One lance for the gangway, your highness. My sister trained your Maya. The account is open." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "(quietly, to Amar) He stands the way she did. Exactly the way she did. Take the lance." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then we don't need Othren to step aside. Captain, welcome aboard. Squad: gangway, ship, open water. We'll decide what comes next somewhere my mother hasn't mapped." }
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
      N("Khione casts off. Madame Dawn walks alone onto the emptying quay. She has not come to stop the ship. She waits until the gap is too wide for anything she says to sound like bargaining."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "I deny nothing. Khione has it exact. Thirty years I've searched for a plan that frees Anthros without burning it. There is none. I've grieved longer than you've lived." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
        body: "You reached that ship because I let you reach it. Othren is mine. Khione has been mine for nineteen years. (Beat.) I have spent thirty years learning to spend everything. It turns out I cannot spend you. Go, Amar. Outrun my arithmetic if you can." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(across the widening water) You could have told me. Any night of the crossing. Any morning in the study. You could have set the whole of it on the table and let me choose with my eyes open." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "Yes. I could have. Every one of those mornings I chose silence, and I knew what I was choosing. (The gap widens.) I loved you entirely, and I lied to you entirely. You will have to carry both. So will I." },
      N("The water widens. Neither of them waves. They hold each other's eyes until the mist takes the dock. Then Dawn is gone, Grude with her, and the ship turns for open sea."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "(after a long quiet) It's not her board anymore. Nobody's holding the map. (Beat.) Whatever you choose, we're beside you. That part was Lucian's orders." },
      N("At the stern rail Corin stands alone, the silver rose clasp in his palm, watching the country where his sister is buried grow smaller. Nobody bothers him for a long while. Then Amar comes and stands beside him. Neither speaks. That is the right amount."),
      { speaker: "Corin", portraitId: "corin", expression: "quiet_grief",
        body: "Nine years we lived two streets apart, and the rebellion kept us apart. I never saw her lemon tree. (He pins the clasp back on.) I ride with you now, your highness. Wherever that turns out to be." },
      N("Below decks is a bright cabin Khione lets no one ask about. A cot is lashed to the wall. On it, breathing steady and unreachable, lies Ndara. Khione carried her aboard two nights before the quay, while 'readying the ship'. The readying included the rebellion's marshal."),
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "She sails with us. Dawn had begun to spend even her. A marshal in a coma still makes a useful story. (Beat.) Some things I refuse to leave behind. Sit with her sometimes. She always knew who was in the room." },
      N("The ship runs west; Grude sinks behind. Ahead, nothing is written: no warrant, no map, no army. Only the sea, the squad, a lancer learning his sister secondhand, a sleeping marshal, and a question only Amar can answer.")
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
      N("Three days at sea. The squad has slept, and their hands have stopped shaking. Khione is at the wheel. Below deck, the others sit around a crate. Nobody has asked the big question yet: what Amar does now."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "Landfall in four days. The empire wants you dead. The rebellion wants to sacrifice you. The squad goes where you point, so... where are you pointing?" },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "I keep going over the names. Selene: kill my father and be done with it. Lucian: rebuild slowly, from the ground up. You'd burn every throne on the continent. Khonu served. Tev walked away in one piece. Yul treated anyone, whatever side they were on. Sera —" },
      { speaker: "Ning", portraitId: "ning", expression: "startled",
        body: "Sera said the kindest thing your head wound did was let you put your old life down. (Quietly.) I remember. You told me on the wall at Orinhal. You didn't think I was listening." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "Seven names, and every one of them decided what I was for before I got a say. So did Dawn. And my father. And Fergus. I'm tired of people handing me answers, Maya. That's all I know so far." },
      { speaker: "Leo", portraitId: "leo", expression: "wounded_pride",
        body: "(from the shadows) My father wrote my whole life out for me on a list once. I flew off the other way and I've never missed it. Pick whichever one you can live with, Captain. We're coming either way." },
      N("Then someone speaks from Ndara's cabin. Nobody aboard has heard that voice in three weeks. Hoarse but steady, it asks through the wall: 'Whose watch is it?'"),
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral",
        body: "(in the doorway, barely standing) I've heard you through that wall for three days, listing other people's answers. My advice as marshal: stop. Nobody else in this hold gets a vote. It's your call. (She lowers herself onto a crate.) I'll back you either way. From a chair, for now." },
      N("Khione is down the ladder before anyone speaks. After all those nights watching Ndara lie still, she holds the marshal upright for a moment. Neither of them says a word about it. Ndara lost her sword arm in the courtyard, but her nerve is the same as ever."),
      N("A ship is closing fast, flying imperial colours. The empire hasn't given up on Amar. His answer will have to wait until after one more fight. Landfall is still four days away.")
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
      N("The last boarder goes over the rail, and the imperial ship pulls away with its captain dead. Khione never let go of the wheel. The coast is in sight now, only four hours away."),
      { speaker: "Khione", portraitId: "khione", expression: "serene_neutral",
        body: "Nobody owns that beach. It may be the last place that nobody owns. Past it, everything belongs to someone, and every one of them wants something from you. Decide whose claim you will answer before we land." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "I'm done counting names. Maya, you said the squad goes where I point. Stand with me while I do." },
      N("Amar has seven possible answers: vengeance, restoration, revolution, duty, exile, mercy, or forgetting. The one he chooses decides what he does when they land. Then he will have to fight for it.")
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
      N("They burn Lord Castor's order to bring Amar back in the campfire. Nobody wanted to carry it around, and nobody wanted to just throw it away either."),
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "Selene told me once to kill the man who did it, because that's the only clean way. (Watching the paper burn.) She was wrong about it being clean. She was right about everything else." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "The second name's a garrison colonel. Three days' ride. (She banks the fire.) Sleep first, Amar. The list will still be there tomorrow. That's the awful thing about lists." },
      N("Amar keeps hunting, one name at a time, and the last name on the list is the King's. He keeps his own count as he goes. It is his choice, and for now he can still live with it.")
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
        body: "The old man says there's a bridge out at the east field, and a well gone sour, and a militia that's four boys and a scythe. (Grinning.) He said it like he was handing out chores. To us!" },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "It is a list of chores. (He almost laughs.) No thrones. Just the next broken thing, and then the one after that. Lucian would already be out at the bridge." },
      N("In the morning they start on the well. The work is slow and small, but it lasts, as Lucian said real work does. It belongs to the village, not to the King or the rebellion.")
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
      N("The smoke can be seen across the border country. By noon, riders they have never met are telling them about their own attack, and the story has already grown bigger than what happened."),
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Two more depots, a tax office, and the registry of who owes what. Burn the records, Amar, and nobody can prove anyone owes anything. That's what they guard hardest." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "No lists of names, Maya. We burn records and buildings. We never burn people. That's where I draw the line. If we ever cross it, we're just Dawn with worse logistics." },
      N("She looks him in the eye and nods, and she means it. They ride for the tax office with one rule: burn the records, never the people.")
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
      N("The relief column's surgeon takes the wounded, and the quartermaster takes the casualty report. Amar spends the rest of the night at a folding table, doing a captain's paperwork in regulation format."),
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Ferren. Odal. Iska, who lied to the recruiter about her age. (He signs the third letter.) Khonu carried letters like these for twenty years. I thought it was paperwork." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "The column's calling you the captain who held the bridge and wrote the letters himself, the same night. (Quietly.) Soldiers remember that longer than they remember a win, Amar. Sleep. Reveille's at six." },
      N("At six he is up with the column in his father's old colors, reading every order before he signs it. It is the strictest of the seven paths and the most direct, and he can live with it.")
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
      N("Past the mountain pass, the land empties out until even the road ends. He rides north alone. Slowly, he gets used to the quiet."),
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "(to the horse, eventually) Tev always said the bravest thing a man can do is walk away in one piece. ...He never mentioned that you keep counting the people you left behind. Maya. Ning. Leo." },
      N("Behind him the war goes on, and people are still looking for him. Ahead is a cold coast where nobody knows his name. He buries the last trail marker and rides for it."),
      N("He has not found peace. He has only put distance between himself and the war. Of the seven paths, this is the loneliest, and he chose it.")
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
      N("By morning the armoury is a hospital ward. Imperial and rebel wounded lie in cots side by side, eat from the same pot, and complain about the same porridge. The squad privately calls it the first truce of the war."),
      { speaker: "Ning", portraitId: "ning", expression: "startled",
        body: "The holdout captain's asking for you. Not to fight. He wants to know how you plan to end a war without winning it. I think it's been keeping him up at night." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Good. It keeps me up too. (Rolling his sleeves.) Tell him to go look in the ward. Third cot from the door — his own sergeant, alive. Then he can come ask me again." },
      N("News that the squad accepted the fort's surrender spreads faster than news of any victory. Two more garrisons ask for terms. Like Yul, the squad treats every wounded soldier, whichever side they fought for."),
      // The figure Ning spotted at the gate (the battle's closing beat)
      // is gone by the time Amar gets there. Seeds the full reunion at
      // post_grude_burns without spending it early.
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(At the gate at dusk, nobody is there. Scratched in the dust with a boot heel is the old scout sign the seven used for 'road clear ahead'.) ...Still watching my back. (He steps around the mark.) It's been two years, Selene. Just come in already." }
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
      N("By midnight the tide has washed the blood off the sand. In the morning the sword is still by the door, with the potion beside it."),
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "(looking at the sword) Sera called my head wound a kindness. A chance to let go of my old life. She never told me I'd have to keep letting go of it. Every morning. This one too." },
      N("He does not pick up the sword. He puts the potion on the shelf, since it is only medicine. The sword stays by the door, and each morning he leaves it there."),
      N("He takes the boat out with the tide. The war goes on, and people are still looking for Amar. This path is the gentlest of the seven and the hardest to keep. He chooses it again every day, and goes fishing.")
    ]
  },

  // ═══════════ War arc epilogue — after B22, Grude Burns ═══════════
  // The last authored beat of the war stretch. Lands the cost of the
  // three battles and points the campaign at the sky (the Ravage fleet,
  // B23+). Routes to credits until the fleet arc ships.
  // -------- War arc epilogues (B20, B21) --------
  // The war battles used to fall through to camp with no scene at all —
  // the only two chapters in the campaign that ended in silence.
  post_dawn_war: {
    id: "post_dawn_war",
    title: "The Cheered Name",
    subtitle: "The field camp, the evening after",
    music: "emotional",
    backdrop: "field_night_camp",
    next: "prep:b21_archbold_advances",
    beats: [
      N("It takes a long time to clear the field, because everything has to be carried off by hand. Burial parties work both slopes by torchlight. By now, nobody argues about which side's dead go in which trench."),
      N("Across the camp, Dawn's rebels are still singing a song about the charge. The name in the chorus is Amar's, not Dawn's."),
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "charismatic_warm_smile",
        body: "We beat an imperial line in open battle. Nobody's done that in a hundred years. Whatever else is going on between us, Amar, enjoy tonight. You earned it." },
      { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
        body: "(She listens to the singing a moment too long.) I wrote every word of that song, you know. Every word except the name." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Enjoy the song tonight, then forget about it. Once a crowd knows your name, they know who to blame when things go wrong." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "They're not cheering me. The line held, and I happened to be where they could see me. (He looks west, down the King's Road.) We broke Serrick today. My father's army is probably already on the road." },
      N("He is right. By midnight the camp hears that the King has called up the inner provinces and is marching west himself. Since this morning, this is no longer just Dawn's rebellion. Tomorrow it is a race to Grude.")
    ]
  },
  post_archbold_advances: {
    id: "post_archbold_advances",
    title: "One Day's March",
    subtitle: "The barricade line, after dark",
    music: "sadness2",
    backdrop: "field_night_camp",
    // What the squad sees on the horizon: the capital on fire.
    endCinematic: "grude_burns",
    next: "prep:b22_grude_burns",
    beats: [
      N("The barricade is still standing in the dark: carts, fence rails, and one wagon with a broken axle that nobody will ever move again. The squad eats standing up, watching the road they just held against the King."),
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral",
        body: "I've seen generals lose a thousand men to delay an enemy by less than a day. You held him up a full day with a fence. Take the compliment, Captain. I won't say it twice." },
      { speaker: "Leo", portraitId: "leo", expression: "wounded_pride",
        body: "It doesn't feel like winning. He's still coming. I can still feel his cavalry through my boots, and we won." },
      { speaker: "Ning", portraitId: "ning", expression: "exhausted",
        body: "I used to count my arrows. Today I started counting the people I aimed away from instead. I don't think I can go back to just counting arrows." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "He wanted this road to be easy. It cost him a day instead. (He shoulders his pack.) Grude needs that day more than we need sleep. We march tonight." },
      N("North, past the tree line, the sky is glowing when it should be dark. This is not the strange light in the east. It is ordinary fire. Something in Grude is burning.")
    ]
  },
  post_grude_burns: {
    id: "post_grude_burns",
    title: "The Held City",
    subtitle: "The upper district, the morning after",
    music: "emotional",
    backdrop: "grude",
    next: "prep:b23_path_climax_a",
    beats: [
      N("When morning comes, Grude's upper district is still standing. It is scorched, there are gaps where houses fell, and the ash on the market row is ankle-deep, but it survived."),
      N("The squad walks the market row at first light. People have chalked names on every burned door: who lived there and what used to stand there. Nobody organized it. People just did it."),
      { speaker: "Leo", portraitId: "leo", expression: "resolute",
        body: "Three battles in nine days. Serrick, the road, now this. (He counts on his fingers, then stops.) I stopped being scared somewhere around the fence line. I can't decide if that's good." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "It's not good or bad, Leo. It's what this costs you. (She looks at Amar.) Just watch out for whoever's keeping the tally." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "Then we keep our own tally. Every name on those doors goes on it." },
      // The reunion turn — the main theme swells as the first of the
      // old seven walks out of the smoke (DialogBeat.music crossfade).
      { portraitId: "narrator", music: "mainTheme",
        body: "An hour later, old friends start coming back. The fires broke open the prison row, and out of it comes a huge shield. Behind it, greyer and thinner but grinning, is Ranatoli." },
      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "lecturing",
        body: "Steel up, Amar. We bleed together or we feast together. Anything in between is shame. (He looks the squad over.) I said that to a boy once. Look what he turned into while I was in a cell." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(He runs across the row and hugs him, shield and all, and neither of them lets go.) I stopped asking about the cells two years ago. I couldn't stand hearing nothing back. (muffled, into his shoulder) Tonight we feast, old man. Tonight we feast." },
      N("Meanwhile, Veya has taken over the district glassworks. For two nights she has been fusing glass saved from the burned observatory into her rig, replacing its single lens with a ring of stacked prisms. She calls it 'overdue'. From this morning on, the squad calls her the Prismarch."),
      { speaker: "Veya", portraitId: "veya", expression: "focused",
        body: "One lens could only do so much. Seven can do a lot more. Now hold still. I've got your measurements.", promote: "veya" },
      N("Then a huntress walks out of the smoke. She escaped a monastery and crossed an ocean, tracking the same names the squad has been crossing off. It is Selene."),
      { speaker: "Selene", portraitId: "selene",
        body: "I've been three streets behind you since the harbour, watching who you let live. (She shoulders her bow.) You're Lucian's boy after all. (looking at the horizon) That sky's going to cost all of us something. Soon." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "(He doesn't rush her.) At the monastery you told me not to follow you past the bell. This time I'm asking you to follow me. Stay. Please. That's all I've got." },
      N("In the prison-row stables, Corin finds a horse the empire left behind: a big, war-trained Grude warhorse. No one has ridden it since its rider died on the processional. Corin and the horse size each other up for a long minute, and then it lowers its head. The Thuling veterans have a word from their border wars for a lancer who leads from the very front: Khan."),
      { speaker: "Corin", portraitId: "corin", expression: "resolute",
        body: "Rose's job was holding doors. Mine is breaking them open. (He swings up, and the warhorse turns without being asked.) Whatever's wrong with that horizon, the cavalry will meet it first.", promote: "corin" },
      N("East of the city, past the harbour, the horizon has been the wrong colour for three days. Sailors refuse to put out to sea, and birds are flying inland. The armies are still too busy fighting each other to pay attention."),
      N("That is about to change. But first, the squad has to get through one more choke point: the narrow canyon, and whoever is waiting in it.")
    ]
  },

  // ═══════════ Campaign endings — after B29, one coda per war path ═══════════
  // The five wars end five ways. Each coda is the path's B19 epilogue
  // grown up: the same voice, after everything it cost.

  // -------- Fleet arc epilogues (B23-B28) --------
  // Each bridges directly into the next battle's prep, same cadence as
  // post_grude_burns: the endgame doesn't detour through the overworld.
  post_path_climax_a: {
    id: "post_path_climax_a",
    title: "What the Narrows Held",
    subtitle: "The canyon's far mouth",
    music: "emotional",
    backdrop: "mountain",
    next: "prep:b24_path_climax_b",
    beats: [
      N("The squad comes out the far side of the canyon in single file. Behind them, what's left of Colonel Vasse's force stacks its weapons in the road. They haven't formally surrendered. They have just stopped fighting."),
      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "dry_skeptical",
        body: "He kept fighting because stopping would've meant it was all for nothing. I did two years in a cell telling myself the same thing. Somebody should tell him this war isn't the real fight anymore." },
      { speaker: "Selene", portraitId: "selene",
        body: "I saw tracks on the eastern ridge at dawn. Every animal up there is moving west. Wolves walking next to deer, and neither one hunting. I've never seen that." },
      { speaker: "Veya", portraitId: "veya", expression: "focused",
        body: "My prisms say the same thing the wolves do. Light from the east is coming in bent. That isn't a sunset. It's something I can measure, and it's getting stronger." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then that was the last fight we'll have against people. The bell court's half a day away. The villages need to hear about this from us before they see it for themselves." },
      N("They march. Behind them, unasked, a dozen of Vasse's spearmen fall in at the column's tail. Nobody sends them away.")
    ]
  },
  post_path_climax_b: {
    id: "post_path_climax_b",
    title: "The Hour After the Bell",
    subtitle: "The bell court, through the night",
    music: "trailer",
    backdrop: "monastery",
    // Sunrise: the sky opens over the eastern sea.
    endCinematic: "sky_fleet",
    next: "prep:b25_fleet_arrival",
    beats: [
      N("The muster bell can be heard forty miles away, and it means one thing: get ready. All night, each village rings its own bell to pass the warning on, until bells are ringing all the way to the mountains."),
      { speaker: "Ndara", portraitId: "ndara", expression: "grim",
        body: "The bells will bring out the farmers. Farmers with pikes have stopped cavalry before. It's in the manuals. (She looks up.) There's nothing in the manuals about that." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "A long time ago, I crossed an ocean none of you know exists. I told myself the sky's colour would be different this time, if it ever came. It is not different. It was never going to be." },
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I've always found an angle. Kings, wardens, Dawn. I could always work out how to play them. (Flat.) I can't find one on this." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Then we stop looking for one. We stand where we said we would: in line at sunrise, between that sky and the villages. It's worked so far." },
      N("At sunrise, something comes down from the sky.")
    ]
  },
  post_fleet_arrival: {
    id: "post_fleet_arrival",
    title: "What Calls Itself Ravage",
    subtitle: "The landing plain, among the fallen wave",
    music: "danger",
    backdrop: "finalBoss",
    next: "prep:b26_coastal_hold",
    beats: [
      N("The first wave lies where it fell, in a curve around the squad's line. The fallen do not bleed. They shut down one by one, and some keep trying to carry out one last order as they do."),
      { speaker: "Leo", portraitId: "leo", expression: "wide-eyed_horror",
        body: "I put three feet of steel through one and it just looked surprised. Not hurt. Surprised. (He laughs, badly.) What do you even do with that?" },
      { speaker: "Khione", portraitId: "khione", expression: "revelation",
        body: "They are named for what they do. The Ravage. They travel from sky to sky, and wherever they land, they work out what it is worth to them. They came to my shore once, before your maps were drawn. Everyone who stood with me there is dead. I am not just old, children. I am the last one left." },
      { speaker: "Selene", portraitId: "selene", expression: "cold_contempt",
        body: "I said that sky would cost us. I hate being right." },
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "The war between the kings ended this morning. They just don't know it yet. Send riders to what's left of Serrick's army. To Halden. To my father, if he'll read it. As of tonight, crowns don't matter. There's only one war now." },
      N("High in the east, the second wave is already coming down, glowing hot. It is not heading for the plain. It is heading for the sea.")
    ]
  },
  post_coastal_hold: {
    id: "post_coastal_hold",
    title: "Salt and Rust",
    subtitle: "The dune line, morning",
    music: "sadness",
    backdrop: "cliffs",
    next: "prep:b27_orbital_descent",
    beats: [
      N("Morning on the dune line. The coast guns still steam where their crews poured seawater down the barrels. The tide keeps bringing in pieces of the second wave, slow and steady."),
      { speaker: "Ning", portraitId: "ning", expression: "exhausted",
        body: "My bowstring went in the surf again. Third one this week. Ranatoli just splices them now, before I ask. (She turns a shell over in her fingers.) I didn't thank him. He knows." },
      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
        body: "We bleed together or we feast together. Anything in between is shame. Tonight, for once, we get to do both. Somebody find whatever passes for wine on this beach." },
      { speaker: "Corin", portraitId: "corin", expression: "quiet_grief",
        body: "Horses won't charge surf. We dismounted and held, the way Rose used to. (He works a buckle loose.) The horse forgave me around midnight." },
      { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
        body: "Look at the pattern, not each wave. They test us, work out what we're worth, then send more. They're not really fighting yet. They're still sizing us up. The next thing down won't be a wave. It'll be whoever's in charge." },
      N("She is proved right before midnight. The landing field lights up again, and a single craft comes down with an escort. It takes its time.")
    ]
  },
  post_orbital_descent: {
    id: "post_orbital_descent",
    title: "Seen",
    subtitle: "The scarred plain, after the Herald",
    music: "death",
    backdrop: "finalBoss",
    next: "prep:b28_path_final",
    beats: [
      N("The Herald pulls back in good order and takes its dead with it. The Ravage have never done that before. The wrecks of the first two waves are still lying on the plain where they were left."),
      { speaker: "Veya", portraitId: "veya", expression: "grim_resolve",
        body: "It blocked four of my seven colours before it pulled back. That wasn't armour. It was studying my light while I was cutting into it." },
      { speaker: "Khione", portraitId: "khione", expression: "serene_neutral",
        body: "It looked at you and did not laugh. When a Herald stops laughing, it means they no longer think your shore will be easy to take. They will want to bargain. The flagship will come down to do that in person." },
      { speaker: "Leo", portraitId: "leo", expression: "resolute",
        body: "Good. I'm sick of being tested by things with no faces. Let it land where I can reach it." },
      { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
        body: "It'll land on the processional. Of course it will. (He checks the edge on his blade.) Fine. Then that's where we finish it." },
      N("Above the city, engines change pitch. Something the size of a district begins, very slowly, to come down.")
    ]
  },
  post_path_final: {
    id: "post_path_final",
    title: "The Sky Withdraws",
    subtitle: "The processional, in the lifting shadow",
    music: "emotional",
    backdrop: "finalBoss",
    // "ending" resolves the saved war path into its post_ending_* coda —
    // this shared scene is where all five wars converge one last time
    // before diverging into their endings.
    next: "ending",
    beats: [
      N("The fighting ends on the marble processional, where the whole story started. One body lies at the end of the road, and the squad is still standing in the shadow of the grounded flagship."),
      N("Then the shadow moves. The flagship's engines change pitch, and it starts to rise. Across the sky, the rest of the fleet leaves the way it came, without a word. The Ravage never surrenders. It has decided this shore would cost too much to take."),
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "They ran the numbers and walked away from the deal. (She's quiet a moment.) Twenty years of being somebody's asset. And the first valuation I'm actually proud of says we're not worth the trouble." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "My shore burned because it was easy to take. Yours held because you made it hard. Every bell, every barricade, every name chalked on a door. Teach your children why. I never had the chance." },
      N("Nobody has moved off the marble. The squad is still standing in a rough half-circle with their weapons up, eight people waiting for the next attack to come down the processional."),
      N("Nothing comes. It takes them a long time to believe it."),
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "(She has not lowered the bow.) There's more. There's always more, there's another wave, there's — (She stops. She makes herself look at the empty road. Her arm comes down very slowly.) ...Oh. Oh, that's it. That's actually it." },
      { speaker: "Ranatoli", portraitId: "ranatoli",
        body: "(He sits down on the marble, all at once, the shield across his knees.) Forgive me. My legs have figured it out before the rest of me has." },
      { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
        body: "(He brings Ash down the processional at a walk and doesn't dismount, because he's not sure he can yet.) Sky's empty. I've been checking it every eleven seconds for two years and it's — there's nothing in it. Just sky. (His voice cracks on the last word and he pretends it didn't.)" },
      { speaker: "Corin", portraitId: "corin", expression: "quiet_grief",
        body: "(He unpins the silver rose and holds it for a long moment.) Rose was fourth up the gangway at Othren. She would have wanted to see the sky do that. (He pins it back on.) That is all. That is all I ever wanted to be able to say about her." },
      { speaker: "Selene", portraitId: "selene",
        body: "(She stands at Amar's shoulder, where she has stood since he was nineteen and it was her job.) For eleven years I've watched the door behind you. Now there's no door to watch. Amar, I don't know what to do with my hands." },
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral",
        body: "Two empires fell and left their armies behind. Remnants, deserters, strays. None of it is a war anymore, Captain. It's work for garrisons and grain carts, and the west has both again. Stand the squad down." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(He looks down the line at all eight of them, still standing, nobody quite ready to move.) Then that's it. That's all of it. (Quietly.) Let's go home." },
      N("As soon as Amar says 'home', it sounds wrong to him, and to everyone else. None of them has had a home since Thuling, and none of them is sure where home would even be."),
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "(He tries again, and this time he says it to them instead of to the road.) I don't know where it is yet. I know who's going to be there. That's enough. That's more than the seven of them ever offered me." },
      N("There is a gap in the line where Lucian should be standing, and there has been for a long time. Amar looks at the empty spot. He says nothing, and every one of them knows what he is thinking."),
      N("Nobody moves for a while. Then Ranatoli laughs, the big laugh he had before the cells, and someone else joins in. The war is over.")
    ]
  },
  // ═══════════ Post-credits: the small job, and the road after ═══════════
  // Reached from CreditsScene on a finished war path. The war is a year
  // gone; this is what it bought. before_epilogue frames the morning,
  // post_epilogue is Khione on the road with the invitation to walk one
  // of the lives Amar didn't pick.
  before_epilogue: {
    id: "before_epilogue",
    title: "One Last Morning",
    subtitle: "A year on, a road that belongs to the people on it",
    music: "everydayLife",
    backdrop: "farmland",
    next: "prep:b29_epilogue",
    beats: [
      N("A year has passed since the war ended. The roads got fixed in the order people needed them: fast, and badly. The squad is scattered across three provinces. They get back together for weddings, harvests, and — twice now — arguments about a bridge."),
      N("Ning is rebuilding the rivet press at Thuling and writes letters full of measurements. Leo and Ash fly the coast for weeks at a stretch and come back sunburnt. Ranatoli has found four separate towns willing to feed a man for a story. Nobody is a soldier this year. Everybody still comes when a letter goes round."),
      N("The letter comes from a smallhold, a little farm two days east. Six or so bandits have camped across its road. The family has lived on its last stores for eleven days. They are sorry to ask. They did not know who else to write to."),
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "(He reads it twice, mostly for the pleasure of it.) They apologized. In writing. For asking soldiers to deal with bandits. (He folds it.) Saddle up. We're going to go be extremely useful for one morning." },
      N("They ride out at first light and take all day over a road they would have covered by noon two years ago. Nobody says why. There is no column behind them and nothing on the horizon. After a while, they even stop checking it out of habit."),
      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
        body: "Six bandits and a farm road. (He swings the shield onto his back, very pleased.) Do you know what I'd have given, in the cell, to be told this was the worst thing left?" },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "They've got a bell at the gate — I can see it from here. (She's already planning the approach.) Fence line, open ground, six of them, and every one with their back to a field they don't know. Amar, this is going to take about ten minutes." },
      N("The smallhold comes into view through the last of the morning mist: a bell, a barn, a fenced kitchen garden, and six bandits who have no idea who just came up the road.")
    ]
  },
  post_epilogue: {
    id: "post_epilogue",
    title: "The Road Back",
    subtitle: "Afternoon, somewhere between the smallhold and home",
    music: "emotionalLife",
    backdrop: "farmland",
    next: "another_path",
    beats: [
      N("The family pays them in bread, apples, and a jar of something the old woman insists is medicinal. The squad walks home west in the late afternoon light. For a while nobody has anything urgent to say, and that is a nice change."),
      WED("selene", { speaker: "Selene", portraitId: "selene",
        body: "(She walks on his left, where the light is.) Rabbit went through here this morning. Fox after it. Owl after the fox." }),
      WED("selene", { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "And after the owl?" }),
      WED("selene", { speaker: "Selene", portraitId: "selene",
        body: "Us. Going home." }),
      WED("corin", { speaker: "Corin", portraitId: "corin", expression: "resolute",
        body: "March order, home. (He falls in at Amar's shoulder, half a step back, where he has always walked.) You have point. I have your back." }),
      WED("corin", { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "You've had it the whole time." }),
      WED("corin", { speaker: "Corin", portraitId: "corin", expression: "resolute",
        body: "(His formal voice slips.) I know. I'm not giving it back." }),
      WED("ning", { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "(She's carrying all the apples, because she counted them and she's fastest.) Seventeen. That's three each and two over. The two over are ours. I've decided." }),
      WED("ning", { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Which two?" }),
      WED("ning", { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "The best two. I've been watching them since the smallhold." }),
      WED("leo", { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
        body: "(Walking, for once, with Ash ambling behind them like a very large dog.) I could fly us home in ten minutes." }),
      WED("leo", { speaker: "Amar", portraitId: "amar",
        body: "We're walking." }),
      WED("leo", { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
        body: "I know. (He takes Amar's hand.) I only offered so you'd say that." }),
      WED("maya", { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "Bread, apples, one jar of something medicinal. (She's already pricing it.) And one morning with you that nobody tried to end. Best deal I've ever made." }),
      WED("maya", { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "You're keeping a ledger on the honeymoon." }),
      WED("maya", { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "I'm keeping a ledger on everything. (She doesn't let go of his arm.) This page is the good one." }),
      WED("veya", { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
        body: "The sun's about four degrees off the water. (She glances at him.) Eleven minutes until the light's perfect. We'll be on the cliff in ten. I timed the walk." }),
      WED("veya", { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Of course you did." }),
      WED("veya", { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
        body: "One minute's margin. For you to stop and look at me the way you do. I've measured that too." }),
      WED("ndara", N("Ndara is waiting at the last milestone with two horses and the ledger under her arm, closed. Nobody has ever seen it closed.")),
      WED("ndara", { speaker: "Ndara", portraitId: "ndara", expression: "commanding",
        body: "Report." }),
      WED("ndara", { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Returned intact." }),
      WED("ndara", { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral",
        body: "(She looks him over, once, the way she inspects a line.) Approved." }),
      N("Someone is waiting at the crossroads. She has waited at a lot of crossroads over the years, and she has not aged a day since the sea crossing."),
      { speaker: "Khione", portraitId: "khione", expression: "serene_neutral",
        body: "Your highness. (She falls in beside him as if she has been walking there all afternoon.) Bread and apples, and a road with nothing dangerous on it. I have crossed one more ocean than any of you knew existed, and this is the first time I have envied what someone else was carrying." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "You're welcome to an apple, Khione." },
      { speaker: "Khione", portraitId: "khione", expression: "ancient_sadness",
        body: "(She takes one.) I have watched more than one shore make this choice. It never goes the same way twice, and the people left standing at the end are never the same. That is what keeps me sailing." },
      { speaker: "Khione", portraitId: "khione", expression: "revelation",
        body: "Once, there was a man in a ship's hold counting seven names. He chose one, and this is where it led. (She nods at the road, the bread, the company.) The other six did not disappear when he chose. They just were not his anymore." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "...You're asking me if I regret it." },
      { speaker: "Khione", portraitId: "khione", expression: "serene_neutral",
        body: "No. I am telling you the other paths are still there, and I can take you to any of them. (She glances at him sideways.) If you ever wish to see who you would have been, I keep a ship. It costs nothing. Say the word, and we are back in that hold, three days out." },
      N("She does not press it, because she never presses anything. She eats the apple, tells Leo his dactyl is getting fat, and walks with them until the smallhold's lamps are out of sight behind them."),
      N("At the bottom of the hill, the road forks."),
      HOME("selene", "By sunset they're home, on the cliff where he held out the ring. For once, Selene isn't watching the treeline. She watches the sun go down instead, and neither of them says anything."),
      HOME("corin", "By sunset they're home, on the cliff where he held out the ring. Corin stands the evening watch beside him out of habit, but within a quarter of an hour he forgets to keep watch and just stays there with him."),
      HOME("ning", "By sunset they're home, on the cliff where he held out the ring. Ning eats the best apple and gives him the other best one. She starts counting something as the sun sets over the water, loses count, and doesn't start again."),
      HOME("leo", "By sunset they're home, on the cliff where he held out the ring. Ash sleeps in the long grass behind them. Leo, for once, doesn't make a joke. He just holds on to Amar."),
      HOME("maya", "By sunset they're home, on the cliff where he held out the ring. Maya closes the ledger. Today's entry is only one line long. She doesn't let him read it, and he doesn't ask."),
      HOME("veya", "By sunset they're home, on the cliff where he held out the ring. The light is perfect at exactly the minute she said it would be. Through the lens in his ring, it looks warmer at one edge, the way it always does."),
      HOME("ndara", "By sunset they're home, on the cliff where he held out the ring. Ndara has left both horses at the gate and the ledger in the saddlebag. There is nothing left to sign. They watch the sun go down, with nowhere else they need to be.")
    ]
  },
  post_ending_vengeance: {
    id: "post_ending_vengeance",
    title: "The Emptied List",
    subtitle: "The canyon rim, one year later",
    music: "emotionalLife",
    backdrop: "cliffs",
    next: "romance",
    beats: [
      N("They go back to the canyon where the first person on the list died, because Maya says a list should be finished where it was started."),
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "Every name's crossed off, and I'm still angry. Selene warned me about that too, in her way. She just never told me what to do with what's left over." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "You put it down, the same as a sword. (She finally burns the list, and the wind carries it off.) There. It's allowed to just be over, Amar. Come home." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(He watches the last of the paper go over the rim.) I thought there'd be a moment where it was finally settled and I'd feel it. There wasn't one. It just stopped hurting one morning, and I didn't notice which one." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "That WAS the moment. (She takes his arm.) You wanted some kind of proof. Nobody gets that. You just get one morning where you forget to be angry, then another one, and eventually that's your life." },
      N("The kings are gone, and so is the fleet. Amar spends most summers fishing with Leo on the coast. Most nights, he sleeps well enough."),
      N("Amar got his revenge, and in the end it gave him the same thing every other path could have: an ordinary life. Most mornings, that is enough for him.")
    ]
  },

  post_ending_restoration: {
    id: "post_ending_restoration",
    title: "The First Harvest",
    subtitle: "A road in Anthros, in autumn",
    music: "emotionalLife",
    backdrop: "farmland",
    next: "romance",
    beats: [
      N("The war ends and the paperwork begins. Amar finds out Lucian was right about this too: nobody cheers for slow work, but it lasts."),
      { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
        body: "The Thuling road's open the whole way through. First grain caravan ran it last week with no escort. (He can't stop grinning.) No escort! Nobody even thought about it until afterward. That's the part I keep laughing at." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "(He weighs a grain sack the way Lucian used to, and sets it down gently.) He'd have kept walking this road forever, Leo. So we will." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Eleven years ago, seven men decided a whole country should be built around me. (He hands the sack down the line. Somebody takes it and passes it on.) Turns out a country is just this. People handing each other sacks down the road, for years, with nobody watching." },
      N("There is no coronation. There is a school in the forge's old building, and a woman teaching letters in it, and a bell that rings for lessons now."),
      N("Rebuilding is the longest and least heroic of the paths, and it is the only one that ends with something just getting started. The free state of Anthros raises its first flag in spring. Nobody important is on the platform, and that was the idea.")
    ]
  },

  post_ending_revolution: {
    id: "post_ending_revolution",
    title: "No Thrones",
    subtitle: "The processional, reclaimed by grass",
    music: "emotionalLife",
    backdrop: "grude",
    next: "romance",
    beats: [
      N("They bury Madame Dawn on the marble where she planned to be crowned. Amar, her son, chooses the spot. To him, putting a grave where a throne would have been is what the revolution was for."),
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "She asked me to make everything it cost worth it. (He leaves the grave unmarked.) A headstone turns into a shrine, and a shrine turns into a throne. So, no kings. Not even dead ones. Not even her." },
      { speaker: "Maya", portraitId: "maya", expression: "tearful",
        body: "The councils are holding. Grude, Anthros, the coast towns. They argue about everything and nobody kneels. It's ugly, it's loud, and it works. She'd have hated how well it works." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(He stays at the grave after the others have gone, longer than is sensible.) She was right about the power vacuum. She was right about everything except one thing. (Very quietly.) It didn't have to be you, mother. You just couldn't stand letting it be anyone else." },
      N("He comes down from the marble at dusk. He never talks about that day again, except once, to the person who waits for him at the bottom of the steps as long as it takes."),
      N("The revolution builds no statues. Instead, in every hall, the spot where a high seat used to be is kept empty on purpose."),
      N("Grass covers the processional within three summers. Children play on the marble. None of them can name a king. Maya had planned this since before she met Amar. She says it is the only win she ever wanted all the way.")
    ]
  },

  post_ending_duty: {
    id: "post_ending_duty",
    title: "The Officer Who Reads",
    subtitle: "A garrison desk, early",
    music: "emotionalLife",
    backdrop: "study",
    next: "romance",
    beats: [
      N("Amar stays in the new army. He turns down the crown every year. Instead he is the officer whose signature means an order has been read, its cost checked, and its facts confirmed."),
      { speaker: "Amar", portraitId: "amar", expression: "resolute",
        body: "Khonu's whole doctrine was one line: read the list before you sign it. (He signs one; declines another; files the reasons.) Nobody teaches the part about the reasons." },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "Your fourth batch of lieutenants graduates tomorrow, captain. They all quote you. Badly. (She grins.) 'The report and the truth should be the same document.' They think you made it up under fire. I never correct them." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(He looks at the stack, then out the window, and the honest answer slips out.) Some mornings I'd give it all up for one week of not being the one every list goes through. (He pulls the next one toward him anyway.) Then I remember what happened when the person it went through didn't read it." },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "So say that part to the lieutenants too. (She sets a cup down right on his paperwork, on purpose.) 'It is heavy and I do it anyway' is a better lesson than any of the neat ones, captain. Also, drink that. You're no use to the order dead." },
      N("The army he serves isn't perfect, and every year he has to accept a few more compromises. But it burns no towns, because every order has to cross his desk, and he reads them all."),
      N("Of the five wars, the duty path ends the most quietly. The work never really stops. Amar reads every list, one at a time, and signs his own name to each one. It costs him, but less than he feared.")
    ]
  },

  post_ending_mercy: {
    id: "post_ending_mercy",
    title: "The Surrendered Sword",
    subtitle: "A ward that used to be an armoury",
    music: "emotionalLife",
    backdrop: "monastery",
    next: "romance",
    beats: [
      N("The King is alive. That news does more than any battle did. Every garrison that hears it surrenders sooner."),
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "My father grows vegetables at the coast fort. Under guard. Badly. He writes me letters about soil. I answer them. Nobody warned me about the letters." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "The surrendered sword hangs over the ward door, hilt out, where every wounded soldier from both armies can see it on the way in. Nobody has taken it down in four years, Amar. Nobody's even touched it." },
      { speaker: "Amar", portraitId: "amar", expression: "guarded",
        body: "People ask me if I forgave him. (He watches the ward, not the sword.) I didn't. I don't think I ever will, and I've stopped waiting to. I just decided the world shouldn't have to pay for what he did to me. Those turned out to be two different things." },
      N("Years later, those words are carved over the ward door by people who were not there and did not ask his permission. He complains about it every time he visits. He has never once had them taken down."),
      N("Slowly, the wards empty out. Imperial sergeants teach rebel farmhands to set bones. People complain about the porridge in two different accents."),
      N("Amar chose mercy and kept to it until the end. What he leaves behind is a ward door that people still walk through, a sword nobody needs anymore, and a war that is truly, boringly over.")
    ]
  },

  // ═══════════ Romance codas ═══════════
  // Reached from RomanceScene after a war path's ending. One arc per
  // partner (each partner appears on 1-3 paths — see data/romance.ts)
  // plus the walking-on-alone coda. All close to credits, all scored by
  // the shared ending texture.

  wed_selene: {
    id: "wed_selene",
    title: "Out Loud",
    subtitle: "A headland over the sea, the war a year quiet",
    music: "emotionalLife",
    backdrop: "cliffs",
    next: "story:where_they_went",
    beats: [
      N("A headland over cold water, a year after the war ended. Selene watches the horizon out of habit. Nothing out there is hunting either of them anymore, but neither of them fully believes it yet."),
      { speaker: "Selene", portraitId: "selene",
        body: "On the crossing you heard me talking in my sleep. Don't, don't, don't. You never asked what it meant... It didn't mean don't go. It meant don't die where I can't see it. I've loved you for ten years without saying it. That's how I am. I'm told people say it out loud." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Then here's my counter-offer. Stay where I can see you. Every morning. Say it out loud once a year and that'll be plenty for me. Marry me." },
      { speaker: "Selene", portraitId: "selene", expression: "breaking",
        body: "...Say it out loud, he says. As if I crossed an ocean and half a war for the scenery. (She takes his hand.) Yes. Out loud: yes." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(It takes him a moment.) On the ship I used to wake up and lie there hoping you'd say one more word. You just said four. I'm going to need a minute." },
      { speaker: "Selene", portraitId: "selene",
        body: "Take the minute. (She looks back at the horizon, but leans her shoulder against his.) I'm not going anywhere. First time I've ever said that and meant it." },
      RING("selene", "That evening, on the same headland, the sun sets over the sea, and for once Selene watches the sunset instead of the horizon. Amar holds out his hand. In it is a ring, the first thing he has ever given her that she didn't have to track down."),
      N("They marry on the headland with the squad standing in a half-circle and no officials within forty miles, which suits everyone. Ranatoli cries and claims it is the wind.")
    ]
  },
  wed_corin: {
    id: "wed_corin",
    title: "The Account, Closed",
    subtitle: "The cavalry camp at first frost",
    music: "emotionalLife",
    backdrop: "field_night_camp",
    next: "story:where_they_went",
    beats: [
      N("First frost. The war is over, but the cavalry camp still keeps its rotation because they like it: feed, tack, watch, sleep. Corin stands the last watch himself, as he has since the quay at Grude. These days Amar stands it with him."),
      { speaker: "Corin", portraitId: "corin", expression: "quiet_grief",
        body: "The night I crossed Othren's line, I told you the account was open. (He unpins his sister's silver rose clasp.) I've thought about it a lot since. It was never a debt, Amar. After Rose, I had nothing left but this, and I needed someone to give it to." },
      { speaker: "Corin", portraitId: "corin", expression: "resolute",
        body: "Eseldras give this to family. There are no Eseldras left to give it to. So either it goes in the ground with Rose, or (he pins it to Amar's collar, hands steady) there are more Eseldras. Your call, Captain. I've made mine." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Whoever's awake, you're witnesses. I'm marrying the last of the Eseldras. And we're keeping the rotation. Feed, tack, watch, sleep. Him and me on every watch that matters." },
      { speaker: "Corin", portraitId: "corin", expression: "torn",
        body: "(His hands are still on the clasp at Amar's collar. For once, he has no idea what to do next.) I drilled a speech for this. A whole month, every word in order. It's gone. All of it." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Good. Don't go looking for it. (He puts his hand over Corin's, over the clasp, and keeps it there.) Rose got the drilled version of you. I get whatever this is. (Quietly.) I think I got the better posting." },
      RING("corin", "At sunset Amar walks Corin out past the picket lines to the cliffs above the coast. Amar has rehearsed this for a week and forgets every word. He holds out a ring instead. It says everything he meant to say."),
      N("The cavalry marries them at dawn under an arch of lances, because cavalry always makes a show of it. The clasp stays on Amar's collar for the rest of his life. Far away, a plaza is still named after Rose. In the camp, there are two Eseldras again.")
    ]
  },
  wed_ning: {
    id: "wed_ning",
    title: "The Third Round",
    subtitle: "The rebuilt forge at Thuling, festival night",
    music: "emotionalLife",
    backdrop: "farmland",
    next: "story:where_they_went",
    beats: [
      N("The forge is running again. Ning rebuilt the rivet press herself, the first machine in new Thuling. At the opening, she shot the ribbon off the doorway from thirty paces instead of cutting it."),
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "Festival night. Same tavern. This time the third round's mine and nobody overrules me. (She sets the cups down herself.) I held the fence line. I held the wall at Orinhal. I held you upright for half a war. I've earned a round and one speech." },
      { speaker: "Ning", portraitId: "ning", expression: "startled",
        body: "...The thing is. You always know where everyone's going to be before they do. So you already know what I'm about to say. (Quietly, steady.) I'm not the girl from the rivet press anymore. I walked the whole road back here beside you. Marry me, Amar." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "I was going to ask at the fence line tomorrow. You outdrew me again. (He takes her hand across the table.) Yes. And Ning — I knew exactly who was asking." },
      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "(She lets out a breath she has been holding since the second round.) Okay. Okay! (She stands up, sits down, stands up again.) I practiced that speech on the dactyl. Ash liked it. ...You were really going to ask at the fence line?" },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Tomorrow, at first light. I've had the words ready for a month. (He turns over her rough bow hand and just holds it.) The fence line's where I first saw you refuse to miss. It seemed right. This is better." },
      RING("ning", "At sunset Amar takes her out to the cliffs above the coast road, the one stretch of country she never had to rebuild. He holds out a ring. She inspects the setting out of habit, and then forgets to inspect anything at all."),
      N("Lucian's widow Mira dances at the wedding on the foot that never healed straight, because her daughter Tali asks, and nobody in that family can say no to Tali. At midnight Lucian's anvil rings once, with no one near it. Everyone in Thuling takes it as his blessing.")
    ]
  },
  wed_leo: {
    id: "wed_leo",
    title: "The Coast",
    subtitle: "A cliff runway at sunrise, Ash saddled for two",
    music: "emotionalLife",
    backdrop: "cliffs",
    next: "story:where_they_went",
    beats: [
      N("When the war ended, Leo said he and Ash were going to fly the coast. He has put it off for a year, one excuse at a time, and every excuse has been Amar."),
      { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
        body: "You've been hearing it wrong for a year, you know. I said we're going to fly the coast. You assumed I meant Ash. Ash assumed I meant you. One of the three of us is smart, and it's the dactyl." },
      { speaker: "Leo", portraitId: "leo", expression: "ready",
        body: "My father gave me a list of what my life was going to be. I flew off the other way, and found you instead. (He pats the saddle.) I've got two rings in my jacket and one runway. Get on the dactyl, Amar. Marry me somewhere nobody owns." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "You've proposed for a year and called it travel plans. (He swings up behind him.) Yes. Fly. And Leo — tell Ash he was right." },
      { speaker: "Leo", portraitId: "leo", expression: "wounded_pride",
        body: "(For once in his life he doesn't have a line ready. He covers by checking a strap that doesn't need checking.) I was so sure you'd laugh. I had a whole bit ready in case you laughed. I don't know what to do with yes." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Fly. That's what we do with yes. (He locks his arms around him as Ash opens her wings.) And Leo, I heard you right the first time. A year ago. I was just waiting for you to realize what you'd said." },
      RING("leo", "The sun goes down over the cliff runway. Leo stays in the saddle; he has never quite trusted the ground. Ash pretends not to watch. Amar holds out a ring. Leo has had a joke ready for everything since the day they met. He does not have one for this."),
      N("They marry each other in the air over open water. It isn't legal anywhere, but they consider it binding. They reach the end of the coast before the morning is over. Ash, for the record, thinks it was overdue.")
    ]
  },
  wed_maya: {
    id: "wed_maya",
    title: "Off the Books",
    subtitle: "The marble, one year into the republic",
    music: "emotionalLife",
    backdrop: "finalBoss",
    next: "story:where_they_went",
    beats: [
      N("The republic is a year old. The marble where Dawn meant to be crowned holds her grave instead of a throne. Amar and Maya, who made that decision, stand beside it. The first year's accounts balance, and there is nothing left to burn."),
      { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
        body: "I reported on you for eleven years. Every grip you corrected, every night you didn't sleep, every kind thing you did when you thought nobody was watching. Dawn got all of it. ...Almost all. One line item I kept off the books, in every single report, for years." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Then file it now, officer. The republic keeps honest ledgers. Say it on the record, Maya. I've been waiting to countersign longer than you've been hiding it." },
      { speaker: "Maya", portraitId: "maya", expression: "tearful",
        body: "For the record, then. (She doesn't look up.) I fell in love with you. Somewhere around the third report. I stayed in love through the lie, the quay, the war. Nobody ordered it, and I didn't plan it. (Her voice steadies.) End of entry. Marry me and countersign." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "(He signs slowly.) You watched me for eleven years, so you already know I don't have a speech. Here's the whole entry: you're the first person who ever saw all of it and stayed. Countersigned." },
      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "(She reads the line twice. She has never needed to read anything twice before.) Filed. (Her voice cracks.) Dawn taught me every kind of watching except this one. I'm glad there was one I had to learn on my own." },
      RING("maya", "At sunset Amar takes her up to the cliffs above the harbour, where no one has ever reported on anyone. He holds out a ring. This is the one thing neither of them will ever put in a report."),
      N("They marry on the marble with the whole squad as witnesses and no crown within a thousand miles. The two chairs at the head table are exactly the same height. Dawn planned everything, but she never planned for this, and it is a good ending.")
    ]
  },
  wed_veya: {
    id: "wed_veya",
    title: "The Forty Minutes",
    subtitle: "The workshop with the good bench, after the war",
    music: "emotionalLife",
    backdrop: "study",
    next: "story:where_they_went",
    beats: [
      N("Veya finally has a workshop with a proper bench. She grinds lenses for lighthouses now, glass made only to help people see what's coming. On the good bench, under a cloth, is something small she has remade nine times. For Veya, that means she is nervous."),
      { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
        body: "Nobody at court ever stayed past five minutes. Ning once stayed forty. You've stayed four years. (She wipes her hands, needlessly.) I know what the numbers say that means. I re-ran the math nine times anyway." },
      { speaker: "Veya", portraitId: "veya", expression: "grim_resolve",
        body: "(She uncovers it: a ring, bronze and glass, a lens no wider than a fingernail where a stone would sit.) There's a flaw, lower left. I left it in on purpose. It marks the day you decided to stay. (Fast, before she can stop herself.) Marry me and I'll grind you true glass for the rest of my life." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Yes. (He puts it on.) And the flaw stays. It's the truest thing anyone's ever made me." },
      { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
        body: "(She checks the fit against his knuckle, entirely to have something to do with her hands.) Two-millimeter tolerance. It'll spin a little in winter — fingers shrink in the cold — (she stops herself). You said yes. ...You said yes, and I'm explaining shrinkage." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Keep explaining. I could listen to the whole tolerance table tonight. (He closes her hand in both of his, over the ring.) Forty minutes was the number, right? Ask Ning what mine is someday. I stopped counting the day you aimed the other way." },
      RING("veya", "At sunset, on the cliff above the lighthouse she made the lens for, Amar gives her a ring of his own: plain gold with a sunset stone and no lens at all. It is made to be looked at, not looked through."),
      N("They marry in the workshop because the light is best there. For the rest of his life, the little lens on his hand makes the world look warmer at one edge. He never has the flaw ground out.")
    ]
  },
  wed_ndara: {
    id: "wed_ndara",
    title: "Terms of Service",
    subtitle: "The war office, the last ledger closed",
    music: "emotionalLife",
    backdrop: "field_night_camp",
    next: "story:where_they_went",
    beats: [
      N("Ndara ran the war's supply, signals and rear lines from a chair, as she said she would, and the rear lines never broke. Tonight she closes the last ledger. She squares it on the desk and then, unusually for her, does not stand to leave."),
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral",
        body: "I served Dawn for thirty years. Then the courtyard, the coma, and I woke up on a ship listening to a man count names through a wall. I'd made my choice before I even opened my eyes. I've served two causes, your highness. I'm applying for a third." },
      { speaker: "Ndara", portraitId: "ndara", expression: "commanding",
        body: "Terms of service: the rest of my life. Duties: standing where you stand, at whatever pace the courtyard left me. Compensation: your mornings. Non-negotiable. (She slides the paper across.) Sign or decline, Captain. I have survived worse than a no. But sign." },
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "You wrote it as a commission because just asking is harder for you than thirty years of war. I know that trick. I've used it. (He signs. Both lines.) Accepted, Marshal. Every term. And the compensation clause goes both ways." },
      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral",
        body: "(She folds the signed commission neatly and holds it to her chest a little longer than she needs to.) Thirty years of paperwork. This is the first document I have ever wanted to keep on me. Note for the record: the Marshal is happy. She was not sure that part of her survived the courtyard." },
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "It survived. I watched it survive. (He comes around the desk so she doesn't have to stand.) You held a wall for me before you ever liked me, and you listened through a wall before you ever saw my face. (Quietly.) The mornings are yours, Marshal. All of them." },
      RING("ndara", "At sunset Amar walks her out to the cliffs beyond the war office, past the last sentry post. He holds out a ring, and the woman who signed every order of the war finds there is nothing here to sign. She says yes."),
      N("They marry with full military honors. She pretends she is only putting up with them and secretly keeps every ribbon. Neither of them thinks love is any less real for being written down and signed. To them, it just means they plan for it to last.")
    ]
  },
  end_alone: {
    id: "end_alone",
    title: "The Name, Answered",
    subtitle: "The long table, set for everyone",
    music: "emotionalLife",
    backdrop: "thuling",
    next: "story:where_they_went",
    beats: [
      N("There is no ring. Amar never marries, and his life is no worse for it. His house has a long table, and the squad visits so often that the road to it is worn smooth. There is Ning's chair, Leo's chair, and the one nobody sits in, which was always Lucian's."),
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Seven people decided what I was for, once. The people at this table undid that, one battle at a time. (He fills the empty chair's cup anyway, out of habit.) I never married. But I've never been alone either. Turns out those aren't the same thing." },
      N("The fire pops twice, the way it always did at camp. Somebody laughs in the kitchen. The war is a story now, told slightly differently by everyone who was there, and he loves hearing every version."),
      N("He chose one of the seven names, and he came through it without losing himself. This table is what is left of his old life.")
    ]
  },

  // ═══════════ The closing arc ═══════════
  // Every wedding coda and end_alone route here before the credits. The
  // wedding closes Amar's story; this closes everyone else's.
  //
  // Written partner-agnostically ON PURPOSE: StoryArc.beats is static
  // data with no access to the save, and more importantly every road
  // below has to read true whether or not Amar married that person —
  // Ning rebuilds the press either way. The squad's fates are also the
  // only ones stable across all five war paths; Dawn and Archbold end
  // differently depending on the road, so neither is named here.
  where_they_went: {
    id: "where_they_went",
    title: "Where They Went",
    subtitle: "The years after, one road at a time",
    music: "emotionalLife",
    backdrop: "farmland",
    next: "credits",
    beats: [
      N("The war ended on the day the fighting stopped. For the squad, it ended much later, on the morning they finally went somewhere that was not the front."),
      N("They put it off for a season. Then the roads dried out, and letters started arriving from places that needed workers more than soldiers. One at a time, the squad left."),

      { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
        body: "I am taking the press back. (She says it like a dare. Nobody takes her up on it.) Not the forge — the forge can burn. The PRESS. My father set the rivets on that thing before I was born and I want to hear it run once before I am old." },
      N("She had it rebuilt in fourteen months and running in fifteen. Thuling has a forge again, and an apprentice list two years long, and a foreman who will explain rivet tolerance to anybody who slows down near her. She writes letters full of measurements. Amar answers every one, badly, in the wrong units, on purpose."),

      { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
        body: "Coast survey. Me and Ash and four hundred miles nobody has mapped since the colony. (He is already looking at the sky.) They're calling it work. I would have paid THEM." },
      N("He flies the coast for weeks at a stretch and comes back sunburnt and insufferable, with charts nobody asked for and stories nobody believes until the charts turn out to be right. Ash grows fat and dignified. Neither of them will admit to being the older one."),

      { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
        body: "No plans. (He says it with enormous satisfaction.) I have been told where to stand every day since I was nineteen. I intend to stand wherever there is soup." },
      N("Mostly, he walks. In four provinces, people know his laugh before they know his name. He tells stories about the war badly, on purpose: the parts where he was frightened get longer every year, the parts where he was brave get shorter, and children love him for it."),

      { speaker: "Veya", portraitId: "veya",
        body: "There were nine of us who could cut a lens. (She holds one up to the window, and the light splits through it.) Now there are two. So I am going to teach, and I am going to be bad at it for about a decade, and then there will be nine again." },
      N("The lens school opens in Grude with four students and no roof, and the roof arrives before the fifth student does. She is a difficult teacher and an honest one. Every glass that leaves the workshop is signed on the rim, because she says a thing that focuses light ought to have somebody's name on it."),

      { speaker: "Corin", portraitId: "corin", expression: "quiet_grief",
        body: "(He unpins the silver rose, looks at it a while, and puts it back on.) I keep meaning to stop wearing it. Then I think — Rose would have been insufferable about surviving a war. Somebody ought to be insufferable on her behalf." },
      N("He takes the western roads, the ones the bandits used to control, and patrols them until they are safe and boring. That is all he wants, and he gets it. In parts of that country, people still say 'the rose came through' to mean the trouble is over."),

      { speaker: "Selene", portraitId: "selene",
        body: "I spent ten years watching doors. ...At some point, I'd like to sit with my back to one." },
      N("It takes her three years. The first time she manages it is in a kitchen in the west, one afternoon, with the door behind her and nothing in the world coming through it. She tells no one. Amar, watching from across the room, has the sense to say nothing either."),

      { speaker: "Ndara", portraitId: "ndara", expression: "military_neutral",
        body: "Garrisons and grain carts, Captain. (She is already annotating something.) It is the least interesting work in the world and it is the only reason everything else keeps working. Somebody competent has to want the boring half." },
      N("She wants it. Under Ndara, the west gets granaries before monuments and roads before flags. A standing order in her own hand is posted at every depot: no garrison may take supplies from a town that has not eaten."),

      { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
        body: "I keep starting ledgers and giving up. (She laughs at herself, which she couldn't do at all, once.) Twenty years of counting what things cost. Turns out I have no idea how to work out what they're worth. I'll have to learn it slowly." },
      N("She learns it slowly. She has it worked out by the time it matters."),

      N("And there is a chair at the long table that nobody sits in."),
      { speaker: "Amar", portraitId: "amar", expression: "wounded",
        body: "Lucian died before any of it was decided. Before the paths, before the fleet, before I had a single thing to show him. (Quietly.) Every good order I ever gave came from asking myself what he would've said. That doesn't stop. Nobody warned me it doesn't stop." },
      N("So they keep Lucian's chair and fill his cup. Once a year somebody repeats his old line about grain sacks, and everybody groans. It is exactly the memorial he would have chosen, and exactly the one he would have complained about."),

      { speaker: "Khione", portraitId: "khione", expression: "serene_neutral",
        body: "(At the door, one last time, with the sea somewhere behind her.) I have carried a great many people to the end of their war. Very few of them ever move on afterward. (She inclines her head.) All of you did. I intend to remember that." },

      N("The squad lives across three provinces and gets back together for weddings, harvests, and — twice now — arguments about a bridge. They visit each other so often that the roads between their homes are worn down."),
      { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
        body: "Seven men in a ship's hold decided what I was for. (He looks down the table at every one of them.) I've spent every year since finding out I was for this. It took a war to learn it. I wouldn't have believed it any other way." },
      N("The war is a story now. Everybody who was there tells it a little differently. All of the versions are true, and none of them ends with someone on a throne.")
    ]
  }
};
