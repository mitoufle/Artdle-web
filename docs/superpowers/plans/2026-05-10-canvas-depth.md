# Canvas Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing single `canvasTier` upgrade with 5 independent leveled tracks (sell price, completion speed, size, crit, combo). Sell price + speed unlocked from start; size/crit/combo gated by user-authored fame skill-tree nodes. Lays the §6 affix-pool contract for subproject 2 (affix pool rework) and subproject 3 (Painter's Office).

**Architecture:** Pure-logic formulas in `src/core/balance.ts` + new `core/multipliers.ts` selectors for crit / combo. The `canvasSlice` schema swaps `canvasTier: number` for five level fields plus `comboChain` and `isCritThisCanvas`. `canvasTick` rolls crit lazily on the first tick of every canvas and rolls combo at sale time. UI mounts 5 `<TrackCard>` instances in the existing 5-cell `<CanvasUpgradesStrip>` (replacing the single `<TierCard>`); `<CanvasStage>` gains combo + crit badges. Save migration v9 → v10 wipes the old tier field and seeds the new defaults. No new affix kinds in this plan — that handshake (§6 of the spec) is subproject 2's job.

**Tech Stack:** React 19 + TypeScript strict + Vite + Zustand 5 + Vitest + RTL. `break_eternity.js` Bigs for gold; existing `core/rng.ts` for crit + combo rolls.

**Spec:** `docs/superpowers/specs/2026-05-10-canvas-depth-design.md` (committed in 9e6d1c5).

---

## File structure

### New files

| File | Responsibility |
|---|---|
| `src/components/painting/TrackCard.tsx` | Parameterised upgrade-track tile. Renders one of the 5 tracks; reads level/cost/effect/locked state from props. |
| `src/components/painting/TrackCard.module.css` | Tile styling + locked-state styling. |
| `tests/components/painting/TrackCard.test.tsx` | Unit + RTL tests. |

### Modified files

| File | Change |
|---|---|
| `src/core/balance.ts` | Add per-track tuning constants + 5 cost formulas + new `canvasGold(sizeLevel, mult)` + new `canvasTime(sizeLevel)` + `comboBonusFactor` + `comboEffectiveChance`. Drop `tierUpgradeCost`, `MAX_TIER` (after Task 16). |
| `src/core/multipliers.ts` | `getCanvasGoldMultiplier` reads `sellPriceLevel`. `getCanvasSpeedMultiplier` reads `speedLevel`. Add `getCritChance` + `getComboBaseChance`. |
| `src/store/canvasSlice.ts` | New state fields: `sellPriceLevel`, `speedLevel`, `sizeLevel`, `critLevel`, `comboLevel`, `comboChain`, `isCritThisCanvas`. New actions: `upgradeSellPrice`, `upgradeSpeed`, `upgradeSize`, `upgradeCrit`, `upgradeCombo`. Modified `canvasTick`. Drop `canvasTier` + `upgradeTier`. |
| `src/store/skillTreeSlice.ts` | New selector `getCanvasTrackUnlocked(state, trackId)`. |
| `src/store/index.ts` | `SAVE_VERSION` 9 → 10. Add v9 → v10 migration block. |
| `src/components/painting/CanvasStage.tsx` | Rename `tier` prop → `sizeLevel`. Add combo chain badge. Add crit indicator. Update `sellHoverBody` formula. |
| `src/components/painting/CanvasStage.module.css` | Combo badge + crit overlay styles. |
| `src/routes/PaintingRoute.tsx` | Replace single `<TierCard>` with 5 `<TrackCard>` instances. Read new state fields. |
| `src/components/painting/CanvasUpgradesStrip.tsx` | No code change (already 5-cell grid). Update doc comment. |

### Deleted files (Task 16)

| File | Reason |
|---|---|
| `src/components/painting/TierCard.tsx` | Replaced by parameterised `<TrackCard>`. |
| `src/components/painting/TierCard.module.css` | Same. |
| `tests/components/painting/TierCard.test.tsx` (if exists) | Same. |

### Test files touched

- `tests/core/balance.test.ts` — drop tier formula tests; add per-track formula tests.
- `tests/core/multipliers.test.ts` — update gold/speed multiplier tests for new state shape; add crit + combo chance tests.
- `tests/store/canvasSlice.test.ts` — drop tier/upgradeTier tests; add per-track action tests; update tick tests for crit + combo paths.
- `tests/store/skillTreeSlice.test.ts` — add `getCanvasTrackUnlocked` tests.
- `tests/store/persistence-integration.test.ts` — add v9 → v10 round-trip case; update fixtures.
- `tests/systems/ascend.test.ts` — fixtures for new canvas state shape; assert reset clears all 5 levels + chain.
- `tests/routes/PaintingRoute.test.tsx` (if exists) — fixtures + new TrackCard render assertions.

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Pure-logic balance foundation | 1–4 |
| **B** | Slice state + actions (additive) | 5–8 |
| **C** | Multipliers + tick rewrite | 9–11 |
| **D** | UI — TrackCard + CanvasStage | 12–15 |
| **E** | Migration + legacy cleanup | 16–17 |

Each task: TDD where applicable. Tests first; impl follows; commit per task. After every task: `npx tsc -b --noEmit` clean and `npm test` green for the touched files.

---

## Pre-flight checks (do once before Task 1)

- [ ] Working tree clean. On `main`. HEAD recent.
- [ ] Baseline: `npm test` reports 628/628 passing.
- [ ] `npx tsc -b --noEmit` clean.
- [ ] Re-read `docs/superpowers/specs/2026-05-10-canvas-depth-design.md` end-to-end.

---

## Default tuning constants (used in code below)

These are the spec §10 defaults the implementation tasks bake in. Tunable later in a balance pass.

| Constant | Value | Meaning |
|---|---|---|
| `SELL_PRICE_PER_LEVEL` | `0.10` | +10% gold per level (additive) |
| `SPEED_PER_LEVEL` | `0.05` | +5% speed per level (additive) |
| `SIZE_GOLD_PER_LEVEL` | `0.30` | +30% gold per size level (additive on the BASE) |
| `SIZE_TIME_PER_LEVEL` | `0.15` | +15% time per size level (additive on the BASE) |
| `CRIT_PER_LEVEL` | `0.01` | +1% crit chance per level |
| `CRIT_SPEED_FACTOR` | `10` | Crit canvases paint in `time / 10` (= 90% faster) |
| `COMBO_PER_LEVEL` | `0.02` | +2% base combo chance per level |
| `COMBO_PER_LINK` | `0.10` | +10% gold per chain link |
| `COMBO_DECAY_PER_LINK` | `0.05` | -5pp effective combo chance per current link |
| `SELL_PRICE_COST_BASE` | `100` | g cost at L1 for sell price upgrade |
| `SPEED_COST_BASE` | `100` | same |
| `SIZE_COST_BASE` | `1000` | g cost at L1 for size upgrade |
| `CRIT_COST_BASE` | `5000` | same |
| `COMBO_COST_BASE` | `5000` | same |
| `TRACK_COST_GROWTH` | `1.5` | exponential growth factor for all 5 tracks (cost = base × growth^(level - 1)) |
| `CANVAS_GOLD_BASE` | `10` (existing) | unchanged BASE |
| `CANVAS_TIME_BASE` | `2` | new BASE — equal to current `tier=1` paint time |

---

# Phase A — Pure-logic balance foundation

---

### Task 1: Add canvas-depth tuning constants in `core/balance.ts`

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `tests/core/balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/balance.test.ts` (just before the file's closing `});` of its outer describe; if the file uses top-level describes, add a new top-level describe block):

```ts
// ============================================================================
// Canvas depth — tuning constants (spec §10 defaults)
// ============================================================================
import {
  SELL_PRICE_PER_LEVEL,
  SPEED_PER_LEVEL,
  SIZE_GOLD_PER_LEVEL,
  SIZE_TIME_PER_LEVEL,
  CRIT_PER_LEVEL,
  CRIT_SPEED_FACTOR,
  COMBO_PER_LEVEL,
  COMBO_PER_LINK,
  COMBO_DECAY_PER_LINK,
  SELL_PRICE_COST_BASE,
  SPEED_COST_BASE,
  SIZE_COST_BASE,
  CRIT_COST_BASE,
  COMBO_COST_BASE,
  TRACK_COST_GROWTH,
  CANVAS_TIME_BASE,
} from "@/core/balance";

describe("canvas-depth tuning constants", () => {
  it("exposes per-level rates matching spec §10 defaults", () => {
    expect(SELL_PRICE_PER_LEVEL).toBeCloseTo(0.10, 5);
    expect(SPEED_PER_LEVEL).toBeCloseTo(0.05, 5);
    expect(SIZE_GOLD_PER_LEVEL).toBeCloseTo(0.30, 5);
    expect(SIZE_TIME_PER_LEVEL).toBeCloseTo(0.15, 5);
    expect(CRIT_PER_LEVEL).toBeCloseTo(0.01, 5);
    expect(CRIT_SPEED_FACTOR).toBe(10);
    expect(COMBO_PER_LEVEL).toBeCloseTo(0.02, 5);
    expect(COMBO_PER_LINK).toBeCloseTo(0.10, 5);
    expect(COMBO_DECAY_PER_LINK).toBeCloseTo(0.05, 5);
  });

  it("exposes per-track cost bases + shared growth factor", () => {
    expect(SELL_PRICE_COST_BASE).toBe(100);
    expect(SPEED_COST_BASE).toBe(100);
    expect(SIZE_COST_BASE).toBe(1000);
    expect(CRIT_COST_BASE).toBe(5000);
    expect(COMBO_COST_BASE).toBe(5000);
    expect(TRACK_COST_GROWTH).toBeCloseTo(1.5, 5);
  });

  it("exposes new canvas time base", () => {
    expect(CANVAS_TIME_BASE).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts -t "canvas-depth tuning constants"`
Expected: FAIL — modules not exporting these names yet.

- [ ] **Step 3: Add the constants**

Insert into `src/core/balance.ts` after the existing `XP_PER_CRAFT` line (around line 25):

```ts
// ============================================================================
// Canvas depth — see docs/superpowers/specs/2026-05-10-canvas-depth-design.md
// ============================================================================
/** +10% gold per sell-price level (additive). */
export const SELL_PRICE_PER_LEVEL = 0.10;
/** +5% speed per speed level (additive). */
export const SPEED_PER_LEVEL = 0.05;
/** +30% gold per size level (additive on BASE). */
export const SIZE_GOLD_PER_LEVEL = 0.30;
/** +15% time per size level (additive on BASE). */
export const SIZE_TIME_PER_LEVEL = 0.15;
/** +1% crit chance per crit level. */
export const CRIT_PER_LEVEL = 0.01;
/** Crit canvases paint in `time / CRIT_SPEED_FACTOR`. Fixed at 10× (= 90% faster). */
export const CRIT_SPEED_FACTOR = 10;
/** +2% base combo chance per combo level. */
export const COMBO_PER_LEVEL = 0.02;
/** +10% gold per chain link. */
export const COMBO_PER_LINK = 0.10;
/** -5 percentage points off effective combo chance per current chain link. */
export const COMBO_DECAY_PER_LINK = 0.05;

/** Cost in gold at level 1 for the sell-price upgrade. */
export const SELL_PRICE_COST_BASE = 100;
export const SPEED_COST_BASE = 100;
export const SIZE_COST_BASE = 1000;
export const CRIT_COST_BASE = 5000;
export const COMBO_COST_BASE = 5000;
/** Shared exponential growth factor for all 5 track cost curves: cost = base × growth^(level-1). */
export const TRACK_COST_GROWTH = 1.5;

/** Base paint time at sizeLevel = 0, before speed multipliers. Matches the v1.1 tier-1 baseline. */
export const CANVAS_TIME_BASE = 2;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/balance.test.ts -t "canvas-depth tuning constants"`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): add canvas-depth tuning constants

