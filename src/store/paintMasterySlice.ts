import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import { pmGainPerSale } from "@/core/balance";
import type { GameStore } from "@/store";

/**
 * Paint Mastery — a permanent currency. Survives ascends.
 *
 * Gain: `tier²` per canvas sale (v1.1 stripped form; v1.3 will replace
 * `tier²` with `quality × tier` via balance.ts/pmGainPerSale).
 *
 * Application: `pmMult(paintMastery)` from `core/balance.ts` returns a plain
 * number that callers (currently only `canvasSlice.canvasTick` via
 * `multipliers.getCanvasGoldMultiplier`'s sibling `getPmMultiplier`) compose
 * multiplicatively with the existing additive multiplier.
 *
 * Persistence: serialized via the existing `serializeBigs` walker
 * (Big → `{ __big: "..." }` markers). No special partialize handling.
 *
 * Reset semantics: NOT reset on ascend. The ascend orchestrator
 * (`src/systems/ascend.ts`) does not call any reset on this slice.
 */
export interface PaintMasteryState {
  paintMastery: Big;
}

export interface PaintMasterySlice extends PaintMasteryState {
  /**
   * Add `tier²` PM to the accumulator. Idempotent under repeated calls
   * (commutative additive Big op). Called from `canvasSlice.canvasTick`
   * on every successful sale.
   */
  gainFromSale: (tier: number) => void;

  /** Test/debug helper — overwrite the PM value. Not used in production. */
  _setPaintMastery: (value: Big) => void;
}

export const initialPaintMasteryState: PaintMasteryState = Object.freeze({
  paintMastery: big(0),
}) as PaintMasteryState;

export const createPaintMasterySlice: StateCreator<GameStore, [], [], PaintMasterySlice> = (
  set,
  get,
) => ({
  ...initialPaintMasteryState,

  gainFromSale: (tier) => {
    const gain = pmGainPerSale(tier);
    set({ paintMastery: get().paintMastery.add(gain) });
  },

  _setPaintMastery: (value) => set({ paintMastery: value }),
});
