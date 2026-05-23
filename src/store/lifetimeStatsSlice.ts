import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

/**
 * Lifetime-spanning currency totals. None of these reset on ascend.
 *
 * Persisted fields:
 *   - `lifetimeGold: Big` — cumulative canvas gold ever earned. Used by
 *      achievement conditions (`lifetime.goldgain`).
 *   - `lifetimeInspiration: Big` — cumulative inspiration ever produced (tree
 *      tick + skill-tree poke). Used by achievement conditions
 *      (`lifetime.inspirationgain`).
 *
 * `trackSaleGold` is called from `canvasSlice.canvasTick` after each successful
 * sale. `trackInspirationGain` is called from `treeSlice.treeTick` and
 * `skillTreeSlice.skillTreeTick` after each inspiration credit.
 */
export interface LifetimeStatsState {
  lifetimeGold: Big;
  lifetimeInspiration: Big;
}

export interface LifetimeStatsSlice extends LifetimeStatsState {
  /** Track gold earned for the lifetime alias used by achievement conditions. */
  trackSaleGold: (saleGold: Big) => void;
  /** Track inspiration earned for the lifetime alias used by achievement conditions. */
  trackInspirationGain: (amount: Big) => void;
  /** Test/debug helper — overwrite the lifetimeGold value. */
  _setLifetimeGold: (value: Big) => void;
  /** Test/debug helper — overwrite the lifetimeInspiration value. */
  _setLifetimeInspiration: (value: Big) => void;
}

export const initialLifetimeStatsState: LifetimeStatsState = Object.freeze({
  lifetimeGold: big(0),
  lifetimeInspiration: big(0),
}) as LifetimeStatsState;

export const createLifetimeStatsSlice: StateCreator<GameStore, [], [], LifetimeStatsSlice> = (
  set,
) => ({
  ...initialLifetimeStatsState,

  trackSaleGold: (saleGold) => {
    set((s) => ({ lifetimeGold: s.lifetimeGold.add(saleGold) }));
  },

  trackInspirationGain: (amount) => {
    set((s) => ({ lifetimeInspiration: s.lifetimeInspiration.add(amount) }));
  },

  _setLifetimeGold: (value) => set({ lifetimeGold: value }),
  _setLifetimeInspiration: (value) => set({ lifetimeInspiration: value }),
});
