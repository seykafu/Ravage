import type { MapDef, UnitDef } from "../combat/types";
import { ENEMIES, PLAYERS } from "./units";
import { farmlandMap, mountainMap, palaceMap } from "./maps";
import { MUSIC, type MusicKey } from "../audio/Music";

export interface BattleNode {
  id: string;
  index: number;       // 1..20+
  title: string;       // "First Battle" / "Battle 2" etc.
  subtitle: string;    // narrative name
  intro: string;       // 80–160 word framing
  outro: string;       // brief post-battle text
  music: MusicKey;
  prepMusic: MusicKey;
  backdropKey: string;
  playable: boolean;   // false = placeholder ("not yet playable")
  map?: MapDef;
  buildPlayers?: () => UnitDef[];
  buildEnemies?: () => UnitDef[];
  difficultyLabel: string;
  unlockNote?: string;
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
    difficultyLabel: "Grand Engagement"
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
    intro: "A second wave bears the colors of a queen called Madame Dawn — said to have lost her land to King Nebu. Maya joins the squad mid-fight, reading the field like she has read it many times before.",
    outro: "Maya stays. Lucian watches her closely.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_thuling",
    playable: false,
    difficultyLabel: "Skirmish"
  },
  {
    id: "b04_swamp",
    index: 4,
    title: "Fourth Battle",
    subtitle: "Ambush in the Swamp",
    intro: "The squad is ambushed in the marsh on the road home. Kian rejoins, and his suspicion deepens.",
    outro: "Lucian invents a story for Kian. Lucian invents a confession for you alone.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_swamp",
    playable: false,
    difficultyLabel: "Skirmish"
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
    difficultyLabel: "Boss — First Major Threat"
  },
  {
    id: "b06_caravan",
    index: 6,
    title: "Sixth Battle",
    subtitle: "The Caravan",
    intro: "A canyon escort that should not have been a fight. Maya commands a flank without being asked. A bandit's ledger is written in the King's own accounting hand.",
    outro: "Someone inside Nebu's court paid for this. You keep the ledger.",
    music: MUSIC.battleTheme,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_caravan",
    playable: false,
    difficultyLabel: "Ambush"
  },
  {
    id: "b07_monastery",
    index: 7,
    title: "Seventh Battle",
    subtitle: "The Ghost from Para",
    intro: "Raiders in an abandoned monastery. The leader has your old face on a wanted poster — Selene, your comrade from the coup.",
    outro: "Selene escapes into the mist. That night, you tell Lucian everything. He covers you anyway.",
    music: MUSIC.battleTheme2,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_monastery",
    playable: false,
    difficultyLabel: "Hard"
  },
  {
    id: "b08_orinhal",
    index: 8,
    title: "Eighth Battle",
    subtitle: "The Town of Orinhal",
    intro: "A starving town. Tax collectors pretending to be enforcers of order. Leo decides for the squad before you can.",
    outro: "Lucian distributes the squad's silver back to the townspeople on the way out.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_orinhal",
    playable: false,
    difficultyLabel: "Choice"
  },
  {
    id: "b09_ravine",
    index: 9,
    title: "Ninth Battle",
    subtitle: "The Price of Doubt",
    intro: "Fergus expended you in a ravine. Survive long enough to escape. Maya finally speaks.",
    outro: "She was Madame Dawn's, all along. Lucian takes a crossbow bolt for Ning.",
    music: MUSIC.danger,
    prepMusic: MUSIC.battlePrep,
    backdropKey: "bg_mountain",
    playable: false,
    difficultyLabel: "Survival"
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

export const battleById = (id: string): BattleNode | undefined => BATTLES.find((b) => b.id === id);
export const battleByIndex = (idx: number): BattleNode | undefined => BATTLES.find((b) => b.index === idx);
