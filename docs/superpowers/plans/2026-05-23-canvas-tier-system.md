# Canvas Tier System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a within-run canvas tier system that prestige-resets the five upgrade tracks and scales base output / per-level effects / upgrade costs by ×10 per tier (base time ×2 per tier), with a manual tier-up button gated by `sellPriceLevel >= 15 && speedLevel >= 15`.

**Architecture:** A new `canvasTier: number` field on `CanvasState` drives `tierFactor(tier) = 10^(tier-1)` and `timeFactor(tier) = 2^(tier-1)` helpers, which scale (a) the balance formulas (`canvasGold`, `canvasTime`, `*UpgradeCost`), and (b) the per-track contributions inside the canvas multipliers. Items, workers, school, and achievements remain tier-agnostic. `CANVAS_TIME_BASE` changes from 2 to 10; the legacy `PAINT_TIME_BASE_SECONDS = 10` constant is removed. Default `sellPriceLevel` and `speedLevel` change from `1` to `0` for fresh saves (existing saves preserve their levels via the v21→v22 migration).

**Tech Stack:** React 19 + TypeScript strict + Zustand 5 (persist middleware) + `idb-keyval` + `break_eternity.js` (Big) + Vitest.

---

## File Structure

**Created:**
- (none — all changes touch existing files)

**Modified:**
- `src/core/balance.ts` — add `tierFactor`, `timeFactor`; change `CANVAS_TIME_BASE`; remove `PAINT_TIME_BASE_SECONDS`; add `tier` param to `canvasGold`, `canvasTime`, `sellPriceUpgradeCost`, `speedUpgradeCost`, `sizeUpgradeCost`, `critUpgradeCost`, `comboUpgradeCost`
- `src/store/canvasSlice.ts` — add `canvasTier` to `CanvasState` + `initialCanvasState`; change `sellPriceLevel`/`speedLevel` defaults 1→0; pass `state.canvasTier` to cost helpers; add `tierUp` action
- `src/store/index.ts` — bump `SAVE_VERSION` 21→22; add v21→v22 migration that adds `canvasTier: 1`
- `src/core/multipliers.ts` — add `"canvasTier"` to `CanvasMultiplierInputs`; multiply each track's contribution by `tierFactor(state.canvasTier)` in `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, `getCanvasSize`
- `src/core/canvasTickPure.ts` — pass `draft.canvasTier` to `canvasGold(size, mult, tier)` and `canvasTime(size, tier)`
- `src/routes/PaintingRoute.tsx` — add `canvasTier` to helperState; pass tier to `canvasTime`/`canvasGold` and the `*UpgradeCost` previews; pass `canvasTier` to `CanvasStage` and the new `TierUpCard`
- `src/components/painting/CanvasStage.tsx` — rekey `STAGE_NAMES` from `sizeLevel` to `canvasTier`; new `canvasTier` prop; title and `tierBadge` use it
- `src/components/painting/CanvasUpgradesStrip.tsx` (or sibling component) — add `TierUpCard` button next to the five `TrackCard`s
- `src/components/painting/StatsRoom.tsx` — add tier block at the top showing current tier and active multipliers; add `canvasTier` to helperState

**Modified tests:**
- `tests/core/balance.test.ts` — `CANVAS_TIME_BASE` literal value, new helper tests, `canvasTime`/`canvasGold`/`*UpgradeCost` tier-scaling tests
- `tests/core/multipliers.test.ts` — `stub` defaults change for `sellPriceLevel`/`speedLevel`; tier-scaling tests
- `tests/core/canvasTickPure.test.ts` — `sellPriceLevel`/`speedLevel` literal `1`s become `0`s in fixtures
- `tests/store/canvasSlice.test.ts` — every `effTime = 2 / 1.05` (and variants) becomes `effTime = 10 / 1` since speedLevel defaults to 0 (or the test explicitly sets speedLevel and the math is rederived); add `tierUp` action tests
- `tests/store/persistence-integration.test.ts` — v21→v22 migration block; existing migration assertions for `sellPriceLevel: 1, speedLevel: 1` may need rebasing
- `tests/store/tickAll.test.ts` — `effectiveTime` comments and math update for `CANVAS_TIME_BASE = 10` and default `speedLevel = 0`
- `tests/dev/bot-simulation.test.ts` — `canvasTime(size)` becomes `canvasTime(size, draft.canvasTier)`
- New: `tests/components/painting/TierUpCard.test.tsx` for the three-state TierUp card
- New: `tests/routes/PaintingRoute.tierUp.test.tsx` (or extend existing PaintingRoute test) for the tier-up flow integration

---

## Task 1: Add `tierFactor` and `timeFactor` helpers

**Files:**
- Modify: `src/core/balance.ts`
- Test: `tests/core/balance.test.ts`

Pure additive change. No callers yet. Establishes the math that later tasks consume.

- [ ] **Step 1: Write failing tests for `tierFactor` and `timeFactor`**

