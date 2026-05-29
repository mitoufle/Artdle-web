import type { StateCreator } from "zustand";
import {
  sellPriceUpgradeCost, speedUpgradeCost,
  critUpgradeCost, comboUpgradeCost,
  tierUpgradeCost,
} from "@/core/balance";
import type { GameStore } from "@/store";
import { type Big } from "@/core/bigNumber";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { canvasTickPure } from "@/core/canvasTickPure";

export interface CanvasState {
  /**
   * Chunk-domain progress in the current canvas.
   *   floor(canvasProgress) = whole chunks completed (gold paid)
   *   fractional part = sub-chunk progress (seconds budget pro-rated)
   * Invariant: 0 ≤ canvasProgress < chunksPerCanvas(canvasTier).
   * Reset to 0 when canvas completes and when tierUp() succeeds.
   */
  canvasProgress: number;
  /** New canvas-depth: sell-price track level (unlocked from start). */
  sellPriceLevel: number;
  /** New canvas-depth: completion-speed track level (unlocked from start). */
  speedLevel: number;
  // sizeLevel REMOVED — Size folded into Tier
  /** New canvas-depth: crit track level. Gated. */
  critLevel: number;
  /** New canvas-depth: combo track level. Gated. */
  comboLevel: number;
  /**
   * Canvas tier — within-run prestige level. Incremented by `tierUp()` when
   * `gold >= tierUpgradeCost(canvasTier)`. Drives `tierFactor(canvasTier)`
   * scaling on base gold and chunks-per-canvas progression. Default 1
   * (no scaling). Preserved across ascends but reset on full wipe.
   */
  canvasTier: number;
  /** New canvas-depth: current combo chain. Run-state. Resets on miss / ascend. */
  comboChain: number;
  /**
   * Set of chunk indices in the CURRENT canvas painted via a crit (trigger
   * chunk that rolled OR bonus chunks added by that crit). CanvasStage reads
   * this to apply the gold-flash modifier per cell. Cleared on each sale,
   * on tier-up, and on ascend.
   */
  critChunks: Record<number, true>;
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
  critLevel: 0,
  comboLevel: 0,
  canvasTier: 1,
  comboChain: 0,
  critChunks: {},
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
  // upgradeSize REMOVED
  /** Gated upgrade: crit track. No-op if locked or gold < cost. */
  upgradeCrit: () => void;
  /** Gated upgrade: combo track. No-op if locked or gold < cost. */
  upgradeCombo: () => void;
  /** For ascend orchestrator (Phase 3). */
  resetCanvas: () => void;
  /** Clear the lastSale animation trigger. Called from onAnimationComplete. */
  clearLastSale: () => void;
  /**
   * Tier upgrade: spend `tierUpgradeCost(canvasTier)` gold, increment
   * canvasTier, reset in-canvas state (progress, combo chain, crit chunks).
   * Within-tier upgrade levels and gear are PRESERVED.
   * Returns true on success, false if insufficient gold.
   */
  tierUp: () => boolean;
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
        critChunks: draft.critChunks,
        comboChain: draft.comboChain,
        lastSale: draft.lastSale,
        gold: draft.gold,
        lifetimeGold: draft.lifetimeGold,
        statsLifetime: draft.statsLifetime,
        statsRun: draft.statsRun,
      };
    });
    if (fired) get().evaluateAchievements();
    // NO MORE auto tier-up — tier-up is now an explicit player action.
  },

  upgradeSellPrice: () => {
    const state = get();
    const cost = sellPriceUpgradeCost(state.sellPriceLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), sellPriceLevel: state.sellPriceLevel + 1 });
  },

  upgradeSpeed: () => {
    const state = get();
    const cost = speedUpgradeCost(state.speedLevel);
    if (state.gold.lt(cost)) return;
    set({ gold: state.gold.sub(cost), speedLevel: state.speedLevel + 1 });
  },

  // upgradeSize DELETED

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

  tierUp: () => {
    const state = get();
    const cost = tierUpgradeCost(state.canvasTier);
    if (state.gold.lt(cost)) return false;
    set({
      gold: state.gold.sub(cost),
      canvasTier: state.canvasTier + 1,
      canvasProgress: 0,
      comboChain: 0,
      critChunks: {},
      // sellPriceLevel, speedLevel, critLevel, comboLevel PRESERVED
    });
    get().evaluateAchievements();
    return true;
  },
});
