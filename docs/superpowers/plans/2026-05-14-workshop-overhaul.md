# Workshop Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Workshop with tier-scaled XP, tier-scaled affix magnitudes, a fusion mechanic, three new equipment slots, and a PoE-style square-grid UI.

**Architecture:** Six sequential tasks — tuning constants first, then data model changes (Item + migration), then the fusion logic on top, then the UI last. Tasks 1–3 are pure data/logic changes with no UI impact. Task 4 adds fuseCount to Item and bumps the save version. Task 5 adds the fusion selector and action. Task 6 rewrites WorkshopRoom.tsx to consume everything.

**Tech Stack:** TypeScript strict, Zustand 5, Vitest, Tailwind 4 / CSS Modules, break_eternity.js (Big).

---

### Task 1: Tier unlock levels + tier-scaled XP

**Files:**
- Modify: `src/core/workshopRoll.ts` — lower `TIER_UNLOCK_LEVEL`, add `TIER_XP`
- Modify: `src/store/workshopSlice.ts` — use `TIER_XP[item.tier]` instead of `XP_PER_CRAFT`
- Modify: `src/core/balance.ts` — remove `XP_PER_CRAFT`
- Modify: `tests/core/workshopRoll.test.ts` — update unlock threshold assertions + add TIER_XP test

- [ ] **Step 1: Write the failing tests**

In `tests/core/workshopRoll.test.ts`, replace the `"unlock thresholds match spec"` test and add a TIER_XP test. Also update the tests that check old unlock values:

```typescript
// Replace the "unlock thresholds match spec" test:
it("unlock thresholds match spec", () => {
  expect(TIER_UNLOCK_LEVEL.normal).toBe(1);
  expect(TIER_UNLOCK_LEVEL.magic).toBe(3);
  expect(TIER_UNLOCK_LEVEL.rare).toBe(8);
  expect(TIER_UNLOCK_LEVEL.epic).toBe(20);
  expect(TIER_UNLOCK_LEVEL.legendary).toBe(40);
});

// Replace "at level 5: magic just unlocks at min prob 0.01":
it("at level 3: magic just unlocks at min prob 0.01", () => {
  const probs = computeTierProbabilities(3);
  expect(probs.magic).toBeCloseTo(0.01, 4);
  expect(probs.rare).toBe(0);
  expect(probs.normal).toBeCloseTo(0.99, 4);
});

// Replace "a tier is 0 below its unlock level":
it("a tier is 0 below its unlock level", () => {
  expect(computeTierProbabilities(2).magic).toBe(0);
  expect(computeTierProbabilities(7).rare).toBe(0);
  expect(computeTierProbabilities(19).epic).toBe(0);
  expect(computeTierProbabilities(39).legendary).toBe(0);
});

// Replace the "legendary at L70" test:
it("at L40 (legendary first unlock) prob is ~0.01%; at L70 prob is much higher", () => {
  setSeed(42);
  let legAt40 = 0;
  let legAt70 = 0;
  for (let i = 0; i < 100_000; i++) {
    if (rollTier(40) === "legendary") legAt40++;
    if (rollTier(70) === "legendary") legAt70++;
  }
  expect(legAt40).toBeLessThanOrEqual(100);
  expect(legAt70).toBeGreaterThan(100);
});

// Add TIER_XP import at top: import { TIER_XP, TIER_UNLOCK_LEVEL, ... } from "@/core/workshopRoll";

// Add this new test in the "constants" describe block:
it("TIER_XP has correct values per tier", () => {
  expect(TIER_XP.normal).toBe(1);
  expect(TIER_XP.magic).toBe(2);
  expect(TIER_XP.rare).toBe(3);
  expect(TIER_XP.epic).toBe(4);
  expect(TIER_XP.legendary).toBe(5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run tests/core/workshopRoll.test.ts
```

Expected: failures on `TIER_UNLOCK_LEVEL.magic` (was 5, expected 3) and `TIER_XP` not defined.

- [ ] **Step 3: Implement — update `src/core/workshopRoll.ts`**

Change `TIER_UNLOCK_LEVEL`:
```typescript
export const TIER_UNLOCK_LEVEL: Record<ItemTier, number> = {
  normal: 1,
  magic: 3,
  rare: 8,
  epic: 20,
  legendary: 40,
};
```

Add `TIER_XP` after `TIER_AFFIX_COUNT`:
```typescript
export const TIER_XP: Record<ItemTier, number> = {
  normal: 1,
  magic: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};
```

- [ ] **Step 4: Implement — update `src/store/workshopSlice.ts`**

Change the import from `@/core/balance`:
```typescript
import { craftCost, xpToNext, MAX_WORKSHOP_LEVEL } from "@/core/balance";
```
(Remove `XP_PER_CRAFT` from the import.)

Add import of `TIER_XP` from workshopRoll:
```typescript
import { rollTier, rollAffixes, TIER_XP } from "@/core/workshopRoll";
```

Inside the `set` callback in `performCraft`, change:
```typescript
let newXp = s.workshopXp + TIER_XP[item.tier];
```

- [ ] **Step 5: Implement — update `src/core/balance.ts`**

Delete the line:
```typescript
export const XP_PER_CRAFT = 1;
```

- [ ] **Step 6: Run tests**

```
npx vitest run tests/core/workshopRoll.test.ts tests/store/workshopSlice.test.ts
```

Expected: all pass. The existing `"grants 1 XP"` and `"levels up when XP threshold reached"` tests still pass because at workshop level 1 only normal tier is possible, so `TIER_XP[normal] = 1` — identical behaviour to the old constant.

- [ ] **Step 7: Commit**

```
git add src/core/workshopRoll.ts src/store/workshopSlice.ts src/core/balance.ts tests/core/workshopRoll.test.ts
git commit -m "core(workshop): tier unlock levels 1/3/8/20/40; tier-scaled XP 1-5"
```

---

### Task 2: Tier-scaled affix magnitude ranges

