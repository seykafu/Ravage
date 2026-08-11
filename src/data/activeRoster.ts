// The single source of truth for "who is with Amar right now".
//
// Two tables, ONE module — deliberately. CampScene used to carry its own
// private copy of the squad table; it drifted (stopped updating at B11),
// and everyone recruited after the crossing simply never appeared at the
// camp fire. Any surface that needs the active squad (RosterScene's
// overlay, CampScene's tableau, future scenes) imports from here.

import type { UnitDef } from "../combat/types";
import { PLAYERS } from "./units";
import { BATTLES } from "./battles";

// Stable display order for the roster — matches the script's intro
// sequence so the cast appears in chronological-recruit order rather
// than alphabetical. amar_true (the pre-amnesia coup version) is
// excluded — it's a B1 narrative alias of amar; in the roster we
// always show the post-amnesia identity.
//
// Each entry maps a save-record id → the PLAYERS factory key. The
// factory call gives us name / class / palette / abilities / portrait
// id; the save record gives us level / xp / current stats / post-
// promotion class.
export const ROSTER_ORDER: Array<{ recordId: string; factory: () => UnitDef }> = [
  { recordId: "amar",      factory: PLAYERS.amar      },
  { recordId: "lucian",    factory: PLAYERS.lucian    },
  { recordId: "ning",      factory: PLAYERS.ning      },
  { recordId: "maya",      factory: PLAYERS.maya      },
  { recordId: "kian",      factory: PLAYERS.kian      },
  { recordId: "leo",       factory: PLAYERS.leo       },
  { recordId: "ranatoli",  factory: PLAYERS.ranatoli  },
  { recordId: "selene",    factory: PLAYERS.selene    },
  // Loaned for B13 only — dies in post_dawn_rebellion, and drops out of
  // every ACTIVE_ROSTER entry from B14 on. Listed so the roster is
  // honest for the one battle she fights.
  { recordId: "rose",      factory: PLAYERS.rose      },
  // The Grude joiners. These two were MISSING for a while — they were
  // in every battle roster from their join battles onward but invisible
  // in the roster UI, because this display table was forgotten. The
  // activeRoster test now fails if a fielded id has no entry here.
  { recordId: "veya",      factory: PLAYERS.veya      },
  { recordId: "corin",     factory: PLAYERS.corin     }
];

