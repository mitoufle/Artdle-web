import type { StateCreator } from "zustand";
import { getSkillNodeConfig, type SkillNodeId } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

const POKE_TREE_INTERVAL_S = 10;
const POKE_TREE_BASE_INSPI = 100;

export interface SkillTreeState {
  /**
   * Per-node purchased level. `undefined` or `0` = not owned. Numbers store
   * the current level (1..maxLevel). Multi-level nodes increment with each
   * `buyNode` call until maxed.
   */
  purchasedNodes: Partial<Record<SkillNodeId, number>>;
  /**
   * Seconds since the last Poke-the-Tree inspiration grant. Wraps every
   * POKE_TREE_INTERVAL_S seconds while `level(poke_tree) > 0`.
   */
  pokeTreeTimer: number;
}

export const initialSkillTreeState: SkillTreeState = Object.freeze({
  purchasedNodes: Object.freeze({}) as Partial<Record<SkillNodeId, number>>,
  pokeTreeTimer: 0,
}) as SkillTreeState;

export interface SkillTreeSlice extends SkillTreeState {
  /**
   * Spend the cost at the CURRENT level (i.e., next-level cost) and
   * increment that node's level by 1. Returns false if:
   *   - unknown id
   *   - already at maxLevel
   *   - any parent has level 0
   *   - insufficient fame
   */
  buyNode: (id: SkillNodeId) => boolean;
  /**
   * Per-frame Poke-the-Tree timer + grant. No-op on idle frames.
   */
  skillTreeTick: (deltaSeconds: number) => void;
  /** For ascend orchestrator. Note: skill tree progress is permanent across
   *  v1.1+ ascends, but resetting is supported for test cleanup and future
   *  tree-wipe mechanics. */
  resetSkillTree: () => void;
}

export const createSkillTreeSlice: StateCreator<GameStore, [], [], SkillTreeSlice> = (set, get) => ({
  ...initialSkillTreeState,

  buyNode: (id) => {
    const node = getSkillNodeConfig(id);
    if (!node) return false;
    const state = get();
    const currentLevel = state.purchasedNodes[id] ?? 0;
    if (currentLevel >= node.maxLevel) return false;
    for (const parentId of node.parentIds) {
      if ((state.purchasedNodes[parentId] ?? 0) === 0) return false;
    }
    const cost = node.costs[currentLevel];
    if (cost === undefined) return false;
    if (!state.spend("fame", big(cost))) return false;
    set((s) => ({
      purchasedNodes: { ...s.purchasedNodes, [id]: currentLevel + 1 },
    }));
    return true;
  },

  skillTreeTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const state = get();
    const pokeLevel = state.purchasedNodes.poke_tree ?? 0;
    if (pokeLevel === 0) return;

    const next = state.pokeTreeTimer + deltaSeconds;
    const grants = Math.floor(next / POKE_TREE_INTERVAL_S);
    if (grants > 0) {
      // Exponential doubling per level: L1=100, L2=200, L3=400, L4=800, L5=1600.
      const inspiPerTick = POKE_TREE_BASE_INSPI * Math.pow(2, pokeLevel - 1);
      const inspiGain = big(inspiPerTick * grants);
      state.add("inspiration", inspiGain);
    }
    set({ pokeTreeTimer: next - grants * POKE_TREE_INTERVAL_S });
  },

  resetSkillTree: () => set(initialSkillTreeState),
});

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** Current level (0..maxLevel). Returns 0 for unknown id or unbought node. */
export const getNodeLevel = (state: GameStore, id: SkillNodeId): number =>
  state.purchasedNodes[id] ?? 0;

/** True iff the player has purchased this node at least once. */
export const hasNode = (state: GameStore, id: SkillNodeId): boolean =>
  getNodeLevel(state, id) > 0;

/**
 * Cost of buying the NEXT level. Returns null if maxed, unknown, or
 * cost array is malformed.
 */
export const getNextCost = (state: GameStore, id: SkillNodeId): number | null => {
  const node = getSkillNodeConfig(id);
  if (!node) return null;
  const level = getNodeLevel(state, id);
  if (level >= node.maxLevel) return null;
  return node.costs[level] ?? null;
};

/**
 * True iff buyNode(id) would succeed RIGHT NOW: not yet maxed, all parents
 * owned at level≥1, fame ≥ next-level cost.
 */
export const canBuyNode = (state: GameStore, id: SkillNodeId): boolean => {
  const node = getSkillNodeConfig(id);
  if (!node) return false;
  const level = getNodeLevel(state, id);
  if (level >= node.maxLevel) return false;
  for (const parentId of node.parentIds) {
    if (getNodeLevel(state, parentId) === 0) return false;
  }
  const cost = node.costs[level];
  if (cost === undefined) return false;
  return state.fame.gte(big(cost));
};

/** Sum of additive contributions from a list of node ids, multiplied by their levels. */
export const sumLevels = (
  state: GameStore,
  ids: ReadonlyArray<SkillNodeId>,
): number => ids.reduce((acc, id) => acc + getNodeLevel(state, id), 0);

/** Canvas-depth track ID — five tracks total. */
export type CanvasTrackId = "sell_price" | "speed" | "size" | "crit" | "combo";

/**
 * Returns true if any purchased node (level ≥ 1) has `capability` in its
 * `unlocks` array. Node IDs are free-form — the engine reads capability tags,
 * not node IDs.
 */
export const hasCapability = (state: GameStore, capability: string): boolean => {
  for (const [nodeId, level] of Object.entries(state.purchasedNodes)) {
    if ((level ?? 0) < 1) continue;
    const config = getSkillNodeConfig(nodeId);
    if (config && config.unlocks.includes(capability)) return true;
  }
  return false;
};

/**
 * Sum of `node.level` across all purchased nodes whose config.unlocks array
 * contains `capability`. Used for count-based capability tags like
 * `roster_slot` and `queue_slot` where each level of an authored node grants
 * +1 to the cap.
 */
export const countCapability = (state: GameStore, capability: string): number => {
  let total = 0;
  for (const [nodeId, level] of Object.entries(state.purchasedNodes)) {
    const lvl = level ?? 0;
    if (lvl < 1) continue;
    const config = getSkillNodeConfig(nodeId);
    if (config && config.unlocks.includes(capability)) total += lvl;
  }
  return total;
};

/**
 * Returns true if the player has unlocked the given canvas upgrade track.
 * Sell price and speed are always unlocked. Size, crit, combo require a
 * purchased node that carries the matching capability tag:
 *   - canvas_size  (e.g. size_matters node)
 *   - canvas_crit
 *   - canvas_combo
 *
 * Node IDs are a game-design decision — the engine reads `unlocks` tags only.
 */
export const getCanvasTrackUnlocked = (
  state: GameStore,
  trackId: CanvasTrackId,
): boolean => {
  if (trackId === "sell_price" || trackId === "speed") return true;
  return hasCapability(state, `canvas_${trackId}`);
};
