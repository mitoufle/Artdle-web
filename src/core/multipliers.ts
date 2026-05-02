import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";

/**
 * Aggregate multiplier on inspiration accrual rate.
 * Phase 3: reads `+inspiration_rate%` equipped item magnitudes + "Patient Eye" skill node.
 *
 * Convention: result is `1 + Σ contributions`, where each contribution is
 * an additive percentage (e.g., `+10%` = `0.10`).
 */
export const getInspiMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+inspiration_rate%");
  if (state.purchasedNodes.patient_eye) bonus += 0.15;
  return 1 + bonus;
};

/**
 * Aggregate multiplier on gold credited per canvas sale.
 * Phase 3: reads `+canvas_gold%` equipped items + "Goldsmith" skill node.
 */
export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+canvas_gold%");
  if (state.purchasedNodes.goldsmith) bonus += 0.10;
  return 1 + bonus;
};

/**
 * Paint-speed multiplier — `effectivePaintTime = PAINT_TIME_BASE_SECONDS / multiplier`.
 * Higher = faster.
 *
 * Convention here is the same as the other two functions (`1 + Σ contributions`),
 * but contributions are paint-SPEED deltas, NOT paint-time reductions.
 * Per-item conversion: an affix labeled `-paint_time% v` contributes `v/(1-v)`
 * to the speed multiplier. So 10% time-reduction → +0.111 contribution → multiplier
 * = 1.111 → effective time = base / 1.111 ≈ 0.9 * base.
 *
 * No skill node directly affects paint speed in v1.
 */
export const getPaintTimeMultiplier = (state: GameStore): number => {
  let bonus = 0;
  for (const item of state.equippedItems) {
    if (item.kind === "-paint_time%") {
      const v = item.magnitude / 100;
      bonus += v / (1 - v);
    }
  }
  return 1 + bonus;
};
