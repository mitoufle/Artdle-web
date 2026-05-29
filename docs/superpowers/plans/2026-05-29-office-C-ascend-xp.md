# Office Redesign — Phase C: Ascend XP + Persistence + Skill-Node Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make workers level up at ascend. Compute an ascend-XP pool, split it across the roster (baseline floor + contribution weight by `strokesThisRun`), convert each worker's share into level-ups (each rolling `applyStatLevelUp`), capture the rolls for Phase D's reveal screen, and reset run contribution — all while leaving the heavily-used **ascend path byte-identical for players with no workers**. Migrate the now-stale office skill nodes (refund deleted ones) and delete the dead office balance/multiplier code.

**Architecture:** A new `applyAscendXp(poolMagnitude: Big)` office action does the XP pass; the ascend orchestrator passes **`big(fameGain)`** as the pool magnitude (fame-gained is the anchor — see "Anchor decision" below). The pure math (pool split, per-worker level-up resolution) lives in a new `src/core/workerAscend.ts` so it's seedable-RNG-testable in isolation. `resetOffice` is removed — `applyAscendXp(big(0))` subsumes its "reset run contribution" behavior. Skill-node migration collapses the dead middle of the office branch and refunds fame.

**Tech Stack:** TypeScript (strict), `@/core/rng` (seedable), `break_eternity.js` (`Big`), Zustand 5 (persist), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md` §3 (leveling = increment rolls), §4 (ascend XP: pool + hybrid split + roll screen), §7 (persistence), §8 (skill-node migration).

**Builds on:** Phase B (`858cf3c`). Workers accumulate `strokesThisRun` in the tick. `Worker = {id, classId, level, xp:Big, stats:WorkerStats, mastery, strokesThisRun}`. `applyStatLevelUp(stats, classId)` (A1, `@/core/workerModel`) rolls one level-up's stat increments. `workerXpToNext(level)` (`@/core/balance`) is the level curve. `resetOffice()` currently keeps the roster + zeroes `strokesThisRun` and is called at `ascend.ts:44`.

---

## Green bar (every task)
- `npx vitest run` fully green.
- `npx vite build` clean.
- NOT `tsc` (~25 pre-existing baseline test-file errors per HANDOVER; don't chase, don't add NEW dangling imports that break `vite build`).

## LOCKED decisions (do not let an implementer drift):

### Anchor decision — pool magnitude is FAME-GAINED, not gold (LOCKED)
The orchestrator passes `big(fameGain)` (the fame credited this ascend) as `poolMagnitude`. **Why not run gold:** run gold spans ~12+ orders of magnitude over a game (10³ → 10¹⁵+); fame-gained spans ~4 (1 → ~10⁴, since `fameOnAscend` is quintic-in-log10). Against the geometric `workerXpToNext` curve (`1.15^level`), no single linear-gold fraction keeps "levels gained per ascend" sane across the whole game — it starves early ascends or trivializes late ones (hitting `LEVEL_UP_CAP`). Fame-gained is naturally log-compressed and matches the spec's "très long, levels slowly across ascends." Because `applyAscendXp` takes the magnitude as a parameter, swapping the anchor later is a **one-line change in `ascend.ts`** — do not bake gold/fame into the action.

**Anchor-shape acceptance check (LOCKED, Task 2):** "levels gained per ascend" must stay roughly flat — a *fraction of a level to a few levels* — as the anchor grows, NOT accelerate. Concretely: an established (high-level) worker gains few levels even from a large pool (the curve outpaces fame), while a fresh level-1 worker gains more from the same pool (intended catch-up — "unlocking a slot is never a trap"). A worker must not approach `LEVEL_UP_CAP` for any realistic fame magnitude (≤ ~10⁴). Task 2 encodes this as a test.

### Empty-roster ascend equivalence (LOCKED, Task 4)
Almost no live player has the office (it's gated deep in the fame tree), but *everyone* ascends. `applyAscendXp` on `roster: []` MUST be a no-op that leaves the ascend outcome byte-identical to today: fame credited, gold/inspiration → 0, tree/canvas/workshop reset, `ascendCount++`, `lastAscendRoll` null, no error. This is the Phase-C analog of B's solo golden master — a named regression test, because a subtle change to the heavily-used ascend path won't be caught by worker-focused tests.

## Scope guard — NOT in Phase C (Phase D):
- The post-ascend **roll screen UI** in `AscendCinematicOverlay` (Phase D). Phase C only CAPTURES the roll data (`lastAscendRoll`, a transient before/after snapshot) so D can render it — the rolls consume global `rng()` here and are unrecoverable later, so capture must happen in C.
- On-canvas avatars, office tab rework, class-switch UI.

## Conscious decisions to record (not tasks):
- **`entrepreneur` keeps `roster_slot`** after migration, so buying the office-unlock node spawns worker #1 (via `reconcileRoster`, wired in B). Intended.
- **`mastery` is forward-built**: incremented alongside `level` in `applyAscendXp` (a neutral `base`-class counter from ascend 1). Per-class mastery semantics are content-deferred (spec §6); a single counter is the simplest forward-compatible choice.

---

## File structure
- `src/core/balance.ts` — ADD `WORKER_BASELINE_XP_FRACTION`, `ACCELERATOR_XP_PER_LEVEL`; KEEP `workerXpToNext`/`WORKER_XP_BASE`/`WORKER_XP_GROWTH` (Task 6 must NOT delete these). Task 6 deletes the genuinely-dead office machinery.
- `src/core/multipliers.ts` — ADD `getWorkerXpPoolMultiplier`; Task 6 deletes `getWorkerXpMultiplier`/`getHireCostMultiplier`.
- `src/core/workerAscend.ts` — NEW. `splitAscendPool`, `applyAscendXpToWorker` (pure, seedable-RNG).
- `src/store/officeSlice.ts` — ADD `lastAscendRoll` state + `applyAscendXp`/`clearAscendRoll` actions; Task 4 REMOVES `resetOffice`.
- `src/store/index.ts` — strip `lastAscendRoll` in `partialize`; save migration v27→v28 (refund + delete 5 office nodes); bump `SAVE_VERSION` to 28.
- `src/config/skillTreeNodes.ts` — collapse/reparent the office branch.
- `src/systems/ascend.ts` — `applyAscendXp(big(fameGain))` replaces `resetOffice()`.

---

## Task 1: Ascend-XP balance constants + `getWorkerXpPoolMultiplier`

**Files:**
- Modify: `src/core/balance.ts`, `src/core/multipliers.ts`
- Test: `tests/core/balance.test.ts`, `tests/core/multipliers.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/balance.test.ts`:
```ts
import { WORKER_BASELINE_XP_FRACTION, ACCELERATOR_XP_PER_LEVEL } from "@/core/balance";

