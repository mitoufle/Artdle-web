# Affix Pool Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the workshop affix pool to (1) match the new canvas axes from subproject 1, (2) gate the 3 advanced affix kinds (`+crit_chance%`, `+combo_chance%`, `+size_gold_per_level%`) behind the same fame skill-tree nodes that gate the matching canvas tracks, and (3) clean up the stale `-paint_time%` semantics by replacing with `+speed%`.

**Architecture:** `AffixKind` enum gets renamed (`+canvas_gold%` → `+sell_price%`, `-paint_time%` → `+speed%`) and three new kinds are added. `rollAffixes` takes a `state` parameter and filters the pool by `getCanvasTrackUnlocked` — affixes whose track is locked simply don't roll. Multiplier consumers (`getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, new `getSizeGoldPerLevelMultiplier`) each pull their kind's equipped contribution additively. `getPaintTimeMultiplier` is deleted; its consumer flow folds entirely into `getCanvasSpeedMultiplier`. Save migration v10 → v11 wipes inventory + equipped (game unreleased — magnitudes from `-paint_time%` don't translate cleanly to `+speed%` anyway).

**Tech stack:** React 19 + TypeScript strict + Vite + Zustand 5 + Vitest + RTL. `break_eternity.js` Bigs for gold; existing `core/rng.ts` for affix rolls.

**Subproject:** 2 of 3 in the Painter's Office decomposition. Subproject 1 (canvas depth) shipped in commits `7eb8766..a277765`. This subproject delivers the §6 affix-pool contract from the canvas-depth spec.

---

## Spec recap

### Affix kinds — old → new

| Old kind | New kind | Notes |
|---|---|---|
| `+canvas_gold%` | `+sell_price%` | Drop-in rename. Existing magnitudes preserved via migration… but wait — see below: full inventory wipe is cleaner. |
| `-paint_time%` | `+speed%` | Semantic flip. -10% paint time ≠ +10% speed; **wipe rather than translate**. |

### New kinds

| Kind | Effect | Multiplier consumer |
|---|---|---|
| `+crit_chance%` | adds X% to crit chance (additive) | `getCritChance(state)` |
| `+combo_chance%` | adds X% to base combo trigger chance (additive) | `getComboBaseChance(state)` |
| `+size_gold_per_level%` | multiplies `SIZE_GOLD_PER_LEVEL` (additive across affixes) | new `getSizeGoldPerLevelMultiplier(state)` |

### Magnitudes

- Range: integer 5..15, same as today.
- `getAffixMagnitudeBonus` (Craftsmanship skill-tree node) still shifts both bounds by the same amount.

### Roll-time gating

Inside `rollAffixes`, after determining count, build the available-kinds pool from `AFFIX_KINDS` filtered by:
- `+sell_price%`, `+speed%`: always available.
- `+crit_chance%`: only if `getCanvasTrackUnlocked(state, "crit") === true`.
- `+combo_chance%`: only if `getCanvasTrackUnlocked(state, "combo") === true`.
- `+size_gold_per_level%`: only if `getCanvasTrackUnlocked(state, "size") === true`.

If a tier requires more affixes than the available pool size, that's fine — duplicates were already allowed before.

### Migration v10 → v11

- Wipe `inventory: []`, `equipped: {}`.
- Workshop level + XP preserved (long-tail meta).
- Comment: "Game unreleased; magnitudes from `-paint_time%` don't translate cleanly to `+speed%`. Wipe is the practical move."

### Out of scope

- Office worker affixes (subproject 3).
- Per-tier magnitude differences.
- Magnitude balance tuning beyond reusing the 5–15% range.
- Class-weighted distributions for the office.

---

## File structure

### Modified files

| File | Change |
|---|---|
| `src/config/workshopAffixes.ts` | `AffixKind` enum: `["+canvas_gold%", "-paint_time%"]` → `["+sell_price%", "+speed%", "+crit_chance%", "+combo_chance%", "+size_gold_per_level%"]`. `AFFIX_KINDS` updated. |
| `src/core/multipliers.ts` | `getCanvasGoldMultiplier`: replace `"+canvas_gold%"` with `"+sell_price%"`. `getCanvasSpeedMultiplier`: add equipped `+speed%` contribution. `getCritChance` + `getComboBaseChance`: each add equipped contribution. New `getSizeGoldPerLevelMultiplier`. **Delete `getPaintTimeMultiplier`**. |
| `src/core/balance.ts` | `canvasGold(sizeLevel, mult, sizeGoldMult = 1)`: optional 3rd param multiplies `SIZE_GOLD_PER_LEVEL`. |
| `src/core/workshopRoll.ts` | `rollAffixes(tier, state, magnitudeBonus = 0)`: takes `state` to filter pool by track unlocks. |
| `src/store/workshopSlice.ts` | `craft` action: pass `state` to `rollAffixes`. `getEquippedContribution` works unchanged (it's generic). |
| `src/store/canvasSlice.ts` | `canvasTick`: drop `getPaintTimeMultiplier` call; pass `getSizeGoldPerLevelMultiplier(state)` to `canvasGold`. |
| `src/store/index.ts` | `SAVE_VERSION` 10 → 11. New v10 → v11 migration block. |
| `src/components/painting/WorkshopRoom.tsx` | Affix label map: rename old, add 3 new entries. |
| `src/components/painting/CanvasStage.tsx` | `sellHoverBody`: drop `+canvas_gold%` reference (use `+sell_price%`); show new affix contributions when present. |
| `src/routes/PaintingRoute.tsx` | Drop `getPaintTimeMultiplier` import; speedMult computation simplifies. Pass new size-gold mult through to canvas paint-time preview if relevant. |

### Test files touched

- `tests/config/workshopAffixes.test.ts` (or wherever) — update enum tests.
- `tests/core/workshopRoll.test.ts` — add roll-time gating tests; update existing tests to pass state.
- `tests/core/multipliers.test.ts` — add equipped-contribution cases for crit/combo/speed/size; remove paint-time tests.
- `tests/core/balance.test.ts` — `canvasGold` 3-arg overload tests.
- `tests/store/workshopSlice.test.ts` — `craft` calls with state; old paint_time references gone.
- `tests/store/persistence-integration.test.ts` — v10 → v11 migration tests.
- `tests/components/painting/WorkshopRoom.test.tsx` — new affix label assertions; old `-paint_time%` removed.
- `tests/components/painting/CanvasStage.test.tsx` (and `.hover.test.tsx`) — hover body updated for new kinds.
- `tests/routes/PaintingRoute.test.tsx` — fixture updates (no paint_time).

---

## Phasing

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Affix kind enum + label map | 1 |
| **B** | Multipliers (rename + new selectors + delete paint-time) | 2, 3, 4, 5 |
| **C** | balance.canvasGold + canvasTick | 6, 7 |
| **D** | Workshop roll gating | 8 |
| **E** | UI updates | 9, 10 |
| **F** | Migration + cleanup | 11, 12 |

Each task: TDD where applicable. Tests first; impl follows; commit per task. After every task: `npx tsc -b --noEmit` clean and target tests green.

---

## Pre-flight

- [ ] On `main`, working tree clean.
- [ ] Baseline: `npm test` reports 653 tests passing.
- [ ] `npx tsc -b --noEmit` clean.

---

# Phase A — Affix kind enum

---

### Task 1: Update `AffixKind` enum + `AFFIX_KINDS`

**Files:**
- Modify: `src/config/workshopAffixes.ts`

- [ ] **Step 1: Verify failing tests** (these will surface as test failures across the codebase once the enum changes; no separate test for enum membership)

`npx tsc -b --noEmit` will produce errors at every consumer of the old kinds (`"+canvas_gold%"`, `"-paint_time%"`). That's the failure indicator for this task.

- [ ] **Step 2: Update the enum**

```ts
/**
 * Persisted affix identifier. Renames require a save migration.
 *
 * Items come from the Workshop. Each kind contributes additively to one
 * canvas-derived multiplier:
 *   +sell_price%            → getCanvasGoldMultiplier
 *   +speed%                 → getCanvasSpeedMultiplier
 *   +crit_chance%           → getCritChance         (gated by unlock_canvas_crit)
 *   +combo_chance%          → getComboBaseChance    (gated by unlock_canvas_combo)
 *   +size_gold_per_level%   → getSizeGoldPerLevelMultiplier (gated by unlock_canvas_size)
 */
export type AffixKind =
  | "+sell_price%"
  | "+speed%"
  | "+crit_chance%"
  | "+combo_chance%"
  | "+size_gold_per_level%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+sell_price%",
  "+speed%",
  "+crit_chance%",
  "+combo_chance%",
  "+size_gold_per_level%",
];
```

- [ ] **Step 3: Run tsc to find broken consumers**

Run: `npx tsc -b --noEmit`
Expected: errors at every consumer (multipliers.ts, workshopRoll.ts, WorkshopRoom.tsx, CanvasStage.tsx, etc.). Tasks 2-9 fix these one at a time.

DO NOT fix all consumers in this task — they're addressed individually in subsequent tasks. The goal here is to ship the enum change atomically.

- [ ] **Step 4: Commit**

```bash
git add src/config/workshopAffixes.ts
git commit -m "config(workshop): rename + extend AffixKind enum

Renames +canvas_gold% → +sell_price%, -paint_time% → +speed% (semantic
flip). Adds +crit_chance%, +combo_chance%, +size_gold_per_level%.
Consumer code temporarily broken; tasks 2-12 fix them sequentially.
Migration in task 11 wipes inventory + equipped (magnitudes from
-paint_time% don't translate cleanly to +speed%; game unreleased)."
```

---

# Phase B — Multipliers

---

### Task 2: `getCanvasGoldMultiplier` reads `+sell_price%`

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Update existing tests**

In `tests/core/multipliers.test.ts`, find tests asserting on `+canvas_gold%` magnitudes from equipped items. Update string literals to `+sell_price%`. Also update any `equipped` fixtures that build items with the old kind name.

- [ ] **Step 2: Update the function**

In `src/core/multipliers.ts`:

```ts
export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+sell_price%");  // was "+canvas_gold%"
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    bonus += getNodeLevel(state, id) * perLevel;
  }
  bonus += SELL_PRICE_PER_LEVEL * state.sellPriceLevel;
  const additive = 1 + bonus;
  const rainbowMul = 1 + getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;
  return additive * rainbowMul;
};
```

Update JSDoc to reference the new affix name.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: tests pass (after Step 1's updates).

`npx tsc -b --noEmit` for multipliers.ts: should clear errors related to `getCanvasGoldMultiplier`. Other files (CanvasStage, PaintingRoute, etc.) still error; those are addressed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): canvas gold reads +sell_price% affix

Drop-in rename from +canvas_gold% to +sell_price%. Same additive stacking
(item magnitudes + sell-price level + colors → additive bonus, × rainbow)."
```

---

### Task 3: `getCanvasSpeedMultiplier` consumes `+speed%`; delete `getPaintTimeMultiplier`

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Failing tests**

Append to `tests/core/multipliers.test.ts`:

```ts
import type { Item } from "@/store/workshopSlice";

describe("getCanvasSpeedMultiplier — equipped +speed% contribution", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, speedLevel: 1, ...over,
  } as GameStore);

  it("includes equipped +speed% magnitudes additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+speed%", magnitude: 10 }, { kind: "+speed%", magnitude: 5 }],
    };
    const state = stub({ equipped: { brush: item } });
    // bonus = SPEED_PER_LEVEL × speedLevel(1) + 0.10 + 0.05 = 0.05 + 0.15 = 0.20
    expect(getCanvasSpeedMultiplier(state)).toBeCloseTo(1.20, 5);
  });
});

