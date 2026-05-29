import { rngPick } from "@/core/rng";
import {
  WORKER_BASE_STATS, WORKER_PCT_INCREMENTS, WORKER_STROKES_PER_CRIT_INCREMENTS, WORKER_CRIT_CHANCE_CAP,
} from "@/core/balance";

/** The five stats of a redesigned worker. See office painter-redesign spec §2.1. */
export interface WorkerStats {
  goldPct: number;        // gold multiplier = 1 + goldPct
  speed: number;          // stroke interval = BASE_CHUNK_INTERVAL / speed
  critChance: number;     // per-stroke crit prob, capped at WORKER_CRIT_CHANCE_CAP
  strokesPerCrit: number; // integer bonus chunks per crit
  comboChance: number;    // combo prob when this worker completes a sale
}

/** A fresh level-1 worker's stats (mutable copy of the frozen base). */
export const createBaseStats = (): WorkerStats => ({ ...WORKER_BASE_STATS });

/**
 * Apply ONE level-up's growth: roll a random increment per stat.
 * Fractional stats roll +0..+5pp; strokes-per-crit rolls +0/+1; crit clamped at cap.
 * `classId` is a forward-compat hook for class-biased rolls (deferred); "base" rolls uniformly.
 */
export const applyStatLevelUp = (stats: WorkerStats, _classId: string = "base"): WorkerStats => ({
  goldPct: stats.goldPct + rngPick(WORKER_PCT_INCREMENTS),
  speed: stats.speed + rngPick(WORKER_PCT_INCREMENTS),
  critChance: Math.min(WORKER_CRIT_CHANCE_CAP, stats.critChance + rngPick(WORKER_PCT_INCREMENTS)),
  strokesPerCrit: stats.strokesPerCrit + rngPick(WORKER_STROKES_PER_CRIT_INCREMENTS),
  comboChance: stats.comboChance + rngPick(WORKER_PCT_INCREMENTS),
});
