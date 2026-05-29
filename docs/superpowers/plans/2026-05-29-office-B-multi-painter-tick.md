# Office Redesign — Phase B: Multi-Painter Canvas Tick

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the single-painter canvas tick into a **discrete-event multi-painter scheduler** so the player and every worker paint the shared canvas at their own cadence. Wire `workerGoldFactor` into sale gold, per-worker crit / strokes-per-crit / combo, and per-worker `strokesThisRun` accumulation — **without changing observable solo-play behavior** (the office isn't in production until C/D merge, so the regression bar is "a player with no workers sees identical gold/sales/crits").

**Architecture:** Timing is decoupled from fill. `canvasProgress` becomes the shared **completed-chunk count** (integer-valued; rendering already floors it). A transient `painterClocks` map carries each painter's seconds-toward-next-stroke across ticks (mandatory — without cross-frame carry, idle play can't accumulate strokes). The tick repeatedly advances time to the soonest-stroking painter, applies that painter's stroke (advance shared progress; roll *that painter's* crit → spill *its* strokes-per-crit bonus chunks; on fill → sale using `canvasGold × workerGoldFactor × comboBonusFactor(chain)`, then roll the shared chain with the *completing painter's* combo base). The player remains a painter with its existing aggregate stats; workers are additional painters.

**Tech Stack:** TypeScript (strict), `@/core/rng` (seedable: `setSeed`, `rng`), `break_eternity.js` (`Big`), Zustand 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md` §2.2 (discrete-event scheduling), §2.1 (worker stats).

**Builds on:** Phase A2 (`60e2f55`). `Worker = {id, classId, level, xp:Big, stats:WorkerStats, mastery, strokesThisRun}` exists in the roster and contributes nothing yet. `WorkerStats = {goldPct, speed, critChance, strokesPerCrit, comboChance}` (`@/core/workerModel`).

---

## Green bar (every task)
- `npx vitest run` fully green.
- `npx vite build` clean.
- NOT `tsc` (pre-existing baseline errors per HANDOVER; don't chase them, don't add dangling imports).

## Two decisions the advisor flagged as silent-wrong defaults — these are LOCKED, do not let an implementer drift:

1. **Player-only crit/combo streak stats (LOCKED for Phase B).** `currentCritStreak`, `maxCritStreak`, `critsLanded` (run + lifetime), and `maxComboChain` (run + lifetime) update **only for the player's strokes/sales**. A worker's non-crit stroke must NOT reset the player's crit streak; a worker crit must NOT increment `critsLanded`; a worker-completed sale must NOT advance `maxComboChain`. (Whether worker crits should eventually feed achievements is a **C/D decision**, explicitly deferred.) The canvas-level counters `canvasesSold` and `goldEarned` are NOT player-gated — a sale is a sale and gold is gold, regardless of who lands the final chunk.

2. **Equivalence gate (LOCKED).** A seeded characterization test captures the CURRENT solo tick's gold/sales/crits and freezes those numbers; the rewrite must reproduce them exactly. This is achievable because, with one painter, the scheduler crosses the same chunks in the same order with the same per-chunk crit roll + per-sale combo roll → identical RNG call sequence. If the rewrite cannot hit the frozen numbers after reasonable effort, **fall back to a `roster.length === 0` fast-path that delegates to the preserved single-painter loop** (see Task 4, Step "Equivalence fallback"). Do not silently accept different numbers.

## Scope guard — NOT in Phase B (later phases):
- Phase C: ascend-XP pool, level-up pass, skill-node migration/refund, deleting now-dead balance/multiplier helpers. (B only *accumulates* `strokesThisRun`; C consumes it.)
- Phase D: post-ascend roll screen, on-canvas worker avatars + next-stroke indicators (the indicators will read `painterClocks` — B leaves it populated and readable). **Caveat for D:** `painterClocks` is a fresh object every tick, so any component subscribing to it re-renders per frame by construction — Phase D should isolate the avatar/indicator subtree the way `BoundCanvasStage` isolates `canvasProgress`, not subscribe from a high-up component.
- B does NOT change `multipliers.CanvasMultiplierInputs` to re-add `roster` (A2's structural guarantee stays). `workerGoldFactor` is a SEPARATE selector used only by the tick.

## Conscious decision to record (not a task): click-to-paint
`BoundCanvasStage` wires `onChunkClick={() => canvasTick(chunkInterval_player)}`. Post-B, that adds `chunkInterval_player` seconds to **every** painter's budget — a click advances workers too. This is intentional and acceptable ("time passes for everyone"); no change needed.

---

## File structure
- `src/core/multipliers.ts` — ADD `getWorkerGoldFactor(state)`.
- `src/store/canvasSlice.ts` — ADD `painterClocks` to `CanvasState` + `initialCanvasState`; in `canvasTick`'s `set()` return ADD `painterClocks` and `roster`.
- `src/store/index.ts` — strip `painterClocks` in `partialize` (transient).
- `src/systems/catchupClone.ts` — clone `painterClocks` (`{ ...state.painterClocks }`).
- `src/core/canvasTickPure.ts` — REWRITE to the discrete-event scheduler.
- Tests: `tests/core/multipliers.test.ts`, `tests/store/canvasSlice.test.ts` (or wherever canvas state shape is tested — verify), `tests/systems/catchupClone.test.ts`, `tests/core/canvasTickPure.test.ts` (adapt + extend), plus a NEW `tests/core/canvasTickPure.multipainter.test.ts`.

---

## Task 1: `getWorkerGoldFactor` selector

**Files:**
- Modify: `src/core/multipliers.ts`
- Test: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/core/multipliers.test.ts`:

