import type { GameStore } from "@/store";

/**
 * Aggregate multiplier on inspiration accrual rate.
 * Phase 2: returns 1 (no contributors).
 * Phase 3 will read equipped-item affix `+inspiration_rate%` and skill node "Patient Eye".
 *
 * Convention: result is `1 + Σ contributions`, where each contribution is
 * an additive percentage (e.g., `+10%` = `0.10`).
 */
export const getInspiMultiplier = (_state: GameStore): number => 1;

/**
 * Aggregate multiplier on gold credited per canvas sale.
 * Phase 2: returns 1.
 * Phase 3 reads `+canvas_gold%` affix and skill node "Goldsmith".
 */
export const getCanvasGoldMultiplier = (_state: GameStore): number => 1;

/**
 * Paint-speed multiplier — divides PAINT_TIME_BASE_SECONDS to compute effective time.
 * Higher = faster. Phase 2: returns 1.
 * Phase 3 reads `-paint_time%` affix.
 */
export const getPaintTimeMultiplier = (_state: GameStore): number => 1;