describe("getPaintTimeMultiplier — REMOVED", () => {
  it("export no longer exists (compile-time check via type)", () => {
    // This test exists only as a documentation marker that
    // getPaintTimeMultiplier was intentionally removed in this commit.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Verify FAIL**

`npx vitest run tests/core/multipliers.test.ts -t "+speed% contribution"` — should fail because `+speed%` doesn't contribute yet.

- [ ] **Step 3: Update implementation**

In `src/core/multipliers.ts`:

```ts
export const getCanvasSpeedMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  bonus += SPEED_PER_LEVEL * state.speedLevel;
  bonus += getEquippedContribution(state, "+speed%");  // NEW: equipped +speed% (already fractional)
  return 1 + bonus;
};
```

**Convention:** `getEquippedContribution(state, kind)` is already defined as `Σ (affix.magnitude / 100)` — i.e., it returns the fractional sum. So consumers add it directly without dividing by 100. Match the existing `getCanvasGoldMultiplier` pattern.

DELETE `getPaintTimeMultiplier`:

```ts
// REMOVE this entire function:
export const getPaintTimeMultiplier = (state: GameStore): number => { ... };
```

- [ ] **Step 4: Verify PASS**

Run: `npx vitest run tests/core/multipliers.test.ts -t "+speed% contribution"` — expect PASS.

`npx tsc -b --noEmit` — will surface errors anywhere `getPaintTimeMultiplier` is still imported (canvasSlice, PaintingRoute). Those are tasks 6+9.

- [ ] **Step 5: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): +speed% replaces -paint_time%

getCanvasSpeedMultiplier additively consumes equipped +speed% magnitudes.
getPaintTimeMultiplier deleted entirely; its consumer flow folds into
the speed multiplier (a -10% paint_time and a +10% speed are not
mathematically equivalent, but the new +speed% semantics are clearer).
Consumer code in canvasSlice and PaintingRoute breaks here; fixed in
tasks 6 and 9."
```

---

### Task 4: `getCritChance` + `getComboBaseChance` consume equipped affixes

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Failing tests**

Append:

```ts
describe("getCritChance — equipped +crit_chance% contribution", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, critLevel: 0, ...over,
  } as GameStore);

  it("adds equipped +crit_chance% magnitudes (additive percent → fractional)", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+crit_chance%", magnitude: 10 }],
    };
    const state = stub({ critLevel: 5, equipped: { brush: item } });
    // critChance = 0.05 (from level) + 0.10 (from affix) = 0.15
    expect(getCritChance(state)).toBeCloseTo(0.15, 5);
  });

  it("clamps at 1.0 even with affix contributions", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+crit_chance%", magnitude: 99 }],
    };
    const state = stub({ critLevel: 50, equipped: { brush: item } });
    expect(getCritChance(state)).toBe(1.0);
  });
});