Append to `tests/core/balance.test.ts` (above the final `});` of the existing top-level describe, OR as a new top-level `describe` block — whichever matches the file's style):

```ts
describe("tierFactor (canvas tier scaling)", () => {
  it("T1 returns 1 (no scaling)", () => {
    expect(tierFactor(1)).toBe(1);
  });

  it("T2 returns 10", () => {
    expect(tierFactor(2)).toBe(10);
  });

  it("T3 returns 100", () => {
    expect(tierFactor(3)).toBe(100);
  });

  it("T5 returns 10000", () => {
    expect(tierFactor(5)).toBe(10000);
  });
});

describe("timeFactor (canvas tier base-time scaling)", () => {
  it("T1 returns 1", () => {
    expect(timeFactor(1)).toBe(1);
  });

  it("T2 returns 2", () => {
    expect(timeFactor(2)).toBe(2);
  });

  it("T4 returns 8", () => {
    expect(timeFactor(4)).toBe(8);
  });
});
```

Add `tierFactor` and `timeFactor` to the import block at the top of the file:

```ts
import {
  // ... existing imports ...
  tierFactor,
  timeFactor,
} from "@/core/balance";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: FAIL with "tierFactor is not exported" or similar.

- [ ] **Step 3: Add the helpers to `src/core/balance.ts`**

Insert after `CANVAS_TIME_BASE = 2;` line (around line 67):

```ts
/**
 * Multiplier on base gold, per-level effects, and upgrade costs at canvas tier T.
 * `tierFactor(1) = 1`, `tierFactor(2) = 10`, `tierFactor(3) = 100`, ...
 *
 * Used by:
 *   - `canvasGold(size, mult, tier)` to scale base canvas gold
 *   - The `*UpgradeCost(level, tier)` family to scale upgrade prices
 *   - The canvas multipliers in `src/core/multipliers.ts` to scale each track's
 *     additive contribution before composing with item/worker/school/achievement bonuses
 *
 * The ×10/tier ramp matches the spec's prestige design — see
 * `docs/superpowers/specs/2026-05-23-canvas-tier-system-design.md`.
 */
export const tierFactor = (tier: number): number => Math.pow(10, tier - 1);

/**
 * Multiplier on base canvas paint time at tier T. `timeFactor(1) = 1`,
 * `timeFactor(2) = 2`, `timeFactor(4) = 8`. Time grows linearly per tier while
 * gold grows by ×10 — so gold/sec at base scales by ×5 per tier.
 */
export const timeFactor = (tier: number): number => Math.pow(2, tier - 1);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: PASS, including the new tier/time-factor describes.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): add tierFactor and timeFactor helpers for canvas tier system"
```

---

## Task 2: Add `canvasTier` state field + v21→v22 migration

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `src/store/index.ts`
- Test: `tests/store/persistence-integration.test.ts`

Pure state-shape change. No behavior change — `canvasTier: 1` is added but nothing reads it yet.

- [ ] **Step 1: Write failing migration test**

Append to `tests/store/persistence-integration.test.ts` (at the end, after the v20→v21 describe):

```ts
describe("save migration v21 → v22 (canvas tier system)", () => {
  it("adds canvasTier: 1 to a v21 save", () => {
    const v21State = {
      playerId: "deadbeef-1234-4abc-9def-1234567890ab",
      sellPriceLevel: 5,
      speedLevel: 3,
      sizeLevel: 0,
      critLevel: 0,
      comboLevel: 0,
    } as Record<string, unknown>;
    const migrated = migrate(v21State, 21);
    expect((migrated.canvasTier as number)).toBe(1);
    // Pre-existing upgrade levels preserved (no destructive reset).
    expect((migrated.sellPriceLevel as number)).toBe(5);
    expect((migrated.speedLevel as number)).toBe(3);
  });

  it("SAVE_VERSION is 22", async () => {
    const { useGameStore } = await import("@/store");
    useGameStore.getState().add("gold", big(1));
    await persistedAdapter.flush();
    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(22);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/persistence-integration.test.ts -t "v21 → v22"`
Expected: FAIL — `migrated.canvasTier` is undefined; `parsed.version` is 21.

- [ ] **Step 3: Add `canvasTier` to `CanvasState`**

In `src/store/canvasSlice.ts`, find the `CanvasState` interface (around line 11) and add `canvasTier: number;` (place it after the other level fields for grouping). Find `initialCanvasState` (around line 45) and add `canvasTier: 1` to the literal.

- [ ] **Step 4: Bump `SAVE_VERSION` and add the v21→v22 migration**

In `src/store/index.ts`:

Change `const SAVE_VERSION = 21;` to `const SAVE_VERSION = 22;`.

In the migration `migrate` function, after the `if (fromVersion < 21)` block and before `return state as unknown as GameStore;`, add:

```ts
  if (fromVersion < 22) {
    // v21 → v22 (2026-05-23): canvas tier system. Existing canvases default
    // to T1. Pre-existing upgrade levels (sellPriceLevel etc.) preserved —
    // they were not reset by this migration.
    state = {
      ...state,
      canvasTier: 1,
    };
  }
```

Append a JSDoc paragraph to the migration documentation block (matching the format of the v20→v21 paragraph that already exists):

```
 * v21 → v22 (2026-05-23): canvas tier system. Adds `canvasTier: 1` for
 * existing saves. Per-track upgrade levels are preserved.
 *
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/store/persistence-integration.test.ts -t "v21 → v22"`
Expected: PASS.

- [ ] **Step 6: Run full vitest to confirm no regression**

Run: `npx vitest run`
Expected: all tests pass. `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/canvasSlice.ts src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "store(canvas): add canvasTier field + v21->v22 migration"
```

---

## Task 3: Rebaseline constants — `CANVAS_TIME_BASE` 2→10, default levels 1→0, remove `PAINT_TIME_BASE_SECONDS`

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `src/store/canvasSlice.ts`
- Test: many — see audit list below

This task changes balance numerics. Many existing tests assume `CANVAS_TIME_BASE = 2` and default `sellPriceLevel = 1, speedLevel = 1`. All affected tests are updated in this single task so the suite stays green when done.

**Audit list (verified via grep, complete as of writing):**
- `tests/core/balance.test.ts:164,166,168,172-173,260` — `canvasTime(N)` expected values + `expect(CANVAS_TIME_BASE).toBe(2)`
- `tests/core/multipliers.test.ts:23-24,30,36,214` — `sellPriceLevel: 1`/`speedLevel: 1` stubs and assertions
- `tests/core/canvasTickPure.test.ts:21-22,42` — `sellPriceLevel: 1, speedLevel: 1` fixtures
- `tests/store/canvasSlice.test.ts:37,38,47,48,75,81,94,124,134,142,150,160,167,184-185,194,202,373` — `effTime = 2 / 1.05` patterns
- `tests/store/tickAll.test.ts:31,49` — `effectiveTime` comment + `2/1.05` math
- `tests/store/persistence-integration.test.ts:643` — `sellPriceLevel: 1, speedLevel: 1` fixture
- `tests/dev/bot-simulation.test.ts:150` — `canvasTime(size)` (will be updated to take tier in Task 4; for now this still works as `canvasTime(size)` returns `10 × size`)

- [ ] **Step 1: Change `CANVAS_TIME_BASE` and remove `PAINT_TIME_BASE_SECONDS`**

In `src/core/balance.ts`:

Change `export const CANVAS_TIME_BASE = 2;` to `export const CANVAS_TIME_BASE = 10;`.

Delete the line `export const PAINT_TIME_BASE_SECONDS = 10;` (near the top, around line 14).

Update the JSDoc comment on `canvasTime` (around line 119) from:
```
 * size = 1 (no upgrades, no items, no workers) ⇒ time = CANVAS_TIME_BASE = 2s.
```
to:
```
 * size = 1 (no upgrades, no items, no workers) ⇒ time = CANVAS_TIME_BASE = 10s.
```

- [ ] **Step 2: Change default `sellPriceLevel` and `speedLevel` from 1 to 0**

In `src/store/canvasSlice.ts`, in `initialCanvasState` (around line 45), change:
```ts
sellPriceLevel: 1,
speedLevel: 1,
```
to:
```ts
sellPriceLevel: 0,
speedLevel: 0,
```

- [ ] **Step 3: Update `tests/core/balance.test.ts`**

Find every occurrence of the old `CANVAS_TIME_BASE = 2`-derived expected values and update them:

- Line 164: `expect(canvasTime(1)).toBeCloseTo(2, 5);` → `expect(canvasTime(1)).toBeCloseTo(10, 5);`
- Line 166: `expect(canvasTime(2)).toBeCloseTo(4, 5);` → `expect(canvasTime(2)).toBeCloseTo(20, 5);`
- Line 168: `expect(canvasTime(1.5)).toBeCloseTo(3, 5);` → `expect(canvasTime(1.5)).toBeCloseTo(15, 5);`
- Lines 172-173 (ratio test): the ratio is still 2.0, so the test still passes — but verify by reading the lines and re-running.
- Line 260: `expect(CANVAS_TIME_BASE).toBe(2);` → `expect(CANVAS_TIME_BASE).toBe(10);`

Also update the test names if they say "2s" (line 164 area has comments like `size 1 → 2s`). Change to `size 1 → 10s`, `size 2 → 20s`, etc.

If a test file imports `PAINT_TIME_BASE_SECONDS`, remove the import. (Per the earlier grep, this happens in `tests/store/persistence-integration.test.ts:6` — covered in Step 7 below.)

- [ ] **Step 4: Update `tests/core/multipliers.test.ts`**

Read the file. The `stub` helper (around line 17-26) sets `sellPriceLevel: 1, speedLevel: 1` defaults. Change them to `0`. Update any test that exercises `getCanvasGoldMultiplier`/`getCanvasSpeedMultiplier` with these defaults to either pass the level explicitly or update the expected value:

- Line 30: `expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 1 }))).toBeCloseTo(1.10, 5);` — passes `sellPriceLevel: 1` explicitly, so it still works as `1 + 0.10×1 = 1.10`. No change needed.
- Line 32: `expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 10 }))).toBeCloseTo(2.00, 5);` — also explicit, still works.
- Line 36: `expect(getCanvasSpeedMultiplier(stub({ speedLevel: 1 }))).toBeCloseTo(1.05, 5);` — explicit, still works.
- Line 37: `expect(getCanvasSpeedMultiplier(stub({ speedLevel: 10 }))).toBeCloseTo(1.50, 5);` — explicit, still works.
- Line 214 (the `over` spread): change to either explicit `speedLevel: 1` if the test relies on it, or update expected values.

Important: any test that creates a stub without specifying `sellPriceLevel`/`speedLevel` and asserts gold multiplier ≥ 1.10 will need updating, because the default is now `0` (multiplier = 1.0). Grep for `stub(` callsites and audit each.

- [ ] **Step 5: Update `tests/core/canvasTickPure.test.ts`**

In the fixture around line 21-22: change `sellPriceLevel: 1, speedLevel: 1,` to `sellPriceLevel: 0, speedLevel: 0,`. Same for the fixture at line 42. If any assertion downstream depends on the +10%/+5% multiplier (e.g., `effectiveTime = 2 / 1.05`), update to `effectiveTime = 10 / 1 = 10` (with `CANVAS_TIME_BASE = 10` and speed=0 multiplier of 1.0).

- [ ] **Step 6: Update `tests/store/canvasSlice.test.ts`**

Every `effTime = 2 / 1.05` (lines 38, 48, 75, 81, 94, 124, 134, 142, 150, 160, 167, 185, 194, 202) needs updating:

- Old derivation: `canvasTime(0) / getCanvasSpeedMultiplier = 2 / (1 + 0.05 × 1) = 2 / 1.05 ≈ 1.905s`
- New derivation: `canvasTime(0) / getCanvasSpeedMultiplier = 10 / (1 + 0.05 × 0) = 10 / 1 = 10s`

So `const effTime = 2 / 1.05;` becomes `const effTime = 10;` (or `const effTime = 10 / 1;` for clarity).

For the test at line 184-185 (`canvasTime(size=1) = 2s; speedLevel=1 → speedMult = 1.05`): the comment and math need updating. Either:
  - (a) Update the comment to `canvasTime(size=1) = 10s; speedLevel=0 → speedMult = 1.0; effTime = 10s`, or
  - (b) Explicitly set `useGameStore.setState({ speedLevel: 1 })` at the start of the test and keep the math at `effTime = 10 / 1.05 ≈ 9.524s`.

Choose (a) for simplicity unless the test specifically exercises a non-zero speed.

For line 194 (`const effTime = (2 * 1.15) / 1.05;`): becomes `(10 * 1.15) / 1.0 = 11.5` if speedLevel=0, OR explicit speed setup.

Read each test carefully and update the math to match. The pattern is mechanical: replace `2` with `10` for the base, and `1.05` with `1` if speedLevel defaults are not explicitly set in the test.

For the test at line 373 (the crit timing): `canvasTime(0) = 2; speedMult = 1.05 → crit time = 2/(1.05×10) ≈ 0.190s`. Update to `canvasTime(0) = 10; speedMult = 1 → crit time = 10/(1×10) = 1s`.

- [ ] **Step 7: Update `tests/store/tickAll.test.ts`**

Line 31 comment: `// effectiveTime = canvasTime(0) / speedMult = 2 / (1 + 0.05×1) = 2/1.05 ≈ 1.905s.` → change to `// effectiveTime = canvasTime(0) / speedMult = 10 / 1 = 10s.`

Line 49: `const expectedLeftover = 2.5 - 2 / 1.05;` — Re-derive based on the new math. With `effTime = 10s` and a tick of `2.5s`, no sale happens (2.5 < 10) and `expectedLeftover = 2.5`. The test likely needs a larger tick to trigger a sale, OR keep the same tick and assert no sale + progress = 2.5. **Read the surrounding context to understand the intent** — the test may need its tick duration scaled to match the 5× longer canvas time.

- [ ] **Step 8: Update `tests/store/persistence-integration.test.ts`**

Remove the `PAINT_TIME_BASE_SECONDS` import on line 6. At line 61, `useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);` was using the constant as a magic "10 second tick" value. Replace with `useGameStore.getState().canvasTick(10);` (literal) since the value semantically is "tick long enough to trigger a sale," and 10s matches the new `CANVAS_TIME_BASE`.

At line 643 (fixture for v9→v10 migration): the `sellPriceLevel: 1, speedLevel: 1,` in the input shape is FINE because it represents the OLD save's state — the migration preserves whatever was there. Don't change this.

- [ ] **Step 9: Update `tests/dev/bot-simulation.test.ts`**

Line 150 uses `canvasTime(size)` — this still works in this task (still single-param). It'll be updated to take tier in Task 4. No change needed yet.

- [ ] **Step 10: Run the full test suite to surface any other failures**

Run: `npx vitest run`
Expected: all tests pass. If a test outside the audit list fails, it likely has an implicit assumption about base time or default levels — fix it in the same task.

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 12: Commit**

```bash
git add src/core/balance.ts src/store/canvasSlice.ts tests/core/balance.test.ts tests/core/multipliers.test.ts tests/core/canvasTickPure.test.ts tests/store/canvasSlice.test.ts tests/store/tickAll.test.ts tests/store/persistence-integration.test.ts
git commit -m "balance(canvas): CANVAS_TIME_BASE 2->10, drop PAINT_TIME_BASE_SECONDS, default upgrade levels 0"
```

---

## Task 4: Add `tier` parameter to balance formulas

**Files:**
- Modify: `src/core/balance.ts`
- Test: `tests/core/balance.test.ts`

Add `tier` as the last positional param to `canvasGold`, `canvasTime`, and the five `*UpgradeCost` functions. Default `tier = 1` so existing callers don't break. Pure additive change to function signatures.

- [ ] **Step 1: Write failing tests for tier-scaled balance formulas**

Append to `tests/core/balance.test.ts`:

```ts
describe("canvasGold (tier-scaled)", () => {
  it("T1 unchanged: returns CANVAS_GOLD_BASE × size² × mult", () => {
    expect(canvasGold(1, 1, 1).toNumber()).toBeCloseTo(10, 5);
    expect(canvasGold(1, 1).toNumber()).toBeCloseTo(10, 5); // default tier=1
  });

  it("T2: ×10 base", () => {
    expect(canvasGold(1, 1, 2).toNumber()).toBeCloseTo(100, 5);
  });

  it("T3: ×100 base", () => {
    expect(canvasGold(1, 1, 3).toNumber()).toBeCloseTo(1000, 5);
  });

  it("tier composes with size² and multiplier", () => {
    // T2, size=2, mult=3: 10 × 4 × 3 × 10 = 1200
    expect(canvasGold(2, 3, 2).toNumber()).toBeCloseTo(1200, 5);
  });
});

describe("canvasTime (tier-scaled)", () => {
  it("T1 unchanged: returns CANVAS_TIME_BASE × size", () => {
    expect(canvasTime(1, 1)).toBeCloseTo(10, 5);
    expect(canvasTime(1)).toBeCloseTo(10, 5); // default tier=1
  });

  it("T2: ×2 base time", () => {
    expect(canvasTime(1, 2)).toBeCloseTo(20, 5);
  });

  it("T4: ×8 base time", () => {
    expect(canvasTime(1, 4)).toBeCloseTo(80, 5);
  });
});

describe("*UpgradeCost (tier-scaled)", () => {
  it("sellPriceUpgradeCost T1 L1 = 100 (unchanged)", () => {
    expect(sellPriceUpgradeCost(0, 1).toNumber()).toBeCloseTo(100, 1);
    expect(sellPriceUpgradeCost(0).toNumber()).toBeCloseTo(100, 1); // default tier=1
  });

  it("sellPriceUpgradeCost T2 L1 = 1000 (×10)", () => {
    expect(sellPriceUpgradeCost(0, 2).toNumber()).toBeCloseTo(1000, 1);
  });

  it("speedUpgradeCost T3 L1 = 10000 (×100)", () => {
    expect(speedUpgradeCost(0, 3).toNumber()).toBeCloseTo(10000, 1);
  });

  it("sizeUpgradeCost T2 L1 = 10000 (was 1000)", () => {
    expect(sizeUpgradeCost(0, 2).toNumber()).toBeCloseTo(10000, 1);
  });

  it("critUpgradeCost T2 L1 = 50000 (was 5000)", () => {
    expect(critUpgradeCost(0, 2).toNumber()).toBeCloseTo(50000, 1);
  });

  it("comboUpgradeCost T2 L1 = 50000 (was 5000)", () => {
    expect(comboUpgradeCost(0, 2).toNumber()).toBeCloseTo(50000, 1);
  });

  it("tier-scaling composes with 1.5^level cost ladder", () => {
    // T2, L5: SELL_PRICE_COST_BASE × tierFactor × 1.5^5 = 100 × 10 × 7.59375 ≈ 7593.75
    expect(sellPriceUpgradeCost(5, 2).toNumber()).toBeCloseTo(7593.75, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts -t "tier-scaled"`
Expected: FAIL — function signatures don't accept the third param yet.

- [ ] **Step 3: Update the formula signatures in `src/core/balance.ts`**

Change `canvasGold` (around line 111) from:
```ts
export const canvasGold = (size: number, multiplier: number): Big =>
  big(CANVAS_GOLD_BASE).mul(size * size).mul(multiplier);
```
to:
```ts
export const canvasGold = (size: number, multiplier: number, tier = 1): Big =>
  big(CANVAS_GOLD_BASE).mul(size * size).mul(multiplier).mul(tierFactor(tier));
```

Change `canvasTime` (around line 122) from:
```ts
export const canvasTime = (size: number): number =>
  CANVAS_TIME_BASE * size;
```
to:
```ts
export const canvasTime = (size: number, tier = 1): number =>
  CANVAS_TIME_BASE * size * timeFactor(tier);
```

Update the JSDoc for `canvasTime` to mention the tier scaling.

Change the five `*UpgradeCost` functions (around lines 192-205) from:
```ts
export const sellPriceUpgradeCost = (currentLevel: number): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));
// ... similar for speed/size/crit/combo
```
to:
```ts
export const sellPriceUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(tierFactor(tier));

export const speedUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SPEED_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(tierFactor(tier));

export const sizeUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SIZE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(tierFactor(tier));

export const critUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(CRIT_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(tierFactor(tier));

export const comboUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(COMBO_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(tierFactor(tier));
```

Update the JSDoc on these to mention tier scaling.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: PASS, including the new tier-scaled describes.

- [ ] **Step 5: Run full suite (default tier=1 means no regression)**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): add tier param (default 1) to canvasGold, canvasTime, *UpgradeCost"
```

---

## Task 5: Wire tier into canvas multipliers + callsites + tick

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `src/core/canvasTickPure.ts`
- Modify: `src/store/canvasSlice.ts`
- Modify: `src/routes/PaintingRoute.tsx`
- Modify: `src/components/painting/StatsRoom.tsx`
- Test: `tests/core/multipliers.test.ts`

The five canvas multipliers (gold, speed, crit, combo, size) now read `state.canvasTier` and multiply each *track contribution* (sellPriceLevel, speedLevel, etc.) by `tierFactor(canvasTier)`. Item / worker / school / achievement contributions stay tier-agnostic. `canvasTickPure` and `canvasSlice` pass the tier to the balance formulas.

- [ ] **Step 1: Write failing tests for tier-scaled multipliers**

Append to `tests/core/multipliers.test.ts`:

```ts
describe("multipliers — tier scaling (canvasTier)", () => {
  it("getCanvasGoldMultiplier T2 multiplies sell-price track contribution by 10", () => {
    // T1, sellPriceLevel=5: 1 + 0.10 × 5 = 1.50
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 5, canvasTier: 1 })))
      .toBeCloseTo(1.50, 5);
    // T2, sellPriceLevel=5: 1 + 0.10 × 5 × 10 = 6.0
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 5, canvasTier: 2 })))
      .toBeCloseTo(6.0, 5);
  });

  it("getCanvasSpeedMultiplier T3 multiplies speed track contribution by 100", () => {
    // T1, speedLevel=2: 1 + 0.05 × 2 = 1.10
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 2, canvasTier: 1 })))
      .toBeCloseTo(1.10, 5);
    // T3, speedLevel=2: 1 + 0.05 × 2 × 100 = 11.0
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 2, canvasTier: 3 })))
      .toBeCloseTo(11.0, 5);
  });

  it("getCanvasSize T2 multiplies size track contribution by 10", () => {
    // T1, sizeLevel=3: 1 + 0.15 × 3 = 1.45
    expect(getCanvasSize(stub({ sizeLevel: 3, canvasTier: 1 })))
      .toBeCloseTo(1.45, 5);
    // T2, sizeLevel=3: 1 + 0.15 × 3 × 10 = 5.50
    expect(getCanvasSize(stub({ sizeLevel: 3, canvasTier: 2 })))
      .toBeCloseTo(5.50, 5);
  });

  it("getCritChance T2 multiplies crit track contribution by 10 (still clamped by soft cap)", () => {
    // T1, critLevel=5: 0.01 × 5 = 0.05 (below soft cap)
    expect(getCritChance(stub({ critLevel: 5, canvasTier: 1 })))
      .toBeCloseTo(0.05, 5);
    // T2, critLevel=5: 0.01 × 5 × 10 = 0.50, above soft cap threshold 0.30 → clamped via the existing soft-cap formula
    expect(getCritChance(stub({ critLevel: 5, canvasTier: 2 })))
      .toBeGreaterThan(0.30);
  });

  it("getComboBaseChance T2 multiplies combo track contribution by 10 (capped at 1.0)", () => {
    // T1, comboLevel=10: 0.02 × 10 = 0.20
    expect(getComboBaseChance(stub({ comboLevel: 10, canvasTier: 1 })))
      .toBeCloseTo(0.20, 5);
    // T2, comboLevel=10: 0.02 × 10 × 10 = 2.0 → capped at 1.0
    expect(getComboBaseChance(stub({ comboLevel: 10, canvasTier: 2 })))
      .toBeCloseTo(1.0, 5);
  });

  it("item / worker / school / achievement contributions are NOT tier-scaled", () => {
    // A sell-price multiplier with ONLY an item contribution should be tier-agnostic.
    // Build an equipped state with a +20% sell_price item and no track levels.
    const itemOnly = stub({
      sellPriceLevel: 0,
      canvasTier: 1,
      equipped: {
        brush: {
          id: "test", slot: "brush", tier: "rare", fuseCount: 0,
          affixes: [{ kind: "+sell_price%", magnitude: 20 }],
        },
      },
    });
    const itemOnlyT3 = { ...itemOnly, canvasTier: 3 };
    // T1 = 1 + 0.20 (item) = 1.20
    // T3 = 1 + 0.20 (item, NOT scaled) + 0 × tier = 1.20
    expect(getCanvasGoldMultiplier(itemOnly)).toBeCloseTo(1.20, 5);
    expect(getCanvasGoldMultiplier(itemOnlyT3)).toBeCloseTo(1.20, 5);
  });
});
```

Update the `stub` helper at the top of the file (around line 17-26) to include `canvasTier: 1` in the defaults:

```ts
const stub = (over: Partial<CanvasMultiplierInputs> = {}): CanvasMultiplierInputs => ({
  purchasedNodes: {},
  equipped: {},
  roster: [],
  sellPriceLevel: 0,
  speedLevel: 0,
  sizeLevel: 0,
  critLevel: 0,
  comboLevel: 0,
  canvasTier: 1,
  completedResearches: {},
  completedAchievements: {},
  ...over,
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/multipliers.test.ts -t "tier scaling"`
Expected: FAIL — multipliers don't read `canvasTier`; `CanvasMultiplierInputs` doesn't include it.

- [ ] **Step 3: Add `canvasTier` to `CanvasMultiplierInputs`**

In `src/core/multipliers.ts`, find `CanvasMultiplierInputs` (around lines 30-42) and add `"canvasTier"` to the `Pick` union (place it next to the other level fields):

```ts
export type CanvasMultiplierInputs = Pick<GameStore,
  | "equipped"
  | "roster"
  | "purchasedNodes"
  | "sellPriceLevel"
  | "speedLevel"
  | "sizeLevel"
  | "critLevel"
  | "comboLevel"
  | "canvasTier"
  | "completedResearches"
  | "completedAchievements"
>;
```

Add `tierFactor` to the balance import at the top of the file.

- [ ] **Step 4: Wire `tierFactor(state.canvasTier)` into each multiplier's track contribution**

In `src/core/multipliers.ts`. Each of the five functions below changes the per-track-level term to multiply by `tierFactor(state.canvasTier)`. Items, workers, school, achievements, and skill-tree node contributions all stay un-tiered.

**`getCanvasGoldMultiplier`** (currently around lines 85-98):

```ts
export const getCanvasGoldMultiplier = (state: CanvasMultiplierInputs): number => {
  const tier = tierFactor(state.canvasTier);
  let bonus = 0;
  bonus += getEquippedContribution(state, "+sell_price%");
  bonus += getOfficeContribution(state, "+sell_price%").toNumber();
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    bonus += getNodeLevel(state, id) * perLevel;
  }
  bonus += SELL_PRICE_PER_LEVEL * state.sellPriceLevel * tier;
  bonus += getSchoolBonus(state, "canvas_gold_pct");
  bonus += getAchievementBonus(state, "canvas_gold_pct");
  const additive = 1 + bonus;
  const rainbowMul = 1 + getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;
  return additive * rainbowMul;
};
```

**`getCanvasSpeedMultiplier`** (currently around lines 109-119):

```ts
export const getCanvasSpeedMultiplier = (state: CanvasMultiplierInputs): number => {
  const tier = tierFactor(state.canvasTier);
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  bonus += SPEED_PER_LEVEL * state.speedLevel * tier;
  bonus += getEquippedContribution(state, "+speed%");
  bonus += getOfficeContribution(state, "+speed%").toNumber();
  bonus += getSchoolBonus(state, "speed_pct");
  bonus += getAchievementBonus(state, "speed_pct");
  return 1 + bonus;
};
```

**`getCritChance`** (currently around lines 187-194). The soft-cap formula at the end stays — only the raw chance gets the tier multiplier:

```ts
export const getCritChance = (state: CanvasMultiplierInputs): number => {
  const tier = tierFactor(state.canvasTier);
  let raw = CRIT_PER_LEVEL * state.critLevel * tier;
  raw += getEquippedContribution(state, "+crit_chance%");
  raw += getOfficeContribution(state, "+crit_chance%").toNumber();
  if (raw <= CRIT_SOFT_CAP_THRESHOLD) return raw;
  const range = CRIT_SOFT_CAP_CEILING - CRIT_SOFT_CAP_THRESHOLD;
  return CRIT_SOFT_CAP_THRESHOLD + range * (1 - Math.exp(-(raw - CRIT_SOFT_CAP_THRESHOLD) / (range * 0.5)));
};
```

**`getComboBaseChance`** (currently around lines 201-206). The `Math.min(1.0, ...)` clamp stays:

```ts
export const getComboBaseChance = (state: CanvasMultiplierInputs): number => {
  const tier = tierFactor(state.canvasTier);
  let chance = COMBO_PER_LEVEL * state.comboLevel * tier;
  chance += getEquippedContribution(state, "+combo_chance%");
  chance += getOfficeContribution(state, "+combo_chance%").toNumber();
  return Math.min(1.0, chance);
};
```

**`getCanvasSize`** (currently around lines 218-224):

```ts
export const getCanvasSize = (state: CanvasMultiplierInputs): number => {
  const tier = tierFactor(state.canvasTier);
  return 1
    + SIZE_PER_LEVEL * state.sizeLevel * tier
    + getEquippedContribution(state, "+size%")
    + getOfficeContribution(state, "+size%").toNumber()
    + countCapability(state, "canvas_size_bonus") * 0.05;
};
```

- [ ] **Step 5: Update `helperState` builders to include `canvasTier`**

`src/routes/PaintingRoute.tsx` builds a `helperState: CanvasMultiplierInputs` around lines 59-64. Add `canvasTier` from a new selector:

```ts
const canvasTier = useGameStore((s) => s.canvasTier);
// ...
const helperState: CanvasMultiplierInputs = {
  equipped, purchasedNodes, roster, canvasTier,
  sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel,
  completedResearches,
  completedAchievements,
};
```

`src/components/painting/StatsRoom.tsx` builds a similar helperState (around line 168-173). Add `canvasTier` selector and field. Also add `canvasTier` to the `useMemo` dependency array (line 175).

- [ ] **Step 6: Update `canvasTickPure` to pass tier to balance helpers**

`src/core/canvasTickPure.ts` calls `canvasGold(size, goldMult * critGoldMult)` and computes time-derived state. Pass `draft.canvasTier`:

Search for `canvasGold(` and `canvasTime(` in `src/core/canvasTickPure.ts`. Update calls:
- `canvasGold(size, goldMult * critGoldMult)` → `canvasGold(size, goldMult * critGoldMult, draft.canvasTier)`
- Any `canvasTime(size)` → `canvasTime(size, draft.canvasTier)`

- [ ] **Step 7: Update `canvasSlice` upgrade actions to pass tier to cost functions**

In `src/store/canvasSlice.ts`, find each upgrade action (`upgradeSellPrice`, `upgradeSpeed`, `upgradeSize`, `upgradeCrit`, `upgradeCombo`). Each currently reads cost like:

```ts
const cost = sellPriceUpgradeCost(state.sellPriceLevel);
```

Change to:
```ts
const cost = sellPriceUpgradeCost(state.sellPriceLevel, state.canvasTier);
```

Apply to all five upgrade actions.

- [ ] **Step 8: Update `PaintingRoute` cost previews to pass tier**

In `src/routes/PaintingRoute.tsx`, find the cost previews (around lines 81-85):

```ts
const sellCost = sellPriceUpgradeCost(sellPriceLevel);
const speedCost = speedUpgradeCost(speedLevel);
// etc.
```

Change to:
```ts
const sellCost = sellPriceUpgradeCost(sellPriceLevel, canvasTier);
const speedCost = speedUpgradeCost(speedLevel, canvasTier);
const sizeCost = sizeUpgradeCost(sizeLevel, canvasTier);
const critCost = critUpgradeCost(critLevel, canvasTier);
const comboCost = comboUpgradeCost(comboLevel, canvasTier);
```

Find the canvasTime and canvasGold calls in `PaintingRoute.tsx`:
- `const baseTime = canvasTime(size);` → `const baseTime = canvasTime(size, canvasTier);`
- `const baseGold = canvasGold(size, goldMult);` → `const baseGold = canvasGold(size, goldMult, canvasTier);`

- [ ] **Step 9: Run multiplier tests**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: PASS, including the new tier-scaling describes.

- [ ] **Step 10: Run full suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. (If StatsRoom or PaintingRoute is missing the `canvasTier` field in their helperState, tsc will catch it.)

- [ ] **Step 12: Commit**

```bash
git add src/core/multipliers.ts src/core/canvasTickPure.ts src/store/canvasSlice.ts src/routes/PaintingRoute.tsx src/components/painting/StatsRoom.tsx tests/core/multipliers.test.ts
git commit -m "core(canvas-tier): scale track contributions, gold, time, costs by canvasTier"
```

---

## Task 6: Add `tierUp` action

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Test: `tests/store/canvasSlice.test.ts`

Add a `tierUp(): boolean` action that enforces the gate, increments `canvasTier`, resets the five upgrade tracks back to 0, resets in-canvas state (`canvasProgress=0, comboChain=0, isCritThisCanvas=false`), and calls `evaluateAchievements`.

- [ ] **Step 1: Write failing tests for `tierUp`**

Append to `tests/store/canvasSlice.test.ts`:

```ts
describe("canvasTier — tierUp action", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...initialCanvasState,
      gold: big(0),
    });
  });

  it("rejects tier-up when gate not met (sellPriceLevel < 15)", () => {
    useGameStore.setState({ sellPriceLevel: 14, speedLevel: 15 });
    const result = useGameStore.getState().tierUp();
    expect(result).toBe(false);
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().sellPriceLevel).toBe(14);
  });

  it("rejects tier-up when gate not met (speedLevel < 15)", () => {
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 14 });
    const result = useGameStore.getState().tierUp();
    expect(result).toBe(false);
    expect(useGameStore.getState().canvasTier).toBe(1);
  });

  it("accepts tier-up when gate met (both >= 15)", () => {
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 15 });
    const result = useGameStore.getState().tierUp();
    expect(result).toBe(true);
    expect(useGameStore.getState().canvasTier).toBe(2);
  });

  it("on success, resets all five upgrade tracks to 0", () => {
    useGameStore.setState({
      sellPriceLevel: 20, speedLevel: 18, sizeLevel: 10, critLevel: 5, comboLevel: 3,
    });
    useGameStore.getState().tierUp();
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(0);
    expect(s.speedLevel).toBe(0);
    expect(s.sizeLevel).toBe(0);
    expect(s.critLevel).toBe(0);
    expect(s.comboLevel).toBe(0);
  });

  it("on success, resets in-canvas state (canvasProgress, comboChain, isCritThisCanvas)", () => {
    useGameStore.setState({
      sellPriceLevel: 15, speedLevel: 15,
      canvasProgress: 5.5, comboChain: 3, isCritThisCanvas: true,
    });
    useGameStore.getState().tierUp();
    const s = useGameStore.getState();
    expect(s.canvasProgress).toBe(0);
    expect(s.comboChain).toBe(0);
    expect(s.isCritThisCanvas).toBe(false);
  });

  it("multiple tier-ups bump canvasTier by 1 each time", () => {
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 15 });
    useGameStore.getState().tierUp();
    expect(useGameStore.getState().canvasTier).toBe(2);
    // Levels were reset; bump them back up to gate
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 15 });
    useGameStore.getState().tierUp();
    expect(useGameStore.getState().canvasTier).toBe(3);
  });
});
```

Add `tierUp: () => boolean;` to the `CanvasSlice` interface (next to the existing action signatures in `canvasSlice.ts`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "tierUp"`
Expected: FAIL — `tierUp` is not a function.