```ts
import { getWorkerGoldFactor } from "@/core/multipliers";
import { createWorker } from "@/store/officeSlice";
import type { GameStore } from "@/store";

describe("getWorkerGoldFactor", () => {
  it("is 1.0 with an empty roster (solo player unaffected)", () => {
    expect(getWorkerGoldFactor({ roster: [] } as GameStore)).toBe(1);
  });

  it("multiplies (1 + goldPct) across the roster", () => {
    const a = { ...createWorker(), stats: { ...createWorker().stats, goldPct: 0.10 } };
    const b = { ...createWorker(), stats: { ...createWorker().stats, goldPct: 0.25 } };
    // (1.10) * (1.25) = 1.375
    expect(getWorkerGoldFactor({ roster: [a, b] } as GameStore)).toBeCloseTo(1.375, 9);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: FAIL (`getWorkerGoldFactor` not exported).

- [ ] **Step 3: Implement**

Add to `src/core/multipliers.ts` (near the other selectors; it takes `roster` DIRECTLY — do NOT add `roster` to `CanvasMultiplierInputs`):

```ts
/**
 * Multiplicative gold factor contributed by the worker roster:
 * `∏ (1 + worker.stats.goldPct)`. 1.0 for an empty roster (solo play
 * unaffected). Used ONLY by the canvas tick on sale — kept out of
 * CanvasMultiplierInputs so the other canvas multipliers stay worker-free
 * (the A2 structural guarantee). Tunable: multiplicative per spec §2.2.
 */
export const getWorkerGoldFactor = (state: Pick<GameStore, "roster">): number => {
  let factor = 1;
  for (const w of state.roster) factor *= 1 + w.stats.goldPct;
  return factor;
};
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(office): getWorkerGoldFactor selector" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `painterClocks` transient state plumbing

`painterClocks` carries each painter's seconds-toward-next-stroke across ticks. It is RUN-state, transient (NOT persisted — stripped in `partialize`, like `lastSale`), reset on canvas/ascend reset (it's in `initialCanvasState`), and deep-cloned for catch-up. No save-version bump is needed: the field is never persisted, and the `canvasProgress` semantics change (float→integer-valued) is handled defensively in the tick (Task 4 floors it on read), so old saves degrade by at most <1 chunk of the in-flight canvas on first load — negligible.

**Files:**
- Modify: `src/store/canvasSlice.ts`, `src/store/index.ts`, `src/systems/catchupClone.ts`
- Test: `tests/systems/catchupClone.test.ts`; and the persistence/partialize test (verify where `partialize` transient-stripping is asserted — likely `tests/store/persistence.test.ts` or `persistence-integration.test.ts`; if there is no such assertion, add a focused one in `tests/store/canvasSlice.test.ts`).

- [ ] **Step 1: Write the failing tests**

In `tests/systems/catchupClone.test.ts`, add a case asserting the clone deep-copies `painterClocks`:

```ts
it("deep-copies painterClocks (mutating the clone doesn't touch the source)", () => {
  const src = makeBaselineState({ painterClocks: { player: 2.5, w1: 1.0 } });
  const clone = cloneGameState(src);
  clone.painterClocks.player = 999;
  expect(src.painterClocks.player).toBe(2.5);
});
```
> Adapt `makeBaselineState` to whatever fixture helper that test file uses (read it first). If the helper builds from `useGameStore.getState()`, instead set `painterClocks` via `useGameStore.setState({ painterClocks: { player: 2.5 } })` before cloning. The contract: the clone's `painterClocks` is a distinct object.

For the partialize-strip assertion, add to the appropriate persistence test (a transient field must not appear in the serialized blob):

```ts
it("partialize strips painterClocks (transient run-timing, never persisted)", () => {
  useGameStore.setState({ painterClocks: { player: 3.3 } });
  const persisted = useGameStore.persist.getOptions().partialize!(useGameStore.getState());
  expect((persisted as Record<string, unknown>).painterClocks).toBeUndefined();
});
```
> If `persist.getOptions().partialize` access differs in this codebase's zustand version, follow the pattern already used by the existing `lastSale`-strip test (search tests for `lastSale` + `partialize`); mirror it for `painterClocks`.

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/systems/catchupClone.test.ts`
Expected: FAIL (`painterClocks` undefined on state / not cloned).

- [ ] **Step 3: Add the field to canvas state**

In `src/store/canvasSlice.ts`:

In `CanvasState`, add (after `critChunks`):
```ts
  /**
   * Per-painter stroke clock: seconds accumulated toward each painter's next
   * stroke, keyed by painter id ("player" + worker ids). Carries each
   * painter's cadence across ticks. RUN-state, TRANSIENT (stripped from
   * `partialize` — rebuilt empty on load, which costs at most <1 chunk of the
   * in-flight canvas). Reset on canvas/ascend reset via initialCanvasState.
   */
  painterClocks: Record<string, number>;
```

In `initialCanvasState`, add `painterClocks: {},` (place it before `lastSale: null`).

> Note: `resetCanvas` already does `set(initialCanvasState)`, so `painterClocks` resets to `{}` on ascend automatically. `tierUp` does NOT reset it (painter rhythm is independent of the canvas) — leave `tierUp` untouched.

- [ ] **Step 4: Strip it in partialize**

In `src/store/index.ts` `partialize`, add `painterClocks: _pc,` to the destructure that removes transient fields (alongside `lastSale: _ls`):
```ts
        const {
          hoverTitle: _t,
          hoverBody: _b,
          hoverFooter: _f,
          lastSale: _ls,
          painterClocks: _pc,
          devFreeNodes: _dfn,
          activeNotification: _an,
          notificationQueue: _nq,
          ...rest
        } = s;