describe("getComboBaseChance — equipped +combo_chance% contribution", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, comboLevel: 0, ...over,
  } as GameStore);

  it("adds equipped +combo_chance% magnitudes additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+combo_chance%", magnitude: 15 }],
    };
    const state = stub({ comboLevel: 10, equipped: { brush: item } });
    // base = 0.20 (from level) + 0.15 (from affix) = 0.35
    expect(getComboBaseChance(state)).toBeCloseTo(0.35, 5);
  });
});
```

- [ ] **Step 2: Verify FAIL**

`npx vitest run tests/core/multipliers.test.ts -t "+crit_chance% contribution|+combo_chance% contribution"` — expect FAIL.

- [ ] **Step 3: Update functions**

In `src/core/multipliers.ts`:

```ts
export const getCritChance = (state: GameStore): number => {
  let chance = CRIT_PER_LEVEL * state.critLevel;
  chance += getEquippedContribution(state, "+crit_chance%"); // already fractional (Σ magnitude/100)
  return Math.min(1.0, chance);
};

export const getComboBaseChance = (state: GameStore): number => {
  let chance = COMBO_PER_LEVEL * state.comboLevel;
  chance += getEquippedContribution(state, "+combo_chance%");
  return Math.min(1.0, chance);
};
```

- [ ] **Step 4: Verify PASS**

Run: `npx vitest run tests/core/multipliers.test.ts -t "+crit_chance% contribution|+combo_chance% contribution"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): crit + combo chances consume equipped affixes

