import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

/**
 * Paint Mastery — a permanent currency. Survives ascends.
 *
 * v1.1 redesign (2026-05-03): gain is gold-based, not tier-based.
 * PM is now granted exclusively via achievement rewards (`addPaintMastery`).
 * `trackSaleGold(saleGold)` is called from `canvasSlice.canvasTick` after each
 * successful sale to accumulate `lifetimeGold` for achievement condition checks.
 *
 * Two persisted fields:
 *   - `paintMastery: Big` — accumulator. Multiplies canvas gold via pmMult().
 *   - `lifetimeGold: Big` — cumulative canvas gold ever earned. Used by
 *      achievement conditions. Persists across ascends.
 *
 * Application: `pmMult(paintMastery)` from `core/balance.ts` returns a plain
 * number that callers compose multiplicatively with the existing additive
 * canvas-gold multiplier (see `multipliers.getPmMultiplier`).
 *
 * Reset semantics: NEITHER paintMastery NOR lifetimeGold is reset on ascend.
 * Both are permanent, lifetime-spanning state.
 */
export interface PaintMasteryState {
  paintMastery: Big;
  lifetimeGold: Big;
}

export interface PaintMasterySlice extends PaintMasteryState {
  /** Track gold earned for the lifetime alias used by achievement conditions. Does NOT grant PM. */
  trackSaleGold: (saleGold: Big) => void;
  /** Credit PM directly — called by achievement engine for paint_mastery_flat effects. */
  addPaintMastery: (amount: Big) => void;
  /** Test/debug helper — overwrite the PM value. */
  _setPaintMastery: (value: Big) => void;
  /** Test/debug helper — overwrite the lifetimeGold value. */
  _setLifetimeGold: (value: Big) => void;
}

export const initialPaintMasteryState: PaintMasteryState = Object.freeze({
  paintMastery: big(0),
  lifetimeGold: big(0),
}) as PaintMasteryState;

export const createPaintMasterySlice: StateCreator<GameStore, [], [], PaintMasterySlice> = (
  set,
) => ({
  ...initialPaintMasteryState,

  trackSaleGold: (saleGold) => {
    set((s) => ({ lifetimeGold: s.lifetimeGold.add(saleGold) }));
  },

  addPaintMastery: (amount) => {
    set((s) => ({ paintMastery: s.paintMastery.add(amount) }));
  },

  _setPaintMastery: (value) => set({ paintMastery: value }),
  _setLifetimeGold: (value) => set({ lifetimeGold: value }),
});
