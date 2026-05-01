import type { StateCreator } from "zustand";
import { PAINT_TIME_BASE_SECONDS, canvasGold } from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import type { GameStore } from "@/store";

export interface CanvasState {
  /**
   * Seconds painted on the current canvas.
   * Invariant: 0 ≤ canvasProgress < effectivePaintTime.
   * On threshold-cross, a sale fires and progress resets (with optional carry).
   */
  canvasProgress: number;
}

export const initialCanvasState: CanvasState = { canvasProgress: 0 };

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
    const gain = canvasGold(getCanvasGoldMultiplier(state));
    state.add("gold", gain);
    const leftover = newProgress - paintTime;
    // If leftover would itself trigger another sale, drop to 0 (one-sale-per-tick).
    set({ canvasProgress: leftover < paintTime ? leftover : 0 });
  },

  resetCanvas: () => set(initialCanvasState),
});
