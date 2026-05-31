import type { GameStore } from "@/store";
import type { StoreApi } from "zustand";
import { big } from "@/core/bigNumber";
import { fameOnAscend } from "@/core/balance";
import { getAscendThresholdReduction, getAscendFameMultiplier } from "@/core/multipliers";
import { getSchoolBonus } from "@/core/schoolMultipliers";

/**
 * True iff the current inspiration would yield at least 1 fame. Below
 * 10^FAME_THRESHOLD_LOG10 (10,000 inspi) the curve returns 0, so the
 * ascend button is gated until the player crosses that threshold.
 * The threshold is reduced by `getAscendThresholdReduction(state)` from
 * the `ascend_threshold_reduction` capability.
 */
export const canAscend = (state: Pick<GameStore, "inspiration" | "purchasedNodes">): boolean =>
  fameOnAscend(state.inspiration, getAscendThresholdReduction(state)) >= 1;

/**
 * Final fame credited on ascend — the single source of truth shared by the
 * orchestrator and the AscensionRoute preview (so the displayed gain and the
 * worker-XP preview always match what's actually awarded).
 *
 * `floor( fameOnAscend(inspi, thresholdReduction) × (1 + school "+% Fame gain") × Royalties )`.
 */
export const computeAscendFameGain = (
  state: Pick<GameStore, "inspiration" | "purchasedNodes" | "completedResearches" | "completedAchievements">,
): number => {
  const raw = fameOnAscend(state.inspiration, getAscendThresholdReduction(state));
  return Math.floor(raw * (1 + getSchoolBonus(state, "+% Fame gain")) * getAscendFameMultiplier(state));
};

/**
 * Atomic ascend orchestrator. Returns true on success; false if canAscend is false.
 * On success:
 *   1. Captures fameGain = fameOnAscend(inspiration BEFORE reset).
 *   2. Resets: gold, inspiration, tree, canvas, workshop (inventory + equipped).
 *   3. Adds fameGain to fame.
 *   4. Increments ascendCount.
 *
 * Preserved (NOT touched): fame (existing balance + new gain), ascendCount (incremented),
 * purchasedNodes, playerId, save schema version.
 */
export const performAscendOrchestrator = (
  get: StoreApi<GameStore>["getState"],
): boolean => {
  const state = get();
  if (!canAscend(state)) return false;

  // 1. Capture fame gain BEFORE inspiration is reset.
  const fameGain = computeAscendFameGain(state);

  // 2. Reset run state via existing slice actions.
  state.resetRunCurrencies(); // gold + inspiration → 0; fame preserved
  state.resetTree();
  state.resetCanvas();
  state.resetWorkshop();
  // Workers persist across ascend; convert run contribution into XP/level-ups.
  // Anchor: the fame credited this ascend (log-compressed → stable levels/ascend).
  // Swapping the anchor later is a one-line change here.
  state.applyAscendXp(big(fameGain));

  // 3. Credit fame (after reset; fame survived resetRunCurrencies).
  if (fameGain > 0) {
    state.add("fame", big(fameGain));
  }

  // 4. Bump ascendCount.
  state.incrementAscendCount();

  // 5. Append to past-runs ledger.
  state.addPastRun({ fame: fameGain, ascendedAt: Date.now() });

  // 6. Reset run stats and evaluate ascension achievements.
  // Reset run stats for the new run.
  state.resetRunStats();
  // Evaluate achievements for ascension-milestone conditions.
  // Must happen AFTER incrementAscendCount so lifetime.ascensions alias is current.
  state.evaluateAchievements();

  return true;
};
