# Workshop Leveling + Tiered Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat single-affix workshop with a leveling system that crafts tiered items (Normal..Legendary) with multi-affix payloads, slot-kind gating tied to skill-tree fame nodes, and a piecewise cost curve. Workshop levels via 1 XP per craft; legendary becomes genuinely rare per spec.

**Architecture:** Pure-logic modules in `src/core/balance.ts` (cost + XP) and `src/core/workshopRoll.ts` (new — tier + affix rolling). The workshop slice owns level + XP + unlocked-kinds + equipped-by-kind + inventory. Slot kinds are unlocked via skill-tree node lookup (existing `gear_up` repurposed to "Unlock Palette Slot"). Save migration v8 → v9 wipes inventory + equipped (game unreleased; no real cost). `core/multipliers.ts` continues to read affix sums via the same `getEquippedContribution` function — only its body updates to walk the new structure.

**Tech Stack:** React 19 + TypeScript strict + Vite + Zustand 5 + Vitest + RTL.

---

## File structure

### New files

| File | Responsibility |
|---|---|
| `src/core/workshopRoll.ts` | Tier probabilities, `rollTier`, `rollAffixes`. Uses module-global rng (matches existing pattern). |
| `tests/core/workshopRoll.test.ts` | Unit tests. |

### Modified files

| File | Change |
|---|---|
| `src/core/balance.ts` | Add `MAX_WORKSHOP_LEVEL`, `CRAFT_COST_BASE`, `CRAFT_COST_EARLY_GROWTH`, `CRAFT_COST_LATE_GROWTH`, `XP_PER_CRAFT`, `craftCost()`, `xpToNext()`. |
| `src/config/workshopAffixes.ts` | Remove `CRAFT_COST_GOLD` (replaced by `craftCost(level)`) and `BETTER_BRUSH_BONUS_PCT` (already inert). Add `SlotKind`, `ALL_SLOT_KINDS`, `ItemTier`, `ALL_ITEM_TIERS`. |
| `src/store/workshopSlice.ts` | Full rewrite — new `Item` shape, `WorkshopState` (workshopLevel/Xp + equipped by-kind + inventory), new `craft` (rolls tier+affixes+slot, awards XP), `equipItem`/`unequipSlot`, `getUnlockedSlotKinds`, updated `getEquippedContribution`. |
| `src/store/index.ts` | `SAVE_VERSION` 8 → 9 + new migration block. |
| `src/config/skillTreeDesign.json` | Rename `gear_up` node (name + description + numericEffect). |
| `src/components/painting/WorkshopRoom.tsx` | Full rewrite — level header + XP bar + new craft button (with dynamic cost + tier prob hint) + tiered item cards + per-slot equipped panel. |
| `src/components/painting/WorkshopRoom.module.css` | Add tier-color borders + level-bar styles + slot-kind badge styles. |

### Test files touched

- `tests/core/balance.test.ts` — add craftCost + xpToNext tests.
- `tests/store/workshopSlice.test.ts` — full rewrite for new schema.
- `tests/components/painting/WorkshopRoom.test.tsx` — full rewrite.
- `tests/store/persistence-integration.test.ts` — update item-shape references; assert v8→v9 migration wipes inventory/equipped.
- `tests/core/multipliers.test.ts` — fixtures use `equipped: { brush: { ... } }` instead of `equippedItems: [...]`.
- `tests/systems/ascend.test.ts` — same fixture updates.

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Pure-logic foundation | 1, 2 |
| **B** | Slice + migration + skill-tree config | 3, 4, 5 |
| **C** | UI | 6 |
| **D** | Verify + ship | 7 |

Each task: TDD where applicable. Tests first; impl follows; commit per task.

---

## Pre-flight checks (do once before Task 1)

- [ ] Working tree clean. On `main`. HEAD recent.
- [ ] Baseline tests pass: `npm test` reports 539/539.
- [ ] `npx tsc -b --noEmit` clean.

---

# Phase A — Pure-logic foundation

---

### Task 1: Add craft cost + XP formulas to `core/balance.ts`

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `tests/core/balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/balance.test.ts` (just before the closing `});` of the file, after the existing pmThreshold tests):

```ts
// ============================================================================
// Workshop leveling
// ============================================================================
describe("craftCost (workshop level)", () => {
  it("returns 100 at level 1", () => {
    expect(craftCost(1).toNumber()).toBeCloseTo(100, 5);
  });

  it("scales by 1.05 per level for L1..L5", () => {
    expect(craftCost(2).toNumber()).toBeCloseTo(105, 1);
    expect(craftCost(5).toNumber()).toBeCloseTo(122, 0);
  });

  it("scales by 1.20 per level past L5", () => {
    // costAtL5 = 100 * 1.05^4 ≈ 121.55
    // L10 = 121.55 * 1.20^5 ≈ 302.55
    expect(craftCost(10).toNumber()).toBeCloseTo(303, 0);
    // L70 = 121.55 * 1.20^65 ≈ 21M+
    expect(craftCost(70).gt(big(20_000_000))).toBe(true);
    expect(craftCost(70).lt(big(25_000_000))).toBe(true);
  });

  it("monotonically increasing", () => {
    let prev = craftCost(1);
    for (let lvl = 2; lvl <= 100; lvl++) {
      const cur = craftCost(lvl);
      expect(cur.gt(prev)).toBe(true);
      prev = cur;
    }
  });
});

describe("xpToNext", () => {
  it("returns 8 at level 1 (= 4*(1+1))", () => {
    expect(xpToNext(1)).toBe(8);
  });

  it("returns 280 at level 69 (last to reach L70)", () => {
    expect(xpToNext(69)).toBe(280);
  });

  it("monotonically increasing", () => {
    let prev = xpToNext(1);
    for (let lvl = 2; lvl <= 99; lvl++) {
      const cur = xpToNext(lvl);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });

  it("cumulative XP to reach L70 is ~9,936", () => {
    let total = 0;
    for (let lvl = 1; lvl <= 69; lvl++) total += xpToNext(lvl);
    expect(total).toBe(9_936);
  });
});
```

Add to the import block at the top of `tests/core/balance.test.ts`:

```ts
import { craftCost, xpToNext } from "@/core/balance";
```