**Files:**
- Modify: `src/config/workshopAffixes.ts` — reshape `AFFIX_MAGNITUDE_RANGE` to `Record<ItemTier, Record<AffixKind, {min, max}>>`
- Modify: `src/core/workshopRoll.ts` — update `rollAffixes` to look up `AFFIX_MAGNITUDE_RANGE[tier][kind]`
- Modify: `tests/config/workshopAffixes.test.ts` — update magnitude range tests
- Modify: `tests/core/workshopRoll.test.ts` — update affix range assertion

- [ ] **Step 1: Write the failing tests**

In `tests/config/workshopAffixes.test.ts`, replace the two magnitude tests:

```typescript
import { ALL_ITEM_TIERS } from "@/core/workshopRoll";

// Replace "AFFIX_MAGNITUDE_RANGE has all 5 kinds with valid bounds":
it("AFFIX_MAGNITUDE_RANGE: every tier has all 5 kinds with valid bounds (min < max, all > 0)", () => {
  for (const tier of ALL_ITEM_TIERS) {
    for (const kind of AFFIX_KINDS) {
      const range = AFFIX_MAGNITUDE_RANGE[tier][kind];
      expect(range).toBeDefined();
      expect(range.min).toBeGreaterThan(0);
      expect(range.max).toBeGreaterThan(0);
      expect(range.min).toBeLessThan(range.max);
    }
  }
});

// Replace "AFFIX_MAGNITUDE_RANGE has the spec bounds":
it("AFFIX_MAGNITUDE_RANGE: normal tier matches base ranges", () => {
  expect(AFFIX_MAGNITUDE_RANGE.normal["+sell_price%"]).toEqual({ min: 5, max: 15 });
  expect(AFFIX_MAGNITUDE_RANGE.normal["+speed%"]).toEqual({ min: 5, max: 15 });
  expect(AFFIX_MAGNITUDE_RANGE.normal["+size%"]).toEqual({ min: 5, max: 15 });
  expect(AFFIX_MAGNITUDE_RANGE.normal["+crit_chance%"]).toEqual({ min: 2, max: 8 });
  expect(AFFIX_MAGNITUDE_RANGE.normal["+combo_chance%"]).toEqual({ min: 5, max: 20 });
});

it("AFFIX_MAGNITUDE_RANGE: each tier has strictly higher bounds than the previous tier", () => {
  const tiers = ALL_ITEM_TIERS;
  for (let i = 1; i < tiers.length; i++) {
    for (const kind of AFFIX_KINDS) {
      expect(AFFIX_MAGNITUDE_RANGE[tiers[i]!][kind].min)
        .toBeGreaterThan(AFFIX_MAGNITUDE_RANGE[tiers[i - 1]!][kind].min);
      expect(AFFIX_MAGNITUDE_RANGE[tiers[i]!][kind].max)
        .toBeGreaterThan(AFFIX_MAGNITUDE_RANGE[tiers[i - 1]!][kind].max);
    }
  }
});

it("AFFIX_MAGNITUDE_RANGE: legendary sell_price range matches spec (38–56)", () => {
  expect(AFFIX_MAGNITUDE_RANGE.legendary["+sell_price%"]).toEqual({ min: 38, max: 56 });
});
```

In `tests/core/workshopRoll.test.ts`, update the affix range assertion in `"each affix has a kind from AFFIX_KINDS and magnitude within that kind's range"`:

```typescript
it("each affix has a kind from AFFIX_KINDS and magnitude within that tier's range", () => {
  const affixes = rollAffixes("legendary", baseStub());
  for (const a of affixes) {
    expect(["+sell_price%", "+speed%", "+crit_chance%", "+combo_chance%", "+size%"]).toContain(a.kind);
    const range = AFFIX_MAGNITUDE_RANGE["legendary"][a.kind];
    expect(a.magnitude).toBeGreaterThanOrEqual(range.min);
    expect(a.magnitude).toBeLessThanOrEqual(range.max);
  }
});
```

Also add import of `ALL_ITEM_TIERS` to `tests/config/workshopAffixes.test.ts`:
```typescript
import { ALL_ITEM_TIERS } from "@/core/workshopRoll";
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run tests/config/workshopAffixes.test.ts tests/core/workshopRoll.test.ts
```

Expected: failures on `AFFIX_MAGNITUDE_RANGE[tier]` being undefined (still flat structure).

- [ ] **Step 3: Implement — update `src/config/workshopAffixes.ts`**

`import type` is erased at runtime so the circular reference (workshopAffixes ↔ workshopRoll) is safe for TypeScript and Vite:

```typescript
import type { ItemTier } from "@/core/workshopRoll";
```

Replace `AFFIX_MAGNITUDE_RANGE`:

```typescript
export const AFFIX_MAGNITUDE_RANGE: Record<ItemTier, Record<AffixKind, { min: number; max: number }>> = {
  normal: {
    "+sell_price%": { min: 5,  max: 15 },
    "+speed%":      { min: 5,  max: 15 },
    "+size%":       { min: 5,  max: 15 },
    "+crit_chance%":  { min: 2,  max: 8  },
    "+combo_chance%": { min: 5,  max: 20 },
  },
  magic: {
    "+sell_price%": { min: 10, max: 20 },
    "+speed%":      { min: 10, max: 20 },
    "+size%":       { min: 10, max: 20 },
    "+crit_chance%":  { min: 5,  max: 12 },
    "+combo_chance%": { min: 10, max: 25 },
  },
  rare: {
    "+sell_price%": { min: 16, max: 28 },
    "+speed%":      { min: 16, max: 28 },
    "+size%":       { min: 16, max: 28 },
    "+crit_chance%":  { min: 9,  max: 17 },
    "+combo_chance%": { min: 16, max: 32 },
  },
  epic: {
    "+sell_price%": { min: 25, max: 40 },
    "+speed%":      { min: 25, max: 40 },
    "+size%":       { min: 25, max: 40 },
    "+crit_chance%":  { min: 14, max: 24 },
    "+combo_chance%": { min: 24, max: 42 },
  },
  legendary: {
    "+sell_price%": { min: 38, max: 56 },
    "+speed%":      { min: 38, max: 56 },
    "+size%":       { min: 38, max: 56 },
    "+crit_chance%":  { min: 21, max: 34 },
    "+combo_chance%": { min: 36, max: 56 },
  },
};
```

