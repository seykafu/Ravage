import type { ItemKind } from "../combat/types";

// Trading post recipes. Available in every BattlePrepScene's inventory
// panel (Ravage's currency-free economy — items are the resource, not
// gold). Each trade costs N items of one kind and produces M items of
// another. Trades are atomic: either every required item is present in
// the squad pool (and consumed) or the trade is rejected.
//
// Pricing rationale (Potion = 1 unit baseline):
//   Potion  = 1u  (heals 10)
//   Elixir  = 3u  (heals 25 — premium for compression into one slot)
//   Mask    = 2u  (+2 MOV, situational but powerful)
//   Fang    = 3u  (+10% crit, works for every attacker)
//   Royal Lens = 4u (+15% hit, nearly always-on value)
//   Dactyl Food = 2u (+1 AP / -4 ARM, niche — only dactyl users)
//
// Cross-trades let the player upgrade specialty stacks (e.g., 2 Fangs →
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
}

export const TRADE_RECIPES: TradeRecipe[] = [
  // Potion → premium consumable (compression)
  {
    id: "trade_3pot_1elx",
    costs: [{ kind: "potion", count: 3 }],
    yields: [{ kind: "elixir", count: 1 }],
    label: "3 Potions → 1 Elixir"
  },
  // Potion → mobility
  {
    id: "trade_2pot_1mask",
    costs: [{ kind: "potion", count: 2 }],
    yields: [{ kind: "mask", count: 1 }],
    label: "2 Potions → 1 Mask"
  },
  // Potion → crit equipment
  {
    id: "trade_3pot_1fang",
    costs: [{ kind: "potion", count: 3 }],
    yields: [{ kind: "fang", count: 1 }],
    label: "3 Potions → 1 Fang"
  },
  // Potion → niche dactyl item
  {
    id: "trade_2pot_1dfood",
    costs: [{ kind: "potion", count: 2 }],
    yields: [{ kind: "dactyl_food", count: 1 }],
    label: "2 Potions → 1 Dactyl Food"
  },
  // Potion → universal hit boost (the priciest forward trade — Royal
  // Lens is nearly always-on value, so it has to actually cost)
  {
    id: "trade_4pot_1lens",
    costs: [{ kind: "potion", count: 4 }],
    yields: [{ kind: "royal_lens", count: 1 }],
    label: "4 Potions → 1 Royal Lens"
  },
  // Lateral upgrades — collect specialty equipment to upgrade into
  // higher-tier equipment without dumping back to potions.
  {
    id: "trade_2fang_1lens",
    costs: [{ kind: "fang", count: 2 }],
    yields: [{ kind: "royal_lens", count: 1 }],
    label: "2 Fangs → 1 Royal Lens"
  },
  {
    id: "trade_2mask_1lens",
    costs: [{ kind: "mask", count: 2 }],
    yields: [{ kind: "royal_lens", count: 1 }],
    label: "2 Masks → 1 Royal Lens"
  },
  // Elixir downgrade — emergency potions when you're out of healing
  // and an Elixir is overkill for the situation.
  {
    id: "trade_1elx_2pot",
    costs: [{ kind: "elixir", count: 1 }],
    yields: [{ kind: "potion", count: 2 }],
    label: "1 Elixir → 2 Potions"
  }
];

export const tradeById = (id: string): TradeRecipe | undefined =>
  TRADE_RECIPES.find((r) => r.id === id);
