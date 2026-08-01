import type { ItemKind, MapDef, UnitDef } from "../combat/types";
import { ENEMIES, PLAYERS } from "./units";
import { bridgeMap, caravanMap, cliffsMap, cottageCoveMap, courtyardMap, dawnBanditsMap, dawnRebellionMap, dutyBridgeMap, exilePassMap, farmlandMap, fortMap, granaryMap, kingsRoadMap, leavingThulingMap, monasteryMap, mountainMap, originMap, orinhalMap, palaceMap, quayMap, ravageMap, ravineMap, shipDeckMap, swampMap, upperDistrictMap, warFieldMap } from "./maps";
import { MUSIC, type MusicKey } from "../audio/musicKeys";
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
  // Optional music override. When set, fades into this track when the
  // dialogue opens and fades back to the battle's main music when the
  // dialogue closes. Used for grief beats that need a different
  // texture from the battle theme (e.g., B1's `b01_capture` switches
  // to Sadness2 for the Selene-injured / Amar-captured sequence).
  // BattleDialogueScene handles the fade in/out via getMusic().
  music?: MusicKey;
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
  // What a victory here unlocks. Three states:
  //   undefined → default: the next battle in the BATTLES array. Right
  //               for the linear B1–B17 spine.
  //   BattleId  → explicit target. Required for the path structure —
  //               the seven B19 variants sit adjacent in the array, so
  //               "next in array" after b19_vengeance would wrongly
  //               unlock ANOTHER path's opener instead of B20.
  //   null      → unlocks nothing. Endings (exile, forgetting) and
  //               nodes whose routing is owned elsewhere (B18's choice
  //               unlocks the chosen opener via ChoiceScene).
  unlocks?: BattleId | null;
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
  // Opt into the fog-of-war spotlight overlay — a dark layer over the
  // world with soft circular holes punched at each living player
  // unit. Reserved for moody / nocturnal / interior scenes where the
  // "you can only see what's near the squad" framing earns its
  // dramatic cost. Off by default so daylight outdoor battles
  // (farmland, mountain pass, harbor) render normally.
  darkBattle?: boolean;
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
      "The royal guard beats you back. You wake in a hospital outside the palace with no memory of who you are — alive, but bound to a fight you can't even remember starting.",
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
        // Selene gets her knee folded the wrong way, Ranatoli is taken
        // down on the carpet, Amar is hooded and dragged out — the
        // battle theme is the wrong texture for the moment. Fade in
        // Sadness2 for the duration of the dialogue; BattleDialogueScene
        // restores the prior track on close so EndScene's victory sting
        // lands on the music it expects.
        music: MUSIC.sadness2,
        beats: [
          { portraitId: "narrator",
            body: "The last royal guard goes down hard against the third pillar from the dais. The torches gutter once and steady. For one breath the throne hall is silent and the squad believes it is over." },
          { speaker: "Selene", portraitId: "selene", expression: "breaking",
            body: "Amar, the side doors. The SIDE doors, get to —" },
          { portraitId: "narrator",
            body: "Three palace guards step out at Amar's blind side. He turns too late. Gauntlets close on wrist and throat; his sword goes. He doesn't see where." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "Selene — !" },
          { portraitId: "narrator",
            body: "Ranatoli is already moving: two strides, shield into the nearest guard's ribs. Six more step from the corridors behind him. They take him down without a word." },
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "alarmed",
            body: "Hold on — Amar — hold ON, damn it —" },
          { portraitId: "narrator",
            body: "Selene kills the closest guard before they swarm her. Arm pinned, knee wrenched wrong. She doesn't cry out. She finds Amar's eyes and shakes her head once. Don't." },
          { portraitId: "narrator",
            body: "The rest are gone. Khonu dead at the south doors, Yul on the eastern stairs, Tev in the stables. And Sera, no word for a long time." },
          { speaker: "King Nebu IV", portraitId: "nebu", expression: "cruel_amusement",
            body: "Eight of you, ten months, and this: a boy kneeling in MY throne hall. Remove him. The other two: cells. Tomorrow I decide which name I remember." },
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
      "Bandits attack the farmland outside Thuling. You and the workers you've come to call friends — Lucian the foreman, Ning the bowyer's apprentice — have to defend the wagons until Kian's knight arrives. You shouldn't know how to fight this well. You do anyway. Keep pretending you don't.",
    outro:
      "Lucian hands you a rag for the cut on your hand. He says nothing. The smell of wet hay and iron has stirred something in you — a memory, or an instinct — and you can't afford to let him see it on your face.",
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
    rewards: ["potion", "potion", "potion", "mask"],
    dialogues: [
      // Round 1: Lucian's tactical brief — first time the player sees
      // him take command in a fight. Establishes his foreman voice and
      // gives Ning a small character moment (her nerves).
      {
        id: "b02_lucian_tactical",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
            body: "Right. Archer at the back fence. Ning, take her clean. Spearton's mine. Amar, hold the wagons. Anyone breaks past, the wagons burn and the workers die." },
          { speaker: "Ning", portraitId: "ning", expression: "startled",
            body: "Lucian, I haven't drawn on a person before. The fences and the haybales, fine, but a person — fuck — a person is —" },
          { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
            body: "Then today's the day, Ning. Same draw. Same release. The arrow doesn't know what it's hitting. You do. Make it count." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "...I've got the line." }
        ]
      },
      // ally_attacks Amar (first swing). Lucian privately notices something
      // about Amar's technique — but doesn't articulate it. The player
      // sees a one-syllable beat that primes the mystery; the full
      // articulation lands in Kian's b04_kian_amar_test ("almost
      // rehearsed"). This is the first crack in Amar's cover.
      {
        id: "b02_lucian_notices",
        trigger: { kind: "ally_attacks", allyId: "amar" },
        beats: [
          { portraitId: "narrator",
            body: "Amar swings once, clean, with a small step beforehand that no forge worker would know to take. Lucian sees it. He doesn't look surprised. He doesn't let his face show anything at all." },
          { speaker: "Lucian", portraitId: "lucian",
            body: "...Hm." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "(quietly, to himself) ...That wasn't supposed to come out clean." }
        ]
      }
    ]
  },
  {
    id: "b03_dawn_bandits",
    index: 3,
    title: "Third Battle",
    subtitle: "Madame Dawn's Bandits",
    intro:
      "Two days after the wagon attack, a second wave comes down the eastern road — fewer, better armed, all wearing the same dyed sash. The town calls them \"Dawn's lot,\" after the queen across the sea who never forgave King Nebu for taking her land. Lucian forms the line. A stranger drops from the orchard and joins it without asking.",
    outro:
      "The stranger introduces herself as Maya — quiet, watchful, with a sharp tactical mind that Ning takes to before Maya has even finished her first sentence. Lucian says nothing, which from Lucian means approval. She stays.",
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
      // the differentiation is purely narrative. Last two are the
      // difficulty-pass east-flank pressure on Maya's separated arrival.
      ENEMIES.banditSwordsman("dawn_sw1", 301),
      ENEMIES.banditSwordsman("dawn_sw2", 302),
      ENEMIES.banditSpearton("dawn_sp1", 303),
      ENEMIES.banditArcher("dawn_a1", 304),
      ENEMIES.banditArcher("dawn_a2", 305),
      ENEMIES.banditArcher("dawn_a3", 306),
      ENEMIES.banditSwordsman("dawn_sw3", 307)
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
      "Three minutes into the marsh, the canopy swallows the sun. Single file: Maya leading, Amar and Lucian in the middle, Kian clanking on the right, Ning watching the rear. The farm's delivery rides in Lucian's saddlebag. Bandits wait in the trees on every side — and Maya draws first.",
    outro:
      "Lucian makes up a story for Kian — something about reflexes learned on the farm. Kian nods and says nothing. That night by the fire, Lucian makes up a different story, this one just for you. Then he asks you to tell him the real one.",
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
    // Swamp ambush at the four corners — atmospheric marsh fight that
    // benefits from the fog-of-war framing (squad can't see the
    // tree-line enemies until they close).
    darkBattle: true,
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
            body: "Reflex. Kian, eyes left. The archer behind the third tree." },
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
      "General Fergus sends your squad against marauders led by siblings: Ndari at the front, Ndara behind him. The village is already ruined; snow falls on broken roofs. Leo — Fergus's son, a Dactyl Rider — asks to ride with you. Why a father would send his own son into this, you can't guess. Set the question aside. Climb.",
    outro:
      "Ndari falls. Ndara escapes on a Dactyl. Her last question — Why are you fighting on Nebu's side? — hangs in the cold air. Lucian sees you flinch. He stays quiet tonight. Tomorrow he'll have a great deal to say.",
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
      ENEMIES.banditArcher("nd_a2", 506),
      // Difficulty-pass additions: a far-west spearton extending the
      // parapet line + a far-east archer mirroring the existing east
      // mid-pass shooter, so the squad climbs into pressure from both
      // flanks instead of just the center.
      ENEMIES.banditSpearton("nd_s3", 507),
      ENEMIES.banditArcher("nd_a3", 508)
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
    victory: defeatUnit("ndari", { label: "Defeat Ndari" }),
    dialogues: [
      // adjacent_eot Amar/Ndari — Ndari's stand. The script's "holding
      // the line so his sister can run" line gets articulated when Amar
      // reaches him at the gate. Sets up the player to understand WHY
      // Ndari fights to the death (it's not pride, it's protection).
      {
        id: "b05_ndari_stand",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "ndari" },
        beats: [
          { speaker: "Ndari", portraitId: "ndari", expression: "grim_resolve",
            body: "You think this is YOUR line? Look. The dactyl on the rim. That's my sister. Thirty seconds till she's clear. Not one of you bastards gets past me." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "...General Fergus called you marauders, Ndari. He didn't say anything about a sister." },
          { speaker: "Ndari", portraitId: "ndari", expression: "knowing_smile",
            body: "Of course he didn't. Fergus knows what we are. So does the King. Your captain just doesn't tell you. You'll figure it out. Or you won't. Either way, twenty seconds." }
        ]
      },
      // before_victory — Ndari falls at the gate, Ndara escapes on the
      // dactyl. Her shouted question lands as the player's first crack
      // in the "Nebu's loyal soldier" framing — the same question Maya
      // and Madame Dawn will hammer at for chapters to come.
      {
        id: "b05_ndara_escape",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Ndari folds at the gate and sits against the post, watching the path. The last bandits scatter. Above, a dactyl wheels east, then its rider stops, hovers, looks down." },
          { speaker: "Ndara", portraitId: "ndari", expression: "grim_resolve",
            body: "(shouted, over the wing-beats) WHY ARE YOU FIGHTING ON NEBU'S SIDE, AMAR! ASK YOUR CAPTAIN WHO HE WORKS FOR! ASK HIM WHO ORDERED THE FOURTH HARVEST!" },
          { portraitId: "narrator",
            body: "She doesn't wait for an answer. The dactyl wheels and is gone behind the ridge. Lucian says nothing. He sees Amar's face change, and notes it for later." }
        ]
      }
    ]
  },
  {
    id: "b06_caravan",
    index: 6,
    title: "Sixth Battle",
    subtitle: "The Caravan",
    intro:
      "A routine escort east — two wagons of grain and steel. Then arrows fall from both canyon ledges and mounted bandits seal the road behind you. This ambush was planned. The drivers drop flat. Maya takes the south flank without being told, like she's done it a hundred times. Lucian's eyes narrow. He knows what this is.",
    outro:
      "The road is yours — wagons intact, drivers alive. Under the bandit captain's body, Amar finds a ledger: route times, payment dates, and a margin note in court accounting code only palace officers can read. Someone inside Nebu's court paid for this ambush. The squad keeps the ledger.",
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
            body: "South flank. Lucian, hold the west wagon. Ning, climb the south shelf. The perched archer there is reloading slow, you can take her clean. Amar takes center. Leo, swing wide and break the east seal." },
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
            body: "Hold up. That one had a leather pouch on his hip. I saw it when he raised his shield. Maya, search him before we lose the body to the road dust." },
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
      "Fergus's orders: raiders in a mountain monastery, kidnapped tax collectors — clear it out. Two days' climb, then the squad breaks the south gate and pushes inward. In the inner sanctum, the raiders' leader looks up — and Amar knows her face from a wanted poster. Selene. One of the seven.",
    outro:
      "Selene goes over the bell tower balcony — rope already coiled on her shoulder — and vanishes into the mist before Leo can turn his Dactyl. The raiders scatter. Lucian fought the whole battle on Amar's blind side, covering a man at half strength. He doesn't ask why. Not yet.",
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
      // throwing herself off the balcony to escape. The raiders are her
      // hand-picked (slightly higher level than the canyon mooks). Last
      // two added in the difficulty pass: a third archer in the inner
      // sanctum gives Selene better ranged cover, and a third swordsman
      // in the center funnel between chambers makes the corridor a
      // grind instead of a clear lane.
      ENEMIES.selene(),
      ENEMIES.banditArcher("mst_a1", 701, 6),
      ENEMIES.banditArcher("mst_a2", 702, 6),
      ENEMIES.banditSwordsman("mst_sw1", 703, 6),
      ENEMIES.banditSwordsman("mst_sw2", 704, 6),
      ENEMIES.banditSpearton("mst_sp1", 705, 7),
      ENEMIES.banditArcher("mst_a3", 706, 6),
      ENEMIES.banditSwordsman("mst_sw3", 707, 6)
    ],
    difficultyLabel: "Boss — The Monastery",
    // Spoils: 2 elixirs from the monastery's still-stocked dispensary
    // and a Fang — a relic blade-tooth Selene leaves on the altar
    // before her balcony exit. Narrative tell: she meant for the squad
    // to find it.
    rewards: ["elixir", "elixir", "fang"],
    // Stone corridors that swallow torchlight — the intro literally
    // calls out the darkness. Fog-of-war spotlight earns its keep on
    // a monastery interior fight more than anywhere else in the slice.
    darkBattle: true,
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
            body: "Amar. Whatever this is, whatever she is to you, fight at half strength all you need to. I'm on your blind side." },
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
            body: "Selene catches herself mid-syllable. Her eyes say it: *I thought you were dead.* His answer: *They have to keep thinking it.* The squad hasn't noticed a thing." },
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
      "Fergus's orders: break up the riot, arrest the ringleaders. But the squad rides in at noon and finds no riot — a starving town, unarmed foremen and families standing between the King's tax detail and the last winter grain. Then green cloaks: Madame Dawn's partisans, holding the line. Leo dismounts and walks his Dactyl to the partisan side. The squad follows.",
    outro:
      "The tax collectors break first. Dawn's lieutenant — a gray-cloaked woman called Ndara, no relation to the mountain bandit — says Dawn has been watching Amar and wants to meet when he's ready. She's gone before he can answer. Lucian hands the squad's share of silver back to the townspeople.",
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
    rewards: ["royal_lens", "mask", "potion"],
    // Defaults to routEnemies. The Ndara meeting + silver
    // distribution fire in the post arc regardless of damage taken.
    dialogues: [
      // Round 2: Leo's declaration. The script's "Leo dismounts and
      // walks his Dactyl to the partisan side" beat made mechanical —
      // happens after round 1 has committed everyone, the squad has
      // realized this isn't a riot, and the choice is in the air.
      // Foreshadows the squad's collective side-take in post_orinhal.
      {
        id: "b08_leo_declaration",
        trigger: { kind: "round_start", round: 2 },
        beats: [
          { portraitId: "narrator",
            body: "Round two: the arrows stop. The foremen stand between the squad and the King's tax detail. Not one has run. They're watching what kind of soldiers Anthros sends." },
          { speaker: "Leo", portraitId: "leo", expression: "ready",
            body: "Captain. I'm dismounting. The dactyl walks to the partisan side. The squad is welcome to follow. I'll explain to my father later. Or I won't. Either's fine." },
          { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
            body: "Lad, your father sent you with US. You break ranks here, you don't get to go back to him." },
          { speaker: "Leo", portraitId: "leo", expression: "resolute",
            body: "I know, Lucian. The townspeople behind us are unarmed. The tax men in front of us are not. I know which side I'm on. The rest of you do what you have to." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "(after a beat) ...The squad's with you, Leo. Lucian, pivot the line. We're fighting south now." }
        ]
      },
      // adjacent_eot Maya/Leo — quieter character moment after the
      // pivot. Maya's the only one who isn't surprised by Leo's call.
      // Foreshadows that she's been reading the squad for months.
      {
        id: "b08_maya_leo_aside",
        trigger: { kind: "adjacent_eot", unitA: "maya", unitB: "leo" },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "(quietly, between strikes) Leo. That call. You'd been thinking about it for weeks." },
          { speaker: "Leo", portraitId: "leo", expression: "ready",
            body: "Since the last village. The one Fergus told us was 'noncompliant.' I went back the next day on patrol. There was nothing left to be noncompliant. You knew?" },
          { speaker: "Maya", portraitId: "maya",
            body: "I read your face when we got the briefing. Same face Lucian made. You've both been waiting for an excuse. Today's the day." },
          { speaker: "Leo", portraitId: "leo", expression: "ready",
            body: "...How do YOU read faces like that, exactly?" },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "(half-smile, no answer) Watch your west flank, Leo. There's a spearton coming around the barricade." }
        ]
      }
    ]
  },
  {
    id: "b09_ravine",
    index: 9,
    title: "Ninth Battle",
    subtitle: "The Price of Doubt",
    intro:
      "Word of Orinhal outruns the squad to Thuling. Fergus sends them straight out again — intercept a bandit column. It's a trap: a King's regiment in commoners' clothes, dug into a ravine, archers on the high ground, a river blocking retreat. Fire from three directions in thirty seconds. Maya's mouth sets in a line none of them have seen.",
    outro:
      "Lucian takes a bolt saving Ning and fights one-armed. Clear of the ravine, the truth lands: Fergus knew about the coup and has been sending the squad to die. Maya is no peasant — Madame Dawn planted her months ago. Dawn offers safety. Another night in Thuling is suicide.",
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
    rewards: ["elixir", "elixir", "royal_lens", "royal_lens", "fang"],
    dialogues: [
      // Round 1: the trap snaps shut. The squad realizes inside thirty
      // seconds that Fergus set them up. Sets the tone for everything
      // that follows in the post arc.
      {
        id: "b09_trap_snaps",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { portraitId: "narrator",
            body: "Three bolts in thirty seconds, from three directions. Fergus's 'bandit column' is on the rim, in the trees, behind the river. Royal kit under the commoners' clothes." },
          { speaker: "Maya", portraitId: "maya", expression: "alarmed",
            body: "These aren't bandits. Lucian, TOP RIM, three archers, dug in. Crown gear under the cloaks. This is a regiment. Fergus marched us straight into a goddamn regiment." },
          { speaker: "Lucian", portraitId: "lucian", expression: "grim_resolve",
            body: "Fergus." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "...That son of a bitch set us up. He sent us here to die." },
          { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
            body: "Then we don't die. South, through the river crossing. Hold five rounds, then we run." }
        ]
      },
      // Round 3: Maya's preview. The full reveal lands in post_ravine,
      // but a mid-fight beat where she half-tells Amar primes the
      // player for it. Maya's "Amar — when this is done, we need to
      // talk" is the kind of in-fight aside that sticks because it
      // happens IN the danger.
      {
        id: "b09_maya_preview",
        trigger: { kind: "round_start", round: 3 },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "Amar. When we clear this ravine, we talk. I should have told you in Thuling. I'm sorry. You need to hear it from me, not Fergus's body." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "...When we clear this ravine, Maya. Not before. I can't lose focus." },
          { speaker: "Maya", portraitId: "maya",
            body: "Agreed. South ford. We move." }
        ]
      }
    ]
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
      "The streets you walked every day. Kian waits outside Lucian's house with twelve guardsmen and a warrant sealed by the King himself — Lucian's wife and daughter inside. He's known about Amar since the second week, he says. Hoped he was wrong. The warrant is for Amar alone; the squad walks if he surrenders. Lucian is already drawing his spear.",
    outro:
      "The blockade breaks at the third barricade. Mira and Tali reach the cousin's farm; Kian doesn't chase. His voice follows the squad through the gate: \"The cliffs, Amar. We'll finish what your father started — before Madame Dawn turns you into a weapon.\"",
    music: MUSIC.strongholdMemories,
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
      // thins his guard — see holdPositionUntil. Eight royal soldiers
      // make up his blockade: 2 guards flanking him, 2 archers on the
      // barricades, 2 guards advancing from the back line, and the
      // difficulty-pass additions — a guard mid-street pinching the
      // squad's escape lane + a crown archer on the south barricade
      // ridge for extra ranged cover from terrain.
      ENEMIES.kian(10),
      ENEMIES.royalGuard("kbl_rg1", 1001, 9),
      ENEMIES.royalGuard("kbl_rg2", 1002, 9),
      ENEMIES.royalArcher("kbl_ra1", 1003, 9),
      ENEMIES.royalArcher("kbl_ra2", 1004, 9),
      ENEMIES.royalGuard("kbl_rg3", 1005, 8),
      ENEMIES.royalGuard("kbl_rg4", 1006, 8),
      ENEMIES.royalGuard("kbl_rg5", 1007, 8),
      ENEMIES.royalArcher("kbl_ra3", 1008, 9)
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
            body: "Amar, or whatever you call yourself. The warrant is for you alone. Surrender, and everyone else walks. Refuse, and I burn the house with them in it. Choose." },
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
            body: "(quietly) I trained a frightened thirteen-year-old. I watched him die in his throne hall and hoped whoever woke in the hospital wasn't him. Now move, your highness." }
        ]
      },
      // before_victory: Kian doesn't pursue once the squad breaks
      // through. His promise to meet Amar on the cliffs sets up B11.
      {
        id: "b10_kian_promise",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The squad breaks the south barricade: Maya first, Ning covering, Leo wide east. Lucian backs through the gap, spear levelled. Kian could close the line. He doesn't." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "(calling after them) The cliffs above Para Harbor! We finish this where your father finished his: stone, open sky, you and me. Bring your friends. They won't help." },
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
      "Sundown over Para Harbor. The cliff staircase down to Madame Dawn's ship is the only way — and Kian waits on the lower landing with the King's elite, guards blocking every step. He looks tired in a way you've never seen. He waves the weapons down; he has something to say first. Behind you, Lucian draws his spear anyway.",
    outro:
      "Kian falls to a combined strike on the lower landing. The squad clears the staircase and reaches the ship at moonrise. The cost was severe — but the full weight of it doesn't land until later, in the cabin, after the boat is already moving.",
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
    // Cliff-face stair-fight as the squad descends to Madame Dawn's
    // ship at the waterline. Dramatic night exit + the colony-truth
    // reveal lands here — fog-of-war reinforces "this is the moment
    // the world becomes bigger than you knew."
    darkBattle: true,
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
            body: "Anthros is a colony, Grude the empire. Archbold installed Nebu to hold it. Your father knew. The coup was against the empire. You died because Grude noticed." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "...He's not lying. Dawn briefed me on the colony structure six months ago. I never told you because the squad would have ridden for Grude that night without a plan." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "(quietly) Kian. Why are you telling me this NOW. With a sword in your hand." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "Dawn will use you, Amar. Your face starts a war, a hundred thousand peasants die. I can't stop you going. I can stop you going whole." },
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
            body: "(quietly) Whatever happens next, don't fight for the colony, the empire, or anyone's flag. Fight for the people on this staircase. They're the only thing that's yours." }
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
            body: "Three directions at once: Maya above, Ning's arrow, Amar in front. Kian doesn't parry the third. He gives Amar the practice-yard look: a form finally right." },
          { speaker: "Kian", portraitId: "kian", expression: "fatherly_smile",
            body: "(softly) Good half-step, your highness." },
          { portraitId: "narrator",
            body: "Kian falls on the landing. Holding the rear one-armed, Lucian takes a bolt between the ribs. No one sees. No sound. He keeps walking to the ship." }
        ]
      }
    ]
  },
  {
    id: "b12_ravage",
    index: 12,
    title: "Twelfth Battle",
    subtitle: "The Ravage",
    intro:
      "Fourteen months at sea end at first light. Khione docks in Grude's east port under the empire's own customs flag — Dawn's papers are good anywhere. The squad gets seconds to take in a city taller than anything in Para before alarm bells ring: someone in a captain's cloak has recognized them. Archbold knew exactly when to send his welcome.",
    outro:
      "You are not heroes but survivors of a colony. Dawn meets you at the inner gate: yes, the bells were for you; yes, Captain Volos answers to King Archbold of Grude; yes, your father's coup eleven years ago targeted an empire, not a kingdom. Come inside before the second wave.",
    music: MUSIC.grudeBattle1,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: ravageMap,
    buildPlayers: () => [
      // Post-Lucian squad: the four who walked off Madame Dawn's ship
      // after the cabin scene + sea burial. Maya leads field-tactics
      // now in Lucian's place; Ning has his bowstring on her belt.
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Captain Volos on the customs platform + 5 elite. First named
      // enemy of the empire. Levels bumped above the elite Crown
      // forces at B11 — these are Archbold's officers, not Nebu's.
      ENEMIES.archboldCaptain(13),
      ENEMIES.royalArcher("rav_xa1", 1201, 12),
      ENEMIES.royalArcher("rav_xa2", 1202, 12),
      ENEMIES.royalGuard("rav_rg1", 1203, 12),
      ENEMIES.royalGuard("rav_rg2", 1204, 12),
      ENEMIES.royalGuard("rav_rg3", 1205, 12)
    ],
    difficultyLabel: "Reveal — Empire Welcome",
    // Spoils: Dawn's people resupply the squad after the colony reveal.
    // 3 elixirs from the Grude infirmary + 1 royal lens (a Grude-issue
    // optic Khione gifts as a gesture of welcome — strictly better than
    // anything the squad carries from Anthros).
    rewards: ["elixir", "elixir", "elixir", "royal_lens"],
    // Victory: rout the interception detail OR push any unit through
    // the north gate (row 0) into the city interior. The cinematic
    // intent is escape — the second wave is coming and Dawn's safe
    // house is north — but a player who wants to clear the dock
    // outright can also win that way (extra XP).
    victory: anyOf(
      escapeToTile({ x: 7, y: 0 }, { label: "Push north into the city" }),
      routEnemies
    ),
    dialogues: [
      // Round 1: Dawn's voice from a window above the customs
      // platform, narrating the situation while the squad fights.
      // The colony truth that Kian articulated in B11 lands HARDER
      // here because the player is now standing in the empire's
      // capital looking at the empire's officers wearing the same
      // kit as the King's Anthros guard. Same kit. Same drill.
      // Different flag.
      {
        id: "b12_dawn_voice_window",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { portraitId: "narrator",
            body: "Alarm bells from the customs platform: Captain Volos at the podium, six elite, two crossbows drawn. The squad is behind the crates in ten seconds. Maya signals wordlessly." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "(half-shouted) Amar. His kit. The SAME as the guard you killed in Para. Eighty years, same drill. You are not fighting a kingdom, my son. An empire." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "She's right. The crossbow stance is identical. They learned it from the same manual. Amar, focus. Volos first only when his line thins. Crown archers right now." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "(quietly, to himself, while drawing) ...Eighty years." }
        ]
      },
      // Round 3: a smaller follow-up beat — Dawn finishes the thought
      // she started on round 1. This is the moment the player hears
      // her use the word "son" and probably notes it (the family
      // reveal lands fully at B14; here it's a planted seed).
      {
        id: "b12_dawn_son_beat",
        trigger: { kind: "round_start", round: 3 },
        beats: [
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "(quiet, to Amar) Past the gate, don't take the main avenue. Cut left at the second alley. The safe house door has no number. I'll be there first." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "(over his shoulder, between strikes) ...You said \"my son\"." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "I did. There's a great deal more I have not said yet. The second alley, Amar. Move." }
        ]
      },
      // adjacent_eot Maya + Amar: Maya finally says out loud what
      // she's been holding for fourteen months on the ship. Lands in
      // the middle of the fight because the alternative is letting
      // Dawn say it for her and Maya promised not to do that.
      {
        id: "b12_maya_finally_says_it",
        trigger: { kind: "adjacent_eot", unitA: "maya", unitB: "amar" },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
            body: "Amar. Before Dawn finishes the speech she's about to give you. The thing I've been waiting fourteen months to tell you. (Quick, while parrying.) Your father wasn't only Anthros's prince. Your mother wasn't only the woman who raised you." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "Maya — wait —" },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "(strike, recover) Wait nothing. Fight first, listen on the way to the safe house. The shape of it: half of you is from this side of the sea. I'll fill in the rest when nobody is shooting at us." }
        ]
      },
      // before_victory: Dawn at the inner gate as the squad pushes
      // through. The line that becomes the chapter's outro frame.
      {
        id: "b12_dawn_at_the_gate",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The line breaks at the customs platform. Volos falls to Maya's attack; the crossbows scatter. At the inner gate, Dawn waits under the arch, hood down, hands empty." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "Faster than I expected. The second wave is twelve minutes behind you. Ndara has tea upstairs; your packs are inside. Maya, your old room, end of the hall." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(quietly) ...You knew which room was hers. You knew which room was hers eleven months before I did. How long has she been yours, Dawn." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "(soft) Eleven years, Amar. Same as you. Come inside. Both wars are about to find us, and we have a lot to talk about before they do." }
        ]
      }
    ]
  },
  // ============== Battle 13 — Madame Dawn's Rebellion =====================
  // Three weeks after the squad arrives in Grude. Dawn has been
  // assembling for years — twelve coordinated strikes across the city
  // in a single night, hitting King Archbold's nephews, financiers,
  // and the customs wardens who collect the colony's iron tax. The
  // squad's job is the nephew's estate: a residence in the upper
  // district, lightly garrisoned because the nephew never expected
  // anyone to come for him. Rose, Dawn's most senior lieutenant,
  // leads the squad in. She knows the layout of the plaza by heart.
  // She doesn't make it home.
  {
    id: "b13_dawn_rebellion",
    index: 13,
    title: "Thirteenth Battle",
    subtitle: "Madame Dawn's Rebellion",
    intro:
      "Three weeks in Grude. Nine years of Dawn's plan land tonight: twelve strikes in one hour — nephews, customs wardens, ledger-keepers. The squad draws the nephew's estate on the marble plaza off Oran Lane, lightly garrisoned because he's never had to be afraid here. Rose leads — weeks of mapping behind her, calm as rehearsal.",
    outro:
      "The captain falls. The plaza is the squad's. Then the residence's back door opens — a second wave the intelligence missed, four crossbows on Dawn. Rose takes all four bolts. She is dead before she hits the cobblestones. Dawn crosses the plaza, kneels in Rose's blood, and stays there all night.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: dawnRebellionMap,
    buildPlayers: () => [
      // The Grude squad + Rose. Rose is Dawn's lieutenant — joins
      // as a player unit for B13 only and dies in post_dawn_rebellion
      // (the second-wave bolts come AFTER the mechanical victory, in
      // the before_victory beat below + the post arc).
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.maya(),
      PLAYERS.leo(),
      PLAYERS.rose()
    ],
    buildEnemies: () => [
      // Royal Captain on the marble podium + 5 elite. Lower count
      // than B12 (6 vs B12's 5+1) reflects the script's "lightly
      // garrisoned" framing. Levels bumped over B12 because the
      // squad has had three weeks to recover and equip in Grude.
      ENEMIES.royalCaptain(14),
      ENEMIES.royalArcher("dr_xa1", 1301, 13),
      ENEMIES.royalArcher("dr_xa2", 1302, 13),
      ENEMIES.royalGuard("dr_rg1", 1303, 13),
      ENEMIES.royalGuard("dr_rg2", 1304, 13),
      ENEMIES.royalGuard("dr_rg3", 1305, 13)
    ],
    difficultyLabel: "Heart — Rebellion Strike",
    // Spoils: modest because the night ends in grief. Rose's medical
    // kit (2 elixirs) + a Fang from her belt — the squad keeps it
    // as a memorial, the way Ning kept Lucian's bowstring. Dawn
    // explicitly tells the squad not to strip the rest of the
    // captain's kit; the plaza is hers to mourn now.
    rewards: ["elixir", "elixir", "fang"],
    // Night plaza strike — Rose's "we end this in eight minutes"
    // brief is explicitly nocturnal in the intro ("the worst
    // version of their own night out loud"). Fog-of-war turns the
    // rebellion strike into the surgical interior fight it's
    // meant to be.
    darkBattle: true,
    // Victory: defeat the Royal Captain. Mirrors the b05/b07/b11
    // defeatUnit pattern. The before_victory beat then plays Rose's
    // death immediately after — the second wave the squad's
    // intelligence missed comes through the back door.
    victory: defeatUnit("royal_captain", { label: "Defeat the Captain" }),
    dialogues: [
      // Round 1: Rose briefs the squad in two sentences and the
      // strike begins. Establishes her voice (precise, calm,
      // forward-leaning) before she dies — without that minute of
      // her IN COMMAND, her death lands as a name on a list. With
      // it, she's a person.
      {
        id: "b13_rose_brief",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Rose", portraitId: "rose", expression: "brisk",
            body: "Maya, north flank with me. Ning, south archer first; she reloads slow. Leo, dactyl on the captain. Amar, center. Eight minutes, and every one thins Dawn's cover." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Confirmed. Rose, when did you sleep last." },
          { speaker: "Rose", portraitId: "rose", expression: "brisk",
            body: "(half-smile) Tomorrow morning, Amar. Plenty of time. Move." }
        ]
      },
      // adjacent_eot Amar/Rose: a moment between them mid-strike.
      // Establishes that Rose has been with Dawn for as long as
      // Maya has — they trained together, share a similar shape.
      // Plants Rose as a real person before the loss.
      {
        id: "b13_rose_amar_brief",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "rose" },
        beats: [
          { speaker: "Rose", portraitId: "rose", expression: "neutral",
            body: "(between strikes) Maya and I shared twelve years in Dawn's cohort. She can play a peasant; I can't. She got planted, I got strikes. Same training, different shapes." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "...You knew about me as long as Maya did, then." },
          { speaker: "Rose", portraitId: "rose", expression: "neutral",
            body: "Longer. I'm the one Maya wrote the reports to, your highness. (Soft.) I'm glad you made it. The version of you Maya described eleven months in was not the version I expected. Easier." },
          { speaker: "Amar", portraitId: "amar",
            body: "Easier than what." },
          { speaker: "Rose", portraitId: "rose",
            body: "Than the version your father was, near the end. Move. The captain just shifted his stance." }
        ]
      },
      // ally_killed_target Amar drops the captain — fires Rose's
      // approval. Sets up the before_victory beat that follows
      // immediately when the victory condition resolves.
      {
        id: "b13_amar_drops_captain",
        trigger: { kind: "ally_killed_target", allyId: "amar", targetId: "royal_captain" },
        beats: [
          { speaker: "Rose", portraitId: "rose", expression: "brisk",
            body: "Clean. Half-step before the thrust. Your father's. (Half-smile.) Madame Dawn will have noticed from the alley." }
        ]
      },
      // before_victory: Rose's death. The second wave through the
      // back door, four bolts at Dawn, Rose stepping into the line.
      // This is the chapter's spine — the rebellion is real not
      // when the captain falls but when Rose does. Dawn's grief
      // closes the post arc.
      {
        id: "b13_rose_falls",
        trigger: { kind: "before_victory" },
        // Death cue — Rose's sacrifice. Overrides the battle theme for
        // the duration of the death dialogue. No restoreMusic (it's a
        // before_victory beat; EndScene takes the music next).
        music: MUSIC.death,
        beats: [
          { portraitId: "narrator",
            body: "The captain's body settles into the marble. The crown archers' bolts go quiet. The squad takes one breath and the plaza is theirs." },
          { portraitId: "narrator",
            body: "Then the supposedly bricked-over back door swings open. Four crossbows in royal blue, angled on the alley mouth. Madame Dawn is in the alley mouth, hood down." },
          { speaker: "Rose", portraitId: "rose", expression: "falling",
            body: "DAWN — " },
          { portraitId: "narrator",
            body: "Rose covers twenty paces in three strides. She doesn't draw, doesn't call again. She plants herself at Dawn's shoulder, back to the four crossbows, front to Dawn." },
          { portraitId: "narrator",
            body: "Four bolts, four hits. Rose holds long enough for Dawn to understand, then drops without a sound. Maya, Ning, Leo, Amar kill the crossbowmen in seconds. Too late." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "(quietly) ...Rose. Rose. Rose, look at me. Rose. Rose. Rose." },
          { portraitId: "narrator",
            body: "Dawn does not raise her voice or weep. She kneels in the blood, takes Rose's hand, and holds it. Nobody moves. Maya looks away first." }
        ]
      }
    ]
  },
  // ============== Battle 14 — The Origin ==============
  // The reveal chapter. In the before_origin arc Dawn finally tells
  // Amar his parentage — he is her son, and King Archbold's. The
  // conversation is barely an hour old when Archbold's household guard
  // arrives to retrieve the heir. The empire wants Amar alive: a dead
  // heir is a scandal to bury, a living one is a key to turn. The
  // squad fights the retrieval detail off the safe-house street.
  {
    id: "b14_origin",
    index: 14,
    title: "Fourteenth Battle",
    subtitle: "The Origin",
    intro:
      "Barely an hour into the conversation, the candle-maker downstairs taps the warning rhythm. King Archbold's household guard has found the safe house. The empire doesn't want Amar dead — a living heir is a key it can turn. Lord Castor's orders: take the emperor's son breathing. The squad has other plans. Maya is already at the door.",
    outro:
      "Castor's detail retreats, carrying their commander. The retrieval failed — but it was a message: the empire knows what Amar is, and it will keep reaching. In the study, Dawn finishes her sentence. Half of Amar's blood is the rebellion's. The other half is the throne it exists to break.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: originMap,
    buildPlayers: () => [
      // Post-Rose squad of four. Map player slots are ordered
      // [Maya, Amar, Ning, Leo] — buildPlayers must match.
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Lord Castor's household retrieval detail — 5 elite + the
      // Knight-Captain. Levels bumped over B13: this is Archbold's
      // own household guard, not provincial garrison.
      ENEMIES.imperialKnight(15),
      ENEMIES.royalArcher("org_ra1", 1401, 14),
      ENEMIES.royalArcher("org_ra2", 1402, 14),
      ENEMIES.royalGuard("org_rg1", 1403, 14),
      ENEMIES.royalGuard("org_rg2", 1404, 14),
      ENEMIES.royalGuard("org_rg3", 1405, 14)
    ],
    difficultyLabel: "Reveal — The Heir",
    // Spoils: 2 elixirs from the safe-house stores + the Royal Lens
    // off Castor's belt. Narratively the lens is Archbold-issue
    // household-guard kit — the first piece of his birth father's
    // empire Amar carries on his own person.
    rewards: ["elixir", "elixir", "royal_lens"],
    // Victory: defeat Lord Castor. Mirrors the b05/b07/b11/b13
    // defeatUnit pattern — breaking the retrieval means dropping the
    // officer who carries the order.
    victory: defeatUnit("imperial_knight", { label: "Defeat Lord Castor" }),
    dialogues: [
      // Round 1: Castor's arrival. He states the retrieval order out
      // loud, which recontextualizes the fight for the player — the
      // enemy wants Amar ALIVE. The squad answers.
      {
        id: "b14_castor_arrival",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Lord Castor", portraitId: "royal_guard", expression: "neutral",
            body: "Squad of the Anthros coup: you harbour one Amar. By authority of King Archbold of Grude, I will take him, unharmed, tonight. Stand aside and nobody bleeds." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "\"Unharmed.\" Listen to that, Amar. Every other officer who has come at us in two years wanted you dead. This one has orders to keep you breathing. That tells you exactly how much the study just changed." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "It changes nothing about the next ten minutes. Castor, you can carry that order back up the street or you can carry your men. Squad: break their line. Nobody takes me anywhere tonight." }
        ]
      },
      // adjacent_eot Amar/Castor — the personal exchange. Castor is
      // not cruel; he's a professional who genuinely thinks Amar
      // belongs in Grude. The first voice to frame Amar's heritage
      // as a homecoming rather than a threat.
      {
        id: "b14_amar_castor",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "imperial_knight" },
        beats: [
          { speaker: "Lord Castor", portraitId: "royal_guard", expression: "neutral",
            body: "You fight like your mother's side, hold a line like your father's. I served his household guard twenty years. You belong in the capital, not a safe-house floor." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "I had a name. A forge. A country I bled for. You don't get to be the third person this month telling me who I am." },
          { speaker: "Lord Castor", portraitId: "royal_guard", expression: "neutral",
            body: "(quietly) No. I suppose I don't. But the King will, Amar, sooner than you would like. Mind the archers behind me. My orders said unharmed. They did not say comfortable." }
        ]
      },
      // before_victory: Castor falls, the retrieval breaks. He goes
      // down still treating it as the opening move of a longer game —
      // because for the empire, it is.
      {
        id: "b14_castor_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Lord Castor takes a knee, hand pressed to his side. No rally. His men close around him and withdraw up the street. Household guard do not rout." },
          { speaker: "Lord Castor", portraitId: "royal_guard", expression: "neutral",
            body: "Tonight goes in a report, not a grave. The King can wait till spring. Welcome to the family, your highness. Larger and worse than you think." },
          { portraitId: "narrator",
            body: "The detail clears the street and is gone. The candle-maker's warning rhythm stops. Only breathing in the empty street, and Dawn's unfinished sentence waiting upstairs." }
        ]
      }
    ]
  },
  // ============== Battle 15 — A Coup Within a Coup ==============
  // The leak chapter. Maya's hunt (seeded in post_origin) closes on
  // Quartermaster Coyne — Dawn's own Grude safe-house quartermaster,
  // and Archbold's mole. The leak that put Castor's detail on the
  // safe house at B14. Cornered, Coyne strikes Ndara down (a coma,
  // not a grave) and makes his stand at the courtyard's back gate
  // with the people he turned + the imperial agents he smuggled in.
  {
    id: "b15_inner_coup",
    index: 15,
    title: "Fifteenth Battle",
    subtitle: "A Coup Within a Coup",
    intro:
      "Maya found the seam: every message for three months passed through Quartermaster Coyne. He is the leak — how Castor's detail found the door. Ndara worked it out first and faced him alone. They found her in the courtyard, breathing, not waking. Coyne waits at the back gate with turned men and imperial agents. He means to leave on his terms.",
    outro:
      "Coyne goes down at the gate he never reached. The safe house is theirs again — and Dawn knows now it was never safe. Ndara breathes upstairs and does not wake. For thirty years Dawn has asked people to follow her. After tonight, the asking stops.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: courtyardMap,
    buildPlayers: () => [
      // Post-Rose squad of four. Ndara is in a coma — not on the
      // field. Map player slots are ordered [Maya, Amar, Ning, Leo].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Coyne + the faction he assembled: two turncoat rebels (people
      // his coin bought, modelled on the bandit factories — rebel-tier
      // fighters) and two imperial agents (the empire muscle he
      // smuggled through the wall, modelled on the royal factories).
      // The mix tells the story without a line of dialogue.
      ENEMIES.turncoat(14),
      ENEMIES.royalGuard("icp_rg1", 1501, 14),
      ENEMIES.royalArcher("icp_ra1", 1502, 14),
      ENEMIES.banditSwordsman("icp_tc1", 1503, 13),
      ENEMIES.banditArcher("icp_tc2", 1504, 13),
      ENEMIES.banditSpearton("icp_tc3", 1505, 13)
    ],
    difficultyLabel: "Intrigue — The Mole",
    // Spoils: the traitor's confiscated kit. 2 elixirs + 1 mask + 1
    // fang. Dawn lets the squad keep all of it because none of her
    // remaining officers want to wear a dead traitor's gear.
    rewards: ["elixir", "elixir", "mask", "fang"],
    // Victory: defeat Coyne. The turncoats + agents scatter once the
    // man paying them is down — mirrors the boss-kill pattern.
    victory: defeatUnit("turncoat", { label: "Defeat Quartermaster Coyne" }),
    dialogues: [
      // Round 1: Coyne, exposed, does not deny it — he justifies it.
      // Maya gets the cold "I had you" beat; Coyne answers with the
      // mole's logic.
      {
        id: "b15_coyne_exposed",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
            body: "Coyne. Three months of manifests, every one past your desk. Ndara had you before I did. You put her on a courtyard stone. You get nothing." },
          { speaker: "Quartermaster Coyne", portraitId: "coyne",
            body: "Sat down, not buried. That's why I'll sleep. Nine years watching Dawn spend people like coin, call it arithmetic. Rose. She'll spend you too. Archbold pays in advance." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "You sold the door, Coyne. Castor's crossbows were in that street because of you. Whatever Dawn is, you didn't fix it. You just picked the side that signs bigger receipts. Squad: he does not reach that gate." }
        ]
      },
      // adjacent_eot Amar/Coyne — Coyne is not a swordsman and he
      // knows it; his weapon is the squad's doubt. He aims it at Amar.
      {
        id: "b15_amar_coyne",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "turncoat" },
        beats: [
          { speaker: "Quartermaster Coyne", portraitId: "coyne",
            body: "You're the worst-kept secret here: the emperor's lost boy. Ask yourself, as you cut me down: when Dawn's plan costs another Rose, whose arithmetic then, hers or yours?" },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "I'll be doing Lucian's. Fight, Coyne. You don't get to poison the well and call it a warning." }
        ]
      },
      // before_victory: Coyne falls short of the gate. He dies the
      // way a quartermaster dies — still counting.
      {
        id: "b15_coyne_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Coyne drops six strides from the back gate. His turncoats lower their blades. Bought men don't die for a corpse. The imperial agents withdraw in good order." },
          { speaker: "Quartermaster Coyne", portraitId: "coyne",
            body: "Nine years of her ledgers... finished by six strides of bad luck. Tell Dawn: the safe house was never the leak, just whoever did her arithmetic aloud first." },
          { portraitId: "narrator",
            body: "He says nothing more. Upstairs, Ndara breathes and does not wake. Somewhere, Dawn learns the man who gave the empire her door ran her supply line nine years." }
        ]
      }
    ]
  },
  // ============== Battle 16 — Dawn's Proposal ==============
  // The proposal chapter. In before_proposal Dawn asks Amar to claim
  // the Anthros throne as the rebellion's open heir once Archbold
  // falls. He gives her a "not yet." That same night, on a bridge
  // over the Grude river, the empire delivers its own answer: King
  // Archbold has decided a living heir is more dangerous than a dead
  // one, and sends Wren — the King's Knife — to end the problem. The
  // shift from "retrieve" (B14) to "kill" is the chapter: Amar is
  // deciding what kind of son he is while his father decides the
  // same about being a father.
  {
    id: "b16_proposal",
    index: 16,
    title: "Sixteenth Battle",
    subtitle: "Dawn's Proposal",
    intro:
      "Dawn's proposal still sits unanswered in Amar's chest when she sends the squad across the river after dark — an ordinary errand. Halfway over the bridge, the far lamps die one by one, and two figures step out behind you. Archbold has stopped trying to retrieve his son. The woman walking toward Amar is Wren. The King calls her his Knife.",
    outro:
      "Wren falls on the bridge meant to be Amar's grave. The empire's message lands anyway: no version of next year leaves him alone. Hide, they hunt him. Take the throne, they fight him. Dawn was right — the only choice is which cost. She'll ask again. His answer is closer.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: bridgeMap,
    buildPlayers: () => [
      // Post-Rose squad of four. Map slots ordered [Maya, Amar, Ning, Leo].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Wren + a household kill-team: the empire's main force holds
      // the east end (2 crown archers + a royal guard) while two
      // hired knives spring the pinch from behind the squad.
      ENEMIES.kingsKnife(16),
      ENEMIES.royalGuard("prp_rg1", 1601, 15),
      ENEMIES.royalArcher("prp_ra1", 1602, 15),
      ENEMIES.royalArcher("prp_ra2", 1603, 15),
      ENEMIES.banditSwordsman("prp_kn1", 1604, 14),
      ENEMIES.banditSwordsman("prp_kn2", 1605, 14)
    ],
    difficultyLabel: "Choice — The King's Knife",
    // Spoils: a Royal Lens off Wren's kit + 2 elixirs. The lens was
    // the King's-Knife issue optic; Amar carries his would-be
    // assassin's gear out of the fight.
    rewards: ["royal_lens", "elixir", "elixir"],
    // Victory: defeat Wren. The kill-team is a contract, not a cause —
    // they break the moment the Knife is down.
    victory: defeatUnit("kings_knife", { label: "Defeat Wren" }),
    dialogues: [
      // Round 1: the ambush springs. Wren names the new order — kill,
      // not retrieve — and the squad understands the empire's posture
      // has changed.
      {
        id: "b16_wren_ambush",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Wren", portraitId: "royal_guard", expression: "neutral",
            body: "Don't run. The bridge ends. Castor's orders: bring you home unharmed. Mine are shorter. The King decided he can bury the scandal. You'd have been a tolerable prince." },
          { speaker: "Maya", portraitId: "maya", expression: "alarmed",
            body: "Two behind, three ahead. The talker is Wren, the whole problem. Drop her, the contract dissolves; the rest are paid men. Tight formation. She doesn't get you alone." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "My father sent a knife to a bridge. (A breath.) Then I have my answer to half of Dawn's question already. Squad, break the east end. Wren is mine." }
        ]
      },
      // adjacent_eot Amar/Wren — the assassin is not a believer; she's
      // a professional, and professionals talk while they work. She
      // tells Amar the one true thing the empire taught her.
      {
        id: "b16_amar_wren",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "kings_knife" },
        beats: [
          { speaker: "Wren", portraitId: "royal_guard", expression: "neutral",
            body: "Your father pays me because I never ask if the name deserves it. Your mother's list is coming. Read before you sign? Castor wouldn't. I don't. You?" },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "I've buried people off other people's lists for two years, Wren. I've started reading. (Steel up.) That's the difference between us, and it's about to be a wide one." }
        ]
      },
      // before_victory: Wren falls. She dies the way she lived — a
      // professional, unsurprised, settling the account.
      {
        id: "b16_wren_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Wren goes down on the open deck she wanted Amar on. The hired knives melt away. A contract does not outlive the contractor. The squad has the span." },
          { speaker: "Wren", portraitId: "royal_guard", expression: "neutral",
            body: "Faster than Castor said. Good. Your father will send someone after me, and after them. Take the crown or don't, your highness, but stop standing in the open." },
          { portraitId: "narrator",
            body: "The squad carries Dawn's crate across. Errand finished, courier met. Technically a success. Every one of them is doing the arithmetic Wren named; nobody likes the total." }
        ]
      }
    ]
  },
  // ============== Battle 17 — Dawn's Lie ==============
  // The chapter the whole Grude arc has been building toward. In
  // before_lie, Khione tells Amar the part Dawn has told no one: the
  // rebellion's strategy spends Anthros. The heir is bait — a trueborn
  // claimant openly taking the colony's throne is a provocation
  // Archbold MUST answer with a war that burns Anthros, and a colony
  // visibly burning is what finally turns Grude against its own
  // throne. Kian was right on the cliff; he only had it half-sized.
  // The squad breaks with Dawn and runs for Khione's ship — and
  // Marshal Othren's loyalists, true believers in the plan, form a
  // line to stop the rebellion's lynchpin from walking.
  {
    id: "b17_lie",
    index: 17,
    title: "Seventeenth Battle",
    subtitle: "Dawn's Lie",
    intro:
      "Khione tells Amar everything on the water: Dawn's rebellion was never meant to free Anthros but to spend it — crown him, force King Archbold to burn the colony, and let a hundred million deaths turn Grude against its crown. Kian was right; Amar is the spark. The squad runs for Khione's ship — Marshal Othren's loyalists already hold the dock.",
    outro:
      "Khione casts off before the lines clear. Grude falls astern with a woman who is both the mother who crossed an ocean for Amar and the strategist who priced his homeland. She loves him. She lied to him. Both true. Ahead is the first space no one has already shaped.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: quayMap,
    buildPlayers: () => [
      // Post-Rose squad of four. Khione readies the ship — she is
      // narratively present but not a combatant. Map slots ordered
      // [Maya, Amar, Ning, Leo].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Marshal Othren + Dawn's loyalist rank-and-file. Her rebellion's
      // fighters are bandit-tier (they have been "Madame Dawn's
      // bandits" mechanically since B3) — so the line the squad has to
      // break is built from the bandit factories, not the royal ones.
      // These are not the empire. These are people who believe.
      ENEMIES.dawnLoyalist(15),
      ENEMIES.banditSwordsman("lie_lo1", 1701, 14),
      ENEMIES.banditSpearton("lie_lo2", 1702, 14),
      ENEMIES.banditArcher("lie_lo3", 1703, 14),
      ENEMIES.banditArcher("lie_lo4", 1704, 14),
      ENEMIES.banditSwordsman("lie_lo5", 1705, 14)
    ],
    difficultyLabel: "Reveal — The Break with Dawn",
    // Spoils: 2 potions + 1 fang — what the squad can grab off the
    // quay on the way to the gangway. Modest: they are leaving Dawn's
    // hospitality at a dead run, not looting at leisure.
    rewards: ["potion", "potion", "fang"],
    // Victory: escape to the ship's gangway OR rout Othren's line.
    // Mirrors B10 (Leaving Thuling) — the cinematic intent is to board
    // and go, but a player who wants the full clear can take it.
    victory: anyOf(
      escapeToTile({ x: 6, y: 9 }, { label: "Reach Khione's ship" }),
      routEnemies
    ),
    dialogues: [
      // Round 1: Othren forms the line. He is not the empire and not
      // a traitor — he is a believer, and the believer's case is the
      // hardest one the squad has had to cut through.
      {
        id: "b17_othren_line",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Marshal Othren",
            body: "Far enough. Nothing against you, but the man in your formation is the cause now. Dawn won't lose her heir to a boat. Turn around, Amar." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "I know the plan, Othren. \"The heir mattering\" ends with Thuling on fire, Orinhal on fire, every village Maya can name on fire. I won't be the torch." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "He won't be talked round; he's wanted this for weeks. Othren's the anchor: break him or break past. Gangway's the win. Squad, south. We're getting on that ship." }
        ]
      },
      // adjacent_eot Amar/Othren — the believer says the quiet part
      // plainly. This is the lie confirmed from the inside: yes, the
      // colony burns; yes, he has done the arithmetic; yes, he can
      // still sleep. The most chilling voice in the arc is the sincere
      // one.
      {
        id: "b17_amar_othren",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "dawn_loyalist" },
        beats: [
          { speaker: "Marshal Othren",
            body: "Nine years I've pictured it, Amar: Thuling burns, innocents with it, and Grude's cities put down their emperor. Forever. I sleep well. You fight a man who counted." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "Then you and Coyne would have had a great deal to say to each other. He counted too. (Steel up.) I'm done being a number in everyone's sum, Othren. Mine or hers or yours. Move." }
        ]
      },
      // before_victory: the squad reaches the gangway. Othren, down or
      // bypassed, does not chase — he was an anchor, not a hound.
      {
        id: "b17_break_through",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The line breaks. The gangway opens, Khione at the rail, hand out. Othren's loyalists don't chase: posted to hold a dock, not hunt a son. The only mercy." },
          { speaker: "Marshal Othren",
            body: "(calling after them) She'll let you go. Your mother plans every road. You're just a different line of her arithmetic. ...Fair winds, your highness. I always did." },
          { portraitId: "narrator",
            body: "The squad crosses onto Khione's ship. Grude slides away. For the first time since Thuling, no one at the next harbor has already written what Amar will do." }
        ]
      }
    ]
  },
  // ---- B18: Seven Paths divergence point -------------------------------------
  // The pivotal chapter. Mechanically a swarm-repel fight on the deck of
  // Khione's ship: the empire sends one last boarding party after the heir
  // three days out of Grude, and the squad has to break it. Narratively it's
  // the hinge — before_path_chosen asks the question out loud; this fight is
  // the last obstacle between Amar and the answer; post_path_chosen routes to
  // ChoiceScene, where the player commits to one of the seven philosophies.
  // The choice writes save.flags["seven_paths.choice"] (one of SevenPath) via
  // setSevenPath; subsequent path battles filter visibility on that flag.
  {
    id: "b18_path_chosen",
    index: 18,
    title: "Eighteenth Battle",
    subtitle: "Seven Names, One Choice",
    intro:
      "Three days out, the empire plays its last hand. A fast imperial cutter runs Khione's ship down at dusk and throws grapnels — household troops with one order: the heir does not reach the far shore. Nowhere to retreat. Break the boarders, and the next decision Amar makes will be the first that is truly his.",
    outro:
      "The last boarder goes over the rail and the cutter sheers off. Ahead lies a coast that belongs to nobody — where Amar will finally answer the question he has carried since a hospital bed in Thuling. Seven names. One choice. The path begins where the keel touches sand.",
    music: MUSIC.grudeBattle1,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: shipDeckMap,
    buildPlayers: () => [
      // Post-Rose squad of four. Khione holds the wheel (present, not a
      // combatant). Map slots ordered [Maya, Amar, Ning, Leo].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // An imperial household boarding party — royal-tier, NOT bandits. This
      // is the empire's own men, the last grab at the heir. A line-captain
      // (strongest royal guard) leads from the bow; the rest swarm the rails.
      ENEMIES.royalGuard("pc_cap", 1801, 16),
      ENEMIES.royalGuard("pc_bd1", 1802, 15),
      ENEMIES.royalGuard("pc_bd2", 1803, 15),
      ENEMIES.royalGuard("pc_bd3", 1804, 14),
      ENEMIES.royalGuard("pc_bd4", 1805, 14),
      ENEMIES.royalArcher("pc_ar1", 1806, 15),
      ENEMIES.royalArcher("pc_ar2", 1807, 15)
    ],
    difficultyLabel: "Pivotal — The Last Boarding",
    unlocks: null, // ChoiceScene unlocks the chosen path opener
    // Spoils: 3 elixirs + 1 royal lens. Last "neutral" reward set
    // before the path-specific openers branch the loadouts in B19.
    // The squad outfits for whatever comes next.
    rewards: ["elixir", "elixir", "elixir", "royal_lens"],
    // Victory: rout the boarding party. No boss — it's a swarm to be broken,
    // and breaking it is what clears the way to the choice.
    victory: routEnemies,
    dialogues: [
      // Round 1: the boarders hit the deck. The line-captain states the
      // order; Amar names what's actually at stake; Maya calls the fight.
      {
        id: "b18_boarders",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Imperial Captain", portraitId: "royal_guard", expression: "neutral",
            body: "Heir of Anthros! King Archbold's instruction: you don't reach the far shore. Strike your colours, it's quick. Fight, it won't be. The sea is the King's." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "My father's men swore it was decided: at the hospital, the cliff, the bridge. (Draws.) Not this ship. Squad, hold the waist, keep them off the wheel." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "Seven boarders, rails and bow. Tight line at the masts, let the crates eat arrows. Leo, the bow. Ning, archers first. Win, and Amar gets his quiet minute." }
        ]
      },
      // adjacent_eot Amar/Imperial Captain — the captain is a professional
      // soldier, not a believer; he says the one true thing the empire's
      // service taught him, echoing Wren on the bridge without knowing it.
      {
        id: "b18_amar_captain",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "pc_cap" },
        beats: [
          { speaker: "Imperial Captain", portraitId: "royal_guard", expression: "neutral",
            body: "Twenty years I've carried the King's orders. There's always another bridge. He doesn't stop. The only men free of Archbold's arithmetic stopped being worth the ink, your highness." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "Funny. (Steel up.) That's one of the seven things I'm deciding between. I'll let you know which way I land, but you won't be on this deck to hear it. Move, Captain." }
        ]
      },
      // before_victory: the boarding party breaks. The captain, down or
      // bypassed, gives the empire's verdict on the heir as the cutter pulls
      // away — and the deck goes quiet for the choice to come.
      {
        id: "b18_deck_clears",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The boarding party breaks the way a wave breaks: all at once, then gone. The cutter cuts its grapnels and runs. Khione never let go of the wheel." },
          { speaker: "Imperial Captain", portraitId: "royal_guard", expression: "neutral",
            body: "Faster than the King expected. He'll send another; he always does. Not before that coast. A man gets few hours nobody owns. Spend yours better than mine, heir." },
          { portraitId: "narrator",
            body: "The deck is quiet. Ahead, the coast that belongs to nobody. Amar has seven names in his mouth and, for the first time, no one to answer for him." }
        ]
      }
    ]
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
    intro: "Selene's answer. The squad rides inland from the landfall coast with a list in Amar's saddlebag, written in his own hand. The first name on it is Lord Castor — the King's knight-captain, the man who took Amar off a Grude street to hand him to his father's knife. His column crosses the canyon road tonight.",
    outro: "Castor's blood is the first you've spilled in your own name — not the rebellion's, not the empire's. Yours. The squad says nothing on the ride back. At the fire, Maya quietly hands you the list. There's a second name on it now, and the handwriting isn't yours.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_caravan",
    playable: true,
    map: caravanMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Lord Castor again — B14's retrieval knight, now the first name on
      // the list. His household escort is royal-tier; this is an ambush on
      // an imperial column, not a bandit raid.
      ENEMIES.imperialKnight(17),
      ENEMIES.royalGuard("vg_rg1", 1901, 15),
      ENEMIES.royalGuard("vg_rg2", 1902, 15),
      ENEMIES.royalArcher("vg_ra1", 1903, 15),
      ENEMIES.royalArcher("vg_ra2", 1904, 14)
    ],
    difficultyLabel: "Vengeance · Opener",
    unlocks: "b20_dawn_war", // war path continues into B20
    // Vengeance loadout — kill harder. Two Fangs (Castor's ceremonial
    // daggers, kept as trophies for Selene).
    rewards: ["fang", "fang", "potion"],
    // Victory: kill Castor. His escort is duty, not devotion — they break
    // when he falls.
    victory: defeatUnit("imperial_knight", { label: "Kill Lord Castor" }),
    dialogues: [
      {
        id: "b19v_ambush",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Lord Castor", portraitId: "royal_guard", expression: "neutral",
            body: "The heir. (He doesn't reach for his sword yet.) I carried you gently, boy. Whoever comes after me won't. Ride away and I'll write that I never saw you." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "You carried me gently to a knife, Castor. You're the first name on a list I wrote myself. (Draws.) No more reports. Squad: the escort breaks when he falls." }
        ]
      },
      {
        id: "b19v_amar_castor",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "imperial_knight" },
        beats: [
          { speaker: "Lord Castor", portraitId: "royal_guard", expression: "neutral",
            body: "Wren told me you'd started reading the lists. (Steel up.) So read your own, your highness. Every name on it will cost you a piece of the man who wrote it. I'm the cheap one." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "I know the price, Castor. I did the arithmetic. (A breath.) I'm my mother's son after all." }
        ]
      },
      {
        id: "b19v_castor_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Castor goes down on the canyon road, and his escort scatters into the dark. Duty runs out where the pay does. The column's lanterns burn on the stones. Nobody speaks." },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "(quietly) First name. (She folds the list back into his saddlebag.) I'll keep the ledger, Amar. Somebody who loves you should be the one counting." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_restoration",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The First Stone Laid",
    intro: "Lucian's answer. The squad rides from the landfall coast for the Anthros border, to a village that remembers Amar's father — Khonu's village. The war has made the roads lawless, and a raider band has been bleeding the village for a month. They will let you stay if you can hold the road.",
    outro: "Three families fly an old flag from their doorposts that night. It is not the King's flag. It is not Dawn's flag. It is yours — if you can keep them safe. Rebuilding starts the way Lucian said everything starts: with one held road and one kept promise.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: true,
    map: dawnBanditsMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // War-scavengers — the lawlessness the empire's war leaves behind.
      // Bandit-tier, but numerous and leveled for the late campaign.
      ENEMIES.banditSwordsman("rs_b1", 1911, 15),
      ENEMIES.banditSwordsman("rs_b2", 1912, 14),
      ENEMIES.banditSpearton("rs_b3", 1913, 15),
      ENEMIES.banditSpearton("rs_b4", 1914, 14),
      ENEMIES.banditArcher("rs_b5", 1915, 14),
      ENEMIES.banditArcher("rs_b6", 1916, 14)
    ],
    difficultyLabel: "Restoration · Opener",
    unlocks: "b20_dawn_war", // war path continues into B20
    // Restoration loadout — village gifts. The villagers contribute
    // what they have: 3 potions from the dispensary + 2 masks (the
    // courier's pair, traditionally given to a returning lord).
    rewards: ["potion", "potion", "potion", "mask", "mask"],
    victory: routEnemies,
    dialogues: [
      {
        id: "b19r_hold_the_road",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Lucian held a road like this once, for people he'd never met. (Draws.) These ones knew my father. Squad, nobody gets past us to the houses. Nobody." },
          { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
            body: "Six of them, no discipline; they're used to farmers. (String creaks.) They've never met a held line. Let's teach them what Thuling learned." }
        ]
      },
      {
        id: "b19r_leo_aside",
        trigger: { kind: "adjacent_eot", unitA: "leo", unitB: "amar" },
        beats: [
          { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
            body: "Captain. The old man on the porch has been watching you fight for two rounds. (A beat.) He keeps nodding. Like he's checking your form against somebody he remembers." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "Then let's not embarrass the memory. West flank, Leo. Go." }
        ]
      },
      {
        id: "b19r_road_held",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The last raider drops his blade and runs, and doesn't look back. The road is quiet. On the porches, one by one, doors that have been barred for a month come open." },
          { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
            body: "No throne. No arithmetic. Just a held road and people who can sleep. (Quietly.) I could learn to like your version, Amar." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_revolution",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "Burn the Granary",
    intro: "Maya's answer. The imperial depot on the border road is where the colony's taxed grain sits before it ships to Archbold's field armies. Burn it, and the armies go hungry, the tax stops meaning anything, and every village on the road learns the empire can bleed. Maya has been planning this strike since before she met you.",
    outro: "The granary burns, smoke visible from the border garrison and, by week's end, far beyond. Nobody starves who wasn't already — that grain was never coming home. What spreads is the news: the empire can bleed. Maya's prediction holds inside the week.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: granaryMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // The depot garrison — royal-tier supply troops under a depot
      // commander. They fight for the stores, not for glory.
      ENEMIES.royalCaptain(16),
      ENEMIES.royalGuard("rv_rg1", 1921, 15),
      ENEMIES.royalGuard("rv_rg2", 1922, 15),
      ENEMIES.royalGuard("rv_rg3", 1923, 14),
      ENEMIES.royalArcher("rv_ra1", 1924, 15),
      ENEMIES.royalArcher("rv_ra2", 1925, 14)
    ],
    difficultyLabel: "Revolution · Opener",
    unlocks: "b20_dawn_war", // war path continues into B20
    // Revolution loadout — burn it down. Two Fangs from the granary
    // guards + the captain's Royal Lens (Maya keeps it pointedly).
    rewards: ["fang", "fang", "royal_lens"],
    // Victory: break the garrison commander — with him down, the depot
    // can't be held and the fire gets set.
    victory: defeatUnit("royal_captain", { label: "Break the depot garrison" }),
    dialogues: [
      {
        id: "b19rv_maya_brief",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "Commander at the north stores, six on the yard. Sledges burn if a lamp sneezes: steel, then one match, on my mark. Nine years I've known this yard." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then it's your strike. I'm just the sword in it. (Draws.) Squad, on Maya's plan. Break the commander; the garrison folds without him." }
        ]
      },
      {
        id: "b19rv_maya_amar",
        trigger: { kind: "adjacent_eot", unitA: "maya", unitB: "amar" },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "(between strikes) You could've been a king, and you're torching depots with me instead. No regrets yet?" },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "Crowns are how this started, Maya. (Steel up.) Fires are how it ends. Watch the archer on your left." }
        ]
      },
      {
        id: "b19rv_the_match",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The commander falls and the garrison breaks for the gate. Supply men don't die for warehouses. Maya walks the yard alone, unhurried, and sets one lamp against the tally post." },
          { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
            body: "For the villages that grew it and never ate it. (The light catches.) Burn well." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_duty",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "Reporting for Service",
    intro: "Khonu's answer. The war has reached the border, and the rebellion's expeditionary column needs officers more than it needs symbols. Amar walks into the regimental tent in his father's old colors, accepts a captaincy with his eyes open, and draws his first command: a column too thin to hold the frontier bridge it's been assigned. Hold it anyway.",
    outro: "The bridge holds. The column does not, entirely. Amar writes three letters that night in the regulation format, and learns the names of three soldiers who will be in his dreams for the rest of his life. Khonu would have told him: that is what the captaincy is. The letters are the job.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: dutyBridgeMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // An imperial assault column — more than a thin command should be
      // asked to stop. The battle is the arithmetic of holding.
      ENEMIES.royalGuard("dt_rg1", 1931, 15),
      ENEMIES.royalGuard("dt_rg2", 1932, 15),
      ENEMIES.royalGuard("dt_rg3", 1933, 15),
      ENEMIES.royalGuard("dt_rg4", 1934, 14),
      ENEMIES.royalArcher("dt_ra1", 1935, 15),
      ENEMIES.royalArcher("dt_ra2", 1936, 15)
    ],
    difficultyLabel: "Duty · Opener",
    unlocks: "b20_dawn_war", // war path continues into B20
    // Duty loadout — military precision. Standard officer kit: 1
    // royal lens + 1 mask + 2 potions. The quartermaster gives Amar
    // exactly what regulations specify, no more.
    rewards: ["royal_lens", "mask", "potion", "potion"],
    // Victory: survive the assault. Killing the column isn't the order —
    // holding the bridge is. Six rounds until the relief column arrives.
    victory: surviveRounds(6),
    dialogues: [
      {
        id: "b19d_the_order",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Orders: the bridge holds until the relief column. Six rounds, maybe seven. We don't have to beat them. We have to still be here. That's the whole job." },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "Look at you. Regulation voice and everything. (Blades out.) Khonu would be insufferable about this. Line on the carts. Make them pay for every plank." }
        ]
      },
      {
        id: "b19d_holding",
        trigger: { kind: "round_start", round: 4 },
        beats: [
          { speaker: "Ning", portraitId: "ning", expression: "exhausted",
            body: "(bowstring hand bleeding) Captain, half my quiver's gone and they're still coming." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Then the other half is enough, because it has to be. Two more rounds, Ning. Hold. That's the whole order and the whole speech." }
        ]
      },
      {
        id: "b19d_relief",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Relief horns from the west road. The imperial push breaks off, deliberate as it came. The bridge belongs to a column too thin to hold it. It held." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(quietly, to no one) Khonu. I read the order before I signed it. I'd sign it again. (A breath.) That's the part I didn't know about you until tonight." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_exile",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The Long Road North",
    intro: "Tev's answer. Amar leaves the squad at the landfall camp and rides north alone for the cold country, telling no one the route — he doesn't know it himself. Two days out, in a snow pass too steep to flank, three sets of tracks converge on his. The assassins found him anyway. Alone means alone.",
    outro: "You bury them where they fell, because someone should, and there is no one else. You ride on. The country gets colder. The names you carried lose syllables one by one — and the one the empire is hunting is the only one that will not wear away.",
    music: MUSIC.strongholdMemories,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_mountain",
    playable: true,
    map: exilePassMap,
    buildPlayers: () => [
      // No one else is coming. That's the path.
      PLAYERS.amar()
    ],
    buildEnemies: () => [
      // A hired kill team — the empire's long arm, contracted quiet.
      // Bandit-tier factories as hired knives (B16's precedent), leveled
      // to make a solo fight honest but winnable.
      ENEMIES.banditSwordsman("ex_a1", 1941, 14),
      ENEMIES.banditSwordsman("ex_a2", 1942, 14),
      ENEMIES.banditArcher("ex_a3", 1943, 13)
    ],
    difficultyLabel: "Exile · Solo",
    unlocks: null, // an ENDING: exile leaves the war
    // Exile loadout — survival only. 3 elixirs from the assassins'
    // packs (they came prepared to take a long time killing him).
    // No equipment — Amar carries no signature gear on this path.
    rewards: ["elixir", "elixir", "elixir"],
    victory: routEnemies,
    dialogues: [
      {
        id: "b19e_three_tracks",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { portraitId: "narrator",
            body: "They don't call out and they don't offer terms. Professionals. The one on the saddle ahead just nods, almost politely, and the two on the flanks start closing the jaws." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "(to the empty pass) I left the crown. I left the war. I left everyone who'd have stood here with me. That was the point. (Draws, alone.) So this one's just mine." }
        ]
      },
      {
        id: "b19e_buried",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The pass goes quiet the way only snow country goes quiet. Three men lie where the jaws failed to close. Amar stands alone in the middle of it, breathing hard, and no one cheers, because no one is there." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(finding the shovel strapped to their packhorse) You came prepared to bury someone. (A long breath.) Fine. Someone gets buried." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_mercy",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The Open Hand",
    intro: "Yul's answer. Greywall Fort has tried to surrender three times — to the empire's own inspectors, to a rebel column, to anyone — and been refused each time, because a war this old has forgotten what surrender is for. Amar rides to its gate under his own banner and offers terms a fourth time. The garrison lays down its arms. Its captain does not.",
    outro: "The garrison keeps its surrender. By morning the fort's armoury is a hospital, wounded from both armies in adjacent cots, fed from the same pot. At the edge of the lamplight, Selene watches a long time, says nothing, and is gone before dawn.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: fortMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      // Only the holdout captain and his few hardliners fight — the rest
      // of the garrison has stood down and watches from the walls.
      // Deliberately sparse: a duel of conviction, not a siege.
      ENEMIES.royalCaptain(16),
      ENEMIES.royalGuard("mc_rg1", 1951, 15),
      ENEMIES.royalGuard("mc_rg2", 1952, 15),
      ENEMIES.royalArcher("mc_ra1", 1953, 14)
    ],
    difficultyLabel: "Mercy · Opener",
    unlocks: "b20_dawn_war", // war path continues into B20
    // Mercy loadout — heal others. Heavy on consumables, light on
    // weapons. The fort's medical stores reorganized into a
    // hospital give the squad 4 elixirs + 2 potions, no equipment.
    rewards: ["elixir", "elixir", "elixir", "elixir", "potion", "potion"],
    // Victory: subdue the holdout captain. The garrison's surrender
    // stands the moment he can no longer refuse it for them.
    victory: defeatUnit("royal_captain", { label: "Subdue the holdout captain" }),
    dialogues: [
      {
        id: "b19m_terms_refused",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Holdout Captain", portraitId: "royal_guard", expression: "neutral",
            body: "My garrison may kneel. I hold a King's commission, and it does not kneel to a colonial with a borrowed banner. (He draws, alone but for three.) Refuse MY terms, heir." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Your men chose to live, Captain. I'm not here to take that from them, or from you, if you'll let me. (Draws.) Squad: he goes down, nobody dies who doesn't insist on it." }
        ]
      },
      {
        id: "b19m_amar_captain",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "royal_captain" },
        beats: [
          { speaker: "Holdout Captain", portraitId: "royal_guard", expression: "neutral",
            body: "(pressed, bleeding) Why won't you finish it? Mockery is worse than a blade, boy." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Nobody's mocking you. A surgeon taught me you can stop a man without ending him. She never once asked which side the wound was on. (Steel up.) Yield, Captain. The war will not miss one more body." }
        ]
      },
      {
        id: "b19m_surrender_stands",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The captain goes down and stays down: alive, disarmed, furious, breathing. On the walls, the garrison that watched the whole of it quietly lowers the last of its blades. The fourth surrender is accepted." },
          { speaker: "Ning", portraitId: "ning", expression: "startled",
            body: "(low) Amar. The gate. (A figure at the edge of the lamplight, a scarred face they all know, watching, saying nothing.) ...That's Selene." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_forgetting",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "A Fisherman's Cottage",
    intro: "Sera's answer. Amar rides for the southern coast and stops pretending to be anyone. A cottage. A boat. A name that is not Amar. It holds for a season — until three men with a sketch and a bounty writ come up the beach, and the fisherman meets them at the waterline with a boat-hook and a soldier's hands.",
    outro: "The squad arrives at dusk — too late to help, in time to see he didn't need it. They keep the deal and don't stay, leaving a sword and a potion by the door. You look at both all evening. Come morning, the sword stays. You go out with the boat.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: true,
    map: cottageCoveMap,
    buildPlayers: () => [
      // The fisherman, alone. The name that is not Amar.
      PLAYERS.amar()
    ],
    buildEnemies: () => [
      // Bounty men with a sketch — not soldiers, not professionals like
      // the exile kill team. Leveled just under it: dangerous to a man
      // alone, contemptible to the man this one used to be.
      ENEMIES.banditSwordsman("fg_b1", 1961, 13),
      ENEMIES.banditSwordsman("fg_b2", 1962, 13),
      ENEMIES.banditArcher("fg_b3", 1963, 13)
    ],
    difficultyLabel: "Forgetting · Solo",
    unlocks: null, // an ENDING: forgetting leaves the war
    // Forgetting loadout — minimal. The squad leaves a single
    // potion at the cottage door alongside the sword. Mechanically
    // brutal; narratively the point.
    rewards: ["potion"],
    victory: routEnemies,
    dialogues: [
      {
        id: "b19f_low_tide",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { portraitId: "narrator",
            body: "The one with the sketch looks from the paper to the fisherman and back, twice, and grins. The tide is out. The beach is long. Nobody on it but the four of them." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "(setting down the net, picking up the boat-hook) You have the wrong man. (A breath.) I mean that more honestly than you will ever know. Last chance to believe me." }
        ]
      },
      {
        id: "b19f_the_sword",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "It's over fast. Whatever the fisherman forgets, his hands remember. The bounty men lie in the tide. At the treeline, four riders saw everything. They don't come down." },
          { portraitId: "narrator",
            body: "By dark they're gone. On the doorstep, in the morning: a sword he knows, and a potion, and no note, because a note would be a claim, and they came all this way to not make one." }
        ]
      }
    ]
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
    intro: "Dawn's rebellion has become a war, and the war has found a field. Archbold's western army meets the rebellion an hour's ride from Grude — banners on both ridges, and the squad in the seam between them. General Serrick anchors the imperial line from the northeast rise. Whatever the squad came to this coast to be, today they are soldiers in Madame Dawn's war. Break Serrick, and the line breaks with him.",
    outro: "The line moves. The cost is real. Across the field, Dawn's rebels are cheering a name, and it takes Amar a moment to understand that it is his.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: warFieldMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      ENEMIES.imperialGeneral(18),
      ENEMIES.royalGuard("dw_rg1", 2001, 16),
      ENEMIES.royalGuard("dw_rg2", 2002, 16),
      ENEMIES.royalGuard("dw_rg3", 2003, 16),
      ENEMIES.royalArcher("dw_ra1", 2004, 16),
      ENEMIES.royalArcher("dw_ra2", 2005, 15)
    ],
    difficultyLabel: "Climactic",
    // Victory: break the general. His line is drilled to his position —
    // when he falls, the field folds around the gap.
    victory: defeatUnit("imperial_general", { label: "Break General Serrick" }),
    // Spoils: 3 elixirs + 1 royal lens. First major engagement of
    // the war proper — the squad earns a real haul from a battlefield
    // they actually controlled at the end.
    rewards: ["elixir", "elixir", "elixir", "royal_lens"],
    dialogues: [
      {
        id: "b20_war_begins",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "Look at the field, Amar. Banners on both ridges and us in the seam. This is Dawn's war now. Ours too, whether we signed or not." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then we fight it the way Lucian taught: not for a banner, for the people beside us. Serrick anchors their line. When he breaks, it breaks. Squad, forward." }
        ]
      },
      {
        id: "b20_amar_serrick",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "imperial_general" },
        beats: [
          { speaker: "General Serrick", portraitId: "royal_guard", expression: "neutral",
            body: "The heir himself. Your father bids me ask one last time: whose side, boy? The mother who spends you, or the King who made you?" },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "You people keep offering me sides that belong to other people. I brought my own. (Draws.) Go and ask him what that costs." }
        ]
      },
      {
        id: "b20_line_breaks",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Serrick goes down on the rise he refused to leave, and the imperial line folds around the gap. Across the field the rebellion is cheering one name, over and over. It is not Dawn's." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "(quietly) They're cheering for you, not for her. Be careful with that, Amar. Cheers are how her arithmetic gets its hands on people." }
        ]
      }
    ]
  },
  {
    id: "b21_archbold_advances",
    index: 21,
    title: "Twenty-First Battle",
    subtitle: "Archbold Advances",
    intro: "The King has gathered the inner provinces and ridden west. The country between him and Grude is open road, and Captain Halden's vanguard is on it. The squad holds a barricade line thrown across the King's Road: not to win, but to slow. Every round the road stays shut buys Grude an hour it will need. Hold for six.",
    outro: "He is closer than yesterday. Closer still tomorrow. But tonight, because of one held barricade line, he is exactly one day's march further than he planned.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: kingsRoadMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      ENEMIES.vanguardCaptain(17),
      ENEMIES.royalGuard("aa_rg1", 2101, 16),
      ENEMIES.royalGuard("aa_rg2", 2102, 16),
      ENEMIES.royalGuard("aa_rg3", 2103, 15),
      ENEMIES.royalArcher("aa_ra1", 2104, 16),
      ENEMIES.royalArcher("aa_ra2", 2105, 15),
      ENEMIES.royalArcher("aa_ra3", 2106, 15)
    ],
    difficultyLabel: "Climactic",
    // Victory: pure delay. The vanguard outnumbers everything the squad
    // can put on the road — the win is the clock, not the rout.
    victory: surviveRounds(6),
    // Spoils: siege prep — 2 potions + 1 mask + 1 fang. A mixed
    // haul because the engagement was a probing skirmish, not a
    // decisive battle; the squad collects what they can carry.
    rewards: ["potion", "potion", "mask", "fang"],
    dialogues: [
      {
        id: "b21_the_count",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Ning", portraitId: "ning", expression: "startled",
            body: "I counted the column twice, Amar. Two hundred at the bend and more behind. We do not win this one." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "We're not here to win it. We hold this road six rounds, and every one of them buys Grude an hour. Barricades hold the front. Ning, thin them from the tree line. Nobody plays hero." }
        ]
      },
      {
        id: "b21_pressure",
        trigger: { kind: "round_start", round: 4 },
        beats: [
          { speaker: "Leo", portraitId: "leo", expression: "fury",
            body: "They keep COMING. The south fence is bending!" },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "So does the clock, Leo. Two more rounds. Bend. Don't break." }
        ]
      },
      {
        id: "b21_horn",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "A horn from the east, and the vanguard wheels back down the road as deliberately as it came. Halden's timetable is spent. So is the squad. The road held." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "(leaning on the barricade) Every hour counts. Lucian used to say that about harvests. (A breath.) We just bought Grude a night. Fall back before they change their minds." }
        ]
      }
    ]
  },
  {
    id: "b22_grude_burns",
    index: 22,
    title: "Twenty-Second Battle",
    subtitle: "Grude Burns",
    intro: "The granaries that fed the city went up in the night, and now Captain Brask's incendiary teams are working the upper district street by street. The market row is already burning at the corners. Hold the upper district, or the upper district falls with the rest — and with it, every larder Grude has left. The squad enters at the south gate. Brask directs from the fountain square.",
    outro: "What can be saved is saved. What cannot is named, so the city remembers it. On the market row, people are already writing the names on scorched doors.",
    music: MUSIC.grudeBattle1,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: upperDistrictMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo()
    ],
    buildEnemies: () => [
      ENEMIES.incendiaryCaptain(17),
      ENEMIES.royalGuard("gb_rg1", 2201, 16),
      ENEMIES.royalGuard("gb_rg2", 2202, 16),
      ENEMIES.royalGuard("gb_rg3", 2203, 15),
      ENEMIES.royalGuard("gb_rg4", 2204, 15),
      ENEMIES.royalArcher("gb_ra1", 2205, 16),
      ENEMIES.royalArcher("gb_ra2", 2206, 15)
    ],
    difficultyLabel: "Heart",
    // Spoils: 4 potions + 1 elixir, salvaged from the burning
    // upper district's apothecaries. Heavy on consumables because
    // the next engagements are coming fast and the squad needs
    // bandages more than weapons.
    rewards: ["potion", "potion", "potion", "potion", "elixir"],
    dialogues: [
      {
        id: "b22_smoke",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "alarmed",
            body: "The granaries went in the night. If the upper district goes too, Grude starves before Archbold ever breaches a wall. Brask's burn teams are on the market row." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then we take the row back. Leo, cut the western alley. Ning, hold the rooftop line. Nobody chases into the smoke. We hold corners and put out what we can. Brask answers for the rest." }
        ]
      },
      {
        id: "b22_amar_brask",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "incendiary_captain" },
        beats: [
          { speaker: "Captain Brask", portraitId: "royal_guard", expression: "neutral",
            body: "The King doesn't want the city, heir. He wants nothing left of HERS. A crown over ashes is still a crown." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "You're burning bread, captain, not banners. Say it plainer: he wants nothing left at all. (Draws.) Go put out your own fire." }
        ]
      },
      {
        id: "b22_named_doors",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The last burn team drops its torches at the fountain and runs. Smoke stands over the market row like a second city. What was saved was saved by hand, corner by corner, by four people and everyone brave enough to pass buckets behind them." },
          { speaker: "Ning", portraitId: "ning", expression: "exhausted",
            body: "(sitting on the fountain rim, bow across her knees) We held it. Amar... how long can a city hold its breath like this?" },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Until the sky answers, Ning. (He looks east, where the horizon has been wrong for days.) And something tells me it's about to." }
        ]
      }
    ]
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
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Climactic",
    // Spoils: 2 elixirs + 1 fang. First climactic test of the
    // chosen path; rewards are consistent across paths but the
    // narrative around them flexes per path.
    rewards: ["elixir", "elixir", "fang"]
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
    difficultyLabel: "Climactic",
    // Spoils: 2 elixirs + 1 royal lens. Symmetric to B23's haul
    // (one Lens vs B23's Fang) — last loadout chance before the
    // Ravage fleet arrives. The bell ringing at the end of B24 is
    // also the last quiet moment in the campaign.
    rewards: ["elixir", "elixir", "royal_lens"]
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
    difficultyLabel: "Climactic",
    // Spoils: alien-tech salvage. 2 elixirs + 1 royal lens + 1
    // fang — the lens and fang are recovered from the Ravage
    // landing craft and are notably better-made than anything the
    // squad has carried. Mechanically the same; narratively the
    // squad realizes the enemy is more advanced.
    rewards: ["elixir", "elixir", "royal_lens", "fang"]
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
    difficultyLabel: "Climactic",
    // Spoils: 3 elixirs + 1 mask. Defense battle, casualties on
    // both sides — the squad takes what they need to keep moving.
    rewards: ["elixir", "elixir", "elixir", "mask"]
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
    difficultyLabel: "Climactic",
    // Spoils: heaviest haul yet — 4 elixirs + 1 fang + 1 royal
    // lens. The squad strips what they can carry off the
    // commander's elite escort. Outfits the squad for the path-
    // specific final battle in B28.
    rewards: ["elixir", "elixir", "elixir", "elixir", "fang", "royal_lens"]
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
    difficultyLabel: "Final Boss",
    // Spoils: the campaign's last big haul — 5 elixirs + 1 mask +
    // 1 royal lens. Carries the squad through B29's cleanup.
    // The narrative around what gets carried out flexes per path
    // (Vengeance: Archbold's signet ring; Restoration: the
    // throne crown; Mercy: the surrendered sword).
    rewards: ["elixir", "elixir", "elixir", "elixir", "elixir", "mask", "royal_lens"]
  },
  {
    id: "b29_aftermath",
    index: 29,
    title: "Twenty-Ninth Battle",
    subtitle: "The Aftermath",
    intro: "The Ravage fleet is gone. The remaining fight is whatever survived your last decision.",
    outro: "The war is over for the people who lived through it.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Climactic",
    // Spoils: 2 elixirs + 1 royal lens. Cleanup engagement,
    // modest haul — the squad isn't fighting for resources at
    // this point, they're fighting to close the door.
    rewards: ["elixir", "elixir", "royal_lens"]
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