Adds per-level rates and cost bases for the 5 new upgrade tracks
(sell price, speed, size, crit, combo). Spec §10 defaults; tunable
later. No formulas yet — those follow in tasks 2-4."
```

---

### Task 2: New `canvasGold(sizeLevel, mult)` + `canvasTime(sizeLevel)` formulas

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `tests/core/balance.test.ts`

**Note:** This task replaces the formulas of the existing exports `canvasGold` and `canvasTime`. Their *names* stay the same, but their semantics change from "tier-driven" to "sizeLevel-driven." Callers (`canvasSlice`, `CanvasStage`, `TierCard`, `PaintingRoute`) still pass a `number`, which means existing call sites continue to compile but now produce wrong values from the gameplay perspective. Subsequent tasks fix those call sites. This is intentional: TS stays green, semantic-only churn lives between tasks 2 and 11.

- [ ] **Step 1: Locate the existing tests**

Open `tests/core/balance.test.ts`. Find tests for `canvasGold` and `canvasTime` (likely around `describe("canvasGold")` and `describe("canvasTime")`). These currently assert the `tier²` and `tier × 2` shapes.

- [ ] **Step 2: Replace those test bodies**

Replace those `describe` blocks with:

```ts
describe("canvasGold (size-driven)", () => {
  it("returns BASE × (1 + SIZE_GOLD_PER_LEVEL × sizeLevel) × multiplier", () => {
    // sizeLevel 0, mult 1 → BASE × 1 × 1 = 10
    expect(canvasGold(0, 1).toNumber()).toBeCloseTo(10, 5);
    // sizeLevel 10, mult 1 → 10 × (1 + 0.3 × 10) = 40
    expect(canvasGold(10, 1).toNumber()).toBeCloseTo(40, 5);
    // sizeLevel 5, mult 2 → 10 × 2.5 × 2 = 50
    expect(canvasGold(5, 2).toNumber()).toBeCloseTo(50, 5);
  });

  it("scales linearly in sizeLevel (not quadratically)", () => {
    const a = canvasGold(0, 1).toNumber();
    const b = canvasGold(1, 1).toNumber();
    const c = canvasGold(2, 1).toNumber();
    expect(b - a).toBeCloseTo(c - b, 5);
  });
});

describe("canvasTime (size-driven)", () => {
  it("returns CANVAS_TIME_BASE × (1 + SIZE_TIME_PER_LEVEL × sizeLevel)", () => {
    // sizeLevel 0 → 2 × 1 = 2 (matches old tier-1 baseline)
    expect(canvasTime(0)).toBeCloseTo(2, 5);
    // sizeLevel 10 → 2 × 2.5 = 5
    expect(canvasTime(10)).toBeCloseTo(5, 5);
    // sizeLevel 4 → 2 × 1.6 = 3.2
    expect(canvasTime(4)).toBeCloseTo(3.2, 5);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts -t "canvasGold|canvasTime"`
Expected: FAIL — old formulas (tier² for gold, tier × 2 for time) produce different numbers.

- [ ] **Step 4: Replace the formulas in `src/core/balance.ts`**

Find the existing `canvasGold` and `canvasTime` definitions and replace them with:

```ts
/**
 * Gold awarded when a canvas is sold, before equipped-item modifiers.
 *
 * v3.x canvas-depth: `BASE × (1 + SIZE_GOLD_PER_LEVEL × sizeLevel) × multiplier`.
 * Replaces the tier² form.
 *
 * `multiplier` is the aggregated canvas-gold multiplier from skill tree + items
 * + sell-price level + PM mult (composed by the caller in `canvasTick`).
 */
export const canvasGold = (sizeLevel: number, multiplier: number): Big =>
  big(CANVAS_GOLD_BASE)
    .mul(1 + SIZE_GOLD_PER_LEVEL * sizeLevel)
    .mul(multiplier);

/**
 * Paint time per canvas in seconds, before any speed multipliers.
 *
 * v3.x canvas-depth: `CANVAS_TIME_BASE × (1 + SIZE_TIME_PER_LEVEL × sizeLevel)`.
 * Replaces the linear-in-tier form.
 *
 * sizeLevel 0 = 2 s (matches the v1.1 tier-1 baseline).
 */
export const canvasTime = (sizeLevel: number): number =>
  CANVAS_TIME_BASE * (1 + SIZE_TIME_PER_LEVEL * sizeLevel);
```

- [ ] **Step 5: Run all balance tests to verify**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: New canvas-depth tests pass; old tier-related canvas tests removed (replaced).

If other balance tests fail because of unrelated assumptions about `canvasGold`/`canvasTime`, update those tests to reflect the new semantics.

- [ ] **Step 6: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): canvasGold/canvasTime now size-level driven

Replaces tier² gold scaling and linear-in-tier time scaling with the
size-level form from canvas-depth spec §3.3. Function names unchanged,
parameter renamed tier→sizeLevel; existing call sites still compile
(same Number signature) but produce new gameplay values until the slice
is rewired in task 11."
```

---

### Task 3: Per-track upgrade cost formulas

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `tests/core/balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/balance.test.ts`:

```ts
import {
  sellPriceUpgradeCost,
  speedUpgradeCost,
  sizeUpgradeCost,
  critUpgradeCost,
  comboUpgradeCost,
} from "@/core/balance";

describe("per-track upgrade costs", () => {
  // Contract: formula(currentLevel) = cost to advance FROM currentLevel TO currentLevel+1.
  // Formula shape: base × TRACK_COST_GROWTH^currentLevel.
  // Mirrors the project's existing tierUpgradeCost(currentTier) and craftCost(level) contract.

  it("sellPriceUpgradeCost: 100 × 1.5^level", () => {
    expect(sellPriceUpgradeCost(0).toNumber()).toBeCloseTo(100, 5);
    expect(sellPriceUpgradeCost(1).toNumber()).toBeCloseTo(150, 5);
    expect(sellPriceUpgradeCost(2).toNumber()).toBeCloseTo(225, 5);
    expect(sellPriceUpgradeCost(10).toNumber()).toBeCloseTo(100 * 1.5 ** 10, 0);
  });

  it("speedUpgradeCost shares base 100 with sell-price", () => {
    expect(speedUpgradeCost(0).toNumber()).toBeCloseTo(100, 5);
    expect(speedUpgradeCost(5).toNumber()).toBeCloseTo(100 * 1.5 ** 5, 1);
  });

  it("sizeUpgradeCost uses base 1000", () => {
    expect(sizeUpgradeCost(0).toNumber()).toBeCloseTo(1000, 5);
    expect(sizeUpgradeCost(5).toNumber()).toBeCloseTo(1000 * 1.5 ** 5, 0);
  });

  it("critUpgradeCost and comboUpgradeCost share base 5000", () => {
    expect(critUpgradeCost(0).toNumber()).toBeCloseTo(5000, 5);
    expect(comboUpgradeCost(0).toNumber()).toBeCloseTo(5000, 5);
    expect(critUpgradeCost(3).toNumber()).toBeCloseTo(5000 * 1.5 ** 3, 0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/core/balance.test.ts -t "per-track upgrade costs"`
Expected: FAIL — modules don't export these.

- [ ] **Step 3: Add the formulas**

Append to `src/core/balance.ts` (after `xpToNext`):

```ts
/**
 * Gold cost to upgrade a track from `currentLevel` to `currentLevel + 1`.
 * Shared shape: `BASE × TRACK_COST_GROWTH^currentLevel`. Per-track BASEs differ.
 *
 * Mirrors the contract of the existing `tierUpgradeCost(currentTier)` and
 * `craftCost(level)` — the parameter is the CURRENT level (the player's
 * stored value), and the function returns the cost of the NEXT step.
 *
 * For tracks starting at L0 (size/crit/combo), first buy uses formula(0) = base.
 * For tracks starting at L1 (sell-price/speed), first buy uses formula(1) = base × 1.5.
 * No level cap.
 */
export const sellPriceUpgradeCost = (currentLevel: number): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const speedUpgradeCost = (currentLevel: number): Big =>
  big(SPEED_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const sizeUpgradeCost = (currentLevel: number): Big =>
  big(SIZE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const critUpgradeCost = (currentLevel: number): Big =>
  big(CRIT_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const comboUpgradeCost = (currentLevel: number): Big =>
  big(COMBO_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/core/balance.test.ts -t "per-track upgrade costs"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): per-track upgrade cost formulas

Adds sellPriceUpgradeCost / speedUpgradeCost / sizeUpgradeCost /
critUpgradeCost / comboUpgradeCost — all share TRACK_COST_GROWTH=1.5
exponential with per-track bases (100, 100, 1000, 5000, 5000)."
```

---

### Task 4: Combo bonus + effective-chance formulas

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `tests/core/balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { comboBonusFactor, comboEffectiveChance } from "@/core/balance";

describe("combo formulas", () => {
  it("comboBonusFactor(0) = 1 (no chain → no bonus)", () => {
    expect(comboBonusFactor(0)).toBeCloseTo(1, 5);
  });

  it("comboBonusFactor(N) = 1 + COMBO_PER_LINK × N", () => {
    expect(comboBonusFactor(1)).toBeCloseTo(1.10, 5);
    expect(comboBonusFactor(5)).toBeCloseTo(1.50, 5);
    expect(comboBonusFactor(10)).toBeCloseTo(2.00, 5);
  });

  it("comboEffectiveChance: base × (1 - DECAY × chain), clamped at 0", () => {
    // base 0.50, chain 0 → 0.50
    expect(comboEffectiveChance(0.50, 0)).toBeCloseTo(0.50, 5);
    // base 0.50, chain 5 → 0.50 × (1 - 0.05×5) = 0.50 × 0.75 = 0.375
    expect(comboEffectiveChance(0.50, 5)).toBeCloseTo(0.375, 5);
    // base 0.10, chain 25 → 0.10 × (1 - 1.25) = -0.025 → clamped at 0
    expect(comboEffectiveChance(0.10, 25)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/core/balance.test.ts -t "combo formulas"`
Expected: FAIL.

- [ ] **Step 3: Add the formulas**

Append to `src/core/balance.ts`:

```ts
/**
 * Multiplier on canvas gold from the current combo chain.
 * `1 + COMBO_PER_LINK × chain`. chain=0 → 1.0 (no bonus).
 */
export const comboBonusFactor = (chain: number): number =>
  1 + COMBO_PER_LINK * chain;

/**
 * Effective combo trigger chance after decay-per-link is applied.
 * `base × (1 - COMBO_DECAY_PER_LINK × chain)`, clamped at 0 (no negative chance).
 */
export const comboEffectiveChance = (base: number, chain: number): number =>
  Math.max(0, base * (1 - COMBO_DECAY_PER_LINK * chain));
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/core/balance.test.ts -t "combo formulas"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): combo bonus + effective-chance formulas

comboBonusFactor(chain) returns 1 + 0.10 × chain (gold multiplier from
the current chain length). comboEffectiveChance(base, chain) applies
self-limiting decay of -5pp per link, clamped at 0."
```

---

# Phase B — Slice state + actions (additive)

---

### Task 5: Add new state fields to `canvasSlice` (additive — `canvasTier` stays)

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `tests/store/canvasSlice.test.ts`

This task is additive: the new five level fields + `comboChain` + `isCritThisCanvas` join `canvasTier` (which is removed in Task 16). At the end of this task, the slice has both schemas, both compile, both work.

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/canvasSlice.test.ts`:

```ts
describe("canvasSlice — new track state fields", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState }); // resets canvas portion
  });

  it("starts with sellPriceLevel=1 and speedLevel=1 (unlocked tracks)", () => {
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(1);
    expect(s.speedLevel).toBe(1);
  });

  it("starts with sizeLevel=0, critLevel=0, comboLevel=0 (gated tracks)", () => {
    const s = useGameStore.getState();
    expect(s.sizeLevel).toBe(0);
    expect(s.critLevel).toBe(0);
    expect(s.comboLevel).toBe(0);
  });

  it("starts with comboChain=0 and isCritThisCanvas=false", () => {
    const s = useGameStore.getState();
    expect(s.comboChain).toBe(0);
    expect(s.isCritThisCanvas).toBe(false);
  });

  it("resetCanvas restores all five levels + chain + crit flag", () => {
    useGameStore.setState({
      sellPriceLevel: 7, speedLevel: 4, sizeLevel: 5,
      critLevel: 3, comboLevel: 2, comboChain: 4, isCritThisCanvas: true,
    } as Parameters<typeof useGameStore.setState>[0]);
    useGameStore.getState().resetCanvas();
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(1);
    expect(s.speedLevel).toBe(1);
    expect(s.sizeLevel).toBe(0);
    expect(s.critLevel).toBe(0);
    expect(s.comboLevel).toBe(0);
    expect(s.comboChain).toBe(0);
    expect(s.isCritThisCanvas).toBe(false);
  });
});
```

(Make sure `initialCanvasState` is imported at the top of the test file — most test files already import it.)

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "new track state fields"`
Expected: FAIL — fields are `undefined`.