(Append `craftCost, xpToNext` to whichever import line is already pulling from `@/core/balance`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "core/balance"`
Expected: FAIL ("craftCost is not defined", "xpToNext is not defined").

- [ ] **Step 3: Implement in `src/core/balance.ts`**

Append to the constants block (just below `PM_LOG_FACTOR`):

```ts
// Workshop leveling — see docs/superpowers/specs/2026-05-06-workshop-leveling-design.md
export const MAX_WORKSHOP_LEVEL = 100;
export const CRAFT_COST_BASE = 100;
export const CRAFT_COST_EARLY_GROWTH = 1.05;  // L1..L5 — gentle ramp
export const CRAFT_COST_LATE_GROWTH = 1.20;   // L5+   — exponential climb
export const XP_PER_CRAFT = 1;
```

Append to the formulas block (after `pmThreshold`, before EOF):

```ts
/**
 * Cost in gold per craft attempt at the given workshop level.
 * Piecewise: gentle 1.05 ramp through L5; 1.20 climb afterward.
 */
export const craftCost = (level: number): Big => {
  if (level <= 5) {
    return big(CRAFT_COST_BASE).mul(big(CRAFT_COST_EARLY_GROWTH).pow(level - 1));
  }
  const costAtL5 = big(CRAFT_COST_BASE).mul(big(CRAFT_COST_EARLY_GROWTH).pow(4));
  return costAtL5.mul(big(CRAFT_COST_LATE_GROWTH).pow(level - 5));
};

/**
 * XP needed to advance from `currentLevel` to `currentLevel + 1`.
 * Linear in level: `4 * (currentLevel + 1)`. Cumulative to L70 ≈ 9,936 crafts.
 */
export const xpToNext = (currentLevel: number): number => 4 * (currentLevel + 1);
```

- [ ] **Step 4: Run tests**

Run: `npm test -- "core/balance"`
Expected: all passing (existing tests + new ones).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "balance(workshop): craft cost (piecewise) + xp curve"
```

---

### Task 2: Tier + affix rolling module

**Files:**
- Create: `src/core/workshopRoll.ts`
- Create: `tests/core/workshopRoll.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/workshopRoll.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  TIER_UNLOCK_LEVEL,
  TIER_AFFIX_COUNT,
  ALL_ITEM_TIERS,
  computeTierProbabilities,
  rollTier,
  rollAffixes,
} from "@/core/workshopRoll";
import { setSeed } from "@/core/rng";

describe("workshopRoll — tier probabilities", () => {
  it("at level 1: only normal is possible", () => {
    const probs = computeTierProbabilities(1);
    expect(probs.normal).toBe(1);
    expect(probs.magic).toBe(0);
    expect(probs.rare).toBe(0);
    expect(probs.epic).toBe(0);
    expect(probs.legendary).toBe(0);
  });

  it("at level 5: magic just unlocks at min prob 0.01", () => {
    const probs = computeTierProbabilities(5);
    expect(probs.magic).toBeCloseTo(0.01, 4);
    expect(probs.rare).toBe(0);
    expect(probs.normal).toBeCloseTo(0.99, 4);
  });

  it("at level 100 (max): legendary at 1%, epic 5%, rare 15%, magic 30%, normal fills remainder", () => {
    const probs = computeTierProbabilities(100);
    expect(probs.legendary).toBeCloseTo(0.01, 4);
    expect(probs.epic).toBeCloseTo(0.05, 4);
    expect(probs.rare).toBeCloseTo(0.15, 4);
    expect(probs.magic).toBeCloseTo(0.30, 4);
    expect(probs.normal).toBeCloseTo(0.49, 4);
  });

  it("probabilities always sum to 1.0", () => {
    for (const lvl of [1, 5, 15, 35, 50, 70, 100]) {
      const probs = computeTierProbabilities(lvl);
      const sum = ALL_ITEM_TIERS.reduce((acc, t) => acc + probs[t], 0);
      expect(sum).toBeCloseTo(1.0, 6);
    }
  });

  it("a tier is 0 below its unlock level", () => {
    expect(computeTierProbabilities(4).magic).toBe(0);
    expect(computeTierProbabilities(14).rare).toBe(0);
    expect(computeTierProbabilities(34).epic).toBe(0);
    expect(computeTierProbabilities(69).legendary).toBe(0);
  });

  it("a tier's prob grows monotonically from unlock to L100", () => {
    let prev = computeTierProbabilities(15).rare;
    for (let lvl = 16; lvl <= 100; lvl++) {
      const cur = computeTierProbabilities(lvl).rare;
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("workshopRoll — rollTier", () => {
  beforeEach(() => {
    setSeed(42);
  });

  it("at level 1, always returns 'normal'", () => {
    for (let i = 0; i < 50; i++) {
      expect(rollTier(1)).toBe("normal");
    }
  });

  it("at level 100, returns each tier at least once across many rolls", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) {
      const t = rollTier(100);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    for (const t of ALL_ITEM_TIERS) {
      expect(counts[t]).toBeGreaterThan(0);
    }
  });

  it("legendary at L70 is approximately 0.01% (within 0.05% empirical tolerance over 100k rolls)", () => {
    let leg = 0;
    for (let i = 0; i < 100_000; i++) {
      if (rollTier(70) === "legendary") leg += 1;
    }
    // Expected ~10 over 100k. Allow wide range due to small N.
    expect(leg).toBeLessThanOrEqual(60);
  });
});

describe("workshopRoll — rollAffixes", () => {
  beforeEach(() => {
    setSeed(42);
  });

  it("returns the correct count per tier", () => {
    expect(rollAffixes("normal").length).toBe(1);
    expect(rollAffixes("magic").length).toBe(2);
    expect(rollAffixes("rare").length).toBe(3);
    expect(rollAffixes("epic").length).toBe(4);
    expect(rollAffixes("legendary").length).toBe(5);
  });

  it("each affix has a kind from AFFIX_KINDS and magnitude in [5, 15]", () => {
    const affixes = rollAffixes("legendary");
    for (const a of affixes) {
      expect(["+canvas_gold%", "-paint_time%"]).toContain(a.kind);
      expect(a.magnitude).toBeGreaterThanOrEqual(5);
      expect(a.magnitude).toBeLessThanOrEqual(15);
    }
  });

  it("duplicates of the same kind are allowed across rolls", () => {
    setSeed(1);
    let foundDuplicate = false;
    for (let i = 0; i < 200 && !foundDuplicate; i++) {
      const affixes = rollAffixes("rare");
      const kinds = affixes.map((a) => a.kind);
      const uniques = new Set(kinds);
      if (uniques.size < kinds.length) foundDuplicate = true;
    }
    expect(foundDuplicate).toBe(true);
  });
});

describe("workshopRoll — constants", () => {
  it("unlock thresholds match spec", () => {
    expect(TIER_UNLOCK_LEVEL.normal).toBe(1);
    expect(TIER_UNLOCK_LEVEL.magic).toBe(5);
    expect(TIER_UNLOCK_LEVEL.rare).toBe(15);
    expect(TIER_UNLOCK_LEVEL.epic).toBe(35);
    expect(TIER_UNLOCK_LEVEL.legendary).toBe(70);
  });

  it("affix counts match spec (1..5)", () => {
    expect(TIER_AFFIX_COUNT.normal).toBe(1);
    expect(TIER_AFFIX_COUNT.magic).toBe(2);
    expect(TIER_AFFIX_COUNT.rare).toBe(3);
    expect(TIER_AFFIX_COUNT.epic).toBe(4);
    expect(TIER_AFFIX_COUNT.legendary).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "core/workshopRoll"`
Expected: FAIL ("Cannot find module ... workshopRoll").

- [ ] **Step 3: Implement `src/core/workshopRoll.ts`**

```ts
import { rng, rngInt, rngPick } from "@/core/rng";
import { AFFIX_KINDS, MAGNITUDE_MIN_PCT, MAGNITUDE_MAX_PCT } from "@/config/workshopAffixes";
import type { AffixKind } from "@/config/workshopAffixes";

export type ItemTier = "normal" | "magic" | "rare" | "epic" | "legendary";

export const ALL_ITEM_TIERS: ReadonlyArray<ItemTier> = [
  "normal",
  "magic",
  "rare",
  "epic",
  "legendary",
];

export const TIER_UNLOCK_LEVEL: Record<ItemTier, number> = {
  normal: 1,
  magic: 5,
  rare: 15,
  epic: 35,
  legendary: 70,
};

export const TIER_AFFIX_COUNT: Record<ItemTier, number> = {
  normal: 1,
  magic: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

interface TierProbRange {
  readonly min: number;
  readonly max: number;
}

const TIER_PROB_RANGES: Record<Exclude<ItemTier, "normal">, TierProbRange> = {
  magic: { min: 0.01, max: 0.30 },
  rare: { min: 0.01, max: 0.15 },
  epic: { min: 0.005, max: 0.05 },
  legendary: { min: 0.0001, max: 0.01 },
};

const PROB_MAX_LEVEL = 100;

export interface Affix {
  readonly kind: AffixKind;
  readonly magnitude: number;
}

/**
 * Compute the per-tier probability distribution at the given workshop level.
 * Linear interp from `(unlock_level, min)` to `(PROB_MAX_LEVEL, max)` for each
 * non-normal tier. `normal` fills the remainder so the distribution sums to 1.
 *
 * Tiers below their unlock level get probability 0.
 */
export function computeTierProbabilities(level: number): Record<ItemTier, number> {
  let nonNormalSum = 0;
  const out: Record<string, number> = {};
  for (const tier of ALL_ITEM_TIERS) {
    if (tier === "normal") continue;
    const range = TIER_PROB_RANGES[tier];
    const unlockLevel = TIER_UNLOCK_LEVEL[tier];
    if (level < unlockLevel) {
      out[tier] = 0;
      continue;
    }
    const span = PROB_MAX_LEVEL - unlockLevel;
    const t = span <= 0 ? 1 : Math.min(1, (level - unlockLevel) / span);
    const prob = range.min + (range.max - range.min) * t;
    out[tier] = prob;
    nonNormalSum += prob;
  }
  out.normal = Math.max(0, 1 - nonNormalSum);
  return out as Record<ItemTier, number>;
}

/** Roll a tier from the level's distribution. Uses module-global rng. */
export function rollTier(level: number): ItemTier {
  const probs = computeTierProbabilities(level);
  const r = rng();
  let acc = 0;
  for (const tier of ALL_ITEM_TIERS) {
    acc += probs[tier];
    if (r < acc) return tier;
  }
  return "normal"; // floating-point fallback
}

/** Roll the affixes for an item of the given tier. Duplicate kinds allowed. */
export function rollAffixes(tier: ItemTier): ReadonlyArray<Affix> {
  const count = TIER_AFFIX_COUNT[tier];
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const kind = rngPick(AFFIX_KINDS);
    const magnitude = rngInt(MAGNITUDE_MIN_PCT, MAGNITUDE_MAX_PCT);
    out.push({ kind, magnitude });
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- "core/workshopRoll"`
Expected: passing.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/workshopRoll.ts tests/core/workshopRoll.test.ts
git commit -m "workshop(roll): tier + affix rolling module (probability-table driven)"
```

---

# Phase B — Slice + migration + skill-tree config

---

### Task 3: Rewrite `workshopSlice` for new schema

**Files:**
- Modify: `src/config/workshopAffixes.ts` (drop `CRAFT_COST_GOLD`, `BETTER_BRUSH_BONUS_PCT`; add slot-kind types)
- Modify: `src/store/workshopSlice.ts` (full rewrite)
- Modify: `tests/store/workshopSlice.test.ts` (full rewrite)
- Modify: `tests/core/multipliers.test.ts` (fixture migration: `equippedItems` → `equipped`)
- Modify: `tests/systems/ascend.test.ts` (same fixture migration)

This is the heaviest task. It cascades into many test fixtures. The compile errors from cascading fixture-shape mismatch are expected and guide the migration.

- [ ] **Step 1: Update `src/config/workshopAffixes.ts`**

Replace contents with:

```ts
/**
 * Persisted affix identifier. Renames require a save migration.
 *
 * Items come from the Workshop and only boost painting-related mechanics.
 */
export type AffixKind = "+canvas_gold%" | "-paint_time%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+canvas_gold%",
  "-paint_time%",
];

