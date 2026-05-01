import type { MapDef, UnitDef } from "../combat/types";
import { ENEMIES, PLAYERS } from "./units";
import { caravanMap, dawnBanditsMap, farmlandMap, monasteryMap, mountainMap, orinhalMap, palaceMap, ravineMap, swampMap } from "./maps";
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
    difficultyLabel: "Skirmish"
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
    difficultyLabel: "Choice"
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
    )
  },
  {
    id: "b10_leaving_thuling",
    index: 10,
    title: "Tenth Battle",
    subtitle: "Leaving Thuling",
    intro: "The streets you walked every day. Kian is waiting on the road outside Lucian's house. Lucian's family is already a hostage.",
    outro: "Cut a path. Ride west. Kian's words follow you across the broken street.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: false,
    difficultyLabel: "Escape"
  },
  {
    id: "b11_cliffs",
    index: 11,
    title: "Eleventh Battle",
    subtitle: "The Truth About Anthros",
    intro: "Kian catches you on the cliffs above Madame Dawn's harbor. He brings the truth: Anthros is a colony. Grude is the empire. Your fight has been smaller than you knew.",
    outro: "Lucian falls on the staircase to the ship. Kian falls to a combined strike. The sea takes you both, in different ways.",
    music: MUSIC.strongholdMemories,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_cliffs",
    playable: false,
    difficultyLabel: "Climactic"
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
  {
    id: "b18_choosing",
    index: 18,
    title: "Eighteenth Battle",
    subtitle: "Choosing Sides",
    intro: "If you side with Dawn — fight her dissenters. If you refuse her — fight her.",
    outro: "Either way, sacrifice.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Pivotal"
  },
  {
    id: "b19_archbold_or_anthros",
    index: 19,
    title: "Nineteenth Battle",
    subtitle: "Path of the Throne",
    intro: "If you killed Dawn — return to Anthros and finish what your coup began. If you sided with her — march on Archbold.",
    outro: "The world turns under your feet.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b20_kingdom",
    index: 20,
    title: "Twentieth Battle",
    subtitle: "The Kingdom Falls",
    intro: "The last kingdom-scale engagement before the sky changes.",
    outro: "Anthros, or Grude, kneels.",
    music: MUSIC.lifeInGrude,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_grude",
    playable: false,
    difficultyLabel: "Climactic"
  },
  {
    id: "b21_final_boss",
    index: 21,
    title: "Final Battle",
    subtitle: "The Ravage Fleet",
    intro:
      "The off-world fleet arrives in orbit. They have weapons no human has seen. Hold the coast. Trust your mother to hold the inland. Refuse to be a vassal. Refuse to die a colony.",
    outro: "The fleet is repelled. The cost is severe. You and Dawn meet on the cliffs where Kian fell, and part as neighbors.",
    music: MUSIC.finalBoss,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_finalBoss",
    playable: false,
    difficultyLabel: "Final Boss"
  }
];

// Accepts a plain string for ergonomic call sites (URL params, save files,
// scene.start payloads), but the predicate compares against the typed
// BattleNode.id. Returns undefined if the lookup misses.
export const battleById = (id: string): BattleNode | undefined => BATTLES.find((b) => b.id === id);
export const battleByIndex = (idx: number): BattleNode | undefined => BATTLES.find((b) => b.index === idx);
