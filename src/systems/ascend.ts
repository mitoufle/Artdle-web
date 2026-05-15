import type { GameStore } from "@/store";
import type { StoreApi } from "zustand";
import { big } from "@/core/bigNumber";
import { fameOnAscend } from "@/core/balance";
import { getAscendThresholdReduction } from "@/core/multipliers";

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
 * Atomic ascend orchestrator. Returns true on success; false if canAscend is false.
 * On success:
 *   1. Captures fameGain = fameOnAscend(inspiration BEFORE reset).
 *   2. Resets: gold, inspiration, tree, canvas, workshop (inventory + equipped).
 *   3. Adds fameGain to fame.
 *   4. Increments ascendCount.
 *
 * Preserved (NOT touched): fame (existing balance + new gain), ascendCount (incremented),
 * purchasedNodes, playerId, save schema version.
 *
 * Called by metaSlice.performAscend() (Task 7).
 */
export const performAscendOrchestrator = (
  set: StoreApi<GameStore>["setState"],
  get: StoreApi<GameStore>["getState"],
): boolean => {
  const state = get();
  if (!canAscend(state)) return false;

  // 1. Capture fame gain BEFORE inspiration is reset.
  const fameGain = fameOnAscend(state.inspiration, getAscendThresholdReduction(state));

  // 2. Reset run state via existing slice actions.
  state.resetRunCurrencies(); // gold + inspiration → 0; fame preserved
  state.resetTree();
  state.resetCanvas();
  state.resetWorkshop();
  state.resetOffice();

  // 3. Credit fame (after reset; fame survived resetRunCurrencies).
  if (fameGain > 0) {
    state.add("fame", big(fameGain));
  }

  // 4. Bump ascendCount.
  state.incrementAscendCount();

  // 5. Append to past-runs ledger (v2.0 Round 3).
  state.addPastRun({ fame: fameGain, ascendedAt: Date.now() });

  // `set` parameter retained for future cross-slice writes.
  void set;

  return true;
};
