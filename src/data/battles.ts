import type { ItemKind, MapDef, SecondWind, UnitDef } from "../combat/types";
import { ENEMIES, PLAYERS } from "./units";
import { loadSave } from "../util/save";
import { ROMANCE_FLAG } from "./romance";
import { bridgeMap, caravanMap, cliffsMap, cottageCoveMap, courtyardMap, dawnBanditsMap, dawnRebellionMap, dutyBridgeMap, exilePassMap, farmlandMap, fortMap, granaryMap, kingsRoadMap, leavingThulingMap, monasteryMap, mountainMap, originMap, orinhalMap, palaceMap, quayMap, ravageMap, ravineMap, shipDeckMap, swampMap, upperDistrictMap, warFieldMap, narrowsMap, bellCourtMap, landingFieldMap, descentFieldMap, coastHoldMap, pathFinalMap, smallholdMap } from "./maps";
import { MUSIC, type MusicKey } from "../audio/musicKeys";
import type { BackdropKey, BattleId, SevenPath } from "./contentIds";
import { anyOf, defeatUnit, escapeToTile, routAfterReinforcements, routEnemies, surviveRounds, type VictoryCondition } from "../combat/Victory";
import type { AtmosphereKind } from "../scenes/battle/Atmosphere";
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
//   - "second_wind" (named unit spends its second wind) — the boss
//     phase-two beat, fired inline the moment damageUnit refuses the
//     killing blow. Plays before the reserve wave lands, so the line
//     lands as the reason for what's about to walk onto the board.
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
  // Fires the instant `unitId` spends its second wind (UnitDef.secondWind)
  // — the boss gets back up, and gets a line about it.
  | { kind: "second_wind"; unitId: string }
  | { kind: "before_victory" };

// One scripted arrival of enemies mid-battle.
export interface BattleWave {
  // Stable dedup key. Defaults to the round (or the boss id, for event
  // waves) when omitted — which is why two round-waves can't share a
  // round unless you name them.
  id?: string;
  // Land as this round begins. Mutually exclusive with onSecondWindOf.
  round?: number;
  // Land the instant this unit spends its second wind.
  onSecondWindOf?: string;
  at: Array<{ x: number; y: number }>;
  announce?: string;
  units: () => UnitDef[];
}

// The key BattleScene dedups landings by. Keep this the single
// definition — a wave that lands twice is a very bad bug to debug.
export const waveKey = (w: BattleWave): string =>
  w.id ?? (w.onSecondWindOf ? `sw:${w.onSecondWindOf}` : `r${w.round}`);

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
  // Only when Amar married this partner (a RomanceOption id). The epilogue
  // uses it for the spouse's lines: the squad around them changes with the
  // marriage, and someone fielded as a friend mustn't get a husband's lines.
  partner?: string;
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
  // Scripted enemy waves for survive-the-clock battles. Each wave spawns
  // as its round begins, entering at the requested tiles (nearest free
  // walkable tile wins if one is occupied). Without these, a strong
  // squad routs the opening roster and spends the rest of a
  // surviveRounds battle ending turns at an empty field — the B26
  // empty-beach bug.
  // A wave lands EITHER on a round (`round`) or on a boss's second wind
  // (`onSecondWindOf`, the unit id). Exactly one must be set — the
  // campaign-integrity suite enforces it. Event waves exist so the B28
  // finale's reserve arrives at the moment the boss stands back up
  // rather than on a clock the player could out-race.
  reinforcements?: BattleWave[];
  difficultyLabel: string;
  unlockNote?: string;
  // Ambient particle weather override. When absent, the biome default
  // from atmosphereForBackdrop applies (backdrop-driven). Set it when a
  // battle's story wants different air than its backdrop implies —
  // e.g., B22 shares bg_grude with the harbor fights but burns.
  atmosphere?: AtmosphereKind;
  // Per-path divergence for the endgame climaxes. See PathOverride below.
  pathOverrides?: Partial<Record<SevenPath, PathOverride>>;
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

// ---- B28 phase two ---------------------------------------------------
//
// Every path's final opponent refuses the first killing blow. They come
// back at 55% of the bar taking HALF damage for the rest of the fight,
// they retaliate against anything that closes inside their weapon reach,
// and their reserve lands on both flanks BEHIND the squad the moment
// they stand back up.
//
// "Twice as tough" is expressed as a damage multiplier rather than
// doubled armor on purpose — see the note on SecondWind.damageTaken.
// Measured against the real damage pipeline in
// combat/__tests__/secondWind.test.ts: phase two costs the strike core
// about as many swings as the entire boss did before, so the finale is
// roughly twice the fight, for every character rather than for two.
const bossPhaseTwo = (announce: string): SecondWind => ({
  hpFraction: 0.55,
  damageTaken: 0.5,
  announce
});

// Attached at the roster rather than baked into the ENEMIES factory:
// Archbold anchors BOTH vengeance and mercy, and the two roads deserve
// different words for the same man refusing to fall. It also keeps the
// factories reusable for any earlier battle that fields the same unit
// without a second phase.
const withSecondWind = (def: UnitDef, sw: SecondWind): UnitDef => ({ ...def, secondWind: sw });

// The reserve arrives as a pincer on the flanking stone, level with and
// behind the squad's own line (players deploy at y=12-13) — the one
// direction the whole battle has trained the player to treat as safe.
const B28_RESERVE_TILES = [
  { x: 3, y: 11 }, { x: 15, y: 11 }, { x: 3, y: 13 }, { x: 15, y: 13 }
];

