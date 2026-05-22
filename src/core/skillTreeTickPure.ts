import { big } from "@/core/bigNumber";
import {
  addCurrency,
  trackInspirationGainPure,
  type DraftState,
} from "@/core/pureMutations";

/** Wall-clock seconds between Poke-the-Tree inspiration grants. */
export const POKE_TREE_INTERVAL_S = 10;
/** Inspiration credited per grant at level 1; doubles per level. */
export const POKE_TREE_BASE_INSPI = 100;

export function skillTreeTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  const pokeLevel = draft.purchasedNodes.poke_tree ?? 0;
  if (pokeLevel === 0) return;
  const next = draft.pokeTreeTimer + deltaSeconds;
  const grants = Math.floor(next / POKE_TREE_INTERVAL_S);
  if (grants > 0) {
    // Exponential doubling per level: L1=100, L2=200, L3=400, L4=800, L5=1600.
    const inspiPerTick = POKE_TREE_BASE_INSPI * Math.pow(2, pokeLevel - 1);
    const inspiGain = big(inspiPerTick * grants);
    addCurrency(draft, "inspiration", inspiGain);
    trackInspirationGainPure(draft, inspiGain);
  }
  draft.pokeTreeTimer = next - grants * POKE_TREE_INTERVAL_S;
}