- [ ] **Step 4: Implement — update `src/core/workshopRoll.ts`**

In `rollAffixes`, change the range lookup from:
```typescript
const range = AFFIX_MAGNITUDE_RANGE[kind];
```
to:
```typescript
const range = AFFIX_MAGNITUDE_RANGE[tier][kind];
```

- [ ] **Step 5: Run tests**

```
npx vitest run tests/config/workshopAffixes.test.ts tests/core/workshopRoll.test.ts tests/store/workshopSlice.test.ts
```

Expected: all pass.

The `"Craftsmanship Lv 5 shifts affix magnitudes by +25 pp"` test still passes: at workshop level 1 only normal tier is possible; normal tier crit range is [2,8]; +25 bonus → [27,33]; minimum across all kinds is 27, matching the assertion.

- [ ] **Step 6: Commit**

```
git add src/config/workshopAffixes.ts src/core/workshopRoll.ts tests/config/workshopAffixes.test.ts tests/core/workshopRoll.test.ts
git commit -m "core(workshop): tier-scaled affix magnitude ranges (normal 5–15 → legendary 38–56)"
```

---

### Task 3: New slot kinds + fame nodes

**Files:**
- Modify: `src/config/workshopAffixes.ts` — add `"hat" | "apron" | "boots"` to `SlotKind`, update `ALL_SLOT_KINDS`
- Modify: `src/store/workshopSlice.ts` — extend `getUnlockedSlotKinds`
- Modify: `src/config/skillTreeDesign.json` — add 3 new nodes
- Modify: `tests/store/workshopSlice.test.ts` — extend slot unlock tests

- [ ] **Step 1: Write the failing tests**

In `tests/store/workshopSlice.test.ts`, add three new tests after the existing slot tests:

```typescript
it("getUnlockedSlotKinds: includes 'hat' when painters_hat purchased", () => {
  useGameStore.setState({ purchasedNodes: { painters_hat: 1 } });
  expect(getUnlockedSlotKinds(useGameStore.getState())).toContain("hat");
});

it("getUnlockedSlotKinds: includes 'apron' when painters_apron purchased", () => {
  useGameStore.setState({ purchasedNodes: { painters_apron: 1 } });
  expect(getUnlockedSlotKinds(useGameStore.getState())).toContain("apron");
});

it("getUnlockedSlotKinds: includes 'boots' when painters_boots purchased", () => {
  useGameStore.setState({ purchasedNodes: { painters_boots: 1 } });
  expect(getUnlockedSlotKinds(useGameStore.getState())).toContain("boots");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run tests/store/workshopSlice.test.ts
```

Expected: `"hat" | "apron" | "boots"` are not valid SlotKind values — TS error, or `toContain` fails.

- [ ] **Step 3: Implement — update `src/config/workshopAffixes.ts`**

```typescript
export type SlotKind = "brush" | "palette" | "easel" | "hat" | "apron" | "boots";

export const ALL_SLOT_KINDS: ReadonlyArray<SlotKind> = [
  "brush", "palette", "easel", "hat", "apron", "boots",
];
```

- [ ] **Step 4: Implement — update `src/store/workshopSlice.ts`**

```typescript
export const getUnlockedSlotKinds = (state: GameStore): ReadonlyArray<SlotKind> => {
  const out: SlotKind[] = ["brush"];
  if (getNodeLevel(state, "gear_up") > 0)       out.push("palette");
  if (getNodeLevel(state, "forget_pain") > 0)    out.push("easel");
  if (getNodeLevel(state, "painters_hat") > 0)   out.push("hat");
  if (getNodeLevel(state, "painters_apron") > 0) out.push("apron");
  if (getNodeLevel(state, "painters_boots") > 0) out.push("boots");
  return out;
};
```

- [ ] **Step 5: Implement — update `src/config/skillTreeDesign.json`**

Add three nodes to the `"nodes"` array. Insert them near the existing workshop nodes (after `forget_pain`):

```json
{
  "id": "painters_hat",
  "name": "Painter's Hat",
  "description": "Unlock the Hat equipment slot.",
  "numericEffect": "+1 hat slot",
  "parentIds": ["gear_up"],
  "stacking": "additive",
  "kind": "major",
  "maxLevel": 1,
  "costs": [200],
  "unlocks": [],
  "position": null
},
{
  "id": "painters_apron",
  "name": "Painter's Apron",
  "description": "Unlock the Apron equipment slot.",
  "numericEffect": "+1 apron slot",
  "parentIds": ["gear_up"],
  "stacking": "additive",
  "kind": "major",
  "maxLevel": 1,
  "costs": [200],
  "unlocks": [],
  "position": null
},
{
  "id": "painters_boots",
  "name": "Painter's Boots",
  "description": "Unlock the Boots equipment slot.",
  "numericEffect": "+1 boots slot",
  "parentIds": ["forget_pain"],
  "stacking": "additive",
  "kind": "major",
  "maxLevel": 1,
  "costs": [200],
  "unlocks": [],
  "position": null
}
```

- [ ] **Step 6: Run tests**

```
npx vitest run tests/store/workshopSlice.test.ts
```

Expected: all pass including the 3 new tests.

- [ ] **Step 7: Run full suite**

