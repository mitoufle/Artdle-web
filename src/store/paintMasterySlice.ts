import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import { pmGainPerSale } from "@/core/balance";
import type { GameStore } from "@/store";

/**
 * Paint Mastery — a permanent currency. Survives ascends.
 *
 * v1.1 redesign (2026-05-03): gain is gold-based, not tier-based.
 * `addGoldEarned(saleGold)` is called from `canvasSlice.canvasTick` after
 * each successful sale. Gain = saleGold / pmThreshold(lifetimeGold), so the
 * cost-per-PM ratchets up by 1000× at each lifetime-gold milestone.
 *
 * Two persisted fields:
 *   - `paintMastery: Big` — accumulator. Multiplies canvas gold via pmMult().
 *   - `lifetimeGold: Big` — cumulative canvas gold ever earned. Drives the
 *      threshold for PM gain. Persists across ascends.
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
  /**
   * Credit `pmGainPerSale(saleGold, lifetimeGold)` PM and increment lifetimeGold.
   * Gain is computed at the threshold for the player's current lifetime gold
   * (pre-sale), so a sale right at a phase boundary uses the lower threshold.
   *
   * Called from `canvasSlice.canvasTick` after gold credit. saleGold is the
   * post-multiplier amount actually credited to gold.
   */
  addGoldEarned: (saleGold: Big) => void;

  /** Test/debug helper — overwrite the PM value. Not used in production. */
  _setPaintMastery: (value: Big) => void;

  /** Test/debug helper — overwrite the lifetimeGold value. Not used in production. */
  _setLifetimeGold: (value: Big) => void;
}

export const initialPaintMasteryState: PaintMasteryState = Object.freeze({
  paintMastery: big(0),
  lifetimeGold: big(0),
}) as PaintMasteryState;

export const createPaintMasterySlice: StateCreator<GameStore, [], [], PaintMasterySlice> = (
  set,
  get,
) => ({
  ...initialPaintMasteryState,

  addGoldEarned: (saleGold) => {
    const state = get();
    const gain = pmGainPerSale(saleGold, state.lifetimeGold);
    set({
      paintMastery: state.paintMastery.add(gain),
      lifetimeGold: state.lifetimeGold.add(saleGold),
    });
  },

  _setPaintMastery: (value) => set({ paintMastery: value }),
  _setLifetimeGold: (value) => set({ lifetimeGold: value }),
});
