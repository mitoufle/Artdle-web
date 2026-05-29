import type { GameStore } from "@/store";
import type { DraftState } from "@/core/pureMutations";

/**
 * Shallow-clone the GameStore for the catch-up simulation. Per spec §5 rules:
 * - Primitives, Big (immutable via break_eternity.js), Date: copy by value or
 *   share reference.
 * - Records (partLevels, purchasedNodes, etc.): `{ ...obj }`.
 * - Arrays of items: deep-clone items + their affix array (affixes are mutated
 *   in-place by fuse logic if we shared the reference).
 * - `pastRuns`: ReadonlyArray, never mutated by ticks; share reference.
 * - Configs / static refs: shared.
 *
 * The returned object is typed as `DraftState` (Mutable<GameStore>) so the
 * pureMutations in the catch-up sim can freely reassign top-level fields.
 */
export function cloneGameState(state: GameStore): DraftState {
  return {
    ...state,
    partLevels: { ...state.partLevels },
    purchasedNodes: { ...state.purchasedNodes },
    protectedTiers: { ...state.protectedTiers },
    completedResearches: { ...state.completedResearches },
    examsPassed: { ...state.examsPassed },
    completedAchievements: { ...state.completedAchievements },
    statsLifetime: { ...state.statsLifetime },
    statsRun: { ...state.statsRun },
    pastRuns: state.pastRuns,
    inventory: state.inventory.map((i) => ({ ...i, affixes: i.affixes.map((a) => ({ ...a })) })),
    equipped: Object.fromEntries(
      Object.entries(state.equipped).map(([k, v]) => [
        k,
        { ...v, affixes: v.affixes.map((a) => ({ ...a })) },
      ]),
    ) as typeof state.equipped,
    roster: state.roster.map((w) => ({ ...w, stats: { ...w.stats } })),
    activeResearch: state.activeResearch ? { ...state.activeResearch } : null,
    lastSale: state.lastSale ? { ...state.lastSale } : null,
    notificationQueue: [...state.notificationQueue],
  } as DraftState;
}
