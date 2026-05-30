import type { StateCreator } from "zustand";
import { getSkillNodeConfig, type SkillNodeId } from "@/config/skillTreeNodes";
import { SKILL_CLUSTERS, getClusterConfig, getClusterNodes, type SkillClusterId } from "@/config/skillClusters";
import { big } from "@/core/bigNumber";
import { skillTreeTickPure } from "@/core/skillTreeTickPure";
import type { GameStore } from "@/store";

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
  /** Dev toggle — when true all node purchases skip the fame cost check. Not persisted. */
  devFreeNodes: boolean;
}

export const initialSkillTreeState: SkillTreeState = Object.freeze({
  purchasedNodes: Object.freeze({}) as Partial<Record<SkillNodeId, number>>,
  pokeTreeTimer: 0,
  devFreeNodes: false,
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
  /** Dev only — toggle free node purchases (bypasses fame cost). */
  toggleDevFreeNodes: () => void;
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
    if (!state.devFreeNodes && !state.spend("fame", big(cost))) return false;
    set((s) => ({
      purchasedNodes: { ...s.purchasedNodes, [id]: currentLevel + 1 },
    }));
    // A purchased node may have unlocked a roster slot — spawn to fill it.
    // reconcileRoster is a no-op for non-roster nodes (cap unchanged).
    get().reconcileRoster();
    return true;
  },

  skillTreeTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    set((state) => {
      const draft = { ...state } as GameStore;
      skillTreeTickPure(draft, deltaSeconds);
      return {
        pokeTreeTimer: draft.pokeTreeTimer,
        inspiration: draft.inspiration,
        lifetimeInspiration: draft.lifetimeInspiration,
      };
    });
  },

  resetSkillTree: () => set(initialSkillTreeState),

  toggleDevFreeNodes: () => set((s) => ({ devFreeNodes: !s.devFreeNodes })),
});

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** Current level (0..maxLevel). Returns 0 for unknown id or unbought node. */
export const getNodeLevel = (state: Pick<GameStore, "purchasedNodes">, id: SkillNodeId): number =>
  state.purchasedNodes[id] ?? 0;

/** True iff the player has purchased this node at least once. */
export const hasNode = (state: Pick<GameStore, "purchasedNodes">, id: SkillNodeId): boolean =>
  getNodeLevel(state, id) > 0;

/**
 * True iff every node in the cluster is at its maxLevel. Derived purely from
 * purchasedNodes — completion is recomputed each render, never stored, so no
 * save migration is involved. Unknown cluster id → false.
 */
export const clusterComplete = (
  state: Pick<GameStore, "purchasedNodes">,
  clusterId: SkillClusterId,
): boolean => {
  if (getClusterConfig(clusterId) === null) return false;
  const nodes = getClusterNodes(clusterId);
  if (nodes.length === 0) return false;
  return nodes.every((n) => getNodeLevel(state, n.id) >= n.maxLevel);
};

/**
 * Cost of buying the NEXT level. Returns null if maxed, unknown, or
 * cost array is malformed.
 */
export const getNextCost = (state: Pick<GameStore, "purchasedNodes">, id: SkillNodeId): number | null => {
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
export const canBuyNode = (state: Pick<GameStore, "purchasedNodes" | "devFreeNodes" | "fame">, id: SkillNodeId): boolean => {
  const node = getSkillNodeConfig(id);
  if (!node) return false;
  const level = getNodeLevel(state, id);
  if (level >= node.maxLevel) return false;
  for (const parentId of node.parentIds) {
    if (getNodeLevel(state, parentId) === 0) return false;
  }
  const cost = node.costs[level];
  if (cost === undefined) return false;
  if (state.devFreeNodes) return true;
  return state.fame.gte(big(cost));
};

/** Sum of additive contributions from a list of node ids, multiplied by their levels. */
export const sumLevels = (
  state: Pick<GameStore, "purchasedNodes">,
  ids: ReadonlyArray<SkillNodeId>,
): number => ids.reduce((acc, id) => acc + getNodeLevel(state, id), 0);

/** Canvas-depth track ID — four tracks total. (Size was folded into Tier.) */
export type CanvasTrackId = "sell_price" | "speed" | "crit" | "combo";

/**
 * Returns true if any purchased node (level ≥ 1) has `capability` in its
 * `unlocks` array, OR if a completed cluster's completionBonus tag matches.
 * Node IDs are free-form — the engine reads capability tags, not node IDs.
 */
export const hasCapability = (state: Pick<GameStore, "purchasedNodes">, capability: string): boolean => {
  for (const [nodeId, level] of Object.entries(state.purchasedNodes)) {
    if ((level ?? 0) < 1) continue;
    const config = getSkillNodeConfig(nodeId);
    if (config && config.unlocks.includes(capability)) return true;
  }
  // Completed clusters grant their completionBonus tag as an active capability.
  for (const cluster of SKILL_CLUSTERS) {
    if (cluster.completionBonus === capability && clusterComplete(state, cluster.id)) {
      return true;
    }
  }
  return false;
};

/**
 * Sum of `node.level` across all purchased nodes whose config.unlocks array
 * contains `capability`. Used for count-based capability tags like
 * `roster_slot` and `queue_slot` where each level of an authored node grants
 * +1 to the cap.
 */
export const countCapability = (state: Pick<GameStore, "purchasedNodes">, capability: string): number => {
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
 * Sell price and speed are always unlocked. Crit and combo require a
 * purchased node that carries the matching capability tag:
 *   - canvas_crit  (e.g. genius_episode node)
 *   - canvas_combo (e.g. unrelentless node)
 *
 * Node IDs are a game-design decision — the engine reads `unlocks` tags only.
 */
export const getCanvasTrackUnlocked = (
  state: Pick<GameStore, "purchasedNodes">,
  trackId: CanvasTrackId,
): boolean => {
  if (trackId === "sell_price" || trackId === "speed") return true;
  return hasCapability(state, `canvas_${trackId}`);
};
