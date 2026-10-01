import { describe, it, expect } from "vitest";
import { FIRE, ringSlots } from "../layout";

const angleOf = (s: { x: number; y: number }): number => {
  const d = (Math.atan2(s.y - FIRE.y, s.x - FIRE.x) * 180) / Math.PI;
  return (d + 360) % 360;
};

describe("camp ring", () => {
  // The campaign never seats more than 8; the wider ring is a margin past that.
  for (let n = 1; n <= 11; n++) {
    it(`places ${n} round the fire without crowding`, () => {
      const slots = ringSlots(n);
      expect(slots).toHaveLength(n);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const d = Math.hypot(slots[i]!.x - slots[j]!.x, slots[i]!.y - slots[j]!.y);
          expect(d).toBeGreaterThan(n <= 8 ? 70 : 44);
        }
      }
    });

    it(`keeps the front of the fire open and nobody behind the flames (${n})`, () => {
      for (const s of ringSlots(n)) {
        const a = angleOf(s);
        expect(a > 62 && a < 118).toBe(false);
        expect(a > 258 && a < 282).toBe(false);
      }
    });
  }

  it("turns everyone to face the fire", () => {
    for (const s of ringSlots(12)) expect(s.faceLeft).toBe(s.x > FIRE.x);
  });
});
