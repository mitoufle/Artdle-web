# Workshop Leveling + Tiered Items — Design Spec

**Date:** 2026-05-06
**Goal:** rework the workshop into a leveling system that crafts tiered items (Normal → Legendary) with multi-affix payloads. Items gain a `slot` kind (brush, palette, ...) gated by skill-tree unlocks. Workshop level gates which item tiers can roll, with hard thresholds; legendary remains genuinely rare.

**Why:** the current workshop is a single fixed-cost craft producing single-affix items, with no progression. The redesign adds a long-tail mechanic (workshop level), strategic depth (slot kinds gated by fame), and ARPG-style tiered loot (more affixes per tier).

---

## Decisions locked during brainstorm

1. **Workshop levels via XP per craft** (not gold spending, not skill-tree only).
2. **Hard tier gates** with level thresholds (Q2 option A): Normal=L1, Magic=L5, Rare=L15, Epic=L35, Legendary=L70.
3. **Skill-tree unlocks slot kinds.** No workshop-level milestones; each slot kind has a fame node. Existing `gear_up` repurposed to "Unlock Palette Slot."
4. **Affix magnitudes are flat 5–15%** per affix. Skill-tree multipliers boost magnitude at read time (so future Better-Brush-style nodes work without re-rolling items).
5. **Duplicate affix kinds allowed** on the same item.
6. **Single random craft button.** Engine picks slot kind uniformly from unlocked kinds.
7. **Cost piecewise growth.** 1.05 from L1–L5, 1.20 from L5+. L70 craft = 21M g, L100 = 5B g.
8. **XP per craft = 1.** XP-to-next-level = `4 × (level + 1)`. L70 reached at ~9,936 crafts.
9. **Probability shape per tier:** linear interp from `(unlock_level, min_prob)` to `(L100, max_prob)`.
   - Magic 1% → 30%, Rare 1% → 15%, Epic 0.5% → 5%, Legendary 0.01% → 1%. Normal fills the remainder.

---

## Architecture

The workshop slice owns level + XP + unlocked-kinds + equipped-by-kind + inventory. Pure helpers live in `src/core/workshopRoll.ts` (new). Skill-tree integration is read-only (the slice computes `unlockedSlotKinds` from `purchasedNodes` rather than mutating in response to node purchases). Existing affix sums in `core/multipliers.ts` continue to flow through `getEquippedContribution(state, kind)` — that function gets a single-line update to walk the new equipped-by-kind shape and per-affix structure.

---

## Schema changes

### Item shape

```ts
// src/store/workshopSlice.ts (rewrite)

export type SlotKind = "brush" | "palette";
export const ALL_SLOT_KINDS: ReadonlyArray<SlotKind> = ["brush", "palette"];

export type ItemTier = "normal" | "magic" | "rare" | "epic" | "legendary";
export const ALL_ITEM_TIERS: ReadonlyArray<ItemTier> = [
  "normal", "magic", "rare", "epic", "legendary",
];

export interface Affix {
  readonly kind: AffixKind;       // existing AFFIX_KINDS
  readonly magnitude: number;     // 5..15 inclusive
}

export interface Item {
  readonly id: string;            // crypto.randomUUID() or nanoid-style
  readonly slot: SlotKind;
  readonly tier: ItemTier;
  readonly affixes: ReadonlyArray<Affix>;  // length = TIER_AFFIX_COUNT[tier]
}
```

### WorkshopState

```ts
export interface WorkshopState {
  readonly workshopLevel: number;       // 1..MAX_WORKSHOP_LEVEL (100)
  readonly workshopXp: number;          // 0..xpToNext(workshopLevel) - 1
  readonly inventory: ReadonlyArray<Item>;
  readonly equipped: Partial<Record<SlotKind, Item>>;  // one item per kind, max
}
```

`equippedItems: ReadonlyArray<Item>` is removed.

### Initial state

```ts
export const initialWorkshopState: WorkshopState = {
  workshopLevel: 1,
  workshopXp: 0,
  inventory: [],
  equipped: {},
};
```

---

## Slot-kind unlocking

A pure selector reads `purchasedNodes` and returns the slot kinds the player can use:

```ts
// src/store/workshopSlice.ts
export const getUnlockedSlotKinds = (state: GameStore): ReadonlyArray<SlotKind> => {
  const out: SlotKind[] = ["brush"];  // always available
  if (state.purchasedNodes.gear_up) out.push("palette");
  // future slot kinds: add node-id → slot-kind mapping here
  return out;
};
```

The `gear_up` node in `skillTreeDesign.json` gets renamed at edit time:
- name: `"Gear Up"` → `"Unlock Palette Slot"`
- description: explains palette slot
- numericEffect: `"+1 palette slot"`
- The node-id stays `gear_up` so existing purchases don't reset.

---

## Crafting flow