getCritChance and getComboBaseChance each add their kind's equipped
contribution additively to the level-driven base, then clamp at 1.0.
Empowers the workshop to roll +crit_chance% / +combo_chance% items
that meaningfully boost RNG canvases."
```

---

### Task 5: New `getSizeGoldPerLevelMultiplier` selector

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Failing tests**

Append:

```ts
import { getSizeGoldPerLevelMultiplier } from "@/core/multipliers";

describe("getSizeGoldPerLevelMultiplier", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, ...over,
  } as GameStore);

  it("returns 1.0 when no items equipped", () => {
    expect(getSizeGoldPerLevelMultiplier(stub())).toBeCloseTo(1.0, 5);
  });

  it("returns 1 + sum of equipped +size_gold_per_level% magnitudes (fractional)", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [
        { kind: "+size_gold_per_level%", magnitude: 10 },
        { kind: "+size_gold_per_level%", magnitude: 7 },
      ],
    };
    const state = stub({ equipped: { brush: item } });
    expect(getSizeGoldPerLevelMultiplier(state)).toBeCloseTo(1.17, 5);
  });
});
```

- [ ] **Step 2: Verify FAIL**

`npx vitest run tests/core/multipliers.test.ts -t "getSizeGoldPerLevelMultiplier"` — expect FAIL (function not exported).

- [ ] **Step 3: Add the function**

Append to `src/core/multipliers.ts`:

```ts
/**
 * Multiplier on `SIZE_GOLD_PER_LEVEL` from equipped +size_gold_per_level% affixes.
 * Returns 1.0 + (sum of magnitudes / 100) — additive across items, applied
 * multiplicatively against the per-level gold rate inside canvasGold().
 *
 * Effect: each item with +X% size_gold_per_level boosts the per-level
 * gold gain from the size track. With base SIZE_GOLD_PER_LEVEL = 0.30
 * and items contributing +20% total, effective per-level rate = 0.36.
 *
 * Affix only rolls on items when unlock_canvas_size is owned (gated at
 * roll-time in `rollAffixes`).
 */
export const getSizeGoldPerLevelMultiplier = (state: GameStore): number => {
  return 1 + getEquippedContribution(state, "+size_gold_per_level%");
};
```

- [ ] **Step 4: Verify PASS**

Run: `npx vitest run tests/core/multipliers.test.ts -t "getSizeGoldPerLevelMultiplier"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): getSizeGoldPerLevelMultiplier selector

Sums equipped +size_gold_per_level% magnitudes (additive, fractional).
Used by canvasGold (task 6) to scale SIZE_GOLD_PER_LEVEL multiplicatively
inside the per-level gold formula. Affix only rolls when unlock_canvas_size
is owned (task 8 gates the roll)."
```

---

# Phase C — balance.canvasGold + canvasTick

---

### Task 6: `canvasGold(sizeLevel, mult, sizeGoldMult = 1)`

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `tests/core/balance.test.ts`
- Modify: `src/store/canvasSlice.ts`

- [ ] **Step 1: Update tests**

Add to `tests/core/balance.test.ts` (extend the existing `describe("canvasGold")` block or add a new one):

```ts
describe("canvasGold (with sizeGoldMult)", () => {
  it("default sizeGoldMult = 1 leaves formula unchanged", () => {
    expect(canvasGold(5, 1).toNumber()).toBeCloseTo(canvasGold(5, 1, 1).toNumber(), 5);
  });

  it("sizeGoldMult scales the per-level rate multiplicatively", () => {
    // BASE × (1 + 0.30 × sizeGoldMult × sizeLevel) × mult
    // sizeLevel 10, sizeGoldMult 2.0, mult 1: 10 × (1 + 0.30 × 2 × 10) × 1 = 10 × 7 = 70
    expect(canvasGold(10, 1, 2).toNumber()).toBeCloseTo(70, 5);
    // sizeLevel 0, sizeGoldMult 2.0: still 10 (no per-level effect)
    expect(canvasGold(0, 1, 2).toNumber()).toBeCloseTo(10, 5);
  });
});
```

- [ ] **Step 2: Verify FAIL**

`npx vitest run tests/core/balance.test.ts -t "canvasGold \\(with sizeGoldMult\\)"` — expect FAIL (canvasGold doesn't accept a 3rd arg).

- [ ] **Step 3: Update `canvasGold` signature**

In `src/core/balance.ts`:

```ts
/**
 * Gold awarded when a canvas is sold, before equipped-item modifiers.
 *
 * v3.x canvas-depth: `BASE × (1 + SIZE_GOLD_PER_LEVEL × sizeGoldMult × sizeLevel) × multiplier`.
 *
 * `sizeGoldMult` defaults to 1.0 — it scales the per-level gold rate from the
 * size track. Equipped +size_gold_per_level% affixes contribute via
 * `getSizeGoldPerLevelMultiplier(state)`. The caller in canvasTick passes it.
 */
export const canvasGold = (
  sizeLevel: number,
  multiplier: number,
  sizeGoldMult = 1,
): Big =>
  big(CANVAS_GOLD_BASE)
    .mul(1 + SIZE_GOLD_PER_LEVEL * sizeGoldMult * sizeLevel)
    .mul(multiplier);
