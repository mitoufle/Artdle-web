# New Skill Tree Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up three new skill-tree nodes — `third_hand`, `better_scaling`, `socks` — and remove the defunct `apprentice_pool` node from gameplay code.

**Architecture:** Each node maps to one selector or action already in the engine. `third_hand` reduces the Taylorism autocraft interval in `workshopTick`. `better_scaling` adds a `workshopLevel`-proportional bonus inside `getAffixMagnitudeBonus`. `socks` multiplies boots-slot affix contribution by 1.5 inside `getEquippedContribution`. `apprentice_pool` is simply removed — the designer JSON has dropped it and no replacement adds inventory slots.

**Tech Stack:** TypeScript strict, Zustand 5, Vitest. All new behaviour lives in existing files — no new files needed.

---

## Context for all tasks

### Nodes being wired (from `src/config/skillTreeDesign.json`)

| id | maxLevel | numericEffect | parent | description |
|----|---------|--------------|--------|-------------|
| `third_hand` | 5 | 10 | `forget_pain` | reduces autocraft time by 10% per level |
| `better_scaling` | 1 | 1 | `painters_hat` | +1 to affix min/max per workshop level |
| `socks` | 1 | 50 | `painters_boots` | equipped boots affixes +50% efficiency |
| `apprentice_pool` | — | — | removed | was +1 inventory slot per level |

### Key files to read before editing

- `src/store/workshopSlice.ts` — `getMaxInventorySlots`, `getEquippedContribution`, `workshopTick`
- `src/core/multipliers.ts` — `getAffixMagnitudeBonus`
- `tests/store/workshopSlice.test.ts` — existing Taylorism and equipped-contribution tests
- `tests/core/multipliers.test.ts` — existing `getAffixMagnitudeBonus` tests

### Constants in `src/store/workshopSlice.ts` (current values)
```typescript
const TAYLORISM_INTERVAL_S = 10;   // seconds between autocrafts
```

### `getNodeLevel` import (already in both files)
```typescript
import { getNodeLevel } from "@/store/skillTreeSlice";
```

---

## Task 1: Remove `apprentice_pool`

**Files:**
- Modify: `src/store/workshopSlice.ts` (around line 94–99)
- Modify: `tests/core/multipliers.test.ts` (around line 462–467)

- [ ] **Step 1: Delete the `apprentice_pool` test**

In `tests/core/multipliers.test.ts`, remove the entire test block (≈ lines 462–467):

```typescript
// DELETE THIS BLOCK:
  it("apprentice_pool: adds inventory slots", async () => {
    const { getMaxInventorySlots } = await import("@/store/workshopSlice");
    useGameStore.setState({ purchasedNodes: { apprentice_pool: 3 } });
    // Base MAX_INVENTORY_SLOTS + 0 chests + 3 from apprentice_pool
    expect(getMaxInventorySlots(useGameStore.getState())).toBe(3 + 3); // assuming MAX_INVENTORY_SLOTS = 3
  });
```

- [ ] **Step 2: Run the test file to confirm it fails (the test still exists)**

```
npx vitest run tests/core/multipliers.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: test passes (it still tests the old behaviour). This is the baseline.

- [ ] **Step 3: Remove the line in `getMaxInventorySlots`**

In `src/store/workshopSlice.ts`, in `getMaxInventorySlots`, remove:

```typescript
  cap += getNodeLevel(state, "apprentice_pool");
