import type { StateCreator } from "zustand";
import {
  canvasGold, canvasTime,
  sellPriceUpgradeCost, speedUpgradeCost,
  sizeUpgradeCost, critUpgradeCost, comboUpgradeCost,
  CRIT_SPEED_FACTOR, COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getPmMultiplier,
  getCritChance,
  getComboBaseChance,
  getCanvasSize,
  getComboDecayReduction,
  getCritGoldBonus,
} from "@/core/multipliers";
import type { GameStore } from "@/store";
import type { Big } from "@/core/bigNumber";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { rng } from "@/core/rng";

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
    let state = get();

    // Loop-local state — committed via set() at the end. Reading these from
    // `state` mid-loop would be stale because we don't set() between sales.
    let progress = state.canvasProgress;
    let critFlag = state.isCritThisCanvas;
    let chain = state.comboChain;
    let lastSaleId = state.lastSale?.id ?? 0;
    let lastSaleAmount: Big | null = null;

    // Roll crit at the start of every new canvas (covers the very first tick).
    if (progress === 0) {
      critFlag = rng() < getCritChance(state);
    }

    let timeBudget = deltaSeconds;
    // Multiple sales per tick when effectiveTime < deltaSeconds (e.g. crits at
    // already-fast canvas times). Safety cap prevents runaway loops.
    const MAX_SALES_PER_TICK = 1000;
    let sales = 0;

    while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
      const size = getCanvasSize(state);
      const baseTime = canvasTime(size);
      const speedMult = getCanvasSpeedMultiplier(state);
      const critFactor = critFlag ? CRIT_SPEED_FACTOR : 1;
      const effectiveTime = baseTime / (speedMult * critFactor);

      const remainingForThisCanvas = effectiveTime - progress;

      if (timeBudget < remainingForThisCanvas) {
        // Not enough time to finish this canvas — just advance progress.
        progress += timeBudget;
        timeBudget = 0;
        break;
      }

      // Finish this canvas — fire a sale.
      timeBudget -= remainingForThisCanvas;
      progress = 0;
      sales += 1;

      const critGoldMult = critFlag ? (1 + getCritGoldBonus(state)) : 1;
      const goldMult = getCanvasGoldMultiplier(state) * getPmMultiplier(state) * critGoldMult;
      const baseGold = canvasGold(size, goldMult);
      // Apply combo bonus from PRIOR chain state — chain mutation happens AFTER pay-out.
      const gain = baseGold.mul(comboBonusFactor(chain));

      state.add("gold", gain);
      state.addGoldEarned(gain);
      state.awardOfficeXp(gain);

      // Roll combo for the chain decision (after sale paid out).
      const baseChance = getComboBaseChance(state);
      const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(state));
      const effChance = comboEffectiveChance(baseChance, chain, decay);
      const comboHit = rng() < effChance;
      chain = comboHit ? chain + 1 : 0;

      // Roll crit for the NEXT canvas.
      critFlag = rng() < getCritChance(state);
      lastSaleId += 1;
      lastSaleAmount = gain;

      // Refresh state to capture gold / lifetimeGold / officeXp updates from the
      // sale we just credited. Multipliers don't depend on these but PM does
      // (compounds within a busy tick).
      state = get();
    }

    set({
      canvasProgress: progress,
      isCritThisCanvas: critFlag,
      comboChain: chain,
      ...(lastSaleAmount !== null
        ? { lastSale: { id: lastSaleId, amount: lastSaleAmount } }
        : {}),
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
