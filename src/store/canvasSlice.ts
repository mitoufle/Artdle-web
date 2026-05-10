import type { StateCreator } from "zustand";
import {
  canvasGold, canvasTime, tierUpgradeCost, MAX_TIER,
  sellPriceUpgradeCost, speedUpgradeCost,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getPaintTimeMultiplier,
  getPmMultiplier,
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
   * v1.1 tier (LEGACY — removed in canvas-depth Task 16).
   * Current canvas tier (v1.1: 1..MAX_TIER). Determines per-sale gold (BASE × tier²)
   * and base paint time (tier × 2 s). Reset to 1 on ascend (initialCanvasState
   * is the source of truth for resetCanvas).
   */
  canvasTier: number;
  /** New canvas-depth: sell-price track level (unlocked from start). */
  sellPriceLevel: number;
  /** New canvas-depth: completion-speed track level (unlocked from start). */
  speedLevel: number;
  /** New canvas-depth: size track level. Gated by skill-tree node "unlock_canvas_size". */
  sizeLevel: number;
  /** New canvas-depth: crit track level. Gated. */
  critLevel: number;
  /** New canvas-depth: combo track level. Gated. */
  comboLevel: number;
  /** New canvas-depth: current combo chain. Run-state. Resets on miss / ascend. */
  comboChain: number;
  /** New canvas-depth: rolled at canvas start; `true` for one canvas's lifetime then reset on sale. */
  isCritThisCanvas: boolean;
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
  canvasTier: 1,
  sellPriceLevel: 1,
  speedLevel: 1,
  sizeLevel: 0,
  critLevel: 0,
  comboLevel: 0,
  comboChain: 0,
  isCritThisCanvas: false,
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
  /**
   * Atomic guard-spend-mutate tier upgrade. Validates:
   *   1. canvasTier < MAX_TIER (otherwise no-op).
   *   2. gold ≥ tierUpgradeCost(canvasTier) (otherwise no-op).
   * On success: gold -= cost, canvasTier += 1.
   * No partial state. No race window between gold check and tier mutation.
   */
  upgradeTier: () => void;
  /** Validate → spend → mutate sell-price upgrade. No-op if gold < cost. */
  upgradeSellPrice: () => void;
  /** Validate → spend → mutate speed upgrade. No-op if gold < cost. */
  upgradeSpeed: () => void;
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
    const paintTime = canvasTime(state.canvasTier) / (getPaintTimeMultiplier(state) * getCanvasSpeedMultiplier(state));
    const newProgress = state.canvasProgress + deltaSeconds;

    if (newProgress < paintTime) {
      set({ canvasProgress: newProgress });
      return;
    }

    // Threshold crossed — exactly one sale per tick.
    const goldMult = getCanvasGoldMultiplier(state) * getPmMultiplier(state);
    const gain = canvasGold(state.canvasTier, goldMult);
    state.add("gold", gain);
    state.addGoldEarned(gain);
    const leftover = newProgress - paintTime;
    const prevId = state.lastSale?.id ?? 0;
    set({
      canvasProgress: leftover < paintTime ? leftover : 0,
      lastSale: { id: prevId + 1, amount: gain },
    });
  },

  upgradeTier: () => {
    const state = get();
    if (state.canvasTier >= MAX_TIER) return;
    const cost = tierUpgradeCost(state.canvasTier);
    if (state.gold.lt(cost)) return;
    set({
      gold: state.gold.sub(cost),
      canvasTier: state.canvasTier + 1,
    });
  },

  upgradeSellPrice: () => {
    const state = get();
    // Contract: formula(currentLevel) returns cost to advance from currentLevel to currentLevel+1.
    const cost = sellPriceUpgradeCost(state.sellPriceLevel);
    if (state.gold.lt(cost)) return;
    set({
      gold: state.gold.sub(cost),
      sellPriceLevel: state.sellPriceLevel + 1,
    });
  },

  upgradeSpeed: () => {
    const state = get();
    const cost = speedUpgradeCost(state.speedLevel);
    if (state.gold.lt(cost)) return;
    set({
      gold: state.gold.sub(cost),
      speedLevel: state.speedLevel + 1,
    });
  },

  resetCanvas: () => set(initialCanvasState),
  clearLastSale: () => set({ lastSale: null }),
});
