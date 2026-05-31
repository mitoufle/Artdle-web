import { rng, rngInt, rngPick } from "@/core/rng";
import { AFFIX_KINDS, AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";
import type { AffixKind } from "@/config/workshopAffixes";
import type { GameStore } from "@/store";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import type { CanvasTrackId } from "@/store/skillTreeSlice";

export type ItemTier = "normal" | "magic" | "rare" | "epic" | "legendary";

export const ALL_ITEM_TIERS: ReadonlyArray<ItemTier> = [
  "normal",
  "magic",
  "rare",
  "epic",
  "legendary",
];

export const TIER_UNLOCK_LEVEL: Record<ItemTier, number> = {
  normal: 1,
  magic: 3,
  rare: 8,
  epic: 20,
  legendary: 40,
};

export const TIER_AFFIX_COUNT: Record<ItemTier, number> = {
  normal: 1,
  magic: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

export const TIER_XP: Record<ItemTier, number> = {
  normal: 1,
  magic: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

interface TierProbRange {
  readonly min: number;
  readonly max: number;
}

const TIER_PROB_RANGES: Record<Exclude<ItemTier, "normal">, TierProbRange> = {
  magic: { min: 0.01, max: 0.30 },
  rare: { min: 0.01, max: 0.15 },
  epic: { min: 0.005, max: 0.05 },
  legendary: { min: 0.0001, max: 0.01 },
};

const PROB_MAX_LEVEL = 100;

export interface Affix {
  readonly kind: AffixKind;
  readonly magnitude: number;
}

/**
 * Affix kinds limited to ONE roll/affix per item. These are percent-chance
 * stats (crit strokes, combo chance) that shouldn't stack multiple rolls — a
 * single item with four combo affixes would trivialize the combo system.
 * Sell-price and speed are uncapped: they roll multiple times and aggregate.
 */
export const SINGLE_ROLL_AFFIX_KINDS: ReadonlySet<AffixKind> = new Set<AffixKind>([
  "+crit_chunks",
  "+combo_chance%",
]);

/**
 * Collapse an affix list to at most one entry per kind, so the same stat is
 * shown (and stored) as a single aggregated value. Uncapped kinds (sell-price,
 * speed) SUM their magnitudes — gameplay-neutral, since every multiplier sums
 * per kind anyway. Single-roll kinds (crit, combo) keep their largest single
 * magnitude, enforcing the max-one rule even on legacy multi-roll items.
 * Output order follows AFFIX_KINDS for stable display.
 */
export function aggregateAffixes(affixes: ReadonlyArray<Affix>): Affix[] {
  const byKind = new Map<AffixKind, number>();
  for (const a of affixes) {
    const prev = byKind.get(a.kind);
    if (prev === undefined) {
      byKind.set(a.kind, a.magnitude);
    } else if (SINGLE_ROLL_AFFIX_KINDS.has(a.kind)) {
      byKind.set(a.kind, Math.max(prev, a.magnitude));
    } else {
      byKind.set(a.kind, prev + a.magnitude);
    }
  }
  return AFFIX_KINDS.filter((k) => byKind.has(k)).map((k) => ({ kind: k, magnitude: byKind.get(k)! }));
}

/**
 * Compute the per-tier probability distribution at the given workshop level.
 * Linear interp from `(unlock_level, min)` to `(PROB_MAX_LEVEL, max)` for each
 * non-normal tier. `normal` fills the remainder so the distribution sums to 1.
 *
 * Tiers below their unlock level get probability 0.
 */
export function computeTierProbabilities(level: number): Record<ItemTier, number> {
  let nonNormalSum = 0;
  const out: Record<string, number> = {};
  for (const tier of ALL_ITEM_TIERS) {
    if (tier === "normal") continue;
    const range = TIER_PROB_RANGES[tier];
    const unlockLevel = TIER_UNLOCK_LEVEL[tier];
    if (level < unlockLevel) {
      out[tier] = 0;
      continue;
    }
    const span = PROB_MAX_LEVEL - unlockLevel;
    const t = span <= 0 ? 1 : Math.min(1, (level - unlockLevel) / span);
    const prob = range.min + (range.max - range.min) * t;
    out[tier] = prob;
    nonNormalSum += prob;
  }
  out.normal = Math.max(0, 1 - nonNormalSum);
  return out as Record<ItemTier, number>;
}

/** Roll a tier from the level's distribution. Uses module-global rng. */
export function rollTier(level: number): ItemTier {
  const probs = computeTierProbabilities(level);
  const r = rng();
  let acc = 0;
  for (const tier of ALL_ITEM_TIERS) {
    acc += probs[tier];
    if (r < acc) return tier;
  }
  return "normal"; // floating-point fallback
}

const KIND_TO_TRACK: Record<AffixKind, CanvasTrackId> = {
  "+sell_price%": "sell_price",
  "+speed%": "speed",
  "+crit_chunks": "crit",
  "+combo_chance%": "combo",
};

/** Available affix kinds at the player's current skill-tree state. */
function availableKinds(state: GameStore): ReadonlyArray<AffixKind> {
  return AFFIX_KINDS.filter((kind) => {
    const track = KIND_TO_TRACK[kind];
    return getCanvasTrackUnlocked(state, track);
  });
}

/**
 * Roll the affixes for an item of the given tier.
 *
 * Rolls `TIER_AFFIX_COUNT[tier]` times, then aggregates: same-kind rolls become
 * one affix (sell-price/speed sum; see `aggregateAffixes`), so the result has at
 * most one entry per kind. Crit + combo are `SINGLE_ROLL_AFFIX_KINDS`, capped at
 * one roll each — once picked they leave the pool, so the remaining rolls go to
 * the uncapped stats instead of stacking a second crit/combo.
 *
 * Pool is filtered by skill-tree unlocks: +crit_chunks / +combo_chance% only
 * roll when their matching `unlock_canvas_*` skill-tree node is owned.
 * Sell-price + speed always roll (their canvas tracks are unlocked from start).
 *
 * `magnitudeBonus` shifts BOTH the min and max magnitude bounds by the same
 * amount (Craftsmanship contribution from `getAffixMagnitudeBonus(state)`).
 */
export function rollAffixes(
  tier: ItemTier,
  state: GameStore,
  magnitudeBonus = 0,
  magnitudeMultiplier = 1,
): ReadonlyArray<Affix> {
  const count = TIER_AFFIX_COUNT[tier];
  if (availableKinds(state).length === 0) {
    throw new Error("rollAffixes: empty affix pool");
  }
  let pool = [...availableKinds(state)];
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    if (pool.length === 0) break; // only reachable if every kind is single-roll
    const kind = rngPick(pool);
    const range = AFFIX_MAGNITUDE_RANGE[tier][kind];
    const min = Math.round(range.min * magnitudeMultiplier) + magnitudeBonus;
    const max = Math.round(range.max * magnitudeMultiplier) + magnitudeBonus;
    const magnitude = rngInt(min, max);
    out.push({ kind, magnitude });
    if (SINGLE_ROLL_AFFIX_KINDS.has(kind)) {
      pool = pool.filter((k) => k !== kind);
    }
  }
  return aggregateAffixes(out);
}