/** Inclusive lower bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MIN_PCT = 5;

/** Inclusive upper bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MAX_PCT = 15;

/** Inventory cap. Locked at 3 for v1. */
export const MAX_INVENTORY_SLOTS = 3;

/** Slot kind — distinct equipment families. Each unlocked kind = one equipped slot. */
export type SlotKind = "brush" | "palette";

export const ALL_SLOT_KINDS: ReadonlyArray<SlotKind> = ["brush", "palette"];
```

- [ ] **Step 2: Write the failing test (full rewrite of slice tests)**

Replace `tests/store/workshopSlice.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import {
  getCurrentSlotCount,
  getEquippedContribution,
  getUnlockedSlotKinds,
} from "@/store/workshopSlice";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import type { Item } from "@/store/workshopSlice";

function freshState() {
  useGameStore.setState({
    inventory: [],
    equipped: {},
    workshopLevel: 1,
    workshopXp: 0,
    purchasedNodes: {},
    gold: big(0),
  });
}

const sampleBrush: Item = {
  id: "test-brush-1",
  slot: "brush",
  tier: "magic",
  affixes: [
    { kind: "+canvas_gold%", magnitude: 12 },
    { kind: "-paint_time%", magnitude: 8 },
  ],
};

describe("workshopSlice — selectors", () => {
  beforeEach(freshState);

  it("getUnlockedSlotKinds: only 'brush' by default", () => {
    expect(getUnlockedSlotKinds(useGameStore.getState())).toEqual(["brush"]);
  });

  it("getUnlockedSlotKinds: includes 'palette' when gear_up purchased", () => {
    useGameStore.setState({ purchasedNodes: { gear_up: 1 } });
    expect(getUnlockedSlotKinds(useGameStore.getState())).toEqual(["brush", "palette"]);
  });

  it("getCurrentSlotCount: total of unlocked kinds", () => {
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(1);
    useGameStore.setState({ purchasedNodes: { gear_up: 1 } });
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(2);
  });

  it("getEquippedContribution: sums affixes of matching kind across all equipped items", () => {
    useGameStore.setState({ equipped: { brush: sampleBrush } });
    expect(getEquippedContribution(useGameStore.getState(), "+canvas_gold%")).toBeCloseTo(0.12, 5);
    expect(getEquippedContribution(useGameStore.getState(), "-paint_time%")).toBeCloseTo(0.08, 5);
  });

  it("getEquippedContribution: returns 0 when nothing equipped", () => {
    expect(getEquippedContribution(useGameStore.getState(), "+canvas_gold%")).toBe(0);
  });

  it("getEquippedContribution: works across multiple slot kinds", () => {
    const palette: Item = {
      id: "test-palette-1",
      slot: "palette",
      tier: "rare",
      affixes: [
        { kind: "+canvas_gold%", magnitude: 7 },
      ],
    };
    useGameStore.setState({ equipped: { brush: sampleBrush, palette } });
    // brush has +12% canvas gold + palette has +7% = 0.19
    expect(getEquippedContribution(useGameStore.getState(), "+canvas_gold%")).toBeCloseTo(0.19, 5);
  });

  it("getEquippedContribution: handles duplicate affix kinds on a single item", () => {
    const itemWithDupes: Item = {
      id: "test-dupes",
      slot: "brush",
      tier: "rare",
      affixes: [
        { kind: "+canvas_gold%", magnitude: 10 },
        { kind: "+canvas_gold%", magnitude: 5 },
        { kind: "-paint_time%", magnitude: 6 },
      ],
    };
    useGameStore.setState({ equipped: { brush: itemWithDupes } });
    expect(getEquippedContribution(useGameStore.getState(), "+canvas_gold%")).toBeCloseTo(0.15, 5);
  });
});