- [ ] **Step 3: Add the fields to `CanvasState` and `initialCanvasState`**

Edit `src/store/canvasSlice.ts`. Update the `CanvasState` interface (additive — keep `canvasTier` for now):

```ts
export interface CanvasState {
  /** Seconds painted on the current canvas. */
  canvasProgress: number;
  /** v1.1 tier (LEGACY — removed in canvas-depth Task 16). */
  canvasTier: number;
  /** New canvas-depth: sell-price track level (unlocked from start). */
  sellPriceLevel: number;
  /** New canvas-depth: completion-speed track level (unlocked from start). */
  speedLevel: number;
  /** New canvas-depth: size track level. Gated by skill-tree node "unlock_canvas_size". */
  sizeLevel: number;
  /** New canvas-depth: crit track level. Gated. */
  critLevel: number;
  /** New canvas-depth: combo track level. Gated. */
  comboLevel: number;
  /** New canvas-depth: current combo chain. Run-state. Resets on miss / ascend. */
  comboChain: number;
  /** New canvas-depth: rolled at canvas start; `true` for one canvas's lifetime then reset on sale. */
  isCritThisCanvas: boolean;
  /** Most recent sale event (TRANSIENT — stripped from partialize). */
  lastSale: { id: number; amount: Big } | null;
}
```

Update `initialCanvasState`:

```ts
export const initialCanvasState: CanvasState = Object.freeze({
  canvasProgress: 0,
  canvasTier: 1,
  sellPriceLevel: 1,
  speedLevel: 1,
  sizeLevel: 0,
  critLevel: 0,
  comboLevel: 0,
  comboChain: 0,
  isCritThisCanvas: false,
  lastSale: null,
}) as CanvasState;
```

`resetCanvas` already does `set(initialCanvasState)` — works automatically.

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "new track state fields"`
Expected: PASS.

Also: `npx tsc -b --noEmit` — should compile (canvasTier still present).

- [ ] **Step 5: Commit**

```bash
git add src/store/canvasSlice.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): add 5 track levels + comboChain + isCritThisCanvas

Adds sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel,
comboChain, isCritThisCanvas to CanvasState. Defaults match spec §4.3
(unlocked tracks at L1, gated at L0). canvasTier retained alongside
for backwards compatibility through the migration; removed in Task 16."
```

---

### Task 6: Add `upgradeSellPrice` and `upgradeSpeed` actions (always-unlocked)

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `tests/store/canvasSlice.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/canvasSlice.test.ts`:

```ts
describe("canvasSlice — upgradeSellPrice", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
  });

  it("no-ops when gold < cost (validate guard)", () => {
    useGameStore.setState({ gold: big(100) }); // < 150 cost (first buy from L1)
    useGameStore.getState().upgradeSellPrice();
    expect(useGameStore.getState().sellPriceLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(100);
  });

  it("spends gold and increments level on success", () => {
    useGameStore.setState({ gold: big(200) });
    useGameStore.getState().upgradeSellPrice();
    // First buy from L1: cost = sellPriceUpgradeCost(1) = 100 × 1.5 = 150
    expect(useGameStore.getState().sellPriceLevel).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(50, 5); // 200 - 150
  });

  it("uses sellPriceUpgradeCost(currentLevel)", () => {
    useGameStore.setState({ gold: big(1000), sellPriceLevel: 5 });
    useGameStore.getState().upgradeSellPrice();
    // L5 → L6 cost = sellPriceUpgradeCost(5) = 100 × 1.5^5 ≈ 759.375
    expect(useGameStore.getState().sellPriceLevel).toBe(6);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(1000 - 759.375, 1);
  });
});

