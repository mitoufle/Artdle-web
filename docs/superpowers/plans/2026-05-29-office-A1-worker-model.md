# Office Redesign — Phase A1: Worker Model + Roll Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, self-contained core of the redesigned worker: the 5-stat sheet, its level-1 base values, and the per-level-up increment-roll engine. All new files — nothing existing is touched, so the game keeps working and the suite stays green.

**Architecture:** A worker has five stats (gold%, speed, crit chance, strokes-per-crit, combo chance). It spawns at level 1 with ~a fresh player's values. Each level-up rolls a random increment per stat (`+0–5%` for the four fractional stats; `+0/+1` for strokes-per-crit), with crit chance clamped at a hard cap. This phase delivers `createBaseStats()` and `applyStatLevelUp()` as pure functions over a seedable RNG, plus the balance constants — the substrate every later office phase builds on.

**Tech Stack:** TypeScript (strict), Vitest, `@/core/rng` (seedable: `setSeed`, `rng`, `rngPick`).

**Spec:** `docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md` (§2.1 stats, §3 rolls).

> **Scope guard:** This plan adds NEW files only. It does NOT modify `officeSlice.ts`, `multipliers.ts`, the canvas tick, or any UI — those are Phases A2/B/C/D. Numeric constants are TUNABLE; the stat set + roll shape are locked.

> **Class bias (deferred):** Classes will later bias which stats roll higher. This phase implements only the neutral **base class** (uniform rolls). `applyStatLevelUp` takes a `classId` param defaulting to `"base"` as a forward-compat hook, but no bias logic is built yet (YAGNI — the class roster is a separate content spec).

---

## File structure

- `src/core/balance.ts` — add worker-stat constants (base values, increment options, crit cap).
- `src/core/workerModel.ts` — NEW. `WorkerStats` type, `createBaseStats()`, `applyStatLevelUp(stats, rng?, classId?)`.
- `tests/core/workerModel.test.ts` — NEW. Seeded-RNG tests for base values, increment bounds, crit-cap clamp.

---

### Task 1: Worker-stat balance constants

**Files:**
- Modify: `src/core/balance.ts` (add a new "Worker stat model" section near the existing Painter's Office formulas)
- Test: `tests/core/balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/balance.test.ts`:

```ts
import {
  WORKER_BASE_STATS, WORKER_PCT_INCREMENTS, WORKER_STROKES_PER_CRIT_INCREMENTS, WORKER_CRIT_CHANCE_CAP,
} from "@/core/balance";

describe("worker stat model constants", () => {
  it("base stats match a fresh painter (×1 gold, 1 stroke cadence, 1% crit, 1 stroke/crit, 0 combo)", () => {
    expect(WORKER_BASE_STATS).toEqual({ goldPct: 0, speed: 1, critChance: 0.01, strokesPerCrit: 1, comboChance: 0 });
  });
  it("percent-stat increments are 0..5 points in 1-point steps", () => {
    expect(WORKER_PCT_INCREMENTS).toEqual([0, 0.01, 0.02, 0.03, 0.04, 0.05]);
  });
  it("strokes-per-crit increments are 0 or 1", () => {
    expect(WORKER_STROKES_PER_CRIT_INCREMENTS).toEqual([0, 1]);
  });
  it("crit chance is hard-capped at 50%", () => {
    expect(WORKER_CRIT_CHANCE_CAP).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: FAIL (constants undefined).

- [ ] **Step 3: Add the constants**

In `src/core/balance.ts`, add a section (place it after the existing Painter's Office formulas block):

```ts
// ============================================================================
// Worker stat model — redesigned Painter's Office (autonomous painters).
// See docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md.
// TUNABLE values; the stat set + roll shape are locked.
// ============================================================================

/** A level-1 worker ≈ a fresh painter: ×1 gold (goldPct 0), base stroke cadence
 *  (speed 1.0 → BASE_CHUNK_INTERVAL per stroke), 1% crit, 1 stroke per crit, 0% combo. */
export const WORKER_BASE_STATS = Object.freeze({
  goldPct: 0,        // additive fraction → gold multiplier = 1 + goldPct
  speed: 1,          // stroke-rate multiplier (interval = BASE_CHUNK_INTERVAL / speed)
  critChance: 0.01,  // per-stroke crit probability (capped at WORKER_CRIT_CHANCE_CAP)
  strokesPerCrit: 1, // integer bonus chunks per crit
  comboChance: 0,    // combo trigger probability contributed when this worker completes a sale
});

/** Per-level-up increment options for the four fractional stats (gold/speed/crit/combo):
 *  +0..+5 percentage points, in 1-point steps. */
export const WORKER_PCT_INCREMENTS: ReadonlyArray<number> = [0, 0.01, 0.02, 0.03, 0.04, 0.05];

/** Per-level-up increment options for strokes-per-crit: +0 or +1. */
export const WORKER_STROKES_PER_CRIT_INCREMENTS: ReadonlyArray<number> = [0, 1];

/** Hard ceiling on a worker's crit chance. */
export const WORKER_CRIT_CHANCE_CAP = 0.5;
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(office): worker stat-model constants"
```

---

### Task 2: Worker model — base stats + level-up roll engine

**Files:**
- Create: `src/core/workerModel.ts`
- Test: `tests/core/workerModel.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/workerModel.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setSeed } from "@/core/rng";
import { createBaseStats, applyStatLevelUp, type WorkerStats } from "@/core/workerModel";
import { WORKER_BASE_STATS, WORKER_CRIT_CHANCE_CAP } from "@/core/balance";

