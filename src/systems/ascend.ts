import type { GameStore } from "@/store";
import type { StoreApi } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import { palierAscend, fameOnAscend } from "@/core/balance";

/**
 * Effective inspiration palier required to ascend at the given prior ascend count.
 * Faster Strokes (skill node) reduces by 10%.
 *
 * Lives here (not core/multipliers.ts) because it's a one-off domain-specific
 * reduction, not a tick-time multiplier following the `1 + Σ contributions` convention.
 */
export const getEffectivePalier = (state: GameStore, count: number): Big => {
  const base = palierAscend(count);
  const reduction = state.purchasedNodes.faster_strokes ? 0.10 : 0;
  return base.mul(1 - reduction);
};

/**
 * True iff the player has accumulated enough inspiration to ascend right now.
 * Pure function over GameStore — Phase 4 UI and tests call it directly.
 */
export const canAscend = (state: GameStore): boolean =>
  state.inspiration.gte(getEffectivePalier(state, state.ascendCount));

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
