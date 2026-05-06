import { rng, rngInt, rngPick } from "@/core/rng";
import { AFFIX_KINDS, MAGNITUDE_MIN_PCT, MAGNITUDE_MAX_PCT } from "@/config/workshopAffixes";
import type { AffixKind } from "@/config/workshopAffixes";

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
  magic: 5,
  rare: 15,
  epic: 35,
  legendary: 70,
};

export const TIER_AFFIX_COUNT: Record<ItemTier, number> = {
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

/**
 * Roll the affixes for an item of the given tier. Duplicate kinds allowed.
 *
 * `magnitudeBonus` shifts BOTH the min and max magnitude bounds by the same
 * amount (so the spread stays MAX - MIN). Skill-tree Craftsmanship contributes
 * via `getAffixMagnitudeBonus(state)`.
 */
export function rollAffixes(tier: ItemTier, magnitudeBonus = 0): ReadonlyArray<Affix> {
  const count = TIER_AFFIX_COUNT[tier];
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const kind = rngPick(AFFIX_KINDS);
    const min = MAGNITUDE_MIN_PCT + magnitudeBonus;
    const max = MAGNITUDE_MAX_PCT + magnitudeBonus;
    const magnitude = rngInt(min, max);
    out.push({ kind, magnitude });
  }
  return out;
}
