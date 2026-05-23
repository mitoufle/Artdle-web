import type { StateCreator } from "zustand";
import {
  sellPriceUpgradeCost, speedUpgradeCost,
  sizeUpgradeCost, critUpgradeCost, comboUpgradeCost,
} from "@/core/balance";
import type { GameStore } from "@/store";
import { type Big } from "@/core/bigNumber";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { canvasTickPure } from "@/core/canvasTickPure";

export interface CanvasState {
  /**
   * Seconds painted on the current canvas.
   * Invariant: 0 ≤ canvasProgress < effectivePaintTime.
   * On threshold-cross, a sale fires and progress resets (with optional carry).
   */
  canvasProgress: number;
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
  /**
   * Canvas tier — within-run prestige level. Incremented by `tierUp()` when
   * `sellPriceLevel >= 15 && speedLevel >= 15`. Drives `tierFactor(canvasTier)`
   * scaling on base gold, upgrade costs, and per-track multiplier contributions.
   * Default 1 (no scaling). Preserved across ascends but reset on full wipe.
   */
  canvasTier: number;
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
  sellPriceLevel: 0,
  speedLevel: 0,
  sizeLevel: 0,
  critLevel: 0,
  comboLevel: 0,
  canvasTier: 1,
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
  /** Validate → spend → mutate sell-price upgrade. No-op if gold < cost. */
  upgradeSellPrice: () => void;
  /** Validate → spend → mutate speed upgrade. No-op if gold < cost. */
  upgradeSpeed: () => void;
  /** Gated upgrade: size track. No-op if locked or gold < cost. */
  upgradeSize: () => void;
  /** Gated upgrade: crit track. No-op if locked or gold < cost. */
  upgradeCrit: () => void;
  /** Gated upgrade: combo track. No-op if locked or gold < cost. */
  upgradeCombo: () => void;
  /** For ascend orchestrator (Phase 3). */
  resetCanvas: () => void;
  /** Clear the lastSale animation trigger. Called from onAnimationComplete. */
  clearLastSale: () => void;
}

export const createCanvasSlice: StateCreator<GameStore, [], [], CanvasSlice> = (set, get) => ({
  ...initialCanvasState,

  canvasTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    let fired = false;
    set((state) => {
      const before = state.statsRun.canvasesSold;
      const draft = { ...state } as GameStore;
      canvasTickPure(draft, deltaSeconds);
      fired = draft.statsRun.canvasesSold !== before;
      return {
        canvasProgress: draft.canvasProgress,
        isCritThisCanvas: draft.isCritThisCanvas,
        comboChain: draft.comboChain,
        lastSale: draft.lastSale,
        gold: draft.gold,
        lifetimeGold: draft.lifetimeGold,
        roster: draft.roster,
        officeXp: draft.officeXp,
        officeLevel: draft.officeLevel,
        statsLifetime: draft.statsLifetime,
        statsRun: draft.statsRun,
      };
    });
    if (fired) get().evaluateAchievements();
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

  upgradeSize: () => {
    const state = get();
    if (!getCanvasTrackUnlocked(state, "size")) return;
    const cost = sizeUpgradeCost(state.sizeLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), sizeLevel: state.sizeLevel + 1 });
  },

  upgradeCrit: () => {
    const state = get();
    if (!getCanvasTrackUnlocked(state, "crit")) return;
    const cost = critUpgradeCost(state.critLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), critLevel: state.critLevel + 1 });
  },

  upgradeCombo: () => {
    const state = get();
    if (!getCanvasTrackUnlocked(state, "combo")) return;
    const cost = comboUpgradeCost(state.comboLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), comboLevel: state.comboLevel + 1 });
  },

  resetCanvas: () => set(initialCanvasState),
  clearLastSale: () => set({ lastSale: null }),
});