```

- [ ] **Step 5: Clone it for catch-up**

In `src/systems/catchupClone.ts`, add to the returned object (alongside the other record spreads, e.g. after `protectedTiers`):
```ts
    painterClocks: { ...state.painterClocks },
```

- [ ] **Step 6: Run, verify PASS**

Run: `npx vitest run tests/systems/catchupClone.test.ts` and the persistence test you edited.
Expected: PASS.

- [ ] **Step 7: Run the full suite + build**

Run: `npx vitest run` then `npx vite build`.
Expected: green + clean. (Adding the field is additive; nothing reads it yet.)

- [ ] **Step 8: Commit**

```bash
git add -u
git commit -m "store(office): add transient painterClocks run-state field" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Equivalence + step-invariance golden tests (lock CURRENT solo behavior)

This task writes the regression net BEFORE the rewrite, against the CURRENT single-painter `canvasTickPure`. The rewrite (Task 4) must keep both green. **Do not modify `canvasTickPure.ts` in this task.**

**Files:**
- Test: NEW `tests/core/canvasTickPure.equivalence.test.ts`

- [ ] **Step 1: Write the characterization + step-invariance tests**

Create `tests/core/canvasTickPure.equivalence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import type { DraftState } from "@/core/pureMutations";

// A solo draft with crit + combo levels high enough to actually exercise the
// crit/combo RNG paths (so the golden numbers are meaningful, not all-zero).
function soloDraft(): DraftState {
  return {
    canvasProgress: 0,
    canvasTier: 2,
    sellPriceLevel: 5, speedLevel: 3, critLevel: 30, comboLevel: 8,
    comboChain: 0,
    critChunks: {},
    painterClocks: {},
    lastSale: null,
    gold: big(0),
    lifetimeGold: big(0),
    equipped: {} as DraftState["equipped"],
    purchasedNodes: {} as DraftState["purchasedNodes"],
    roster: [] as DraftState["roster"],
    completedResearches: {} as DraftState["completedResearches"],
    completedAchievements: {} as DraftState["completedAchievements"],
    workshopLevel: 1,
    statsRun: {
      canvasesSold: 0, critsLanded: 0, goldEarned: big(0),
      currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0,
    } as DraftState["statsRun"],
    statsLifetime: {
      canvasesSold: 0, critsLanded: 0, maxComboChain: 0,
    } as DraftState["statsLifetime"],
  } as DraftState;
}

function runSolo(totalSeconds: number, step: number, seed = 0xC0FFEE) {
  setSeed(seed);
  const d = soloDraft();
  let t = 0;
  while (t < totalSeconds) {
    const s = Math.min(step, totalSeconds - t);
    canvasTickPure(d, s);
    t += s;
  }
  return {
    gold: d.gold.toNumber(),
    sales: d.statsRun.canvasesSold,
    crits: d.statsRun.critsLanded,
    maxCombo: d.statsRun.maxComboChain,
  };
}

describe("canvasTickPure — solo characterization (frozen golden master)", () => {
  // EQUIVALENCE GATE: these numbers are captured from the CURRENT single-painter
  // tick (Phase A2 HEAD). The Phase B rewrite MUST reproduce them exactly for an
  // empty roster. If the rewrite changes them, either fix the RNG-call order to
  // match, or add the roster.length===0 fast-path (plan Task 4).
  it("reproduces the frozen solo result over 600s at 0.1s steps", () => {
    const r = runSolo(600, 0.1);
    expect(r).toEqual(FROZEN_SOLO_600_AT_0_1);
  });
});

describe("canvasTickPure — step-size invariance (catch-up trustworthiness)", () => {
  // Below the per-tick sales cap, the same total sim time must yield the same
  // result regardless of step size — otherwise catch-up (10s/60s steps) diverges
  // from live play (~16ms steps). The MAX_SALES_PER_TICK cap is the one known
  // exception and is intentionally not exercised here (600s stays under it).
  it("0.1s, 1s, 5s, and 60s steps over 600s all agree", () => {
    const a = runSolo(600, 0.1);
    const b = runSolo(600, 1);
    const c = runSolo(600, 5);
    const e = runSolo(600, 60);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(e).toEqual(a);
  });
});

// Placeholder — replaced in Step 2 with the captured values.
const FROZEN_SOLO_600_AT_0_1 = { gold: 0, sales: 0, crits: 0, maxCombo: 0 };
```

- [ ] **Step 2: Capture the golden values on CURRENT code**

Run: `npx vitest run tests/core/canvasTickPure.equivalence.test.ts`
The step-invariance test should PASS on current code (if it does NOT, stop and report — the current tick already has a step-size bug, which changes the plan). The characterization test will FAIL with the actual result shown in the diff. **Copy the actual `{ gold, sales, crits, maxCombo }` from the failure output into `FROZEN_SOLO_600_AT_0_1`.** Re-run; both must now PASS.

> Sanity-check the captured numbers are non-trivial: `sales` should be a few dozen, `crits` > 0, `maxCombo` > 0. If `crits`/`maxCombo` are 0, the chosen levels didn't exercise those paths — bump `critLevel`/`comboLevel` in `soloDraft()`, recapture, and note it.