describe("canvasSlice — upgradeSpeed", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
  });

  it("no-ops when gold < cost", () => {
    useGameStore.setState({ gold: big(100) });
    useGameStore.getState().upgradeSpeed();
    expect(useGameStore.getState().speedLevel).toBe(1);
  });

  it("spends gold and increments level", () => {
    useGameStore.setState({ gold: big(200) });
    useGameStore.getState().upgradeSpeed();
    // First buy from L1: cost = speedUpgradeCost(1) = 100 × 1.5 = 150
    expect(useGameStore.getState().speedLevel).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(50, 5);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "upgradeSellPrice|upgradeSpeed"`
Expected: FAIL — actions don't exist.

- [ ] **Step 3: Add to `CanvasSlice` interface and `createCanvasSlice`**

Add to the `CanvasSlice` interface in `src/store/canvasSlice.ts`:

```ts
  /** Validate → spend → mutate sell-price upgrade. No-op if gold < cost. */
  upgradeSellPrice: () => void;
  /** Validate → spend → mutate speed upgrade. No-op if gold < cost. */
  upgradeSpeed: () => void;
```

And add the import for the new costs:

```ts
import {
  canvasGold, canvasTime, tierUpgradeCost, MAX_TIER,
  sellPriceUpgradeCost, speedUpgradeCost,
} from "@/core/balance";
```

Add the action implementations inside `createCanvasSlice` (anywhere alongside `upgradeTier`):

```ts
  upgradeSellPrice: () => {
    const state = get();
    // Contract: formula(currentLevel) returns cost to advance from currentLevel to currentLevel+1.
    const cost = sellPriceUpgradeCost(state.sellPriceLevel);
    if (state.gold.lt(cost)) return;
    set({
      gold: state.gold.sub(cost),
      sellPriceLevel: state.sellPriceLevel + 1,
    });
  },

  upgradeSpeed: () => {
    const state = get();
    const cost = speedUpgradeCost(state.speedLevel);
    if (state.gold.lt(cost)) return;
    set({
      gold: state.gold.sub(cost),
      speedLevel: state.speedLevel + 1,
    });
  },
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "upgradeSellPrice|upgradeSpeed"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/canvasSlice.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): upgradeSellPrice + upgradeSpeed actions

Standard validate→spend→mutate atomic guards. Cost reads from
sellPriceUpgradeCost / speedUpgradeCost in balance.ts. Sell price and
speed are unlocked from start; size/crit/combo gated actions land in
task 8 after the skill-tree selector lands in task 7."
```

---

### Task 7: `getCanvasTrackUnlocked` selector in `skillTreeSlice`

**Files:**
- Modify: `src/store/skillTreeSlice.ts`
- Modify: `tests/store/skillTreeSlice.test.ts`

The engine reads ownership of three well-known node IDs the user is expected to author via `/dev/skill-designer`: `unlock_canvas_size`, `unlock_canvas_crit`, `unlock_canvas_combo`. While these nodes don't yet exist in `skillTreeDesign.json`, the selector still works (returns `false`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/skillTreeSlice.test.ts`:

```ts
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";

describe("getCanvasTrackUnlocked", () => {
  it("returns true for sell_price always", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "sell_price")).toBe(true);
  });

  it("returns true for speed always", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "speed")).toBe(true);
  });

  it("returns false for size when unlock_canvas_size not purchased", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "size")).toBe(false);
  });

  it("returns true for size when unlock_canvas_size purchased (any level)", () => {
    useGameStore.setState({ purchasedNodes: { unlock_canvas_size: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "size")).toBe(true);
  });

  it("checks unlock_canvas_crit for crit", () => {
    useGameStore.setState({ purchasedNodes: { unlock_canvas_crit: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "crit")).toBe(true);
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "crit")).toBe(false);
  });

  it("checks unlock_canvas_combo for combo", () => {
    useGameStore.setState({ purchasedNodes: { unlock_canvas_combo: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "combo")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "getCanvasTrackUnlocked"`
Expected: FAIL — function not exported.

- [ ] **Step 3: Add the selector**

Append near the bottom of `src/store/skillTreeSlice.ts`, before any default export or last function:

```ts
/** Canvas-depth track ID — five tracks total. */
export type CanvasTrackId = "sell_price" | "speed" | "size" | "crit" | "combo";

/**
 * Returns true if the player has unlocked the given canvas upgrade track.
 * Sell price and speed are always unlocked. Size, crit, combo each require
 * the player to own the corresponding fame skill-tree node:
 *   - unlock_canvas_size
 *   - unlock_canvas_crit
 *   - unlock_canvas_combo
 *
 * The user authors these nodes via /dev/skill-designer; the engine simply
 * reads ownership of the well-known IDs.
 */
export const getCanvasTrackUnlocked = (
  state: GameStore,
  trackId: CanvasTrackId,
): boolean => {
  if (trackId === "sell_price" || trackId === "speed") return true;
  const nodeId = trackId === "size"
    ? "unlock_canvas_size"
    : trackId === "crit"
    ? "unlock_canvas_crit"
    : "unlock_canvas_combo";
  return getNodeLevel(state, nodeId) >= 1;
};
```

(`getNodeLevel` and `GameStore` should already be imported in this file — verify.)

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "getCanvasTrackUnlocked"`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/store/skillTreeSlice.ts tests/store/skillTreeSlice.test.ts
git commit -m "store(skill-tree): getCanvasTrackUnlocked selector

Sell price and speed always unlocked. Size/crit/combo require ownership
of fame nodes unlock_canvas_size / unlock_canvas_crit / unlock_canvas_combo.
The user authors those nodes via /dev/skill-designer; engine reads ownership.
Engine surface only — no shipped nodes in this commit."
```

---

### Task 8: `upgradeSize` + `upgradeCrit` + `upgradeCombo` actions (gated)

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `tests/store/canvasSlice.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
describe("canvasSlice — upgradeSize (gated)", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0), purchasedNodes: {} });
  });

  it("no-ops when track is locked (no skill-tree node)", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: {} });
    useGameStore.getState().upgradeSize();
    expect(useGameStore.getState().sizeLevel).toBe(0);
    expect(useGameStore.getState().gold.toNumber()).toBe(10000);
  });

  it("no-ops when gold < cost (even if unlocked)", () => {
    useGameStore.setState({ gold: big(500), purchasedNodes: { unlock_canvas_size: 1 } });
    useGameStore.getState().upgradeSize();
    expect(useGameStore.getState().sizeLevel).toBe(0);
  });

  it("spends gold and increments when unlocked + affordable", () => {
    useGameStore.setState({ gold: big(2000), purchasedNodes: { unlock_canvas_size: 1 } });
    useGameStore.getState().upgradeSize();
    // L0 → L1: cost = sizeUpgradeCost(0) = 1000 × 1.5^0 = 1000
    expect(useGameStore.getState().sizeLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(1000, 1);
  });
});

describe("canvasSlice — upgradeCrit + upgradeCombo (gated)", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0), purchasedNodes: {} });
  });

  it("upgradeCrit: locked → no-op", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: {} });
    useGameStore.getState().upgradeCrit();
    expect(useGameStore.getState().critLevel).toBe(0);
  });

  it("upgradeCrit: unlocked + affordable → +1 level (L0→L1 = base 5000)", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: { unlock_canvas_crit: 1 } });
    useGameStore.getState().upgradeCrit();
    expect(useGameStore.getState().critLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(5000, 1); // 10000 - 5000
  });

  it("upgradeCombo: locked → no-op", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: {} });
    useGameStore.getState().upgradeCombo();
    expect(useGameStore.getState().comboLevel).toBe(0);
  });

  it("upgradeCombo: unlocked + affordable → +1 level (L0→L1 = base 5000)", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: { unlock_canvas_combo: 1 } });
    useGameStore.getState().upgradeCombo();
    expect(useGameStore.getState().comboLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(5000, 1);
  });
});
```

**Cost contract.** All upgrade actions use `formula(currentLevel)` where the formula is `base × growth^currentLevel` (Task 3 convention). This mirrors the project's existing `tierUpgradeCost(currentTier)` / `craftCost(level)` shape. First buy from L0 (size/crit/combo) = `formula(0) = base`. First buy from L1 (sell-price/speed) = `formula(1) = base × 1.5`.

- [ ] **Step 2: Run gated-action tests to verify FAIL**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "upgradeSize|upgradeCrit|upgradeCombo"`
Expected: FAIL — actions don't exist.

- [ ] **Step 3: Add the gated actions**

Update import:

```ts
import {
  canvasGold, canvasTime, tierUpgradeCost, MAX_TIER,
  sellPriceUpgradeCost, speedUpgradeCost,
  sizeUpgradeCost, critUpgradeCost, comboUpgradeCost,
} from "@/core/balance";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
```

Add to `CanvasSlice` interface:

```ts
  upgradeSize: () => void;
  upgradeCrit: () => void;
  upgradeCombo: () => void;
```

Add to `createCanvasSlice`:

```ts
  upgradeSize: () => {
    const state = get();
    if (!getCanvasTrackUnlocked(state, "size")) return;
    const cost = sizeUpgradeCost(state.sizeLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), sizeLevel: state.sizeLevel + 1 });
  },

  upgradeCrit: () => {
    const state = get();
    if (!getCanvasTrackUnlocked(state, "crit")) return;
    const cost = critUpgradeCost(state.critLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), critLevel: state.critLevel + 1 });
  },

  upgradeCombo: () => {
    const state = get();
    if (!getCanvasTrackUnlocked(state, "combo")) return;
    const cost = comboUpgradeCost(state.comboLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), comboLevel: state.comboLevel + 1 });
  },
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "upgradeSize|upgradeCrit|upgradeCombo|upgradeSellPrice|upgradeSpeed"`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/canvasSlice.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): upgradeSize/Crit/Combo gated actions

Adds the three gated upgrade actions. Each validates the skill-tree
unlock (getCanvasTrackUnlocked) before checking gold; on success spends
formula(currentLevel) gold and increments the track level."
```

---

# Phase C — Multipliers + tick

---

### Task 9: `getCanvasGoldMultiplier` + `getCanvasSpeedMultiplier` consume new levels

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/multipliers.test.ts` (a new describe at the top level):

```ts
describe("multipliers — sellPriceLevel + speedLevel contributions", () => {
  // Helper: minimal state-shape stub. The selectors only read certain fields.
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {},
    equipped: {},
    sellPriceLevel: 1,
    speedLevel: 1,
    paintMastery: big(0),
    ...over,
  } as GameStore);

  it("getCanvasGoldMultiplier: includes (1 + 0.10 × sellPriceLevel) additive", () => {
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 1 }))).toBeCloseTo(1.10, 5);
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 5 }))).toBeCloseTo(1.50, 5);
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 10 }))).toBeCloseTo(2.00, 5);
  });

  it("getCanvasSpeedMultiplier: includes (1 + 0.05 × speedLevel) additive", () => {
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 1 }))).toBeCloseTo(1.05, 5);
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 10 }))).toBeCloseTo(1.50, 5);
  });

  it("sell-price stacks additively with item canvas_gold% affixes (no double-count)", () => {
    // 1 + sellPrice(0.10×3 = 0.30) + colors(0) + items(0.10) → additive 1.40, then × rainbow(1)
    // Will need a stub that includes a brush with +canvas_gold% 10. Not covered by test stub utility.
    // Skip in this micro-test; comprehensive integration test in canvasSlice tests.
  });
});
```

(The "stacks additively" case is left as a placeholder description; the integration coverage lands in the canvasTick tests in Task 11.)

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/core/multipliers.test.ts -t "sellPriceLevel"`
Expected: FAIL — current `getCanvasGoldMultiplier` does not read `sellPriceLevel`.

- [ ] **Step 3: Modify the multiplier functions**

In `src/core/multipliers.ts`, update `getCanvasGoldMultiplier`:

```ts
import { SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL } from "./balance";

export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+canvas_gold%");
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    bonus += getNodeLevel(state, id) * perLevel;
  }
  bonus += SELL_PRICE_PER_LEVEL * state.sellPriceLevel;   // NEW
  const additive = 1 + bonus;
  const rainbowMul = 1 + getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;
  return additive * rainbowMul;
};
```

Update `getCanvasSpeedMultiplier`:

```ts
export const getCanvasSpeedMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  bonus += SPEED_PER_LEVEL * state.speedLevel;   // NEW
  return 1 + bonus;
};
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: All multiplier tests pass. If pre-existing tests break because they don't seed `sellPriceLevel` / `speedLevel`, update them to use `1` as the default.

- [ ] **Step 5: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): canvas gold/speed consume new levels

getCanvasGoldMultiplier adds (SELL_PRICE_PER_LEVEL × sellPriceLevel)
into the additive bonus alongside item affixes, color tree, etc.
getCanvasSpeedMultiplier adds (SPEED_PER_LEVEL × speedLevel) into
its additive sum. canvasTick still calls canvasGold(canvasTier) — that
gets fixed in task 11."
```

---

### Task 10: `getCritChance` + `getComboBaseChance` selectors

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { getCritChance, getComboBaseChance } from "@/core/multipliers";