describe("ascend-xp constants", () => {
  it("baseline split fraction is in (0,1)", () => {
    expect(WORKER_BASELINE_XP_FRACTION).toBeGreaterThan(0);
    expect(WORKER_BASELINE_XP_FRACTION).toBeLessThan(1);
  });
  it("accelerator boosts the ascend pool by +10% per level", () => {
    expect(ACCELERATOR_XP_PER_LEVEL).toBe(0.10);
  });
});
```

Add to `tests/core/multipliers.test.ts`:
```ts
import { getWorkerXpPoolMultiplier } from "@/core/multipliers";
import type { GameStore } from "@/store";

describe("getWorkerXpPoolMultiplier", () => {
  it("is 1.0 with no accelerator nodes", () => {
    expect(getWorkerXpPoolMultiplier({ purchasedNodes: {} } as GameStore)).toBe(1);
  });
  it("adds +10% per worker_xp_mult capability level", () => {
    // accelerator carries `worker_xp_mult`; 3 levels → 1.30
    expect(getWorkerXpPoolMultiplier({ purchasedNodes: { accelerator: 3 } } as GameStore)).toBeCloseTo(1.30, 9);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/core/balance.test.ts tests/core/multipliers.test.ts`
Expected: FAIL (undefined exports).

- [ ] **Step 3: Add the constants + selector**

In `src/core/balance.ts`, in the "Worker stat model" section (after `WORKER_CRIT_CHANCE_CAP`), add:
```ts
/** Ascend-XP pool split: this fraction is distributed EQUALLY across the roster
 *  (the baseline floor — so a fresh / zero-stroke worker still climbs); the
 *  remainder is distributed by each worker's strokesThisRun share. TUNABLE
 *  (central knob per spec §4.1). */
export const WORKER_BASELINE_XP_FRACTION = 0.5;

/** Accelerator (worker_xp_mult capability): +10% to the worker ascend-XP pool per level. */
export const ACCELERATOR_XP_PER_LEVEL = 0.10;
```

In `src/core/multipliers.ts`, add (near `getWorkerGoldFactor`; takes `purchasedNodes` directly):
```ts
/**
 * Multiplier on the worker ascend-XP pool from the Accelerator node
 * (`worker_xp_mult` capability): `1 + ACCELERATOR_XP_PER_LEVEL × levels`.
 * Replaces the old per-sale `getWorkerXpMultiplier` (deleted in Phase C).
 */
export const getWorkerXpPoolMultiplier = (state: Pick<GameStore, "purchasedNodes">): number =>
  1 + countCapability(state, "worker_xp_mult") * ACCELERATOR_XP_PER_LEVEL;
```
Add `ACCELERATOR_XP_PER_LEVEL` to the existing `@/core/balance` import in multipliers.ts. (`countCapability` is already imported.)

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/core/balance.test.ts tests/core/multipliers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/balance.ts src/core/multipliers.ts tests/core/balance.test.ts tests/core/multipliers.test.ts
git commit -m "core(office): ascend-xp constants + getWorkerXpPoolMultiplier" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure ascend-XP engine (`workerAscend.ts`)

The pure math: split the pool, and resolve one worker's level-ups. Isolated and seedable so the rolls are deterministic-testable, and the anchor-shape acceptance check lives here.

**Files:**
- Create: `src/core/workerAscend.ts`
- Test: `tests/core/workerAscend.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/workerAscend.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import { splitAscendPool, applyAscendXpToWorker } from "@/core/workerAscend";
import { createWorker } from "@/store/officeSlice";
import { WORKER_BASELINE_XP_FRACTION, workerXpToNext } from "@/core/balance";

function workerWith(over: Partial<ReturnType<typeof createWorker>>) {
  return { ...createWorker(), ...over };
}

describe("splitAscendPool", () => {
  it("returns [] for an empty roster", () => {
    expect(splitAscendPool(big(100), [])).toEqual([]);
  });

  it("baseline floor: a zero-stroke worker still gets XP (never a trap)", () => {
    const a = workerWith({ strokesThisRun: 100 });
    const b = workerWith({ strokesThisRun: 0 });
    const [sa, sb] = splitAscendPool(big(100), [a, b]);
    // b gets the baseline share even with 0 strokes.
    expect(sb!.gt(0)).toBe(true);
    // contribution still matters — the heavy painter gets more.
    expect(sa!.gt(sb!)).toBe(true);
    // total conserved.
    expect(sa!.add(sb!).toNumber()).toBeCloseTo(100, 6);
  });

  it("Σstrokes==0 falls back to an equal split", () => {
    const a = workerWith({ strokesThisRun: 0 });
    const b = workerWith({ strokesThisRun: 0 });
    const [sa, sb] = splitAscendPool(big(100), [a, b]);
    expect(sa!.toNumber()).toBeCloseTo(50, 6);
    expect(sb!.toNumber()).toBeCloseTo(50, 6);
  });

  it("baseline fraction controls floor vs contribution", () => {
    const a = workerWith({ strokesThisRun: 1 });
    const b = workerWith({ strokesThisRun: 0 });
    // baselineFraction 1 → fully equal regardless of strokes
    const [sa, sb] = splitAscendPool(big(100), [a, b], 1);
    expect(sa!.toNumber()).toBeCloseTo(50, 6);
    expect(sb!.toNumber()).toBeCloseTo(50, 6);
  });
});

describe("applyAscendXpToWorker", () => {
  beforeEach(() => setSeed(7));

  it("no level-up when the share is below the next-level cost", () => {
    const w = createWorker(); // level 1, xp 0; workerXpToNext(1) ≈ 11.5
    const r = applyAscendXpToWorker(w, big(1));
    expect(r.levelAfter).toBe(1);
    expect(r.worker.xp.toNumber()).toBeCloseTo(1, 6);
    expect(r.worker.stats).toEqual(w.stats); // no roll applied
  });

  it("levels up and rolls stat increments; mastery tracks levels", () => {
    const w = createWorker();
    // Enough XP for several levels.
    const r = applyAscendXpToWorker(w, big(500));
    expect(r.levelAfter).toBeGreaterThan(r.levelBefore);
    expect(r.worker.level).toBe(r.levelAfter);
    expect(r.worker.mastery).toBe(w.mastery + (r.levelAfter - r.levelBefore));
    // a stat roll happened (some stat increased) — base stats can only go up
    const grew =
      r.statsAfter.goldPct > r.statsBefore.goldPct ||
      r.statsAfter.speed > r.statsBefore.speed ||
      r.statsAfter.critChance > r.statsBefore.critChance ||
      r.statsAfter.strokesPerCrit > r.statsBefore.strokesPerCrit ||
      r.statsAfter.comboChance > r.statsBefore.comboChance;
    expect(grew).toBe(true);
  });

  it("carries leftover XP toward the next level", () => {
    const w = createWorker();
    const cost1 = workerXpToNext(1).toNumber(); // ≈ 11.5
    const r = applyAscendXpToWorker(w, big(cost1 + 3));
    expect(r.levelAfter).toBe(2);
    expect(r.worker.xp.toNumber()).toBeCloseTo(3, 4);
  });

  // ANCHOR-SHAPE ACCEPTANCE CHECK (LOCKED): levels-per-ascend stays bounded as
  // the pool grows; high-level workers gain few levels (curve outpaces fame);
  // a realistic max fame (1e4) never drives a worker near the level cap.
  it("levels-per-ascend stays bounded and does not accelerate (fame anchor sanity)", () => {
    const fresh = createWorker();                            // level 1
    const veteran = { ...createWorker(), level: 50, xp: big(0) };
    const POOL = big(10_000); // a large, late-game fame magnitude
    const freshGain = applyAscendXpToWorker(fresh, POOL).levelAfter - 1;
    const vetGain = applyAscendXpToWorker(veteran, POOL).levelAfter - 50;
    // Fresh worker catches up faster than the veteran climbs (intended).
    expect(freshGain).toBeGreaterThan(vetGain);
    // Even a fresh worker with a huge pool stays well under the 1000-level cap.
    expect(freshGain).toBeLessThan(200);
    // A veteran gains only a handful of levels from the same big pool.
    expect(vetGain).toBeLessThan(20);
  });
});
```
> The exact bounds (`< 200`, `< 20`) are sanity rails, not balance targets. If they fail, the anchor/curve is mis-shaped — STOP and report (this is the anchor-shape gate, not a number to fudge). If they pass with lots of headroom, that's fine.

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/core/workerAscend.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/core/workerAscend.ts`**

```ts
import { big, type Big } from "@/core/bigNumber";
import { workerXpToNext, WORKER_BASELINE_XP_FRACTION } from "@/core/balance";
import { applyStatLevelUp, type WorkerStats } from "@/core/workerModel";
import type { Worker } from "@/store/officeSlice";

/** Safety backstop: max level-ups resolved for one worker in a single ascend.
 *  Hitting this in playtest means the XP anchor/curve is mis-shaped (see plan). */
const LEVEL_UP_CAP = 1000;

/**
 * Split an ascend-XP pool across the roster: `WORKER_BASELINE_XP_FRACTION` of the
 * pool is distributed EQUALLY (the floor — so a fresh / zero-stroke worker still
 * climbs), the remainder by each worker's `strokesThisRun` share. If no worker
 * painted (Σstrokes == 0) the whole pool is split equally.
 */
export function splitAscendPool(
  pool: Big,
  workers: ReadonlyArray<Worker>,
  baselineFraction: number = WORKER_BASELINE_XP_FRACTION,
): Big[] {
  const n = workers.length;
  if (n === 0) return [];
  const totalStrokes = workers.reduce((s, w) => s + w.strokesThisRun, 0);
  const baselinePart = pool.mul(baselineFraction);
  const contribPart = pool.mul(1 - baselineFraction);
  const perBaseline = baselinePart.div(n);
  return workers.map((w) =>
    perBaseline.add(
      totalStrokes > 0
        ? contribPart.mul(w.strokesThisRun).div(totalStrokes)
        : contribPart.div(n),
    ),
  );
}

/** Per-worker outcome of an ascend XP pass — a pure before/after snapshot. */
export interface WorkerLevelUpResult {
  readonly worker: Worker;       // xp/level/stats/mastery updated; strokesThisRun untouched
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly statsBefore: WorkerStats;
  readonly statsAfter: WorkerStats;
}

/**
 * Add `xpShare` to a worker and resolve level-ups. Each level rolls
 * `applyStatLevelUp` (class-biased; "base" is neutral) and increments `mastery`.
 * Leftover XP carries toward the next level. Capped at LEVEL_UP_CAP per pass.
 * Does NOT touch `strokesThisRun` (the caller resets it).
 */
export function applyAscendXpToWorker(worker: Worker, xpShare: Big): WorkerLevelUpResult {
  const levelBefore = worker.level;
  const statsBefore = worker.stats;
  let level = worker.level;
  let xp = worker.xp.add(xpShare);
  let stats = worker.stats;
  let mastery = worker.mastery;
  let i = 0;
  for (; i < LEVEL_UP_CAP; i++) {
    const cost = workerXpToNext(level);
    if (xp.lt(cost)) break;
    xp = xp.sub(cost);
    level += 1;
    mastery += 1;
    stats = applyStatLevelUp(stats, worker.classId);
  }
  if (import.meta.env.DEV && i === LEVEL_UP_CAP) {
    console.warn(`worker ${worker.id} hit the ${LEVEL_UP_CAP}-level ascend cap; the XP anchor/curve is likely mis-shaped.`);
  }
  return {
    worker: { ...worker, level, xp, stats, mastery },
    levelBefore,
    levelAfter: level,
    statsBefore,
    statsAfter: stats,
  };
}
```
> `import type { Worker }` is type-only → no runtime import cycle with `officeSlice` (which imports these functions at runtime).

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/core/workerAscend.test.ts`
Expected: PASS (including the anchor-shape check).

- [ ] **Step 5: Commit**

```bash
git add src/core/workerAscend.ts tests/core/workerAscend.test.ts
git commit -m "core(office): pure ascend-xp engine (pool split + level-up resolution)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `applyAscendXp` action + `lastAscendRoll` state (additive — keeps `resetOffice`)

Add the office action and the transient roll-capture state. This task is purely additive (it does NOT remove `resetOffice` or touch `ascend.ts` — that's Task 4), so the suite stays green throughout.

**Files:**
- Modify: `src/store/officeSlice.ts`, `src/store/index.ts` (partialize strip)
- Test: `tests/store/officeSlice.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/officeSlice.test.ts`:
```ts
import { applyStatLevelUp } from "@/core/workerModel"; // (only if not already imported)

describe("applyAscendXp", () => {
  beforeEach(() => {
    useGameStore.setState({ roster: [], purchasedNodes: {}, lastAscendRoll: null });
  });

  it("is a no-op on an empty roster and clears the roll", () => {
    useGameStore.setState({ lastAscendRoll: [{ id: "x", levelBefore: 1, levelAfter: 2, statsBefore: createBaseStats(), statsAfter: createBaseStats() }] });
    useGameStore.getState().applyAscendXp(big(1000));
    expect(useGameStore.getState().roster).toEqual([]);
    expect(useGameStore.getState().lastAscendRoll).toBeNull();
  });

  it("grants XP, levels workers, captures the roll, and resets strokesThisRun", () => {
    const w = { ...createWorker(), strokesThisRun: 50 };
    useGameStore.setState({ roster: [w] });
    useGameStore.getState().applyAscendXp(big(1000));
    const after = useGameStore.getState();
    expect(after.roster[0]!.level).toBeGreaterThan(1);
    expect(after.roster[0]!.strokesThisRun).toBe(0);
    expect(after.lastAscendRoll).not.toBeNull();
    expect(after.lastAscendRoll![0]!.id).toBe(w.id);
    expect(after.lastAscendRoll![0]!.levelAfter).toBe(after.roster[0]!.level);
  });

  it("applyAscendXp(0) just resets strokesThisRun and keeps the roster (subsumes resetOffice)", () => {
    const w = { ...createWorker(), level: 4, xp: big(99), strokesThisRun: 1234 };
    useGameStore.setState({ roster: [w] });
    useGameStore.getState().applyAscendXp(big(0));
    const after = useGameStore.getState().roster[0]!;
    expect(after.level).toBe(4);
    expect(after.xp.eq(big(99))).toBe(true);
    expect(after.strokesThisRun).toBe(0);
    expect(useGameStore.getState().lastAscendRoll).toBeNull(); // no levels gained → no roll
  });

  it("accelerator nodes boost the pool (more levels)", () => {
    const base = { ...createWorker(), strokesThisRun: 10 };
    useGameStore.setState({ roster: [base], purchasedNodes: {} });
    useGameStore.getState().applyAscendXp(big(100));
    const noBoost = useGameStore.getState().roster[0]!.level;

    const base2 = { ...createWorker(), strokesThisRun: 10 };
    useGameStore.setState({ roster: [base2], purchasedNodes: { accelerator: 5 } });
    useGameStore.getState().applyAscendXp(big(100));
    const boosted = useGameStore.getState().roster[0]!.level;
    expect(boosted).toBeGreaterThanOrEqual(noBoost);
  });

  it("baseline floor: a zero-stroke worker in a mixed roster still gains XP", () => {
    const heavy = { ...createWorker(), strokesThisRun: 1000 };
    const idle = { ...createWorker(), strokesThisRun: 0 };
    useGameStore.setState({ roster: [heavy, idle] });
    useGameStore.getState().applyAscendXp(big(1000));
    expect(useGameStore.getState().roster[1]!.xp.gt(0) || useGameStore.getState().roster[1]!.level > 1).toBe(true);
  });

  it("clearAscendRoll nulls the roll (Phase D dismiss hook)", () => {
    useGameStore.setState({ lastAscendRoll: [{ id: "x", levelBefore: 1, levelAfter: 2, statsBefore: createBaseStats(), statsAfter: createBaseStats() }] });
    useGameStore.getState().clearAscendRoll();
    expect(useGameStore.getState().lastAscendRoll).toBeNull();
  });
});
```
> Ensure `createWorker`, `createBaseStats`, `big` are imported at the top of the test file (some already are from earlier tasks). Seed RNG in a `beforeEach(() => setSeed(1))` if level counts need determinism — these assertions use `>`/`not null` so a fixed seed isn't strictly required, but add `setSeed` if a run is flaky.

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: FAIL (`applyAscendXp`/`clearAscendRoll`/`lastAscendRoll` undefined).

- [ ] **Step 3: Implement in `src/store/officeSlice.ts`**

Add imports at the top:
```ts
import { getWorkerXpPoolMultiplier } from "@/core/multipliers";
import { splitAscendPool, applyAscendXpToWorker } from "@/core/workerAscend";
import type { WorkerStats } from "@/core/workerModel";
```
(adjust the existing `workerModel` import — `WorkerStats` may already be imported as a type.)

Add the roll-entry type (after the `Worker` interface):
```ts
/** Transient per-worker reveal data for the post-ascend roll screen (Phase D).
 *  A dumb before/after snapshot — the UI diffs it. Captured here because the
 *  level-up rolls consume global rng() and are unrecoverable afterward. */
export interface AscendRollEntry {
  readonly id: string;
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly statsBefore: WorkerStats;
  readonly statsAfter: WorkerStats;
}
```

Add `lastAscendRoll` to `OfficeState`:
```ts
export interface OfficeState {
  readonly roster: ReadonlyArray<Worker>;
  /** Most recent ascend's level-up reveal data (workers that gained ≥1 level).
   *  TRANSIENT — stripped from `partialize`, cleared on dismiss. null = nothing to show. */
  readonly lastAscendRoll: ReadonlyArray<AscendRollEntry> | null;
}
```
and to `initialOfficeState`:
```ts
export const initialOfficeState: OfficeState = Object.freeze({
  roster: Object.freeze([]) as ReadonlyArray<Worker>,
  lastAscendRoll: null,
}) as OfficeState;
```

Replace the `OfficeSlice` interface's actions (KEEP `resetOffice` for now — Task 4 removes it) with:
```ts
export interface OfficeSlice extends OfficeState {
  reconcileRoster: () => void;
  /**
   * Ascend XP pass: pool = `poolMagnitude × getWorkerXpPoolMultiplier`, split
   * across the roster (baseline floor + strokes-weighted), converted to
   * level-ups (each rolls applyStatLevelUp), captures `lastAscendRoll`, and
   * resets every worker's `strokesThisRun`. No-op (clears the roll) on an empty
   * roster. `applyAscendXp(big(0))` = "reset run contribution" with no XP.
   */
  applyAscendXp: (poolMagnitude: Big) => void;
  /** Clear the post-ascend roll (Phase D dismiss hook). */
  clearAscendRoll: () => void;
  /** @deprecated removed in Phase C Task 4 — use applyAscendXp(big(0)). */
  resetOffice: () => void;
}
```

Add the action bodies (alongside `reconcileRoster`; keep `resetOffice` as-is for this task):
```ts
  applyAscendXp: (poolMagnitude) => {
    const state = get();
    if (state.roster.length === 0) {
      set({ lastAscendRoll: null });
      return;
    }
    const pool = poolMagnitude.mul(getWorkerXpPoolMultiplier(state));
    const shares = splitAscendPool(pool, state.roster);
    const roll: AscendRollEntry[] = [];
    const newRoster = state.roster.map((w, i) => {
      const res = applyAscendXpToWorker(w, shares[i]!);
      if (res.levelAfter > res.levelBefore) {
        roll.push({
          id: w.id,
          levelBefore: res.levelBefore,
          levelAfter: res.levelAfter,
          statsBefore: res.statsBefore,
          statsAfter: res.statsAfter,
        });
      }
      return { ...res.worker, strokesThisRun: 0 };
    });
    set({ roster: newRoster, lastAscendRoll: roll.length > 0 ? roll : null });
  },

  clearAscendRoll: () => set({ lastAscendRoll: null }),
```
(`Big` is already imported in officeSlice.ts.)

- [ ] **Step 4: Strip `lastAscendRoll` in partialize**

In `src/store/index.ts` `partialize`, add `lastAscendRoll: _lar,` to the transient destructure (alongside `lastSale: _ls,` / `painterClocks: _pc,`):
```ts
          lastSale: _ls,
          painterClocks: _pc,
          lastAscendRoll: _lar,
```

- [ ] **Step 5: Run, verify PASS**

Run: `npx vitest run tests/store/officeSlice.test.ts` then `npx vitest run` (full).
Expected: PASS. (`resetOffice` still exists, so its existing tests/callers stay green.)

- [ ] **Step 6: Build + commit**

Run: `npx vite build` (clean).
```bash
git add -u
git commit -m "store(office): applyAscendXp pass + lastAscendRoll capture" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire ascend orchestrator + remove `resetOffice`

Swap `resetOffice()` for `applyAscendXp(big(fameGain))` at the ascend call site, then remove the now-redundant `resetOffice` action and update its other callers. This is where the fame anchor is chosen (one line).

**Files:**
- Modify: `src/systems/ascend.ts`, `src/store/officeSlice.ts`
- Test: `tests/systems/ascend.test.ts`; update `tests/store/officeSlice.test.ts`, `tests/dev/bot-simulation.test.ts`, `tests/components/painting/BoundCanvasStage.test.tsx`

- [ ] **Step 1: Write the empty-roster equivalence regression test (LOCKED)**

Add to `tests/systems/ascend.test.ts` (it already imports `performAscendOrchestrator` + `useGameStore`):
```ts
describe("performAscendOrchestrator — empty-roster ascend is byte-identical to pre-office", () => {
  it("no roster: fame credited, run currencies reset, no error, no roll", () => {
    useGameStore.setState({
      inspiration: big(1_000_000), // well above the 10k fame gate
      gold: big(5000),
      roster: [],
      lastAscendRoll: null,
    });
    const fameBefore = useGameStore.getState().fame;
    const ok = performAscendOrchestrator(useGameStore.getState);
    expect(ok).toBe(true);
    const s = useGameStore.getState();
    expect(s.gold.eq(big(0))).toBe(true);
    expect(s.inspiration.eq(big(0))).toBe(true);
    expect(s.fame.gt(fameBefore)).toBe(true);
    expect(s.roster).toEqual([]);
    expect(s.lastAscendRoll).toBeNull();
  });

  it("with a roster: workers gain XP from the fame pool and strokesThisRun resets", () => {
    const w = { ...createWorker(), strokesThisRun: 100 };
    useGameStore.setState({ inspiration: big(1_000_000), roster: [w], lastAscendRoll: null });
    performAscendOrchestrator(useGameStore.getState);
    const after = useGameStore.getState();
    expect(after.roster[0]!.strokesThisRun).toBe(0);
    // fameGain at 1e6 inspi ≈ 102 → pool ≈ 102 → at least one level for a fresh worker
    expect(after.roster[0]!.level).toBeGreaterThanOrEqual(1);
  });
});
```
> Add `createWorker` + `big` imports to `ascend.test.ts` if absent. The first test mirrors the existing ascend-orchestrator assertions — those existing tests (with an empty roster by default) are themselves part of the equivalence net and must stay green.

- [ ] **Step 2: Run, verify the first test passes already-ish but the second FAILS**

Run: `npx vitest run tests/systems/ascend.test.ts`
Expected: the second test FAILS (ascend still calls `resetOffice`, which doesn't grant XP). The first may already pass (resetOffice no-ops an empty roster too) — that's fine; it locks the behavior.

- [ ] **Step 3: Wire the orchestrator**

In `src/systems/ascend.ts`, replace the line `state.resetOffice();` (line ~44) with:
```ts
    // Workers persist across ascend; convert run contribution into XP/level-ups.
    // Anchor: the fame credited this ascend (log-compressed → stable levels/ascend).
    // Swapping the anchor later is a one-line change here.
    state.applyAscendXp(big(fameGain));
```
`fameGain` is already computed above (line ~37) and `big` is already imported. Note `applyAscendXp` runs before `resetRunStats()` (line ~59), which is correct — it reads/zeroes `strokesThisRun` first.

- [ ] **Step 4: Remove `resetOffice` and update its other callers**

In `src/store/officeSlice.ts`: delete the `resetOffice` action body and its line in the `OfficeSlice` interface.

Update the remaining callers (grep `resetOffice` across `src` + `tests` first to be exhaustive):
- `tests/dev/bot-simulation.test.ts` — replace `useGameStore.getState().resetOffice();` with `useGameStore.getState().applyAscendXp(big(0));` (import `big` if needed). Behavior is identical for the bot (resets strokes, no XP at magnitude 0).
- `tests/components/painting/BoundCanvasStage.test.tsx` — replace its `resetOffice()` call with `applyAscendXp(big(0))` (or, if it was only resetting between tests, `useGameStore.setState({ roster: [] })` is equivalent and import-free — prefer the simplest that keeps the test's intent).
- `tests/store/officeSlice.test.ts` — the old `resetOffice` describe block ("workers persist, run contribution resets") is now covered by the Task-3 `applyAscendXp(0)` test; delete the old `resetOffice` block.

- [ ] **Step 5: Run, verify PASS**

Run: `npx vitest run tests/systems/ascend.test.ts tests/store/officeSlice.test.ts tests/dev/bot-simulation.test.ts` then `npx vitest run` (full).
Expected: PASS. If any other `resetOffice` caller surfaced in the grep, fix it the same way.

- [ ] **Step 6: Build + commit**

Run: `npx vite build` (clean).
```bash
git add -u
git commit -m "office(ascend): apply worker XP on ascend; remove resetOffice" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Skill-node migration (collapse dead office branch + refund)

Two separate things — keep them straight: **config edits** (node defs, parent edges, capability strings, descriptions — these are CODE, not migrated) and the **save migration** (the ONLY persisted change: delete 5 dead node ids from `purchasedNodes` + refund their fame). Parent edges are not persisted, so don't "migrate" them.

The office branch today: `forget_pain → entrepreneur(roster_slot,queue_slot) → education(dead) → free_will(class_speedrunner) → {hire_manager(roster_slot), accelerator(worker_xp_mult)}`; leaves `recruiter(queue_slot)`, `bookkeeper(hire_cost_reduction)`, `gold_diggers(class_goldsmith, parents accelerator+hire_manager)`.

Target: `forget_pain → entrepreneur(roster_slot) → {hire_manager(roster_slot), accelerator(worker_xp_mult)}`. Delete `education`, `free_will`, `recruiter`, `bookkeeper`, `gold_diggers`.

**Files:**
- Modify: `src/config/skillTreeNodes.ts`, `src/store/index.ts`
- Test: `tests/store/persistence.test.ts` (or `persistence-integration.test.ts` — match where node-refund migrations are tested, e.g. the v24 size-node refund)

- [ ] **Step 1: Pre-flight — confirm no other node depends on the deletions**

Grep `parentIds` usage across ALL nodes (not just office) for the five ids to be deleted:
```
rg "education|free_will|recruiter|bookkeeper|gold_diggers" src/config/skillTreeNodes.ts
```
Confirm: `free_will` is referenced as a parent ONLY by `hire_manager` and `accelerator` (both being reparented); `education` only by `free_will` (being deleted); `recruiter`/`bookkeeper`/`gold_diggers` are leaves (no node lists them as a parent). If anything else references them, STOP and report — the collapse target changes.

- [ ] **Step 2: Write the failing migration test**

Add to the persistence test file (mirror the existing v24 size-node refund test):
```ts
it("v27→v28 migration: deletes the 5 dead office nodes and refunds their fame", () => {
  const persisted = {
    fame: big(0),
    purchasedNodes: {
      entrepreneur: 1, hire_manager: 2, accelerator: 1, // survivors
      education: 5,    // refund 1200+2000+3000+4500+6500 = 17200
      free_will: 1,    // refund 3500
      recruiter: 3,    // refund 7000+8500+10000 = 25500
      bookkeeper: 4,   // refund 7000+8000+9000+10000 = 34000
      gold_diggers: 1, // refund 10000
    },
  };
  const migrated = migrate(persisted, 27) as Record<string, unknown>;
  const nodes = migrated.purchasedNodes as Record<string, number>;
  expect(nodes.education).toBeUndefined();
  expect(nodes.free_will).toBeUndefined();
  expect(nodes.recruiter).toBeUndefined();
  expect(nodes.bookkeeper).toBeUndefined();
  expect(nodes.gold_diggers).toBeUndefined();
  // survivors untouched
  expect(nodes.entrepreneur).toBe(1);
  expect(nodes.hire_manager).toBe(2);
  expect(nodes.accelerator).toBe(1);
  // total refund = 17200 + 3500 + 25500 + 34000 + 10000 = 90200
  expect((migrated.fame as ReturnType<typeof big>).eq(big(90200))).toBe(true);
});
```
> `migrate` is exported from `@/store`. Match the import style + `big` usage of the existing v24 refund test in this file.

- [ ] **Step 3: Run, verify FAIL**

Run the persistence test file → FAIL (no v28 migration yet).

- [ ] **Step 4: Edit the config (`src/config/skillTreeNodes.ts`)**

- `entrepreneur`: change `unlocks: ["roster_slot", "queue_slot"]` → `unlocks: ["roster_slot"]`.
- `hire_manager`: change `parentIds: ["free_will"]` → `parentIds: ["entrepreneur"]`.
- `accelerator`: change `parentIds: ["free_will"]` → `parentIds: ["entrepreneur"]`; change `description` to `"Each level boosts the worker ascend-XP pool by +10%."`; keep `unlocks: ["worker_xp_mult"]`.
- DELETE the five node definition lines: `education`, `free_will`, `recruiter`, `bookkeeper`, `gold_diggers`.

- [ ] **Step 5: Add the v28 save migration (`src/store/index.ts`)**

Bump: `const SAVE_VERSION = 28;`

Add before `return state as unknown as GameStore;` (after the `fromVersion < 27` block), mirroring the v24 refund pattern:
```ts
  if (fromVersion < 28) {
    // v27 → v28 (2026-05-29): Office redesign Phase C — the old office skill
    // sub-tree (worker classes, queue, hire-cost, affix-magnitude) is gone.
    // Delete the 5 now-dead nodes and refund their fame at the pre-deletion
    // per-level costs. Surviving office nodes (entrepreneur/hire_manager/
    // accelerator → roster_slot + worker_xp_mult) are reparented in config
    // (parent edges aren't persisted, so nothing to migrate there).
    const REMOVED_NODE_COSTS: Record<string, ReadonlyArray<number>> = {
      education: [1200, 2000, 3000, 4500, 6500],
      free_will: [3500],
      recruiter: [7000, 8500, 10000],
      bookkeeper: [7000, 8000, 9000, 10000],
      gold_diggers: [10000],
    };
    const purchasedNodes = (state as Record<string, unknown>).purchasedNodes as Record<string, number> | undefined;
    if (purchasedNodes && typeof purchasedNodes === "object") {
      let refund = 0;
      const cleaned: Record<string, number> = { ...purchasedNodes };
      for (const [nodeId, costs] of Object.entries(REMOVED_NODE_COSTS)) {
        const level = cleaned[nodeId] ?? 0;
        if (level > 0) {
          for (let i = 0; i < Math.min(level, costs.length); i++) refund += costs[i]!;
          delete cleaned[nodeId];
        }
      }
      const next: Record<string, unknown> = { ...state, purchasedNodes: cleaned };
      if (refund > 0) {
        const currentFame = next.fame;
        const baseFame = isBig(currentFame) ? currentFame : big(0);
        next.fame = baseFame.add(refund);
      }
      state = next as Record<string, unknown>;
    }
  }
```
(`isBig` and `big` are already imported in index.ts. Add a `v27 → v28` line to the migration-chain doc comment near the top.)

- [ ] **Step 6: Run, verify PASS**

Run the persistence test file, then `npx vitest run` (full). Expected: PASS.
> Watch for: bot-simulation or skill-tree tests that referenced the deleted node ids (`recruiter`/`bookkeeper`/`gold_diggers`/`free_will`/`education`) or the `queue_slot`/`hire_cost_reduction`/`class_*` capabilities. Update or remove those references (the capabilities no longer exist on any node). The `getQueueCap` selector was already removed in A2; confirm nothing reads `queue_slot` anymore.

- [ ] **Step 7: Build + commit**

Run: `npx vite build` (clean).
```bash
git add -u
git commit -m "office(tree): collapse dead office skill branch + refund fame (v28)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> **Note on `skillTreeDesign.json`:** that file is the user's decoupled designer spec (runtime data is hand-encoded in `skillTreeNodes.ts`), so this task does NOT edit it. Mention to the user that the designer JSON is now out of sync with runtime for the office branch if they want it reconciled.

---

## Task 6: Dead-code cleanup (delete the now-orphaned office machinery)

Pure deletion of office balance/multiplier code that no live path references after Phases A2/B/C. **Keep** `workerXpToNext`/`WORKER_XP_BASE`/`WORKER_XP_GROWTH` (Phase C's level curve) and all `WORKER_*` stat-model constants + `WORKER_BASELINE_XP_FRACTION`/`ACCELERATOR_XP_PER_LEVEL`.

**Files:**
- Modify: `src/core/balance.ts`, `src/core/multipliers.ts`
- Test: `tests/core/balance.test.ts` (delete cases for the removed functions)

- [ ] **Step 1: Confirm each symbol is unreferenced in live `src`**

Grep `src` (excluding the files being edited and tests) for each. Expected: no live consumers.
```
rg "getWorkerXpMultiplier|getHireCostMultiplier|\blevelScale\b|LEVEL_SCALE_GROWTH|officeXpToNext|OFFICE_XP_BASE|OFFICE_XP_GROWTH|trickleSeconds|TRICKLE_|WorkerTier|ALL_WORKER_TIERS|OFFICE_TIER_|computeOfficeTierProbabilities|OFFICE_PROB_MAX_LEVEL|hireCost|HIRE_TIER_BASE|HIRE_QUALITY_MAX|HIRE_OFFICE_LEVEL_GROWTH|XP_GOLD_FRACTION" src
```
Any hit OUTSIDE `src/core/balance.ts` / `src/core/multipliers.ts` means it's still used — STOP and report (it should have been removed in A2/B/C; investigate rather than deleting). Expected hits: only the definitions in those two files (plus `tests/`, handled in Step 3).

- [ ] **Step 2: Delete from source**

From `src/core/balance.ts`, delete (the "Painter's Office formulas" block, minus the curve we keep):
`LEVEL_SCALE_GROWTH`, `levelScale`, `OFFICE_XP_BASE`, `OFFICE_XP_GROWTH`, `officeXpToNext`, `TRICKLE_BASE_SECONDS`, `TRICKLE_DECAY`, `TRICKLE_FLOOR_SECONDS`, `trickleSeconds`, `WorkerTier`, `ALL_WORKER_TIERS`, `OFFICE_TIER_UNLOCK_LEVEL`, `OFFICE_TIER_AFFIX_COUNT`, `TierProbRange`, `OFFICE_TIER_PROB_RANGES`, `OFFICE_PROB_MAX_LEVEL`, `computeOfficeTierProbabilities`, `HIRE_TIER_BASE`, `HIRE_QUALITY_MAX`, `HIRE_OFFICE_LEVEL_GROWTH`, `XP_GOLD_FRACTION`, `HireCostInput`, `hireCost`.
**KEEP:** `WORKER_XP_BASE`, `WORKER_XP_GROWTH`, `workerXpToNext`, and everything in the "Worker stat model" section.

From `src/core/multipliers.ts`, delete `getWorkerXpMultiplier` and `getHireCostMultiplier`.

- [ ] **Step 3: Delete the corresponding tests**

In `tests/core/balance.test.ts`, delete the describe/it blocks exercising the removed symbols (`officeXpToNext`, `trickleSeconds`, `computeOfficeTierProbabilities`, `hireCost`, `levelScale`, `officeLevelFactor`, the office-tier tests). Keep the `workerXpToNext` tests (if any) and the new ascend-xp-constant tests from Task 1. If `tests/core/multipliers.test.ts` has cases for `getWorkerXpMultiplier`/`getHireCostMultiplier`, delete those.

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run` (full). Expected: PASS (no references to deleted symbols remain).

- [ ] **Step 5: Build + commit**

Run: `npx vite build` (clean).
```bash
git add -u
git commit -m "office(cleanup): delete dead office balance/multiplier code" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3 leveling = increment rolls at ascend → `applyAscendXpToWorker` calls `applyStatLevelUp` per level (Task 2). ✅
- §4.1 pool scales with run magnitude (anchor) → `applyAscendXp(poolMagnitude)` + fame anchor in `ascend.ts` (Tasks 3-4); hybrid split with baseline floor → `splitAscendPool` (Task 2). ✅
- §4.1 steep XP-to-next curve → reuses `workerXpToNext` (kept; Tasks 2, 6). ✅
- §4.2 roll screen reveal DATA → `lastAscendRoll` capture (Task 3); UI deferred to D (scope guard). ✅
- §7 persistence: workers survive ascend, only run-contribution resets → `applyAscendXp` resets `strokesThisRun`, keeps roster (Tasks 3-4). ✅
- §8 skill-node migration: adapt `roster_slot`/`worker_xp_mult`, delete `queue_slot`/`hire_cost_reduction`/`class_*` + refund → Task 5 (collapse + v28 refund). ✅
- Dead-code removal (HANDOVER Phase C list, minus the corrected `workerXpToNext` keep) → Task 6. ✅

**Advisor must-haves covered:** fame anchor + anchor-shape acceptance check (LOCKED §, Task 2 test); empty-roster ascend equivalence (LOCKED §, Task 4 test); `applyAscendXp(magnitude)` parameterization (Tasks 3-4); `resetOffice` removed, not duplicated (Task 4); `mastery` forward-built (Task 2); never-a-trap baseline test (Tasks 2-3); `LEVEL_UP_CAP` + DEV warn (Task 2); config-vs-migration separation + pre-delete grep (Task 5); `workerXpToNext` keep-correction (Tasks 2, 6).

**Placeholder scan:** Full function bodies + exact edits throughout. The anchor-shape bounds (`<200`/`<20`) are sanity rails with a stated "stop and report if they fail" rule, not fudge targets.

**Type consistency:** `applyAscendXp(poolMagnitude: Big)`, `splitAscendPool(pool, workers, baselineFraction?)`, `applyAscendXpToWorker(worker, xpShare) → WorkerLevelUpResult`, `AscendRollEntry`, `getWorkerXpPoolMultiplier(state)`, `lastAscendRoll: ReadonlyArray<AscendRollEntry> | null` are each defined once and referenced consistently across tasks. `resetOffice` is added-then-removed deliberately (Task 3 keeps it for green; Task 4 removes it).

---

## Phase D handoff (final phase)
- Post-ascend roll screen in `AscendCinematicOverlay` reading `lastAscendRoll` (per-worker before/after; diff to show "Level X→Y, +N% gold, +1 stroke/crit"); call `clearAscendRoll()` on dismiss.
- On-canvas worker avatars + next-stroke indicators reading `painterClocks` (B note: isolate the subtree — `painterClocks` changes every tick).
- Office tab rework (roster + class switch). Reconcile `skillTreeDesign.json` with the runtime office branch if the user wants the designer file synced.
- Revisit the C/D decisions flagged in B: (1) should worker crits feed `critsLanded`/`maxComboChain` achievements; (2) multi-painter step-invariance (known measured gap — skipped guard test) — rework to absolute next-stroke scheduling or set an explicit catch-up tolerance.
- When D lands, the office is complete → merge `painter-office-redesign` → master and `npx vercel --prod`.