- [ ] **Step 3: Commit**

```bash
git add tests/core/canvasTickPure.equivalence.test.ts
git commit -m "test(office): freeze solo canvas-tick characterization + step-invariance" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Rewrite `canvasTickPure` to the discrete-event multi-painter scheduler

The core of Phase B. Implement the scheduler, wire `canvasSlice.canvasTick` to persist `painterClocks` + `roster`, adapt the existing unit tests, and add multi-painter behavior tests. **Task 3's equivalence + step-invariance tests must stay green** (the gate).

**Files:**
- Rewrite: `src/core/canvasTickPure.ts`
- Modify: `src/store/canvasSlice.ts` (canvasTick `set()` return)
- Test: adapt `tests/core/canvasTickPure.test.ts`; NEW `tests/core/canvasTickPure.multipainter.test.ts`

- [ ] **Step 1: Adapt the existing unit tests for the integer-progress model**

In `tests/core/canvasTickPure.test.ts`:
- Add `painterClocks: {},` to the `makeDraft` helper's returned object (the scheduler reads it; without it `draft.painterClocks` is undefined).
- The three tests asserting a FRACTIONAL `canvasProgress` now assert integer completed-chunks + the player clock instead:
  - `"partial chunk progress is preserved as fractional canvasProgress"` → rename to `"partial chunk progress is carried in the player clock"`; after `canvasTickPure(draft, BASE_CHUNK_INTERVAL / 2)` assert `draft.canvasProgress === 0` and `draft.painterClocks.player` ≈ `BASE_CHUNK_INTERVAL / 2` (2.5).
  - `"advances canvasProgress by delta / chunkInterval"` → after `canvasTickPure(draft, BASE_CHUNK_INTERVAL)` assert `draft.canvasProgress === 1` (one whole chunk) and `draft.painterClocks.player` ≈ 0.
  - `"does NOT credit gold mid-canvas"` → it asserts `canvasProgress` ≈ 5 after 5 chunks; that's already integer-valued, keep as `=== 5`.
  - The crit test `"crit advances canvas faster"` asserts `canvasProgress` ≈ 2 — already integer, keep (`=== 2`).
- All gold/sales/critChunks assertions are unchanged (observable outcomes are preserved).

- [ ] **Step 2: Run the adapted tests, expect FAIL**

Run: `npx vitest run tests/core/canvasTickPure.test.ts`
Expected: FAIL (current code still writes fractional `canvasProgress`, no `painterClocks`).

- [ ] **Step 3: Write the new multi-painter behavior tests**

Create `tests/core/canvasTickPure.multipainter.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { BASE_CHUNK_INTERVAL, CANVAS_GOLD_BASE } from "@/core/balance";
import { big } from "@/core/bigNumber";
import { createWorker } from "@/store/officeSlice";
import * as rngModule from "@/core/rng";
import type { DraftState } from "@/core/pureMutations";

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    canvasProgress: 0, canvasTier: 1,
    sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 0,
    comboChain: 0, critChunks: {}, painterClocks: {}, lastSale: null,
    gold: big(0), lifetimeGold: big(0),
    equipped: {} as DraftState["equipped"],
    purchasedNodes: {} as DraftState["purchasedNodes"],
    roster: [] as DraftState["roster"],
    completedResearches: {} as DraftState["completedResearches"],
    completedAchievements: {} as DraftState["completedAchievements"],
    workshopLevel: 1,
    statsRun: { canvasesSold: 0, critsLanded: 0, goldEarned: big(0), currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0 } as DraftState["statsRun"],
    statsLifetime: { canvasesSold: 0, critsLanded: 0, maxComboChain: 0 } as DraftState["statsLifetime"],
    ...overrides,
  } as DraftState;
}

// A worker with explicit stats (overriding the level-1 base).
function worker(stats: Partial<DraftState["roster"][number]["stats"]>) {
  const w = createWorker();
  return { ...w, stats: { ...w.stats, ...stats } };
}