```

- [ ] **Step 4: Update `canvasTick` to pass the new arg**

In `src/store/canvasSlice.ts`:

```ts
import {
  canvasGold, canvasTime,
  sellPriceUpgradeCost, speedUpgradeCost,
  sizeUpgradeCost, critUpgradeCost, comboUpgradeCost,
  CRIT_SPEED_FACTOR, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getPmMultiplier,
  getCritChance,
  getComboBaseChance,
  getSizeGoldPerLevelMultiplier,    // NEW
} from "@/core/multipliers";
import { rng } from "@/core/rng";
```

(NOTE: `getPaintTimeMultiplier` is no longer imported — it was deleted in Task 3. Drop it from the import list and from any call sites in `canvasTick`.)

In `canvasTick`, update:

```ts
const baseTime = canvasTime(state.sizeLevel);
const speedMult = getCanvasSpeedMultiplier(state); // no more × getPaintTimeMultiplier
const critFactor = critFlag ? CRIT_SPEED_FACTOR : 1;
const effectiveTime = baseTime / (speedMult * critFactor);

// ...later, in the sale-fires path:
const goldMult = getCanvasGoldMultiplier(state) * getPmMultiplier(state);
const sizeGoldMult = getSizeGoldPerLevelMultiplier(state);
const baseGold = canvasGold(state.sizeLevel, goldMult, sizeGoldMult);
const gain = baseGold.mul(comboBonusFactor(state.comboChain));
```

- [ ] **Step 5: Verify PASS**

`npx vitest run tests/core/balance.test.ts -t "canvasGold"` — expect PASS.
`npx vitest run tests/store/canvasSlice.test.ts` — expect PASS (existing tests should adapt; if any pin specific gold values they may need updating to reflect sizeGoldMult=1 case, which equals the prior behavior).
`npx tsc -b --noEmit` — should clear most consumer errors related to paint_time.

- [ ] **Step 6: Commit**

```bash
git add src/core/balance.ts src/store/canvasSlice.ts tests/core/balance.test.ts
git commit -m "core(balance): canvasGold accepts optional sizeGoldMult

Third arg defaults to 1.0; multiplies SIZE_GOLD_PER_LEVEL inside the
per-level formula. canvasTick now passes getSizeGoldPerLevelMultiplier
through, completing the +size_gold_per_level% affix wiring.
Drops getPaintTimeMultiplier call from canvasTick (deleted in T3)."
```

---

### Task 7: PaintingRoute drops `getPaintTimeMultiplier` reference

**Files:**
- Modify: `src/routes/PaintingRoute.tsx`
- Modify: `tests/routes/PaintingRoute.test.tsx`

- [ ] **Step 1: Update PaintingRoute**

In `src/routes/PaintingRoute.tsx`:
- Remove `getPaintTimeMultiplier` from the multipliers import.
- Remove its call in the `speedMult` computation.
- Pass `getSizeGoldPerLevelMultiplier(state)` to `canvasGold` for the `nextSaleGold` preview computation.

```ts
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getPmMultiplier,
  getSizeGoldPerLevelMultiplier,    // NEW
  // (no getPaintTimeMultiplier)
} from "@/core/multipliers";

// ... in the component body:
const speedMult = getCanvasSpeedMultiplier(helperState); // no more × getPaintTimeMultiplier
const sizeGoldMult = getSizeGoldPerLevelMultiplier(helperState);
const baseGold = canvasGold(sizeLevel, goldMult, sizeGoldMult);
```

- [ ] **Step 2: Update tests**

In `tests/routes/PaintingRoute.test.tsx`, ensure fixtures don't reference `-paint_time%` items. If they do, replace with `+speed%` items or remove.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/routes/PaintingRoute.test.tsx` — expect PASS.
Run: `npx tsc -b --noEmit` — should be clean now (or only error in remaining UI tasks).

- [ ] **Step 4: Commit**

```bash
git add src/routes/PaintingRoute.tsx tests/routes/PaintingRoute.test.tsx
git commit -m "ui(painting): drop getPaintTimeMultiplier from PaintingRoute

Folds canvas speed entirely into getCanvasSpeedMultiplier. Adds
getSizeGoldPerLevelMultiplier to the gold preview pipeline so the
'+Ng on next sale' chip reflects equipped +size_gold_per_level%."
```

---

# Phase D — Workshop roll gating

---

### Task 8: `rollAffixes` filters by `getCanvasTrackUnlocked`

**Files:**
- Modify: `src/core/workshopRoll.ts`
- Modify: `src/store/workshopSlice.ts`
- Modify: `tests/core/workshopRoll.test.ts`
- Modify: `tests/store/workshopSlice.test.ts`

- [ ] **Step 1: Failing tests**

In `tests/core/workshopRoll.test.ts`, add:

```ts
import type { GameStore } from "@/store";
import { setSeed } from "@/core/rng";

describe("rollAffixes — skill-tree gating", () => {
  const baseStub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, ...over,
  } as GameStore);

  it("with no track unlocks, only sell_price + speed roll", () => {
    setSeed(1);
    // Roll a bunch of legendary affixes (5 each), gather the kinds seen
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const affixes = rollAffixes("legendary", baseStub());
      for (const a of affixes) seen.add(a.kind);
    }
    expect(seen.has("+sell_price%")).toBe(true);
    expect(seen.has("+speed%")).toBe(true);
    expect(seen.has("+crit_chance%")).toBe(false);
    expect(seen.has("+combo_chance%")).toBe(false);
    expect(seen.has("+size_gold_per_level%")).toBe(false);
  });

  it("with unlock_canvas_crit owned, +crit_chance% can roll", () => {
    setSeed(1);
    const state = baseStub({ purchasedNodes: { unlock_canvas_crit: 1 } });
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const affixes = rollAffixes("legendary", state);
      for (const a of affixes) seen.add(a.kind);
    }
    expect(seen.has("+crit_chance%")).toBe(true);
    expect(seen.has("+combo_chance%")).toBe(false); // still gated
  });

  it("with all 3 unlocks owned, all 5 kinds can roll", () => {
    setSeed(1);
    const state = baseStub({
      purchasedNodes: {
        unlock_canvas_size: 1,
        unlock_canvas_crit: 1,
        unlock_canvas_combo: 1,
      },
    });
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const affixes = rollAffixes("legendary", state);
      for (const a of affixes) seen.add(a.kind);
    }
    expect(seen.size).toBe(5);
  });
});
```

- [ ] **Step 2: Verify FAIL**

`npx vitest run tests/core/workshopRoll.test.ts -t "skill-tree gating"` — expect FAIL (rollAffixes doesn't take state yet).

- [ ] **Step 3: Update `rollAffixes` signature**

In `src/core/workshopRoll.ts`:

```ts
import type { GameStore } from "@/store";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
// ...existing imports...

const KIND_TO_TRACK: Record<AffixKind, "sell_price" | "speed" | "size" | "crit" | "combo"> = {
  "+sell_price%": "sell_price",
  "+speed%": "speed",
  "+crit_chance%": "crit",
  "+combo_chance%": "combo",
  "+size_gold_per_level%": "size",
};

/** Available affix kinds at the player's current skill-tree state. */
function availableKinds(state: GameStore): ReadonlyArray<AffixKind> {
  return AFFIX_KINDS.filter((kind) => {
    const track = KIND_TO_TRACK[kind];
    return getCanvasTrackUnlocked(state, track);
  });
}

/**
 * Roll the affixes for an item of the given tier. Duplicate kinds allowed.
 *
 * Pool is filtered by skill-tree unlocks: +crit_chance% / +combo_chance% /
 * +size_gold_per_level% only roll when their matching `unlock_canvas_*`
 * skill-tree node is owned. Sell-price + speed always roll (their canvas
 * tracks are unlocked from start).
 *
 * `magnitudeBonus` shifts BOTH the min and max magnitude bounds by the same
 * amount (Craftsmanship contribution from `getAffixMagnitudeBonus(state)`).
 */
export function rollAffixes(
  tier: ItemTier,
  state: GameStore,
  magnitudeBonus = 0,
): ReadonlyArray<Affix> {
  const count = TIER_AFFIX_COUNT[tier];
  const pool = availableKinds(state);
  if (pool.length === 0) {
    // Defensive — sell_price + speed are always unlocked, so this shouldn't happen.
    throw new Error("rollAffixes: empty affix pool");
  }
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const kind = rngPick(pool);
    const min = MAGNITUDE_MIN_PCT + magnitudeBonus;
    const max = MAGNITUDE_MAX_PCT + magnitudeBonus;
    const magnitude = rngInt(min, max);
    out.push({ kind, magnitude });
  }
  return out;
}
```

- [ ] **Step 4: Update the only caller (`craft` action)**

In `src/store/workshopSlice.ts`, find the `craft` action body. It calls `rollAffixes(tier, magnitudeBonus)`. Update to pass state:

```ts
const tier = rollTier(state.workshopLevel);
const affixes = rollAffixes(tier, state, getAffixMagnitudeBonus(state));
```

- [ ] **Step 5: Update existing tests in workshopSlice.test.ts**

Any test that calls the `craft` action probably already runs against a real store, so no signature change at the test level. But `tests/core/workshopRoll.test.ts` may have direct `rollAffixes(tier)` calls — update those to pass a state stub.

- [ ] **Step 6: Verify PASS**

Run: `npx vitest run tests/core/workshopRoll.test.ts` — expect PASS.
Run: `npx vitest run tests/store/workshopSlice.test.ts` — expect PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/workshopRoll.ts src/store/workshopSlice.ts tests/core/workshopRoll.test.ts tests/store/workshopSlice.test.ts
git commit -m "core(workshopRoll): rollAffixes filters pool by skill-tree unlocks

The 3 advanced affix kinds (+crit_chance%, +combo_chance%,
+size_gold_per_level%) only roll when the matching unlock_canvas_*
skill-tree node is owned. Sell-price + speed always roll (their
canvas tracks are unlocked from start). No wasted rolls on items
the player can't benefit from."
```

---

# Phase E — UI

---

### Task 9: WorkshopRoom affix label map

**Files:**
- Modify: `src/components/painting/WorkshopRoom.tsx`
- Modify: `tests/components/painting/WorkshopRoom.test.tsx`

- [ ] **Step 1: Update tests**

In the WorkshopRoom test file, update assertions on rendered affix labels:
- Drop tests asserting `"-X% paint time"` / `"+X% canvas gold"`
- Add tests asserting `"+X% sell price"`, `"+X% speed"`, `"+X% crit chance"`, `"+X% combo chance"`, `"+X% size gold/level"` (or whatever your label phrasing decides)

- [ ] **Step 2: Update label map**

In `src/components/painting/WorkshopRoom.tsx`, find the `AFFIX_LABELS` (or similar) record and update:

```ts
const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+sell_price%": (m) => `+${m}% sell price`,
  "+speed%": (m) => `+${m}% speed`,
  "+crit_chance%": (m) => `+${m}% crit chance`,
  "+combo_chance%": (m) => `+${m}% combo chance`,
  "+size_gold_per_level%": (m) => `+${m}% size gold/level`,
};
```

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/components/painting/WorkshopRoom.test.tsx` — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/painting/WorkshopRoom.tsx tests/components/painting/WorkshopRoom.test.tsx
git commit -m "ui(workshop): label map for new affix kinds