// Active squad after each battle's completion. Keyed by BattleId; the
// value is the list of PLAYERS factory ids that should appear in the
// roster after winning that battle. The roster is computed by finding
// the highest-indexed completed battle in this table and reading its
// squad list.
//
// Why this exists: B1 ends with the original 8 captured/dead — Amar
// wakes up alone in the hospital, so the roster MUST collapse to just
// him until B2 recruits begin. Without this filter the roster would
// keep showing Ranatoli + Selene + amar_true after B1 (since their
// CharacterRecords are still in the save) — confusing because those
// characters aren't actually with Amar anymore at that point in the
// story. From B2 onward the squad accumulates as new characters join.
//
// Selene's B7 reappearance is as an enemy boss (`selene_enemy`), not a
// player character; she stays out of the roster. Future battles where
// she's recruited can add her here.
export const ACTIVE_ROSTER: Partial<Record<string, string[]>> = {
  b01_palace_coup:    ["amar"],                                                    // hospital, alone
  b02_farmland:       ["amar", "lucian", "ning"],                                  // squad starts forming
  b03_dawn_bandits:   ["amar", "lucian", "ning", "maya"],                          // Maya stays
  b04_swamp:          ["amar", "lucian", "ning", "maya", "kian"],                  // Kian rejoins
  b05_mountain_ndari: ["amar", "lucian", "ning", "maya", "kian", "leo"],           // Leo joins
  b06_caravan:        ["amar", "lucian", "ning", "maya", "kian", "leo"],
  b07_monastery:      ["amar", "lucian", "ning", "maya", "kian", "leo"],           // Selene escapes (not recruited)
  b08_orinhal:        ["amar", "lucian", "ning", "maya", "kian", "leo"],
  b09_ravine:         ["amar", "lucian", "ning", "maya", "kian", "leo"],
  // B10: Kian has revealed himself as Nebu's enforcer between B9 and
  // B10 — squad enters the Thuling streets fight without him on
  // their side. He's the boss of B10 + B11.
  b10_leaving_thuling: ["amar", "lucian", "ning", "maya", "leo"],
  // B11: Lucian dies in post_cliffs (sea burial off the western
  // rail). The roster shown after B11 is post-Lucian. The squad
  // crosses to Grude on Madame Dawn's ship as four — Amar, Ning,
  // Maya, Leo — until the second-half rejoinings begin.
  b11_cliffs:          ["amar", "ning", "maya", "leo"],
  // B12: same four step off Khione's ship at Grude. Future rejoins
  // (Selene, Ranatoli, Ndara as ally) plug in here as those story
  // beats land.
  b12_ravage:          ["amar", "ning", "maya", "leo"],
  // B13: Madame Dawn's lieutenant Rose is loaned to the squad for
  // the rebellion strike at the Grude plaza. She fights as a fifth
  // unit on the field, then dies in the closing scene shielding
  // Madame Dawn from a back-door volley — she does NOT carry forward
  // into the post-B13 roster.
  b13_dawn_rebellion:  ["amar", "ning", "maya", "leo", "rose"],
  // B14: post-Rose squad plus Veya (Dawn's optician, first fielded
  // here) defends the safe-house street from Archbold's household
  // retrieval detail.
  b14_origin:          ["amar", "ning", "maya", "leo", "veya"],
  // B15: same five corner the mole in the candle-maker's courtyard.
  // Ndara is in a coma — not on the field.
  b15_inner_coup:      ["amar", "ning", "maya", "leo", "veya"],
  // B16: the five are ambushed on the Grude river bridge.
  b16_proposal:        ["amar", "ning", "maya", "leo", "veya"],
  // B17: six off the quay — Corin Eseldra breaks with Dawn's line
  // mid-scene and fights his first battle against his old marshal.
  b17_lie:             ["amar", "ning", "maya", "leo", "veya", "corin"],
  // B18: the six repel the empire's last boarding party on the open sea
  // before Amar chooses his path. Same squad — no joins or losses at B18.
  b18_path_chosen:     ["amar", "ning", "maya", "leo", "veya", "corin"],
  // B19 path openers — squad composition is part of each path's meaning.
  // Exile and Forgetting are Amar alone: those paths ARE the leaving.
  b19_path_opener_vengeance:   ["amar", "ning", "maya", "leo", "veya", "corin"],
  b19_path_opener_restoration: ["amar", "ning", "maya", "leo", "veya", "corin"],
  b19_path_opener_revolution:  ["amar", "ning", "maya", "leo", "veya", "corin"],
  b19_path_opener_duty:        ["amar", "ning", "maya", "leo", "veya", "corin"],
  b19_path_opener_exile:       ["amar"],
  b19_path_opener_mercy:       ["amar", "ning", "maya", "leo", "veya", "corin"],
  b19_path_opener_forgetting:  ["amar"],
  // War arc (B20–B22): the five war-facing paths converge with the
  // standing squad of six. Exile/forgetting never reach these.
  b20_dawn_war:                ["amar", "ning", "maya", "leo", "veya", "corin"],
  b21_archbold_advances:       ["amar", "ning", "maya", "leo", "veya", "corin"],
  b22_grude_burns:             ["amar", "ning", "maya", "leo", "veya", "corin"],
  // Fleet arc (B23-B29): eight-strong. Selene and Ranatoli rejoin at the
  // held city (post_grude_burns) — the original coup squad's survivors
  // back for the end.
  b23_path_climax_a:           ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"],
  b24_path_climax_b:           ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"],
  b25_fleet_arrival:           ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"],
  b26_coastal_hold:            ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"],
  b27_orbital_descent:         ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"],
  b28_path_final:              ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"],
  b29_aftermath:               ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"]
};

// Resolve the player's current active squad based on their save's
// completedBattles. Walks the BATTLES list backwards (highest index
// first) and returns the first ACTIVE_ROSTER entry that matches a
// completed battle. Empty array if no completed battles or no match.
export const getActiveSquadIds = (completedBattles: string[]): string[] => {
  // Sort completed battle ids by their BATTLES index, descending.
  const completed = completedBattles
    .map((id) => BATTLES.find((b) => b.id === id))
    .filter((b): b is typeof BATTLES[number] => b !== undefined)
    .sort((a, b) => b.index - a.index);
  for (const b of completed) {
    const squad = ACTIVE_ROSTER[b.id];
    if (squad) return squad;
  }
  return [];
};
