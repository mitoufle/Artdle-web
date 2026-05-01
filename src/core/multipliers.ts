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
 * Paint-speed multiplier — `effectivePaintTime = PAINT_TIME_BASE_SECONDS / multiplier`.
 * Higher = faster. Phase 2: returns 1.
 *
 * Convention here is the same as the other two functions (`1 + Σ contributions`),
 * but contributions are paint-SPEED deltas, NOT paint-time reductions.
 * Phase 3 must convert the `-paint_time%` affix at read-time:
 *   affix value `v` ("paint time reduced by v") → contribute `v / (1 - v)`
 *   (so 10% reduction → +0.111 contribution → multiplier = 1.111 → time = base / 1.111 ≈ 0.9 * base).
 */
export const getPaintTimeMultiplier = (_state: GameStore): number => 1;
