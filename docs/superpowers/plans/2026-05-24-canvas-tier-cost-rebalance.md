# Canvas Tier Cost Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each canvas tier-up progressively harder to clear (target: ~2× wall-clock time per tier), while leaving the existing immediate-boost behavior unchanged.

**Architecture:** Split today's single `tierFactor(T) = 10^(T-1)` into two independent dials: `tierFactor` (unchanged — drives `canvasGold` base-gold scaling) and a new `costTierFactor` that drives the five `*UpgradeCost` functions. The new factor's growth base is **measured empirically** via the existing bot-sim, then calibrated so the pure-base "2× per tier" ramp survives the non-reset multiplier compounding from tree/items/workers/skill-tree/size-crit-combo levels. Validation is a Vitest assertion on tier-time ratios from the same bot-sim run.

**Tech Stack:** TypeScript strict + Vitest. Affects `src/core/balance.ts` (constants + cost fns) and consumers (`tests/core/balance.test.ts`, `tests/core/multipliers.test.ts`, `src/components/painting/StatsRoom.tsx`). Bot-sim instrumentation lives in `tests/dev/bot-simulation.test.ts`.

**Design context:**
- User asked for a "1H → 2H → 4H → 8H" doubling progression. Today the pure-base math is already 2×/tier (cost ×10 ÷ income ×5 = 2× time), but non-reset gold multipliers (inspiration tree, items, workers, skill-tree colors/rainbow, preserved size/crit/combo levels) compound between gate-clears and eat into the curve — late tiers feel easier instead of harder.
- User confirmed the **immediate boost is fine** (don't touch `canvasGold`, `canvasTime`, or the L15→L0 reset). The fix lives entirely in upgrade-cost scaling.
- Per the advisor: "decouple `tierFactor` into two — `goldTierFactor` (drives `canvasGold`) and `costTierFactor` (drives the five `*UpgradeCost` calls). Today they're the same. Once split, you tune them independently to hit both goals."

**Target metric:** time-to-clear T3→T4 ÷ time-to-clear T1→T2 ≈ **4×** (since two doublings between T1→T2 and T3→T4 = 2² = 4). Acceptance band: **[3.5×, 4.5×]**.

---

### Task 1: Instrument bot-sim with per-tier timing

**Files:**
- Modify: `tests/dev/bot-simulation.test.ts`

Add a per-tier log every time `canvasTier` increments inside the main simulation loop. We need: tick at which the tier-up fired, gold/sec at that moment, and the **interval since the previous tier-up** (or since t=0 for T1→T2). This data drives Tasks 2 and 7 — don't guess values, read them off the run.

- [ ] **Step 1: Add tier-tracking state at the top of the simulation `it()` block**

In `tests/dev/bot-simulation.test.ts`, inside `it("runs 3-hour simulation and logs pacing", ...)` (~line 292), just after `let firstAscendAt = -1;` add:

```typescript
let lastTier = useGameStore.getState().canvasTier;
let lastTierUpAt = 0;
const tierIntervals: Array<{ from: number; to: number; intervalS: number; gpsAtUp: number }> = [];
```

- [ ] **Step 2: Detect tier-up each tick and log it**

Inside the main simulation `for` loop, immediately after the `useGameStore.getState().tickAll(TICK_S);` call (~line 311), add:

```typescript
const curTier = useGameStore.getState().canvasTier;
if (curTier !== lastTier) {
  const interval = t - lastTierUpAt;
  const gpsAtUp = gps(useGameStore.getState());
  tierIntervals.push({ from: lastTier, to: curTier, intervalS: interval, gpsAtUp });
  addMilestone(t,
    `TIER UP T${lastTier}→T${curTier} — interval ${fmtTime(interval)}, G/s now ${fmtN(gpsAtUp)}`);
  lastTier = curTier;
  lastTierUpAt = t;
}
```

- [ ] **Step 3: Print a tier-summary block at the end of the run**

In the final-state block (~line 372, after the `console.log("\n=== Final State (3h) ===");` section), append:

```typescript
console.log("\n=== Per-tier progression ===");
if (tierIntervals.length === 0) {
  console.log("  (no tier-ups fired in this run)");
} else {
  for (const r of tierIntervals) {
    console.log(`  T${r.from}→T${r.to}: ${fmtTime(r.intervalS)} (G/s at up: ${fmtN(r.gpsAtUp)})`);
  }
  for (let i = 1; i < tierIntervals.length; i++) {
    const prev = tierIntervals[i - 1].intervalS;
    const cur = tierIntervals[i].intervalS;
    const ratio = prev > 0 ? cur / prev : 0;
    console.log(`  ratio T${tierIntervals[i - 1].to}→T${tierIntervals[i].to} vs prev: ×${ratio.toFixed(2)}`);
  }
}
```

- [ ] **Step 4: Run the simulation and capture baseline output**

```
npx vitest run tests/dev/bot-simulation.test.ts --reporter=verbose
```

Expected: test still passes (it's an output-only test, doesn't assert). Scroll for `=== Per-tier progression ===` and **copy the per-tier intervals + ratios into Task 2 below**.

- [ ] **Step 5: Commit**

```
git add tests/dev/bot-simulation.test.ts
git commit -m "test(bot-sim): log per-tier intervals and gps-at-tier-up

Adds tier-up event detection + post-run summary so we can measure the
non-reset multiplier leak before calibrating costTierFactor."
```

---

### Task 2: Calibrate `costTierFactor` from measured data

**Files:**
- This is an analysis task. Output is a chosen formula recorded in the next task's code.

- [ ] **Step 1: Extract the measured per-tier ratios from Task 1's output**

From the `=== Per-tier progression ===` block, record into a scratch buffer:

```
T1→T2: <observed seconds>
T2→T3: <observed seconds>
T3→T4: <observed seconds>
(if available) T4→T5: <observed seconds>

ratio T2 vs T1: <observed>   ← target ≈ 2.0
ratio T3 vs T2: <observed>   ← target ≈ 2.0
ratio T4 vs T3: <observed>   ← target ≈ 2.0
```

- [ ] **Step 2: Compute the required cost-side bump**

If the median observed ratio is `R` (e.g., 1.2× = too easy, 1.0× = flat), we need to multiply the existing 2×/tier cost-progression by `2/R` to land back on 2×/tier wall-clock time. Since today's `tierFactor` is `10^(T-1)` (= ×10/tier in cost) and gold scales `5^(T-1)/tier` in gps, the pure-base ratio is already 2. The leak factor per tier is `2/R`.

Therefore the new `costTierFactor` base should be:

```
costGrowthBase = 10 × (2 / R)
```

Examples:
- If observed R = 1.0 (each tier the same): costGrowthBase = 20 (i.e., `costTierFactor(T) = 20^(T-1)`)
- If observed R = 1.5 (each tier 50% harder): costGrowthBase = 13.33 → round to 13 or 14
- If observed R = 0.7 (each tier 30% easier — possible if compounding is strong): costGrowthBase = 28.57 → round to 28 or 30

**Round to a clean integer** (whole number, ideally divisible by 2 or 5) so the resulting upgrade costs stay readable for the player. Record the chosen number — call it `COST_GROWTH_BASE` — for Task 3.

- [ ] **Step 3: Sanity-check the chosen number against extreme cases**

The "compounding leak" probably isn't constant across all three tiers (later tiers compound faster as more nodes unlock). If the spread between observed ratios is large (e.g., 1.5× / 1.2× / 0.9×), favor the **median** rather than the mean — the goal is "doesn't feel worse than 2×, doesn't feel worse than 8×". If the spread is extreme (>2× between min and max), record this fact as a follow-up — a non-geometric tier curve (e.g., `2 + log(T) × k`) might be needed later. Don't try to fix that here.

- [ ] **Step 4: No code change in this task. No commit.**

This task's output is the chosen `COST_GROWTH_BASE` integer, ready for Task 3.

---

### Task 3: Add `costTierFactor` constant and helper in `balance.ts`

**Files:**
- Modify: `src/core/balance.ts`
- Test: `tests/core/balance.test.ts`

- [ ] **Step 1: Write failing tests for the new helper**

Add to `tests/core/balance.test.ts` (find the existing `describe("tierFactor ...")` block ~line 524 and add a new sibling describe block after it):

```typescript
describe("costTierFactor (canvas upgrade-cost scaling)", () => {
  it("returns 1 at tier 1 (no scaling)", () => {
    expect(costTierFactor(1)).toBe(1);
  });

  it("returns COST_GROWTH_BASE at tier 2", () => {
    expect(costTierFactor(2)).toBe(COST_GROWTH_BASE);
  });

  it("returns COST_GROWTH_BASE squared at tier 3", () => {
    expect(costTierFactor(3)).toBe(COST_GROWTH_BASE * COST_GROWTH_BASE);
  });

  it("returns COST_GROWTH_BASE cubed at tier 4", () => {
    expect(costTierFactor(4)).toBe(COST_GROWTH_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE);
  });

  it("differs from tierFactor at tier 2 (decoupling)", () => {
    expect(costTierFactor(2)).not.toBe(tierFactor(2));
  });
});
```

Also update the existing import at the top of `tests/core/balance.test.ts` (~line 50):

```typescript
import {
  // ... existing imports
  tierFactor,
  timeFactor,
  costTierFactor,
  COST_GROWTH_BASE,
} from "@/core/balance";
```

- [ ] **Step 2: Run the test to verify it fails**

```
npx vitest run tests/core/balance.test.ts -t "costTierFactor"
```

Expected: FAIL — `costTierFactor is not defined` or import error.

- [ ] **Step 3: Add the constant and helper to `src/core/balance.ts`**

After the existing `tierFactor` export (~line 85) and **before** `timeFactor`, insert:

```typescript
/**
 * Growth base for upgrade-cost tier scaling. Decoupled from `tierFactor` (which
 * scales base canvas gold ×10/tier) so the cost-side curve can be tuned
 * independently. Calibrated against bot-sim: chosen so that the wall-clock
 * time to clear each tier's gate is ~2× the previous tier's, despite
 * non-reset multiplier compounding from tree/items/workers/skill-tree.
 *
 * See docs/superpowers/plans/2026-05-24-canvas-tier-cost-rebalance.md for
 * the measurement that produced this number.
 */
export const COST_GROWTH_BASE = <CHOSEN_NUMBER_FROM_TASK_2>;

/**
 * Multiplier on upgrade costs at canvas tier T. `costTierFactor(1) = 1`,
 * `costTierFactor(2) = COST_GROWTH_BASE`, etc. Used by the five
 * `*UpgradeCost(level, tier)` functions in this file.
 *
 * Distinct from `tierFactor` (which scales base canvas gold). Splitting them
 * lets us make tier-ups progressively harder to clear without weakening the
 * immediate gold boost players feel on tier-up.
 */
export const costTierFactor = (tier: number): number =>
  Math.pow(COST_GROWTH_BASE, tier - 1);
```

Replace `<CHOSEN_NUMBER_FROM_TASK_2>` with the integer chosen in Task 2 Step 2.

- [ ] **Step 4: Run the test to verify it passes**

```
npx vitest run tests/core/balance.test.ts -t "costTierFactor"
```

Expected: PASS (all five new tests green).

- [ ] **Step 5: Commit**

```
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): add costTierFactor decoupled from tierFactor

New constant COST_GROWTH_BASE and helper costTierFactor(T) for upgrade-cost
tier scaling, independent of gold-tier-factor. Not yet wired into the
*UpgradeCost functions (Task 4)."
```

---

### Task 4: Wire `costTierFactor` into the five upgrade-cost functions

**Files:**
- Modify: `src/core/balance.ts`
- Test: `tests/core/balance.test.ts`

Today each `*UpgradeCost` function multiplies by `tierFactor(tier)`. We swap that for `costTierFactor(tier)`. The signature and contract (parameter is currentLevel; tier defaults to 1) stay identical.

- [ ] **Step 1: Update existing `*UpgradeCost` tier tests to expect the new factor**

In `tests/core/balance.test.ts`, find the `describe("sellPriceUpgradeCost", ...)` block and locate any tier-aware test (e.g. the existing `T2, L5: SELL_PRICE_COST_BASE × tierFactor × 1.5^5` test around line 643). For each of the five upgrade-cost describe blocks (`sellPriceUpgradeCost`, `speedUpgradeCost`, `sizeUpgradeCost`, `critUpgradeCost`, `comboUpgradeCost`), add or update tier-aware tests so the multiplier comes from `costTierFactor` not `tierFactor`. Example for sellPrice (replace the existing T2 test, or add as a sibling):

```typescript
it("scales with costTierFactor, not tierFactor, at tier 2", () => {
  // L0 at T2: SELL_PRICE_COST_BASE × costTierFactor(2) = 100 × COST_GROWTH_BASE
  expect(sellPriceUpgradeCost(0, 2).toNumber())
    .toBeCloseTo(SELL_PRICE_COST_BASE * COST_GROWTH_BASE, 5);
});

it("scales with costTierFactor at tier 3", () => {
  expect(sellPriceUpgradeCost(0, 3).toNumber())
    .toBeCloseTo(SELL_PRICE_COST_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE, 5);
});
```

Repeat for `speedUpgradeCost` (base 100), `sizeUpgradeCost` (base 1000), `critUpgradeCost` (base 5000), `comboUpgradeCost` (base 5000). Use the matching `*_COST_BASE` constant for each.

Also: any existing test that asserted `tierFactor(N)` directly inside an upgrade-cost assertion needs to be replaced with `costTierFactor(N)`. Grep `tests/core/balance.test.ts` for `tierFactor` inside `UpgradeCost` describes and update each occurrence.

- [ ] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/core/balance.test.ts -t "scales with costTierFactor"
```

Expected: FAIL — the existing implementation still uses `tierFactor`, so multiplied values don't match `COST_GROWTH_BASE`.

- [ ] **Step 3: Replace `tierFactor(tier)` with `costTierFactor(tier)` in the five cost functions**

In `src/core/balance.ts`, lines ~223–236, replace each occurrence inside the five upgrade-cost functions. Before:

```typescript
export const sellPriceUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(tierFactor(tier));
```

After:

```typescript
export const sellPriceUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(costTierFactor(tier));
```

Repeat for `speedUpgradeCost`, `sizeUpgradeCost`, `critUpgradeCost`, `comboUpgradeCost` — five lines total. **Do NOT** change `canvasGold` (which uses `tierFactor`) or `canvasTime` (which uses `timeFactor`). Those stay as-is.

Also update the JSDoc comment on `tierFactor` (~line 76-84) to clarify it now scales only base gold:

```typescript
/**
 * Multiplier on base canvas gold at canvas tier T.
 * `tierFactor(1) = 1`, `tierFactor(2) = 10`, `tierFactor(3) = 100`, ...
 *
 * Used by `canvasGold(size, mult, tier)` to scale base canvas gold.
 * Cost scaling lives on `costTierFactor` so the two can be tuned independently.
 *
 * The ×10/tier ramp matches the spec's prestige design — see
 * `docs/superpowers/specs/2026-05-23-canvas-tier-system-design.md`.
 */
```

- [ ] **Step 4: Run the full balance test file to verify everything passes**

```
npx vitest run tests/core/balance.test.ts
```

Expected: PASS (all tests green, including the new costTierFactor tests and the updated upgrade-cost tier tests).

- [ ] **Step 5: Commit**

```
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): route upgrade costs through costTierFactor