describe("workerModel", () => {
  beforeEach(() => setSeed(1));

  it("createBaseStats returns a fresh copy of the base stats", () => {
    const s = createBaseStats();
    expect(s).toEqual(WORKER_BASE_STATS);
    // must be a copy, not the frozen constant (callers will accumulate onto it)
    s.goldPct += 0.01;
    expect(WORKER_BASE_STATS.goldPct).toBe(0);
  });

  it("applyStatLevelUp only ever increases stats, within the allowed increments", () => {
    let s = createBaseStats();
    for (let i = 0; i < 50; i++) {
      const before = s;
      s = applyStatLevelUp(s);
      expect(s.goldPct).toBeGreaterThanOrEqual(before.goldPct);
      expect(s.speed).toBeGreaterThanOrEqual(before.speed);
      expect(s.comboChance).toBeGreaterThanOrEqual(before.comboChance);
      // per-step deltas are within [0, 0.05] for fractional stats, [0,1] for strokes/crit
      expect(s.goldPct - before.goldPct).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(s.strokesPerCrit - before.strokesPerCrit).toBeLessThanOrEqual(1);
      expect(Number.isInteger(s.strokesPerCrit)).toBe(true);
    }
  });

  it("crit chance never exceeds the cap no matter how many level-ups", () => {
    let s = createBaseStats();
    for (let i = 0; i < 1000; i++) s = applyStatLevelUp(s);
    expect(s.critChance).toBeLessThanOrEqual(WORKER_CRIT_CHANCE_CAP);
  });

  it("is deterministic under a fixed seed", () => {
    setSeed(42);
    let a = createBaseStats(); for (let i = 0; i < 20; i++) a = applyStatLevelUp(a);
    setSeed(42);
    let b = createBaseStats(); for (let i = 0; i < 20; i++) b = applyStatLevelUp(b);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/core/workerModel.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/core/workerModel.ts`**

```ts
import { rngPick } from "@/core/rng";
import {
  WORKER_BASE_STATS, WORKER_PCT_INCREMENTS, WORKER_STROKES_PER_CRIT_INCREMENTS, WORKER_CRIT_CHANCE_CAP,
} from "@/core/balance";

/** The five stats of a redesigned worker. See the office painter-redesign spec §2.1. */
export interface WorkerStats {
  /** Additive fraction; the worker's gold multiplier is (1 + goldPct). */
  goldPct: number;
  /** Stroke-rate multiplier; stroke interval = BASE_CHUNK_INTERVAL / speed. */
  speed: number;
  /** Per-stroke crit probability, capped at WORKER_CRIT_CHANCE_CAP. */
  critChance: number;
  /** Integer bonus chunks filled when this worker crits. */
  strokesPerCrit: number;
  /** Combo trigger probability contributed when this worker completes a sale. */
  comboChance: number;
}

/** A fresh level-1 worker's stats (a mutable copy of the frozen base). */
export const createBaseStats = (): WorkerStats => ({ ...WORKER_BASE_STATS });

/**
 * Apply ONE level-up's growth: roll a random increment for each stat and add it.
 * Fractional stats (gold/speed/crit/combo) roll +0..+5pp; strokes-per-crit rolls +0/+1.
 * Crit chance is clamped at the hard cap.
 *
 * `classId` is a forward-compat hook for class-biased rolls (deferred content spec);
 * the only class today is the neutral "base", which rolls uniformly.
 */
export const applyStatLevelUp = (stats: WorkerStats, _classId: string = "base"): WorkerStats => ({
  goldPct: stats.goldPct + rngPick(WORKER_PCT_INCREMENTS),
  speed: stats.speed + rngPick(WORKER_PCT_INCREMENTS),
  critChance: Math.min(WORKER_CRIT_CHANCE_CAP, stats.critChance + rngPick(WORKER_PCT_INCREMENTS)),
  strokesPerCrit: stats.strokesPerCrit + rngPick(WORKER_STROKES_PER_CRIT_INCREMENTS),
  comboChance: stats.comboChance + rngPick(WORKER_PCT_INCREMENTS),
});
```

(Confirm `rngPick` exists in `@/core/rng` with signature `rngPick<T>(arr: ReadonlyArray<T>): T` — it's used by `workshopRoll.ts`/`officeRoll.ts`. If its name differs, match the actual export.)

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/core/workerModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/workerModel.ts tests/core/workerModel.test.ts
git commit -m "core(office): worker base stats + level-up roll engine"
```

---

## Self-Review

**Spec coverage (this phase):**
- 5-stat sheet (gold%, speed, crit chance, strokes-per-crit, combo chance) → `WorkerStats` (Task 2). ✅
- Level-1 ≈ fresh player base values → `WORKER_BASE_STATS` / `createBaseStats` (Tasks 1-2). ✅
- Per-level-up increments (+0–5% / +0–1) → `applyStatLevelUp` + increment constants (Tasks 1-2). ✅
- Crit chance ≤ 50% cap → clamp in `applyStatLevelUp` + `WORKER_CRIT_CHANCE_CAP` (Tasks 1-2). ✅
- Class bias = forward-compat hook, content deferred → `classId` param, no bias logic (Task 2). ✅

**Placeholder scan:** concrete constants + full function bodies. The only conditional is "confirm `rngPick` signature" — a verification step, not a placeholder.

**Type consistency:** `WorkerStats` defined once in `workerModel.ts` and imported by its test; constants in `balance.ts` consumed by both. Nothing else references these yet (new files) — no cross-file drift possible this phase.

**Next phase (A2, separate plan):** rewrite `officeSlice.ts` to the new `Worker` (id, classId, level, xp, `stats: WorkerStats`, mastery, strokesThisRun); spawn-to-cap on slot unlock; **remove** the old additive worker wiring from `multipliers.ts` (`getOfficeContribution`, the `getCritChunks` worker branch, worker combo/speed) and `StatsRoom`; delete `officeRoll.ts` / `officeTickPure.ts` / `officeClasses.ts` and the hire/queue actions.
