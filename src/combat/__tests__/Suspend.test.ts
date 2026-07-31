// Suspend snapshot tests: the serialize/deserialize round-trip that
// mid-battle resume depends on. The JSON.stringify/parse leg mirrors
// what writeSave does to the snapshot, so a field that doesn't survive
// JSON (Sets, functions) fails HERE instead of corrupting a resume.

import { describe, it, expect } from "vitest";
import { deserializeUnit, serializeUnit } from "../Suspend";
import { Initiative } from "../Initiative";
import { createUnit } from "../Unit";
import { createPotion, createFang } from "../items";
import type { TilePos, Unit, UnitDef } from "../types";

const mkUnit = (overrides: Partial<UnitDef>, pos: TilePos): Unit => {
  const def: UnitDef = {
    id: overrides.id ?? "u",
    name: "U",
    shortName: "U",
    faction: "player",
    classKind: "swordsman",
    weapon: "sword",
    stats: { hp: 30, power: 10, armor: 5, speed: 8, movement: 5, ap: 3 },
    artSeed: 7,
    level: 5,
    ...overrides
  };
  return createUnit(def, pos);
};

describe("unit serialize/deserialize round-trip", () => {
  it("survives JSON with live state, inventory, and a tags Set intact", () => {
    const u = mkUnit({
      id: "boss1",
      faction: "enemy",
      tags: new Set(["boss", "aggressive"]),
      abilities: ["Roam"],
      growths: { hp: 50, power: 40, armor: 30, speed: 20, movement: 5 },
      holdPositionUntil: { allyCount: 1 }
    }, { x: 4, y: 7 });
    // Battle-worn state.
    u.state.hp = 11;
    u.state.apRemaining = 1;
    u.state.stance = "both";
    u.state.xp = 60;
    u.state.hasActedThisRound = true;
    u.state.hasStartedTurnThisRound = true;
    u.state.facingX = -1;
    u.state.ravagedNextTurn = true;
    u.state.damageTakenSinceLastTurn = 19;
    u.state.inventory = [createPotion(), createFang()];

    // The exact path a snapshot travels: serialize → JSON → deserialize.
    const wire = JSON.parse(JSON.stringify(serializeUnit(u)));
    const back = deserializeUnit(wire);

    expect(back.id).toBe("boss1");
    expect(back.tags).toBeInstanceOf(Set);
    expect([...back.tags!].sort()).toEqual(["aggressive", "boss"]);
    expect(back.holdPositionUntil).toEqual({ allyCount: 1 });
    expect(back.growths).toEqual(u.growths);
    expect(back.state.hp).toBe(11);
    expect(back.state.stance).toBe("both");
    expect(back.state.position).toEqual({ x: 4, y: 7 });
    expect(back.state.facingX).toBe(-1);
    expect(back.state.ravagedNextTurn).toBe(true);
    expect(back.state.inventory.map((i) => i.kind)).toEqual(["potion", "fang"]);
  });

  it("does not alias live state — mutating the original leaves the snapshot alone", () => {
    const u = mkUnit({}, { x: 1, y: 1 });
    const snap = serializeUnit(u);
    u.state.hp = 1;
    u.state.position.x = 9;
    u.state.inventory.push(createPotion());
    expect(snap.state.hp).toBe(30);
    expect(snap.state.position.x).toBe(1);
    expect(snap.state.inventory).toHaveLength(0);
  });
});

describe("initiative serialize/restore", () => {
  it("restores round, order, and the current unit", () => {
    const a = mkUnit({ id: "a", stats: { hp: 30, power: 10, armor: 5, speed: 9, movement: 5, ap: 3 } }, { x: 0, y: 0 });
    const b = mkUnit({ id: "b", stats: { hp: 30, power: 10, armor: 5, speed: 7, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const e = mkUnit({ id: "e", faction: "enemy" }, { x: 5, y: 5 });
    const units = [a, b, e];

    const init = new Initiative();
    init.reseed(units);
    init.advance(units);       // a done → b is current
    init.round = 3;
    const snap = JSON.parse(JSON.stringify(init.serialize()));

    const restored = new Initiative();
    restored.reseed(units);    // scene always reseeds first; restore overrides
    restored.restore(units, snap);
    expect(restored.round).toBe(3);
    expect(restored.current()?.id).toBe("b");
    expect(restored.upcoming(units, 2).map((u) => u.id)).toEqual(["b", "e"]);
  });

  it("drops unresolvable ids and clamps the cursor", () => {
    const a = mkUnit({ id: "a" }, { x: 0, y: 0 });
    const units = [a];
    const init = new Initiative();
    init.restore(units, { round: 2, cursor: 5, orderIds: ["ghost", "a"] });
    expect(init.round).toBe(2);
    // Cursor clamped past the single valid entry → queue exhausted.
    expect(init.current()).toBeNull();
  });
});
