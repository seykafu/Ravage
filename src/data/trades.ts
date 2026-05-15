import type { ItemKind } from "../combat/types";
import type { BattleId } from "./contentIds";

// Trading post recipes. Available in every BattlePrepScene's inventory
// panel (Ravage's currency-free economy — items are the resource, not
// gold). Each trade costs N items of one kind and produces M items of
// another. Trades are atomic: either every required item is present in
// the squad pool (and consumed) or the trade is rejected.
//
// Pricing rationale (Potion = 1 unit baseline):
//   Potion       = 1u  (heals 10)
//   Elixir       = 3u  (heals 25 — premium for compression into one slot)
//   Mask         = 2u  (+2 MOV during one battle — single-use)
//   Fang         = 4u  (+10% crit, persists across battles)
//   Royal Lens   = 6u  (+15% hit, nearly always-on, persists)
//   Dactyl Food  = 3u  (+1 AP / -4 ARM, niche — only dactyl users)
//
// Two-tier economy:
//   * Mask is the cheap, easily-acquired tactical mobility item that
//     burns at the end of every fight. Always available.
//   * Fang / Royal Lens / Dactyl Food are the strategic "buildcraft"
//     equipment — persistent across battles, costlier, and gated
//     behind reaching Grude (B12 complete) so the early act can't
//     stockpile permanent crit/hit before the squad's even crossed.
//
// Cross-trades let the player upgrade specialty stacks (e.g., 3 Fangs →
// 1 Royal Lens) so a build-focused player isn't trapped if the early
// rewards don't match their plan. We don't allow downgrading equipment
// back to potions in v1 — keeps the trade table small + intentional.
export interface TradeRecipe {
  // Stable id for analytics + dedup. New trades append; never reorder.
  id: string;
  // What the trade consumes from the squad pool.
  costs: { kind: ItemKind; count: number }[];
  // What the trade produces into the squad pool.
  yields: { kind: ItemKind; count: number }[];
  // One-line label used by the trading post UI.
  label: string;
  // Optional gate — recipe is hidden / shown-but-disabled until this
  // battle id appears in save.completedBattles. Used to lock the
  // strategic-equipment trades (Fang / Royal Lens / Dactyl Food)
  // behind reaching Grude. Undefined → always available.
  unlockedAfter?: BattleId;
}

// The Grude-arrival gate. After completing B12 (squad steps off
// Khione's ship onto the east port) the strategic-equipment trades
// open up. Pre-Grude the player can still trade for Mask (single-use
// mobility) and convert between Potion / Elixir freely.
const GRUDE_GATE: BattleId = "b12_ravage";

export const TRADE_RECIPES: TradeRecipe[] = [
  // Potion → premium consumable (compression). Always available.
  {
    id: "trade_3pot_1elx",
    costs: [{ kind: "potion", count: 3 }],
    yields: [{ kind: "elixir", count: 1 }],
    label: "3 Potions → 1 Elixir"
  },
  // Potion → single-use mobility. Always available — Mask is the
  // tactical/disposable tier, intentionally easy to come by.
  {
    id: "trade_2pot_1mask",
    costs: [{ kind: "potion", count: 2 }],
    yields: [{ kind: "mask", count: 1 }],
    label: "2 Potions → 1 Mask"
  },
  // Potion → crit equipment. Pre-Grude this trade is hidden — the
  // pricing bumped from 3→4 Potions per Fang to keep equipment a real
  // commitment instead of an obvious autoconvert.
  {
    id: "trade_4pot_1fang",
    costs: [{ kind: "potion", count: 4 }],
    yields: [{ kind: "fang", count: 1 }],
    label: "4 Potions → 1 Fang",
    unlockedAfter: GRUDE_GATE
  },
  // Potion → niche dactyl item. Pre-Grude hidden; bumped 2→3 Potions.
  {
    id: "trade_3pot_1dfood",
    costs: [{ kind: "potion", count: 3 }],
    yields: [{ kind: "dactyl_food", count: 1 }],
    label: "3 Potions → 1 Dactyl Food",
    unlockedAfter: GRUDE_GATE
  },
  // Potion → universal hit boost. Royal Lens is the strongest passive
  // in the game (nearly always-on value), so it pays the steepest
  // ratio. Bumped 4→6 Potions and gated behind Grude.
  {
    id: "trade_6pot_1lens",
    costs: [{ kind: "potion", count: 6 }],
    yields: [{ kind: "royal_lens", count: 1 }],
    label: "6 Potions → 1 Royal Lens",
    unlockedAfter: GRUDE_GATE
  },
  // Lateral upgrades — collect specialty equipment to upgrade into
  // higher-tier equipment without dumping back to potions. Both
  // bumped 2→3 cost items and gated behind Grude (the equipment they
  // operate on is itself gated, so the gate is implicit anyway, but
  // making it explicit keeps the UI honest).
  {
    id: "trade_3fang_1lens",
    costs: [{ kind: "fang", count: 3 }],
    yields: [{ kind: "royal_lens", count: 1 }],
    label: "3 Fangs → 1 Royal Lens",
    unlockedAfter: GRUDE_GATE
  },
  {
    id: "trade_3mask_1lens",
    costs: [{ kind: "mask", count: 3 }],
    yields: [{ kind: "royal_lens", count: 1 }],
    label: "3 Masks → 1 Royal Lens",
    unlockedAfter: GRUDE_GATE
  },
  // Elixir downgrade — emergency potions when you're out of healing
  // and an Elixir is overkill for the situation. Always available.
  {
    id: "trade_1elx_2pot",
    costs: [{ kind: "elixir", count: 1 }],
    yields: [{ kind: "potion", count: 2 }],
    label: "1 Elixir → 2 Potions"
  }
];

export const tradeById = (id: string): TradeRecipe | undefined =>
  TRADE_RECIPES.find((r) => r.id === id);
