import type { GameStore } from "@/store";
import type { StoreApi } from "zustand";
import { big } from "@/core/bigNumber";
import { fameOnAscend } from "@/core/balance";

/**
 * True iff the player can ascend right now. Always true — there is no
 * inspiration palier gate. The fame formula clamps to 1 minimum, so any
 * ascend yields at least one fame point. Players choose when to ascend
 * based on the fame curve and their willingness to lose run state.
 */
export const canAscend = (_state: GameStore): boolean => true;

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
  const fameGain = fameOnAscend(state.inspiration);

  // 2. Reset run state via existing slice actions.
  state.resetRunCurrencies(); // gold + inspiration → 0; fame preserved
  state.resetTree();
  state.resetCanvas();
  state.resetWorkshop();

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
