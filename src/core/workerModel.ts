import { rngPick } from "@/core/rng";
import {
  WORKER_BASE_STATS, WORKER_PCT_INCREMENTS, WORKER_STROKES_PER_CRIT_INCREMENTS, WORKER_CRIT_CHANCE_CAP,
  FOOD_REGULATION_PCT_STEP, FOOD_REGULATION_STROKES_STEP, ROBIN_HOOD_GOLDPCT_PER_LEVEL, BLURY_HAND_SPEED_PER_LEVEL,
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
 * Office skill-node bonuses that raise a worker's SPAWN base stats. Each field
 * is a purchased-node level count (see officeSlice.getWorkerSpawnBonuses).
 */
export interface WorkerSpawnBonuses {
  /** food_regulation level (0/1): +1 native step to every base stat. */
  foodRegulation: number;
  /** robin_hood level (0..5): +7% goldPct base each. */
  robinHoodLevels: number;
  /** blury_hand level (0..1): +10% speed base each. */
  bluryHandLevels: number;
}

export const NO_SPAWN_BONUSES: WorkerSpawnBonuses = Object.freeze({
  foodRegulation: 0,
  robinHoodLevels: 0,
  bluryHandLevels: 0,
});

/**
 * A fresh level-1 worker's spawn stats with Office skill-node base-stat bonuses
 * applied on top of WORKER_BASE_STATS. Pure — the caller supplies the bonus
 * counts read from the fame tree. critChance stays clamped at its cap.
 */
export const createSpawnStats = (bonuses: WorkerSpawnBonuses = NO_SPAWN_BONUSES): WorkerStats => {
  const food = bonuses.foodRegulation * FOOD_REGULATION_PCT_STEP;
  return {
    goldPct: WORKER_BASE_STATS.goldPct + food + bonuses.robinHoodLevels * ROBIN_HOOD_GOLDPCT_PER_LEVEL,
    speed: WORKER_BASE_STATS.speed + food + bonuses.bluryHandLevels * BLURY_HAND_SPEED_PER_LEVEL,
    critChance: Math.min(WORKER_CRIT_CHANCE_CAP, WORKER_BASE_STATS.critChance + food),
    strokesPerCrit: WORKER_BASE_STATS.strokesPerCrit + bonuses.foodRegulation * FOOD_REGULATION_STROKES_STEP,
    comboChance: WORKER_BASE_STATS.comboChance + food,
  };
};

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
