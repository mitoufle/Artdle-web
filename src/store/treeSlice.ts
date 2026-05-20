import type { StateCreator } from "zustand";
import { TREE_STAGES, type TreePartConfig } from "@/config/treeStages";
import { treePartCost, inspiPerSec } from "@/core/balance";
import { big } from "@/core/bigNumber";
import { getInspiMultiplier, getTreeUpgradeCostMultiplier } from "@/core/multipliers";
import type { GameStore } from "@/store";

/** Iteration cap for auto-advance loops in buyPartLevel and treeTick. */
const AUTO_GROW_MAX_ITER = 100;

export interface TreeState {
  /** Highest stage grown into. 0..TREE_STAGES.length-1 (currently 0 = Tiny Sprout, 5 = Verdant Shoot). */
  currentStage: number;
  /** Per-part level. Seeded with every configured part ID at 0. */
  partLevels: Record<string, number>;
}

const initialPartLevels: Record<string, number> = Object.freeze(
  Object.fromEntries(TREE_STAGES.flatMap((s) => s.parts.map((p) => [p.id, 0]))),
) as Record<string, number>;

export const initialTreeState: TreeState = {
  currentStage: 0,
  partLevels: initialPartLevels,
};

export interface TreeSlice extends TreeState {
  /**
   * Spend `treePartCost(level, baseCost)` gold; +1 level on the named part.
   * Atomic: validates funds via `currencySlice.spend` before incrementing.
   * Returns false if: unknown ID, locked stage, or insufficient gold.
   */
  buyPartLevel: (partId: string) => boolean;
  /**
   * Greedy bulk buy: repeatedly purchase the cheapest currently-affordable
   * part across all unlocked stages until nothing is affordable. Returns
   * the number of levels purchased.
   */
  buyAllAffordableTreeParts: () => number;
  /**
   * If `canGrowSapling(state)`: increments `currentStage` by 1. Free.
   * Returns false otherwise (threshold not met, or already at top stage).
   */
  growSapling: () => boolean;
  /**
   * Per-frame: credit inspiration via currencySlice (skipped when no parts
   * are producing, to avoid 60Hz persist writes during bootstrap), then
   * auto-advance stage if the current totals already meet the next threshold.
   */
  treeTick: (deltaSeconds: number) => void;
  /** For ascend orchestrator (Phase 3). Resets state to `initialTreeState`. */
  resetTree: () => void;
}

/** Helper: locate a part's config + the stage index that owns it. */
function findPart(partId: string): { part: TreePartConfig; stageIdx: number } | null {
  for (let i = 0; i < TREE_STAGES.length; i++) {
    const stage = TREE_STAGES[i]!;
    const part = stage.parts.find((p) => p.id === partId);
    if (part) return { part, stageIdx: i };
  }
  return null;
}

export const createTreeSlice: StateCreator<GameStore, [], [], TreeSlice> = (set, get) => ({
  ...initialTreeState,

  buyPartLevel: (partId) => {
    const found = findPart(partId);
    if (!found) return false;
    const { part, stageIdx } = found;
    const state = get();
    if (stageIdx > state.currentStage) return false;
    const currentLevel = state.partLevels[partId] ?? 0;
    const baseCost = treePartCost(currentLevel, part.baseCost);
    const discount = getTreeUpgradeCostMultiplier(state);
    const cost = baseCost.mul(big(discount));
    if (!state.spend("gold", cost)) return false;
    set((s) => ({
      partLevels: { ...s.partLevels, [partId]: (s.partLevels[partId] ?? 0) + 1 },
    }));
    // Auto-advance stage(s) if the new totals cross a threshold. In practice
    // a single buy crosses at most one (a part lives in exactly one stage);
    // the bounded loop guards against unexpected qualifying states.
    for (let i = 0; i < AUTO_GROW_MAX_ITER && canGrowSapling(get()); i++) {
      get().growSapling();
    }
    return true;
  },

  buyAllAffordableTreeParts: () => {
    let bought = 0;
    const MAX_ITER = 10000;
    while (bought < MAX_ITER) {
      const state = get();
      const discount = getTreeUpgradeCostMultiplier(state);
      let cheapestId: string | null = null;
      let cheapestCost = big(0);
      for (let i = 0; i <= state.currentStage && i < TREE_STAGES.length; i++) {
        const stage = TREE_STAGES[i]!;
        for (const part of stage.parts) {
          const level = state.partLevels[part.id] ?? 0;
          const cost = treePartCost(level, part.baseCost).mul(big(discount));
          if (!state.gold.gte(cost)) continue;
          if (cheapestId === null || cost.lt(cheapestCost)) {
            cheapestId = part.id;
            cheapestCost = cost;
          }
        }
      }
      if (cheapestId === null) break;
      if (!get().buyPartLevel(cheapestId)) break;
      bought += 1;
    }
    return bought;
  },

  growSapling: () => {
    const state = get();
    if (!canGrowSapling(state)) return false;
    set({ currentStage: state.currentStage + 1 });
    return true;
  },

  treeTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const state = get();
    const producing = getProducingParts(state);
    if (producing.length > 0) {
      const multiplier = getInspiMultiplier(state);
      const rate = inspiPerSec(producing, multiplier);
      if (rate.gt(0)) {
        const gain = rate.mul(deltaSeconds);
        state.add("inspiration", gain);
        state.trackInspirationGain(gain);
      }
    }
    // Defensive auto-advance: catches loaded saves whose partLevels already
    // qualify without a fresh buy event (post-migration, balance-curve shifts).
    for (let i = 0; i < AUTO_GROW_MAX_ITER && canGrowSapling(get()); i++) {
      get().growSapling();
    }
  },

  resetTree: () => set(initialTreeState),
});

// ============================================================================
// Selectors — pure functions over GameStore. Callable from anywhere.
// ============================================================================

/** Total levels across the parts of `stageIdx`. Returns 0 for invalid index. */
export const getTotalLevelsInStage = (state: Pick<GameStore, "partLevels">, stageIdx: number): number => {
  const stage = TREE_STAGES[stageIdx];
  if (!stage) return 0;
  return stage.parts.reduce((sum, p) => sum + (state.partLevels[p.id] ?? 0), 0);
};

/**
 * Flat list of parts that contribute to inspi/sec right now:
 * stageIdx ≤ currentStage AND level > 0.
 */
export const getProducingParts = (
  state: Pick<GameStore, "currentStage" | "partLevels">,
): ReadonlyArray<{ level: number; rate: number }> => {
  const out: Array<{ level: number; rate: number }> = [];
  for (let i = 0; i <= state.currentStage && i < TREE_STAGES.length; i++) {
    const stage = TREE_STAGES[i]!;
    for (const part of stage.parts) {
      const level = state.partLevels[part.id] ?? 0;
      if (level > 0) out.push({ level, rate: part.rate });
    }
  }
  return out;
};

/**
 * True iff the player can grow into the next stage:
 * - `currentStage + 1` exists in TREE_STAGES, AND
 * - total levels across the CURRENT stage's parts ≥ the next stage's `unlockThreshold`.
 */
export const canGrowSapling = (state: GameStore): boolean => {
  const next = state.currentStage + 1;
  if (next >= TREE_STAGES.length) return false;
  const required = TREE_STAGES[next]!.unlockThreshold;
  return getTotalLevelsInStage(state, state.currentStage) >= required;
};
