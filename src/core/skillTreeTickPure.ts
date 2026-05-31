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

/** Muse Burst (`muse_burst_buff`): canvases sold between buff triggers. */
export const MUSE_BURST_SALE_INTERVAL = 100;
/** Buff duration in wall-clock seconds. */
export const MUSE_BURST_DURATION_S = 42;
/** Inspiration-rate multiplier while the buff is active. */
export const MUSE_BURST_INSPI_MULT = 7;

/**
 * True iff the sale count crossed a multiple of `interval` going from `before`
 * to `after` — i.e. a new Muse Burst milestone was reached this tick.
 */
export const crossedSaleMilestone = (before: number, after: number, interval: number): boolean =>
  Math.floor(after / interval) > Math.floor(before / interval);

export function skillTreeTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  // Muse Burst buff counts down every frame, independent of Poke-the-Tree.
  if ((draft.museBurstTimer ?? 0) > 0) {
    draft.museBurstTimer = Math.max(0, draft.museBurstTimer - deltaSeconds);
  }
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