```

The function should now read:

```typescript
export const getMaxInventorySlots = (state: GameStore): number => {
  let cap = MAX_INVENTORY_SLOTS;
  if (getNodeLevel(state, "wooden_chest") > 0) cap += STORAGE_PER_CHEST;
  if (getNodeLevel(state, "steel_chest") > 0) cap += STORAGE_PER_CHEST;
  return cap;
};
```

- [ ] **Step 4: Run the full suite to confirm no regressions**

```
npx vitest run --reporter=verbose 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/store/workshopSlice.ts tests/core/multipliers.test.ts
git commit -m "store(workshop): remove apprentice_pool from inventory cap (node removed from designer)"
```

---

## Task 2: `better_scaling` — affix magnitude bonus per workshop level

`better_scaling` at level 1 adds `+workshopLevel` to both the min and max affix magnitude for every crafted item. At workshop level 1 → +1 pp; at level 20 → +20 pp on top of Craftsmanship.

**Files:**
- Modify: `src/core/multipliers.ts` (around line 176–178)
- Modify: `tests/core/multipliers.test.ts` (around line 105–114)

- [ ] **Step 1: Write the failing test**

In `tests/core/multipliers.test.ts`, after the existing `getAffixMagnitudeBonus` tests, add:

```typescript
  it("getAffixMagnitudeBonus: better_scaling adds workshopLevel pp when purchased", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { better_scaling: 1 }, workshopLevel: 10 });
    // 0 craftsmanship + 1 × 10 (workshopLevel) = 10
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(10);
  });

  it("getAffixMagnitudeBonus: better_scaling stacks with Craftsmanship", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { craftsmanship: 3, better_scaling: 1 }, workshopLevel: 5 });
    // 3 × 5 (craftsmanship) + 1 × 5 (better_scaling × workshopLevel) = 15 + 5 = 20
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(20);
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/core/multipliers.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|better_scaling|PASS"
```

Expected: two new tests FAIL.

- [ ] **Step 3: Implement `better_scaling` in `getAffixMagnitudeBonus`**

In `src/core/multipliers.ts`, add a constant near line 83:

```typescript
const BETTER_SCALING_PER_WORKSHOP_LEVEL = 1; // +1 pp to affix bounds per workshop level
```

Then update `getAffixMagnitudeBonus` (currently around line 176):

```typescript
export const getAffixMagnitudeBonus = (state: Pick<GameStore, "purchasedNodes" | "workshopLevel">): number =>
  getNodeLevel(state, "craftsmanship") * CRAFTSMANSHIP_PER_LEVEL
  + getNodeLevel(state, "better_scaling") * state.workshopLevel * BETTER_SCALING_PER_WORKSHOP_LEVEL;
```

The only call site is `performCraft` in `workshopSlice.ts`:
```typescript
const affixes = rollAffixes(tier, state, getAffixMagnitudeBonus(state));
```
`state` there is the full `GameStore` which always has `workshopLevel`, so no change needed at the call site.

- [ ] **Step 4: Run all tests**

```
npx vitest run --reporter=verbose 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "feat(skill-tree): better_scaling — +workshopLevel pp to affix min/max"
```

---

## Task 3: `socks` — boots slot affix efficiency ×1.5

When `socks` is purchased, every affix on the item equipped in the `boots` slot contributes 50% more (the magnitude fraction is multiplied by 1.5).

**Files:**
- Modify: `src/store/workshopSlice.ts` (around line 104–115)
- Modify: `tests/store/workshopSlice.test.ts` (after the existing `getEquippedContribution` tests, around line 122)

- [ ] **Step 1: Write the failing test**

In `tests/store/workshopSlice.test.ts`, after the last `getEquippedContribution` test block (`it("handles duplicate affix kinds...")`), add:

```typescript
  it("getEquippedContribution: socks × 1.5 on boots slot only", () => {
    const boots: Item = {
      id: "test-boots-1",
      slot: "boots",
      tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 20 }],
      fuseCount: 0,
    };
    const brush: Item = {
      id: "test-brush-socks",
      slot: "brush",
      tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    // Without socks: brush 0.10 + boots 0.20 = 0.30
    useGameStore.setState({ equipped: { boots, brush }, purchasedNodes: {} });
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.30, 5);
    // With socks: brush 0.10 + boots 0.20 × 1.5 = 0.10 + 0.30 = 0.40
    useGameStore.setState({ purchasedNodes: { socks: 1 } });
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.40, 5);
  });
