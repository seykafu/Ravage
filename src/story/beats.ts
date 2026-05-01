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
    next: "story:before_caravan",
    beats: [
      N("Ndari falls at the gate, holding the line so his sister can run. He goes down still grinning — the kind of grin that meant he had always known the math."),
      { speaker: "Ndari", portraitId: "ndari", expression: "scornful", body: "Tell her I held it. Tell her she owes me a drink." },
      N("Ndara escapes on a Dactyl as the last torches gutter out. Her question stays in the cold air."),
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
      N("On the third afternoon, in the canyon east of Brielwatch, the bowstrings sing.")
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
      N("Eight bodies on the road. The drivers count themselves twice and find themselves still alive both times. The wagons roll on after a brief argument about who pays for the broken axle on the second one."),
      { speaker: "Amar", portraitId: "amar", body: "Maya. The captain — search him." },
      N("She's already done it. The leather ledger is already in her hand. She passes it to Lucian, not to Amar — knowing where the eyes in the squad still settle by reflex."),
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
      N("Selene goes off the bell tower balcony with a coil of rope already in her hand. She does not look back. By the time Leo wheels his Dactyl around to the courtyard, she is gone into the high mist, and the squad is left with five bodies and a question Amar cannot answer in front of the others."),
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
      N("At the Orinhal gate at noon: not a riot but a famine. A hundred unarmed foremen and their families standing between the King's tax detail and the last sacks of winter grain. A green-cloaked column at the far end of the square — Madame Dawn's partisans, sent ahead to hold the line."),
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
      N("Leo doesn't say where he's going. He's back at the campfire by midnight, his Dactyl's mantle freshly painted over with the squad's own colors instead of Fergus's heraldry.")
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
    next: "credits",
    beats: [
      N("They break contact at the ford and ride hard for an hour before stopping. Lucian takes his shirt off in the clearing without asking; the bolt is shallow but the iron has bent. Maya cuts the head out with a knife she didn't say she had until just now. Ning is the one who can't stop watching."),
      { speaker: "Ning", portraitId: "ning", expression: "startled", body: "That bolt was for me. That whole lane. He pushed me into the rock." },
      { speaker: "Lucian", portraitId: "lucian", expression: "dying", body: "(through gritted teeth) The lane was for whoever was standing in it. You were standing in it. Stop apologizing and finish that bandage." },
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
      N("Lucian rides for his house at the edge of Thuling. The rest of the squad packs camp in silence and turns west."),
      N("(End of the playable vertical slice — chapters 1 through 9. The remaining twelve battles are scaffolded — the full story continues through the streets of Thuling, the cliffs of Para, the year of travel in Grude, and the Ravage Fleet at the end of the world.)")
    ]
  }
};