describe("workshopSlice — craft", () => {
  beforeEach(() => {
    freshState();
    setSeed(42);
  });

  it("returns false when inventory is full", () => {
    useGameStore.setState({
      inventory: Array.from({ length: 3 }, (_, i) => ({
        id: `pre-${i}`,
        slot: "brush" as const,
        tier: "normal" as const,
        affixes: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
      })),
      gold: big(1_000_000),
    });
    expect(useGameStore.getState().craft()).toBe(false);
  });

  it("returns false when not enough gold", () => {
    useGameStore.setState({ gold: big(50) });
    expect(useGameStore.getState().craft()).toBe(false);
  });

  it("on success: spends craftCost(1)=100, adds 1 item, grants 1 XP", () => {
    useGameStore.setState({ gold: big(100) });
    expect(useGameStore.getState().craft()).toBe(true);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    expect(useGameStore.getState().inventory.length).toBe(1);
    expect(useGameStore.getState().workshopXp).toBe(1);
  });

  it("crafted item has slot from unlocked kinds, tier from rollTier, affixes per tier", () => {
    useGameStore.setState({ gold: big(100) });
    useGameStore.getState().craft();
    const item = useGameStore.getState().inventory[0]!;
    expect(["brush"]).toContain(item.slot); // only brush unlocked
    expect(["normal", "magic", "rare", "epic", "legendary"]).toContain(item.tier);
    expect(item.affixes.length).toBeGreaterThanOrEqual(1);
  });

  it("levels up when XP threshold reached: e.g., 8 XP = L1 → L2", () => {
    useGameStore.setState({ gold: big(10_000), workshopXp: 7 });
    expect(useGameStore.getState().workshopLevel).toBe(1);
    useGameStore.getState().craft();
    expect(useGameStore.getState().workshopLevel).toBe(2);
    expect(useGameStore.getState().workshopXp).toBe(0); // 7 + 1 - 8 = 0
  });

  it("does not level up past MAX_WORKSHOP_LEVEL (100)", () => {
    useGameStore.setState({ gold: big(1e15), workshopLevel: 100, workshopXp: 0 });
    useGameStore.getState().craft();
    expect(useGameStore.getState().workshopLevel).toBe(100);
  });
});

describe("workshopSlice — equip / unequip", () => {
  beforeEach(freshState);

  it("equipItem: unknown id returns false", () => {
    expect(useGameStore.getState().equipItem("nonexistent")).toBe(false);
  });

  it("equipItem: locked slot kind returns false", () => {
    const palette: Item = {
      id: "p1",
      slot: "palette",
      tier: "normal",
      affixes: [{ kind: "+canvas_gold%", magnitude: 10 }],
    };
    useGameStore.setState({ inventory: [palette] });
    // palette slot not unlocked
    expect(useGameStore.getState().equipItem("p1")).toBe(false);
  });

  it("equipItem: success moves item from inventory to equipped[slot]", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    expect(useGameStore.getState().equipItem(sampleBrush.id)).toBe(true);
    expect(useGameStore.getState().inventory).toEqual([]);
    expect(useGameStore.getState().equipped.brush?.id).toBe(sampleBrush.id);
  });

  it("equipItem: replacing slot occupant returns previous to inventory", () => {
    const newBrush: Item = {
      id: "b2",
      slot: "brush",
      tier: "rare",
      affixes: [{ kind: "+canvas_gold%", magnitude: 9 }],
    };
    useGameStore.setState({
      inventory: [newBrush],
      equipped: { brush: sampleBrush },
    });
    expect(useGameStore.getState().equipItem("b2")).toBe(true);
    expect(useGameStore.getState().equipped.brush?.id).toBe("b2");
    // sampleBrush returned to inventory
    expect(useGameStore.getState().inventory.find((i) => i.id === sampleBrush.id)).toBeDefined();
  });

  it("unequipSlot: empty slot returns false", () => {
    expect(useGameStore.getState().unequipSlot("brush")).toBe(false);
  });

  it("unequipSlot: full inventory returns false", () => {
    useGameStore.setState({
      inventory: Array.from({ length: 3 }, (_, i) => ({
        id: `inv-${i}`,
        slot: "brush" as const,
        tier: "normal" as const,
        affixes: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
      })),
      equipped: { brush: sampleBrush },
    });
    expect(useGameStore.getState().unequipSlot("brush")).toBe(false);
  });

  it("unequipSlot: success moves item from equipped to inventory", () => {
    useGameStore.setState({ equipped: { brush: sampleBrush } });
    expect(useGameStore.getState().unequipSlot("brush")).toBe(true);
    expect(useGameStore.getState().equipped.brush).toBeUndefined();
    expect(useGameStore.getState().inventory[0]?.id).toBe(sampleBrush.id);
  });
});

