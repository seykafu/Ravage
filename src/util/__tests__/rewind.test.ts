// The another-path rewind. This is the one operation in the game that
// touches a FINISHED campaign, so its contract is pinned here:
//
//   * everything through B18 survives; B19+ is un-walked
//   * progression (levels, promotions, squad inventory) is kept — a
//     second road is about the story you didn't see, not re-earning a
//     curve you already beat
//   * the path + marriage choices are cleared so they can be made again
//   * the completion record is CUMULATIVE and survives the rewind

import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_COMPLETE_FLAG,
  defaultSave,
  markCampaignComplete,
  pathsWalked,
  rewindToPathChoice,
  ROMANCE_FLAG_TEST_KEY,
  SEVEN_PATHS_FLAG,
  type SaveState
} from "../save";
import { createItem } from "../../combat/items";

const finishedRun = (): SaveState => ({
  ...defaultSave(),
  completedBattles: [
    "b01_palace_coup", "b09_ravine", "b17_lie", "b18_path_chosen",
    "b19_path_opener_mercy", "b20_dawn_war", "b26_coastal_hold",
    "b28_path_final", "b29_epilogue"
  ],
  unlockedBattles: ["b01_palace_coup", "b18_path_chosen", "b20_dawn_war", "b29_epilogue"],
  lastBattleResult: { id: "b29_epilogue", outcome: "victory" },
  flags: { [SEVEN_PATHS_FLAG]: "mercy", [ROMANCE_FLAG_TEST_KEY]: "veya" },
  characters: { amar: { level: 20, xp: 40, stats: { hp: 60, power: 20, armor: 12, speed: 14, movement: 4, ap: 3 } } },
  squadInventory: [createItem("elixir")],
  assignedInventory: { amar: [createItem("elixir")] }
});

describe("another-path rewind", () => {
  it("keeps the campaign through B18 and un-walks everything after", () => {
    const r = rewindToPathChoice(finishedRun());
    expect(r.completedBattles).toEqual([
      "b01_palace_coup", "b09_ravine", "b17_lie", "b18_path_chosen"
    ]);
    expect(r.completedBattles.some((b) => b.startsWith("b19"))).toBe(false);
    expect(r.completedBattles).not.toContain("b29_epilogue");
    expect(r.unlockedBattles).not.toContain("b20_dawn_war");
  });

  it("keeps progression but clears the path and marriage so they can be chosen again", () => {
    const r = rewindToPathChoice(finishedRun());
    expect(r.characters?.amar?.level, "levels must survive the rewind").toBe(20);
    expect(r.squadInventory?.length, "squad inventory must survive").toBe(1);
    expect(r.flags[SEVEN_PATHS_FLAG], "path must be re-choosable").toBeUndefined();
    expect(r.flags[ROMANCE_FLAG_TEST_KEY], "marriage must be re-choosable").toBeUndefined();
    // Per-character battle assignments belong to the run that ended.
    expect(r.assignedInventory).toEqual({});
  });

  it("records every finished path cumulatively, and the record survives a rewind", () => {
    const first = markCampaignComplete(finishedRun(), "mercy");
    expect(pathsWalked(first)).toEqual(["mercy"]);

    const rewound = rewindToPathChoice(first);
    expect(pathsWalked(rewound), "completion record must outlive the rewind").toEqual(["mercy"]);

    // Second road, finished.
    const second = markCampaignComplete({ ...rewound, flags: { ...rewound.flags } }, "revolution");
    expect(pathsWalked(second)).toEqual(["mercy", "revolution"]);
    // Re-finishing the same path doesn't duplicate it.
    expect(pathsWalked(markCampaignComplete(second, "revolution"))).toEqual(["mercy", "revolution"]);
  });

  it("never leaves the player with an empty battle list", () => {
    const bare = rewindToPathChoice({ ...defaultSave(), completedBattles: [], unlockedBattles: [] });
    expect(bare.unlockedBattles).toEqual(["b01_palace_coup"]);
    expect(bare.flags[CAMPAIGN_COMPLETE_FLAG]).toBeUndefined();
  });
});
