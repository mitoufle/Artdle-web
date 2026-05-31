import { type Big } from "@/core/bigNumber";
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

/**
 * Count how many levels `worker` would gain from `xpShare` — WITHOUT rolling
 * stats or touching the RNG (unlike `applyAscendXpToWorker`). Pure arithmetic,
 * so the ascend screen can call it every render to preview level-ups without
 * desyncing the real ascend's stat rolls. Capped at `LEVEL_UP_CAP` like the
 * real pass.
 */
export function countWorkerLevelGains(worker: Worker, xpShare: Big): number {
  let level = worker.level;
  let xp = worker.xp.add(xpShare);
  let gained = 0;
  for (; gained < LEVEL_UP_CAP; gained++) {
    const cost = workerXpToNext(level);
    if (xp.lt(cost)) break;
    xp = xp.sub(cost);
    level += 1;
  }
  return gained;
}

/**
 * Total levels the whole roster would gain if `pool` XP were applied now.
 * Mirrors `applyAscendXp`'s split (baseline floor + stroke-share) but counts
 * levels only — no RNG, no mutation. Drives the ascend screen's worker-level
 * preview alongside the fame-gain preview.
 */
export function previewAscendLevelGains(pool: Big, workers: ReadonlyArray<Worker>): number {
  if (workers.length === 0) return 0;
  const shares = splitAscendPool(pool, workers);
  return workers.reduce((sum, w, i) => sum + countWorkerLevelGains(w, shares[i]!), 0);
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
