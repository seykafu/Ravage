import { describe, it, expect } from "vitest";
import { defaultSave } from "../../util/save";
import { resolveNextChapter } from "../nextChapter";

describe("next chapter", () => {
  it("is the chapter the story set, while it is still to be played", () => {
    const s = { ...defaultSave(), unlockedBattles: ["b01_palace_coup", "b02_farmland"], completedBattles: ["b01_palace_coup"], nextChapter: "b02_farmland" };
    expect(resolveNextChapter(s)?.id).toBe("b02_farmland");
  });

  it("ignores a stored chapter that is already won and falls back to campaign order", () => {
    const s = {
      ...defaultSave(),
      unlockedBattles: ["b01_palace_coup", "b02_farmland", "b03_dawn_bandits"],
      completedBattles: ["b01_palace_coup", "b02_farmland"],
      nextChapter: "b02_farmland"
    };
    expect(resolveNextChapter(s)?.id).toBe("b03_dawn_bandits");
  });

  it("ignores a stored chapter that is not unlocked", () => {
    const s = { ...defaultSave(), unlockedBattles: ["b01_palace_coup"], completedBattles: [], nextChapter: "b05_mountain_ndari" };
    expect(resolveNextChapter(s)?.id).toBe("b01_palace_coup");
  });

  it("is null when every unlocked chapter is won", () => {
    const s = { ...defaultSave(), unlockedBattles: ["b01_palace_coup"], completedBattles: ["b01_palace_coup"] };
    expect(resolveNextChapter(s)).toBeNull();
  });
});