```ts
// src/store/workshopSlice.ts (the slice's `craft` action)
craft: () => {
  const state = get();
  if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
  const cost = craftCost(state.workshopLevel);
  if (!state.spend("gold", cost)) return false;

  const unlocked = getUnlockedSlotKinds(state);
  const slot = pickRandom(unlocked, state.rng);
  const tier = rollTier(state.workshopLevel, state.rng);
  const affixes = rollAffixes(tier, state.rng);
  const item: Item = {
    id: nextItemId(),
    slot,
    tier,
    affixes,
  };

  set((s) => {
    let newLevel = s.workshopLevel;
    let newXp = s.workshopXp + XP_PER_CRAFT;
    while (newLevel < MAX_WORKSHOP_LEVEL && newXp >= xpToNext(newLevel)) {
      newXp -= xpToNext(newLevel);
      newLevel += 1;
    }
    return {
      inventory: [...s.inventory, item],
      workshopLevel: newLevel,
      workshopXp: newXp,
    };
  });
  return true;
},
```

`rng` is the existing `state.rng` (deterministic for testability). `nextItemId()` reuses the existing item-id generator.

---

## Workshop leveling math

```ts
// src/core/balance.ts
export const MAX_WORKSHOP_LEVEL = 100;
export const CRAFT_COST_BASE = 100;
export const CRAFT_COST_EARLY_GROWTH = 1.05;  // L1..L5
export const CRAFT_COST_LATE_GROWTH = 1.20;   // L5+
export const XP_PER_CRAFT = 1;

export function craftCost(level: number): Big {
  if (level <= 5) {
    return big(CRAFT_COST_BASE).mul(big(CRAFT_COST_EARLY_GROWTH).pow(level - 1));
  }
  const costAtL5 = big(CRAFT_COST_BASE).mul(big(CRAFT_COST_EARLY_GROWTH).pow(4));
  return costAtL5.mul(big(CRAFT_COST_LATE_GROWTH).pow(level - 5));
}

export function xpToNext(currentLevel: number): number {
  return 4 * (currentLevel + 1);
}
```

Derived numbers:

| Level | Cost (g) | XP for next | Crafts to reach |
|---|---|---|---|
| 1 | 100 | 8 | 0 |
| 5 | 122 | 24 | 56 |
| 15 | 756 | 64 | 510 |
| 35 | 28,973 | 144 | 2,576 |
| 70 | 21,396,000 | 284 | **9,936** |
| 100 | 5,070,000,000 | 404 | 20,196 |

---

## Tier system

```ts
// src/core/workshopRoll.ts (new)
export const TIER_UNLOCK_LEVEL: Record<ItemTier, number> = {
  normal:    1,
  magic:     5,
  rare:      15,
  epic:      35,
  legendary: 70,
};

export const TIER_AFFIX_COUNT: Record<ItemTier, number> = {
  normal:    1,
  magic:     2,
  rare:      3,
  epic:      4,
  legendary: 5,
};

interface TierProbRange { min: number; max: number; }
export const TIER_PROB_RANGES: Record<Exclude<ItemTier, "normal">, TierProbRange> = {
  magic:     { min: 0.01,    max: 0.30 },
  rare:      { min: 0.01,    max: 0.15 },
  epic:      { min: 0.005,   max: 0.05 },
  legendary: { min: 0.0001,  max: 0.01 },
};

const PROB_MAX_LEVEL = 100;
```

### Probability formula

For each non-normal tier:
- If `level < TIER_UNLOCK_LEVEL[tier]`: probability = 0.
- Else: linear interp from `(unlock_level, min)` to `(PROB_MAX_LEVEL, max)`:
  ```
  t = clamp((level - unlock_level) / (PROB_MAX_LEVEL - unlock_level), 0, 1)
  prob = min + (max - min) * t
  ```

Normal tier probability = `1 - sum(other tier probabilities)`. Always positive (the max-prob sums for non-normal tiers at L100 = 0.30 + 0.15 + 0.05 + 0.01 = 0.51, so normal min = 0.49).

### `rollTier`

```ts
export function rollTier(level: number, rng: Rng): ItemTier {
  const probs = computeTierProbabilities(level);
  // probs is a record summing to 1
  const r = rng.next();
  let acc = 0;
  for (const tier of ALL_ITEM_TIERS) {
    acc += probs[tier];
    if (r < acc) return tier;
  }
  return "normal";  // fallback for floating-point edge case
}
```

### `rollAffixes`

```ts
export function rollAffixes(tier: ItemTier, rng: Rng): ReadonlyArray<Affix> {
  const count = TIER_AFFIX_COUNT[tier];
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pickRandom(AFFIX_KINDS, rng);
    const magnitude = rngInt(MAGNITUDE_MIN_PCT, MAGNITUDE_MAX_PCT, rng);
    out.push({ kind, magnitude });
  }
  return out;
}
```

Duplicates allowed (kind is picked independently each iteration).

---

## Equip / unequip