describe("multipliers — crit + combo chances", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {},
    equipped: {},
    critLevel: 0,
    comboLevel: 0,
    ...over,
  } as GameStore);

  it("getCritChance returns CRIT_PER_LEVEL × critLevel", () => {
    expect(getCritChance(stub({ critLevel: 0 }))).toBeCloseTo(0, 5);
    expect(getCritChance(stub({ critLevel: 1 }))).toBeCloseTo(0.01, 5);
    expect(getCritChance(stub({ critLevel: 50 }))).toBeCloseTo(0.50, 5);
  });

  it("getCritChance clamps at 1.0 (no multi-crit in this spec)", () => {
    expect(getCritChance(stub({ critLevel: 200 }))).toBe(1.0);
  });

  it("getComboBaseChance returns COMBO_PER_LEVEL × comboLevel", () => {
    expect(getComboBaseChance(stub({ comboLevel: 0 }))).toBeCloseTo(0, 5);
    expect(getComboBaseChance(stub({ comboLevel: 5 }))).toBeCloseTo(0.10, 5);
    expect(getComboBaseChance(stub({ comboLevel: 30 }))).toBeCloseTo(0.60, 5);
  });

  it("getComboBaseChance clamps at 1.0", () => {
    expect(getComboBaseChance(stub({ comboLevel: 100 }))).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/core/multipliers.test.ts -t "crit \\+ combo"`
Expected: FAIL — selectors not exported.

- [ ] **Step 3: Add the selectors**

Append to `src/core/multipliers.ts`:

```ts
import { CRIT_PER_LEVEL, COMBO_PER_LEVEL } from "./balance";

/**
 * Crit chance (0 to 1). Clamped at 1.0 — multi-crit is out of scope
 * (canvas-depth spec §3.4). Currently only consumes critLevel; affix
 * contributions from `+crit_chance%` add in subproject 2.
 */
export const getCritChance = (state: GameStore): number =>
  Math.min(1.0, CRIT_PER_LEVEL * state.critLevel);

/**
 * Base combo trigger chance, BEFORE per-link decay. Clamped at 1.0.
 * Decay is applied at use sites (canvasTick) via comboEffectiveChance.
 */
export const getComboBaseChance = (state: GameStore): number =>
  Math.min(1.0, COMBO_PER_LEVEL * state.comboLevel);
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/core/multipliers.test.ts -t "crit \\+ combo"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): getCritChance + getComboBaseChance selectors

Both clamp at 1.0 (multi-crit out of scope; combo chance saturates
before decay). Affix contributions land in subproject 2."
```

---

### Task 11: Modified `canvasTick` — crit roll on first tick, combo bonus on sale, combo roll after sale

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `tests/store/canvasSlice.test.ts`

This is the central rewrite. After this task, `canvasTick` no longer reads `canvasTier`. The legacy `upgradeTier` action still exists (deleted in Task 16).

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/canvasSlice.test.ts`:

```ts
import { setSeed } from "@/core/rng";

describe("canvasTick — crit + combo behaviour", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
  });

  it("at canvas start (canvasProgress = 0), rolls crit and stores in isCritThisCanvas", () => {
    setSeed(1);
    useGameStore.setState({ critLevel: 50 }); // 50% crit chance — seed 1 should hit
    useGameStore.getState().canvasTick(0.1);
    // After first tick of a new canvas, the roll has happened.
    // We can't know hit/miss without running rng on the same seed; just assert state was written.
    const flag = useGameStore.getState().isCritThisCanvas;
    expect(typeof flag).toBe("boolean");
  });

  it("crit canvas paints in time / 10", () => {
    // Use a deterministic seed where we know first roll is < critChance.
    // For critLevel = 100 (chance 1.0), every roll hits.
    setSeed(42);
    useGameStore.setState({ critLevel: 100, sizeLevel: 0 });
    // Effective time = canvasTime(0) / (speedMult × CRIT_SPEED_FACTOR) = 2 / (1.05 × 10) ≈ 0.190 s
    useGameStore.getState().canvasTick(0.19);
    // Should not have sold yet (just below threshold).
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    useGameStore.getState().canvasTick(0.01);
    expect(useGameStore.getState().gold.gt(big(0))).toBe(true);
  });

  it("on sale, combo bonus from PRIOR comboChain applies to this canvas's gold", () => {
    setSeed(99);
    // Setup: comboChain = 3, sizeLevel = 0, no crit, no skill-tree multipliers.
    // gold per sale = canvasGold(0, mult) × comboBonusFactor(3) = 10 × 1.10 (sellPrice 1) × ... × (1 + 0.30)
    // mult = (1 + 0.10×1) × ... = 1.10
    // gold = 10 × 1.10 × 1 (PM=0) × 1.30 = 14.30
    useGameStore.setState({ comboChain: 3, critLevel: 0, comboLevel: 0 });
    // Run enough ticks to trigger one sale.
    const baseTime = 2 * (1 + 0.15 * 0); // = 2
    const speedMult = 1 + 0.05 * 1; // = 1.05
    const effTime = baseTime / speedMult; // ≈ 1.905
    useGameStore.getState().canvasTick(effTime + 0.1);
    const gold = useGameStore.getState().gold.toNumber();
    expect(gold).toBeCloseTo(14.30, 1);
  });

  it("after sale, rolls combo. On hit (chance 1.0), comboChain increments", () => {
    setSeed(7);
    useGameStore.setState({ comboLevel: 100, comboChain: 0 }); // 100 × 0.02 = 2.0 → clamped at 1.0
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(1);
    // Next sale, chain becomes 2.
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(2);
  });

  it("after sale, on combo miss (chance 0.0), comboChain resets to 0", () => {
    setSeed(7);
    useGameStore.setState({ comboLevel: 0, comboChain: 5 });
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(0);
  });

  it("on sale, isCritThisCanvas is reset to false", () => {
    setSeed(42);
    useGameStore.setState({ critLevel: 100 });
    const effTime = (2 / 1.05) / 10; // crit-hit time
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().isCritThisCanvas).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "canvasTick"`
Expected: Many existing tier-based tick tests will fail, plus the new ones — that's fine, we're rewiring everything in this task. Older `canvasTick` tests should be removed or updated.

- [ ] **Step 3: Rewrite `canvasTick` in `src/store/canvasSlice.ts`**

Update imports:

```ts
import {
  canvasGold, canvasTime, tierUpgradeCost, MAX_TIER,
  sellPriceUpgradeCost, speedUpgradeCost,
  sizeUpgradeCost, critUpgradeCost, comboUpgradeCost,
  CRIT_SPEED_FACTOR, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getPaintTimeMultiplier,
  getPmMultiplier,
  getCritChance,
  getComboBaseChance,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
```

Replace `canvasTick` body:

```ts
canvasTick: (deltaSeconds) => {
  if (deltaSeconds <= 0) return;
  const state = get();

  // Roll crit at the start of every new canvas (canvasProgress === 0 guarantees first tick).
  let critFlag = state.isCritThisCanvas;
  if (state.canvasProgress === 0) {
    critFlag = rng() < getCritChance(state);
  }

  const baseTime = canvasTime(state.sizeLevel);
  const speedMult = getCanvasSpeedMultiplier(state) * getPaintTimeMultiplier(state);
  const critFactor = critFlag ? CRIT_SPEED_FACTOR : 1;
  const effectiveTime = baseTime / (speedMult * critFactor);

  const newProgress = state.canvasProgress + deltaSeconds;

  if (newProgress < effectiveTime) {
    set({ canvasProgress: newProgress, isCritThisCanvas: critFlag });
    return;
  }

  // Threshold crossed — exactly one sale per tick.
  const goldMult = getCanvasGoldMultiplier(state) * getPmMultiplier(state);
  // canvasGold(sizeLevel, mult) returns gold BEFORE combo bonus.
  const baseGold = canvasGold(state.sizeLevel, goldMult);
  // Apply combo bonus from prior chain state — chain mutation happens AFTER pay-out.
  const gain = baseGold.mul(comboBonusFactor(state.comboChain));

  state.add("gold", gain);
  state.addGoldEarned(gain);

  // Roll combo for the chain decision.
  const baseChance = getComboBaseChance(state);
  const effChance = comboEffectiveChance(baseChance, state.comboChain);
  const comboHit = rng() < effChance;
  const newChain = comboHit ? state.comboChain + 1 : 0;

  const leftover = newProgress - effectiveTime;
  const prevId = state.lastSale?.id ?? 0;
  set({
    canvasProgress: leftover < effectiveTime ? leftover : 0,
    isCritThisCanvas: false, // reset; next tick re-rolls for the new canvas
    comboChain: newChain,
    lastSale: { id: prevId + 1, amount: gain },
  });
},
```

- [ ] **Step 4: Update or delete old tick tests**

Older `canvasTick` tests that asserted tier-based behaviour will need updates. For each one:
- If it tested gold output by tier: rewrite using `sizeLevel` and the new `canvasGold` signature.
- If it tested paint time by tier: rewrite using `sizeLevel` and the new `canvasTime` signature.
- If it asserted on `state.canvasTier` post-tick: that field still exists (Task 16 removes it); the assertion is inert but harmless. Leave or remove based on relevance.

- [ ] **Step 5: Run all canvas slice tests to verify PASS**

Run: `npx vitest run tests/store/canvasSlice.test.ts`
Expected: All pass. If any pre-existing canvas tick tests still fail, fix them per the rewrite rules above.

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/canvasSlice.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): canvasTick rewires for crit + combo + size

Crit rolled on the first tick of every canvas (canvasProgress = 0)
and stored in isCritThisCanvas; crit canvas paints in effectiveTime /
CRIT_SPEED_FACTOR. Sale gold uses canvasGold(sizeLevel, mult) ×
comboBonusFactor(comboChain). Combo rolled after sale, chain increments
on hit and resets to 0 on miss. canvasTier no longer read in tick;
old upgradeTier action stays until task 16."
```

---

# Phase D — UI

---

### Task 12: Create `<TrackCard>` component

**Files:**
- Create: `src/components/painting/TrackCard.tsx`
- Create: `src/components/painting/TrackCard.module.css`
- Create: `tests/components/painting/TrackCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/components/painting/TrackCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrackCard } from "@/components/painting/TrackCard";