export const BATTLES: BattleNode[] = [
  {
    id: "b01_palace_coup",
    index: 1,
    title: "First Battle",
    subtitle: "The Palace Coup",
    intro:
      "Year 2640 of the Anthros Monarch. For ten months, Amar and seven comrades have planned to storm King Nebu's palace in Para and end his selfish rule before the harvest fails again. Tonight the others are spread through the back corridors. Amar and the lead group reach the throne hall first. They have to break the royal guard and reach the King.",
    outro:
      "The royal guard overpowers the squad and captures Amar. He wakes in a hospital outside the palace, alive, with no memory of who he is or of the coup he started.",
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
            body: "The last royal guard falls against the third pillar from the throne. For a moment the hall goes quiet, and the squad thinks the fight is over." },
          { speaker: "Selene", portraitId: "selene", expression: "breaking",
            body: "Amar, the side doors. The SIDE doors, get to —" },
          { portraitId: "narrator",
            body: "Three palace guards step out on Amar's blind side. He turns too late. They grab his wrist and throat, and he drops his sword." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "Selene — !" },
          { portraitId: "narrator",
            body: "Ranatoli rushes in and slams his shield into the nearest guard's ribs. Six more guards come out of the corridors behind him and take him down." },
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "alarmed",
            body: "Hold on — Amar — hold ON, damn it —" },
          { portraitId: "narrator",
            body: "Selene kills the closest guard before the rest overpower her. They pin her arm and wrench her knee. She doesn't cry out. She catches Amar's eye and shakes her head once, telling him not to try." },
          { portraitId: "narrator",
            body: "The others are lost too. Khonu dies at the south doors, Yul on the eastern stairs, Tev in the stables. No one will hear from Sera for a long time." },
          { speaker: "King Nebu IV", portraitId: "nebu", expression: "cruel_amusement",
            body: "Eight of you, ten months, and all I see is a boy kneeling in MY throne hall. Take him away. Cells for the other two. Tomorrow I'll decide which of you is worth remembering." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(quietly, to no one) ...This was supposed to be the night." },
          { portraitId: "narrator",
            body: "A guard pulls a heavy sack over Amar's head, and everything goes dark." }
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
      "Bandits attack the farmland outside Thuling. Amar and two workers he now counts as friends, Lucian the foreman and Ning the bowmaker's apprentice, must defend the wagons until Kian's knight arrives. Amar fights far better than a farmhand should, and he doesn't know why. He has to keep hiding it.",
    outro:
      "The bandits are driven off. Lucian hands Amar a rag for the cut on his hand and says nothing. During the fight, the smell of wet hay and iron reminded Amar of something, a memory or an instinct. He can't let Lucian see that on his face.",
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
            body: "Then today's the day, Ning. Same draw, same release as on the haybales. I know it feels different. Just make the shot count." },
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
            body: "Amar swings once, cleanly, after a small step that no forge worker would know to take. Lucian sees it. He doesn't look surprised, and he keeps his face completely blank." },
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
      "Two days after the wagon attack, more raiders come down the eastern road. There are fewer of them, but they're better armed, and all wear the same dyed sash. The town calls them \"Dawn's lot,\" after the queen across the sea who never forgave King Nebu for taking her land. Lucian forms a line to stop them. A stranger jumps down from the orchard and joins it without asking.",
    outro:
      "The raiders are beaten back. The stranger says her name is Maya. She's quiet and watchful, and she clearly knows tactics. Ning likes her right away. Lucian doesn't object, which for Lucian means he approves. Maya stays with the squad.",
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
            body: "Your footwork. That's courtyard training. Nobody learns to step like that hauling wagons." },
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
      "Three minutes into the marsh, the trees block out the sun. The squad walks single file: Maya in front, Amar and Lucian in the middle, Kian in his armor on the right, Ning at the rear. Lucian carries the farm's delivery in his saddlebag. Bandits are hiding in the trees on every side. Maya spots them and draws first.",
    outro:
      "The squad gets through the ambush. Lucian makes up a story for Kian about reflexes Amar learned on the farm. Kian nods and says nothing. That night by the fire, Lucian makes up a second story, this one just for Amar. Then he asks Amar to tell him the real one.",
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
            body: "I take orders from generals, Lucian. You're a foreman." },
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
      "General Fergus sends the squad against marauders led by a brother and sister: Ndari at the front, Ndara behind him. The mountain village is already in ruins, with snow falling on the broken roofs. Leo, Fergus's son and a Dactyl Rider, asks to come along. Amar can't see why a father would send his own son into this. For now, the squad climbs toward Ndari.",
    outro:
      "Ndari dies at the gate, and Ndara escapes on a Dactyl. Before she goes, she shouts down at Amar, asking why he is fighting on Nebu's side. Lucian sees Amar flinch. He stays quiet tonight, but tomorrow he'll have a lot to say.",
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
            body: "Ndari slumps against the gatepost, still watching the path. The last bandits run. Overhead, a dactyl heads east, then stops and hovers while its rider looks down." },
          { speaker: "Ndara", portraitId: "ndari", expression: "grim_resolve",
            body: "(shouted, over the wing-beats) WHY ARE YOU FIGHTING ON NEBU'S SIDE, AMAR! ASK YOUR CAPTAIN WHO HE WORKS FOR! ASK HIM WHO ORDERED THE FOURTH HARVEST!" },
          { portraitId: "narrator",
            body: "She doesn't wait for an answer. The dactyl turns and disappears behind the ridge. Lucian sees Amar's expression change. He doesn't say anything, but he'll remember it." }
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
      "The squad is escorting two wagons of grain and steel east on a routine job. Then archers fire from both canyon ledges, and mounted bandits block the road behind them. The ambush was planned. The drivers drop flat, and the squad has to protect them and the wagons. Maya takes the south flank without being told, as if she's done it a hundred times. Lucian notices.",
    outro:
      "The squad clears the road with the wagons intact and the drivers alive. Under the bandit captain's body, Amar finds a ledger: route times, payment dates, and a note in a court accounting code only palace officers can read. Someone inside Nebu's court paid for this ambush. The squad keeps the ledger.",
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
            body: "South flank. Lucian, hold the west wagon. Ning, climb the south ledge. The archer up there reloads slow, you can take her clean. Amar takes center. Leo, swing wide and break the east blockade." },
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
            body: "Hold up. That one had a leather pouch on his hip. I saw it when he raised his shield. Maya, search him now, before we have to move on." },
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
      "Fergus orders the squad to clear out raiders who have kidnapped tax collectors and are holding a mountain monastery. After a two-day climb, the squad breaks the south gate and pushes in. In the inner hall, the raiders' leader looks up. Amar knows her from a wanted poster. It's Selene, one of the seven from the coup.",
    outro:
      "Selene jumps from the bell tower balcony with a rope already over her shoulder, and disappears into the mist before Leo can turn his Dactyl. The raiders scatter. Lucian stayed on Amar's blind side all battle, covering for him while he fought at half strength. He hasn't asked why yet.",
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
            body: "Selene stops herself mid-word. She clearly thought he was dead. With a look, Amar warns her that everyone has to keep thinking so. The squad hasn't noticed a thing." },
          { speaker: "Selene", portraitId: "selene", expression: "cold_contempt",
            body: "(louder, for the room) ...You shouldn't be here, soldier. None of you should." },
          { speaker: "Amar", portraitId: "amar",
            body: "(matching her tone) Neither should you, raider. Stand down." },
          { speaker: "Selene", portraitId: "selene", expression: "breaking",
            body: "(quietly, only to him) Don't follow me past the bell tower, Amar. Don't make me cut you here in front of the people you've kept alive this year." }
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
      "Fergus orders the squad to break up a riot in Orinhal and arrest the ringleaders. But they ride in at noon and find no riot, just a starving town. Unarmed foremen and their families stand between the King's tax collectors and the last of the winter grain. Madame Dawn's partisans, in green cloaks, are holding the line with them. Leo dismounts and walks his Dactyl over to them. The squad follows.",
    outro:
      "The tax collectors break and run. Dawn's lieutenant, a gray-cloaked woman also called Ndara but not the bandit from the mountain, says Dawn has been watching Amar and wants to meet when he's ready. She leaves before he can answer. Lucian gives the squad's share of the silver back to the townspeople.",
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
            body: "The arrows stop. The foremen are still standing between the squad and the King's tax men, and none of them have run. They're waiting to see what kind of soldiers Anthros has sent." },
          { speaker: "Leo", portraitId: "leo", expression: "ready",
            body: "Captain. I'm dismounting. I'm taking the dactyl to the partisans. The squad is welcome to follow. I'll explain to my father later. Or I won't. Either's fine." },
          { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
            body: "Lad, your father sent you with US. You break ranks here, you don't get to go back to him." },
          { speaker: "Leo", portraitId: "leo", expression: "resolute",
            body: "I know, Lucian. The townspeople behind us are unarmed. The tax men in front of us are not. I know which side I'm on. The rest of you do what you have to." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "...The squad's with you, Leo. Lucian, turn the line around. We're fighting south now." }
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
      "News of Orinhal reaches Thuling before the squad does. Fergus sends them straight back out to stop a bandit column. It's a trap: the bandits are a King's regiment in commoners' clothes, dug into a ravine, with archers on the high ground and a river blocking retreat. Within thirty seconds they're firing from three directions. Maya turns grim in a way none of them have seen.",
    outro:
      "Lucian takes a bolt saving Ning and fights on one-armed. Out of the ravine, the squad learns the truth: Fergus knew about the coup and has been sending them to die. Maya isn't a peasant. Madame Dawn planted her months ago. Dawn offers them safety. Another night in Thuling would get them killed.",
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
            body: "Three bolts land in thirty seconds, from three directions. Fergus's 'bandit column' is on the rim, in the trees, and across the river. They're wearing royal gear under their commoners' clothes." },
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
            body: "Amar. When we clear this ravine, we talk. I should have told you in Thuling. I'm sorry. You need to hear it from me, not from Fergus." },
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
      "The squad is trying to leave Thuling. Kian is waiting outside Lucian's house with twelve guardsmen and a warrant sealed by the King. Lucian's wife and daughter are inside. Kian says he has known about Amar since the second week, and hoped he was wrong. The warrant is for Amar alone; the others can go if he surrenders. Lucian is already drawing his spear.",
    outro:
      "The squad breaks through at the third barricade. Mira and Tali, Lucian's family, make it to a cousin's farm. Kian doesn't chase them. He shouts after the squad: \"The cliffs, Amar. We'll finish what your father started, before Madame Dawn can use you as a weapon.\"",
    music: MUSIC.finalBoss,
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
            body: "Mira and Tali went out the back gate ten minutes ago. Burn it if you like, Kian. The house is empty. You always did love announcing things." },
          { speaker: "Kian", portraitId: "kian", expression: "alarmed",
            body: "...Lucian. You knew? How long have you known?" },
          { speaker: "Lucian", portraitId: "lucian", expression: "fatherly_smile",
            body: "About Amar? Maybe a year. About you? Since the practice yard. Now fight us or get out of the way." },
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
            body: "Because tonight Madame Dawn offered you a ship. The King doesn't care about a peasant who used to be a prince. He cares a great deal about a prince working for Dawn." },
          { speaker: "Amar", portraitId: "amar",
            body: "And what do YOU care about, Kian." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "(quietly) I trained a frightened thirteen-year-old. When he went down in that throne hall, I hoped whoever woke up in the hospital wouldn't be him anymore. Now move, your highness." }
        ]
      },
      // before_victory: Kian doesn't pursue once the squad breaks
      // through. His promise to meet Amar on the cliffs sets up B11.
      {
        id: "b10_kian_promise",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The squad breaks the south barricade. Maya goes first, Ning covers, and Leo swings wide east. Lucian backs through the gap, spear levelled. Kian could close the line, but he doesn't." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "(calling after them) The cliffs above Para Harbor! We'll finish this where your father's fight ended, out in the open, just you and me. Bring your friends. They won't help." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "(over his shoulder, not slowing) The cliffs, Kian. Sundown." },
          { portraitId: "narrator",
            body: "The squad runs hard through the western gate. The road bends north toward the harbor and the long climb up to the cliffs. Lucian doesn't look back at his house." }
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
      "It is sundown at Para Harbor. The only way down to Madame Dawn's ship is the cliff staircase, and Kian waits on the lower landing with the King's elite guards blocking the steps. He looks more tired than Amar has ever seen him. He has his men lower their weapons because he wants to talk first. Lucian draws his spear anyway.",
    outro:
      "Kian falls to a combined attack on the lower landing. The squad clears the staircase and reaches the ship at moonrise. The fight cost them more than they know yet. They will find out later, in the cabin, once the ship is under way.",
    music: MUSIC.finalBoss,
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
            body: "Anthros is a colony of Grude. Archbold, Grude's king, put Nebu on the throne to hold it. Your father knew. His coup was against the empire, and Grude noticed. That's what nearly killed you." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "...He's not lying. Dawn told me about the colony six months ago. I never told you because the squad would have ridden for Grude that night without a plan." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "(quietly) Kian. Why are you telling me this NOW. With a sword in your hand." },
          { speaker: "Kian", portraitId: "kian", expression: "wounded",
            body: "Dawn will use you, Amar. She'll use your face to start a war, and a hundred thousand peasants will die. I can't stop you going. I can stop you leaving in one piece." },
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
            body: "(quietly) Whatever happens after this, don't fight for the colony or the empire or anyone's flag. Fight for the people on this staircase. They're the only ones really on your side." }
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
            body: "Maya attacks from above, Ning shoots, and Amar comes from the front. Kian doesn't block Amar. He gives him his old practice-yard look, the one that meant he got it right." },
          { speaker: "Kian", portraitId: "kian", expression: "fatherly_smile",
            body: "(softly) Good half-step, your highness." },
          { portraitId: "narrator",
            body: "Kian falls on the landing. At the rear, Lucian, fighting one-armed, is hit between the ribs by a bolt. Nobody sees, and he makes no sound. He keeps walking to the ship." }
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
      "After fourteen months at sea, the ship reaches Grude's east port at first light. Khione brings it in under the empire's own customs flag, using Dawn's papers. The squad barely has time to look at a city taller than anything in Para before alarm bells ring. A man in a captain's cloak has recognized them. King Archbold's soldiers were waiting, and the squad has to fight its way off the dock.",
    outro:
      "The squad breaks through the customs dock and into the city. Madame Dawn meets them at the inner gate. She confirms it: the alarm bells were for them, and Captain Volos works for King Archbold of Grude. The coup Amar's father led eleven years ago was aimed at the whole empire. Dawn takes them inside before a second wave of soldiers arrives.",
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
            body: "Alarm bells ring from the customs platform. Captain Volos is at the podium with six elite, two with crossbows drawn. The squad is behind the crates in ten seconds. Maya gives silent hand signals." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "(half-shouted) Amar, look at his gear. It's the same as the guard you killed in Para. Same drill for eighty years. This isn't just a kingdom you're fighting, my son. It's an empire." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "She's right. Same crossbow stance, same manual. Amar, focus. Crown archers first. Leave Volos until his line thins." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "(to himself, drawing his sword) ...Eighty years." }
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
            body: "(parrying) Amar. Before Dawn gives you her speech, there's something I've waited fourteen months to tell you. Your father wasn't only Anthros's prince. And your mother wasn't only the woman who raised you." },
          { speaker: "Amar", portraitId: "amar", expression: "shocked",
            body: "Maya — wait —" },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "(striking) No waiting. Fight now, and listen on the way to the safe house. Short version: half of you comes from this side of the sea. I'll tell you the rest when nobody's shooting at us." }
        ]
      },
      // before_victory: Dawn at the inner gate as the squad pushes
      // through. The line that becomes the chapter's outro frame.
      {
        id: "b12_dawn_at_the_gate",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The line breaks at the customs platform. Maya brings Volos down and the crossbowmen scatter. Madame Dawn waits under the arch of the inner gate, hood down, hands empty." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "Faster than I expected. The second wave is twelve minutes behind you. Ndara has tea upstairs; your packs are inside. Maya, your old room, end of the hall." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(quietly) ...You knew which room was hers. You knew that eleven months before I did. How long has she been working for you, Dawn?" },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "(softly) Eleven years, Amar. The same as you. Come inside. Both wars will reach us soon, and we have a lot to talk about before they do." }
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
      "The squad has been in Grude for three weeks. Tonight Dawn puts nine years of planning into action: twelve strikes in one hour on the King's nephews, customs wardens and bookkeepers. The squad's target is the youngest nephew's house on the marble plaza off Oran Lane. It is lightly guarded, because he has never had reason to worry. Rose, who spent weeks mapping it, leads them in.",
    outro:
      "The captain falls and the squad takes the plaza. Then the back door of the house opens, and four crossbowmen the scouts had missed aim at Dawn. Rose takes all four bolts and is dead before she hits the cobblestones. Dawn crosses the plaza, kneels in Rose's blood, and stays there all night.",
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
            body: "Maya, north flank with me. Ning, south archer first; she reloads slow. Leo, dactyl at the captain. Amar, center. Eight minutes. Any longer and Dawn's cover wears thin." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Confirmed. Rose, when did you last sleep?" },
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
            body: "(between strikes) Maya and I trained together under Dawn for twelve years. She can pass for a peasant and I can't, so she went undercover and I ended up leading strikes." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "...You knew about me as long as Maya did, then." },
          { speaker: "Rose", portraitId: "rose", expression: "neutral",
            body: "Longer. Maya's reports came to me, your highness. I'm glad you made it. After eleven months of her reports, you weren't the man I'd expected. You were easier." },
          { speaker: "Amar", portraitId: "amar",
            body: "Easier than what?" },
          { speaker: "Rose", portraitId: "rose",
            body: "Easier than your father was, near the end. Move. The captain just shifted his stance." }
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
            body: "(half-smiling) Clean. That half-step before the thrust was your father's. Madame Dawn will have seen it from the alley." }
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
            body: "The captain falls dead on the marble, and the crown archers stop shooting. For a moment, the plaza belongs to the squad." },
          { portraitId: "narrator",
            body: "Then the back door, which was supposed to be bricked up, swings open. Four crossbowmen in royal blue aim at the mouth of the alley, where Madame Dawn stands with her hood down." },
          { speaker: "Rose", portraitId: "rose", expression: "falling",
            body: "DAWN — " },
          { portraitId: "narrator",
            body: "Rose covers twenty paces in three strides. She doesn't draw her weapon or call out again. She plants herself right in front of Dawn, with her back to the four crossbows." },
          { portraitId: "narrator",
            body: "All four bolts hit Rose. She stays on her feet long enough for Dawn to understand, then falls without a sound. Maya, Ning, Leo and Amar kill the crossbowmen within seconds, but it's too late." },
          { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
            body: "(quietly) ...Rose. Rose. Rose, look at me. Rose. Rose. Rose." },
          { portraitId: "narrator",
            body: "Dawn doesn't raise her voice or cry. She kneels in the blood, takes Rose's hand and holds it. Maya is the first of the squad to look away." }
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
      "Dawn has been telling Amar where he comes from for barely an hour when the candle-maker downstairs taps the warning signal. King Archbold's household guard has found the safe house. Lord Castor's orders are to take the emperor's son alive, because a living heir is useful. Maya is already at the door.",
    outro:
      "Castor's guards retreat, carrying their commander. They failed to take Amar, but now it's clear the empire knows who he is and will keep coming for him. In the study, Dawn finishes what she was saying. Amar's mother's side is the rebellion. His father's side is the throne the rebellion is trying to overthrow.",
    // GrudeBattle1 — the city's own battle palette. The Grude act now
    // alternates it with the Spine variant (B12 G, B13 spine, B14 G,
    // B15 stronghold, B16 G, B17 spine, B18 G) instead of running
    // battleTheme2 five battles straight.
    music: MUSIC.grudeBattle1,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: originMap,
    buildPlayers: () => [
      // Post-Rose squad of five. Map player slots are ordered
      // [Maya, Amar, Ning, Leo, Veya] — buildPlayers must match.
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya()
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
          { speaker: "Lord Castor", portraitId: "castor",
            body: "Squad of the Anthros coup: you harbour one Amar. By authority of King Archbold of Grude, I will take him, unharmed, tonight. Stand aside and nobody bleeds." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "\"Unharmed.\" Hear that, Amar? For two years, every officer who came after us wanted you dead. This one's under orders to keep you alive. That's how much changed in Dawn's study tonight." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "That doesn't change the next ten minutes. Castor, you can take that order back up the street, or you can carry your men back. Squad, break their line. Nobody's taking me anywhere tonight." }
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
          { speaker: "Lord Castor", portraitId: "castor",
            body: "You fight like your mother's side and hold a line like your father's. I served in his household guard for twenty years. You belong in the capital, not on a safe-house floor." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "I had a name. I had a forge, and a country I bled for. You don't get to be the third person this month to tell me who I am." },
          { speaker: "Lord Castor", portraitId: "castor",
            body: "(quietly) No, I suppose I don't. But the King will, Amar, and sooner than you would like. Mind the archers behind me. My orders say unharmed. They say nothing about going easy on you." }
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
            body: "Lord Castor drops to one knee, his hand pressed to his side. He doesn't try to rally. His men close around him and pull back up the street in good order." },
          { speaker: "Lord Castor", portraitId: "castor",
            body: "Nobody has to die over tonight. It goes in a report, and the King can wait until spring. Welcome to the family, your highness. It's bigger and worse than you think." },
          { portraitId: "narrator",
            body: "The guard detail leaves the street. The candle-maker stops tapping the warning. Upstairs, Dawn still hasn't finished what she was telling Amar." }
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
      "Maya has found the leak. For three months, every message went through Quartermaster Coyne, and he led Castor's men to the safe house. Ndara worked it out first and faced him alone. She was found in the courtyard, breathing but not waking up. Coyne is at the back gate with bribed rebels and imperial agents.",
    outro:
      "Coyne falls before he reaches the gate. The squad has the safe house back, and Dawn now knows it was never safe. Upstairs, Ndara is breathing but still hasn't woken. For thirty years Dawn has asked people to follow her. After tonight, she stops asking and starts giving orders.",
    // Entering the Stronghold — B1's palace-coup theme, returning on
    // purpose: the mole hunt is a coup inside Dawn's own stronghold,
    // and the leitmotif says so before any dialogue does.
    music: MUSIC.enteringStronghold,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: courtyardMap,
    // Night fight: Maya's mole hunt ran below the floorboards after
    // dark, Ndara was found in the courtyard "breathing, not waking",
    // and Coyne is slipping out the BACK gate — this is a clandestine
    // coup-within-the-coup by candle-light, not a daylight arrest.
    // The fog-of-war spotlight sells the searching.
    darkBattle: true,
    buildPlayers: () => [
      // Post-Rose squad of five. Ndara is in a coma — not on the
      // field. Map player slots are ordered [Maya, Amar, Ning, Leo, Veya].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya()
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
            body: "Coyne. Three months of manifests, and every one crossed your desk. Ndara caught you first, and you left her lying in the courtyard. Don't expect any mercy." },
          { speaker: "Quartermaster Coyne", portraitId: "coyne",
            body: "She's hurt, not dead. That's why I can still sleep. For nine years I watched Dawn treat people as numbers and sacrifice them. Rose was one. She'll sacrifice you too. At least Archbold pays up front." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "You sold out the safe house, Coyne. Castor's men were in that street because of you. Whatever Dawn is, you didn't fix it. You just picked the side that pays more. Squad: he does not reach that gate." }
        ]
      },
      // adjacent_eot Amar/Coyne — Coyne is not a swordsman and he
      // knows it; his weapon is the squad's doubt. He aims it at Amar.
      {
        id: "b15_amar_coyne",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "turncoat" },
        beats: [
          { speaker: "Quartermaster Coyne", portraitId: "coyne",
            body: "Everyone here knows who you are: the emperor's lost son. So think about this while you cut me down. When Dawn's plan gets another Rose killed, whose judgment will you trust? Hers, or yours?" },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Neither. Lucian's. Now fight, Coyne. You don't get to betray all of us and then call it a warning." }
        ]
      },
      // before_victory: Coyne falls short of the gate. He dies the
      // way a quartermaster dies — still counting.
      {
        id: "b15_coyne_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Coyne falls six strides from the back gate. The rebels he bribed lower their blades, since nobody is going to pay them now. The imperial agents pull back in good order." },
          { speaker: "Quartermaster Coyne", portraitId: "coyne",
            body: "Nine years keeping her books... and I miss the gate by six strides. Tell Dawn I was never the real leak. I was just the first one to say out loud what her plans cost." },
          { portraitId: "narrator",
            body: "Coyne doesn't say anything else. Upstairs, Ndara is still unconscious. Somewhere in the city, Dawn learns that the man who betrayed her safe house had run her supply line for nine years." }
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
      "Amar still hasn't answered Dawn's proposal that he claim the Anthros throne. That night she sends the squad across the river on an errand. Halfway over the bridge, the lamps at the far end go out one by one, and two figures step out behind the squad. King Archbold has stopped trying to take his son alive. The woman walking toward Amar is Wren, the King's Knife.",
    outro:
      "Wren falls on the bridge where she meant to kill Amar. Even so, the empire has made its point: it won't leave him alone. If he hides, they will hunt him. If he takes the throne, they will fight him. Dawn was right that he can only choose which price to pay. She will ask him again, and he is closer to an answer.",
    // GrudeBattle1 — see B14's note on the Grude-act alternation.
    music: MUSIC.grudeBattle1,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: bridgeMap,
    buildPlayers: () => [
      // Post-Rose squad of five. Map slots ordered [Maya, Amar, Ning, Leo, Veya].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya()
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
          { speaker: "Wren", portraitId: "wren",
            body: "Don't run. The bridge only goes so far. Castor was ordered to bring you home unharmed. My orders are simpler. The King has decided a dead heir is a scandal he can cover up. You'd have made a tolerable prince." },
          { speaker: "Maya", portraitId: "maya", expression: "alarmed",
            body: "Two behind us, three ahead. The one talking is Wren, and she's the real problem. Drop her and the rest give up; they're only paid men. Keep a tight formation. Don't let her get you alone." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "My father sent his Knife to kill me on a bridge. Well, that answers half of Dawn's question already. Squad, break through at the east end. Wren is mine." }
        ]
      },
      // adjacent_eot Amar/Wren — the assassin is not a believer; she's
      // a professional, and professionals talk while they work. She
      // tells Amar the one true thing the empire taught her.
      {
        id: "b16_amar_wren",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "kings_knife" },
        beats: [
          { speaker: "Wren", portraitId: "wren",
            body: "Your father pays me because I never ask whether a name deserves it. Your mother will hand you a list soon. Will you read it before you sign? Castor wouldn't. I don't. Will you?" },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "I've spent two years burying people from other people's lists, Wren. I've started reading them. That's the difference between us, and you're about to find out how much it matters." }
        ]
      },
      // before_victory: Wren falls. She dies the way she lived — a
      // professional, unsurprised, settling the account.
      {
        id: "b16_wren_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Wren falls mid-bridge, right where she meant to kill Amar. The hired knives run off, since nobody is paying them now. The squad holds the bridge." },
          { speaker: "Wren", portraitId: "wren",
            body: "Faster than Castor said. Good. Your father will send someone after me, and someone after them. Take the crown or don't, your highness, but stop standing out in the open." },
          { portraitId: "narrator",
            body: "The squad carries Dawn's crate across and meets the courier, so the errand is done. But all of them are thinking about what Wren said: the King will keep sending killers, one after another." }
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
      "Khione tells Amar the truth. Dawn's rebellion was never meant to free Anthros. Her plan is to crown Amar, provoke King Archbold into burning the colony, and let a hundred million deaths turn Grude against its own crown. Kian was right that Dawn would use Amar to start a war. The squad runs for Khione's ship, but Marshal Othren's loyalists hold the dock.",
    outro:
      "Khione's ship casts off and leaves Grude behind, and Dawn with it. She is the mother who crossed an ocean for Amar, and also the strategist who was willing to sacrifice his homeland. She loves him, and she lied to him. For the first time, Amar is heading somewhere nobody has planned for him.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: quayMap,
    // Pre-dawn fight: before_lie stages this explicitly — "Amar goes to
    // the quay before dawn." The squad breaks for the gangway in the
    // last dark hour, torch-lit dock, Othren's line half-shadow. The
    // spotlight makes the ship's lamps the destination.
    darkBattle: true,
    buildPlayers: () => [
      // Six from the quay: Corin breaks ranks with Dawn's line in
      // before_lie and fights his first battle against his old
      // marshal. Khione readies the ship — narratively present, not a
      // combatant. Map slots ordered [Maya, Amar, Ning, Leo, Veya,
      // Corin].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
      escapeToTile({ x: 9, y: 11 }, { label: "Reach Khione's ship" }),
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
          { speaker: "Marshal Othren", portraitId: "othren",
            body: "That's far enough. This isn't personal, but the man in your formation is the whole cause now. Dawn won't lose her heir to a boat. Turn around, Amar." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "I know the plan, Othren. It ends with Thuling burning, Orinhal burning, every village Maya can name burning. I won't be the one who starts it." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "We won't talk him round; he's wanted this for weeks. Othren holds their line together, so beat him or get past him. The gangway is the goal. Squad, south. We're getting on that ship." }
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
          { speaker: "Marshal Othren", portraitId: "othren",
            body: "I've pictured it for nine years, Amar. Thuling burns, innocent people with it, and then Grude's cities rise up and bring down their emperor for good. I sleep fine. I've counted the cost." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "Then you and Coyne would've had a lot to talk about. He counted too. I'm done being a number in other people's plans, Othren. Hers, yours, anyone's. Move." }
        ]
      },
      // adjacent_eot Corin/Othren — the marshal and the captain he
      // trained. The rebellion's discipline arguing with its debt.
      {
        id: "b17_corin_othren",
        trigger: { kind: "adjacent_eot", unitA: "corin", unitB: "dawn_loyalist" },
        beats: [
          { speaker: "Marshal Othren", portraitId: "othren",
            body: "Eseldra. For nine years I kept you mounted, fed and promoted. Your sister would drag you back into this line by the ear." },
          { speaker: "Corin", portraitId: "corin", expression: "battle_fury",
            body: "Then say her name, Marshal, and how she died. Rose took four bolts for a plan she never saw in full. You counted her and slept. I'm not one of your numbers now. Stand down, or I ride through you." }
        ]
      },
      // before_victory: the squad reaches the gangway. Othren, down or
      // bypassed, does not chase — he was an anchor, not a hound.
      {
        id: "b17_break_through",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The loyalist line breaks and the gangway is clear. Khione is at the rail, holding out her hand. Othren's loyalists don't chase the squad. Their orders were to hold the dock, not to hunt down Dawn's son." },
          { speaker: "Marshal Othren", portraitId: "othren",
            body: "(calling after them) She'll let you go. Your mother has planned for every road you could take. You're just one more part of her plan. ...Fair winds, your highness. I always wished you that." },
          { portraitId: "narrator",
            body: "The squad boards Khione's ship, and Grude falls away behind them. For the first time since Thuling, nobody at the next harbor has already decided what Amar will do." }
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
      "Three days out from Grude, the empire tries one more time. A fast imperial ship catches Khione's at dusk and throws grappling hooks. The King's household troops come aboard with one order: the heir must not reach the far shore. There is nowhere to retreat. If the squad beats them, Amar's next decision will be his own.",
    outro:
      "The last boarder goes over the rail and the imperial ship turns away. Ahead is a coast nobody owns. When they land there, Amar will finally answer the question he has been asking himself since he woke in a hospital bed in Thuling. He has seven answers to choose from, and he can only pick one.",
    music: MUSIC.grudeBattle1,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: shipDeckMap,
    buildPlayers: () => [
      // Post-Rose squad of five. Khione holds the wheel (present, not a
      // combatant). Map slots ordered [Maya, Amar, Ning, Leo, Veya].
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
            body: "Heir of Anthros! King Archbold's order: you don't reach the far shore. Surrender, and it's quick. Fight, and it won't be. The sea is the King's." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "My father's men keep saying it was already decided: at the hospital, the cliff, the bridge. Not on this ship, it isn't. Squad, hold mid-deck. Keep them off the wheel." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "Seven boarders, over the rails and at the front. Form a tight line at the masts and let the crates take the arrows. Leo, up front. Ning, archers first. Win this, and Amar gets his quiet minute." }
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
            body: "I've carried the King's orders for twenty years. There's always another attempt. He doesn't stop. The only men Archbold leaves alone are the ones who stop mattering, your highness." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "Funny. That's one of the seven choices I'm deciding between. I'd tell you which one I pick, but you won't be on this deck to hear it. Move, Captain." }
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
            body: "The boarding party breaks all at once. The imperial ship cuts its grappling lines and runs. Khione never let go of the wheel." },
          { speaker: "Imperial Captain", portraitId: "royal_guard", expression: "neutral",
            body: "Faster than the King expected. He'll send another; he always does. But not before that coast. A man gets few hours that are truly his own. Use yours better than I used mine, heir." },
          { portraitId: "narrator",
            body: "The deck is quiet. Ahead is the coast that belongs to nobody. Amar has seven possible answers in mind, and for the first time, nobody else is going to answer for him." }
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
    intro: "Amar has chosen Selene's answer: vengeance. The squad rides inland from the coast with a list in Amar's saddlebag, written in his own hand. The first name on it is Lord Castor, the King's knight-captain, who tried to take Amar off a Grude street and hand him to his father. Castor's column crosses the canyon road tonight.",
    outro: "Castor is the first person Amar has killed for his own reasons, rather than for the rebellion or the empire. At the campfire, Maya quietly hands Amar the list. A second name has been added to it, and it isn't in Amar's handwriting.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_caravan",
    playable: true,
    map: caravanMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
          { speaker: "Lord Castor", portraitId: "castor",
            body: "(not reaching for his sword yet) The heir. I treated you gently, boy. Whoever comes after me won't. Ride away and I'll write that I never saw you." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "Gently or not, you were taking me to the man who sent Wren to kill me, Castor. You're the first name on a list I wrote myself. No more reports. Squad, the escort breaks when he falls." }
        ]
      },
      {
        id: "b19v_amar_castor",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "imperial_knight" },
        beats: [
          { speaker: "Lord Castor", portraitId: "castor",
            body: "Wren told me you'd started reading the lists. So read your own, your highness. Every name on it will cost you a piece of yourself. I'm the cheap one." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "I know what it costs, Castor. I've counted it. I guess I'm my mother's son after all." }
        ]
      },
      {
        id: "b19v_castor_falls",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Castor falls on the canyon road, and his escort scatters into the dark. The column's dropped lanterns are still burning on the stones." },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "(folding the list back into his saddlebag) That's the first name. I'll keep the ledger, Amar. If someone has to keep count, it should be someone who loves you." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_restoration",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The First Stone Laid",
    intro: "Amar has chosen Lucian's answer: restoration. The squad rides for the Anthros border, to Khonu's village, where people still remember Amar's father. The war has made the roads lawless, and raiders have been robbing the village for a month. The villagers will let the squad stay if they can hold the road.",
    outro: "That night, three families hang an old flag from their doorposts. It isn't the King's flag or Dawn's. It is Amar's, as long as he can keep them safe. The rebuilding starts the way Lucian said everything starts: by holding one road and keeping one promise.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: true,
    map: dawnBanditsMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
            body: "Lucian held a road like this once, for people he'd never met. These people knew my father. Squad, nobody gets past us to the houses. Nobody." },
          { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
            body: "Six of them, and no discipline. They're used to farmers. They've never had to fight a line that holds. Let's show them what we learned in Thuling." }
        ]
      },
      {
        id: "b19r_leo_aside",
        trigger: { kind: "adjacent_eot", unitA: "leo", unitB: "amar" },
        beats: [
          { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
            body: "Captain. The old man on the porch has been watching you fight for two rounds. He keeps nodding, like he's comparing your form to somebody he remembers." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "Then let's not disappoint him. West flank, Leo. Go." }
        ]
      },
      {
        id: "b19r_road_held",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The last raider drops his blade and runs. The road is quiet again. One by one, the villagers open doors that have been barred for a month." },
          { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
            body: "No throne. No grand plan. Just a road we held and people who can sleep tonight. I could get used to your way of doing this, Amar." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_revolution",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "Burn the Granary",
    intro: "Amar has chosen Maya's answer: revolution. The imperial depot on the border road holds the colony's taxed grain before it ships to Archbold's armies. If the squad burns it, the armies go hungry, the tax stops meaning anything, and every village on the road learns the empire can be hurt. Maya has been planning this strike since before she met Amar.",
    outro: "The granary burns, and the border garrison can see the smoke. No villagers go hungry because of it, since that grain was never going back to them anyway. What spreads is the news that the empire can be hurt. Within a week, Maya's prediction comes true.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: granaryMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
            body: "Commander's at the north stores, six on the yard. Those sledges burn if a lamp tips over. We fight first, then I light it on my mark. I've known this yard nine years." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then it's your strike. I'm just here to fight. Squad, follow Maya's plan. Take out the commander and the garrison falls apart without him." }
        ]
      },
      {
        id: "b19rv_maya_amar",
        trigger: { kind: "adjacent_eot", unitA: "maya", unitB: "amar" },
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "(between strikes) You could've been a king, and you're torching depots with me instead. No regrets yet?" },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "A fight over a crown is how all this started, Maya. Maybe this is how it ends. Watch the archer on your left." }
        ]
      },
      {
        id: "b19rv_the_match",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The commander falls and the garrison runs for the gate, unwilling to die for a warehouse. Maya walks across the yard alone, taking her time, and sets a lamp against the tally post." },
          { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
            body: "(as the fire catches) This is for the villages that grew it and never got to eat it." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_duty",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "Reporting for Service",
    intro: "Amar has chosen Khonu's answer: duty. The war has reached the border, and the rebellion's army needs officers more than symbols. Amar walks into the command tent in his father's old colors and accepts a captaincy, knowing what it means. His first orders are to hold a border bridge with a column too small for the job.",
    outro: "The bridge holds, but not everyone in the column survives. That night Amar writes three letters in regulation format and learns the names of the three soldiers who died. Khonu would have told him that this is what being a captain means. Writing the letters is part of the job.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: dutyBridgeMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
    // The assault column's second file — the bridge hold stays a hold
    // even if the squad routs the opening push.
    reinforcements: [
      {
        round: 4,
        at: [{ x: 13, y: 3 }, { x: 13, y: 5 }],
        announce: "The second wave reaches the bridge.",
        units: () => [
          ENEMIES.royalGuard("dt_w1", 1937, 15),
          ENEMIES.royalArcher("dt_w2", 1938, 14)
        ]
      }
    ],
    difficultyLabel: "Duty · Opener",
    unlocks: "b20_dawn_war", // war path continues into B20
    // Duty loadout — military precision. Standard officer kit: 1
    // royal lens + 1 mask + 2 potions. The quartermaster gives Amar
    // exactly what regulations specify, no more.
    rewards: ["royal_lens", "mask", "potion", "potion"],
    // Victory: survive the assault. Killing the column isn't the order —
    // holding the bridge is. Six rounds until the relief column arrives.
    victory: anyOf(surviveRounds(6), routAfterReinforcements(4)),
    dialogues: [
      {
        id: "b19d_the_order",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Our orders: the bridge holds until the relief column gets here. Six rounds, maybe seven. We don't have to beat them. We just have to still be here. That's the whole job." },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "Look at you, regulation voice and everything. Khonu would be insufferable about this. Form the line on the carts. Make them pay for every plank." }
        ]
      },
      {
        id: "b19d_holding",
        trigger: { kind: "round_start", round: 4 },
        beats: [
          { speaker: "Ning", portraitId: "ning", expression: "exhausted",
            body: "(bowstring hand bleeding) Captain, half my quiver's gone and they're still coming." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Then the other half has to be enough. Two more rounds, Ning. Hold." }
        ]
      },
      {
        id: "b19d_relief",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Horns sound from the west road: the relief column is here. The imperial attack pulls back as steadily as it came. The column was too small to hold the bridge, but it held." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(quietly, to himself) Khonu. I read the order before I signed it, and I'd sign it again. I didn't understand that about you until tonight." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_exile",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The Long Road North",
    intro: "Amar has chosen Tev's answer: exile. He leaves the squad at camp and rides north alone toward the cold country. He tells no one his route; he doesn't know it himself. Two days out, in a snowy pass too steep to go around, three sets of tracks close in on his. The assassins have found him anyway, and he has to face them alone.",
    outro: "Amar buries them where they fell, because someone should and there is no one else to do it. Then he rides on into the cold country. One by one, he stops using the names he has gone by. The only one he can't leave behind is the name the empire is hunting.",
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
            body: "They don't call out or offer terms. These are professionals. The one up the pass ahead of Amar just nods, almost politely, and the two on the flanks start closing in." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "(to the empty pass) I left the crown. I left the war. I left everyone who would've stood here with me. That was the point. So this fight is just mine." }
        ]
      },
      {
        id: "b19e_buried",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The pass goes quiet. The three killers lie in the snow where they tried to trap him. Amar stands alone among them, breathing hard. There is no one else there." },
          { speaker: "Amar", portraitId: "amar", expression: "wounded",
            body: "(finding the shovel strapped to their packhorse) You came ready to bury someone. ...Fine. Someone gets buried." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_mercy",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "The Open Hand",
    intro: "Amar has chosen Yul's answer: mercy. Greywall Fort has tried to surrender three times, to the empire's own inspectors, to a rebel column, to anyone, and each time it was refused. Amar rides to the gate under his own banner and offers terms a fourth time. The garrison lays down its arms, but its captain refuses, and the squad has to subdue him.",
    outro: "The garrison's surrender holds. By morning the fort's armoury has become a hospital, with wounded from both armies in cots side by side, fed from the same pot. Selene watches from the edge of the lamplight for a long time. She says nothing, and is gone before dawn.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: fortMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
            body: "(drawing his sword) My garrison may kneel. I hold a King's commission, and I do not kneel to a colonial with a borrowed banner. Let's see you refuse MY terms, heir." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Your men chose to live, Captain. I'm not here to take that from them, or from you, if you'll let me. Squad, bring him down. Nobody dies unless they insist on it." }
        ]
      },
      {
        id: "b19m_amar_captain",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "royal_captain" },
        beats: [
          { speaker: "Holdout Captain", portraitId: "royal_guard", expression: "neutral",
            body: "(bleeding) Why won't you finish it? Being mocked like this is worse than dying, boy." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Nobody's mocking you. Yul, a surgeon, taught me you can stop a man without killing him. She never once asked which side a wounded man fought for. Yield, Captain. This war doesn't need one more body." }
        ]
      },
      {
        id: "b19m_surrender_stands",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The captain goes down and stays down, alive, disarmed and furious. On the walls, the garrison that watched the whole fight quietly lowers the last of its blades. The fort's fourth surrender is accepted." },
          { speaker: "Ning", portraitId: "ning", expression: "startled",
            body: "(quietly) Amar, the gate. Someone with scars is standing at the edge of the lamplight, just watching. ...That's Selene." }
        ]
      }
    ]
  },
  {
    id: "b19_path_opener_forgetting",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "A Fisherman's Cottage",
    intro: "Amar has chosen Sera's answer: forgetting. He rides for the southern coast and stops trying to be anyone. He has a cottage, a boat, and a name that isn't Amar. It lasts one season. Then three men with a sketch and a bounty notice come up the beach. The fisherman meets them at the waterline with a boat-hook and a soldier's training.",
    outro: "The squad arrives at dusk, too late to help but in time to see he didn't need it. They keep their word and leave, setting a sword and a potion by his door. He looks at both all evening. In the morning he leaves the sword where it is and goes out in the boat.",
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
            body: "The man with the sketch looks from the paper to the fisherman and back, twice, and grins. The tide is out, and there is nobody on the long beach but the four of them." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "(setting down the net, picking up the boat-hook) You have the wrong man. I mean that more than you'll ever know. This is your last chance to believe me." }
        ]
      },
      {
        id: "b19f_the_sword",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "It's over fast. The fisherman has forgotten a lot, but not how to fight. The bounty men lie in the shallows. Four riders from his old squad watched it all from the treeline. They don't come down." },
          { portraitId: "narrator",
            body: "By dark the riders are gone. In the morning there is a sword he knows on the doorstep, with a potion and no note. They didn't leave a note because they didn't want to ask anything of him." }
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
    intro: "Madame Dawn's rebellion has become open war. King Archbold's western army meets the rebels on a field an hour's ride from Grude, with banners on both ridges and the squad in the gap between them. General Serrick commands the imperial line from the northeast hill. Whatever brought the squad to this coast, today they fight in Dawn's army. If Serrick falls, his line will break.",
    outro: "The imperial line breaks, at a heavy cost. Across the field, Dawn's rebels are cheering a name. It takes Amar a moment to realize it's his.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    atmosphere: "dust", // churned field air over the war ground
    map: warFieldMap,
    buildPlayers: () => [
      PLAYERS.maya(),
      PLAYERS.amar(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
            body: "Look at the field, Amar. Banners on both ridges and us in the middle. This is Dawn's war now. Ours too, whether we signed up for it or not." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then we fight it the way Lucian taught us: for the people standing next to us. Serrick is holding their line together. Take him down and the rest of it falls apart. Squad, forward." }
        ]
      },
      {
        id: "b20_amar_serrick",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "imperial_general" },
        beats: [
          { speaker: "General Serrick", portraitId: "serrick",
            body: "The heir himself. Your father wants me to ask you one last time, boy. Whose side are you on? Your mother, who is using you, or the King, who made you?" },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "Everyone keeps offering me somebody else's side. I've picked my own. (drawing his sword) You're about to find out what that costs." }
        ]
      },
      {
        id: "b20_line_breaks",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Serrick falls on the hill he refused to leave, and the imperial line collapses. Across the field, the rebels start chanting a name over and over, and it isn't Dawn's." },
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "(quietly) They're cheering for you instead of her. Be careful with that. She heard it too." }
        ]
      }
    ],
    // War-arc path flavor: the shared war keeps its shared script;
    // the player's chosen philosophy speaks once per battle on top
    // (additive extraDialogues — see PathOverride).
    pathOverrides: {
      vengeance: {
        extraDialogues: [{
          id: "b20_dawn_war_path_vengeance",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
              body: "Two armies, and my father's somewhere behind the far one. I didn't come all this way to admire the view. Cut through them." }
          ]
        }]
      },
      restoration: {
        extraDialogues: [{
          id: "b20_dawn_war_path_restoration",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Amar", portraitId: "amar", expression: "resolute",
              body: "This mud is somebody's farmland. When we're done, it goes back to growing barley. So go easy on the ground. It doesn't belong to us." }
          ]
        }]
      },
      revolution: {
        extraDialogues: [{
          id: "b20_dawn_war_path_revolution",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
              body: "Two rulers, sacrificing other people's sons in one afternoon. Remember this field, Amar. One day somebody's going to ask you why the thrones have to go." }
          ]
        }]
      },
      duty: {
        extraDialogues: [{
          id: "b20_dawn_war_path_duty",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Corin", portraitId: "corin", expression: "resolute",
              body: "We keep the rotation, even here. Feed, tack, watch, fight. Angry men break formation, and we said we would hold. So we hold." }
          ]
        }]
      },
      mercy: {
        extraDialogues: [{
          id: "b20_dawn_war_path_mercy",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Amar", portraitId: "amar", expression: "resolute",
              body: "Pass it down the line before the charge: any man who drops his blade walks off this field alive. Today especially. Make sure the back ranks hear it." }
          ]
        }]
      }
    }
  },
  {
    id: "b21_archbold_advances",
    index: 21,
    title: "Twenty-First Battle",
    subtitle: "Archbold Advances",
    intro: "King Archbold has called up the inner provinces and ridden west. Only open road lies between him and Grude, and Captain Halden's vanguard is on it. The squad holds a barricade across the King's Road. They can't win, but they can slow him down. Every round the road stays blocked gives Grude another hour. Hold for six rounds.",
    outro: "The vanguard pulls back. The King's army is still getting closer, but because the barricade held, he is now a full day's march behind schedule.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    atmosphere: "dust", // road dust off two hundred boots
    map: kingsRoadMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
    // The column has no end — the intro says two hundred at the bend.
    // Halden feeds files onto the road until the clock runs out.
    reinforcements: [
      {
        round: 2,
        at: [{ x: 21, y: 4 }, { x: 21, y: 6 }, { x: 21, y: 1 }],
        announce: "Halden sends more soldiers up the road.",
        units: () => [
          ENEMIES.royalGuard("aa_w1", 2107, 16),
          ENEMIES.royalGuard("aa_w2", 2108, 15),
          ENEMIES.royalArcher("aa_w3", 2109, 15)
        ]
      },
      {
        round: 4,
        at: [{ x: 21, y: 5 }, { x: 21, y: 8 }],
        announce: "More of the column keeps coming.",
        units: () => [
          ENEMIES.royalGuard("aa_w4", 2110, 16),
          ENEMIES.royalArcher("aa_w5", 2111, 15)
        ]
      }
    ],
    difficultyLabel: "Climactic",
    // Victory: pure delay. The vanguard outnumbers everything the squad
    // can put on the road — the win is the clock, not the rout.
    victory: anyOf(surviveRounds(6), routAfterReinforcements(4)),
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
            body: "I counted twice. Two hundred at the bend and more behind them. Amar, we don't win this one." },
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
            body: "Two more rounds, Leo. It can bend, just don't let them through." }
        ]
      },
      {
        id: "b21_horn",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "A horn sounds from the east, and the vanguard marches back the way it came, in good order. Halden has run out of time and the squad is nearly out of strength, but the road held." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "(leaning on the barricade) 'Every hour counts.' Lucian used to say that about harvests. Well, we just bought Grude a whole night. Let's fall back before they change their minds." }
        ]
      }
    ],
    // War-arc path flavor: the shared war keeps its shared script;
    // the player's chosen philosophy speaks once per battle on top
    // (additive extraDialogues — see PathOverride).
    pathOverrides: {
      vengeance: {
        extraDialogues: [{
          id: "b21_archbold_advances_path_vengeance",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
              body: "He's on this road. My father's somewhere behind that column, sitting dry in his tent. If I start forgetting the plan, Maya, remind me. Talk me down slowly if you have to." }
          ]
        }]
      },
      restoration: {
        extraDialogues: [{
          id: "b21_archbold_advances_path_restoration",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Leo", portraitId: "leo", expression: "wounded_pride",
              body: "Every field he takes, somebody has to replant. So it's the roads we're protecting too, and the wells, and the mill by the ford. Don't let him take anything we'd want back." }
          ]
        }]
      },
      revolution: {
        extraDialogues: [{
          id: "b21_archbold_advances_path_revolution",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
              body: "Ten thousand drafted boys, marched here to bring back one son. That's what the whole system does, Amar. Your father is just the clearest example of it." }
          ]
        }]
      },
      duty: {
        extraDialogues: [{
          id: "b21_archbold_advances_path_duty",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Corin", portraitId: "corin", expression: "resolute",
              body: "An advance stops when it hits something that won't move. Today that's us. Stand where you said you'd stand." }
          ]
        }]
      },
      mercy: {
        extraDialogues: [{
          id: "b21_archbold_advances_path_mercy",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Veya", portraitId: "veya", expression: "grim_resolve",
              body: "Half those boys were dragged at spear-point from villages like the ones behind us. The officers give the orders, so point my lens at the officers. Take out the leaders and spare the rest." }
          ]
        }]
      }
    }
  },
  {
    id: "b22_grude_burns",
    index: 22,
    title: "Twenty-Second Battle",
    subtitle: "Grude Burns",
    intro: "The city's granaries burned in the night. Now Captain Brask's fire teams are setting the upper district alight, street by street. The corners of the market row are already burning. If the upper district burns, Grude loses every food store it has left. The squad enters at the south gate. Brask gives orders from the fountain square.",
    outro: "The squad saves what it can of the upper district. On the market row, people are already writing names on the scorched doors so the city remembers what it lost.",
    music: MUSIC.grudeBattle1,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    atmosphere: "embers", // the district is burning
    map: upperDistrictMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin()
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
          { speaker: "Captain Brask", portraitId: "brask",
            body: "The King doesn't want the city, heir. He wants nothing left that's DAWN'S. If he has to rule over ashes, he'll still be King." },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "You're burning bread, captain. That doesn't hurt Dawn. Be honest: he wants nothing left at all. (drawing his sword) You're done lighting fires." }
        ]
      },
      {
        id: "b22_named_doors",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The last burn team drops its torches at the fountain and runs. Smoke hangs thick over the market row. Everything that was saved was saved by hand, one corner at a time, by four people and everyone brave enough to pass buckets behind them." },
          { speaker: "Ning", portraitId: "ning", expression: "exhausted",
            body: "(sitting on the fountain rim, bow across her knees) We held it. Amar... how long can a city keep going like this?" },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "Until something happens with that sky, Ning. (looking east, where the sky has been the wrong colour for days) And I've got a feeling it'll be soon." }
        ]
      }
    ],
    // War-arc path flavor: the shared war keeps its shared script;
    // the player's chosen philosophy speaks once per battle on top
    // (additive extraDialogues — see PathOverride).
    pathOverrides: {
      vengeance: {
        extraDialogues: [{
          id: "b22_grude_burns_path_vengeance",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
              body: "My father would burn his own capital before he'd let it feed me. That's exactly who he is. Brask first, then the road north." }
          ]
        }]
      },
      restoration: {
        extraDialogues: [{
          id: "b22_grude_burns_path_restoration",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
              body: "That food could feed my whole town for a winter. This war will end, but winter comes every year. Granaries first, Amar. Please." }
          ]
        }]
      },
      revolution: {
        extraDialogues: [{
          id: "b22_grude_burns_path_revolution",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
              body: "Look what a king does the moment he starts losing. One day somebody's going to ask you why every throne has to go. Tell them about tonight." }
          ]
        }]
      },
      duty: {
        extraDialogues: [{
          id: "b22_grude_burns_path_duty",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Corin", portraitId: "corin", expression: "resolute",
              body: "Tonight the soldiers carry buckets. One corner at a time, in order. No heroics." }
          ]
        }]
      },
      mercy: {
        extraDialogues: [{
          id: "b22_grude_burns_path_mercy",
          trigger: { kind: "round_start", round: 2 },
          beats: [
            { speaker: "Veya", portraitId: "veya", expression: "focused",
              body: "Brask's men only burn things because they're told to. Take the captain down and they'll throw their torches in the gutter on their own. One man tonight. Just him." }
          ]
        }]
      }
    }
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
    intro: "What's left of Serrick's broken army has dug into the canyon narrows under Colonel Vasse. He keeps fighting because stopping would mean the war was for nothing. His men are the last human army between the squad and whatever is happening in the eastern sky. How the squad deals with them depends on Amar's path.",
    outro: "The squad makes it through the narrows. How this day is remembered depends on the path Amar chose.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: narrowsMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin(),
      // Rejoined at the held city (post_grude_burns): Selene, hunting the
      // same war from its shadows since her B7 escape, and Ranatoli,
      // freed when the district fires cracked the prison row. The fleet
      // arc plays eight-strong.
      PLAYERS.selene(),
      PLAYERS.ranatoli()
    ],
    buildEnemies: () => [
      ENEMIES.remnantColonel(18),
      ENEMIES.royalGuard("nr_rg1", 2301, 17),
      ENEMIES.royalGuard("nr_rg2", 2302, 17),
      ENEMIES.royalArcher("nr_ra1", 2303, 16),
      ENEMIES.royalArcher("nr_ra2", 2304, 16)
    ],
    difficultyLabel: "Climactic",
    rewards: ["elixir", "elixir", "fang"],
    dialogues: [
      {
        id: "b23_base_open",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Colonel Vasse", portraitId: "vasse",
            body: "You broke Serrick's line, boy. I built this one from what was left. Every man here is grieving. Let's see if that's enough to hold." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "It'll hold, colonel. Just for the wrong man. Squad, whoever holds the canyon's narrowest point wins this. Take it first." }
        ]
      },
      {
        id: "b23_base_bv",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The fighting in the narrows ends. The soldiers who surrender are disarmed and sent west, away from the strange eastern sky." }
        ]
      }
    ],
    pathOverrides: {
      vengeance: {
        subtitle: "The Path Narrows — The List",
        intro: "Colonel Vasse held the ridge the night his father's assassins came for Amar. He has been on Maya's list since she started keeping it. Now he holds the narrows, and his is one of the last names left.",
        outro: "Maya crosses one more name off the list. Only a few are left, but Amar is as angry as ever, and the squad has started to notice.",
        victory: defeatUnit("remnant_colonel", { label: "Cross off Colonel Vasse" }),
        dialogues: [
          {
            id: "b23_v_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
                body: "Vasse. That's the fourth name. He held the ridge the night they came to kill you. (folding the list away) His escort isn't on it, Amar. Just him." },
              { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
                body: "Just him, then. The rest can walk home and grow old telling this story. Squad, go for the colonel. Nobody else needs to die in this canyon." }
            ]
          },
          {
            id: "b23_v_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "Vasse falls at the narrowest point of the canyon, on ground he chose. His escort lowers their spears without being told to. Maya crosses out his name with a single stroke." },
              { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
                body: "(quietly) That's four. The list keeps getting shorter, Amar, but you're not any less angry. Somebody should say that out loud." }
            ]
          }
        ]
      },
      restoration: {
        subtitle: "The Path Narrows — The Granary Road",
        intro: "The narrows are the only road the rebuilt villages can use to move their grain, and Colonel Vasse has closed it. Every day the pass stays shut, the first harvest of the new Anthros rots in its wagons. The squad has to clear Vasse's men off the road.",
        outro: "By evening the first wagons roll through the narrows. The drivers keep their eyes on the road and away from the bodies. The grain is moving again.",
        dialogues: [
          {
            id: "b23_r_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "Behind us are forty wagons of the first harvest anyone in these villages has kept for themselves in eighty years. The colonel is standing on their road. Open it." },
              { speaker: "Leo", portraitId: "leo", expression: "resolute",
                body: "Lucian used to say keeping a road open feeds more people than winning a battle. (setting his spear) Let's do both anyway." }
            ]
          },
          {
            id: "b23_r_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "The colonel's men break, and the narrows are open. The first wagon through carries seed grain. The driver lifts a hand from the reins to thank the squad and keeps going." }
            ]
          }
        ]
      },
      revolution: {
        subtitle: "The Path Narrows — The Offer",
        intro: "Colonel Vasse sent Madame Dawn an offer under a truce flag: his men will surrender if the new order keeps a throne for them to kneel to. Dawn has not answered. Maya intercepted the letter. The squad goes to the narrows to answer it themselves.",
        outro: "The offer burns along with the colonel's papers. The revolution will have no thrones: not the King's, not the one Vasse asked for, and soon not the one Dawn is building either.",
        dialogues: [
          {
            id: "b23_rev_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
                body: "Vasse offered Dawn a deal. He'll kneel as long as there's a throne. Any throne, he doesn't care whose. That idea is what we're really fighting in this canyon." },
              { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
                body: "Then we answer for her. No thrones. Not his, not the one she's planning, nobody's. Squad, break their line and burn that offer." }
            ]
          },
          {
            id: "b23_rev_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "In the colonel's tent, Maya finds a clean copy of the offer, sealed and waiting for Dawn's reply. She reads it once, drops it in the fire, and watches until it has burned completely." }
            ]
          }
        ]
      },
      duty: {
        subtitle: "The Path Narrows — Orders",
        intro: "The order from Dawn's command is short and blunt: take the narrows, take no prisoners, the remnant is 'a proven infection.' Amar read it twice, folded it, and put it in his coat. The squad will take the narrows. Whether they take prisoners is up to Amar.",
        outro: "The report says the narrows were taken and the enemy scattered. It doesn't mention prisoners either way. Amar signs it, knowing he followed the order on paper and changed it in the field.",
        dialogues: [
          {
            id: "b23_d_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Amar", portraitId: "amar", expression: "guarded",
                body: "Command says take the narrows. ...It says some other things too. We take the narrows. For the rest, I'll do what Khonu taught me: read the list before you sign it." },
              { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
                body: "And if command asks why the remnant walked out of this canyon alive? I'm going to miss the ones who drop their weapons, captain. Just so you know what your archer's doing." }
            ]
          },
          {
            id: "b23_d_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "The soldiers who surrender are disarmed and marched west under guard, which the order never asked Amar to provide. The report will be accurate, and it will also leave a few things out on purpose." }
            ]
          }
        ]
      },
      mercy: {
        subtitle: "The Path Narrows — The Yield",
        intro: "Amar follows the surgeon's rule: stop the man without killing him. Vasse's two hundred men are ready to die for a war that is lost the moment he falls. The squad must defeat the colonel, and only him, so the rest can go home.",
        outro: "Vasse sits against the canyon wall, disarmed, furious, and alive. His two hundred men walk west without their weapons, and nobody else dies in the narrows.",
        victory: defeatUnit("remnant_colonel", { label: "Break Colonel Vasse" }),
        dialogues: [
          {
            id: "b23_m_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "Two hundred men in this canyon, and one of them is the reason the rest would die here. Vasse goes down and stays down. Nobody else dies unless they insist. That's the order." },
              { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
                body: "Yul would have liked you, I think. (drawing her blades) For the record, the colonel's guard will insist. The colonel himself is yours." }
            ]
          },
          {
            id: "b23_m_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "The colonel goes down and stays down. His two hundred men watch it happen. Then, one line at a time, they drop their weapons." }
            ]
          }
        ]
      }
    }
  },
  {
    id: "b24_path_climax_b",
    index: 24,
    title: "Twenty-Fourth Battle",
    subtitle: "The Bell Before the Sky",
    intro: "The bell court holds the west's last warning bell. If it rings, every village between here and the mountains will know to arm themselves or hide. Warden Sarto's orders are that no one rings it except for the King. But the eastern sky has been the wrong colour for four days, and the squad has come to ring it.",
    outro: "The bell rings. The sky changes within the hour.",
    music: MUSIC.intenseBattle2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: true,
    map: bellCourtMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin(),
      // Rejoined at the held city (post_grude_burns): Selene, hunting the
      // same war from its shadows since her B7 escape, and Ranatoli,
      // freed when the district fires cracked the prison row. The fleet
      // arc plays eight-strong.
      PLAYERS.selene(),
      PLAYERS.ranatoli()
    ],
    buildEnemies: () => [
      ENEMIES.bellWarden(18),
      ENEMIES.royalGuard("bc_rg1", 2401, 17),
      ENEMIES.royalGuard("bc_rg2", 2402, 17),
      ENEMIES.royalGuard("bc_rg3", 2403, 16),
      ENEMIES.royalGuard("bc_rg4", 2404, 16),
      ENEMIES.royalGuard("bc_rg5", 2406, 17),
      ENEMIES.royalGuard("bc_rg6", 2407, 18),
      ENEMIES.royalArcher("bc_ra1", 2405, 17),
      ENEMIES.royalArcher("bc_ra2", 2408, 17),
      ENEMIES.royalArcher("bc_ra3", 2409, 18),
      ENEMIES.royalGuard("bc_rg7", 2410, 18)
    ],
    difficultyLabel: "Climactic",
    rewards: ["elixir", "elixir", "royal_lens"],
    dialogues: [
      {
        id: "b24_base_open",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Warden Sarto", portraitId: "sarto",
            body: "The bell rings for the King or it does not ring at all. I have kept that rule for thirty years. Do not make my last week of it difficult." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Look east, warden. Whatever's in that sky is coming for your bell and your King both. It rings tonight, for everyone. Squad, his shield's only weak from behind." }
        ]
      },
      {
        id: "b24_base_mid",
        trigger: { kind: "round_start", round: 3 },
        beats: [
          { speaker: "Leo", portraitId: "leo", expression: "wide-eyed_horror",
            body: "Amar. The horizon just LIT. East, over the water. That's not weather and it's not dawn." },
          { speaker: "Maya", portraitId: "maya", expression: "alarmed",
            body: "Then we can't take this slowly anymore. The bell, Amar. Now. That warden is standing between us and the only warning the west is going to get." }
        ]
      },
      {
        id: "b24_base_bv",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "Ning climbs the tower and pulls the rope with all her weight. The bell rings once, twice, three times, and the sound carries west over every village between here and the mountains." },
          { speaker: "Amar", portraitId: "amar", expression: "guarded",
            body: "(watching the east) Whatever's out there heard that bell. Everyone eat something and sleep in your armor. Tomorrow we find out what's up there." }
        ]
      }
    ],
    pathOverrides: {
      vengeance: {
        subtitle: "The Bell Before the Sky — The Muster Rolls",
        intro: "The warden guards more than the bell. The court archive holds the army rolls naming every officer in the column Archbold sent to bring Amar back. The last names on Maya's list are in that tower. So is the west's last warning bell, and with the sky changing, there's no time for settling scores.",
        outro: "The bell rings. In the archive, Maya finds the rolls and reads out the last names as the sound fades. Only two names are left, and one of them is the King's."
      },
      revolution: {
        subtitle: "The Bell Before the Sky — Dawn's Bell",
        intro: "Dawn's army reached the bell court first. Marshal Othren holds it under her orders: the bell rings only when Dawn decides the villages should be afraid. The squad came to ring it for the villages. For the first time, they have to fight the rebellion they helped build.",
        outro: "The squad rings the bell without anyone's permission. Othren loses his second gate, survives, and doesn't seem surprised. The sky changes within the hour. Dawn's letter demanding an explanation will never reach them now.",
        buildEnemies: () => [
          ENEMIES.dawnLoyalist(18),
          ENEMIES.banditSwordsman("bc_dl1", 2411, 16),
          ENEMIES.banditSwordsman("bc_dl2", 2412, 16),
          ENEMIES.banditSpearton("bc_dl3", 2413, 16),
          ENEMIES.banditArcher("bc_dl4", 2414, 16),
          ENEMIES.banditArcher("bc_dl5", 2415, 15)
        ],
        dialogues: [
          {
            id: "b24_rev_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Marshal Othren", portraitId: "othren",
                body: "You again, your highness. The quay, and now this. Madame Dawn says the bell rings when fear is USEFUL. She has always been right before." },
              { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
                body: "That bell is for the people it warns, Othren. It doesn't ring on her schedule. South colonnade. Break their line." }
            ]
          },
          {
            id: "b24_rev_mid",
            trigger: { kind: "round_start", round: 3 },
            beats: [
              { speaker: "Maya", portraitId: "maya", expression: "alarmed",
                body: "The horizon just lit up, east over the water, and Dawn's still holding back the warning. Look at that, Amar. This is what anyone on a throne ends up doing." }
            ]
          },
          {
            id: "b24_rev_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "Othren gives up the tower the same way he gave up the quay: on his feet and unashamed. He followed his orders exactly as far as they went and no further. Ning rings the bell until her arms shake." },
              { speaker: "Marshal Othren", portraitId: "othren",
                body: "(calling after them) She'll hear that bell in Grude, your highness, and she'll know exactly who rang it. You can't take this back. ...I think you know that." }
            ]
          }
        ]
      },
      mercy: {
        subtitle: "The Bell Before the Sky — The Warning",
        intro: "If the bell rings too early, villages empty for nothing. If it rings too late, people die. Warden Sarto would die before letting it ring; it's the only order he has left. The squad follows the surgeon's rule again: stop him without killing him, then ring the warning for everyone, both armies included.",
        outro: "The bell rings. Sarto, disarmed and alive, is made to sit in the court and listen to it. By the third ring he stops struggling. By the sixth he is telling Ning the proper rhythm for a general alarm.",
        victory: defeatUnit("bell_warden", { label: "Break Warden Sarto" }),
        dialogues: [
          {
            id: "b24_m_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "The warden goes down alive. Then the bell warns everyone: villages, remnant, Dawn's columns, all of them. Whatever's coming won't care whose side they're on. Neither do we." },
              { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
                body: "Break his shield, spare the man. You keep picking the hard way, Amar. Go on, we've got your back." }
            ]
          },
          {
            id: "b24_m_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "Sarto goes down and stays down. His guards know how the squad fights, and they lower their weapons without being told. The bell rings out for every home in the west, whichever side they're on." }
            ]
          }
        ]
      }
    }
  },
  {
    id: "b25_fleet_arrival",
    index: 25,
    title: "Twenty-Fifth Battle",
    subtitle: "The Sky Speaks",
    intro: "At sunrise, a fleet drops out of orbit. First comes a sound from the sky that no one alive has ever heard. Then landing craft roar down onto the plain east of the city. Whatever comes out of them calls itself the Ravage, a word that doesn't come from any kingdom on the map.",
    outro: "The squad drives back the first wave. A second wave is already coming down, trailing fire.",
    music: MUSIC.intenseBattle3,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: true,
    atmosphere: "embers",
    map: landingFieldMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin(),
      // Rejoined at the held city (post_grude_burns): Selene, hunting the
      // same war from its shadows since her B7 escape, and Ranatoli,
      // freed when the district fires cracked the prison row. The fleet
      // arc plays eight-strong.
      PLAYERS.selene(),
      PLAYERS.ranatoli()
    ],
    buildEnemies: () => [
      ENEMIES.ravageTrooper("fa_t1", 2501, 19),
      ENEMIES.ravageTrooper("fa_t2", 2502, 19),
      ENEMIES.ravageTrooper("fa_t3", 2503, 18),
      ENEMIES.ravageLancer("fa_l1", 2504, 19),
      ENEMIES.ravageLancer("fa_l2", 2505, 18),
      ENEMIES.ravageTrooper("fa_t4", 2508, 19),
      ENEMIES.ravageTrooper("fa_t5", 2509, 19),
      ENEMIES.ravageLancer("fa_l3", 2510, 19),
      ENEMIES.ravageMarksman("fa_m1", 2506, 19),
      ENEMIES.ravageMarksman("fa_m2", 2507, 18),
      ENEMIES.ravageMarksman("fa_m3", 2511, 19)
    ],
    difficultyLabel: "Climactic",
    rewards: ["elixir", "elixir", "royal_lens", "fang"],
    dialogues: [
      {
        id: "b25_contact",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { portraitId: "narrator",
            body: "The craft's ramp opens without a sound. The figures that come down it move like trained soldiers, in dark armor with a wet shine. Signal-banners on the wreckage spell out one word in every harbor code at once: RAVAGE." },
          { speaker: "Maya", portraitId: "maya", expression: "steel_cold_confession_face",
            body: "That's their name for themselves, Amar. The old sailors' word, the one in your mother's song. It was never our word. We learned it from somewhere. Somebody met them before we did." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then they've met people like us before and know what it costs. Squad, whatever else they are, they're soldiers. Soldiers fight in lines, and lines break. Forward." }
        ]
      },
      {
        id: "b25_steel",
        trigger: { kind: "round_start", round: 2 },
        beats: [
          { speaker: "Leo", portraitId: "leo", expression: "wide-eyed_horror",
            body: "My spear SKIPPED off that one. Like river ice. What are they wearing?!" },
          { speaker: "Ning", portraitId: "ning", expression: "focused_bow",
            body: "Go for the joints, Leo. Anything that walks has joints. Aim where the armor bends, not at the shiny parts." }
        ]
      },
      {
        id: "b25_bv",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The first wave is beaten. The Ravage don't run, don't cry out, and don't leave their wounded behind. They all stop at the same moment and pull back. Overhead, more fire is already falling." },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "They were testing us. That wave was to see what we can do. (watching the sky) The next one's the real attack." }
        ]
      }
    ]
  },
  {
    id: "b26_coastal_hold",
    index: 26,
    title: "Twenty-Sixth Battle",
    subtitle: "Hold the Coast",
    intro: "The second wave doesn't land on the plain. The Ravage walk out of the sea, side by side through the surf. If the coast falls, the land behind it falls too, and the war will be lost for everyone within a month. The squad holds the dune line. In six rounds the coast batteries will be ready to fire. The bell's warning gave the west time to build them.",
    outro: "The coast holds, barely. The dunes are wrecked and covered in debris.",
    music: MUSIC.intenseBattle2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: true,
    map: coastHoldMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin(),
      // Rejoined at the held city (post_grude_burns): Selene, hunting the
      // same war from its shadows since her B7 escape, and Ranatoli,
      // freed when the district fires cracked the prison row. The fleet
      // arc plays eight-strong.
      PLAYERS.selene(),
      PLAYERS.ranatoli()
    ],
    buildEnemies: () => [
      ENEMIES.ravageTrooper("ch_t1", 2601, 19),
      ENEMIES.ravageTrooper("ch_t2", 2602, 19),
      ENEMIES.ravageTrooper("ch_t3", 2603, 19),
      ENEMIES.ravageLancer("ch_l1", 2604, 19),
      ENEMIES.ravageLancer("ch_l2", 2605, 19),
      ENEMIES.ravageTrooper("ch_t4", 2608, 19),
      ENEMIES.ravageLancer("ch_l3", 2609, 20),
      ENEMIES.ravageMarksman("ch_m1", 2606, 19),
      ENEMIES.ravageMarksman("ch_m2", 2607, 18),
      ENEMIES.ravageMarksman("ch_m3", 2610, 19),
      ENEMIES.ravageTrooper("ch_t5", 2612, 20)
    ],
    // The tide. The intro promises six rounds of the sea walking ashore —
    // these are the waves that keep the promise.
    reinforcements: [
      {
        round: 2,
        at: [{ x: 18, y: 5 }, { x: 16, y: 2 }, { x: 16, y: 8 }, { x: 19, y: 3 }],
        announce: "The next line wades ashore.",
        units: () => [
          ENEMIES.ravageTrooper("ch_w31", 2611, 19),
          ENEMIES.ravageTrooper("ch_w32", 2612, 19),
          ENEMIES.ravageLancer("ch_w33", 2613, 19),
          ENEMIES.ravageMarksman("ch_w34", 2622, 19)
        ]
      },
      {
        round: 4,
        at: [{ x: 18, y: 4 }, { x: 18, y: 6 }, { x: 16, y: 1 }, { x: 19, y: 7 }],
        announce: "One more line walks out of the surf.",
        units: () => [
          ENEMIES.ravageTrooper("ch_w51", 2614, 19),
          ENEMIES.ravageLancer("ch_w52", 2615, 19),
          ENEMIES.ravageMarksman("ch_w53", 2616, 18),
          ENEMIES.ravageTrooper("ch_w54", 2623, 20)
        ]
      }
    ],
    difficultyLabel: "Climactic",
    victory: anyOf(surviveRounds(6), routAfterReinforcements(4)),
    rewards: ["elixir", "elixir", "elixir", "mask"],
    dialogues: [
      {
        id: "b26_surf",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Ning", portraitId: "ning", expression: "startled",
            body: "They're coming out of the WATER. No boats. Just... walking out of the surf like it's a doorway." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then we stop them at this dune. Six rounds, squad. The batteries the bell bought us are being dragged up the coast road RIGHT NOW. Make them fight for every foot of sand." }
        ]
      },
      {
        id: "b26_pressure",
        trigger: { kind: "round_start", round: 4 },
        beats: [
          { speaker: "Leo", portraitId: "leo", expression: "fury",
            body: "The tide keeps BRINGING them! Barricade's down to kindling on the south dune!" },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "Kindling still slows them down. Two more rounds, Leo. Count them out loud if it helps." }
        ]
      },
      {
        id: "b26_bv",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The first coast battery fires from the headland, then the others join in. The Ravage line coming out of the sea stops, then pulls back under the surf. The dune is mostly gone, but the coast has held." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "(sitting down in the wrecked sand) 'Every hour counts.' (laughing, exhausted) Lucian, you'd never believe where that saying has ended up." }
        ]
      }
    ]
  },
  {
    id: "b27_orbital_descent",
    index: 27,
    title: "Twenty-Seventh Battle",
    subtitle: "Orbital Descent",
    intro: "At midnight the landing field lights up again. A single craft comes down slowly, under escort. The Ravage command has sent its Herald in person to see who keeps beating back its waves, and to judge what they're worth. The squad walks back out onto the scarred plain to face it.",
    outro: "The Ravage have seen the squad. They are not leaving.",
    music: MUSIC.intenseBattle3,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: true,
    darkBattle: true,
    atmosphere: "embers",
    map: descentFieldMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin(),
      // Rejoined at the held city (post_grude_burns): Selene, hunting the
      // same war from its shadows since her B7 escape, and Ranatoli,
      // freed when the district fires cracked the prison row. The fleet
      // arc plays eight-strong.
      PLAYERS.selene(),
      PLAYERS.ranatoli()
    ],
    buildEnemies: () => [
      ENEMIES.ravageHerald(19),
      ENEMIES.ravageTrooper("od_t1", 2701, 19),
      ENEMIES.ravageTrooper("od_t2", 2702, 19),
      ENEMIES.ravageTrooper("od_t3", 2706, 20),
      ENEMIES.ravageLancer("od_l1", 2703, 19),
      ENEMIES.ravageLancer("od_l2", 2707, 20),
      ENEMIES.ravageLancer("od_l3", 2708, 19),
      ENEMIES.ravageMarksman("od_m1", 2704, 19),
      ENEMIES.ravageMarksman("od_m2", 2705, 19),
      ENEMIES.ravageMarksman("od_m3", 2709, 20)
    ],
    difficultyLabel: "Climactic",
    victory: defeatUnit("ravage_herald", { label: "Bring down the Herald" }),
    rewards: ["elixir", "elixir", "elixir", "elixir", "fang", "royal_lens"],
    dialogues: [
      {
        id: "b27_seen",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "The Herald", portraitId: "herald",
            body: "Show me the ones who held the shore. (speaking in every harbor code at once) Small. Soft-shelled. Loud. And yet you held." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Take a good look, Herald. Everyone on this field has been sized up before by somebody bigger. Ask your commander what happened to them. Squad, take the escort first. Make it watch." }
        ]
      },
      {
        id: "b27_why",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "ravage_herald" },
        beats: [
          { speaker: "The Herald", portraitId: "herald",
            body: "Your world burns its own harvests. Kings throw away sons. Mothers sacrifice cities. We have READ your ledgers, heir. Why defend a world that destroys itself?" },
          { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
            body: "Because it's ours. (raising his sword) Your ledgers only show what we lost. They don't show why people keep going anyway." }
        ]
      },
      {
        id: "b27_bv",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The Herald falls, slowly at first and then all at once. Its escort stops fighting and pulls back into the dark, carrying the body so carefully that they almost seem to be grieving." },
          { speaker: "Maya", portraitId: "maya", expression: "guarded_neutral",
            body: "It got what it came for. It wanted to know what we're worth. (looking up at the lights) By tomorrow, whoever commands that fleet will know what fighting us costs. Let's hope it's too much." }
        ]
      }
    ]
  },
  {
    id: "b28_path_final",
    // The war's last battle. post_path_final routes to the per-path
    // ending coda (RouteRef "ending"), which runs on into the marriage
    // question and the credits. Unlocking the epilogue here is what puts
    // Chapter 29 in the chapter select — it's still handed to the player
    // automatically after the credits, but a player who finishes 28 can
    // also find it on the map instead of staring at a locked card.
    unlocks: "b29_epilogue",
    index: 28,
    title: "Twenty-Eighth Battle",
    subtitle: "The Path Ends",
    intro: "This is the last battle of the war. The old coronation road runs straight into the shadow of the landed Ravage flagship. At the top of the marble stands the enemy Amar's whole path has led to. Who that is depends on his path, but everything is at stake either way.",
    outro: "The Ravage Commander falls, and the fleet's ships begin to rise and leave.",
    music: MUSIC.finalBattleSad,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: true,
    atmosphere: "embers",
    map: pathFinalMap,
    buildPlayers: () => [
      PLAYERS.amar(),
      PLAYERS.maya(),
      PLAYERS.ning(),
      PLAYERS.leo(),
      PLAYERS.veya(),
      PLAYERS.corin(),
      // Rejoined at the held city (post_grude_burns): Selene, hunting the
      // same war from its shadows since her B7 escape, and Ranatoli,
      // freed when the district fires cracked the prison row. The fleet
      // arc plays eight-strong.
      PLAYERS.selene(),
      PLAYERS.ranatoli()
    ],
    buildEnemies: () => [
      withSecondWind(ENEMIES.ravageCommander(20), bossPhaseTwo(
        "The Ravage Commander locks its plating back into place. Damage against it counts HALF from here, and it strikes back at anyone who comes within its reach."
      )),
      ENEMIES.ravageTrooper("pf_t5", 2810, 20),
      ENEMIES.ravageTrooper("pf_t1", 2801, 19),
      ENEMIES.ravageTrooper("pf_t2", 2802, 19),
      ENEMIES.ravageTrooper("pf_t3", 2805, 20),
      ENEMIES.ravageTrooper("pf_t4", 2806, 20),
      ENEMIES.ravageLancer("pf_l1", 2803, 19),
      ENEMIES.ravageLancer("pf_l2", 2804, 19),
      ENEMIES.ravageLancer("pf_l3", 2807, 20),
      ENEMIES.ravageMarksman("pf_m1", 2808, 20),
      ENEMIES.ravageMarksman("pf_m2", 2809, 19)
    ],
    // The reserve the Commander was always holding — it lands behind the
    // squad the instant the thing stands back up.
    reinforcements: [
      {
        onSecondWindOf: "ravage_commander",
        at: B28_RESERVE_TILES,
        announce: "The ramp opens a second time. A reserve comes down behind the squad.",
        units: () => [
          ENEMIES.ravageTrooper("pf_res1", 2851, 20),
          ENEMIES.ravageTrooper("pf_res2", 2852, 20),
          ENEMIES.ravageLancer("pf_res3", 2853, 20),
          ENEMIES.ravageMarksman("pf_res4", 2854, 19)
        ]
      }
    ],
    difficultyLabel: "Final Boss",
    victory: defeatUnit("ravage_commander", { label: "Break the Ravage Commander" }),
    rewards: ["elixir", "elixir", "elixir", "elixir", "elixir", "mask", "royal_lens"],
    dialogues: [
      {
        id: "b28_base_open",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "The Ravage Commander", portraitId: "ravage_commander",
            body: "The Herald told us what you would cost. I have come to pay it. (coming down the ramp alone, its guard following) One question first, mender of ledgers. When we are gone, will this world still be worth what you cost us?" },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Ask the villages behind me in a hundred years. That's the only answer either of us would believe. (drawing his sword) Squad, give it everything we've got. The whole war comes down to this." }
        ]
      },
      {
        id: "b28_base_last",
        trigger: { kind: "round_start", round: 3 },
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "(setting his shield, eyes on the line) Six years in a cell, and this is what I dreamed about. Not getting out. This. Standing somewhere that matters, with people who came back for me. Whatever happens up here, lad, I've already got what I wanted." },
          { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
            body: "Don't you dare make a speech, old man. (her voice shaking, which makes her angrier) Nobody's making speeches. We do this one the same as the first one, and then we all go home and I make you carry the bags." }
        ]
      },
      {
        id: "b28_base_close",
        trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "ravage_commander" },
        beats: [
          { speaker: "The Ravage Commander", portraitId: "ravage_commander",
            body: "You are eight. (parrying, and straining for the first time) We are a fleet. Explain the arithmetic to me, mender of ledgers. I have run it on four hundred shores, and it has never once come out this way." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "You counted us. You never counted the people we're standing in front of. (holding his ground) That's your mistake, and you've made it on every shore. You add up the soldiers and forget what they're protecting." }
        ]
      },
      {
        id: "b28_base_phase2",
        trigger: { kind: "second_wind", unitId: "ravage_commander" },
        beats: [
          { speaker: "The Ravage Commander", portraitId: "ravage_commander",
            body: "(It falls on the marble, then locks its plating back into place and stands. Behind it, the ramp opens again.) That was our opening offer, mender of ledgers. This is the full price. We will not offer again." },
          { speaker: "Amar", portraitId: "amar", expression: "resolute",
            body: "Then we pay it. (nobody steps back) Squad, our hits only do half now, and it strikes back at anyone who gets in close. Two on one, always. Veya, keep your light on it." }
        ]
      },
      {
        id: "b28_base_bv",
        trigger: { kind: "before_victory" },
        beats: [
          { portraitId: "narrator",
            body: "The Commander goes down at the foot of its own ramp. Every light on every craft along the horizon goes dark for a moment. It might be a salute, or a decision. Then the craft begin to rise." },
          { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
            body: "Too expensive. (sitting down right there on the marble) We cost them too much, Amar. That's the nicest thing an empire has ever said about us." }
        ]
      }
    ],
    pathOverrides: {
      vengeance: {
        music: MUSIC.finalBattleAttack,
        subtitle: "The Path Ends — The Last Name",
        intro: "King Archbold didn't wait for the fleet to decide what his kingdom was worth. He made a deal with it: safe passage out of the war, in return for the location of every coast battery built since the bell rang. He stands at the top of the coronation road in the flagship's shadow, guarded by his own soldiers and the Ravage he sold them to. The last name on Maya's list is about to leave with the fleet.",
        outro: "The list ends on the marble where the kings of Grude were crowned. Maya takes the King's signet ring as proof that the list is finished. With its deal dead, the fleet rises and leaves.",
        victory: defeatUnit("archbold", { label: "The last name" }),
        buildEnemies: () => [
          withSecondWind(ENEMIES.archbold(20), bossPhaseTwo(
            "Archbold puts on the coronation armor. Damage against him counts HALF from here, and he strikes back at anyone who comes within his reach."
          )),
          ENEMIES.royalGuard("pf_v9", 2819, 20),
          ENEMIES.royalGuard("pf_v1", 2811, 18),
          ENEMIES.royalGuard("pf_v2", 2812, 18),
          ENEMIES.royalGuard("pf_v5", 2815, 19),
          ENEMIES.royalGuard("pf_v6", 2816, 20),
          ENEMIES.royalArcher("pf_v7", 2817, 19),
          ENEMIES.royalArcher("pf_v8", 2818, 20),
          ENEMIES.ravageTrooper("pf_v3", 2813, 19),
          ENEMIES.ravageTrooper("pf_v4", 2814, 19),
          ENEMIES.ravageLancer("pf_v10", 2820, 20)
        ],
        reinforcements: [
          {
            onSecondWindOf: "archbold",
            at: B28_RESERVE_TILES,
            announce: "The household guard comes up the processional behind the squad.",
            units: () => [
              ENEMIES.royalGuard("pf_vres1", 2861, 20),
              ENEMIES.royalGuard("pf_vres2", 2862, 20),
              ENEMIES.royalArcher("pf_vres3", 2863, 19),
              ENEMIES.ravageTrooper("pf_vres4", 2864, 20)
            ]
          }
        ],
        dialogues: [
          {
            id: "b28_v_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "King Archbold", portraitId: "archbold", expression: "offering_peace",
                body: "My son. After everything, my actual son. (showing his empty hands) I sent assassins because a king is not allowed to apologize. Walk up here and I will say the word your mother never let me say." },
              { speaker: "Amar", portraitId: "amar", expression: "quiet_rage",
                body: "You sold out the coast to the fleet to save yourself, and now you're offering me a WORD? (drawing his sword) Maya, read him the list. All of it. He should hear where he comes in the order." }
            ]
          },
          {
            id: "b28_v_duel",
            trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "archbold" },
            beats: [
              { speaker: "King Archbold", portraitId: "archbold", expression: "righteous_fury",
                body: "I am the only thing that ever frightened your mother. Kill me, and that fear passes to you. That is your whole inheritance, boy. Fear is all any of us ever owned." },
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "Then it gets buried with you. For Selene. For the coast you sold. For the boy in the hospital bed who didn't know his own name because of you. You're the last name on the list." }
            ]
          },
          {
            id: "b28_v_last",
            trigger: { kind: "round_start", round: 3 },
            beats: [
              { speaker: "Selene", portraitId: "selene",
                body: "(fighting her way to his side) I bled on a palace floor eleven years ago, and you've been paying for it ever since. Every name, every mile. (quietly) Amar, I never asked you to do this. Not once." },
              { speaker: "Amar", portraitId: "amar", expression: "wounded",
                body: "I know. (his voice catching) You didn't ask, and I did it anyway, and I'd do it again. I think that's what Maya keeps calling a wound. One more name. Then I let all of this go and find out who I am without it." }
            ]
          },
          {
            id: "b28_v_phase2",
            trigger: { kind: "second_wind", unitId: "archbold" },
            beats: [
              { speaker: "King Archbold", portraitId: "archbold",
                body: "(He drops to one knee, then rises in the old coronation armor as the last of his household guard comes up the road.) Kings do not die the first time, boy. That is our whole trick. (lowering his visor) Your mother learned that standing about where you are now." },
              { speaker: "Maya", portraitId: "maya",
                body: "(not looking up from the line she's holding) Then I'll write his name down twice and cross it out twice. Amar, our hits only do half now, and he strikes back at anyone who gets close. Nobody fights him alone. Not even you." }
            ]
          },
          {
            id: "b28_v_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "The King of Grude dies on his own coronation road, killed by the son he tried to control. With its deal gone, the fleet rises. Nobody cheers. Maya's list is finished." },
              { speaker: "Maya", portraitId: "maya", expression: "tearful",
                body: "(closing the list for good) Done. All of it. (taking his hand, blood and all) Come away from here, Amar. The rest of your life starts now, and there's nobody left on the list." }
            ]
          }
        ]
      },
      revolution: {
        music: MUSIC.finalBattleSad,
        subtitle: "The Path Ends — The Last Throne",
        intro: "The fleet is rising, and on this path it was never the final enemy. Madame Dawn reached the flagship's shadow first and waits on the coronation road for her son. She has done the math: once the fleet is gone, frightened people will want a ruler, and she has spent thirty years making herself the only one who can take the throne. The last throne the revolution must bring down belongs to someone who loves Amar.",
        outro: "No thrones. Keeping that promise cost Amar his mother. On the marble where every crown in the west was ever placed, no one is crowned.",
        victory: defeatUnit("dawn_boss", { label: "No thrones" }),
        buildEnemies: () => [
          withSecondWind(ENEMIES.dawnBoss(20), bossPhaseTwo(
            "Madame Dawn straps on the harness she has kept for thirty years. Damage against her counts HALF from here, and she strikes back at anyone who comes within her reach."
          )),
          ENEMIES.dawnLoyalist(18),
          ENEMIES.banditSwordsman("pf_r1", 2821, 17),
          ENEMIES.banditSwordsman("pf_r4", 2825, 19),
          ENEMIES.banditSpearton("pf_r2", 2822, 17),
          ENEMIES.banditSpearton("pf_r5", 2826, 19),
          ENEMIES.banditArcher("pf_r3", 2823, 17),
          ENEMIES.banditArcher("pf_r6", 2827, 19),
          ENEMIES.royalGuard("pf_r7", 2828, 19),
          ENEMIES.royalArcher("pf_r8", 2829, 19),
          ENEMIES.ravageTrooper("pf_r9", 2830, 19)
        ],
        reinforcements: [
          {
            onSecondWindOf: "dawn_boss",
            at: B28_RESERVE_TILES,
            announce: "Green cloaks come out of the colonnade behind the squad. Dawn planned for this too.",
            units: () => [
              ENEMIES.banditSwordsman("pf_rres1", 2871, 19),
              ENEMIES.banditSwordsman("pf_rres2", 2872, 19),
              ENEMIES.banditArcher("pf_rres3", 2873, 19),
              ENEMIES.royalGuard("pf_rres4", 2874, 19)
            ]
          }
        ],
        dialogues: [
          {
            id: "b28_r_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
                body: "When the fleet leaves, someone has to take charge, Amar. A hundred million frightened people who now know the sky can open. Someone will organize that fear within the year. I have weighed every candidate. It should be me, and you know it." },
              { speaker: "Amar", portraitId: "amar", expression: "guarded",
                body: "It always sounds right, mother. That's the problem with thrones. (drawing his sword, his hand unsteady) Maya. Squad. Hold me to it." }
            ]
          },
          {
            id: "b28_r_duel",
            trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "dawn_boss" },
            beats: [
              { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
                body: "I carried you for eleven months, and I have carried this world for thirty years, and neither of you has ever once thought about what that cost me. (her guard faltering for the first time) Yield, my son. I cannot sacrifice you. I proved that at the quay." },
              { speaker: "Amar", portraitId: "amar", expression: "wounded",
                body: "And I can't sacrifice the whole world to keep you happy. That's the only difference between us. (quietly) I love you, completely. Put it down, mother. Please. Put it down and live." }
            ]
          },
          {
            id: "b28_r_last",
            trigger: { kind: "round_start", round: 3 },
            beats: [
              { speaker: "Maya", portraitId: "maya",
                body: "(watching him instead of the field) You haven't looked at her once, Amar. Not since the fighting started. Look at her. If you kill your mother without looking at her, you'll relive it every night for the rest of your life." },
              { speaker: "Amar", portraitId: "amar", expression: "wounded",
                body: "(He looks, and loses a step.) She taught me to read. Did you know that? Not tutors. Her, on the crossing, with a ledger on her knees. (raising his guard again) All right. Eyes open. I owe her that much, and it's the last thing I'll ever be able to give her." }
            ]
          },
          {
            id: "b28_r_phase2",
            trigger: { kind: "second_wind", unitId: "dawn_boss" },
            beats: [
              { speaker: "Madame Dawn", portraitId: "dawn", expression: "measured_neutral",
                body: "(Falling, she opens a case at her belt and takes out a harness, thirty years old and never used.) I planned for this too. (strapping it on) I kept it for thirty years and never used it. Not for Grude, not for your father. (quietly) I kept it for the day my son made me need it." },
              { speaker: "Amar", portraitId: "amar", expression: "wounded",
                body: "You kept it for me. (his voice breaking) Squad, our hits only do half now, and she strikes back at anyone who gets close. Wear her down slowly. She'll make us work for every step, because she always does." }
            ]
          },
          {
            id: "b28_r_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "Dawn falls on the marble where she meant to be crowned. Her soldiers stop where they are, with no plan left to follow. Amar kneels beside her. What they say to each other stays between them." },
              { speaker: "Madame Dawn", portraitId: "dawn", expression: "mask_slipping",
                body: "(barely audible) The one thing I never planned for. A son who says no and means it. (taking his hand) Bury the throne with me, or don't bury me at all. Make it true, Amar. Make all of this have been worth..." },
              { portraitId: "narrator",
                body: "She doesn't finish the sentence. Amar sits with her on the cold marble until morning." }
            ]
          }
        ]
      },
      duty: {
        music: MUSIC.finalBattleAttack,
        subtitle: "The Path Ends — Under Orders",
        intro: "Dawn's command staff wrote the order three times and couldn't get a single officer to sign it: fight the Ravage command in the open and keep it pinned down until the coast batteries can reach the flagship. Whoever carries it out will take every blow. Amar read it once, signed it himself, and chose the squad that has never broken under him. Now he leads them to the front to carry out the order he signed.",
        outro: "The squad held until the batteries fired, and the fleet rose. The report says every soldier named on the order held the coronation road against the Ravage command, and for once the report tells the whole truth.",
        dialogues: [
          {
            id: "b28_d_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "The order is to hold. We don't have to win, just hold. Their commander stays on this marble until the batteries can reach that ship. I signed it myself, so it's on me. Anyone who wants to fall back, do it now. It won't go in any report." },
              { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
                body: "(stringing her bow without looking at him) Khonu would already be in position, captain. So are we. Read us the order again when it's over, and call every name on it." }
            ]
          },
          {
            id: "b28_d_last",
            trigger: { kind: "round_start", round: 3 },
            beats: [
              { speaker: "Corin", portraitId: "corin",
                body: "(wheeling back into the line, breathing hard) Captain. The order you signed has our names on it. All eight. My sister died for a list someone else wrote and never showed her. Whatever this costs us today, we all read ours first. That means more to me than almost anything." },
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "It's the only part I got right. (calling down the line) Every name on this marble is here because they read it and stayed! Nobody was tricked into this! When the report gets written it will say exactly that, and it will be TRUE!" }
            ]
          },
          {
            id: "b28_d_phase2",
            trigger: { kind: "second_wind", unitId: "ravage_commander" },
            beats: [
              { speaker: "The Ravage Commander", portraitId: "ravage_commander",
                body: "(It rises from its own wreckage as the reserve comes slowly down the ramp behind it.) Your order said hold. (staring at Amar) Then hold longer, captain." },
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "The order never said how long. (not moving an inch) The line holds. Our hits only do half now, and it strikes back at anyone in close, so nobody goes in alone and nobody chases. Ning, both flanks are yours. Hold." }
            ]
          },
          {
            id: "b28_d_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "The commander falls just as the first battery finds its range. The flagship lifts off, and its shadow moves off the coronation road. The squad held, and everyone named on the order is still standing." },
              { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
                body: "(to the squad, hoarse) Report as written. (folding the order away) Khonu, wherever you are, I read it before I signed it. And I'd sign it again." }
            ]
          }
        ]
      },
      mercy: {
        music: MUSIC.finalBattleSad,
        subtitle: "The Path Ends — The Surrendered Sword",
        intro: "Archbold's empire is finished, even if it hasn't collapsed yet. The fleet looked it over and didn't want it, and his marshals have stopped answering him. The King has retreated up the old coronation road with the last guards who still call him sire. Amar's rule for a cornered man who can still hurt people is simple: defeat him, only him, and let him live.",
        outro: "On the marble where his ancestors were crowned, Archbold surrenders his sword to the son he tried to destroy, and he lives. The fourth surrender was a captain's. This last one is a king's. The war ends with the enemy laying down their weapons.",
        victory: defeatUnit("archbold", { label: "Break the King" }),
        buildEnemies: () => [
          withSecondWind(ENEMIES.archbold(20), bossPhaseTwo(
            "Archbold refuses to stay down and puts on the coronation armor. Damage against him counts HALF from here, and he strikes back at anyone who comes within his reach."
          )),
          ENEMIES.royalGuard("pf_m8", 2838, 20),
          ENEMIES.royalGuard("pf_m1", 2831, 18),
          ENEMIES.royalGuard("pf_m2", 2832, 18),
          ENEMIES.royalGuard("pf_m5", 2835, 19),
          ENEMIES.royalGuard("pf_m6", 2836, 20),
          ENEMIES.royalArcher("pf_m3", 2833, 17),
          ENEMIES.royalArcher("pf_m4", 2834, 17),
          ENEMIES.royalArcher("pf_m7", 2837, 19),
          ENEMIES.ravageTrooper("pf_m9", 2839, 19),
          ENEMIES.ravageLancer("pf_m10", 2840, 19)
        ],
        reinforcements: [
          {
            onSecondWindOf: "archbold",
            at: B28_RESERVE_TILES,
            announce: "The last of the household comes up the road behind the squad.",
            units: () => [
              ENEMIES.royalGuard("pf_mres1", 2881, 20),
              ENEMIES.royalGuard("pf_mres2", 2882, 19),
              ENEMIES.royalArcher("pf_mres3", 2883, 19),
              ENEMIES.ravageLancer("pf_mres4", 2884, 20)
            ]
          }
        ],
        dialogues: [
          {
            id: "b28_m_open",
            trigger: { kind: "round_start", round: 1 },
            beats: [
              { speaker: "King Archbold", portraitId: "archbold", expression: "righteous_fury",
                body: "Come to gloat, heir? Even the fleet did not want my kingdom. There is nothing left to take from me but my sword, and that you will have to TAKE." },
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "I'm not here to take anything, father. I'm here to make you put it down. (drawing his sword) Squad, his guard will surrender when he does. He goes down alive. Nobody dies up here unless they insist." }
            ]
          },
          {
            id: "b28_m_duel",
            trigger: { kind: "adjacent_eot", unitA: "amar", unitB: "archbold" },
            beats: [
              { speaker: "King Archbold", portraitId: "archbold", expression: "offering_peace",
                body: "(breathing hard) You fight like her. But you show mercy like no one I have ever met. What are you, boy? Whose victory is this supposed to be?" },
              { speaker: "Amar", portraitId: "amar", expression: "guarded",
                body: "A surgeon taught me you can stop a man without killing him. She treated anyone, whichever side they fought for. (sword level) Yield, father. Live long enough to be sorry." }
            ]
          },
          {
            id: "b28_m_last",
            trigger: { kind: "round_start", round: 3 },
            beats: [
              { speaker: "Leo", portraitId: "leo",
                body: "(pulling out of a pass, completely serious for once) Amar, I can end this right now. One run from above. I'm asking because I'll do it if you say so. And I'm asking because I think you're going to say no, and I want to hear you say why one more time." },
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "Because a surgeon in a swamp operated on a stranger and never once asked whose army he was from. (steady) He goes down, but he doesn't die. I know it looks soft, Leo, but it's the one thing we've done that will last after we're gone. Hold the run." }
            ]
          },
          {
            id: "b28_m_phase2",
            trigger: { kind: "second_wind", unitId: "archbold" },
            beats: [
              { speaker: "King Archbold", portraitId: "archbold",
                body: "(He should be finished, but he rises in the old coronation armor as the last of his household comes up the road behind him.) You will NOT give me this, boy. (breathing hard) Being spared means being beaten and then pitied for it. I would rather die, and I want it from YOU." },
              { speaker: "Amar", portraitId: "amar", expression: "resolute",
                body: "You'll get what I decide to give you, and I decided a long time ago. Squad, our hits only do half now, and he strikes back at anyone who gets close. Wear him down. Nobody kills him. That order hasn't changed, and it isn't going to." }
            ]
          },
          {
            id: "b28_m_bv",
            trigger: { kind: "before_victory" },
            beats: [
              { portraitId: "narrator",
                body: "The King goes down and stays down. His last guards have seen how the squad fought this whole war, and they kneel and lay their weapons on the marble. Archbold turns his sword around and offers the hilt." },
              { speaker: "King Archbold", portraitId: "archbold", expression: "offering_peace",
                body: "(the sword flat across his palms) No king of Grude ever surrendered this sword. Maybe we would have been better kings if one had. Take it, son. You'll use it better than we did." }
            ]
          }
        ]
      }
    }
  },
  // ============== Battle 29 — The Smallhold Road (post-credits) ==============
  // Reached only after the credits of a finished war path. A morning's
  // work on a quiet road: the couple the player chose (or the squad
  // alone, if they chose no one) clearing a bandit crew off a smallhold.
  // Low stakes on purpose — this is what the war bought.
  {
    id: "b29_epilogue",
    index: 29,
    title: "One Last Morning",
    subtitle: "The Smallhold Road",
    intro: "A year after the war, the worst trouble on this road is a bandit crew that hasn't heard it's over. The smallhold at the end of the road, a little farm, sent for help from the only people they could think of. It's a very small job compared with the war, and the squad is glad to take it.",
    outro: "The road is clear by mid-morning. The smallholders bring out bread and more thanks than the job was worth, and nobody says the word 'war' once.",
    music: MUSIC.everydayLife,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_farmland",
    playable: true,
    map: smallholdMap,
    // Partner-aware roster: Amar, the person he married (when they're a
    // fielded character — Ndara runs supply from a chair and doesn't take
    // the road), then friends to fill the line. Reads the save directly;
    // loadSave() is fully guarded, so headless tests get the no-marriage
    // roster instead of throwing.
    buildPlayers: () => {
      const partner = String(loadSave().flags[ROMANCE_FLAG] ?? "none");
      const roster: string[] = ["amar"];
      if (partner !== "none" && partner !== "ndara" && partner in PLAYERS) roster.push(partner);
      for (const id of ["ning", "leo", "ranatoli", "maya", "selene"]) {
        if (roster.length >= 5) break;
        if (!roster.includes(id)) roster.push(id);
      }
      return roster.map((id) => PLAYERS[id as keyof typeof PLAYERS]());
    },
    buildEnemies: () => [
      ENEMIES.banditSwordsman("ep_b1", 2901, 16),
      ENEMIES.banditSwordsman("ep_b2", 2902, 16),
      ENEMIES.banditSpearton("ep_b3", 2903, 16),
      ENEMIES.banditArcher("ep_b4", 2904, 15),
      ENEMIES.banditArcher("ep_b5", 2905, 15),
      ENEMIES.banditSwordsman("ep_b6", 2906, 15)
    ],
    difficultyLabel: "Epilogue",
    victory: routEnemies,
    unlocks: null,
    rewards: ["potion", "potion"],
    dialogues: [
      {
        id: "b29_small_job",
        trigger: { kind: "round_start", round: 1 },
        beats: [
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "Six of them, and they picked a smallhold with a bell. (He draws, almost lazily.) Somebody explain to them that the bell works." }
        ]
      },
      // Walking on alone: the morning as it was. (Each marriage has its own
      // close below — only one before_victory dialogue fires.)
      {
        id: "b29_after",
        trigger: { kind: "before_victory" },
        partner: "none",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." }
        ]
      },
      // The one he married, mid-fight and at the end of it.
      {
        id: "b29_wed_selene",
        trigger: { kind: "round_start", round: 2 },
        partner: "selene",
        beats: [
          { speaker: "Selene", portraitId: "selene",
            body: "Three on the left. Tracks say they're hungry, not brave." },
          { speaker: "Amar", portraitId: "amar",
            body: "Anything else?" },
          { speaker: "Selene", portraitId: "selene",
            body: "(She nocks.) Love you. Duck." }
        ]
      },
      {
        id: "b29_after_selene",
        trigger: { kind: "before_victory" },
        partner: "selene",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." },
          { speaker: "Selene", portraitId: "selene",
            body: "(checking him over quickly, twice) Not a scratch. Good." }
        ]
      },
      {
        id: "b29_wed_corin",
        trigger: { kind: "round_start", round: 2 },
        partner: "corin",
        beats: [
          { speaker: "Corin", portraitId: "corin", expression: "resolute",
            body: "You're out of formation." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "I'm standing next to you." },
          { speaker: "Corin", portraitId: "corin", expression: "resolute",
            body: "...Formation accepted." }
        ]
      },
      {
        id: "b29_after_corin",
        trigger: { kind: "before_victory" },
        partner: "corin",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." },
          { speaker: "Corin", portraitId: "corin", expression: "resolute",
            body: "Casualties, none. Husband, intact. (He writes it down.) That goes in the report." }
        ]
      },
      {
        id: "b29_wed_ning",
        trigger: { kind: "round_start", round: 2 },
        partner: "ning",
        beats: [
          { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
            body: "Bet you a pie I drop more of them than you do!" },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "You win that bet every time." },
          { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
            body: "I know! (She lets fly.) That's half of why I married you. Free pie." }
        ]
      },
      {
        id: "b29_after_ning",
        trigger: { kind: "before_victory" },
        partner: "ning",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." },
          { speaker: "Ning", portraitId: "ning", expression: "eager_grin",
            body: "Four for me, one for you, and Ranatoli frightened the last one off. (She takes his hand without looking.) That's a pie. You're paying." }
        ]
      },
      {
        id: "b29_wed_leo",
        trigger: { kind: "round_start", round: 2 },
        partner: "leo",
        beats: [
          { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
            body: "Wave to the bandits, dear! They should see who's about to ruin their morning!" },
          { speaker: "Amar", portraitId: "amar",
            body: "Don't call me dear in front of the bandits." },
          { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
            body: "Darling, then. Ash, dive!" }
        ]
      },
      {
        id: "b29_after_leo",
        trigger: { kind: "before_victory" },
        partner: "leo",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." },
          { speaker: "Leo", portraitId: "leo", expression: "cocky_smirk",
            body: "Ash says that was the best morning of his life. (He slides down out of the saddle and into Amar, not entirely by accident.) Ash is wrong." }
        ]
      },
      {
        id: "b29_wed_maya",
        trigger: { kind: "round_start", round: 2 },
        partner: "maya",
        beats: [
          { speaker: "Maya", portraitId: "maya", expression: "calculating_side_glance",
            body: "Six bandits, one smallhold, a morning's work. We're overqualified, you know." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "We're on our honeymoon." },
          { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
            body: "(Barely a smile.) Then bill them for it." }
        ]
      },
      {
        id: "b29_after_maya",
        trigger: { kind: "before_victory" },
        partner: "maya",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." },
          { speaker: "Maya", portraitId: "maya", expression: "soft_genuine_smile",
            body: "Paid in bread. (She tears a loaf in two and hands him the bigger half.) Don't get used to the bigger half." }
        ]
      },
      {
        id: "b29_wed_veya",
        trigger: { kind: "round_start", round: 2 },
        partner: "veya",
        beats: [
          { speaker: "Veya", portraitId: "veya", expression: "focused",
            body: "Hold still. You're in my line." },
          { speaker: "Amar", portraitId: "amar",
            body: "Where do you want me?" },
          { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
            body: "(She turns the lens a quarter-turn and fires past his ear.) Exactly there. Don't move. You're my favourite fixed point." }
        ]
      },
      {
        id: "b29_after_veya",
        trigger: { kind: "before_victory" },
        partner: "veya",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." },
          { speaker: "Veya", portraitId: "veya", expression: "wry_smile",
            body: "Not a scratch. I measured. (She tucks a loose thread back into his collar.) Well within tolerance." }
        ]
      },
      {
        id: "b29_wed_ndara",
        trigger: { kind: "round_start", round: 2 },
        partner: "ndara",
        beats: [
          { portraitId: "narrator", body: "A runner races up the road from the war office, salutes the wrong person, and hands Amar a folded note in Ndara's handwriting." },
          { speaker: "Amar", portraitId: "amar", expression: "warm_half_smile",
            body: "(Reading.) 'Supply estimate, one smallhold job: six bandits, one husband. Return the husband intact. — N.' (He pockets it.) Yes, Marshal." }
        ]
      },
      {
        id: "b29_after_ndara",
        trigger: { kind: "before_victory" },
        partner: "ndara",
        beats: [
          { speaker: "Ranatoli", portraitId: "ranatoli", expression: "satisfied",
            body: "Last one's away over the fence and running like the sky's after him. (He lowers the shield.) Well. That's the whole crew, and it's not yet noon." },
          { portraitId: "narrator", body: "Somewhere to the west, in an office with one good chair, Ndara reads the runner's two-word report, 'Returned intact,' and smiles to herself." }
        ]
      }
    ]
  }

];

