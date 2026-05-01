import type { ItemKind, MapDef, UnitDef } from "../combat/types";
import { ENEMIES, PLAYERS } from "./units";
import { caravanMap, cliffsMap, dawnBanditsMap, farmlandMap, leavingThulingMap, monasteryMap, mountainMap, orinhalMap, palaceMap, ravineMap, swampMap } from "./maps";
import { MUSIC, type MusicKey } from "../audio/Music";
import type { BackdropKey, BattleId } from "./contentIds";
import { anyOf, defeatUnit, escapeToTile, routEnemies, surviveRounds, type VictoryCondition } from "../combat/Victory";
import type { DialogBeat } from "../story/beats";

// ---- Mid-battle dialogue --------------------------------------------------
// FE-style support conversations that fire mid-fight when specific
// conditions hit. Authoring lives here (per-battle) rather than globally
// for v1 — keeps each battle's beats next to its other content. A
// graduate-to-globally-keyed-supports pass can come later if/when we want
// cross-battle continuity ("this scene fires the first time Maya & Ning
// stand adjacent in any battle").
//
// Trigger kinds:
//   - "round_start" (round N starts) — cinematic, fires once per battle
//     when the round counter reaches N.
//   - "adjacent_eot" (units A & B end turn melee-adjacent) — relational,
//     fires the first time the two named units land next to each other
//     after a turn ends. Either unit being dead suppresses the trigger.
//   - "ally_attacks" (specific ally completes any attack) — reactive,
//     fires the first time the named ally swings (hit, miss, or kill —
//     outcome doesn't matter). Used for "Kian notices Amar's rehearsed
//     technique the first time he picks up a sword in this battle."
//   - "ally_killed_target" (specific ally lands the killing blow on a
//     specific enemy) — payoff, fires inline in the kill resolution path.
//   - "before_victory" — fires after the victory condition resolves to
//     "player" but BEFORE the EndScene transition. The dialogue plays
//     out while the field is frozen; once the player advances past the
//     last beat, BattleScene resumes and routes to EndScene normally.
//     Used for B1's "you killed the guards but reinforcements caught
//     you" capture beat — mechanical victory, narrative defeat folded
//     into the same arc.
//
// Dedup: each dialogue has an `id` that goes into BattleScene.firedDialogues
// (a Set per-battle) so re-entering an already-fired trigger is a no-op.
// IDs are scoped per battle, so collisions across battles don't matter.
//
// Full reference: docs/RAVAGE_DESIGN.md §3.7 "Mid-Battle Dialogue Triggers".
export type BattleDialogueTrigger =
  | { kind: "round_start"; round: number }
  | { kind: "adjacent_eot"; unitA: string; unitB: string }
  | { kind: "ally_attacks"; allyId: string }
  | { kind: "ally_killed_target"; allyId: string; targetId: string }
  | { kind: "before_victory" };

export interface BattleDialogue {
  // Stable identifier within this battle's dialogues array. Used as the
  // dedup key in BattleScene.firedDialogues.
  id: string;
  trigger: BattleDialogueTrigger;
  // Reuses the StoryScene DialogBeat type — same speaker / portraitId /
  // expression / body shape. Pagination (5 lines per page, "More ▾"
  // button) carries over from the StoryScene treatment.
  beats: DialogBeat[];
}

export interface BattleNode {
  id: BattleId;        // typed; new ids must be added to contentIds.ts first
  index: number;       // 1..20+
  title: string;       // "First Battle" / "Battle 2" etc.
  subtitle: string;    // narrative name
  intro: string;       // 80–160 word framing
  outro: string;       // brief post-battle text
  music: MusicKey;
  prepMusic: MusicKey;
  backdropKey: BackdropKey; // typed; the bg_<label> selector resolved by ensureBackdropForKey
  playable: boolean;   // false = placeholder ("not yet playable")
  map?: MapDef;
  buildPlayers?: () => UnitDef[];
  buildEnemies?: () => UnitDef[];
  difficultyLabel: string;
  unlockNote?: string;
  // Win/lose rule for this battle. If omitted, defaults to routEnemies
  // ("kill all enemies, don't die"). Use surviveRounds(N) for defense
  // battles, defeatUnit(...) for boss kills, escapeToTile(...) for breakouts,
  // or compose with allOf/anyOf. See src/combat/Victory.ts.
  victory?: VictoryCondition;
  // Mid-battle dialogues that fire on specific triggers (see
  // BattleDialogueTrigger above). Optional; absence means no in-fight
  // banter. BattleScene checks triggers at well-defined moments
  // (round transitions, end-of-turn, kill resolution) and pauses the
  // scene to launch BattleDialogueScene as an overlay.
  dialogues?: BattleDialogue[];
  // Items granted to the squad pool on victory. Read by BattleScene
  // .checkEnd, minted into the squad inventory just before the
  // post-battle reconciliation, surfaced in EndScene's outro panel as
  // a "Spoils" line. Without this the inventory loop only shrinks
  // (consumables get burned, trading just shuffles), so every
  // playable battle should grant 1-3 thematically appropriate items.
  // Defeat awards nothing.
  rewards?: ItemKind[];
}