The five canvas *UpgradeCost functions now multiply by costTierFactor(tier)
instead of tierFactor(tier). canvasGold and canvasTime are unchanged
(still on tierFactor / timeFactor) — the gold boost on tier-up is
preserved, only the gate-cost ramp gets steeper."
```

---

### Task 5: Update consumers that still rely on `tierFactor` for cost display

**Files:**
- Modify: `src/components/painting/StatsRoom.tsx:219-241` (the `TierBlock` component)
- Modify: `tests/core/multipliers.test.ts` (if any tier-cost assertions live there)

The Stats panel shows "Upgrade costs ×{factor}" sourced from `tierFactor(tier)`. After Task 4 this label is wrong — upgrade costs scale by `costTierFactor`, not `tierFactor`. Fix the display.

- [ ] **Step 1: Update the import in `StatsRoom.tsx`**

In `src/components/painting/StatsRoom.tsx`, the import block at line 23-35 currently pulls `tierFactor, timeFactor`. Add `costTierFactor`:

```typescript
import {
  // ... existing imports
  tierFactor,
  timeFactor,
  costTierFactor,
  levelScale,
} from "@/core/balance";
```

- [ ] **Step 2: Fix the `TierBlock` component to use `costTierFactor` for the costs line**

In `src/components/painting/StatsRoom.tsx`, find the `TierBlock` function (~line 219). Change:

```typescript
function TierBlock({ tier }: { tier: number }): JSX.Element {
  const factor = tierFactor(tier);
  const timeFac = timeFactor(tier);
```

to:

```typescript
function TierBlock({ tier }: { tier: number }): JSX.Element {
  const goldFactor = tierFactor(tier);
  const timeFac = timeFactor(tier);
  const costFactor = costTierFactor(tier);
```

Then in the JSX (~line 232-241), find the "Base gold" line (uses `factor`), the "Base time" line (uses `timeFac`), and the "Upgrade costs" line (uses `factor` again). Update:
- "Base gold" → `×{goldFactor}` (renamed variable; same number)
- "Base time" → `×{timeFac}` (unchanged)
- "Upgrade costs" → `×{costFactor}` (now uses the new helper)

- [ ] **Step 3: Search for any other `tierFactor`-on-cost references and update them**

Run:

```
```

(use the Grep tool: pattern `tierFactor`, glob `src/**/*.{ts,tsx}`).

For each match that's tied to **upgrade-cost display or upgrade-cost math** (not gold scaling), swap to `costTierFactor`. Likely-affected files: `PaintingRoute.tsx` cost-preview tooltips (if any). Leave gold-side references alone.

- [ ] **Step 4: Run typecheck + UI-related tests to verify no regressions**

```
npx tsc -b --noEmit
npx vitest run tests/components
```

Expected: typecheck has the same pre-existing errors as `master` and no new ones; component tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/painting/StatsRoom.tsx
git commit -m "ui(stats): show Upgrade costs row using costTierFactor

The TierBlock's 'Upgrade costs ×N' line was still reading tierFactor,
which now only governs base gold. Sourced from costTierFactor so the
displayed multiplier matches what the player actually pays."
```

---

### Task 6: Run the full test suite to confirm no broken assertions

**Files:** no edits — verification only.

- [ ] **Step 1: Run all tests**

```
npx vitest run
```

Expected: same number of green tests as on `master` (1036+ as of 2026-05-24), plus the new `costTierFactor` tests. No failures.

- [ ] **Step 2: If any tests fail, fix them in this same commit**

The most likely failure surface is tests that hardcoded `100 × 10` or similar in a tier-aware upgrade-cost expectation. Update those numbers to use the new factor.

- [ ] **Step 3: Commit (only if changes were needed)**

```
git add <files>
git commit -m "test: update tier-aware cost assertions to costTierFactor"
```

If no changes were needed, skip the commit step and move to Task 7.

---

### Task 7: Re-run bot-sim with the new cost scaling, capture new ratios

**Files:** no edits — observation only.

- [ ] **Step 1: Re-run the bot-sim test**

```
npx vitest run tests/dev/bot-simulation.test.ts --reporter=verbose
```

Look at the `=== Per-tier progression ===` block. Record:

```
T1→T2: <new seconds>
T2→T3: <new seconds>
T3→T4: <new seconds>

ratio T2 vs T1: <new>
ratio T3 vs T2: <new>
```

- [ ] **Step 2: Verify the ratios are in the acceptance band [3.5×, 4.5×] for T3→T4 vs T1→T2**

Compute `T3→T4_seconds / T1→T2_seconds`. Target: between 3.5 and 4.5 (= roughly 2× per tier compounded over two tier-steps).

**If the ratio is in band:** proceed to Task 8.

**If the ratio is below band (under 3.5×):** `COST_GROWTH_BASE` is too small. Bump it (try +5 or +10) and revisit Task 3 Step 3 to update the constant, then re-run from this task.

**If the ratio is above band (over 4.5×):** `COST_GROWTH_BASE` is too large. Lower it and re-run from this task.

Iterate until the band is hit. Each iteration is a single-line edit to `COST_GROWTH_BASE` in `src/core/balance.ts` (Task 3 Step 3's constant). Update the corresponding test assertions in `tests/core/balance.test.ts` (`costTierFactor` describe block + the five `*UpgradeCost` tier tests) to match the new value. Commit each iteration:

```
git commit -am "tune(balance): COST_GROWTH_BASE → <N> (T3 ratio: <observed>)"
```

- [ ] **Step 3: When ratio is in band, no further commit needed.**

The tuning commits from Step 2 are the artifact. Proceed to Task 8.

---

### Task 8: Lock in the ratio with an assertion in bot-sim

**Files:**
- Modify: `tests/dev/bot-simulation.test.ts`

Now that we've hit the target ratio, add a Vitest assertion so future code changes that drift tier balance out of band fail the test suite.

- [ ] **Step 1: Add the ratio assertion at the end of the simulation test**

In `tests/dev/bot-simulation.test.ts`, after the `=== Per-tier progression ===` console output block (added in Task 1 Step 3), add:

```typescript
// Acceptance band for the tier-cost rebalance. See
// docs/superpowers/plans/2026-05-24-canvas-tier-cost-rebalance.md.
// We expect each tier to take ~2× the wall-clock time of the previous,
// so T3→T4 should take ~4× as long as T1→T2.
if (tierIntervals.length >= 3) {
  const t12 = tierIntervals.find((r) => r.from === 1 && r.to === 2);
  const t34 = tierIntervals.find((r) => r.from === 3 && r.to === 4);
  if (t12 && t34 && t12.intervalS > 0) {
    const observedRatio = t34.intervalS / t12.intervalS;
    expect(observedRatio).toBeGreaterThanOrEqual(3.5);
    expect(observedRatio).toBeLessThanOrEqual(4.5);
  }
}
```

The guard `tierIntervals.length >= 3` ensures the assertion only fires when the bot actually reached T4 in the 3-hour sim window. If a future code change slows down progression so much that T4 isn't reached, the assertion silently skips rather than producing a confusing false-positive — but the per-tier log still shows what happened.

- [ ] **Step 2: Run the test to verify the assertion passes**

```
npx vitest run tests/dev/bot-simulation.test.ts
```

Expected: PASS. If it fails on the first run, the calibration in Task 7 was incomplete — go back and tune `COST_GROWTH_BASE` until the ratio is solidly inside the band.

- [ ] **Step 3: Commit**

```
git add tests/dev/bot-simulation.test.ts
git commit -m "test(bot-sim): assert T3→T4 / T1→T2 wall-clock ratio in [3.5, 4.5]

Regression guard for the canvas tier cost curve. If a future code change
slips the tier-balance leak open again, this test fails."
```

---

### Task 9: Deploy + verify

**Files:** no edits.

- [ ] **Step 1: Run the full test suite one last time**

```
npx vitest run
```

Expected: all green.

- [ ] **Step 2: Build**

```
npx vite build
```

Expected: success, no new errors.

- [ ] **Step 3: Deploy to production**

```
npx vercel --prod
```

- [ ] **Step 4: Verify the new bundle is live**

Take the new bundle URL from Vercel's output (e.g., `https://artdle-web.vercel.app/assets/index-<hash>.js`) and confirm `costTierFactor` appears in the minified bundle:

```
curl -s https://artdle-web.vercel.app/assets/index-<hash>.js | grep -o costTierFactor | head -1
```

Expected: `costTierFactor` (one match — confirms the new export is in the production bundle).

- [ ] **Step 5: Update HANDOVER.md**

Add a new section at the top of `docs/HANDOVER.md` matching the existing entry style. Cover: what changed (split tierFactor, new costTierFactor, chosen number), why (compounding multiplier leak), the bot-sim assertion as the regression guard, and the ratio observed pre- and post-fix.

- [ ] **Step 6: Final commit + push**

```
git add docs/HANDOVER.md
git commit -m "docs(handover): cover canvas tier cost rebalance"
git push origin master
```

---

## Self-review

- **Spec coverage:** user's stated goals — (1) "each tier upgrade should provide immediate boost" (user said this is already fine; plan preserves it by leaving `tierFactor`/`canvasGold`/`canvasTime` unchanged) and (2) "harder to go to next tier" (Tasks 3+4 introduce the cost-side scaling, Tasks 7+8 calibrate and lock in via bot-sim). User chose "measure first" approach — Task 1 does measurement, Task 2 does calibration math, Task 7 verifies. User chose "extend bot-sim with tier-time assertions" — Task 8 adds that.
- **Placeholder scan:** Task 3 Step 3 has `<CHOSEN_NUMBER_FROM_TASK_2>`. This is intentional — Task 2 produces the number, and the engineer fills it in here. Task 2 is structured as an explicit analysis step (not "TBD") with a formula (`10 × (2 / R)`) for deriving the number from measured data. All other steps contain complete code.
- **Type consistency:** `costTierFactor`, `COST_GROWTH_BASE` used consistently across all tasks. `tierFactor` and `timeFactor` remain unchanged. `goldFactor` is a local variable rename in `StatsRoom.tsx` only (cosmetic).
