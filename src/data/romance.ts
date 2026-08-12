// Romance — who Amar can marry, per war path.
//
// Design (locked with the author):
//   * Every WAR path offers exactly two partners — one woman, one man —
//     chosen for resonance with what that path is about, plus the option
//     to walk on alone. Amar dates both women and men.
//   * Exile and Forgetting offer no one: exile IS the leaving, and
//     forgetting lets go of every name — a wedding would contradict both.
//   * The choice happens in RomanceScene, reached when a post_ending_*
//     coda routes "romance"; the pick is persisted to
//     save.flags[ROMANCE_FLAG] and plays the matching wed_* arc.
//
// Resonance notes (grounded in the script):
//   vengeance   — Selene (the two hunters; "that's how Selene loves
//                 people") / Corin (Rose's account, finally closed)
//   restoration — Ning (Anthros' own daughter, rebuilding home) / Leo
//                 (already weighing grain sacks the way Lucian did)
//   revolution  — Maya (Dawn's heir-officer; burying Dawn together) /
//                 Leo (the other one who walked out of a father's house)
//   duty        — Ndara (Dawn's marshal, duty incarnate) / Corin (the
//                 two soldiers)
//   mercy       — Veya ("from here I aim the other way") / Leo ("I'm
//                 not arresting anyone today")

import type { ArcId, SevenPath } from "./contentIds";
import type { PortraitId } from "../story/beats";

export interface RomanceOption {
  // Save-record / portrait id — also keys the wed_<id> coda arc.
  id: "maya" | "selene" | "ning" | "veya" | "ndara" | "leo" | "corin";
  name: string;
  portraitId: PortraitId;
  // One-line card copy shown on their RomanceScene card.
  blurb: string;
}

export interface PathRomance {
  woman: RomanceOption;
  man: RomanceOption;
}

const MAYA: RomanceOption = {
  id: "maya", name: "Maya", portraitId: "maya",
  blurb: "Eleven years of watching you. She stopped measuring a long way back."
};
const SELENE: RomanceOption = {
  id: "selene", name: "Selene", portraitId: "selene",
  blurb: "She crossed an ocean on your trail. She'd have crossed another."
};
const NING: RomanceOption = {
  id: "ning", name: "Ning", portraitId: "ning",
  blurb: "The rivet press, the fence line, the war. She was there for all of it."
};
const VEYA: RomanceOption = {
  id: "veya", name: "Veya", portraitId: "veya",
  blurb: "She spent a career helping men see farther. You looked closer instead."
};
const NDARA: RomanceOption = {
  id: "ndara", name: "Ndara", portraitId: "ndara",
  blurb: "Thirty steady years. She woke up and chose where to stand."
};
const LEO: RomanceOption = {
  id: "leo", name: "Leo", portraitId: "leo",
  blurb: "Two people who walked out of their fathers' houses, side by side."
};
const CORIN: RomanceOption = {
  id: "corin", name: "Corin", portraitId: "corin",
  blurb: "The account his sister opened. He'd like to keep it open forever."
};

export const PATH_ROMANCES: Partial<Record<SevenPath, PathRomance>> = {
  vengeance:   { woman: SELENE, man: CORIN },
  restoration: { woman: NING,   man: LEO },
  revolution:  { woman: MAYA,   man: LEO },
  duty:        { woman: NDARA,  man: CORIN },
  mercy:       { woman: VEYA,   man: LEO }
  // exile / forgetting: deliberately absent — those paths end alone.
};

// Save flag: the chosen partner's id, or "none" for walking on alone.
export const ROMANCE_FLAG = "romance.partner";

export const weddingArcFor = (partnerId: RomanceOption["id"]): ArcId =>
  `wed_${partnerId}` as ArcId;