- [ ] **Step 3: Implement `tierUp` in `canvasSlice.ts`**

In `src/store/canvasSlice.ts`, in the slice creator (where the other actions live), add:

```ts
tierUp: () => {
  const state = get();
  if (state.sellPriceLevel < 15 || state.speedLevel < 15) return false;
  set({
    canvasTier: state.canvasTier + 1,
    sellPriceLevel: 0,
    speedLevel: 0,
    sizeLevel: 0,
    critLevel: 0,
    comboLevel: 0,
    canvasProgress: 0,
    comboChain: 0,
    isCritThisCanvas: false,
  });
  get().evaluateAchievements();
  return true;
},
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "tierUp"`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/store/canvasSlice.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): add tierUp action with gate check + level/state reset"
```

---

## Task 7: CanvasStage — STAGE_NAMES rekey + canvasTier prop

**Files:**
- Modify: `src/components/painting/CanvasStage.tsx`
- Modify: `src/routes/PaintingRoute.tsx`
- Test: `tests/components/painting/CanvasStage.hover.test.tsx`

Rekey `STAGE_NAMES` from `sizeLevel` to `canvasTier`. Add `canvasTier` as a CanvasStage prop. The title and tier badge use `canvasTier` instead of `sizeLevel`. The pixel-art aria label still uses `sizeLevel` (it describes the visual size, unrelated to the tier).

- [ ] **Step 1: Add `canvasTier` prop to `CanvasStage`**

In `src/components/painting/CanvasStage.tsx`:

In the `Props` interface (around line 40-55), add:
```ts
canvasTier: number;
```

In the function signature, add `canvasTier` to the destructured props.

Rekey `STAGE_NAMES` (around line 55) from `Record<number, string>` keyed by sizeLevel (0..10) to keyed by canvasTier (1..11). The literal names stay the same — only the key offsets shift by +1:

```ts
const STAGE_NAMES: Record<number, string> = {
  1: "Sketch",
  2: "Apprentice",
  3: "Journeyman",
  4: "Adept",
  5: "Skilled",
  6: "Masterpiece",
  7: "Virtuoso",
  8: "Master",
  9: "Grandmaster",
  10: "Legendary",
  11: "Mythic",
};
```

Update the stage-name lookup (around line 89):
```ts
const stageName = STAGE_NAMES[canvasTier] ?? `Tier ${canvasTier}`;
```

Update the title row (around line 107):
```tsx
<div className={styles.title}>
  — Tier {canvasTier} · {stageName} —
