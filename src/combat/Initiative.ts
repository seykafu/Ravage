import type { Faction, Unit } from "./types";
import { isAlive } from "./Unit";

// Phase-based initiative: all player+ally units act first (in speed order),
// then all enemy units act (in speed order). Ties break by deployment order.
export const sortInitiative = (units: Unit[]): Unit[] => {
  const factionOrder: Record<Faction, number> = { player: 0, ally: 1, enemy: 2 };
  return [...units]
    .filter(isAlive)
    .map((u, idx) => ({ u, idx }))
    .sort((a, b) => {
      const fa = factionOrder[a.u.faction];
      const fb = factionOrder[b.u.faction];
      if (fa !== fb) return fa - fb;                                          // phase first
      if (b.u.stats.speed !== a.u.stats.speed) return b.u.stats.speed - a.u.stats.speed; // speed within phase
      return a.idx - b.idx;
    })
    .map((p) => p.u);
};

export class Initiative {
  private order: Unit[] = [];
  private cursor = 0;
  round = 1;

  reseed(allUnits: Unit[]): void {
    this.order = sortInitiative(allUnits);
    this.cursor = 0;
  }

  current(): Unit | null {
    while (this.cursor < this.order.length) {
      const u = this.order[this.cursor]!;
      if (isAlive(u)) return u;
      this.cursor++;
    }
    return null;
  }

  // Advance to the next living unit. Triggers a new round if the queue is exhausted.
  advance(allUnits: Unit[]): Unit | null {
    this.cursor++;
    while (this.cursor < this.order.length) {
      const u = this.order[this.cursor]!;
      if (isAlive(u)) return u;
      this.cursor++;
    }
    this.round++;
    this.reseed(allUnits);
    for (const u of allUnits) {
      if (!isAlive(u)) continue;
      u.state.hasActedThisRound = false;
      u.state.hasStartedTurnThisRound = false;
    }
    return this.current();
  }

  // Move the given unit to the cursor position so it becomes current().
  // Only valid if u is in the queue at or after the cursor (i.e., hasn't been processed).
  // Returns true on success, false if u isn't a valid swap target.
  setCurrent(u: Unit): boolean {
    for (let i = this.cursor; i < this.order.length; i++) {
      if (this.order[i]!.id === u.id) {
        if (i !== this.cursor) {
          const tmp = this.order[this.cursor]!;
          this.order[this.cursor] = u;
          this.order[i] = tmp;
        }
        return true;
      }
    }
    return false;
  }

  // Get the upcoming N turns for the initiative bar UI. Reseeds virtually if needed.
  upcoming(allUnits: Unit[], count: number): Unit[] {
    const out: Unit[] = [];
    let cursor = this.cursor;
    let workOrder = this.order;
    while (out.length < count) {
      if (cursor >= workOrder.length) {
        // start of next round (virtual)
        workOrder = sortInitiative(allUnits);
        cursor = 0;
      }
      const u = workOrder[cursor];
      if (u && isAlive(u)) out.push(u);
      cursor++;
      if (out.length > 64) break; // safety
    }
    return out;
  }
}