export const BATTLES: BattleNode[] = [
  {
    id: "b01_palace_coup",
    index: 1,
    title: "First Battle",
    subtitle: "The Palace Coup",
    intro:
      "Year 2640 of the Anthros Monarch. For ten months you have planned this: storm King Nebu's palace at the heart of Para and end his self-serving rule before the harvest fails again. Tonight your seven comrades are scattered through the back corridors. You and the vanguard reached the throne hall first. Steel in hand. No retreat.",
    outro:
      "The royal guard repels you. You wake without memory in a hospital outside the palace — alive, but a prisoner of your own unfinished work.",
    music: MUSIC.enteringStronghold,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_palace_coup",
    playable: true,
    map: palaceMap,
    buildPlayers: () => [PLAYERS.amarHidden(), PLAYERS.ranatoli(), PLAYERS.selene()],
    buildEnemies: () => [
      ENEMIES.kingNebu(),
      ENEMIES.royalGuard("rg1", 121),
      ENEMIES.royalGuard("rg2", 122),
      ENEMIES.royalArcher("ra1", 123),
      ENEMIES.royalArcher("ra2", 124),
      ENEMIES.royalGuard("rg3", 125),
      ENEMIES.royalGuard("rg4", 126)
    ],
    difficultyLabel: "Grand Engagement",
    // Spoils: 2 potions from the throne-hall medic kits the squad strips
    // off the fallen guards before reinforcements arrive. Modest because
    // narratively the squad is captured immediately after — they don't
    // get to thoroughly loot the room.
    rewards: ["potion", "potion"],
    // Capture beat — fires the moment the player drops the last guard
    // (mechanical victory). The squad believes it's over for one
    // breath, then palace reinforcements pour out from behind the
    // pillars on Amar's blind side. EndScene transition is deferred
    // until the dialogue closes; technically the player still gets a
    // VICTORY screen because the fight was won, but the post_palace
    // arc immediately picks up at the hospital with Amar's amnesia,
    // confirming the squad lost the larger engagement.
    //
    // The four named comrades (Khonu, Tev, Yul, Sera) are the unseen
    // four of the original eight — referenced here once so the player
    // has names to anchor the "seven comrades scattered through the
    // back corridors" framing the script alludes to in pre_palace and
    // post_palace. Their fates are dropped in passing because the
    // squad won't learn the full story for several chapters.
    dialogues: [
      {
        id: "b01_capture",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The last royal guard goes down hard against the third pillar from the dais. The torches gutter once and steady. For one breath the throne hall is silent and the squad believes it is over." },
          { speaker: "Selene", portraitId: "selene", expression: "breaking",
            body: "Amar — the side doors. The SIDE doors, get to —" },
          { portraitId: "narrator",
            body: "Three palace guards step out from behind the second-rank pillars at Amar's blind side. He turns half a second too late. A gauntlet closes around his wrist; another finds his throat. His sword goes out of his hand and he doesn't see where it lands." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "Selene — !" },
          { portraitId: "narrator",
            body: "Ranatoli is already moving. He covers the ten paces between him and Amar in two strides and drives his shield into the closest guard's ribs. Six more guards step out from the corridors he can't see. They take him down on the carpet without a word." },
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "alarmed",
            body: "Hold on — Amar — hold on —" },
          { portraitId: "narrator",
            body: "Selene gets within striking distance of the closest guard before the loop closes around her. Two of them, then four, then her sword arm pinned against a pillar, then her knee folding the wrong way. She does not cry out. Her eyes find Amar's across the hall and she shakes her head once — don't — don't say anything — don't try." },
          { portraitId: "narrator",
            body: "At the south doors: Khonu, who was supposed to hold the threshold, has already been still for several minutes — a crossbow bolt through the lung at the first volley. In the eastern corridor: Yul went down on the stairs, her bow snapped beneath her. In the stables: Tev's mount fell with two arrows in its neck and Tev never made it back to standing. In the kitchens, where she was supposed to come up through the servants' passage with the second wave: Sera. The squad won't know about Sera for a long time." },
          { speaker: "King Nebu IV", portraitId: "nebu", expression: "cruel_amusement",
            body: "Eight of you. Ten months of planning. And it ends with a boy on his knees in MY throne hall, and a ledger entry for the carpenter who'll have to replace my pillars. Get this one out of my sight. The other two go to the cells. We'll decide tomorrow which of them I bother to remember the name of." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(quietly, to no one) ...This was supposed to be the night." },
          { portraitId: "narrator",
            body: "A heavy sack closes over Amar's head. The throne hall vanishes." }
        ]
      }
    ]
  },
  {
    id: "b02_farmland",
    index: 2,
    title: "Second Battle",
    subtitle: "Bandits in the Farmland",
    intro:
      "Bandits attack the farmland outside Thuling. You and the workers you have come to call friends — Lucian the foreman, Ning the bowyer's apprentice — must defend the wagons before Kian's knight arrives. You should not know how to fight this well. You do anyway. Pretend you do not.",
    outro:
      "Lucian hands you a rag for the cut on your hand. He says nothing. The smell of wet hay and iron has unlocked something you cannot afford for him to see.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_farmland",
    playable: true,
    map: farmlandMap,
    buildPlayers: () => [PLAYERS.amar(), PLAYERS.lucian(), PLAYERS.ning()],
    buildEnemies: () => [
      ENEMIES.banditSwordsman("b1", 201),
      ENEMIES.banditSwordsman("b2", 202),
      ENEMIES.banditSpearton("b3", 203),
      ENEMIES.banditArcher("b4", 204)
    ],
    difficultyLabel: "Skirmish",
    // Spoils: 3 potions from the bandit field stash + a Mask the lead
    // raider was wearing as intimidation. First taste of equipment for
    // the player — Lucian or Ning gets a permanent +2 MOV they can lean
    // into for B3.
    rewards: ["potion", "potion", "potion", "mask"]
  },
  {
    id: "b03_dawn_bandits",
    index: 3,
    title: "Third Battle",
    subtitle: "Madame Dawn's Bandits",
    intro:
      "Two days after the wagons. A second wave comes down the eastern road — fewer than the first, better armed, all wearing the same dyed sash on the right shoulder. Word in town calls them \"Dawn's lot,\" after a queen across the sea who lost her land to King Nebu and kept her grudge. Lucian draws the squad up south of the road. Ning checks her draw. A stranger you have not seen before drops in from the orchard at the east flank, watches the line for one breath, and joins it without asking.",
    outro:
      "The stranger introduces herself as Maya — quiet, watchful, with a tactician's eye Ning admires before she has finished her sentence. Lucian says nothing, which is how he says everything. She stays.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: true,
    map: dawnBanditsMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.ning(),
      // Maya joins the squad on this battle. Narratively she "appears
      // mid-fight" (her arrival is dramatized in the b03 intro paragraph
      // and the post arc); mechanically she starts on the field at the
      // east flank, separated from the main squad by the road and wagons.
      PLAYERS.maya()
    ],
    buildEnemies: () => [
      // Dawn's raiders use the same bandit factories as Battle 2 — same
      // mechanical profile, framed as a different faction in the script.
      // A future pass could give them a distinct palette/name; for now
      // the differentiation is purely narrative.
      ENEMIES.banditSwordsman("dawn_sw1", 301),
      ENEMIES.banditSwordsman("dawn_sw2", 302),
      ENEMIES.banditSpearton("dawn_sp1", 303),
      ENEMIES.banditArcher("dawn_a1", 304),
      ENEMIES.banditArcher("dawn_a2", 305)
    ],
    difficultyLabel: "Skirmish",
    // Spoils: 2 potions + a Fang Maya finds in the lead raider's belt
    // pouch. The Fang is a tactician's keepsake — fits her arrival as
    // the squad's new long-game thinker.
    rewards: ["potion", "potion", "fang"],
    // No explicit victory — falls back to routEnemies (default).
    dialogues: [
      // Maya joining the squad — first time she and Amar share an
      // adjacent tile after a turn ends. Maya's first probe of Amar's
      // background; Amar deflects.
      {
        id: "b03_maya_amar_first_recognition",
        trigger: { kind: "adjacent_eot", unitA: "maya", unitB: "amar" },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "Your footwork. You step like a man who learned in a courtyard, not a wagon yard." },
          { speaker: "Amar", portraitId: "amar",
            body: "I learned on the farm. We do wagon-rotation drills." },
          { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
            body: "Sure. I'll let you keep that one for now." }
        ]
      }
    ]
  },
  {
    id: "b04_swamp",
    index: 4,
    title: "Fourth Battle",
    subtitle: "Ambush in the Swamp",
    intro:
      "Three minutes into the marsh the morning sun is gone — swallowed by canopy and standing water. The squad is single file: Maya at point, Amar and Lucian centered, Kian on the right flank in armor that will not stop sounding like itself, Ning watching the rear. The package for the smallholding is in Lucian's saddlebag. The bandits are in the trees on all four sides, and Maya draws first.",
    outro:
      "Lucian invents a story for Kian about reflexes learned on the farm. Kian nods and says nothing. That night by the fire Lucian invents a different story, this one only for you, and then asks you to tell him the true one.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_swamp",
    playable: true,
    map: swampMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.kian()
    ],
    buildEnemies: () => [
      ENEMIES.banditSpearton("amb_sp1", 401),
      ENEMIES.banditSpearton("amb_sp2", 402),
      ENEMIES.banditArcher("amb_a1", 403),
      ENEMIES.banditArcher("amb_a2", 404),
      ENEMIES.banditSwordsman("amb_sw1", 405),
      ENEMIES.banditSwordsman("amb_sw2", 406)
    ],
    difficultyLabel: "Ambush",
    // Spoils: 2 elixirs from the bandit medic's satchel. Bigger heals
    // than potions — the swamp ambush was costly enough that the squad
    // earns the upgrade. No equipment because the bandits travelled
    // light on the road.
    rewards: ["elixir", "elixir"],
    // First battle to use the anyOf combinator. Lore framing: it's an
    // ambush on the road home — the squad doesn't have to wipe the
    // bandits, just survive long enough for the pickets at the keep to
    // notice they're overdue and ride out (modeled as 4 rounds), OR
    // break the ambush by routing the squad outright. Either resolution
    // matches the outro ("Lucian invents a story" — implies they got
    // home, with or without a clean kill count).
    victory: anyOf(surviveRounds(4), routEnemies),
    dialogues: [
      // Kian's suspicion crystallizing. He's been watching Amar since B2;
      // here in the swamp ambush he says it out loud for the first time.
      // Amar deflects by giving Kian a tactical instruction — taking the
      // tactical lead away from "the man who's watching me fight."
      //
      // Trigger fires the first time Amar swings in this battle (regardless
      // of hit/miss/kill outcome) — Kian's "almost rehearsed" comment is
      // reacting to Amar's combat technique, not to spatial proximity, so
      // ally_attacks is the right cue. Earlier version was adjacent_eot
      // which fired only when Kian and Amar happened to stand next to
      // each other; the line landed less reliably.
      {
        id: "b04_kian_amar_test",
        trigger: { kind: "ally_attacks", allyId: "amar" },
        beats: [
          { speaker: "Kian", portraitId: "kian", expression: "knowing_smile",
            body: "You handled that one well, Amar. Almost rehearsed." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Reflex. Kian — eyes left. The archer behind the third tree." },
          { speaker: "Kian", portraitId: "kian",
            body: "...Right. I see him." }
        ]
      },
      // Lucian buffering between Kian and Amar — first time on screen
      // that Lucian openly takes Amar's side without saying so. Kian
      // notices the chain of command isn't where Fergus put it.
      {
        id: "b04_lucian_kian_buffer",
        trigger: { kind: "adjacent_eot", unitA: "lucian", unitB: "kian" },
        beats: [
          { speaker: "Lucian", portraitId: "lucian",
            body: "Kian. Cover the western reed line. Amar takes center." },
          { speaker: "Kian", portraitId: "kian",
            body: "I take orders from generals, Lucian. Not foremen." },
          { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
            body: "Then take this one as a favor. Cover the western reed line." }
        ]
      }
    ]
  },
  {
    id: "b05_mountain_ndari",
    index: 5,
    title: "Fifth Battle",
    subtitle: "The Mountain Bandits — Ndara & Ndari",
    intro:
      "General Fergus has sent your squad against marauders led by a brother and sister: Ndari at the front, Ndara behind him. The village is already ruined. Snow falls on broken roofs. Leo, Fergus's son and a Dactyl Rider, asks to ride with you. Why a father would send his own son into this fight, you cannot guess. Set it aside. Climb.",
    outro:
      "Ndari falls. Ndara escapes on a Dactyl. Her last question — Why are you fighting on Nebu's side? — hangs in the cold air. Lucian sees you flinch. He says nothing tonight, and everything tomorrow.",
    music: MUSIC.strongholdMemories,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_mountain",
    playable: true,
    map: mountainMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      ENEMIES.ndari(),
      ENEMIES.banditSpearton("nd_s1", 501),
      ENEMIES.banditSpearton("nd_s2", 502),
      ENEMIES.banditSwordsman("nd_b1", 503),
      ENEMIES.banditSwordsman("nd_b2", 504),
      ENEMIES.banditArcher("nd_a1", 505),
      ENEMIES.banditArcher("nd_a2", 506)
    ],
    difficultyLabel: "Boss — First Major Threat",
    // Spoils: 2 potions, an Elixir from the village's dispensary, and
    // a Mask Ndari was wearing as a war trophy. The Mask is the second
    // mobility item the squad has — they can equip both on the same
    // unit for +4 MOV (a knight build) or split for two flexible units.
    rewards: ["potion", "potion", "elixir", "mask"],
    // Lore-accurate: "Ndari falls at the gate, holding the line so his sister
    // can run." The player can win by routing the squad if they want, but the
    // intended cinematic ending is to drop Ndari and let the mooks scatter —
    // so victory triggers the moment Ndari falls, regardless of remaining
    // bandits. Demonstrates the new defeatUnit primitive in src/combat/Victory.ts.
    victory: defeatUnit("ndari", { label: "Defeat Ndari" })
  },
  {
    id: "b06_caravan",
    index: 6,
    title: "Sixth Battle",
    subtitle: "The Caravan",
    intro:
      "Two wagons, a routine escort east through the foothill canyons. Grain and steel for a garrison town the squad has never set foot in. Then bowstrings sing from both rim-shelves at once and mounted bandits seal the road behind you, and it stops being a job and starts being a fight that someone planned. The civilian drivers go flat against the wagon wheels. Maya, without being told, takes the south flank as if she has done it a hundred times before. Lucian's eyes tighten. He has seen enough.",
    outro:
      "The road is yours. Two wagons of grain and steel intact, four civilian drivers shaken but breathing. Under the body of the bandit captain Amar finds a leather ledger — columns of route times, payment dates, and a margin note in the King's own accounting hand, the codebook only palace officers know. Someone inside Nebu's court paid for this. The squad keeps the ledger.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_caravan",
    playable: true,
    map: caravanMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Eight-bandit coordinated ambush — same shape as the script: archers
      // perched on both canyon shelves, speartons sealing east, swordsmen
      // pressing west. Levels bumped slightly above b03/b04 mooks to match
      // the post-mountain difficulty curve; Progression.xpRewardFor handles
      // the level-diff scaling so a squad that out-leveled the curve still
      // gets the right reward.
      ENEMIES.banditArcher("crv_a1", 601, 5),
      ENEMIES.banditArcher("crv_a2", 602, 5),
      ENEMIES.banditArcher("crv_a3", 603, 5),
      ENEMIES.banditArcher("crv_a4", 604, 5),
      ENEMIES.banditSpearton("crv_sp1", 605, 6),
      ENEMIES.banditSpearton("crv_sp2", 606, 6),
      ENEMIES.banditSwordsman("crv_sw1", 607, 5),
      ENEMIES.banditSwordsman("crv_sw2", 608, 5)
    ],
    difficultyLabel: "Ambush",
    // Spoils: 2 potions, an Elixir from the wagon stores, and a Royal
    // Lens — the bandit captain's spyglass, which Maya recognizes as
    // royal-issue gear. First Royal Lens drop ties directly to the
    // ledger reveal: the squad now has visible proof their attackers
    // were palace-supplied.
    rewards: ["potion", "potion", "elixir", "royal_lens"],
    // Defaults to routEnemies. The script-mandated outcomes (wagons
    // intact, civilian drivers safe, ledger found) are narrative and
    // resolve in the post arc regardless of damage taken in-fight.
    dialogues: [
      // Maya commanding the south flank — the script's "took command of
      // one flank without being asked" beat made mechanical. Fires at
      // the start of round 2, after the first round's ambush has
      // committed everyone to a position. Marks the moment Lucian
      // realizes Maya's not just a peasant who knows how to fight.
      {
        id: "b06_maya_takes_flank",
        trigger: { kind: "round_start", round: 2 },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "South flank. Lucian, hold the west wagon. Ning, climb the south shelf — the perched archer there is reloading slow, you can take her clean. Amar takes center. Leo, swing wide and break the east seal." },
          { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
            body: "...Confirmed." },
          { speaker: "Amar", portraitId: "amar",
            body: "Maya. Who taught you to read a field like that?" },
          { speaker: "Maya", portraitId: "maya",
            body: "The same person who taught me to keep quiet about it. Move." }
        ]
      },
      // Payoff for the ledger-discovery in the post arc — when Amar
      // personally drops the captain spearton, Lucian flags the body
      // for a search before they lose it. ally_killed_target requires
      // a specific (ally, target) pair, so this only fires if Amar
      // makes the kill on crv_sp1 specifically. Other kill paths
      // don't trigger it; the post arc handles the ledger reveal
      // either way (the post arc fires regardless of who killed whom).
      {
        id: "b06_amar_drops_captain",
        trigger: { kind: "ally_killed_target", allyId: "amar", targetId: "crv_sp1" },
        beats: [
          { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
            body: "Hold up. That one had a leather pouch on his hip — I saw it when he raised his shield. Maya, search him before we lose the body to the road dust." },
          { speaker: "Maya", portraitId: "maya",
            body: "Already on it." }
        ]
      }
    ]
  },
  {
    id: "b07_monastery",
    index: 7,
    title: "Seventh Battle",
    subtitle: "The Ghost from Para",
    intro:
      "Fergus said: raiders, monastery, kidnapped tax collectors, clear it. The squad climbed for two days through the high passes to reach the place. Stone corridors that swallow torchlight. A dry chapel hall. A bell tower with a balcony you can't see the top of. The squad breaches the south gate and starts pushing inward. Then in the inner sanctum, by the altar, the woman leading the raiders looks up — and Amar's whole life since the hospital in Thuling stops mattering for one breath, because her face is on a wanted poster he read a year ago, and her name is Selene, and she was one of the seven.",
    outro:
      "Selene goes off the bell tower balcony rather than be cornered, a rope already coiled across her shoulder, and is gone into the mist before Leo can wheel his Dactyl back around. The raiders break or fall. Lucian fought the whole battle on Amar's blind side, soaking blows meant for the man who was suddenly fighting at half his real strength. He doesn't ask why. Not yet. He waits until the camp fire pops twice.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_monastery",
    playable: true,
    map: monasteryMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Selene as boss; defeating her ends the battle. Per the script she
      // doesn't actually die — the post arc reframes her HP-to-zero as
      // throwing herself off the balcony to escape. Four raiders fill out
      // the chambers around her at slightly higher level than the canyon
      // mooks (these are her hand-picked, not random opportunists).
      ENEMIES.selene(),
      ENEMIES.banditArcher("mst_a1", 701, 6),
      ENEMIES.banditArcher("mst_a2", 702, 6),
      ENEMIES.banditSwordsman("mst_sw1", 703, 6),
      ENEMIES.banditSwordsman("mst_sw2", 704, 6),
      ENEMIES.banditSpearton("mst_sp1", 705, 7)
    ],
    difficultyLabel: "Boss — The Monastery",
    // Spoils: 2 elixirs from the monastery's still-stocked dispensary
    // and a Fang — a relic blade-tooth Selene leaves on the altar
    // before her balcony exit. Narrative tell: she meant for the squad
    // to find it.
    rewards: ["elixir", "elixir", "fang"],
    // Defeat Selene to win — the rest can scatter. Mirrors b05's
    // defeatUnit("ndari") pattern; players who want the cleanest run
    // can dive on Selene early, players who want full XP rout the room.
    victory: defeatUnit("selene_enemy", { label: "Defeat Selene" }),
    dialogues: [
      // Lucian explicitly takes Amar's blind side. Earlier dialogues in
      // b04 had Lucian buffering Kian on Amar's behalf; here, in the
      // monastery, he says it out loud — fight at half strength, I'll
      // cover you. Mirrors the post arc beat where he says it again
      // when Amar finally tells him everything.
      {
        id: "b07_lucian_amar_cover",
        trigger: { kind: "adjacent_eot", unitA: "lucian", unitB: "amar" },
        beats: [
          { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
            body: "Amar. Whatever this is — whatever she is to you — fight at half strength all you need to. I'm on your blind side." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "Lucian — " },
          { speaker: "Lucian", portraitId: "lucian",
            body: "Don't say it tonight. Say it after, by the fire. We've still got a balcony to clear." }
        ]
      },
      // The Amar/Selene moment. First time they've stood face-to-face
      // since the failed coup a year ago. Selene recognizes Amar
      // INSTANTLY and starts to say his name; Amar cuts her off
      // before the squad behind him can hear it. Selene reads the
      // signal in one breath — the year-old reflex of two coup
      // members covering each other's identity at a glance comes
      // back to both of them. Then she falls into the "don't follow
      // me past the bell" line as the larger fight closes around
      // them. Selene's "bell" is the bell tower — she's already
      // planning her exit before the fight is over.
      {
        id: "b07_amar_selene_eyes",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "selene_enemy" },
        beats: [
          { speaker: "Selene", portraitId: "selene", expression: "breaking",
            body: "Am—" },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "Sh!!" },
          { portraitId: "narrator",
            body: "Selene catches it before the second syllable. Her jaw closes. Her eyes finish the sentence she was going to start: *I thought you were dead.* His finish it back: *They have to keep thinking it.* Neither of them moves for a full second. The squad behind Amar hasn't heard a thing." },
          { speaker: "Selene", portraitId: "selene", expression: "cold_contempt",
            body: "(louder, for the room) ...You shouldn't be here, soldier. None of you should." },
          { speaker: "Amar", portraitId: "amar",
            body: "(matching her register) Neither should you, raider. Stand down." },
          { speaker: "Selene", portraitId: "selene", expression: "breaking",
            body: "(quietly again, only to him) Don't follow me past the bell, Amar. Don't make me cut you here in front of the people you've kept alive this year." }
        ]
      }
    ]
  },
  {
    id: "b08_orinhal",
    index: 8,
    title: "Eighth Battle",
    subtitle: "The Town of Orinhal",
    intro:
      "Three days northeast. A mining town that hasn't seen its own gold in a decade. Fergus's orders were clear — disperse the crowd, arrest the ringleaders, restore the King's peace. The squad rides through the gate at noon and finds not a riot but a starving town: a hundred unarmed foremen and their families standing between the King's tax detail and the last sacks of winter grain. Then a green-cloaked column appears at the far end of the square — Madame Dawn's partisans, sent to hold the line for the townspeople. Three forces in the square. Leo dismounts without speaking and walks his Dactyl to the partisan side. The squad follows.",
    outro:
      "The tax collectors break before the squad does. Dawn's lieutenant — a quiet, gray-cloaked woman who introduces herself only as Ndara, not to be confused with the bandit at the mountain village — tells Amar that Madame Dawn has been watching him for a long time, and that she would like to meet him when he is ready. She leaves before Amar can answer. Lucian walks the line of bodies, gathers the squad's share of the recovered tax silver into a leather sack, and distributes it back to the townspeople on the road out.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_orinhal",
    playable: true,
    map: orinhalMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Two royal guards + two crown archers — the King's tax detail
      // proper. Plus three "hired" mid-tier bandits to bulk out the
      // line (the script implies the tax collectors had hired muscle
      // for the inevitable resistance).
      ENEMIES.royalGuard("orn_rg1", 801, 7),
      ENEMIES.royalGuard("orn_rg2", 802, 7),
      ENEMIES.royalArcher("orn_ra1", 803, 7),
      ENEMIES.royalArcher("orn_ra2", 804, 7),
      ENEMIES.banditSwordsman("orn_sw1", 805, 6),
      ENEMIES.banditSwordsman("orn_sw2", 806, 6),
      ENEMIES.banditSpearton("orn_sp1", 807, 7)
    ],
    difficultyLabel: "Choice",
    // Spoils: Royal-issue gear from the tax detail proper. The Royal
    // Lens is the spotter's, the Mask is from the captain's kit. The
    // squad now has TWO royal-issue items — visible material proof
    // they're fighting the King's own forces, not bandits.
    rewards: ["royal_lens", "mask", "potion"]
    // Defaults to routEnemies. The Ndara meeting + silver
    // distribution fire in the post arc regardless of damage taken.
  },
  {
    id: "b09_ravine",
    index: 9,
    title: "Ninth Battle",
    subtitle: "The Price of Doubt",
    intro:
      "Word of Orinhal reaches Thuling faster than the squad can. Fergus dispatches them again before they can even report — a bandit column moving on a border village, intercept and destroy. The coordinates are a trap. The \"bandit column\" is a King's regiment dressed in commoners' clothes, waiting in a narrow ravine with prepared archer positions on the high ground and a river bottleneck cutting off the south retreat. The squad takes fire from three directions inside thirty seconds. Maya's mouth is set in a line none of them have seen before.",
    outro:
      "Lucian takes a crossbow bolt to the shoulder pulling Ning out of an archer's lane and keeps fighting the rest of the engagement on one good arm. By the time the squad breaks contact and clears the ravine, three things are clear: Fergus knew about the original coup all along; he has been deliberately sending the squad into harder and harder missions; and Maya is no longer pretending. She speaks for the first time as herself, not as a peasant from the eastern farmland — she was planted in the squad by Madame Dawn months ago, and Dawn is ready to bring them in from the cold. Staying in Thuling another night would be suicide.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_mountain",
    playable: true,
    map: ravineMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Elite King's regiment, level-bumped to reflect "these are the
      // best Fergus could marshal on short notice, posing as bandits."
      // Mix of crown archers entrenched on high ground + royal guards
      // holding the line + two "bandit" swordsmen pressing forward
      // (the disguise muscle).
      ENEMIES.royalArcher("rav_ra1", 901, 8),
      ENEMIES.royalArcher("rav_ra2", 902, 8),
      ENEMIES.royalArcher("rav_ra3", 903, 8),
      ENEMIES.royalGuard("rav_rg1", 904, 8),
      ENEMIES.royalGuard("rav_rg2", 905, 8),
      ENEMIES.banditSwordsman("rav_sw1", 906, 7),
      ENEMIES.banditSwordsman("rav_sw2", 907, 7)
    ],
    difficultyLabel: "Survival",
    // The script frames this as "survive long enough to break contact
    // and escape the ravine." Two paths to victory: rout the regiment
    // OR get any player unit to the south escape gap (row 13). The
    // surviveRounds(5) fallback covers the "we held them off long
    // enough for them to break off the pursuit" reading.
    victory: anyOf(
      surviveRounds(5),
      escapeToTile({ x: 6, y: 13 }, { label: "Escape south through the ford" }),
      routEnemies
    ),
    // Spoils: 2 elixirs (Lucian needed them just to walk out of the
    // ravine), 2 royal lenses stripped from the elite crown archers'
    // kits, and a Fang Maya retrieves from the lieutenant's body —
    // turns out to be Dawn-issue, an early hint that not all the
    // "regiment" was royal. Strong loadout for the final B9 → endgame
    // gap because the squad's about to be on the run with no
    // restock for several chapters.
    rewards: ["elixir", "elixir", "royal_lens", "royal_lens", "fang"]
  },
  // ============== Battle 10 — Leaving Thuling ==============
  // Kian's blockade. Squad's been ordered out of Thuling by Madame
  // Dawn's offer; Kian arrives at Lucian's house with hostages and a
  // contingent to ensure they don't make it to the road. Victory is
  // ESCAPE — get any unit to the west edge — not rout. Kian himself
  // uses holdPositionUntil so he doesn't break ranks until the squad
  // has thinned his blocker line, mirroring B1's King Nebu pattern.
  {
    id: "b10_leaving_thuling",
    index: 10,
    title: "Tenth Battle",
    subtitle: "Leaving Thuling",
    intro:
      "The streets you walked every day, the shop fronts you knew the names of. Kian is waiting on the cobblestones outside Lucian's house with twelve guardsmen and a wax-sealed warrant from the King's hand. Lucian's wife and daughter are inside the house. Kian's voice carries the way it used to in the practice yard, when he was correcting your footwork. He says he's known about Amar since the second week. He says he hoped he was wrong. He says the warrant is for Amar alone — the squad can walk away if Amar surrenders. Lucian is already drawing his spear.",
    outro:
      "The blockade breaks at the third barricade. Mira and Tali make the cousin's farm before the squad makes the western road. Kian doesn't pursue. His voice carries down the street one last time as the squad clears the gate: \"The cliffs, Amar. I'll meet you on the cliffs and we'll finish what your father started, you and me, before Madame Dawn turns you into a weapon she can use.\"",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: true,
    map: leavingThulingMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Kian holds the road out and refuses to engage until the squad
      // thins his guard — see holdPositionUntil. Six royal soldiers
      // make up his blockade: 2 guards flanking him, 2 archers on the
      // barricades, 2 guards advancing from the back line.
      ENEMIES.kian(10),
      ENEMIES.royalGuard("kbl_rg1", 1001, 9),
      ENEMIES.royalGuard("kbl_rg2", 1002, 9),
      ENEMIES.royalArcher("kbl_ra1", 1003, 9),
      ENEMIES.royalArcher("kbl_ra2", 1004, 9),
      ENEMIES.royalGuard("kbl_rg3", 1005, 8),
      ENEMIES.royalGuard("kbl_rg4", 1006, 8)
    ],
    difficultyLabel: "Escape",
    // Spoils: 2 elixirs from the Thuling chapel infirmary the squad
    // raids on the way out + 1 royal lens stripped from the blockade
    // archers. Modest because the squad is escaping with their lives,
    // not looting at leisure.
    rewards: ["elixir", "elixir", "royal_lens"],
    // Victory is ESCAPE — push any unit to the west edge (col 0,
    // anywhere along rows 4-6 where the road is unblocked). Routing
    // the entire blockade is also a valid win condition for players
    // who want full XP, but the cinematic intent is to break through
    // and ride for the cliffs without finishing Kian here.
    victory: anyOf(
      escapeToTile({ x: 0, y: 5 }, { label: "Escape west to the road" }),
      routEnemies
    ),
    dialogues: [
      // Round 1: Kian's blockade speech. Sets the stakes — Amar's
      // history, the warrant, the hostages, the choice. Lucian's
      // response sets the squad's posture: nobody walks away.
      {
        id: "b10_kian_blockade",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Kian", portraitId: "kian", expression: "knowing_smile",
            body: "Amar. Or whatever you've been calling yourself this year. Stop. The warrant is for you alone. Surrender, and the rest of these people — Lucian's wife, his daughter, the squad behind you — they walk. Refuse, and I burn the house behind me with everyone in it. Choose now, before I count to three." },
          { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
            body: "Mira and Tali are out the back gate. They have been for ten minutes. You burn an empty house, Kian. You always did love announcing things." },
          { speaker: "Kian", portraitId: "kian", expression: "alarmed",
            body: "...Lucian. You knew? How long have you known?" },
          { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
            body: "About Amar? Maybe a year. About you? Since the practice yard. Move, or move out of the way." },
          { speaker: "Kian", portraitId: "kian", expression: "cold_contempt",
            body: "Then we do it the hard way. Hold the line, gentlemen. Nobody walks west tonight." }
        ]
      },
      // adjacent_eot Kian/Amar: their first direct exchange as enemies.
      // Amar asks the question every player will be asking too.
      {
        id: "b10_kian_amar_first_words",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "kian_enemy" },
        beats: [
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "Why now? You had a year to turn me in. Why tonight?" },
          { speaker: "Kian", portraitId: "kian", expression: "knowing_smile",
            body: "Because tonight Madame Dawn offered you a ship. The King doesn't care about a peasant who used to be a prince. The King cares very much about a piece on Dawn's board." },
          { speaker: "Amar", portraitId: "amar",
            body: "And what do YOU care about, Kian." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "(quietly) I cared about a thirteen-year-old who couldn't hold a sword without his shoulders rising. I trained that out of him. I watched him die in his own throne hall and I hoped — hoped — that whoever woke up in the hospital wasn't him. Now move, your highness. I don't want to do this in front of the people you've kept alive this year." }
        ]
      },
      // before_victory: Kian doesn't pursue once the squad breaks
      // through. His promise to meet Amar on the cliffs sets up B11.
      {
        id: "b10_kian_promise",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The squad punches through the south barricade. Maya goes first, Ning covers, Leo takes the eastern flank wide. Lucian holds the rear and walks backward through the gap with his spear levelled the entire way. Kian could close the line. He doesn't." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "(calling after them) The cliffs, Amar. The cliffs above Para Harbor. Don't make me chase you to Dawn's ship. We finish this where your father finished his — on stone, in the open. You and me. Bring your friends if you want. They won't help." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "(over his shoulder, not slowing) The cliffs, Kian. Sundown." },
          { portraitId: "narrator",
            body: "The squad clears the western gate at a hard run. The road bends north toward the harbor road and the long climb up to the cliff plateau. Lucian doesn't look back at his house." }
        ]
      }
    ]
  },
  // ============== Battle 11 — The Cliffs ==============
  // The first half's climax. Kian arrives with the King's elite to
  // stop the squad from boarding Madame Dawn's ship. He brings the
  // truth — Anthros is a colony of Grude, the empire across the sea.
  // Lucian dies on the staircase down to the ship (narrated in the
  // post arc, mechanically he survives B11 — the post-battle death
  // pattern keeps the dying-character in player control until the
  // narrative beat lands cleanly). Kian dies in a combined strike
  // (defeatUnit victory).
  {
    id: "b11_cliffs",
    index: 11,
    title: "Eleventh Battle",
    subtitle: "The Truth About Anthros",
    intro:
      "Sundown over Para Harbor. The cliff road ends in a stone plateau that drops two hundred feet straight down to Madame Dawn's ship — a long slate-cut staircase the only way down. Kian is waiting on the lower landing with the King's elite: two royal guards on his flanks, four more positioned up the staircase to seal the descent. He looks tired in a way you've never seen him look. He waves a hand and the guards lower their weapons. He has something to say first. Lucian, on the cliff edge behind you, draws his spear anyway.",
    outro:
      "Kian falls to a combined strike on the lower landing. The squad clears the staircase and reaches the ship at moonrise. The cost was severe. The full weight of it lands in the cabin, after the boat is moving.",
    music: MUSIC.strongholdMemories,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_cliffs",
    playable: true,
    map: cliffsMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.lucian(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Kian as boss + 6 elite King's troops. Elite levels — these
      // are the King's personal guard, sent specifically to handle
      // Amar before Dawn can extract him. Kian uses holdPositionUntil
      // so he doesn't charge until his guard is thinned, giving the
      // player the chance to fight his line down or rush past him to
      // the ship.
      ENEMIES.kian(12),
      ENEMIES.royalGuard("clf_rg1", 1101, 11),
      ENEMIES.royalGuard("clf_rg2", 1102, 11),
      ENEMIES.royalArcher("clf_ra1", 1103, 10),
      ENEMIES.royalArcher("clf_ra2", 1104, 10),
      ENEMIES.royalGuard("clf_rg3", 1105, 10),
      ENEMIES.royalGuard("clf_rg4", 1106, 10)
    ],
    difficultyLabel: "Climactic — Boss Kian",
    // Spoils: large haul to outfit the squad for the long Grude
    // crossing — they won't see a trading post for several chapters.
    // 3 elixirs (the elite contingent's medical kit), 1 fang (Kian's
    // razor-tooth charm — he wore it since the practice yard), 1
    // royal lens (the captain's spotter), 1 mask (Kian's helm
    // ornament — Amar takes it).
    rewards: ["elixir", "elixir", "elixir", "fang", "royal_lens", "mask"],
    // Victory: defeat Kian. Mirrors B5 Ndari + B7 Selene defeatUnit
    // patterns. The combined-strike framing is narrative — any unit
    // (or chain of units) bringing Kian's HP to zero counts.
    victory: defeatUnit("kian_enemy", { label: "Defeat Kian" }),
    dialogues: [
      // Round 1: Kian's reveal. The colony truth is the worldbuilding
      // pivot of the first half — the squad has been fighting a piece
      // of the world, not the whole shape of it. Amar's reaction is
      // the moment he realizes Madame Dawn's offer is the only path
      // forward, even if she's playing him.
      {
        id: "b11_kian_colony_reveal",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Kian", portraitId: "kian", expression: "knowing_smile",
            body: "Hold. Before we do this. There's something you need to hear from someone who isn't trying to sell you a ship." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Make it short, Kian." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "Anthros is not a kingdom. Anthros is a colony. Grude is the empire. King Nebu was installed by King Archbold of Grude eighty years ago to hold this peninsula for the parent country. Your father knew. The original coup was not just against Nebu. It was against the colonial arrangement itself. You were trying to free a country from an empire. You died in that throne hall not because Nebu was strong but because Grude noticed." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "...He's not lying. Dawn briefed me on the colony structure six months ago. I never told you because the squad would have ridden for Grude that night without a plan." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "(quietly) Kian. Why are you telling me this NOW. With a sword in your hand." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "Because Madame Dawn is going to use you, Amar. She will board you on that ship and she will sail you to Grude and she will put you in front of King Archbold's nephews and she will use the look on your face to start a war that gets a hundred thousand peasants killed. I can't stop you from going. I can stop you from going whole." },
          { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
            body: "Then stop talking, Kian. The boat leaves at moonrise." }
        ]
      },
      // adjacent_eot Kian/Amar: the moment they finally fight. Kian's
      // last attempt to reach Amar before the swords meet.
      {
        id: "b11_kian_amar_face",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "kian_enemy" },
        beats: [
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "I taught you this stance. The half-step you do before a thrust. I taught you that one. You were eleven." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "I know, Kian." },
          { speaker: "Kian", portraitId: "kian", expression: "knowing_smile",
            body: "(quietly) Whatever happens in the next ten seconds, your highness. Don't fight for it. Don't fight for the colony, don't fight for the empire, don't fight for Dawn's flag, don't fight for your father's flag. Fight for the people on this staircase. They're the only thing that's actually yours." }
        ]
      },
      // before_victory: Kian's last words as he falls. The line lands
      // hardest if the player hasn't yet realized Lucian is wounded —
      // post_cliffs picks up the Lucian thread immediately after.
      {
        id: "b11_kian_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The combined strike comes from three directions at once. Maya from the upper landing, Ning's arrow from the cliff edge, Amar from the front. Kian doesn't try to parry the third. He looks at Amar across the steel and his face does the thing it used to do in the practice yard when Amar finally got a form right." },
          { speaker: "Kian", portraitId: "kian", expression: "fatherly_smile",
            body: "(softly) Good half-step, your highness." },
          { portraitId: "narrator",
            body: "Kian goes down on the lower landing. Lucian, who has been holding the staircase rear with one good arm and a spear gripped wrong, takes a crossbow bolt between the ribs from the last of the crown archers as the squad turns to descend. Nobody sees it land. Lucian doesn't make a sound. He keeps walking down the stairs to the ship." }
        ]
      }
    ]
  },
  {
    id: "b12_ravage",
    index: 12,
    title: "Twelfth Battle",
    subtitle: "The Ravage",
    intro: "A year of travel. Then Archbold's men close in. The truth of the Ravage is revealed.",
    outro: "You are not the heroes of the world. You are the survivors of a colony.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Reveal"
  },
  {
    id: "b13_dawn_rebellion",
    index: 13,
    title: "Thirteenth Battle",
    subtitle: "Madame Dawn's Rebellion",
    intro: "Dawn's rebellion is real. Rose dies saving her.",
    outro: "Dawn weeps without sound for the rest of the night.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Heart"
  },
  {
    id: "b14_origin",
    index: 14,
    title: "Fourteenth Battle",
    subtitle: "Amar's Origin",
    intro: "You are the biological child of Madame Dawn and King Archbold.",
    outro: "Everything you have done is exactly half of what you are.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Reveal"
  },
  {
    id: "b15_inner_coup",
    index: 15,
    title: "Fifteenth Battle",
    subtitle: "A Coup Within a Coup",
    intro: "A traitor in Dawn's camp leaves Ndara in a coma.",
    outro: "Dawn's promises grow harder.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Intrigue"
  },
  {
    id: "b16_proposal",
    index: 16,
    title: "Sixteenth Battle",
    subtitle: "Dawn's Proposal",
    intro: "Take the throne of Anthros once Archbold falls. Decide what kind of son you are.",
    outro: "You will be asked again, and your answer will cost lives either way.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Choice"
  },
  {
    id: "b17_lie",
    index: 17,
    title: "Seventeenth Battle",
    subtitle: "Dawn's Lie",
    intro: "Khione tells the rest of the story. Kian's last words on the cliff come back to you.",
    outro: "She loves you. She lied. Both can be true.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Reveal"
  },
  // ---- B18: Seven Paths divergence point -------------------------------------
  // The pivotal narrative beat — Amar chooses what kind of person he's
  // going to be from this point onward. The choice writes
  // save.flags["seven_paths.choice"] (one of SevenPath); subsequent
  // battles filter visibility on that flag. See docs/RAVAGE_DESIGN.md §6.
  {
    id: "b18_path_chosen",
    index: 18,
    title: "Eighteenth Battle",
    subtitle: "Seven Names, One Choice",
    intro: "Dawn's lie has come out. Selene's words from the cells return. Lucian is buried under a stone you helped lift. Maya watches you from across the firelight without saying anything. Khonu's old bow leans against the wall. You hold all seven names in your mouth at once. Pick the one you can still answer to. Then pick up your sword.",
    outro: "The path is chosen. The world reorganizes itself around the choice. Some doors close behind you forever; others open ahead.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Pivotal"
  },
  // ---- B19: Path-specific openers (one per Seven Path) -----------------------
  // Only the chosen path's chapter is visible / playable. Each opener
  // establishes the immediate consequences of that choice — who walks
  // away, who refuses to follow, what door closes first.
  {
    id: "b19_path_opener_vengeance",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The Hunter's First Step",
    intro: "Selene's path. You leave Grude in the dark with two riders and a list of names. Archbold's nephew is the first.",
    outro: "His blood is the first you've spilled in your own name. Selene says nothing for two days afterward, then quietly hands you a second list.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Vengeance · Opener"
  },
  {
    id: "b19_path_opener_restoration",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The First Stone Laid",
    intro: "Lucian's path. The squad rides for the Anthros border. There is a village that remembers your father — Khonu's village. They will let you stay if you can hold the road.",
    outro: "Three families fly an old flag from their doorposts that night. It is not the King's flag. It is not Dawn's flag. It is yours, if you can keep them safe.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: false,
    difficultyLabel: "Restoration · Opener"
  },
  {
    id: "b19_path_opener_revolution",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "Burn the Granary",
    intro: "Maya's path. The royal granary outside Grude feeds half the colony. If you burn it, the city revolts inside a week. Maya has been planning this since before she met you.",
    outro: "The granary burns. The smoke is visible from the palace balcony. Inside the week, Maya's prediction holds.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Revolution · Opener"
  },
  {
    id: "b19_path_opener_duty",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "Reporting for Service",
    intro: "Khonu's path. Dawn's army needs officers. You walk into the regimental tent in your father's old colors and accept a captaincy. Your first command is a column too thin to hold the bridge they've assigned it.",
    outro: "The bridge holds. Your column does not, entirely. You learn the names of three soldiers who will be in your dreams.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Duty · Opener"
  },
  {
    id: "b19_path_opener_exile",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The Long Road North",
    intro: "Tev's path. You leave the squad on the Grude road with the horses you came in on and ride for the cold country. Two days out, the assassins find you.",
    outro: "You bury them where they fell. You ride on. The country gets colder. The names you carried lose syllables, one by one.",
    music: MUSIC.strongholdMemories,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_cliffs",
    playable: false,
    difficultyLabel: "Exile · Opener"
  },
  {
    id: "b19_path_opener_mercy",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The Open Hand",
    intro: "Yul's path. There is a fort that has surrendered three times already and been refused. You ride to it under your own banner and offer terms a fourth time.",
    outro: "They lay down their weapons. Your squad spends the night reorganizing the fort's stores into a hospital. Selene watches from the gate without speaking.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Mercy · Opener"
  },
  {
    id: "b19_path_opener_forgetting",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "A Fisherman's Cottage",
    intro: "Sera's path. You ride for the southern coast and stop pretending to be anyone. A cottage. A boat. A name that is not Amar. The squad finds you anyway.",
    outro: "The squad does not stay. They leave a sword by the door. You spend a long evening looking at it.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: false,
    difficultyLabel: "Forgetting · Opener"
  },
  // ---- B20-B22: Shared mid-finale (path-flavoured cutscenes only) -----------
  // The world is at war by this point regardless of path; everyone fights
  // these. The arcs that bracket them shift per chosen path so the same
  // map plays differently across runs.
  {
    id: "b20_dawn_war",
    index: 20,
    title: "Twentieth Battle",
    subtitle: "Dawn's War",
    intro: "Dawn's rebellion has become a war. The first major clash. You are on a side now whether you wanted to be or not.",
    outro: "The line moves. The cost is real.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b21_archbold_advances",
    index: 21,
    title: "Twenty-First Battle",
    subtitle: "Archbold Advances",
    intro: "The King has marshalled the inner provinces and ridden west. The country between him and Grude is open road.",
    outro: "He is closer than yesterday. Closer still tomorrow.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b22_grude_burns",
    index: 22,
    title: "Twenty-Second Battle",
    subtitle: "Grude Burns",
    intro: "The granaries that fed the city are gone. The streets reorganize themselves around fire. Hold the upper district, or the upper district falls with the rest.",
    outro: "What can be saved is saved. What cannot is named, so the city remembers it.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Heart"
  },
  // ---- B23-B24: Path-specific climax pair -----------------------------------
  // These fire as different battles per chosen path; ids stay constant
  // (b23_path_climax_a / b24_path_climax_b) but the maps + dialogues +
  // win conditions get path-specific overrides selected at runtime.
  // Marking them as playable: false here keeps the OverworldScene safe
  // until the path-routing layer is wired.
  {
    id: "b23_path_climax_a",
    index: 23,
    title: "Twenty-Third Battle",
    subtitle: "The Path Narrows",
    intro: "The world's choices have narrowed to yours. The first of two tests, framed by the path you walked.",
    outro: "What you did here will be remembered the specific way of your path.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b24_path_climax_b",
    index: 24,
    title: "Twenty-Fourth Battle",
    subtitle: "The Bell Before the Sky",
    intro: "The second test. The one you can't take back.",
    outro: "The bell rings. The sky changes within the hour.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Climactic"
  },
  // ---- B25-B27: Shared penultimate — the Ravage fleet arrives ---------------
  // The off-world fleet's descent is the same threat across all paths;
  // each path's perspective on it differs (Vengeance views it as
  // Archbold's last betrayal, Restoration as a test of the new state,
  // Revolution as the moment of unity, etc.) but the maps are shared.
  {
    id: "b25_fleet_arrival",
    index: 25,
    title: "Twenty-Fifth Battle",
    subtitle: "The Sky Speaks",
    intro: "The fleet drops out of orbit at sunrise. The sky speaks first — a sound no one alive has heard. Then the landing craft come.",
    outro: "The first wave is repelled. The second wave is already burning the air on its way down.",
    music: MUSIC.finalBoss,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b26_coastal_hold",
    index: 26,
    title: "Twenty-Sixth Battle",
    subtitle: "Hold the Coast",
    intro: "If the coast falls, the inland falls. If the inland falls, the war ends in a month. Hold the line.",
    outro: "The coast holds. Barely. The line is rewritten in salt and rust.",
    music: MUSIC.finalBoss,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b27_orbital_descent",
    index: 27,
    title: "Twenty-Seventh Battle",
    subtitle: "Orbital Descent",
    intro: "The Ravage commander descends in person. They want to see what they're killing.",
    outro: "They have seen it. They are not deterred.",
    music: MUSIC.finalBoss,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Climactic"
  },
  // ---- B28-B30: Path-specific finale + epilogue -----------------------------
  {
    id: "b28_path_final",
    index: 28,
    title: "Twenty-Eighth Battle",
    subtitle: "The Path Ends",
    intro: "The final reckoning, framed by the path you walked. Different opponents per path; same gravity.",
    outro: "The fight ends in the only way it could, given everything before it.",
    music: MUSIC.finalBoss,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Final Boss"
  },
  {
    id: "b29_aftermath",
    index: 29,
    title: "Twenty-Ninth Battle",
    subtitle: "The Aftermath",
    intro: "The Ravage fleet is gone. The remaining fight is whatever survived your last decision.",
    outro: "The war is over for the people who lived through it.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b30_epilogue",
    index: 30,
    title: "Final Battle",
    subtitle: "Seven Names, One Life",
    intro: "There is no fight here. There is the rest of your life, framed by the name you chose to answer to.",
    outro: "Of the seven, one. Of the world that was, this. Of you, what's left.",
    music: MUSIC.finalBoss,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Epilogue"
  }
];

// Accepts a plain string for ergonomic call sites (URL params, save files,
// scene.start payloads), but the predicate compares against the typed
// BattleNode.id. Returns undefined if the lookup misses.
export const battleById = (id: string): BattleNode | undefined => BATTLES.find((b) => b.id === id);
export const battleByIndex = (idx: number): BattleNode | undefined => BATTLES.find((b) => b.index === idx);