</div>
```

(Previously it was `— {stageName} —` without a tier number; now it shows both.)

Update the tier badge (around line 167) from:
```tsx
<span className={styles.tierBadge}>Tier {sizeLevel}</span>
```
to:
```tsx
<span className={styles.tierBadge}>Tier {canvasTier}</span>
```

The `aria-label` on the SVG (around line 115) still uses `sizeLevel`:
```tsx
aria-label={`Tier ${sizeLevel} pixel landscape`}
```
Update to make the semantic accurate:
```tsx
aria-label={`Size ${sizeLevel} pixel landscape`}
```

- [ ] **Step 2: Pass `canvasTier` from `PaintingRoute`**

In `src/routes/PaintingRoute.tsx`, find the `<CanvasStage ... />` usage (around lines 92-101) and add `canvasTier={canvasTier}`:

```tsx
<CanvasStage
  sizeLevel={sizeLevel}
  canvasTier={canvasTier}
  progressPct={progressPct}
  timeElapsed={canvasProgress.toFixed(1)}
  timeTotal={paintTimeSec.toFixed(1)}
  nextSaleGold={formatBig(nextSaleGold)}
  comboChain={comboChain}
  isCrit={isCritThisCanvas}
  canvasNumber={lastSale?.id ?? 0}
/>
```

`canvasTier` selector was added to PaintingRoute in Task 5; reuse it.

- [ ] **Step 3: Update the hover test fixture if needed**

In `tests/components/painting/CanvasStage.hover.test.tsx`, the `<CanvasStage ... />` calls need the new `canvasTier` prop. Find each render call and add `canvasTier={1}`. Example:

```tsx
render(
  <CanvasStage canvasTier={1} sizeLevel={3} progressPct={0.5} timeElapsed="3.0" timeTotal="6.0" nextSaleGold="90" />,
);
```

- [ ] **Step 4: Run hover tests**

Run: `npx vitest run tests/components/painting/CanvasStage.hover.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full UI tests**