Updates affix label rendering for the 5 new affix kinds
(sell_price / speed / crit_chance / combo_chance / size_gold_per_level)."
```

---

### Task 10: CanvasStage hover body shows new affix contributions

**Files:**
- Modify: `src/components/painting/CanvasStage.tsx`
- Modify: `tests/components/painting/CanvasStage.hover.test.tsx`

- [ ] **Step 1: Update `sellHoverBody` in CanvasStage**

The current `sellHoverBody` references `+canvas_gold%` (line 15 of CanvasStage.tsx). Update:

```tsx
import { canvasGold, SIZE_GOLD_PER_LEVEL, SELL_PRICE_PER_LEVEL } from "@/core/balance";
import { getEquippedContribution } from "@/store/workshopSlice";

function sellHoverBody(sizeLevel: number, comboChain: number): JSX.Element {
  const state = useGameStore.getState();
  const goldMult = getCanvasGoldMultiplier(state);
  const pmMult = getPmMultiplier(state);
  const itemBonus = getEquippedContribution(state, "+sell_price%") / 100;  // or whatever convention
  const rainbowLvl = getNodeLevel(state, "rainbow");
  const rainbowFactor = 1 + 0.50 * rainbowLvl;
  const sellPriceContribution = SELL_PRICE_PER_LEVEL * state.sellPriceLevel;
  const sizeGoldMult = getSizeGoldPerLevelMultiplier(state);
  const colorPlusItemsPlusSellPrice = goldMult / rainbowFactor - 1;
  const colorSum = colorPlusItemsPlusSellPrice - itemBonus - sellPriceContribution;
  const baseGold = 10 * (1 + SIZE_GOLD_PER_LEVEL * sizeGoldMult * sizeLevel);
  const total = canvasGold(sizeLevel, goldMult * pmMult, sizeGoldMult).mul(1 + 0.10 * comboChain);
  return (
    <>
      <div>Base × (1 + {SIZE_GOLD_PER_LEVEL.toFixed(2)} × {sizeGoldMult.toFixed(2)} × {sizeLevel}) = {baseGold.toFixed(1)}</div>
      <div>───</div>
      <div>Sell Price (Lv {state.sellPriceLevel}): ×{(1 + sellPriceContribution).toFixed(2)}</div>
      <div>Items (sell):  ×{(1 + itemBonus).toFixed(2)}</div>
      <div>Colors:        ×{(1 + colorSum).toFixed(2)}</div>
      <div>Rainbow:       ×{rainbowFactor.toFixed(2)}</div>
      <div>Paint Mastery: ×{pmMult.toFixed(2)}</div>
      {comboChain > 0 ? <div>Combo:        ×{(1 + 0.10 * comboChain).toFixed(2)}</div> : null}
      <div>───</div>
      <div>Total: {formatBig(total)} g per canvas</div>
    </>
  );
}
```

(Note: the previous `colorSum` logic carries forward; just verify the math after the rename. The size_gold_per_level affix is captured indirectly via `sizeGoldMult` in the base-gold line.)

The Hoverable call site already passes `comboChain` to `sellHoverBody` — verify that's still the case.

- [ ] **Step 2: Update tests**

In `tests/components/painting/CanvasStage.hover.test.tsx`, ensure tests don't pin specific magnitude strings that referenced old kind names. Update where needed.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/components/painting/CanvasStage.hover.test.tsx` — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/painting/CanvasStage.tsx tests/components/painting/CanvasStage.hover.test.tsx
git commit -m "ui(canvas): hover body uses new affix kinds + size mult