```ts
equipItem: (itemId: string): boolean => {
  const state = get();
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item) return false;
  if (!getUnlockedSlotKinds(state).includes(item.slot)) return false;
  // Move existing slot occupant (if any) back to inventory; replace with new item.
  set((s) => {
    const previousInSlot = s.equipped[item.slot];
    const inventory = s.inventory.filter((i) => i.id !== itemId);
    return {
      inventory: previousInSlot ? [...inventory, previousInSlot] : inventory,
      equipped: { ...s.equipped, [item.slot]: item },
    };
  });
  return true;
},

unequipSlot: (slot: SlotKind): boolean => {
  const state = get();
  const item = state.equipped[slot];
  if (!item) return false;
  if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
  set((s) => {
    const { [slot]: _removed, ...rest } = s.equipped;
    void _removed;
    return {
      inventory: [...s.inventory, item],
      equipped: rest,
    };
  });
  return true;
},
```

`MAX_INVENTORY_SLOTS = 3` stays unchanged for v1.

---

## Affix contribution rollup (multipliers integration)

```ts
// src/store/workshopSlice.ts (selector update)
export const getEquippedContribution = (state: GameStore, kind: AffixKind): number => {
  let total = 0;
  for (const item of Object.values(state.equipped)) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.kind === kind) total += affix.magnitude / 100;
    }
  }
  return total;
};
```

`core/multipliers.ts` does NOT change — it continues to call `getEquippedContribution(state, "+canvas_gold%")` etc. The function now sums across multi-affix items in equipped-by-slot-kind shape.

---

## Save migration v8 → v9

Game is unreleased. Wipe inventory and equipped state cleanly:

```ts
if (fromVersion < 9) {
  // v8 → v9 (2026-05-06): workshop rework. Inventory items change shape
  // (single-affix → multi-affix). Equipped becomes per-slot-kind. Wipe both;
  // initialize new fields. Existing fame, gold, canvas tier, skill tree progress
  // all preserved.
  state = {
    ...state,
    inventory: [],
    equipped: {},
    workshopLevel: 1,
    workshopXp: 0,
  };
  delete state.equippedItems;
}
```

---

## UI changes (`<WorkshopRoom>`)

- New top header: `Workshop · Lv {N} · {xp}/{xpMax}` with a thin progress bar styled like the inspiration tree's progress bars.
- Craft button label: `Craft · {cost} g`. Disabled when gold insufficient or inventory full.
- Below craft button: tier probabilities at the current level: `N 85% · M 10% · R 4% · E 0.5%`. Hidden tiers (probability 0) are omitted.
- Inventory items render as cards with:
  - Tier-colored border: Normal=gray, Magic=blue, Rare=yellow, Epic=purple, Legendary=orange.
  - Top-right slot-kind badge: `brush` / `palette`.
  - Affix list inline: each affix on its own row (`+12% canvas gold`).
  - "Equip" button — disabled if inventory full of unlocked-slot conflicts (rare in practice).
  - "Discard" button (existing, unchanged).
- Equipped panel: one row per **unlocked** slot kind. If equipped, shows item card miniature; if empty, shows "Empty {slot} slot."
- Locked slots (e.g., palette before unlock) are NOT shown in the equipped panel.

---

## Existing nodes / config impact

- `gear_up` skill-tree node: rename in `skillTreeDesign.json` to "Unlock Palette Slot" with description and numericEffect updated. Cost stays 100 fame.
- `BETTER_BRUSH_BONUS_PCT` constant in `workshopAffixes.ts` was removed in v3 cleanup; if a future skill-tree node wants to boost affix magnitude, it'll be a multiplier in `core/multipliers.ts` applied at read time.

---

## Test surface (~30-40 new/modified tests)

- `tests/core/balance.test.ts` — craftCost, xpToNext (5-7 tests)
- `tests/core/workshopRoll.test.ts` (new) — rollTier (probabilities sum to 1, monotonic per tier across levels, hard gates respected), rollAffixes (count matches tier, magnitude in range, duplicates appear) (10-12 tests)
- `tests/store/workshopSlice.test.ts` — craft levels up correctly, equip/unequip per slot kind, getUnlockedSlotKinds reads gear_up, save migration v8→v9 (10-12 tests)
- `tests/components/painting/WorkshopRoom.test.tsx` — render workshop level header, multi-affix card render, slot badge, tier color border, equip button per slot, locked slots hidden (8-10 tests)

---

## Out of scope (deferred)

- Workshop XP rewards from skill-tree nodes (e.g., "+50% XP per craft").
- Affix magnitude multipliers from skill-tree nodes (the structure supports it, but no node implements it yet).
- Inventory size expansion via skill tree (3 slots is hard-coded).
- Crafting speed (idle conveyor — single-tap craft for now).
- Re-rolling existing items (PoE-style currency).
- Equipment "trash" auto-discard rules.
- Affix-kind weights (currently uniform).
- Animations for tier rolls (no rare-pop or legendary-flash).

---

## Risks

- **L70+ crafts very expensive (21M g):** if late-game gold income doesn't keep pace, players will feel locked out. Mitigation: monitor balance once new skill-tree multiplicative paths land; can lower `LATE_GROWTH` if needed.
- **Legendary at 0.01% per craft at L70:** ~10k crafts to expect one legendary AT L70 (after the 10k crafts to GET to L70). Genuinely "extremely hard" — confirmed user intent. Skill-tree boost paths will become important.
- **Save migration wipes equipped items:** game unreleased, no real cost. Worth noting for any test fixture that seeds `equippedItems` directly.