Run: `npx vitest run tests/routes tests/components`
Expected: all pass.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/painting/CanvasStage.tsx src/routes/PaintingRoute.tsx tests/components/painting/CanvasStage.hover.test.tsx
git commit -m "ui(canvas-stage): rekey STAGE_NAMES to canvasTier; show tier number in title and badge"
```

---

## Task 8: Add TierUp card to the canvas upgrades strip

**Files:**
- Create: `src/components/painting/TierUpCard.tsx`
- Modify: `src/components/painting/CanvasUpgradesStrip.tsx`
- Modify: `src/routes/PaintingRoute.tsx`
- Create: `tests/components/painting/TierUpCard.test.tsx`

The TierUp card is a button-style card next to the five `TrackCard`s. Two visible states: Locked (gate not met) and Ready (gate met). Free — no gold cost. Click triggers `useGameStore.getState().tierUp()`.

- [ ] **Step 1: Read existing `TrackCard` to mirror styling and structure**

Read `src/components/painting/TrackCard.tsx` to understand the existing card pattern (props, classnames, button styling). The TierUpCard should look visually similar (same card shape) but with different content.

- [ ] **Step 2: Write failing tests for `TierUpCard`**

Create `tests/components/painting/TierUpCard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierUpCard } from "@/components/painting/TierUpCard";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";