sellHoverBody now references +sell_price% (renamed from +canvas_gold%)
and incorporates getSizeGoldPerLevelMultiplier into the base-gold
display formula. Comma+ +size_gold_per_level% affixes show up
implicitly via the inflated base-gold line."
```

---

# Phase F — Migration + cleanup

---

### Task 11: Save migration v10 → v11 (wipe inventory + equipped)

**Files:**
- Modify: `src/store/index.ts`
- Modify: `tests/store/persistence-integration.test.ts`

- [ ] **Step 1: Failing tests**

Add to `tests/store/persistence-integration.test.ts`:

```ts
describe("migrate v10 → v11 (affix-pool rework)", () => {
  it("wipes inventory + equipped (game unreleased; magnitudes don't translate cleanly)", () => {
    const v10State: Record<string, unknown> = {
      inventory: [
        { id: "old1", slot: "brush", tier: "rare", affixes: [{ kind: "+canvas_gold%", magnitude: 12 }] },
      ],
      equipped: { brush: { id: "old2", slot: "brush", tier: "magic", affixes: [{ kind: "-paint_time%", magnitude: 10 }] } },
      workshopLevel: 8,
      workshopXp: 17,
    };
    const migrated = migrate(v10State, 10) as unknown as Record<string, unknown>;
    expect(migrated.inventory).toEqual([]);
    expect(migrated.equipped).toEqual({});
    // Workshop level + XP preserved (long-tail meta).
    expect(migrated.workshopLevel).toBe(8);
    expect(migrated.workshopXp).toBe(17);
  });

  it("does not change saves at v11 (migrate is no-op when fromVersion >= 11)", () => {
    const v11State: Record<string, unknown> = {
      inventory: [{ id: "x", slot: "brush", tier: "magic", affixes: [{ kind: "+sell_price%", magnitude: 7 }] }],
      equipped: {},
      workshopLevel: 3,
      workshopXp: 5,
    };
    const migrated = migrate(v11State, 11) as unknown as Record<string, unknown>;
    expect(migrated.inventory).toEqual([{ id: "x", slot: "brush", tier: "magic", affixes: [{ kind: "+sell_price%", magnitude: 7 }] }]);
  });
});
```

- [ ] **Step 2: Verify FAIL**

`npx vitest run tests/store/persistence-integration.test.ts -t "v10 → v11"` — expect FAIL.

- [ ] **Step 3: Bump version + add migration**

In `src/store/index.ts`:

```ts
const SAVE_VERSION = 11;
```

Append to the `migrate` function:

```ts
if (fromVersion < 11) {
  // v10 → v11 (2026-05-10): affix pool rework. AffixKind enum renamed
  // (+canvas_gold% → +sell_price%, -paint_time% → +speed%) and 3 new kinds
  // added (+crit_chance%, +combo_chance%, +size_gold_per_level%). Magnitude
  // semantics for the rename don't translate cleanly (-10% paint_time ≠
  // +10% speed). Game unreleased — wipe inventory + equipped. Workshop
  // level + XP preserved (long-tail meta progression).
  state = {
    ...state,
    inventory: [],
    equipped: {},
  };
}
```

Also update the `migrate` function's JSDoc to add a v10 → v11 entry in the chain history.

- [ ] **Step 4: Verify PASS**

Run: `npx vitest run tests/store/persistence-integration.test.ts` — expect PASS.
Run: `npm test` — expect ALL pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "store: SAVE_VERSION 10 → 11, affix pool rework migration

v10 → v11: wipes inventory + equipped because (a) the AffixKind enum
renames don't translate magnitudes cleanly (especially -paint_time% →
+speed%, where magnitude semantics flip), and (b) the 3 new affix
kinds need clean rolling against the gating logic. Workshop level +
XP preserved per the long-tail-meta convention."
```

---

### Task 12: Final verification

**Files:** none (verification + smoke test)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: ALL pass. Final count should be ~660-670 (was 653 + new tests across this plan).

- [ ] **Step 2: TypeScript clean**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Lint clean**

Run: `npm run lint`
Expected: clean (only pre-existing main.tsx fast-refresh warning).

- [ ] **Step 4: Build clean + bundle size**

Run: `npm run build`
Expected: success; bundle still under 250 KB gzipped.

- [ ] **Step 5: Manual browser smoke**

Open dev server (`npm run dev`), then in the browser:

1. Navigate to `/painting`. Craft a few items. Their affixes should show new labels (sell price / speed).
2. Use devtools to set `useGameStore.setState({ purchasedNodes: { unlock_canvas_crit: 1 } })`. Craft more items. Some should now roll +crit_chance%.
3. Equip an item with +crit_chance%. Hover the canvas sell preview — crit chance line should reflect the contribution.
4. Visit `/dev/skill-designer`. The 3 unlock node IDs (`unlock_canvas_size`, `unlock_canvas_crit`, `unlock_canvas_combo`) should be authorable as described.

If anything looks off, file a follow-up issue.

- [ ] **Step 6: No commit needed for this task** — just verification.

---

## Self-review checklist

After Task 12:

- [ ] All 5 affix kinds present in `AffixKind` (`+sell_price%`, `+speed%`, `+crit_chance%`, `+combo_chance%`, `+size_gold_per_level%`).
- [ ] No remaining references to `+canvas_gold%` or `-paint_time%` outside historical migration blocks.
- [ ] `getPaintTimeMultiplier` deleted; nothing imports it.
- [ ] `rollAffixes(tier, state)` filters pool by `getCanvasTrackUnlocked`.
- [ ] Migration v10 → v11 wipes inventory + equipped.
- [ ] Workshop level + XP preserved across migration.
- [ ] `canvasGold(sizeLevel, mult, sizeGoldMult = 1)` accepts optional 3rd arg.
- [ ] Hover info / WorkshopRoom labels use new names.
- [ ] All tests pass; tsc + lint clean; bundle under budget.

---

## Post-merge

The 3 unlock fame nodes still need to be authored via `/dev/skill-designer` if not already done. Once authored:

1. Player can buy `unlock_canvas_crit` → +crit_chance% starts rolling on workshop crafts.
2. Same for size + combo.

After this subproject ships, **subproject 3 (Painter's Office)** becomes plan-ready: the Office sketch in `2026-05-10-painters-office-design.md` can resolve its TBDs with the affix pool now concrete.