```
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```
git add src/config/workshopAffixes.ts src/store/workshopSlice.ts src/config/skillTreeDesign.json tests/store/workshopSlice.test.ts
git commit -m "feat(workshop): hat/apron/boots slot kinds + painters_hat/apron/boots fame nodes"
```

---

### Task 4: Item data model (`fuseCount`) + save migration v14 → v15

**Files:**
- Modify: `src/store/workshopSlice.ts` — add `fuseCount: number` to `Item`; initialize to 0 in `performCraft`
- Modify: `src/store/index.ts` — bump `SAVE_VERSION` to 15, add migration block
- Modify: `tests/store/workshopSlice.test.ts` — add `fuseCount: 0` to all inline `Item` fixtures
- Modify: `tests/store/persistence-integration.test.ts` — add v14→v15 migration test

- [ ] **Step 1: Write the failing migration test**

In `tests/store/persistence-integration.test.ts`, add at the end:

```typescript
describe("save migration v14 → v15 (fuseCount on items)", () => {
  it("v14 → v15: adds fuseCount: 0 to inventory items and equipped items", () => {
    const v14Save = {
      inventory: [
        { id: "it-1", slot: "brush", tier: "magic", affixes: [{ kind: "+sell_price%", magnitude: 10 }] },
        { id: "it-2", slot: "palette", tier: "rare", affixes: [{ kind: "+speed%", magnitude: 7 }] },
      ],
      equipped: {
        brush: { id: "it-3", slot: "brush", tier: "normal", affixes: [{ kind: "+speed%", magnitude: 5 }] },
      },
      gold: big(500),
      workshopLevel: 3,
      workshopXp: 5,
    };
    const migrated = migrate(v14Save, 14) as unknown as Record<string, unknown>;
    const inv = migrated.inventory as Array<Record<string, unknown>>;
    expect(inv[0]!.fuseCount).toBe(0);
    expect(inv[1]!.fuseCount).toBe(0);
    const eq = migrated.equipped as Record<string, Record<string, unknown>>;
    expect(eq.brush!.fuseCount).toBe(0);
    // Other fields preserved
    expect(migrated.workshopLevel).toBe(3);
    expect((migrated.gold as { toString: () => string }).toString()).toBe("500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run tests/store/persistence-integration.test.ts
```

Expected: fails — `SAVE_VERSION` is still 14 so `fromVersion < 15` block doesn't exist.

- [ ] **Step 3: Implement — update `Item` interface in `src/store/workshopSlice.ts`**

```typescript
export interface Item {
  readonly id: string;
  readonly slot: SlotKind;
  readonly tier: ItemTier;
  readonly affixes: ReadonlyArray<Affix>;
  readonly fuseCount: number;
}
```

In `performCraft`, add `fuseCount: 0` to the item literal:

```typescript
const item: Item = {
  id: nextItemId(),
  slot,
  tier,
  affixes,
  fuseCount: 0,
};
```

- [ ] **Step 4: Fix TypeScript errors — update Item fixtures in `tests/store/workshopSlice.test.ts`**

Every inline `Item` object (not via `craft()`) needs `fuseCount: 0`. There are several in the file. Update each one:

```typescript
// sampleBrush (line ~23):
const sampleBrush: Item = {
  id: "test-brush-1",
  slot: "brush",
  tier: "magic",
  affixes: [
    { kind: "+sell_price%", magnitude: 12 },
    { kind: "+speed%", magnitude: 8 },
  ],
  fuseCount: 0,
};

// palette (line ~78):
const palette: Item = {
  id: "test-palette-1",
  slot: "palette",
  tier: "rare",
  affixes: [{ kind: "+sell_price%", magnitude: 7 }],
  fuseCount: 0,
};

// itemWithDupes (line ~90):
const itemWithDupes: Item = {
  id: "test-dupes",
  slot: "brush",
  tier: "rare",
  affixes: [
    { kind: "+sell_price%", magnitude: 10 },
    { kind: "+sell_price%", magnitude: 5 },
    { kind: "+speed%", magnitude: 6 },
  ],
  fuseCount: 0,
};

// All Array.from Item objects in "returns false when inventory is full",
// "shredder: when inventory full", "no shredder + full inventory" tests:
// Add fuseCount: 0 to each inline item.
// Example pattern in those tests:
inventory: Array.from({ length: 3 }, (_, i) => ({
  id: `pre-${i}`,
  slot: "brush" as const,
  tier: "normal" as const,
  affixes: [{ kind: "+sell_price%" as const, magnitude: 10 }],
  fuseCount: 0,
})),
```

- [ ] **Step 5: Implement — update `src/store/index.ts`**

Change `SAVE_VERSION`:
```typescript
const SAVE_VERSION = 15;
```

Add the migration comment (JSDoc block at top of the migration comments):
```
 * v14 → v15 (2026-05-14): Workshop overhaul — Item gains fuseCount. Default 0
 * for all items in inventory and equipped. All other slices preserved.
```

Add migration block inside the `migrate` function, after the `if (fromVersion < 14)` block:

```typescript
if (fromVersion < 15) {
  const addFuseCount = (item: unknown): unknown => {
    if (item && typeof item === "object") {
      return { fuseCount: 0, ...(item as object) };
    }
    return item;
  };
  if (Array.isArray(state.inventory)) {
    state = { ...state, inventory: (state.inventory as unknown[]).map(addFuseCount) };
  }
  const equipped = state.equipped as Record<string, unknown> | undefined;
  if (equipped && typeof equipped === "object") {
    const fixedEquipped: Record<string, unknown> = {};
    for (const [slot, item] of Object.entries(equipped)) {
      fixedEquipped[slot] = addFuseCount(item);
    }
    state = { ...state, equipped: fixedEquipped };
  }
}
```

- [ ] **Step 6: Run tests**

```
npx vitest run tests/store/workshopSlice.test.ts tests/store/persistence-integration.test.ts
```

Expected: all pass.

- [ ] **Step 7: Run full suite + type check**

```
npx vitest run && npx tsc --noEmit
```

Expected: all pass, no type errors.

- [ ] **Step 8: Commit**

```
git add src/store/workshopSlice.ts src/store/index.ts tests/store/workshopSlice.test.ts tests/store/persistence-integration.test.ts
git commit -m "store(workshop): Item.fuseCount field + save migration v14→v15"
```

---

### Task 5: Fusion mechanic (`getFusionTarget` + `fuseItem`)

**Files:**
- Modify: `src/store/workshopSlice.ts` — add `getFusionTarget`, `getFuseCost`, and `fuseItem` action
- Modify: `tests/store/workshopSlice.test.ts` — add fusion tests

- [ ] **Step 1: Write the failing tests**

In `tests/store/workshopSlice.test.ts`, add a new describe block at the end:

```typescript
import { getFusionTarget, getFuseCost } from "@/store/workshopSlice";

describe("fusion — getFusionTarget", () => {
  it("returns null when no equipped items", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }, { kind: "+speed%", magnitude: 8 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, {})).toBeNull();
  });

  it("returns null when kinds match but count differs", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 8 }, { kind: "+speed%", magnitude: 5 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq })).toBeNull();
  });

  it("returns equipped item when affix kinds match exactly (order irrelevant)", () => {
    const inv: Item = {
      id: "inv-1", slot: "palette", tier: "magic",
      affixes: [{ kind: "+speed%", magnitude: 10 }, { kind: "+sell_price%", magnitude: 8 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }, { kind: "+speed%", magnitude: 7 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq })).toBe(eq);
  });

  it("slot kind of inventory item does not have to match equipped slot", () => {
    const inv: Item = {
      id: "inv-1", slot: "hat", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq })).toBe(eq);
  });
});