```

- [ ] **Step 2: Run the new test to verify it fails**

```
npx vitest run tests/store/workshopSlice.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|socks|PASS"
```

Expected: the new test FAILS.

- [ ] **Step 3: Implement `socks` in `getEquippedContribution`**

In `src/store/workshopSlice.ts`, replace the current `getEquippedContribution`:

```typescript
export const getEquippedContribution = (
  state: Pick<GameStore, "equipped" | "purchasedNodes">,
  kind: AffixKind,
): number => {
  const hasSocks = getNodeLevel(state, "socks") > 0;
  let total = 0;
  for (const [slot, item] of Object.entries(state.equipped) as Array<[SlotKind, Item | undefined]>) {
    if (!item) continue;
    const mult = hasSocks && slot === "boots" ? 1.5 : 1.0;
    for (const affix of item.affixes) {
      if (affix.kind === kind) total += (affix.magnitude / 100) * mult;
    }
  }
  return total;
};
```

Note: `getNodeLevel` is already imported at the top of `workshopSlice.ts`.

The callers in `multipliers.ts` all pass `state: CanvasMultiplierInputs` which already includes `purchasedNodes`, so no call-site changes are needed there.

- [ ] **Step 4: Run all tests**

```
npx vitest run --reporter=verbose 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/store/workshopSlice.ts tests/store/workshopSlice.test.ts
git commit -m "feat(skill-tree): socks — boots-slot affixes get ×1.5 efficiency multiplier"
```

---

## Task 4: `third_hand` — autocraft interval reduction

`third_hand` has 5 levels. Each level reduces the Taylorism autocraft interval by 10% (additive). L0 = 10 s, L5 = 5 s.

Formula: `effectiveInterval = TAYLORISM_INTERVAL_S × (1 − 0.10 × thirdHandLevel)`

**Files:**
- Modify: `src/store/workshopSlice.ts` (around line 19–21 for the constant; around line 284–301 for `workshopTick`)
- Modify: `tests/store/workshopSlice.test.ts` (after the existing Taylorism tests, around line 260)

- [ ] **Step 1: Write the failing tests**

In `tests/store/workshopSlice.test.ts`, after the existing Taylorism block (the `it("taylorism + 5s tick: no auto-craft yet...")` test), add:

```typescript
  it("third_hand L1: autocraft fires at 9 s (10% faster interval)", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1, third_hand: 1 },
    });
    // interval = 10 × (1 − 0.10 × 1) = 9 s
    useGameStore.getState().workshopTick(9);
    expect(useGameStore.getState().inventory.length).toBe(1);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(0, 5);
  });

  it("third_hand L1: 8 s tick does not fire (interval = 9 s)", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1, third_hand: 1 },
    });
    useGameStore.getState().workshopTick(8);
    expect(useGameStore.getState().inventory.length).toBe(0);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(8, 5);
  });

  it("third_hand L5: autocraft fires at 5 s (50% faster interval)", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1, third_hand: 5 },
    });
    // interval = 10 × (1 − 0.10 × 5) = 5 s
    useGameStore.getState().workshopTick(5);
    expect(useGameStore.getState().inventory.length).toBe(1);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(0, 5);
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/store/workshopSlice.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|third_hand|PASS"
```

Expected: the three new tests FAIL.

- [ ] **Step 3: Add constant and update `workshopTick`**

In `src/store/workshopSlice.ts`, add a constant near the top of the constants block (near `TAYLORISM_INTERVAL_S`):

```typescript
const THIRD_HAND_INTERVAL_REDUCTION = 0.10; // fraction per level
```

Then update `workshopTick` (the existing implementation):

```typescript
  workshopTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const state = get();
    const taylorismLevel = getNodeLevel(state, "taylorsim");
    if (taylorismLevel === 0) return;

    const thirdHandLevel = getNodeLevel(state, "third_hand");
    const interval = TAYLORISM_INTERVAL_S * (1 - THIRD_HAND_INTERVAL_REDUCTION * thirdHandLevel);

    const next = state.autoCraftTimer + deltaSeconds;
    const grants = Math.floor(next / interval);
    if (grants > 0) {
      for (let i = 0; i < grants; i++) {
        const ok = performCraft(get(), set);
        if (!ok) break;
      }
    }
    set({ autoCraftTimer: next - grants * interval });
  },
```

- [ ] **Step 4: Run all tests**

```
npx vitest run --reporter=verbose 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/store/workshopSlice.ts tests/store/workshopSlice.test.ts
git commit -m "feat(skill-tree): third_hand — reduces Taylorism autocraft interval 10% per level"
```
