import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

/**
 * Paint Mastery + lifetime-spanning currency totals. None of these reset on ascend.
 *
 * Persisted fields:
 *   - `paintMastery: Big` — accumulator. Multiplies canvas gold via pmMult().
 *   - `lifetimeGold: Big` — cumulative canvas gold ever earned. Used by
 *      achievement conditions (`lifetime.goldgain`).
 *   - `lifetimeInspiration: Big` — cumulative inspiration ever produced (tree
 *      tick + skill-tree poke). Used by achievement conditions
 *      (`lifetime.inspirationgain`).
 *
 * `trackSaleGold` is called from `canvasSlice.canvasTick` after each successful
 * sale. `trackInspirationGain` is called from `treeSlice.treeTick` and
 * `skillTreeSlice.skillTreeTick` after each inspiration credit. PM itself is
 * granted exclusively via `addPaintMastery` (called by the achievement engine
 * for `paint_mastery_flat` effects).
 */
export interface PaintMasteryState {
  paintMastery: Big;
  lifetimeGold: Big;
  lifetimeInspiration: Big;
}

export interface PaintMasterySlice extends PaintMasteryState {
  /** Track gold earned for the lifetime alias used by achievement conditions. Does NOT grant PM. */
  trackSaleGold: (saleGold: Big) => void;
  /** Track inspiration earned for the lifetime alias used by achievement conditions. */
  trackInspirationGain: (amount: Big) => void;
  /** Credit PM directly — called by achievement engine for paint_mastery_flat effects. */
  addPaintMastery: (amount: Big) => void;
  /** Test/debug helper — overwrite the PM value. */
  _setPaintMastery: (value: Big) => void;
  /** Test/debug helper — overwrite the lifetimeGold value. */
  _setLifetimeGold: (value: Big) => void;
  /** Test/debug helper — overwrite the lifetimeInspiration value. */
  _setLifetimeInspiration: (value: Big) => void;
}

export const initialPaintMasteryState: PaintMasteryState = Object.freeze({
  paintMastery: big(0),
  lifetimeGold: big(0),
  lifetimeInspiration: big(0),
}) as PaintMasteryState;

export const createPaintMasterySlice: StateCreator<GameStore, [], [], PaintMasterySlice> = (
  set,
) => ({
  ...initialPaintMasteryState,

  trackSaleGold: (saleGold) => {
    set((s) => ({ lifetimeGold: s.lifetimeGold.add(saleGold) }));
  },

  trackInspirationGain: (amount) => {
    set((s) => ({ lifetimeInspiration: s.lifetimeInspiration.add(amount) }));
  },

  addPaintMastery: (amount) => {
    set((s) => ({ paintMastery: s.paintMastery.add(amount) }));
  },

  _setPaintMastery: (value) => set({ paintMastery: value }),
  _setLifetimeGold: (value) => set({ lifetimeGold: value }),
  _setLifetimeInspiration: (value) => set({ lifetimeInspiration: value }),
});