describe("fusion — getFuseCost", () => {
  it("cost at fuseCount=0 equals craftCost(workshopLevel)", () => {
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const cost = getFuseCost(eq, 1);
    // craftCost(1) = CRAFT_COST_BASE * 1.05^0 = 100; 100 * 2^0 = 100
    expect(cost.toNumber()).toBeCloseTo(100, 1);
  });

  it("cost doubles for each prior fuse", () => {
    const base: Item = {
      id: "eq-1", slot: "brush", tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const fused3: Item = { ...base, fuseCount: 3 };
    const costBase = getFuseCost(base, 1).toNumber();
    const costFused3 = getFuseCost(fused3, 1).toNumber();
    expect(costFused3).toBeCloseTo(costBase * 8, 1); // 2^3 = 8
  });
});

describe("fusion — fuseItem action", () => {
  beforeEach(() => {
    freshState();
    setSeed(42);
  });

  it("returns false when dropId not in inventory", () => {
    expect(useGameStore.getState().fuseItem("no-such-id")).toBe(false);
  });

  it("returns false when drop has no matching equipped item", () => {
    const drop: Item = {
      id: "drop-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    useGameStore.setState({ inventory: [drop], equipped: {}, gold: big(10_000) });
    expect(useGameStore.getState().fuseItem("drop-1")).toBe(false);
  });

  it("returns false when insufficient gold", () => {
    const drop: Item = {
      id: "drop-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }],
      fuseCount: 0,
    };
    useGameStore.setState({ inventory: [drop], equipped: { brush: eq }, gold: big(0) });
    expect(useGameStore.getState().fuseItem("drop-1")).toBe(false);
  });

  it("on success: removes drop, increments fuseCount, increases magnitude, spends gold", () => {
    const drop: Item = {
      id: "drop-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 20 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }],
      fuseCount: 0,
    };
    useGameStore.setState({ inventory: [drop], equipped: { brush: eq }, gold: big(10_000), workshopLevel: 1 });
    expect(useGameStore.getState().fuseItem("drop-1")).toBe(true);

    const state = useGameStore.getState();
    // Drop consumed
    expect(state.inventory.find(i => i.id === "drop-1")).toBeUndefined();
    // Equipped item's fuseCount incremented
    expect(state.equipped.brush!.fuseCount).toBe(1);
    // Magnitude increased (absorbed 5%–50% of drop's 20 → added 1–10 to eq's 12)
    const newMag = state.equipped.brush!.affixes[0]!.magnitude;
    expect(newMag).toBeGreaterThan(12);
    expect(newMag).toBeLessThanOrEqual(22); // 12 + 50% of 20
    // Gold spent: craftCost(1) * 2^0 = 100
    expect(state.gold.toNumber()).toBeLessThan(10_000);
    expect(state.gold.toNumber()).toBeCloseTo(9_900, 0);
  });

  it("fuse cost doubles on second fuse of the same item", () => {
    const makeItem = (id: string, mag: number): Item => ({
      id, slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: mag }],
      fuseCount: 0,
    });
    const drop1: Item = makeItem("drop-1", 15);
    const drop2: Item = makeItem("drop-2", 15);
    const eq: Item = { ...makeItem("eq-1", 10), tier: "rare" };

    useGameStore.setState({ inventory: [drop1, drop2], equipped: { brush: eq }, gold: big(10_000), workshopLevel: 1 });
    useGameStore.getState().fuseItem("drop-1");
    const goldAfterFirst = useGameStore.getState().gold.toNumber();

    // Patch drop2 into inventory (first fuse removed drop-1 and updated equip)
    const eqAfterFirst = useGameStore.getState().equipped.brush!;
    useGameStore.setState({ inventory: [drop2], equipped: { brush: eqAfterFirst } });
    useGameStore.getState().fuseItem("drop-2");
    const goldAfterSecond = useGameStore.getState().gold.toNumber();

    const firstFuseCost = 10_000 - goldAfterFirst;
    const secondFuseCost = goldAfterFirst - goldAfterSecond;
    expect(secondFuseCost).toBeCloseTo(firstFuseCost * 2, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run tests/store/workshopSlice.test.ts
```

Expected: `getFusionTarget`, `getFuseCost`, and `fuseItem` are not yet defined.

- [ ] **Step 3: Implement — add selectors and action to `src/store/workshopSlice.ts`**

Update the existing `@/core/rng` import to add `rng`:
```typescript
import { rngPick, rng } from "@/core/rng";
```

Add pure selectors after `getEquippedContribution`:

```typescript
/**
 * Returns the first equipped item whose affix kinds exactly match the
 * inventory item's affix kinds (same count, same set, order irrelevant).
 * Returns null if no match. First match wins.
 */
export function getFusionTarget(
  invItem: Item,
  equipped: Partial<Record<SlotKind, Item>>,
): Item | null {
  const invKinds = invItem.affixes.map((a) => a.kind).sort().join(",");
  for (const eq of Object.values(equipped)) {
    if (!eq) continue;
    if (eq.affixes.length !== invItem.affixes.length) continue;
    const eqKinds = eq.affixes.map((a) => a.kind).sort().join(",");
    if (invKinds === eqKinds) return eq;
  }
  return null;
}

/**
 * Gold cost to fuse a drop into an equipped item.
 * `craftCost(workshopLevel) × 2^equippedItem.fuseCount`.
 */
export const getFuseCost = (equippedItem: Item, workshopLevel: number): Big =>
  craftCost(workshopLevel).mul(Math.pow(2, equippedItem.fuseCount));
```

Add `fuseItem` to the `WorkshopSlice` interface:
```typescript
fuseItem: (dropId: string) => boolean;
```

Add `fuseItem` action to `createWorkshopSlice`:

```typescript
fuseItem: (dropId) => {
  const state = get();
  const drop = state.inventory.find((i) => i.id === dropId);
  if (!drop) return false;

  const target = getFusionTarget(drop, state.equipped);
  if (!target) return false;

  const fuseCost = getFuseCost(target, state.workshopLevel);
  if (!state.spend("gold", fuseCost)) return false;

  // Find the slot holding the target item.
  const targetSlot = (Object.entries(state.equipped) as Array<[SlotKind, Item | undefined]>)
    .find(([, eq]) => eq?.id === target.id)?.[0];
  if (!targetSlot) return false;

  // Per-affix absorption: independently roll 5%–50% of each drop affix's magnitude.
  const dropKindMap = new Map(drop.affixes.map((a) => [a.kind, a.magnitude]));
  const newAffixes: Affix[] = target.affixes.map((a) => {
    const dropMag = dropKindMap.get(a.kind) ?? 0;
    const pct = 0.05 + rng() * 0.45;
    const gain = Math.round(dropMag * pct);
    return { kind: a.kind, magnitude: a.magnitude + gain };
  });

  const fusedItem: Item = {
    ...target,
    affixes: newAffixes,
    fuseCount: target.fuseCount + 1,
  };

  set((s) => ({
    inventory: s.inventory.filter((i) => i.id !== dropId),
    equipped: { ...s.equipped, [targetSlot]: fusedItem },
  }));
  return true;
},
```

- [ ] **Step 4: Run tests**

```
npx vitest run tests/store/workshopSlice.test.ts
```

Expected: all pass.

- [ ] **Step 5: Run full suite + type check**

```
npx vitest run && npx tsc --noEmit
```

Expected: all pass, no type errors.

- [ ] **Step 6: Commit**

```
git add src/store/workshopSlice.ts tests/store/workshopSlice.test.ts
git commit -m "feat(workshop): fusion mechanic — getFusionTarget, getFuseCost, fuseItem"
```

---

### Task 6: PoE-style Workshop UI

**Files:**
- Rewrite: `src/components/painting/WorkshopRoom.tsx`
- Rewrite: `src/components/painting/WorkshopRoom.module.css`

No new tests — UI component. Verify by running the dev server and playtesting.

- [ ] **Step 1: Rewrite `src/components/painting/WorkshopRoom.module.css`**

```css
.room {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-3);
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
}

.title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0;
}

.levelStrip {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--text-sm);
}

.levelLabel {
  color: var(--ink-2);
  min-width: 3rem;
}

.xpBar {
  flex: 1;
  height: 6px;
  background: var(--bg-stone-d);
  border-radius: 3px;
  overflow: hidden;
}

.xpFill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.xpReadout {
  color: var(--ink-3);
  font-size: 11px;
}

.craftStation {
  display: flex;
  align-items: center;
}

.craftBtn {
  padding: var(--s-1) var(--s-3);
  font-size: var(--text-sm);
  background: var(--accent);
  color: var(--ink-on-accent);
  border: none;
  cursor: pointer;
  border-radius: 2px;
}

.craftBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.subhead {
  font-size: var(--text-sm);
  color: var(--ink-2);
  font-weight: 500;
}

.count {
  color: var(--ink-3);
  font-weight: 400;
}

/* ── Item squares ── */

.equippedGrid {
  display: grid;
  grid-template-columns: repeat(3, 72px);
  gap: var(--s-2);
}

.inventoryGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 72px);
  gap: var(--s-2);
  max-height: 300px;
  overflow-y: auto;
}

