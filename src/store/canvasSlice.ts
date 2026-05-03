import type { StateCreator } from "zustand";
import { PAINT_TIME_BASE_SECONDS, canvasGold } from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import type { GameStore } from "@/store";
import type { Big } from "@/core/bigNumber";

export interface CanvasState {
  /**
   * Seconds painted on the current canvas.
   * Invariant: 0 ≤ canvasProgress < effectivePaintTime.
   * On threshold-cross, a sale fires and progress resets (with optional carry).
   */
  canvasProgress: number;
  /**
   * Most recent sale event for animation triggering. The `id` increments on
   * each sale; consumers (e.g. `<FloatingGoldText>`) use it as an
   * AnimatePresence/motion key so each sale starts a fresh animation.
   * `amount` carries the gold gained for display.
   *
   * TRANSIENT — stripped from `partialize`. Rehydrate must not replay an
   * animation (set to `null` on reload). Cleared by `clearLastSale()`,
   * typically called from `onAnimationComplete`.
   */
  lastSale: { id: number; amount: Big } | null;
}

export const initialCanvasState: CanvasState = Object.freeze({
  canvasProgress: 0,
  lastSale: null,
}) as CanvasState;

export interface CanvasSlice extends CanvasState {
  /**
   * Per-frame canvas advance.
   * One-sale-per-tick rule: even if `delta ≥ paintTime`, exactly one sale fires.
   * Leftover is carried forward only when `< paintTime`; otherwise clamped to 0.
   * No-ops on `delta <= 0` (avoids spurious persist writes on idle frames).
   */
  canvasTick: (deltaSeconds: number) => void;
  /** For ascend orchestrator (Phase 3). */
  resetCanvas: () => void;
  /** Clear the lastSale animation trigger. Called from onAnimationComplete. */
  clearLastSale: () => void;
}

export const createCanvasSlice: StateCreator<GameStore, [], [], CanvasSlice> = (set, get) => ({
  ...initialCanvasState,

  canvasTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const state = get();
    const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(state);
    const newProgress = state.canvasProgress + deltaSeconds;

    if (newProgress < paintTime) {
      set({ canvasProgress: newProgress });
      return;
    }

    // Threshold crossed — exactly one sale per tick.
    const gain = canvasGold(1, getCanvasGoldMultiplier(state));
    state.add("gold", gain);
    const leftover = newProgress - paintTime;
    const prevId = state.lastSale?.id ?? 0;
    set({
      canvasProgress: leftover < paintTime ? leftover : 0,
      lastSale: { id: prevId + 1, amount: gain },
    });
  },

  resetCanvas: () => set(initialCanvasState),
  clearLastSale: () => set({ lastSale: null }),
});
