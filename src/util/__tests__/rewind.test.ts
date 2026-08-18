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
  capturePathForkSnapshot,
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

describe("the fork snapshot", () => {
  it("restores the squad as it stood at B18, not as it finished", () => {
    const atFork = capturePathForkSnapshot({
      ...defaultSave(),
      characters: { amar: { level: 12, xp: 10, stats: { hp: 40, power: 13, armor: 8, speed: 10, movement: 4, ap: 2 } } },
      squadInventory: [createItem("potion"), createItem("potion")]
    });
    // ...then the player finishes the campaign, out-levelling the fork.
    const finished: SaveState = {
      ...atFork,
      completedBattles: ["b01_palace_coup", "b18_path_chosen", "b28_path_final"],
      characters: { amar: { level: 20, xp: 0, stats: { hp: 60, power: 20, armor: 12, speed: 14, movement: 4, ap: 3 } } },
      squadInventory: [createItem("elixir"), createItem("elixir"), createItem("elixir")]
    };
    const rewound = rewindToPathChoice(finished);
    expect(rewound.characters?.amar?.level, "levels must roll back to the fork").toBe(12);
    expect(rewound.characters?.amar?.stats.hp).toBe(40);
    expect(rewound.squadInventory?.length, "the pack is the fork's pack").toBe(2);
    expect(rewound.squadInventory?.every((i) => i.kind === "potion")).toBe(true);
    // The snapshot itself survives, so a third road starts from the fork too.
    expect(rewound.pathForkSnapshot?.characters.amar?.level).toBe(12);
  });

  it("falls back to current progression when a save predates snapshots", () => {
    const legacy: SaveState = {
      ...defaultSave(),
      completedBattles: ["b18_path_chosen", "b28_path_final"],
      characters: { amar: { level: 20, xp: 0, stats: { hp: 60, power: 20, armor: 12, speed: 14, movement: 4, ap: 3 } } }
    };
    const rewound = rewindToPathChoice(legacy);
    expect(rewound.characters?.amar?.level, "losing the run would be worse than over-levelling").toBe(20);
  });

  it("clears any suspended battle so the new road can't resume the old one's fight", () => {
    const mid = { ...defaultSave(), completedBattles: ["b18_path_chosen"], suspendedBattle: { battleId: "b26_coastal_hold" } } as unknown as SaveState;
    expect(rewindToPathChoice(mid).suspendedBattle).toBeNull();
  });
});

describe("the fork snapshot captures the whole squad state", () => {
  // Reported: "check that levels, items obtained AND lives remaining are
  // all captured to chapter 19." Levels were fine. The other two were not:
  // the snapshot stored only the squad POOL (so every item still sitting
  // in a character's bag was destroyed by the rewind, which clears
  // assignedInventory), and it never recorded squadDeaths at all — so the
  // second road inherited the FINISHED run's death count.
  const atFork = (): SaveState => ({
    ...defaultSave(),
    completedBattles: ["b17_lie", "b18_path_chosen"],
    unlockedBattles: ["b19_path_opener_mercy"],
    characters: {
      amar: { level: 12, xp: 30, stats: { hp: 40, power: 14, armor: 8, speed: 10, movement: 4, ap: 3 } }
    },
    squadInventory: [createItem("potion"), createItem("potion")],
    assignedInventory: { amar: [createItem("royal_lens")], maya: [createItem("elixir")] },
    squadDeaths: 2
  });

  const finishedAfter = (snapped: SaveState): SaveState => ({
    ...snapped,
    completedBattles: [...snapped.completedBattles, "b28_path_final"],
    characters: {
      amar: { level: 20, xp: 0, stats: { hp: 60, power: 20, armor: 12, speed: 14, movement: 4, ap: 3 } }
    },
    squadInventory: [createItem("elixir"), createItem("elixir"), createItem("elixir")],
    assignedInventory: { amar: [createItem("fang")] },
    squadDeaths: 6
  });

  const itemCount = (s: SaveState): number =>
    (s.squadInventory ?? []).length +
    Object.values(s.assignedInventory ?? {}).reduce((n, v) => n + v.length, 0);

  it("restores the levels the squad had at the fork", () => {
    const back = rewindToPathChoice(finishedAfter(capturePathForkSnapshot(atFork())));
    expect(back.characters?.amar?.level, "level-20 veterans must not carry back").toBe(12);
  });

  it("restores every item — including the ones sitting in characters' bags", () => {
    const fork = atFork();
    expect(itemCount(fork), "fixture sanity: 2 pooled + 2 carried").toBe(4);
    const back = rewindToPathChoice(finishedAfter(capturePathForkSnapshot(fork)));
    expect(itemCount(back), "no item may be destroyed by the rewind").toBe(4);
    // They all land in the pool: the rewind clears assignedInventory
    // because the new road re-distributes at BattlePrep.
    expect(back.squadInventory).toHaveLength(4);
    expect(back.assignedInventory).toEqual({});
    const kinds = (back.squadInventory ?? []).map((i) => i.kind).sort();
    expect(kinds, "the carried Royal Lens and Elixir come back too")
      .toEqual(["elixir", "potion", "potion", "royal_lens"]);
  });

  it("restores the lives spent at the fork, not the finished run's total", () => {
    const back = rewindToPathChoice(finishedAfter(capturePathForkSnapshot(atFork())));
    expect(back.squadDeaths, "a fresh road must not start one death from Game Over").toBe(2);
  });

  it("gives a snapshot with no recorded deaths a clean budget", () => {
    // Snapshots captured before squadDeaths was recorded, and the
    // reconstructed ones synthesizeForkSnapshot builds for legacy saves.
    const legacy: SaveState = {
      ...finishedAfter(capturePathForkSnapshot(atFork())),
      squadDeaths: 6
    };
    delete legacy.pathForkSnapshot!.squadDeaths;
    expect(rewindToPathChoice(legacy).squadDeaths).toBe(0);
  });

  it("keeps a legacy save's deaths from leaking through when there is no snapshot at all", () => {
    const noSnap: SaveState = { ...finishedAfter(capturePathForkSnapshot(atFork())), squadDeaths: 6 };
    delete noSnap.pathForkSnapshot;
    // Nothing to restore from, so progression is left alone (losing the
    // run would be worse) — but the count must still be a real number
    // rather than undefined, so the lives HUD has something to read.
    expect(typeof rewindToPathChoice(noSnap).squadDeaths).toBe("number");
  });
});