describe("<TierUpCard />", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState });
  });

  it("renders in Locked state when gate is not met", () => {
    useGameStore.setState({ sellPriceLevel: 14, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={14} speedLevel={15} canvasTier={1} />);
    expect(screen.getByTestId("tier-up-card")).toHaveAttribute("data-state", "locked");
    expect(screen.getByText(/Reach sell_price L15.*speed L15/)).toBeInTheDocument();
  });

  it("renders in Ready state when gate is met", () => {
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={15} speedLevel={15} canvasTier={1} />);
    expect(screen.getByTestId("tier-up-card")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText(/Tier 2.*×10 base gold/)).toBeInTheDocument();
  });

  it("clicking the Ready card calls tierUp and bumps canvasTier", () => {
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={15} speedLevel={15} canvasTier={1} />);
    fireEvent.click(screen.getByTestId("tier-up-card"));
    expect(useGameStore.getState().canvasTier).toBe(2);
    // Levels were reset
    expect(useGameStore.getState().sellPriceLevel).toBe(0);
    expect(useGameStore.getState().speedLevel).toBe(0);
  });

  it("clicking the Locked card does nothing", () => {
    useGameStore.setState({ sellPriceLevel: 14, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={14} speedLevel={15} canvasTier={1} />);
    fireEvent.click(screen.getByTestId("tier-up-card"));
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().sellPriceLevel).toBe(14);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/components/painting/TierUpCard.test.tsx`
Expected: FAIL — `TierUpCard` doesn't exist.

- [ ] **Step 4: Implement `TierUpCard`**

Create `src/components/painting/TierUpCard.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import styles from "./TrackCard.module.css";

interface Props {
  sellPriceLevel: number;
  speedLevel: number;
  canvasTier: number;
}

const GATE_LEVEL = 15;

/**
 * Tier-up button card. Same visual footprint as a TrackCard, but exposes a
 * single "advance to next tier" action gated by `sellPriceLevel >= 15 &&
 * speedLevel >= 15`. Calls the `tierUp` slice action on click when ready.
 *
 * Two visible states: locked (gate not met) and ready (gate met). Both states
 * are visible — the locked state acts as a teaser so the player knows the
 * tier-up exists from T1.
 */
export function TierUpCard({ sellPriceLevel, speedLevel, canvasTier }: Props): JSX.Element {
  const ready = sellPriceLevel >= GATE_LEVEL && speedLevel >= GATE_LEVEL;
  const tierUp = useGameStore((s) => s.tierUp);

  const handleClick = (): void => {
    if (!ready) return;
    tierUp();
  };

  return (
    <button
      type="button"
      className={styles.card}
      data-testid="tier-up-card"
      data-state={ready ? "ready" : "locked"}
      onClick={handleClick}
      disabled={!ready}
    >
      <div className={styles.label}>Tier Up</div>
      {ready ? (
        <div className={styles.effectLine}>
          → Tier {canvasTier + 1} · ×10 base gold · ×2 paint time
        </div>
      ) : (
        <div className={styles.effectLine}>
          Reach sell_price L{GATE_LEVEL} + speed L{GATE_LEVEL}
        </div>
      )}
      <div className={styles.cost}>{ready ? "Free" : "—"}</div>
    </button>
  );
}
```

If the existing `TrackCard.module.css` does not have the exact classnames `.card`, `.label`, `.effectLine`, `.cost`, adapt to whatever the existing TrackCard uses.

- [ ] **Step 5: Add `TierUpCard` to the upgrades strip**

In `src/components/painting/CanvasUpgradesStrip.tsx` (or wherever the 5 TrackCards are rendered — check the file with the strip layout):

If the strip is a simple container that accepts children, add a `TierUpCard` as the 6th child in `PaintingRoute.tsx` after the 5 existing `TrackCard`s:

```tsx
<TierUpCard
  sellPriceLevel={sellPriceLevel}
  speedLevel={speedLevel}
  canvasTier={canvasTier}
/>
```

(Add the import at the top of `PaintingRoute.tsx`.)

- [ ] **Step 6: Run TierUpCard tests**

Run: `npx vitest run tests/components/painting/TierUpCard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run full UI tests**

Run: `npx vitest run tests/routes tests/components`
Expected: all pass.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/painting/TierUpCard.tsx src/routes/PaintingRoute.tsx tests/components/painting/TierUpCard.test.tsx
git commit -m "ui(canvas-tier): add TierUpCard with locked/ready states gated by sell_price+speed L15"
```

---

## Task 9: Add tier block to StatsRoom

**Files:**
- Modify: `src/components/painting/StatsRoom.tsx`

A read-only block at the top of the StatsRoom showing current tier, stage name, and the four active tier multipliers (×N base gold, ×N upgrade costs, ×N per-level effects, ×N base time).

- [ ] **Step 1: Add the tier block to the JSX**

In `src/components/painting/StatsRoom.tsx`, near the top of the returned section (above the existing per-stat blocks, after the header), add:

```tsx
{(() => {
  const tier = canvasTier;
  const factor = Math.pow(10, tier - 1);
  const timeFac = Math.pow(2, tier - 1);
  return (
    <article className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockName}>Canvas Tier</span>
        <span className={styles.blockTotal}>T{tier}</span>
      </header>
      <ul className={styles.lines}>
        <li className={styles.line}>
          <span className={styles.source}>Base gold</span>
          <span className={styles.value}>×{factor}</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>Base time</span>
          <span className={styles.value}>×{timeFac}</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>Per-level effects</span>
          <span className={styles.value}>×{factor}</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>Upgrade costs</span>
          <span className={styles.value}>×{factor}</span>
        </li>
      </ul>
    </article>
  );
})()}
```

The `canvasTier` selector was added in Task 5; reuse it.

If you prefer a non-IIFE, extract a `<TierBlock tier={canvasTier} />` function component above the main component.

- [ ] **Step 2: Verify in browser (manual smoke check)**

Run the dev server (`npm run dev` or the project's batch file). Navigate to the Painting route. Open the Stats Room. Confirm the Tier block renders with the correct multipliers at T1 (×1 across the board). Tier up once and confirm it shows T2 with ×10 base gold etc.

- [ ] **Step 3: Run UI tests**

Run: `npx vitest run tests/components/painting`
Expected: all pass. (Existing StatsRoom tests should not break — the block is purely additive.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/StatsRoom.tsx
git commit -m "ui(stats-room): add canvas tier block showing current multipliers"
```

---

## Task 10: Full verify + deploy

**Files:** (no source changes — verification only)

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Full Vitest suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 3: Production build (vite-only)**

Run: `npx vite build`
Expected: build succeeds. (Note: `npm run build` runs `tsc -b && vite build` which fails on pre-existing project-level tsc errors unrelated to this work. Vercel uses `vite build` directly per `vercel.json`.)

- [ ] **Step 4: Manual browser verification**

Start the dev server and verify in a browser:

- BottomBar still shows 3 currency chips.
- Painting route renders without errors. New canvas takes 10s base (with no speed upgrades).
- Buy sell_price and speed up to L15 each. The TierUp card transitions from locked to ready.
- Click TierUp. Confirm:
  - `canvasTier` becomes 2 (stage name becomes "Apprentice", title shows "Tier 2")
  - All 5 track levels reset to 0
  - In-canvas state resets (no canvas progress, no combo, no crit indicator)
  - Sell-price L1 cost is 1000g (was 100g at T1)
  - Sell-price L1 effect is +100% gold (was +10% at T1)
  - Base canvas time is 20s (was 10s at T1)
- Reload the page. Tier persists (canvasTier saved + restored via v22 migration).
- StatsRoom shows the tier block with the correct multipliers.

- [ ] **Step 5: Grep for residual `PAINT_TIME_BASE_SECONDS` references**

Use the Grep tool with pattern `PAINT_TIME_BASE_SECONDS`. Expected matches: docs only (specs, plans, HANDOVER). Any matches in `src/` or `tests/` are leftovers — fix them.

- [ ] **Step 6: Deploy to Vercel**

Run: `npx vercel --prod`
Expected: deploy succeeds with status READY.

- [ ] **Step 7: Verify production bundle is live**

```bash
curl -s https://artdle-web.vercel.app/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
# Take the hash, then:
curl -s https://artdle-web.vercel.app/assets/index-<HASH>.js | grep -oE 'tierFactor|canvasTier' | sort -u
```

Expected: `tierFactor` and `canvasTier` appear in the minified bundle (the minifier may rename them; if it does, check for a related string like `canvasGoldMultiplier` or `tierUp`).

- [ ] **Step 8: Final commit (if any unstaged changes from verification)**

Run: `git status`. If clean, the task is complete. If any verification step required a code change, commit it with a descriptive message.

---
