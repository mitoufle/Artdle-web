import type { StateCreator } from "zustand";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

export interface SkillTreeState {
  /**
   * Purchased nodes by id. Partial<Record<SkillNodeId, true>> for O(1) lookup,
   * clean JSON serialization, AND compile-time typo protection (only valid
   * SkillNodeId keys are accepted at write/read sites).
   */
  purchasedNodes: Partial<Record<SkillNodeId, true>>;
}

export const initialSkillTreeState: SkillTreeState = Object.freeze({
  purchasedNodes: Object.freeze({}) as Partial<Record<SkillNodeId, true>>,
}) as SkillTreeState;

export interface SkillTreeSlice extends SkillTreeState {
  /**
   * Spend SKILL_NODES[id].cost fame; mark node as purchased.
   * Returns false if: unknown id, already owned, prereq not met, insufficient fame.
   * Atomic via currencySlice.spend('fame', cost).
   */
  buyNode: (id: SkillNodeId) => boolean;
}

export const createSkillTreeSlice: StateCreator<GameStore, [], [], SkillTreeSlice> = (set, get) => ({
  ...initialSkillTreeState,

  buyNode: (id) => {
    const node = SKILL_NODES.find((n) => n.id === id);
    if (!node) return false;
    const state = get();
    if (state.purchasedNodes[id]) return false;
    if (node.prereq !== null && !state.purchasedNodes[node.prereq]) return false;
    if (!state.spend("fame", big(node.cost))) return false;
    set((s) => ({
      purchasedNodes: { ...s.purchasedNodes, [id]: true },
    }));
    return true;
  },
});

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** True iff the player has purchased this node. */
export const hasNode = (state: GameStore, id: SkillNodeId): boolean =>
  state.purchasedNodes[id] === true;

/**
 * True iff buyNode(id) would succeed RIGHT NOW: not yet owned, prereq met, fame ≥ cost.
 * Phase 4 UI uses this to gate the "Buy" button.
 */
export const canBuyNode = (state: GameStore, id: SkillNodeId): boolean => {
  const node = SKILL_NODES.find((n) => n.id === id);
  if (!node) return false;
  if (state.purchasedNodes[id]) return false;
  if (node.prereq !== null && !state.purchasedNodes[node.prereq]) return false;
  return state.fame.gte(big(node.cost));
};