describe("workshopSlice — discard", () => {
  beforeEach(freshState);

  it("discard removes the item from inventory by id", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    expect(useGameStore.getState().discard(sampleBrush.id)).toBe(true);
    expect(useGameStore.getState().inventory).toEqual([]);
  });

  it("discard returns false for unknown id", () => {
    expect(useGameStore.getState().discard("nonexistent")).toBe(false);
  });
});

describe("workshopSlice — resetWorkshop", () => {
  beforeEach(freshState);

  it("resets inventory + equipped + workshopXp to initial state, preserves workshopLevel", () => {
    useGameStore.setState({
      inventory: [sampleBrush],
      equipped: { brush: sampleBrush },
      workshopLevel: 25,
      workshopXp: 50,
    });
    useGameStore.getState().resetWorkshop();
    expect(useGameStore.getState().inventory).toEqual([]);
    expect(useGameStore.getState().equipped).toEqual({});
    // Workshop level survives ascend (it's a long-tail achievement, like skill tree).
    expect(useGameStore.getState().workshopLevel).toBe(25);
    expect(useGameStore.getState().workshopXp).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- "store/workshopSlice"`
Expected: FAIL.

- [ ] **Step 4: Replace `src/store/workshopSlice.ts`**

```ts
import type { StateCreator } from "zustand";
import {
  AFFIX_KINDS,
  MAX_INVENTORY_SLOTS,
  type AffixKind,
  type SlotKind,
} from "@/config/workshopAffixes";
import { big } from "@/core/bigNumber";
import { craftCost, xpToNext, MAX_WORKSHOP_LEVEL, XP_PER_CRAFT } from "@/core/balance";
import { rngPick } from "@/core/rng";
import { rollTier, rollAffixes } from "@/core/workshopRoll";
import type { ItemTier } from "@/core/workshopRoll";
import type { Affix } from "@/core/workshopRoll";
import type { GameStore } from "@/store";
import { getNodeLevel } from "@/store/skillTreeSlice";

export type { AffixKind, SlotKind } from "@/config/workshopAffixes";
export type { ItemTier, Affix } from "@/core/workshopRoll";

let _itemCounter = 0;
function nextItemId(): string {
  _itemCounter += 1;
  return `it-${Date.now().toString(36)}-${_itemCounter}`;
}

export interface Item {
  readonly id: string;
  readonly slot: SlotKind;
  readonly tier: ItemTier;
  readonly affixes: ReadonlyArray<Affix>;
}

export interface WorkshopState {
  readonly workshopLevel: number;
  readonly workshopXp: number;
  readonly inventory: ReadonlyArray<Item>;
  readonly equipped: Partial<Record<SlotKind, Item>>;
}

export const initialWorkshopState: WorkshopState = Object.freeze({
  workshopLevel: 1,
  workshopXp: 0,
  inventory: Object.freeze([]) as ReadonlyArray<Item>,
  equipped: Object.freeze({}) as Partial<Record<SlotKind, Item>>,
}) as WorkshopState;

export interface WorkshopSlice extends WorkshopState {
  craft: () => boolean;
  equipItem: (itemId: string) => boolean;
  unequipSlot: (slot: SlotKind) => boolean;
  discard: (itemId: string) => boolean;
  resetWorkshop: () => void;
}

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** List of slot kinds the player has unlocked. Always includes "brush". */
export const getUnlockedSlotKinds = (state: GameStore): ReadonlyArray<SlotKind> => {
  const out: SlotKind[] = ["brush"];
  if (getNodeLevel(state, "gear_up") > 0) out.push("palette");
  return out;
};

/** Total equip-slot capacity = number of unlocked slot kinds. */
export const getCurrentSlotCount = (state: GameStore): number =>
  getUnlockedSlotKinds(state).length;

/**
 * Sum the magnitude (as fraction) of equipped affixes matching the given kind,
 * walking every equipped item across all slot kinds.
 */
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

// ============================================================================
// Slice
// ============================================================================

export const createWorkshopSlice: StateCreator<GameStore, [], [], WorkshopSlice> = (set, get) => ({
  ...initialWorkshopState,

  craft: () => {
    const state = get();
    if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
    const cost = craftCost(state.workshopLevel);
    if (!state.spend("gold", cost)) return false;

    const unlocked = getUnlockedSlotKinds(state);
    const slot = rngPick(unlocked);
    const tier = rollTier(state.workshopLevel);
    const affixes = rollAffixes(tier);
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

  equipItem: (itemId) => {
    const state = get();
    const item = state.inventory.find((i) => i.id === itemId);
    if (!item) return false;
    if (!getUnlockedSlotKinds(state).includes(item.slot)) return false;

    set((s) => {
      const previous = s.equipped[item.slot];
      const inventory = s.inventory.filter((i) => i.id !== itemId);
      return {
        inventory: previous ? [...inventory, previous] : inventory,
        equipped: { ...s.equipped, [item.slot]: item },
      };
    });
    return true;
  },

  unequipSlot: (slot) => {
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

  discard: (itemId) => {
    const state = get();
    const exists = state.inventory.some((i) => i.id === itemId);
    if (!exists) return false;
    set((s) => ({
      inventory: s.inventory.filter((i) => i.id !== itemId),
    }));
    return true;
  },

  resetWorkshop: () =>
    set((s) => ({
      // Inventory + equipped wiped (they're run-state, like canvas tier).
      // Workshop level + XP survive ascend (long-tail meta, like skill tree).
      inventory: [],
      equipped: {},
      workshopLevel: s.workshopLevel,
      workshopXp: 0,
    })),
});
```

- [ ] **Step 5: Run workshopSlice tests**

Run: `npm test -- "store/workshopSlice"`
Expected: passing.

- [ ] **Step 6: Update fixture references in other test files**

`tests/core/multipliers.test.ts` — find every `equippedItems: [...]` setState call and convert. Example:

Old:
```ts
useGameStore.setState({
  equippedItems: [{ kind: "+canvas_gold%", magnitude: 5 }],
});
```

New:
```ts
useGameStore.setState({
  equipped: {
    brush: {
      id: "test-1",
      slot: "brush",
      tier: "normal",
      affixes: [{ kind: "+canvas_gold%", magnitude: 5 }],
    },
  },
});
```

Apply the same transformation across all tests in `tests/core/multipliers.test.ts`. Run `npm test -- "core/multipliers"` to find failures and fix until all pass.

`tests/systems/ascend.test.ts` — search for `inventory: [{...}]` and `equippedItems: [...]` setState calls. Convert similarly. Some tests may need to construct an explicit `Item` literal. Example:

Old:
```ts
useGameStore.setState({
  inventory: [{ kind: "+canvas_gold%", magnitude: 10 }],
  equippedItems: [{ kind: "-paint_time%", magnitude: 8 }],
});
```

New:
```ts
useGameStore.setState({
  inventory: [
    { id: "inv-1", slot: "brush", tier: "normal", affixes: [{ kind: "+canvas_gold%", magnitude: 10 }] },
  ],
  equipped: {
    brush: { id: "eq-1", slot: "brush", tier: "normal", affixes: [{ kind: "-paint_time%", magnitude: 8 }] },
  },
});
```

Then any assertion like `expect(s.equippedItems).toEqual([])` becomes `expect(s.equipped).toEqual({})`.

- [ ] **Step 7: Run multipliers + ascend tests**

```bash
npm test -- "core/multipliers"
npm test -- "systems/ascend"
```

Both should pass.

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean (or only errors in `WorkshopRoom.tsx` / `persistence-integration.test.ts` — fixed in T4 + T6).

- [ ] **Step 9: Commit**

```bash
git add src/config/workshopAffixes.ts src/store/workshopSlice.ts tests/store/workshopSlice.test.ts tests/core/multipliers.test.ts tests/systems/ascend.test.ts
git commit -m "workshop(slice): tiered items + slot kinds + level/xp + multi-affix"
```

---

### Task 4: Save migration v8 → v9

**Files:**
- Modify: `src/store/index.ts`
- Modify: `tests/store/persistence-integration.test.ts`

- [ ] **Step 1: Edit `src/store/index.ts`**

Bump SAVE_VERSION:

Find `const SAVE_VERSION = 8;` and replace with:

```ts
const SAVE_VERSION = 9;
```

Append to the migration chain (after the v7→v8 block):

```ts
  if (fromVersion < 9) {
    // v8 → v9 (2026-05-06): workshop rework. Items change shape (single-affix
    // → multi-affix). equippedItems array → equipped: Partial<Record<SlotKind, Item>>.
    // Game is unreleased; wipe inventory + equipped and initialize workshop level/xp.
    const { equippedItems: _ei, ...rest } = state;
    void _ei;
    state = {
      ...rest,
      inventory: [],
      equipped: {},
      workshopLevel: 1,
      workshopXp: 0,
    };
  }
```

Update the JSDoc above `migrate` — add a line to the chain documentation:

```
 * v8 → v9 (2026-05-06): workshop rework. Wipe inventory + equipped; initialize
 * workshopLevel=1, workshopXp=0.
```

- [ ] **Step 2: Update `tests/store/persistence-integration.test.ts`**

Find references to `equippedItems` and old item shape (`{ kind, magnitude }`). Replace:

```ts
// Old fixture:
equippedItems: [{ kind: "+canvas_gold%", magnitude: 10 }]
// New fixture:
equipped: {
  brush: { id: "p-1", slot: "brush", tier: "normal", affixes: [{ kind: "+canvas_gold%", magnitude: 10 }] },
}
```

Find any test asserting save version 8 — change to 9.

Add a new test verifying v8→v9 migration wipes inventory:

```ts
it("v8 → v9 migration: wipes inventory and equipped, initializes workshopLevel/Xp", () => {
  const v8State = {
    fame: { __big: "10" },
    gold: { __big: "100" },
    inventory: [{ kind: "+canvas_gold%", magnitude: 12 }],
    equippedItems: [{ kind: "-paint_time%", magnitude: 8 }],
    purchasedNodes: { gear_up: 1 },
    pokeTreeTimer: 0,
    pastRuns: [],
    canvasTier: 5,
    paintMastery: { __big: "100" },
    lifetimeGold: { __big: "10000" },
  };
  const result = migrate(v8State, 8);
  expect(result.inventory).toEqual([]);
  expect(result.equipped).toEqual({});
  expect(result.workshopLevel).toBe(1);
  expect(result.workshopXp).toBe(0);
  // preserved fields
  expect(result.purchasedNodes).toEqual({ gear_up: 1 });
});
```

- [ ] **Step 3: Run persistence tests**

Run: `npm test -- "persistence-integration"`
Expected: passing.

- [ ] **Step 4: Run full suite (skipping UI for now)**

```bash
npm test -- --exclude "components/painting/WorkshopRoom"
```

Expected: passing (UI still has old shape until T6).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: errors only in `WorkshopRoom.tsx` (fixed in T6).

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "workshop(save): SAVE_VERSION 8→9 wipes inventory + equipped; init workshopLevel/Xp"
```

---

### Task 5: Update `gear_up` skill-tree node

**Files:**
- Modify: `src/config/skillTreeDesign.json`

- [ ] **Step 1: Edit the `gear_up` entry**

Open `src/config/skillTreeDesign.json`. Find the node with `"id": "gear_up"`. Update the `name`, `description`, and `numericEffect` fields:

```json
{
  "id": "gear_up",
  "name": "Unlock Palette Slot",
  "description": "Unlocks a second equipment slot for palette items.",
  "numericEffect": "+1 palette slot",
  "parentIds": [
    "muscle_memory"
  ],
  "stacking": "additive",
  "kind": "minor",
  "maxLevel": 1,
  "costs": [
    100
  ],
  "position": null
}
```

(Keep `parentIds`, `stacking`, `kind`, `maxLevel`, `costs`, `position` as they are. Only change the three label fields.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/config/skillTreeDesign.json
git commit -m "designer(node): gear_up renamed to 'Unlock Palette Slot'"
```

---

# Phase C — UI

---

### Task 6: Rebuild `<WorkshopRoom>` for level + tiered items + per-slot equipped

**Files:**
- Modify: `src/components/painting/WorkshopRoom.tsx` (full rewrite)
- Modify: `src/components/painting/WorkshopRoom.module.css` (add tier color borders + level bar styles)
- Modify: `tests/components/painting/WorkshopRoom.test.tsx` (full rewrite)

- [ ] **Step 1: Replace `tests/components/painting/WorkshopRoom.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";
import type { Item } from "@/store/workshopSlice";

const sampleBrush: Item = {
  id: "test-brush-1",
  slot: "brush",
  tier: "magic",
  affixes: [
    { kind: "+canvas_gold%", magnitude: 12 },
    { kind: "-paint_time%", magnitude: 8 },
  ],
};

beforeEach(() => {
  useGameStore.setState({
    gold: big(0),
    inventory: [],
    equipped: {},
    workshopLevel: 1,
    workshopXp: 0,
    purchasedNodes: {},
  });
  setSeed(42);
});

describe("<WorkshopRoom />", () => {
  it("renders the workshop level header (Lv 1)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByText(/Lv\s*1/i)).toBeInTheDocument();
  });

  it("renders the XP progress (0 / 8 at L1)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByText(/0\s*\/\s*8/)).toBeInTheDocument();
  });

  it("renders craft button with current cost (100g at L1)", () => {
    render(<WorkshopRoom />);
    const btn = screen.getByTestId("craft-button");
    expect(btn).toHaveTextContent(/100/);
  });

  it("craft button disabled when gold insufficient", () => {
    useGameStore.setState({ gold: big(50) });
    render(<WorkshopRoom />);
    expect(screen.getByTestId("craft-button")).toBeDisabled();
  });

  it("craft button enabled when gold sufficient and inventory not full", () => {
    useGameStore.setState({ gold: big(200) });
    render(<WorkshopRoom />);
    expect(screen.getByTestId("craft-button")).not.toBeDisabled();
  });

  it("clicking craft adds an item to inventory", () => {
    useGameStore.setState({ gold: big(200) });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByTestId("craft-button"));
    expect(useGameStore.getState().inventory.length).toBe(1);
  });

  it("inventory item card shows tier label + slot kind badge + affix list", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    expect(screen.getByText(/magic/i)).toBeInTheDocument();
    expect(screen.getByText(/brush/i)).toBeInTheDocument();
    expect(screen.getByText(/\+canvas_gold%.*12/i)).toBeInTheDocument();
    expect(screen.getByText(/-paint_time%.*8/i)).toBeInTheDocument();
  });

  it("inventory item has data-tier matching its tier", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    expect(screen.getByTestId(`inventory-item-${sampleBrush.id}`)).toHaveAttribute("data-tier", "magic");
  });

  it("equipped panel shows one row per unlocked slot kind (only 'brush' default)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByTestId("slot-brush")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-palette")).not.toBeInTheDocument();
  });

  it("equipped panel shows palette slot when gear_up purchased", () => {
    useGameStore.setState({ purchasedNodes: { gear_up: 1 } });
    render(<WorkshopRoom />);
    expect(screen.getByTestId("slot-palette")).toBeInTheDocument();
  });

  it("clicking an inventory item with matching slot equips it", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByTestId(`inventory-equip-${sampleBrush.id}`));
    expect(useGameStore.getState().equipped.brush?.id).toBe(sampleBrush.id);
  });

  it("clicking an equipped slot unequips that slot", () => {
    useGameStore.setState({ equipped: { brush: sampleBrush } });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByTestId("slot-unequip-brush"));
    expect(useGameStore.getState().equipped.brush).toBeUndefined();
  });

  it("discarding an inventory item removes it", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByTestId(`inventory-discard-${sampleBrush.id}`));
    expect(useGameStore.getState().inventory).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "WorkshopRoom"`
Expected: FAIL.

- [ ] **Step 3: Replace `src/components/painting/WorkshopRoom.tsx`**

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { craftCost, xpToNext } from "@/core/balance";
import { MAX_INVENTORY_SLOTS } from "@/config/workshopAffixes";
import { getUnlockedSlotKinds } from "@/store/workshopSlice";
import { formatBig } from "@/core/formatter";
import type { Item, SlotKind, ItemTier } from "@/store/workshopSlice";
import styles from "./WorkshopRoom.module.css";

const TIER_LABEL: Record<ItemTier, string> = {
  normal: "Normal",
  magic: "Magic",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function WorkshopRoom(): JSX.Element {
  const inventory = useGameStore((s) => s.inventory);
  const equipped = useGameStore((s) => s.equipped);
  const gold = useGameStore((s) => s.gold);
  const workshopLevel = useGameStore((s) => s.workshopLevel);
  const workshopXp = useGameStore((s) => s.workshopXp);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const craft = useGameStore((s) => s.craft);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipSlot = useGameStore((s) => s.unequipSlot);
  const discard = useGameStore((s) => s.discard);

  const helperState = { purchasedNodes } as unknown as GameStore;
  const unlockedSlots = getUnlockedSlotKinds(helperState);
  const cost = craftCost(workshopLevel);
  const xpMax = xpToNext(workshopLevel);
  const xpPct = Math.max(0, Math.min(100, (workshopXp / xpMax) * 100));

  const canCraft = gold.gte(cost) && inventory.length < MAX_INVENTORY_SLOTS;

  return (
    <section className={styles.room} aria-label="Workshop room">
      <header className={styles.header}>
        <h2 className={styles.title}>Workshop</h2>
        <div className={styles.levelStrip}>
          <span className={styles.levelLabel}>Lv {workshopLevel}</span>
          <div className={styles.xpBar}>
            <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
          </div>
          <span className={styles.xpReadout}>
            {workshopXp} / {xpMax}
          </span>
        </div>
      </header>

      <section className={styles.craftStation}>
        <button
          type="button"
          className={styles.craftBtn}
          disabled={!canCraft}
          onClick={() => craft()}
          data-testid="craft-button"
        >
          Craft · {formatBig(cost)} g
        </button>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Equipped{" "}
          <span className={styles.count}>
            {Object.keys(equipped).length}/{unlockedSlots.length}
          </span>
        </div>
        <ul className={styles.list}>
          {unlockedSlots.map((slot) => (
            <li key={slot} className={styles.row} data-testid={`slot-${slot}`}>
              {equipped[slot] ? (
                <button
                  type="button"
                  className={styles.itemBtn}
                  data-tier={equipped[slot]!.tier}
                  onClick={() => unequipSlot(slot)}
                  data-testid={`slot-unequip-${slot}`}
                >
                  <span className={styles.tierTag}>{TIER_LABEL[equipped[slot]!.tier]}</span>
                  <span className={styles.slotBadge}>{slot}</span>
                  <ItemAffixList affixes={equipped[slot]!.affixes} />
                </button>
              ) : (
                <div className={styles.emptySlot}>Empty {slot} slot</div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Inventory <span className={styles.count}>{inventory.length}/{MAX_INVENTORY_SLOTS}</span>
        </div>
        {inventory.length === 0 ? (
          <div className={styles.empty}>Empty — click Craft to roll an item.</div>
        ) : (
          <ul className={styles.list}>
            {inventory.map((item) => (
              <li
                key={item.id}
                className={styles.row}
                data-testid={`inventory-item-${item.id}`}
                data-tier={item.tier}
              >
                <button
                  type="button"
                  className={styles.itemBtn}
                  data-tier={item.tier}
                  onClick={() => equipItem(item.id)}
                  data-testid={`inventory-equip-${item.id}`}
                >
                  <span className={styles.tierTag}>{TIER_LABEL[item.tier]}</span>
                  <span className={styles.slotBadge}>{item.slot}</span>
                  <ItemAffixList affixes={item.affixes} />
                </button>
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => discard(item.id)}
                  data-testid={`inventory-discard-${item.id}`}
                  aria-label={`Discard ${item.id}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function ItemAffixList({ affixes }: { affixes: Item["affixes"] }): JSX.Element {
  return (
    <ul className={styles.affixList}>
      {affixes.map((a, i) => (
        <li key={i} className={styles.affixRow}>
          {a.kind} {a.magnitude}%
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Append CSS to `src/components/painting/WorkshopRoom.module.css`**

Add at the end of the existing CSS file:

```css
/* ============================================================================
   v3 — workshop level + tiered items
   ========================================================================= */

.levelStrip {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}

.levelLabel {
  font-weight: 700;
  color: var(--gold);
}

.xpBar {
  flex: 1;
  height: 4px;
  background: var(--bg-stone-d);
  border-radius: 2px;
  overflow: hidden;
}

.xpFill {
  height: 100%;
  background: var(--inspi);
  transition: width 200ms ease;
}

.xpReadout {
  color: var(--ink-3);
  font-size: 10px;
}

.tierTag {
  font-family: var(--mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.slotBadge {
  font-family: var(--mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 4px;
  border: 1px solid var(--ink-line);
  border-radius: 2px;
  color: var(--ink-3);
  background: var(--bg-stone-d);
}

.affixList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.affixRow {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-1);
}

.itemBtn[data-tier="normal"] {
  border-color: rgba(180, 180, 180, 0.6);
}

.itemBtn[data-tier="magic"] {
  border-color: rgba(100, 150, 255, 0.7);
}

.itemBtn[data-tier="rare"] {
  border-color: rgba(255, 216, 106, 0.8);
}

.itemBtn[data-tier="epic"] {
  border-color: rgba(155, 108, 214, 0.9);
}

.itemBtn[data-tier="legendary"] {
  border-color: rgba(255, 145, 60, 1);
  box-shadow: 0 0 8px rgba(255, 145, 60, 0.5);
}

.emptySlot {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
  font-style: italic;
  padding: var(--s-2);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "WorkshopRoom"`
Expected: 13 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: all passing.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean (only pre-existing main.tsx warning).

- [ ] **Step 8: Commit**

```bash
git add src/components/painting/WorkshopRoom.tsx src/components/painting/WorkshopRoom.module.css tests/components/painting/WorkshopRoom.test.tsx
git commit -m "workshop(ui): level header + tiered item cards + per-slot equipped panel"
```

---

# Phase D — Verify

---

### Task 7: Final verify + smoke + push

This task makes no code changes (other than HANDOVER if you choose).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Capture pass count. Expected: ~571-580 (was 539; +30-40 from new workshop tests).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Capture gzipped sizes. Expected: ~5-10 KB JS increase from new workshop logic.

- [ ] **Step 4: Smoke check via dev server**

```bash
npm run dev &
DEV_PID=$!
sleep 4
curl -s -o /dev/null -w "Painting: HTTP %{http_code}\n" http://localhost:5173/painting
kill $DEV_PID 2>/dev/null || true
```

Expected: HTTP 200.

- [ ] **Step 5: Manual UI test (optional)**

Open `http://localhost:5173/painting` in a browser. Verify:
- Workshop header shows `Lv 1 · 0/8` with empty progress bar
- Craft button shows `Craft · 100 g`, disabled at 0 gold
- After grinding canvas to ~200 gold, click Craft — XP advances, item appears in inventory with tier label + slot badge + affix list
- After 8 crafts (or 7 if XP overflowed), level ticks to 2, cost grows
- Click an inventory item → equipped to its slot
- Click an equipped slot → unequipped back to inventory
- Click ✕ on an inventory item → discarded

- [ ] **Step 6: Update `docs/HANDOVER.md`**

Add a new top entry:

```markdown
## v3.1 — Workshop leveling + tiered items (shipped on `main`)

**Status:** Shipped. Workshop now levels via 1 XP per craft. Items have a tier
(Normal..Legendary) determining affix count (1..5). Slot kinds (brush, palette)
gate inventory rolls and are unlocked via skill-tree fame nodes.

### What landed

- Workshop state: `workshopLevel`, `workshopXp`, `equipped: Partial<Record<SlotKind, Item>>`.
- Item shape: `{ id, slot, tier, affixes: Affix[] }` (was single-affix).
- Craft cost: piecewise growth (1.05 below L5, 1.20 above). L70 = 21M g, L100 = 5B g.
- XP curve: `4 * (level + 1)` per level. L70 reached at ~9,936 crafts.
- Tier probabilities: hard gates with linear interp from unlock to L100. Legendary 0.01% at L70, 1% at L100.
- Affix magnitudes: flat 5–15% per affix; future skill-tree nodes can boost magnitude at read time.
- `gear_up` skill-tree node renamed to "Unlock Palette Slot" — purchase enables palette items to roll + equip.
- Save migration v8 → v9 wipes inventory + equipped (game unreleased).

### Tests + build

- {NN} tests passing.
- Bundle: {NN} KB gzipped.

### Next

Skill-tree nodes for affix magnitude bonus, legendary chance bonus, inventory size, etc. (designer-driven; no engine changes needed for read-time bonuses to slot in).
```

Replace `{NN}` with actual values.

- [ ] **Step 7: Commit + push**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): v3.1 workshop leveling shipped"
git push origin main
```

- [ ] **Step 8: Report**

- Status: DONE
- Test count
- Bundle sizes
- HEAD SHA

---

## Spec coverage check (self-review)

| Spec section / decision | Task |
|---|---|
| Workshop levels via XP per craft | T3 (slice) |
| Hard tier gates with thresholds | T2 (workshopRoll) |
| Skill-tree unlocks slot kinds (gear_up → palette) | T3 (getUnlockedSlotKinds) + T5 (rename) |
| Flat 5–15% magnitudes; skill-tree multipliers at read time | T2 (rollAffixes) + existing core/multipliers.ts unchanged |
| Duplicate affix kinds allowed | T2 (rollAffixes uses independent picks) |
| Single random craft button | T3 (craft action) + T6 (UI) |
| Cost piecewise growth (1.05 below L5, 1.20 above) | T1 (craftCost) |
| XP per craft = 1; xpToNext = 4*(L+1); L70 ≈ 10k crafts | T1 (xpToNext) + T3 (craft awards XP) |
| Tier prob shape: linear interp from (unlock, min) to (100, max) | T2 (computeTierProbabilities) |
| New Item shape with id/slot/tier/affixes | T3 (slice rewrite) |
| Equipped per-slot-kind shape | T3 (equipItem/unequipSlot/equipped record) |
| Save migration v8 → v9 wipes inventory + equipped | T4 |
| Workshop level survives ascend (not in resetWorkshop) | T3 (resetWorkshop preserves workshopLevel) |
| UI: level header + XP bar + tiered item cards + per-slot equipped panel | T6 |
| Affix magnitude flowing through getEquippedContribution unchanged | T3 (getEquippedContribution body update only) |

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders.
- ✅ Test code given for every TDD step; impl code given for every implementation step.
- ✅ Type signatures consistent: `Item`, `SlotKind`, `ItemTier`, `Affix` defined in T2-T3 and consumed in T6 + tests.
- ✅ Each task is bite-sized.
- ✅ All cascading test fixture updates explicitly listed (T3 step 6 + T4 step 2).
- ✅ T3 splits the heavy slice rewrite across multiple steps but keeps it one task because the changes are tightly coupled.

---

**End of plan.**