describe("canvasTickPure — multi-painter", () => {
  beforeEach(() => vi.spyOn(rngModule, "rng").mockReturnValue(0.999)); // no crit, no combo
  afterEach(() => vi.restoreAllMocks());

  it("a worker at base speed adds strokes alongside the player (canvas fills faster)", () => {
    const solo = makeDraft();
    canvasTickPure(solo, BASE_CHUNK_INTERVAL); // player paints 1 chunk
    expect(solo.canvasProgress).toBe(1);

    const duo = makeDraft({ roster: [worker({ speed: 1 })] });
    canvasTickPure(duo, BASE_CHUNK_INTERVAL); // player + 1 worker, both base speed
    expect(duo.canvasProgress).toBe(2); // two painters → two chunks
  });

  it("increments strokesThisRun per worker (not the player)", () => {
    const d = makeDraft({ roster: [worker({ speed: 1 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 3); // worker strokes ~3 times
    expect(d.roster[0]!.strokesThisRun).toBeGreaterThanOrEqual(2);
  });

  it("applies workerGoldFactor to sale gold (∏(1+goldPct))", () => {
    // One worker with +50% gold. T1 base canvas gold = CANVAS_GOLD_BASE (10).
    // Fill exactly one canvas; with two base-speed painters and no crit, the
    // 10-chunk T1 canvas completes within 5 player-intervals.
    const d = makeDraft({ roster: [worker({ speed: 1, goldPct: 0.5 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 5); // ~10 chunks across 2 painters
    expect(d.statsRun.canvasesSold).toBe(1);
    expect(d.gold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE * 1.5, 5); // 15
  });

  it("worker strokes do NOT perturb player crit-streak stats (Phase B: player-only)", () => {
    // Player always crits, worker never crits. The worker's non-crit strokes
    // must not reset the player's streak nor add to critsLanded.
    let call = 0;
    // Deterministic: player strokes first by tie-break, so the crit roll order
    // alternates as painters interleave. Simplest robust check: a roster of one
    // very SLOW worker that strokes rarely, player crits every stroke.
    vi.restoreAllMocks();
    vi.spyOn(rngModule, "rng").mockImplementation(() => { call++; return 0.0001; }); // everyone crits
    const d = makeDraft({ critLevel: 0, roster: [worker({ speed: 1, critChance: 0.5, strokesPerCrit: 1 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 2);
    // critsLanded counts ONLY player crit chunks. Player base crit chunks = 1 trigger + 1 bonus = 2 per crit.
    // (Exact count depends on interleave; assert it equals player-only crits, never the worker's.)
    // Player strokes in 2 intervals ≈ 2 crits → critsLanded around 4, and crucially > 0 and not inflated by the worker.
    expect(d.statsRun.critsLanded).toBeGreaterThan(0);
    // The worker also crit (it filled bonus chunks), but those are excluded:
    // critsLanded must be a multiple of the player's per-crit chunk count (2), with no worker contribution.
    expect(d.statsRun.critsLanded % 2).toBe(0);
  });

  it("the completing painter's combo base drives the chain (witnessed by combo gold)", () => {
    // Worker has 100% combo base, player has 0%. A worker-completed sale advances
    // the shared chain; subsequent sales then pay comboBonusFactor(chain) > 1.
    // We CANNOT witness this via `comboChain` (a player completion legitimately
    // resets it — interleave-dependent) nor via `maxComboChain` (LOCKED rule #1:
    // player-only). The deterministic, interleave-proof witness is total gold:
    // with NO combo every sale pays exactly CANVAS_GOLD_BASE (=10 at T1, and
    // workerGoldFactor is 1 since goldPct=0), so `gold > canvasesSold × 10` iff
    // at least one sale fired at chain > 0 — which only the worker's combo base
    // can cause here. (After sale 1 advances the chain to 1, sale 2 is paid at
    // chain ≥ 1 before any reset can intervene → guaranteed once ≥ 2 sales fire.)
    vi.restoreAllMocks();
    // rng 0.4: no crit (0.4 < 0.01 critChance is false for player and worker);
    // combo roll 0.4 < worker effChance (≈1.0, decaying 0.05/link) → chain grows.
    vi.spyOn(rngModule, "rng").mockReturnValue(0.4);
    const d = makeDraft({ critLevel: 0, comboLevel: 0, roster: [worker({ speed: 5, comboChance: 1.0 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 6); // worker (interval 1) completes several T1 canvases
    expect(d.statsRun.canvasesSold).toBeGreaterThanOrEqual(2);
    expect(d.gold.toNumber()).toBeGreaterThan(d.statsRun.canvasesSold * 10);
  });
});
```
> These assertions are written to be robust to interleave ordering. If a specific count assertion proves brittle under the tie-break, relax it to the invariant it's protecting (e.g. ">= player-only contribution", "worker count excluded") rather than weakening the player-only guarantee.

- [ ] **Step 4: Run new tests, expect FAIL**

Run: `npx vitest run tests/core/canvasTickPure.multipainter.test.ts`
Expected: FAIL (single-painter tick ignores the roster).

- [ ] **Step 5: Rewrite `src/core/canvasTickPure.ts`**

Replace the entire file with:

```ts
import { big, type Big } from "@/core/bigNumber";
import {
  canvasGold, chunksPerCanvas, chunkInterval,
  COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier,
  getCritChance, getCritChunks, getComboBaseChance, getComboDecayReduction,
  getWorkerGoldFactor,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

/** Cap on canvas-sales resolved in a single tick (catch-up clips at this). */
const MAX_SALES_PER_TICK = 1000;
/** Defensive cap on total strokes per tick (guards a degenerate interval→0). */
const MAX_STROKES_PER_TICK = 1_000_000;

const PLAYER_ID = "player";

/** A painter participating in the shared-canvas tick (player or a worker). */
interface Painter {
  id: string;
  isPlayer: boolean;
  /** Seconds per stroke = chunkInterval(speed). */
  interval: number;
  /** Per-stroke crit probability. */
  critChance: number;
  /** Bonus chunks filled on a crit (integer). */
  critChunks: number;
  /** Combo base chance used when THIS painter completes a sale. */
  comboBase: number;
}

/**
 * Discrete-event multi-painter canvas tick. The player and every worker paint
 * the SHARED canvas, each at its own `interval`. Within `deltaSeconds` we
 * repeatedly advance time to the soonest-stroking painter and apply its stroke.
 *
 * Gold is paid as a single lump on canvas completion (unchanged). Crit bonus
 * chunks spill across canvas boundaries (unchanged). `canvasProgress` is the
 * shared COUNT of completed chunks in the current canvas (integer-valued);
 * each painter's sub-stroke timing lives in `draft.painterClocks`.
 *
 * Phase-B stat rule (LOCKED): crit/combo STREAK stats (currentCritStreak,
 * maxCritStreak, critsLanded, maxComboChain) track the PLAYER only — worker
 * strokes never perturb them. canvasesSold/goldEarned are canvas-level (counted
 * regardless of which painter lands the final chunk).
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  const chunkCount = chunksPerCanvas(draft.canvasTier);

  // --- Build the painter list (multipliers are invariant across the tick) ---
  const playerInterval = chunkInterval(getCanvasSpeedMultiplier(draft));
  if (playerInterval <= 0) return;
  const painters: Painter[] = [{
    id: PLAYER_ID, isPlayer: true, interval: playerInterval,
    critChance: getCritChance(draft),
    critChunks: getCritChunks(draft),
    comboBase: getComboBaseChance(draft),
  }];
  for (const w of draft.roster) {
    const interval = chunkInterval(w.stats.speed);
    if (interval <= 0) continue;
    painters.push({
      id: w.id, isPlayer: false, interval,
      critChance: w.stats.critChance,
      critChunks: w.stats.strokesPerCrit,
      comboBase: w.stats.comboChance,
    });
  }

  const goldMult = getCanvasGoldMultiplier(draft);
  const workerGoldFactor = getWorkerGoldFactor(draft);
  const baseSaleGold = canvasGold(goldMult, draft.canvasTier).mul(workerGoldFactor);
  const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));

  // --- Local mutable run state ---
  let progress = Math.floor(draft.canvasProgress); // sanitize any legacy fraction
  let chain = draft.comboChain;
  let critChunks: Record<number, true> = { ...draft.critChunks };
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  const prevClocks = draft.painterClocks ?? {};
  const clocks: Record<string, number> = {};
  for (const p of painters) clocks[p.id] = prevClocks[p.id] ?? 0;
  const workerStrokes: Record<string, number> = {};

  let budget = deltaSeconds;
  let sales = 0;
  let strokes = 0;
  let salesThisTick = 0;
  let critChunksThisTick = 0;       // PLAYER crit chunks only
  let tickGoldTotal = big(0);
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;

  // Fires the canvas-sale when a chunk fills the canvas. `comboBase`/`byPlayer`
  // belong to the painter that completed the chunk.
  const onChunkComplete = (chunkIndex: number, comboBase: number, byPlayer: boolean): void => {
    if (chunkIndex + 1 < chunkCount) return;
    const gain = baseSaleGold.mul(comboBonusFactor(chain));
    addCurrency(draft, "gold", gain);
    trackSaleGoldPure(draft, gain);
    tickGoldTotal = tickGoldTotal.add(gain);
    lastSaleId += 1;
    lastSaleAmount = gain;
    sales += 1;
    salesThisTick += 1;
    progress = 0;
    critChunks = {};
    if (byPlayer && chain > localMaxCombo) localMaxCombo = chain;
    const effChance = comboEffectiveChance(comboBase, chain, decay);
    chain = rng() < effChance ? chain + 1 : 0;
  };

  // Terminate on the EVENT, not on `budget > 0`: a painter whose stroke falls at
  // the exact end of the budget (chosenWait == budget — including the
  // click-to-paint boundary `canvasTick(playerInterval)`) must still fire, and
  // simultaneous painters (zero-wait after time advances) must all resolve before
  // we stop. TIME_EPSILON absorbs float fuzz so `4.999… vs 5` can't mis-order at
  // a boundary. (Solo: after the single painter strokes, its wait == interval >
  // budget(0) → break, giving exactly one chunk per `canvasTick(interval)` and
  // fractional-carry-equivalent partials — preserves the Task 3 golden master.)
  const TIME_EPSILON = 1e-9;
  while (sales < MAX_SALES_PER_TICK && strokes < MAX_STROKES_PER_TICK) {
    // Pick the painter whose next stroke comes soonest. Tie-break: player
    // first, then roster order — deterministic for catch-up reproducibility.
    let chosen = painters[0]!;
    let chosenWait = chosen.interval - clocks[chosen.id]!;
    for (let i = 1; i < painters.length; i++) {
      const p = painters[i]!;
      const wait = p.interval - clocks[p.id]!;
      if (wait < chosenWait) { chosen = p; chosenWait = wait; }
    }

    // Next stroke is beyond the remaining budget → advance all clocks and stop.
    if (chosenWait > budget + TIME_EPSILON) {
      for (const p of painters) clocks[p.id]! += budget;
      break;
    }

    // Advance time to the chosen painter's stroke. Resolves zero-wait
    // simultaneity too (chosenWait == 0 leaves budget unchanged; each painter
    // can be zero-wait at most once per instant since it resets to interval).
    for (const p of painters) clocks[p.id]! += chosenWait;
    budget -= chosenWait;
    clocks[chosen.id] = 0;
    strokes += 1;

    const completedChunkIndex = progress;
    progress += 1;
    const isLastChunkOfCanvas = completedChunkIndex + 1 >= chunkCount;

    // Crit is NOT rolled on the canvas's last chunk (so trigger + first bonus
    // stay together — matches the original single-painter behavior).
    if (!isLastChunkOfCanvas && rng() < chosen.critChance) {
      critChunks[completedChunkIndex] = true;
      onChunkComplete(completedChunkIndex, chosen.comboBase, chosen.isPlayer);
      let bonusLeft = chosen.critChunks;
      let filled = 1;
      while (bonusLeft > 0 && sales < MAX_SALES_PER_TICK) {
        const bonusIndex = progress;
        critChunks[bonusIndex] = true;
        progress += 1;
        onChunkComplete(bonusIndex, chosen.comboBase, chosen.isPlayer);
        bonusLeft -= 1;
        filled += 1;
      }
      if (!chosen.isPlayer) {
        workerStrokes[chosen.id] = (workerStrokes[chosen.id] ?? 0) + filled;
      } else {
        const totalCritChunks = 1 + chosen.critChunks;
        critChunksThisTick += totalCritChunks;
        localCritStreak += totalCritChunks;
        if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
      }
    } else {
      onChunkComplete(completedChunkIndex, chosen.comboBase, chosen.isPlayer);
      if (!chosen.isPlayer) {
        workerStrokes[chosen.id] = (workerStrokes[chosen.id] ?? 0) + 1;
      } else if (!isLastChunkOfCanvas) {
        localCritStreak = 0;
      }
    }
  }

  if (salesThisTick > 0 || critChunksThisTick > 0) {
    if (critChunksThisTick > 0) {
      incrementStatPure(draft, "lifetime", "critsLanded", critChunksThisTick);
      incrementStatPure(draft, "run", "critsLanded", critChunksThisTick);
    }
    if (salesThisTick > 0) {
      incrementStatPure(draft, "lifetime", "canvasesSold", salesThisTick);
      incrementStatPure(draft, "run", "canvasesSold", salesThisTick);
      if (localMaxCombo > draft.statsLifetime.maxComboChain) {
        incrementStatPure(draft, "lifetime", "maxComboChain", localMaxCombo - draft.statsLifetime.maxComboChain);
      }
    }
    patchRunStatsPure(draft, {
      currentCritStreak: localCritStreak,
      maxCritStreak: localMaxCritStreak,
      maxComboChain: localMaxCombo,
      goldEarned: draft.statsRun.goldEarned.add(tickGoldTotal),
    });
  }

  draft.canvasProgress = progress;
  draft.comboChain = chain;
  draft.critChunks = critChunks;
  draft.painterClocks = clocks;
  if (Object.keys(workerStrokes).length > 0) {
    draft.roster = draft.roster.map((w) =>
      workerStrokes[w.id]
        ? { ...w, strokesThisRun: w.strokesThisRun + workerStrokes[w.id]! }
        : w,
    );
  }
  if (lastSaleAmount !== null) {
    draft.lastSale = { id: lastSaleId, amount: lastSaleAmount };
  }
}
```

- [ ] **Step 6: Wire `canvasSlice.canvasTick` to persist the new state**

In `src/store/canvasSlice.ts`, in `canvasTick`'s `set()` return object, ADD two fields (so the live store carries painter timing forward and worker stroke counts accumulate):
```ts
        painterClocks: draft.painterClocks,
        roster: draft.roster,
```
> Without `painterClocks` in the return, the player clock never advances across ticks and idle play stops painting — this line is essential, not optional. `roster` is needed so worker `strokesThisRun` persists.

- [ ] **Step 7: Run the equivalence gate FIRST**

Run: `npx vitest run tests/core/canvasTickPure.equivalence.test.ts`
Expected: **PASS** (the rewrite reproduces the frozen solo golden master + step invariance).

**Equivalence fallback (only if the golden test fails after genuine effort to match RNG order):** add at the very top of `canvasTickPure`, before building the painter list:
```ts
  // Exact-equivalence fast path: with no workers the solo behavior must be
  // bit-identical. If the unified scheduler can't reproduce the frozen golden
  // master, delegate the empty-roster case to the preserved single-painter loop.
  if (draft.roster.length === 0) { soloCanvasTickPure(draft, deltaSeconds); return; }
```
and keep the pre-B single-painter function as `soloCanvasTickPure` in the same file (copy it from git `60e2f55:src/core/canvasTickPure.ts`, renamed, with `painterClocks` left untouched / `canvasProgress` fractional as before). **Prefer NOT to need this** — try to match first; the fast-path is a documented escape hatch, not the default.

- [ ] **Step 8: Run the adapted + new behavior tests**

Run: `npx vitest run tests/core/canvasTickPure.test.ts tests/core/canvasTickPure.multipainter.test.ts`
Expected: PASS. Fix interleave-brittle assertions by relaxing to the protected invariant (never by weakening the player-only stat rule).

- [ ] **Step 9: Full suite + build**

Run: `npx vitest run` then `npx vite build`.
Expected: green + clean. (Catch-up, bot-sim, and store tests exercise `canvasTickPure` indirectly — confirm none regressed; if a bot-sim or catch-up test asserts specific post-N-seconds gold for a SOLO run, the equivalence gate guarantees it still holds.)

- [ ] **Step 10: Commit**

```bash
git add -u
git add tests/core/canvasTickPure.multipainter.test.ts
git commit -m "core(office): discrete-event multi-painter canvas tick" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Store-level integration + final verification

Confirm the wiring works end-to-end through the real store action (not just the pure function), and document the click decision.

**Files:**
- Test: NEW `tests/store/canvasSlice.multipainter.test.ts` (or append to an existing canvasSlice store test if one exists — verify)

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { BASE_CHUNK_INTERVAL } from "@/core/balance";

describe("canvasTick (store) — multi-painter integration", () => {
  beforeEach(() => {
    useGameStore.setState({
      canvasProgress: 0, canvasTier: 1, comboChain: 0, critChunks: {},
      painterClocks: {}, lastSale: null,
      sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 0,
      roster: [{ ...createWorker(), stats: { ...createWorker().stats, speed: 1 } }],
    });
  });

  it("accumulates worker strokesThisRun across successive ticks via the store", () => {
    const tick = useGameStore.getState().canvasTick;
    tick(BASE_CHUNK_INTERVAL);
    tick(BASE_CHUNK_INTERVAL);
    tick(BASE_CHUNK_INTERVAL);
    expect(useGameStore.getState().roster[0]!.strokesThisRun).toBeGreaterThanOrEqual(2);
  });

  it("carries the player clock across ticks (idle play keeps painting)", () => {
    const tick = useGameStore.getState().canvasTick;
    // Two half-interval ticks should complete one player chunk (clock carries).
    tick(BASE_CHUNK_INTERVAL / 2);
    tick(BASE_CHUNK_INTERVAL / 2);
    // player + worker each ~1 chunk → progress >= 1 (proves clock carry works)
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run, verify it PASSES** (the wiring from Task 4 should already satisfy it)

Run: `npx vitest run tests/store/canvasSlice.multipainter.test.ts`
Expected: PASS. If "carries the player clock" FAILS, the `painterClocks` return wiring (Task 4 Step 6) is missing — fix it there.

- [ ] **Step 3: Full suite + build**

Run: `npx vitest run` then `npx vite build`.
Expected: green + clean.

- [ ] **Step 4: Commit**

```bash
git add -u
git add tests/store/canvasSlice.multipainter.test.ts
git commit -m "test(office): multi-painter canvas-tick store integration" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§2.2):**
- Per-painter independent cadence via `painterClocks` + `chunkInterval(speed)` → Tasks 2, 4. ✅
- Soonest-stroke selection, advance-time-to-it, apply stroke → Task 4 scheduler loop. ✅
- Shared `canvasProgress`; crit per painter; bonus chunks spill across canvas boundaries → Task 4. ✅
- Sale = `canvasGold(playerGoldMult, tier) × workerGoldFactor × comboBonusFactor(chain)` → Tasks 1, 4. ✅
- Combo chain shared, rolled by completing painter's combo chance; player decay → Task 4. ✅
- `workerGoldFactor = ∏(1 + goldPct)` (multiplicative, tunable) → Task 1. ✅
- Per-worker `strokesThisRun` accumulation → Task 4 (`workerStrokes` → roster). ✅
- Lump-sum-on-sale preserved → Task 4 `onChunkComplete`. ✅
- Player remains a painter with existing aggregate stats → Task 4 player Painter. ✅

**Advisor blind spots covered:**
- Player-only crit/combo streak stats → LOCKED rule + Task 4 `isPlayer` gating + Task 4 Step 3 test. ✅
- Step-size invariance → Task 3 test (kept green by Task 4). ✅
- Equivalence (pre==post solo) → Task 3 frozen golden master + Task 4 gate + documented fallback. ✅
- `painterClocks` cloned for catch-up + stripped from persistence → Task 2. ✅
- Click-to-paint advances workers → documented (conscious, no change). ✅
- Catch-up stroke explosion → `MAX_STROKES_PER_TICK` defensive cap + `MAX_SALES_PER_TICK` preserved → Task 4. ✅

**Placeholder scan:** Full file body for the rewrite; concrete edits elsewhere. The only "capture-then-freeze" is Task 3 Step 2 (golden master), which is an intentional procedure with a stated method, not an unwritten value. The equivalence fallback is a conditional escape hatch with full instructions.

**Type consistency:** `Painter` is internal to `canvasTickPure`. `getWorkerGoldFactor` (Task 1) consumes `Pick<GameStore,"roster">` and is used by the tick (Task 4). `painterClocks: Record<string, number>` is defined once (Task 2) and read/written by the tick + persisted by `canvasTick` (Task 4) + cloned (Task 2). `PLAYER_ID = "player"` is the reserved roster key, distinct from any uuid worker id.

---

## Phase C/D handoff (next plans)
Ascend XP: `computeAscendXpPool(runGold)` + hybrid contribution split (using `strokesThisRun`, now accumulated by B) + `applyAscendXp` (xp→levels→`applyStatLevelUp`). `ascend.ts:44` already calls `resetOffice()` (A2 made it keep-roster/zero-strokes) — C swaps in the XP/level-up pass and resets `strokesThisRun` as part of it. Skill-node migration + the dead-code cleanup list are in `docs/HANDOVER.md` (Phase C bullet). Reconsider whether worker crits should feed `critsLanded`/`maxComboChain` achievements (B deferred this — see LOCKED rule #1).

**DECISION OWNED BY C/D — multi-painter step-invariance (known, measured gap):** the multi-painter scheduler is NOT step-size invariant. Per-event float drift in `painterClocks` flips near-simultaneous painters' tie-break between small (live ~16ms) and large (catch-up 10s/60s) steps, reordering RNG consumption — measured ~8% crit divergence over 600s (0.1s → ~96 crits vs 1s/60s → ~104), plus a per-worker `strokesThisRun` split. **Solo (empty roster) is bit-exact** (the frozen golden master + step-invariance describes pass at 0.1/1/5/60s) and is Phase B's actual regression bar; workers aren't reachable in the live game until C/D, so this is latent. A skipped guard test (`tests/core/canvasTickPure.equivalence.test.ts` → "multi-painter step-invariance (KNOWN GAP)") documents it — un-skip to watch it fail. **C/D must either** (a) rework the scheduler to absolute next-stroke scheduling so multi-painter is step-exact, **or** (b) decide an explicit catch-up-vs-live tolerance and adjust the guard. A candidate fix is INCOMPLETE unless a seeded multi-painter probe equalizes ALL of {gold, crits, maxCombo, per-worker strokes} across step sizes — an epsilon-tolerant tie-break alone is a guess until measured (the divergence touches `strokesThisRun`, not just crits, so there may be more than one pathway).
