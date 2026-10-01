import { BATTLES, battleById, type BattleNode } from "./battles";
import type { SaveState } from "../util/save";

// The chapter the story is leading to next.
//
// When a between-chapter scene ends on its way into a battle, the story no
// longer drops the player straight into battle prep: it sets the battle
// as the next chapter and returns them to camp, where "Start Next
// Chapter" opens it. Stored on the save so the button survives a trip to
// the map, a reload, or "Resume Last Slot".
//
// A stored chapter only counts while it is still a chapter to play
// (playable, unlocked, not yet won). Without one — an older save, or a
// camp reached some other way — it falls back to the first battle in
// campaign order that is unlocked and not yet won, which is what the
// camp's wagon has always prepared for.

const open = (save: SaveState, b: BattleNode | undefined): b is BattleNode =>
  !!b && b.playable && save.unlockedBattles.includes(b.id) && !save.completedBattles.includes(b.id);

export const resolveNextChapter = (save: SaveState): BattleNode | null => {
  const stored = save.nextChapter ? battleById(save.nextChapter) : undefined;
  if (open(save, stored)) return stored;
  for (const b of BATTLES) if (open(save, b)) return b;
  return null;
};