// ---- Seven Paths divergence (B23/B24/B28) ----------------------------------
//
// The endgame climaxes share ids, maps, and save keys across all five
// war-facing paths, but each path notices its own war: overrides swap
// the framing text, the dialogues, the enemy roster, and the win
// condition per path. Scenes resolve the node THROUGH the player's
// chosen path (BattleScene create, BattlePrep intro, EndScene outro);
// everything keyed by BattleId (saves, suspend, unlocks, completion)
// stays path-agnostic.
export interface PathOverride {
  subtitle?: string;
  intro?: string;
  outro?: string;
  victory?: VictoryCondition;
  buildEnemies?: () => UnitDef[];
  // Per-path battle score. B28 splits its final-battle music by the
  // chosen path's temperament (Sad vs Attack) through this.
  music?: MusicKey;
  // Per-path reserve waves. B28 needs these because each road fights a
  // different opponent, so each road's reserve is a different army.
  reinforcements?: BattleWave[];
  // Full replacement of the battle's dialogue set (the climax battles
  // B23/B24/B28 use this — each path fights a genuinely different scene).
  dialogues?: BattleDialogue[];
  // ADDITIVE dialogues — appended to the battle's base set after any
  // replacement above. The war arc (B20-B22) uses this for one
  // path-flavored beat per battle: the shared war keeps its shared
  // script, and the player's chosen philosophy speaks once on top.
  extraDialogues?: BattleDialogue[];
  atmosphere?: AtmosphereKind;
}

export const resolveBattleForPath = (
  node: BattleNode,
  path: SevenPath | null
): BattleNode => {
  const o = path ? node.pathOverrides?.[path] : undefined;
  if (!o) return node;
  const { extraDialogues, ...rest } = o;
  const merged: BattleNode = { ...node, ...rest, pathOverrides: undefined };
  if (extraDialogues && extraDialogues.length > 0) {
    merged.dialogues = [...(merged.dialogues ?? []), ...extraDialogues];
  }
  return merged;
};

// Accepts a plain string for ergonomic call sites (URL params, save files,
// scene.start payloads), but the predicate compares against the typed
// BattleNode.id. Returns undefined if the lookup misses.
export const battleById = (id: string): BattleNode | undefined => BATTLES.find((b) => b.id === id);
export const battleByIndex = (idx: number): BattleNode | undefined => BATTLES.find((b) => b.index === idx);