describe("<TrackCard>", () => {
  it("renders track name + level + cost label when unlocked", () => {
    render(
      <TrackCard
        trackId="sell_price"
        label="Sell Price"
        level={3}
        effectLine="+30% gold per sale"
        costLabel="150g"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText(/Sell Price/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
    expect(screen.getByText(/\+30% gold per sale/i)).toBeInTheDocument();
    expect(screen.getByText(/150g/)).toBeInTheDocument();
  });

  it("renders 'Locked' state when locked=true (no upgrade button)", () => {
    render(
      <TrackCard
        trackId="size"
        label="Size"
        level={0}
        effectLine="—"
        costLabel="—"
        canAfford={false}
        locked={true}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText(/Size/i)).toBeInTheDocument();
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();
    // The upgrade button is either disabled or absent — assert no clickable upgrade.
    const btn = screen.queryByRole("button", { name: /Upgrade/i });
    expect(btn === null || (btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the upgrade button when !canAfford", () => {
    render(
      <TrackCard
        trackId="speed"
        label="Speed"
        level={1}
        effectLine="+5% speed"
        costLabel="150g"
        canAfford={false}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /Upgrade/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("calls onUpgrade when the upgrade button is clicked (unlocked + affordable)", () => {
    const fn = vi.fn();
    render(
      <TrackCard
        trackId="speed"
        label="Speed"
        level={1}
        effectLine="+5% speed"
        costLabel="100g"
        canAfford={true}
        locked={false}
        onUpgrade={fn}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Upgrade/i }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

(Imports already added at the top of the test file in Step 1.)

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/components/painting/TrackCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `src/components/painting/TrackCard.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./TrackCard.module.css";
import type { CanvasTrackId } from "@/store/skillTreeSlice";

interface Props {
  trackId: CanvasTrackId;
  label: string;
  level: number;
  effectLine: string;   // e.g. "+30% gold per sale" or "—" when locked
  costLabel: string;    // e.g. "150g" or "—" when locked
  canAfford: boolean;
  locked: boolean;
  onUpgrade: () => void;
}

/**
 * One of the 5 cells in the canvas upgrades strip. Renders a single track
 * (sell price / speed / size / crit / combo) with current level, current
 * effect, next-level cost, and an upgrade button. Locked variant when the
 * required fame skill-tree node hasn't been purchased yet.
 */
export function TrackCard({
  trackId, label, level, effectLine, costLabel, canAfford, locked, onUpgrade,
}: Props): JSX.Element {
  const disabled = locked || !canAfford;
  const buttonLabel = locked ? "Locked" : `Upgrade · ${costLabel}`;
  return (
    <div
      className={`${styles.card} ${locked ? styles.locked : ""}`}
      data-track-id={trackId}
    >
      <div className={styles.label}>{label}</div>
      <div className={styles.level}>Level {level}</div>
      <div className={styles.effect}>{effectLine}</div>
      <button
        type="button"
        className={styles.upgradeBtn}
        disabled={disabled}
        onClick={!disabled ? onUpgrade : undefined}
        data-testid={`track-card-upgrade-${trackId}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
```

Create `src/components/painting/TrackCard.module.css` (minimal styling — match existing TierCard look-and-feel):

```css
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--gold);
  border-radius: 6px;
  text-align: center;
  min-height: 120px;
  font-size: 12px;
}

.locked {
  opacity: 0.5;
  border-color: rgba(128, 128, 128, 0.5);
}

.label {
  font-family: var(--font-display);
  font-weight: bold;
  color: var(--gold);
  font-size: 13px;
}

.level {
  color: var(--ink);
  font-family: var(--font-mono);
}

.effect {
  font-size: 11px;
  color: var(--ink-muted);
  line-height: 1.3;
}

.upgradeBtn {
  width: 100%;
  padding: 4px 6px;
  background: var(--gold);
  color: var(--bg-deep);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 11px;
}

.upgradeBtn:disabled {
  background: rgba(128, 128, 128, 0.4);
  cursor: not-allowed;
}
```

(If the project's CSS variable names differ — e.g., `--gold` is `--fame` — adapt to the local convention. Cross-check `src/styles/tokens.css`.)

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/components/painting/TrackCard.test.tsx`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/TrackCard.tsx src/components/painting/TrackCard.module.css tests/components/painting/TrackCard.test.tsx
git commit -m "ui(painting): TrackCard component for canvas upgrade tracks

Parameterised tile shared by all 5 cells in CanvasUpgradesStrip.
Renders label + level + effect + upgrade button with cost. Locked
variant for gated tracks (size/crit/combo) until their fame node
is purchased."
```

---

### Task 13: Wire 5 `<TrackCard>` instances in `PaintingRoute` (replace `<TierCard>`)

**Files:**
- Modify: `src/routes/PaintingRoute.tsx`
- Modify: `tests/routes/PaintingRoute.test.tsx` (create if not present)

- [ ] **Step 1: Write the failing test**

Create or modify `tests/routes/PaintingRoute.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";
import { big } from "@/core/bigNumber";

describe("<PaintingRoute> — 5 track cards", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...initialCanvasState,
      gold: big(1000),
      purchasedNodes: {},
      equipped: {},
      paintMastery: big(0),
    });
  });

  it("renders all 5 track cards by trackId data-attribute", () => {
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    const ids = ["sell_price", "speed", "size", "crit", "combo"];
    for (const id of ids) {
      expect(document.querySelector(`[data-track-id="${id}"]`)).not.toBeNull();
    }
  });

  it("size/crit/combo cards render in locked state when their fame node is not purchased", () => {
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    expect(screen.getAllByText(/Locked/i).length).toBe(3);
  });

  it("all cards render unlocked once their fame node is purchased", () => {
    useGameStore.setState({
      purchasedNodes: {
        unlock_canvas_size: 1,
        unlock_canvas_crit: 1,
        unlock_canvas_combo: 1,
      },
    });
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    expect(screen.queryAllByText(/Locked/i).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/routes/PaintingRoute.test.tsx`
Expected: FAIL — TierCard still rendered, no TrackCards yet.

- [ ] **Step 3: Replace TierCard with 5 TrackCards in `PaintingRoute.tsx`**

Replace `src/routes/PaintingRoute.tsx` body:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import {
  canvasGold, canvasTime,
  sellPriceUpgradeCost, speedUpgradeCost,
  sizeUpgradeCost, critUpgradeCost, comboUpgradeCost,
  SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL,
  SIZE_GOLD_PER_LEVEL, SIZE_TIME_PER_LEVEL,
  CRIT_PER_LEVEL, COMBO_PER_LEVEL, COMBO_PER_LINK,
  CRIT_SPEED_FACTOR,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getPaintTimeMultiplier,
  getPmMultiplier,
} from "@/core/multipliers";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";
import { CanvasStage } from "@/components/painting/CanvasStage";
import { TrackCard } from "@/components/painting/TrackCard";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";
import { RoomRail } from "@/components/painting/RoomRail";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import styles from "./PaintingRoute.module.css";

export function PaintingRoute(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const sellPriceLevel = useGameStore((s) => s.sellPriceLevel);
  const speedLevel = useGameStore((s) => s.speedLevel);
  const sizeLevel = useGameStore((s) => s.sizeLevel);
  const critLevel = useGameStore((s) => s.critLevel);
  const comboLevel = useGameStore((s) => s.comboLevel);
  const comboChain = useGameStore((s) => s.comboChain);
  const isCritThisCanvas = useGameStore((s) => s.isCritThisCanvas);
  const gold = useGameStore((s) => s.gold);
  const equipped = useGameStore((s) => s.equipped);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const paintMastery = useGameStore((s) => s.paintMastery);
  const upgradeSellPrice = useGameStore((s) => s.upgradeSellPrice);
  const upgradeSpeed = useGameStore((s) => s.upgradeSpeed);
  const upgradeSize = useGameStore((s) => s.upgradeSize);
  const upgradeCrit = useGameStore((s) => s.upgradeCrit);
  const upgradeCombo = useGameStore((s) => s.upgradeCombo);
  const lastSale = useGameStore((s) => s.lastSale);
  const clearLastSale = useGameStore((s) => s.clearLastSale);

  const helperState = {
    equipped, purchasedNodes, paintMastery,
    sellPriceLevel, speedLevel, critLevel, comboLevel,
  } as unknown as GameStore;

  const baseTime = canvasTime(sizeLevel);
  const speedMult = getPaintTimeMultiplier(helperState) * getCanvasSpeedMultiplier(helperState);
  const critFactor = isCritThisCanvas ? CRIT_SPEED_FACTOR : 1;
  const paintTimeSec = baseTime / (speedMult * critFactor);
  const progressPct = paintTimeSec > 0 ? canvasProgress / paintTimeSec : 0;
  const goldMult = getCanvasGoldMultiplier(helperState) * getPmMultiplier(helperState);
  const baseGold = canvasGold(sizeLevel, goldMult);
  const comboFactor = 1 + COMBO_PER_LINK * comboChain;
  const nextSaleGold = baseGold.mul(comboFactor);

  const sellLocked = !getCanvasTrackUnlocked(helperState, "sell_price");  // always false
  const speedLocked = !getCanvasTrackUnlocked(helperState, "speed");      // always false
  const sizeLocked = !getCanvasTrackUnlocked(helperState, "size");
  const critLocked = !getCanvasTrackUnlocked(helperState, "crit");
  const comboLocked = !getCanvasTrackUnlocked(helperState, "combo");

  const sellCost = sellPriceUpgradeCost(sellPriceLevel);
  const speedCost = speedUpgradeCost(speedLevel);
  const sizeCost = sizeUpgradeCost(sizeLevel);
  const critCost = critUpgradeCost(critLevel);
  const comboCost = comboUpgradeCost(comboLevel);

  const fmtPct = (x: number, frac = 0): string => `${(x * 100).toFixed(frac)}%`;

  return (
    <div className={styles.layout}>
      <div className={styles.stageArea}>
        <CanvasStage
          sizeLevel={sizeLevel}
          progressPct={progressPct}
          timeElapsed={canvasProgress.toFixed(1)}
          timeTotal={paintTimeSec.toFixed(1)}
          nextSaleGold={formatBig(nextSaleGold)}
          comboChain={comboChain}
          isCrit={isCritThisCanvas}
        />
        {lastSale && (
          <FloatingGoldText
            key={lastSale.id}
            amount={lastSale.amount}
            onComplete={clearLastSale}
          />
        )}
      </div>

      <div className={styles.upgradesArea}>
        <CanvasUpgradesStrip>
          <TrackCard
            trackId="sell_price"
            label="Sell Price"
            level={sellPriceLevel}
            effectLine={`+${fmtPct(SELL_PRICE_PER_LEVEL, 0)} gold/level`}
            costLabel={`${formatBig(sellCost)}g`}
            canAfford={gold.gte(sellCost)}
            locked={sellLocked}
            onUpgrade={upgradeSellPrice}
          />
          <TrackCard
            trackId="speed"
            label="Speed"
            level={speedLevel}
            effectLine={`+${fmtPct(SPEED_PER_LEVEL, 0)} speed/level`}
            costLabel={`${formatBig(speedCost)}g`}
            canAfford={gold.gte(speedCost)}
            locked={speedLocked}
            onUpgrade={upgradeSpeed}
          />
          <TrackCard
            trackId="size"
            label="Size"
            level={sizeLevel}
            effectLine={sizeLocked ? "—" : `+${fmtPct(SIZE_GOLD_PER_LEVEL, 0)} gold / +${fmtPct(SIZE_TIME_PER_LEVEL, 0)} time`}
            costLabel={sizeLocked ? "—" : `${formatBig(sizeCost)}g`}
            canAfford={gold.gte(sizeCost)}
            locked={sizeLocked}
            onUpgrade={upgradeSize}
          />
          <TrackCard
            trackId="crit"
            label="Crit"
            level={critLevel}
            effectLine={critLocked ? "—" : `+${fmtPct(CRIT_PER_LEVEL, 0)} crit chance/level (90% faster on hit)`}
            costLabel={critLocked ? "—" : `${formatBig(critCost)}g`}
            canAfford={gold.gte(critCost)}
            locked={critLocked}
            onUpgrade={upgradeCrit}
          />
          <TrackCard
            trackId="combo"
            label="Combo"
            level={comboLevel}
            effectLine={comboLocked ? "—" : `+${fmtPct(COMBO_PER_LEVEL, 0)} chain chance/level`}
            costLabel={comboLocked ? "—" : `${formatBig(comboCost)}g`}
            canAfford={gold.gte(comboCost)}
            locked={comboLocked}
            onUpgrade={upgradeCombo}
          />
        </CanvasUpgradesStrip>
      </div>

      <aside className={styles.roomArea}>
        <WorkshopRoom />
      </aside>

      <aside className={styles.railArea}>
        <RoomRail />
      </aside>
    </div>
  );
}
```

(Note: `<CanvasStage>` props change — `tier` → `sizeLevel`, plus new `comboChain` and `isCrit` — Task 14 implements those.)

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/routes/PaintingRoute.test.tsx`
Expected: PASS for the 5-cards test. May fail on render if `<CanvasStage>` props haven't been updated yet — that's Task 14. To unblock this task without Task 14, temporarily keep `tier={sizeLevel}` etc. and update Task 14 to swap the prop name.

Cleaner: do Task 13 + Task 14 as a single PR sequence (commit Task 13, then Task 14 immediately).

Run: `npx tsc -b --noEmit`
Expected: clean OR fails on `<CanvasStage>` — see Task 14 to resolve.

- [ ] **Step 5: Commit**

```bash
git add src/routes/PaintingRoute.tsx tests/routes/PaintingRoute.test.tsx
git commit -m "ui(painting): replace TierCard with 5 TrackCards

PaintingRoute now mounts 5 TrackCard instances (sell price / speed /
size / crit / combo) in CanvasUpgradesStrip. Sell + speed always
unlocked; size/crit/combo render Locked until their fame node is
purchased. CanvasStage prop signature updated for sizeLevel + combo +
crit; widget changes follow in task 14."
```

---

### Task 14: Update `<CanvasStage>` — `sizeLevel` prop, combo badge, crit indicator

**Files:**
- Modify: `src/components/painting/CanvasStage.tsx`
- Modify: `src/components/painting/CanvasStage.module.css`
- Modify: `tests/components/painting/CanvasStage.test.tsx` (create if not present)

- [ ] **Step 1: Write the failing tests**

Create or modify `tests/components/painting/CanvasStage.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";

describe("<CanvasStage>", () => {
  it("renders combo chain badge when comboChain > 0", () => {
    render(
      <CanvasStage
        sizeLevel={3} progressPct={0.5}
        timeElapsed="1.0" timeTotal="2.0" nextSaleGold="100"
        comboChain={3} isCrit={false}
      />
    );
    expect(screen.getByText(/×3/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument(); // +3×10% = +30%
  });

  it("does NOT render combo badge when comboChain = 0", () => {
    render(
      <CanvasStage
        sizeLevel={0} progressPct={0}
        timeElapsed="0.0" timeTotal="2.0" nextSaleGold="10"
        comboChain={0} isCrit={false}
      />
    );
    expect(screen.queryByTestId("combo-badge")).toBeNull();
  });

  it("renders crit indicator when isCrit=true", () => {
    render(
      <CanvasStage
        sizeLevel={0} progressPct={0.1}
        timeElapsed="0.1" timeTotal="0.2" nextSaleGold="10"
        comboChain={0} isCrit={true}
      />
    );
    expect(screen.getByTestId("crit-indicator")).toBeInTheDocument();
  });

  it("does NOT render crit indicator when isCrit=false", () => {
    render(
      <CanvasStage
        sizeLevel={0} progressPct={0.1}
        timeElapsed="0.1" timeTotal="2.0" nextSaleGold="10"
        comboChain={0} isCrit={false}
      />
    );
    expect(screen.queryByTestId("crit-indicator")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/components/painting/CanvasStage.test.tsx`
Expected: FAIL — props mismatch (still expects `tier`).

- [ ] **Step 3: Update `<CanvasStage>` Props + render**

In `src/components/painting/CanvasStage.tsx`:

Replace the Props interface:

```ts
interface Props {
  sizeLevel: number;
  progressPct: number;
  timeElapsed: string;
  timeTotal: string;
  nextSaleGold: string;
  comboChain: number;
  isCrit: boolean;
}
```

Update the `sellHoverBody` helper signature and body (it referenced `tier` for canvasGold) — for now, simplify to just the gold preview without the breakdown (preserve breakdown in a later task if desired):

```tsx
function sellHoverBody(sizeLevel: number, comboChain: number): JSX.Element {
  const state = useGameStore.getState();
  const goldMult = getCanvasGoldMultiplier(state);
  const pmMult = getPmMultiplier(state);
  const itemBonus = getEquippedContribution(state, "+canvas_gold%");
  const colorBonus = goldMult / (1 + 0.50 * getNodeLevel(state, "rainbow")) - 1 - itemBonus - SELL_PRICE_PER_LEVEL * state.sellPriceLevel;
  const total = canvasGold(sizeLevel, goldMult * pmMult).mul(1 + COMBO_PER_LINK * comboChain);
  return (
    <>
      <div>Base × (1 + 0.30 × {sizeLevel}): {(10 * (1 + 0.30 * sizeLevel)).toFixed(0)}</div>
      <div>───</div>
      <div>Sell Price (L{state.sellPriceLevel}): ×{(1 + SELL_PRICE_PER_LEVEL * state.sellPriceLevel).toFixed(2)}</div>
      <div>Colors:        ×{(1 + colorBonus).toFixed(2)}</div>
      <div>Items:         ×{(1 + itemBonus).toFixed(2)}</div>
      <div>Paint Mastery: ×{pmMult.toFixed(2)}</div>
      {comboChain > 0 ? <div>Combo:        ×{(1 + COMBO_PER_LINK * comboChain).toFixed(2)}</div> : null}
      <div>───</div>
      <div>Total: {formatBig(total)} g per canvas</div>
    </>
  );
}
```

(Add the imports at the top:)
```ts
import { canvasGold, SELL_PRICE_PER_LEVEL, COMBO_PER_LINK } from "@/core/balance";
import { getNodeLevel } from "@/store/skillTreeSlice";
```

Update the component signature and render:

```tsx
export function CanvasStage({
  sizeLevel, progressPct, timeElapsed, timeTotal, nextSaleGold,
  comboChain, isCrit,
}: Props): JSX.Element {
  const fillHeight = `${Math.max(0, Math.min(100, progressPct * 100))}%`;
  const barWidth = `${Math.max(0, Math.min(100, progressPct * 100))}%`;

  return (
    <section className={styles.stage} aria-label="Canvas stage">
      <div className={styles.title}>— Canvas (Size {sizeLevel}) —</div>

      {isCrit && (
        <div className={styles.critIndicator} data-testid="crit-indicator">CRIT</div>
      )}

      {comboChain > 0 && (
        <div className={styles.comboBadge} data-testid="combo-badge">
          🔥 ×{comboChain}  +{(comboChain * 10)}%
        </div>
      )}

      <div className={styles.frame}>
        {/* (unchanged SVG — keep existing pixel landscape) */}
        <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className={styles.canvasArt}>
          <defs>
            <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5a4a82" />
              <stop offset="1" stopColor="#a89cd6" />
            </linearGradient>
          </defs>
          <rect width="200" height="100" fill="url(#cs-sky)" />
          <polygon points="0,90 60,60 100,80 160,55 200,75 200,100 0,100" fill="#3a2e5a" />
          <rect width="200" height="40" y="100" fill="#2e4a3a" />
          <rect x="80" y="70" width="6" height="30" fill="#5a3a22" />
          <ellipse cx="83" cy="68" rx="14" ry="10" fill="#3a6a3a" />
          <ellipse cx="83" cy="65" rx="9" ry="6" fill="#5a8a4a" />
        </svg>
        <div className={styles.fill} data-testid="canvas-fill" style={{ height: fillHeight }} aria-hidden="true" />
        <div className={styles.easel} aria-hidden="true" />
      </div>

      <div className={styles.progress} role="progressbar" aria-valuenow={Math.round(progressPct * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.progressFill} style={{ width: barWidth }} />
      </div>

      <div className={styles.bottomRow}>
        <span className={styles.painting}>Painting · {timeElapsed}s / {timeTotal}s</span>
        <Hoverable
          title="Sell Canvas"
          body={() => sellHoverBody(sizeLevel, comboChain)}
          footer="Auto-sells when paint progress reaches 100%."
        >
          <span className={styles.goldPreview} data-testid="canvas-sell-preview">+{nextSaleGold}g on next sale</span>
        </Hoverable>
        <span className={styles.tierBadge}>Size {sizeLevel}</span>
      </div>
    </section>
  );
}
```

Append to `CanvasStage.module.css`:

```css
.critIndicator {
  position: absolute;
  top: 8px; right: 8px;
  background: var(--gold);
  color: var(--bg-deep);
  font-family: var(--font-display);
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  box-shadow: 0 0 12px var(--gold);
  z-index: 5;
  animation: critPulse 0.6s ease-in-out infinite alternate;
}
@keyframes critPulse {
  from { transform: scale(1); }
  to   { transform: scale(1.05); }
}

.comboBadge {
  position: absolute;
  top: 8px; left: 8px;
  background: rgba(255, 100, 50, 0.85);
  color: white;
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  z-index: 5;
}
```

(Adapt CSS variable names if the project uses different ones.)

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/components/painting/CanvasStage.test.tsx`
Expected: PASS.

Run: `npx vitest run tests/routes/PaintingRoute.test.tsx`
Expected: PASS (the route renders without error now).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/CanvasStage.tsx src/components/painting/CanvasStage.module.css tests/components/painting/CanvasStage.test.tsx
git commit -m "ui(painting): CanvasStage uses sizeLevel + adds combo + crit badges

Renames tier prop to sizeLevel; adds comboChain prop for the orange 🔥
chain badge in the top-left; adds isCrit prop for the gold CRIT pulse
in the top-right. Sell hover formula updated for the new stack
(size base × sell-price × colors × items × PM × combo)."
```

---

### Task 15: Hover info on TrackCards

**Files:**
- Modify: `src/components/painting/TrackCard.tsx`
- Modify: `tests/components/painting/TrackCard.test.tsx`

The tile gets `<Hoverable>` around the upgrade button so the InfoPanel surfaces the per-level effect formula and current cost when the player hovers.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/painting/TrackCard.test.tsx`:

```tsx
import { useGameStore } from "@/store";

describe("<TrackCard> — hover info", () => {
  beforeEach(() => {
    useGameStore.setState({ hoverTitle: "", hoverBody: "", hoverFooter: "" });
  });

  it("hover on upgrade button pushes title with track label", () => {
    render(
      <TrackCard
        trackId="sell_price" label="Sell Price"
        level={1} effectLine="+10% gold/level" costLabel="100g"
        canAfford={true} locked={false} onUpgrade={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("track-card-upgrade-sell_price"));
    expect(useGameStore.getState().hoverTitle).toMatch(/Sell Price/i);
    const body = String(useGameStore.getState().hoverBody);
    expect(body).toMatch(/Level 1/);
    expect(body).toMatch(/100g/);
  });

  it("hover on locked card pushes title 'Locked' and skill-tree footer", () => {
    render(
      <TrackCard
        trackId="size" label="Size"
        level={0} effectLine="—" costLabel="—"
        canAfford={false} locked={true} onUpgrade={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("track-card-upgrade-size"));
    expect(useGameStore.getState().hoverTitle).toMatch(/Size/i);
    expect(String(useGameStore.getState().hoverBody)).toMatch(/locked/i);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/components/painting/TrackCard.test.tsx -t "hover info"`
Expected: FAIL — no hover wiring yet.

- [ ] **Step 3: Wrap upgrade button in `<Hoverable>` and provide title/body/footer factories**

Update `src/components/painting/TrackCard.tsx`. Add import:

```ts
import { Hoverable } from "@/ui/widgets/Hoverable";
```

Replace the `<button>` element with:

```tsx
<Hoverable
  as="div"
  title={() => locked ? `${label} — Locked` : `${label} — Level ${level}`}
  body={() => (
    locked ? (
      <div>Unlocks via the canvas skill-tree node.</div>
    ) : (
      <>
        <div>Current effect:  {effectLine}</div>
        <div>Next-level cost: {costLabel}</div>
      </>
    )
  )}
  footer={() => locked ? "Visit the constellation to purchase the unlock node." : ""}
>
  <button
    type="button"
    className={styles.upgradeBtn}
    disabled={disabled}
    onClick={!disabled ? onUpgrade : undefined}
    data-testid={`track-card-upgrade-${trackId}`}
  >
    {buttonLabel}
  </button>
</Hoverable>
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/components/painting/TrackCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/TrackCard.tsx tests/components/painting/TrackCard.test.tsx
git commit -m "ui(painting): hover info on TrackCard

Title shows '<Track> — Level N' (or 'Locked' variant). Body shows
current effect line + next-level cost. Footer prompts visiting the
constellation when the track is locked."
```

---

# Phase E — Migration + cleanup

---

### Task 16: Remove legacy — `canvasTier`, `upgradeTier`, old balance formulas, `<TierCard>`

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `src/core/balance.ts`
- Modify: `tests/store/canvasSlice.test.ts`
- Modify: `tests/core/balance.test.ts`
- Delete: `src/components/painting/TierCard.tsx`
- Delete: `src/components/painting/TierCard.module.css`
- Delete: `tests/components/painting/TierCard.test.tsx` (if exists)
- Possibly modify: `src/systems/ascend.ts` (only if it references canvasTier)

This task is mechanical: remove all references to `canvasTier`, `upgradeTier`, `tierUpgradeCost`, `MAX_TIER`. After Tasks 11 + 13, no production code path reads them — only legacy code itself remains. tsc + tests guide what needs deleting.

- [ ] **Step 1: Search for residual references**

Run:

```bash
grep -rn "canvasTier\|upgradeTier\|tierUpgradeCost\|MAX_TIER\|TierCard" src/ tests/
```

Confirm only the targets listed above show up. Anything else may need separate handling.

- [ ] **Step 2: Remove fields and actions from `canvasSlice`**

In `src/store/canvasSlice.ts`:

- Remove `canvasTier` from `CanvasState`.
- Remove `canvasTier: 1` from `initialCanvasState`.
- Remove `upgradeTier: () => void;` from the `CanvasSlice` interface.
- Remove the `upgradeTier` body from `createCanvasSlice`.
- Update imports: drop `tierUpgradeCost, MAX_TIER` from the import line.

- [ ] **Step 3: Remove old balance formulas**

In `src/core/balance.ts`:

- Remove `tierUpgradeCost`.
- Remove `TIER_UPGRADE_BASE`, `TIER_UPGRADE_RATIO`, `MAX_TIER` constants.

- [ ] **Step 4: Delete `TierCard` files**

```bash
git rm src/components/painting/TierCard.tsx
git rm src/components/painting/TierCard.module.css
git rm tests/components/painting/TierCard.test.tsx 2>/dev/null || true
```

- [ ] **Step 5: Update tests that referenced legacy**

In `tests/store/canvasSlice.test.ts`:
- Remove any tests that asserted `canvasTier` value, `upgradeTier()` behaviour, or `MAX_TIER` cap.
- If a tick test asserted gold = `BASE × tier²` for a specific tier, replace with the new size-driven assertion.

In `tests/core/balance.test.ts`:
- Remove any `describe("tierUpgradeCost")` or similar blocks that no longer apply.

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All pass. Diagnose any leftover references.

Run: `npx tsc -b --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: clean (only pre-existing warning).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "store(canvas): remove legacy tier system

Drops canvasTier field, upgradeTier action, tierUpgradeCost, MAX_TIER,
and TierCard component. All callers migrated to the new 5-track model
in tasks 11 + 13. canvasGold/canvasTime keep their names but now take
sizeLevel (semantic change in task 2)."
```

---

### Task 17: Save migration v9 → v10

**Files:**
- Modify: `src/store/index.ts`
- Modify: `tests/store/persistence-integration.test.ts`

After Task 16, `CanvasState` no longer contains `canvasTier`. Persisted v9 saves still have it; on rehydrate, the migrate function strips it and seeds new defaults. Existing players are pre-release; no real cost.

- [ ] **Step 1: Write the failing test**

Add to `tests/store/persistence-integration.test.ts`:

```ts
import { migrate } from "@/store";

describe("migrate v9 → v10 (canvas depth)", () => {
  it("drops canvasTier and seeds new track fields with defaults", () => {
    const v9State: Record<string, unknown> = {
      canvasTier: 5,
      canvasProgress: 0,
      gold: { __big: "100" },
      // (other fields irrelevant for this test)
    };
    const migrated = migrate(v9State, 9) as unknown as Record<string, unknown>;
    expect(migrated.canvasTier).toBeUndefined();
    expect(migrated.sellPriceLevel).toBe(1);
    expect(migrated.speedLevel).toBe(1);
    expect(migrated.sizeLevel).toBe(0);
    expect(migrated.critLevel).toBe(0);
    expect(migrated.comboLevel).toBe(0);
    expect(migrated.comboChain).toBe(0);
    expect(migrated.isCritThisCanvas).toBe(false);
  });

  it("does not affect saves at v10 already (no-op when fromVersion >= 10)", () => {
    const v10State: Record<string, unknown> = {
      sellPriceLevel: 7,
      speedLevel: 4,
      sizeLevel: 5,
      critLevel: 0, comboLevel: 0, comboChain: 0, isCritThisCanvas: false,
      canvasProgress: 0,
    };
    const migrated = migrate(v10State, 10) as unknown as Record<string, unknown>;
    expect(migrated.sellPriceLevel).toBe(7);
    expect(migrated.speedLevel).toBe(4);
    expect(migrated.sizeLevel).toBe(5);
  });

  it("chains correctly from earlier versions (v8 → v10)", () => {
    const v8State: Record<string, unknown> = {
      // missing canvasTier — v8→v9 doesn't seed it (it was already there)
      // but v3→v4 chain seeds canvasTier=1; for testing assume legacy
      gold: { __big: "0" },
    };
    const migrated = migrate(v8State, 8) as unknown as Record<string, unknown>;
    // v8 → v9 wipes inventory etc.
    expect(migrated.workshopLevel).toBe(1);
    // v9 → v10 strips canvasTier (none present, OK) and seeds new fields
    expect(migrated.canvasTier).toBeUndefined();
    expect(migrated.sellPriceLevel).toBe(1);
    expect(migrated.sizeLevel).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/store/persistence-integration.test.ts -t "v9 → v10"`
Expected: FAIL — no v9→v10 block yet.

- [ ] **Step 3: Bump `SAVE_VERSION` and add the migration**

In `src/store/index.ts`:

```ts
const SAVE_VERSION = 10;
```

Append to the `migrate` function (after the `fromVersion < 9` block):

```ts
if (fromVersion < 10) {
  // v9 → v10 (2026-05-XX): canvas-depth rework. Replace canvasTier with 5 track levels
  // (sellPriceLevel + speedLevel unlocked at 1; sizeLevel + critLevel + comboLevel
  // gated start at 0). Seed comboChain=0, isCritThisCanvas=false.
  // Game is unreleased; no need to translate canvasTier 1-10 onto the new tracks.
  const { canvasTier: _ct, ...rest } = state;
  void _ct;
  state = {
    ...rest,
    sellPriceLevel: 1,
    speedLevel: 1,
    sizeLevel: 0,
    critLevel: 0,
    comboLevel: 0,
    comboChain: 0,
    isCritThisCanvas: false,
  };
}
```

Update the JSDoc near the top of the `migrate` function to add a v9 → v10 entry in the chain history.

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/store/persistence-integration.test.ts -t "v9 → v10"`
Expected: PASS (3 cases).

Run: `npm test`
Expected: All 658+ pass.

Run: `npx tsc -b --noEmit`
Expected: clean.

Run: `npm run build`
Expected: success; bundle still under 250 KB gzipped (target).

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "store: SAVE_VERSION 9 → 10, migrate canvas-depth schema

v9 → v10: drops canvasTier field; seeds sellPriceLevel=1, speedLevel=1,
sizeLevel=0, critLevel=0, comboLevel=0, comboChain=0,
isCritThisCanvas=false. Game unreleased — no translation of the old
1-10 tier onto the new tracks; players start fresh per spec §8."
```

---

## Self-review checklist (run after Task 17)

Final verification before declaring the plan executed:

- [ ] `npm test` — all tests pass (target: 658+).
- [ ] `npx tsc -b --noEmit` — clean.
- [ ] `npm run lint` — clean (only pre-existing main.tsx warning).
- [ ] `npm run build` — succeeds; bundle gzipped JS under 250 KB.
- [ ] Manual smoke (browser): open `/painting`, confirm:
  - 5 track cards visible in upgrades strip
  - Sell + Speed cards have working upgrade buttons (gold spends, level increments)
  - Size + Crit + Combo cards render Locked
  - Manually toggle a fame node to test unlock paths (`useGameStore.setState({ purchasedNodes: { unlock_canvas_size: 1 } })` from devtools)
  - Combo badge appears on canvas when comboChain > 0
  - CRIT indicator appears when crit fires (set `critLevel: 100` to force)
- [ ] Spec coverage check — every section of the spec has a corresponding task:
  - §2 (5 tracks table) → Tasks 1, 5, 6, 8 (state + actions)
  - §3.1–3.5 (mechanics in detail) → Tasks 2, 3, 4, 9, 10, 11
  - §4 (schema) → Tasks 5, 6, 8, 11, 16
  - §5 (ascend reset) → Task 5 (initialCanvasState test)
  - §6 (affix-pool handshake) → no code in this plan; documented in spec for subproject 2
  - §7 (UI) → Tasks 12, 13, 14, 15
  - §8 (save migration) → Task 17
  - §9 (test surface) → all tasks contribute tests
  - §10 (TBDs) → defaults baked into Task 1
  - §11 (kept vs dropped) → reflected in Task 16 (legacy removed)
  - §12 (out of scope) → respected throughout (no multi-canvas, no quality, no subjects, etc.)
  - §13 (engine surface) → covers all the above
  - §14 (definition of done) → matches this self-review checklist

If any item fails, halt and fix before declaring done.

---

## Post-merge actions (NOT plan tasks; for the operator to do)

1. **Author the 3 fame skill-tree unlock nodes** via `/dev/skill-designer`. The well-known IDs the engine reads:
   - `unlock_canvas_size`
   - `unlock_canvas_crit`
   - `unlock_canvas_combo`
   Each node grants `+1 unlock` to its respective track. Set fame costs to taste.
2. **Update `docs/HANDOVER.md`** with a v3.x section describing canvas depth shipped, the §6 affix-pool contract waiting for subproject 2, and the 3 unlock node IDs the user must author.
3. **Open subproject 2 (affix-pool rework)** — the next brainstorm starts from spec §6 of canvas-depth as input.