.itemSquare {
  width: 72px;
  height: 72px;
  border: 2px solid var(--tier-color, #9e9e9e);
  background: color-mix(in srgb, var(--tier-color, #9e9e9e) 12%, var(--bg-stone-d));
  position: relative;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  font-size: 10px;
  color: var(--ink-1);
  text-align: center;
}

.itemSquare:hover {
  filter: brightness(1.15);
}

.emptySlot {
  width: 72px;
  height: 72px;
  border: 2px dashed var(--ink-line);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 10px;
  color: var(--ink-3);
}

.lockedSlot {
  width: 72px;
  height: 72px;
  border: 2px dashed var(--ink-line);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 9px;
  color: var(--ink-line);
  opacity: 0.5;
  cursor: default;
}

.slotLabel {
  font-size: 9px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tierTag {
  font-size: 9px;
  font-weight: 600;
  color: var(--tier-color, #9e9e9e);
  text-transform: uppercase;
}

.affixLine {
  font-size: 9px;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 64px;
}

.discardBtn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  font-size: 9px;
  padding: 0;
  background: rgba(0, 0, 0, 0.45);
  border: none;
  color: #fff;
  cursor: pointer;
  line-height: 14px;
  text-align: center;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.1s;
}

.itemSquare:hover .discardBtn {
  opacity: 1;
}

/* Tier colors via data attribute on the square */
[data-tier="normal"]    { --tier-color: #9e9e9e; }
[data-tier="magic"]     { --tier-color: #4caf50; }
[data-tier="rare"]      { --tier-color: #4b8ef1; }
[data-tier="epic"]      { --tier-color: #b060e0; }
[data-tier="legendary"] { --tier-color: #e8602c; }

/* Fusion glow */
@keyframes fusionPulse {
  0%, 100% { box-shadow: 0 0 6px 2px var(--tier-color, #9e9e9e); }
  50%       { box-shadow: 0 0 14px 5px var(--tier-color, #9e9e9e); }
}

.fusionCandidate {
  animation: fusionPulse 1.2s ease-in-out infinite;
}

.empty {
  font-size: var(--text-sm);
  color: var(--ink-3);
}
```

- [ ] **Step 2: Rewrite `src/components/painting/WorkshopRoom.tsx`**

```tsx
import { useMemo, type JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { craftCost, xpToNext } from "@/core/balance";
import {
  getUnlockedSlotKinds,
  getMaxInventorySlots,
  getFusionTarget,
  getFuseCost,
} from "@/store/workshopSlice";
import type { Item, SlotKind } from "@/store/workshopSlice";
import type { AffixKind } from "@/config/workshopAffixes";
import { ALL_SLOT_KINDS } from "@/config/workshopAffixes";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";
import {
  computeTierProbabilities,
  ALL_ITEM_TIERS,
  TIER_UNLOCK_LEVEL,
} from "@/core/workshopRoll";
import styles from "./WorkshopRoom.module.css";

const TIER_LABEL: Record<string, string> = {
  normal: "Normal",
  magic: "Magic",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const SLOT_UNLOCK_NODE: Partial<Record<SlotKind, string>> = {
  palette: "gear_up",
  easel: "forget_pain",
  hat: "painters_hat",
  apron: "painters_apron",
  boots: "painters_boots",
};

const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+sell_price%": (m) => `+${m}% sell`,
  "+speed%": (m) => `+${m}% spd`,
  "+crit_chance%": (m) => `+${m}% crit`,
  "+combo_chance%": (m) => `+${m}% combo`,
  "+size%": (m) => `+${m}% size`,
};

function itemHoverBody(item: Item, workshopLevel: number, isFusion: boolean): JSX.Element {
  const fuseCost = isFusion ? getFuseCost(item, workshopLevel) : null;
  return (
    <>
      {item.affixes.map((a, i) => (
        <div key={i}>{AFFIX_LABEL[a.kind](a.magnitude)}</div>
      ))}
      {item.fuseCount > 0 && <div>Fused {item.fuseCount}×</div>}
      {isFusion && fuseCost && <div>───</div>}
      {isFusion && fuseCost && <div>Fuse cost: {formatBig(fuseCost)} g</div>}
    </>
  );
}

function craftHoverBody(): JSX.Element {
  const s = useGameStore.getState();
  const level = s.workshopLevel;
  const cost = craftCost(level);
  const probs = computeTierProbabilities(level);
  return (
    <>
      <div>Cost: {formatBig(cost)} g</div>
      <div>───</div>
      {ALL_ITEM_TIERS.map((t) => {
        const unlock = TIER_UNLOCK_LEVEL[t];
        const locked = level < unlock;
        return (
          <div key={t}>
            {TIER_LABEL[t]}: {locked ? `— (unlocks Lv ${unlock})` : (probs[t]! * 100).toFixed(2) + "%"}
          </div>
        );
      })}
    </>
  );
}

function levelHoverBody(): JSX.Element {
  const s = useGameStore.getState();
  return (
    <>
      <div>XP: {s.workshopXp} / {xpToNext(s.workshopLevel)}</div>
      <div>───</div>
      {ALL_ITEM_TIERS.filter((t) => t !== "normal").map((t) => {
        const unlock = TIER_UNLOCK_LEVEL[t];
        return (
          <div key={t}>{TIER_LABEL[t]} at Lv {unlock}{s.workshopLevel >= unlock ? " ✓" : ""}</div>
        );
      })}
    </>
  );
}

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
  const fuseItem = useGameStore((s) => s.fuseItem);

  const helperState = { purchasedNodes } as unknown as GameStore;
  const unlockedSlots = useMemo(
    () => getUnlockedSlotKinds(helperState),
    [purchasedNodes],
  );
  const maxSlots = useMemo(
    () => getMaxInventorySlots(helperState),
    [purchasedNodes],
  );
  const hasShredder = (purchasedNodes.shredder ?? 0) > 0;

  const cost = craftCost(workshopLevel);
  const xpMax = xpToNext(workshopLevel);
  const xpPct = Math.max(0, Math.min(100, (workshopXp / xpMax) * 100));
  const canCraft = gold.gte(cost) && (inventory.length < maxSlots || hasShredder);

  // Precompute fusion targets for each inventory item.
  const fusionTargetMap = useMemo(() => {
    const map = new Map<string, Item | null>();
    for (const item of inventory) {
      map.set(item.id, getFusionTarget(item, equipped));
    }
    return map;
  }, [inventory, equipped]);

  return (
    <section className={styles.room} aria-label="Workshop room">
      <Hoverable
        as="div"
        title={() => `Workshop Lv ${useGameStore.getState().workshopLevel}`}
        body={() => levelHoverBody()}
        footer="Higher tiers drop more XP."
      >
        <header className={styles.header} data-testid="workshop-level-header">
          <h2 className={styles.title}>Workshop</h2>
          <div className={styles.levelStrip}>
            <span className={styles.levelLabel}>Lv {workshopLevel}</span>
            <div className={styles.xpBar}>
              <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
            </div>
            <span className={styles.xpReadout}>{workshopXp} / {xpMax}</span>
          </div>
        </header>
      </Hoverable>

      <section className={styles.craftStation}>
        <Hoverable
          title="Craft Item"
          body={() => craftHoverBody()}
          footer="Craft consumes gold. Higher tiers award more XP."
        >
          <button
            type="button"
            className={styles.craftBtn}
            disabled={!canCraft}
            onClick={() => craft()}
            data-testid="craft-button"
          >
            Craft · {formatBig(cost)} g
          </button>
        </Hoverable>
      </section>

      {/* Equipped grid */}
      <section className={styles.section}>
        <div className={styles.subhead}>
          Equipped <span className={styles.count}>{Object.keys(equipped).length}/{unlockedSlots.length}</span>
        </div>
        <div className={styles.equippedGrid}>
          {ALL_SLOT_KINDS.map((slot) => {
            const isUnlocked = unlockedSlots.includes(slot);
            const item = equipped[slot];
            const unlockNode = SLOT_UNLOCK_NODE[slot];

            if (!isUnlocked) {
              return (
                <Hoverable
                  key={slot}
                  as="div"
                  title={`${slot} (locked)`}
                  body={unlockNode ? `Purchase "${unlockNode}" in the skill tree to unlock.` : ""}
                >
                  <div className={styles.lockedSlot}>
                    <span>{slot}</span>
                    <span>🔒</span>
                  </div>
                </Hoverable>
              );
            }

            if (!item) {
              return (
                <Hoverable
                  key={slot}
                  as="div"
                  title={`${slot} (empty)`}
                  body="Equip an item from your inventory."
                >
                  <div className={styles.emptySlot}>
                    <span className={styles.slotLabel}>{slot}</span>
                  </div>
                </Hoverable>
              );
            }

            return (
              <Hoverable
                key={slot}
                title={`${TIER_LABEL[item.tier]} ${slot} — equipped`}
                body={() => itemHoverBody(item, workshopLevel, false)}
                footer="Click to unequip."
              >
                <button
                  type="button"
                  className={styles.itemSquare}
                  data-tier={item.tier}
                  onClick={() => unequipSlot(slot)}
                  data-testid={`slot-unequip-${slot}`}
                >
                  <span className={styles.tierTag}>{TIER_LABEL[item.tier]}</span>
                  <span className={styles.slotLabel}>{slot}</span>
                  {item.affixes.slice(0, 2).map((a, i) => (
                    <span key={i} className={styles.affixLine}>{AFFIX_LABEL[a.kind](a.magnitude)}</span>
                  ))}
                  {item.affixes.length > 2 && (
                    <span className={styles.affixLine}>+{item.affixes.length - 2} more</span>
                  )}
                </button>
              </Hoverable>
            );
          })}
        </div>
      </section>

      {/* Inventory grid */}
      <section className={styles.section}>
        <div className={styles.subhead}>
          Inventory <span className={styles.count}>{inventory.length}/{maxSlots}</span>
        </div>
        {inventory.length === 0 ? (
          <div className={styles.empty}>Empty — click Craft to roll an item.</div>
        ) : (
          <div className={styles.inventoryGrid}>
            {inventory.map((item) => {
              const fusionTarget = fusionTargetMap.get(item.id) ?? null;
              const isFusion = fusionTarget !== null;
              const fusionTier = fusionTarget?.tier ?? item.tier;
              const canFuse = isFusion && gold.gte(getFuseCost(fusionTarget!, workshopLevel));

              return (
                <div key={item.id} style={{ position: "relative" }} data-testid={`inventory-item-${item.id}`}>
                  <Hoverable
                    title={`${TIER_LABEL[item.tier]} ${item.slot}${isFusion ? " — FUSION" : ""}`}
                    body={() => itemHoverBody(isFusion ? fusionTarget! : item, workshopLevel, isFusion)}
                    footer={isFusion ? (canFuse ? "Click to fuse." : "Not enough gold to fuse.") : "Click to equip."}
                  >
                    <button
                      type="button"
                      className={`${styles.itemSquare}${isFusion ? ` ${styles.fusionCandidate}` : ""}`}
                      data-tier={isFusion ? fusionTier : item.tier}
                      onClick={() => isFusion ? fuseItem(item.id) : equipItem(item.id)}
                      disabled={isFusion && !canFuse}
                      data-testid={isFusion ? `inventory-fuse-${item.id}` : `inventory-equip-${item.id}`}
                    >
                      <span className={styles.tierTag}>{TIER_LABEL[item.tier]}</span>
                      <span className={styles.slotLabel}>{item.slot}</span>
                      {item.affixes.slice(0, 2).map((a, i) => (
                        <span key={i} className={styles.affixLine}>{AFFIX_LABEL[a.kind](a.magnitude)}</span>
                      ))}
                      {item.affixes.length > 2 && (
                        <span className={styles.affixLine}>+{item.affixes.length - 2} more</span>
                      )}
                    </button>
                  </Hoverable>
                  <button
                    type="button"
                    className={styles.discardBtn}
                    onClick={() => discard(item.id)}
                    data-testid={`inventory-discard-${item.id}`}
                    aria-label={`Discard ${item.id}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
```

- [ ] **Step 3: Type-check and build**

```
npx tsc --noEmit
npm run build
```

Expected: clean. Fix any type errors before proceeding.

- [ ] **Step 4: Run full test suite**

```
npx vitest run
```

Expected: all tests pass (UI has no new tests — verify in browser).

- [ ] **Step 5: Smoke test in browser**

Start the dev server (`npm run dev`). Navigate to the Workshop tab. Verify:
1. Equipped section shows 6 squares: brush + palette + easel + hat + apron + boots
2. Locked slots (hat/apron/boots — no fame nodes yet) are dimmed with lock icon
3. Inventory items are square with tier-colored border
4. Craft a few items — tier colors appear correctly (normal grey, magic green, etc.)
5. Equip items — slot squares fill in
6. Craft items matching equipped affix kinds — glow animation appears on matching drops
7. Hover a glowing item — InfoPanel shows fuse cost
8. Click glowing item with enough gold — fuse succeeds; equipped item affix magnitude increases; fuseCount shown in hover

- [ ] **Step 6: Commit**

```
git add src/components/painting/WorkshopRoom.tsx src/components/painting/WorkshopRoom.module.css
git commit -m "ui(workshop): PoE-style square grid, tier colors, fusion glow"
```

---

## After All Tasks

```
npx vitest run && npx tsc --noEmit && npm run build
```

Expected: all tests pass, clean type check, bundle under 250 KB gzipped.
