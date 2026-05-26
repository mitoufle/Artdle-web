import { big, type Big } from "./bigNumber";

// ============================================================================
// Tuning constants — touchable in the v1 balance pass (Phase 6).
// ============================================================================

/** Fame curve: `max(1, floor((log10(inspi) - threshold)^FAME_POWER * FAME_SCALE))`,
 *  hard 0 below threshold. Threshold = 4 → 10,000 inspi gate. */
export const FAME_THRESHOLD_LOG10 = 4;
export const FAME_POWER = 5;
export const FAME_SCALE = 3.2;
export const TREE_PART_COST_GROWTH = 1.15;
export const CANVAS_GOLD_BASE = 10;

// Workshop leveling — see docs/superpowers/specs/2026-05-06-workshop-leveling-design.md
export const MAX_WORKSHOP_LEVEL = 100;
export const CRAFT_COST_BASE = 100;
export const CRAFT_COST_EARLY_GROWTH = 1.05;  // L1..L5 — gentle ramp
export const CRAFT_COST_LATE_GROWTH = 1.20;   // L5+   — exponential climb

// Workshop Taylorism (auto-craft) — base interval & per-level reduction from third_hand.
export const TAYLORISM_INTERVAL_S = 10;
export const THIRD_HAND_INTERVAL_REDUCTION = 0.10; // fraction reduced per level

// ============================================================================
// Canvas depth — see docs/superpowers/specs/2026-05-10-canvas-depth-design.md
// ============================================================================
/** +10% gold per sell-price level (additive). */
export const SELL_PRICE_PER_LEVEL = 0.10;
/** +5% speed per speed level (additive). */
export const SPEED_PER_LEVEL = 0.05;
/**
 * +15% size per canvas size-track level (additive into the single `size` value).
 * Size 1 is the base canvas. Gold scales as size², time scales as size¹ —
 * so doubling size quadruples gold and doubles time.
 */
export const SIZE_PER_LEVEL = 0.15;
/** +1% crit chance per crit level. */
export const CRIT_PER_LEVEL = 0.01;
/** Always-on crit chance floor. Skill-tree + critLevel sum on top, then soft-cap formula. */
export const BASE_CRIT_CHANCE = 0.01;
/** Bonus chunks added by a crit at base (no items/workers). 1 = "trigger + 1 extra chunk". */
export const BASE_CRIT_CHUNKS = 1;
/** Hard cap on the critLevel upgrade track. Past this, levels can't be purchased. */
export const MAX_CRIT_LEVEL = 50;
/**
 * Below this raw crit value the formula is linear (no compression).
 * Above it, diminishing returns kick in — the curve asymptotes at CRIT_SOFT_CAP_CEILING.
 */
export const CRIT_SOFT_CAP_THRESHOLD = 0.30;
/** Hard ceiling — effective crit asymptotes here; cannot exceed this value. */
export const CRIT_SOFT_CAP_CEILING = 0.95;
/** +2% base combo chance per combo level. */
export const COMBO_PER_LEVEL = 0.02;
/** +10% gold per chain link. */
export const COMBO_PER_LINK = 0.10;
/** -5 percentage points off effective combo chance per current chain link. */
export const COMBO_DECAY_PER_LINK = 0.05;

/** Cost in gold at level 1 for the sell-price upgrade. */
export const SELL_PRICE_COST_BASE = 100;
export const SPEED_COST_BASE = 100;
export const SIZE_COST_BASE = 1000;
export const CRIT_COST_BASE = 5000;
export const COMBO_COST_BASE = 5000;
/** Shared exponential growth factor for all 5 track cost curves: cost = base × growth^(level-1). */
export const TRACK_COST_GROWTH = 1.5;

/** Base paint time at sizeLevel = 0, before speed multipliers. Matches the v1.1 tier-1 baseline. */
export const CANVAS_TIME_BASE = 10;

/**
 * Multiplier on base canvas gold at canvas tier T.
 * `tierFactor(1) = 1`, `tierFactor(2) = 10`, `tierFactor(3) = 100`, ...
 *
 * Used by `canvasGold(size, mult, tier)` to scale base canvas gold.
 * Cost scaling lives on `costTierFactor` so the two can be tuned independently.
 *
 * The ×10/tier ramp matches the spec's prestige design — see
 * `docs/superpowers/specs/2026-05-23-canvas-tier-system-design.md`.
 */
export const tierFactor = (tier: number): number => Math.pow(10, tier - 1);

/**
 * Growth base for upgrade-cost tier scaling. Decoupled from `tierFactor` (which
 * scales base canvas gold ×10/tier) so the cost-side curve can be tuned
 * independently. Set to 20 to eliminate the T3→T4 mid-tier inversion observed
 * in `tests/dev/bot-simulation.test.ts` — see
 * `docs/superpowers/plans/2026-05-24-canvas-tier-cost-rebalance.md`.
 */
export const COST_GROWTH_BASE = 20;

/**
 * Multiplier on upgrade costs at canvas tier T. `costTierFactor(1) = 1`,
 * `costTierFactor(2) = COST_GROWTH_BASE`, etc. Used by the five
 * `*UpgradeCost(level, tier)` functions in this file.
 *
 * Distinct from `tierFactor` (which scales base canvas gold). Splitting them
 * lets us make tier-ups progressively harder to clear without weakening the
 * immediate gold boost players feel on tier-up.
 */
export const costTierFactor = (tier: number): number =>
  Math.pow(COST_GROWTH_BASE, tier - 1);

/**
 * Multiplier on base canvas paint time at tier T. `timeFactor(1) = 1`,
 * `timeFactor(2) = 2`, `timeFactor(4) = 8`. Time grows linearly per tier while
 * gold grows by ×10 — so gold/sec at base scales by ×5 per tier.
 */
export const timeFactor = (tier: number): number => Math.pow(2, tier - 1);

// ============================================================================
// Chunk-domain constants — see 2026-05-26-canvas-chunk-domain-design.md
// ============================================================================

/** Seconds per chunk at speed multiplier = 1.0 (no speed upgrades). Players
 *  reduce this via the speed upgrade, skill nodes, items, workers. */
export const BASE_CHUNK_INTERVAL = 5;

/** Base gold per chunk before any multipliers, at T1. Compose with
 *  `tierFactor(T)` × `getCanvasGoldMultiplier(state)`. Picked so T1
 *  total canvas gold = chunks(1) × 1 = 10, matching old `CANVAS_GOLD_BASE`. */
export const BASE_GOLD_PER_CHUNK = 1;

/** Tier-upgrade cost ramp: cost(currentTier) = 1000^currentTier (T1→T2 = 1k,
 *  T2→T3 = 1M, T3→T4 = 1B, ...). Steep on purpose; spec calls for ~1 hour
 *  of preceding within-tier upgrade work before each tier-up. */
export const TIER_UPGRADE_COST_BASE = 1000;

/** Visual cell render cap. Beyond T7 (where chunks(T) > 640), chunks
 *  decouple from cells: each cell represents `ceil(chunks(T) / cells)`
 *  chunks. Per-frame render cost stays O(in-flight) thanks to the
 *  rasterized-canvas + drip-fed in-flight pool from the 2026-05-25 rework. */
export const CELL_RENDER_CAP = 640;

/** Total chunks to fill canvas at tier T. `chunksPerCanvas(1) = 10`,
 *  doubles per tier indefinitely. */
export const chunksPerCanvas = (tier: number): number =>
  10 * Math.pow(2, Math.max(1, tier) - 1);

/** Gold paid when one chunk completes. Caller composes `mult` via
 *  `getCanvasGoldMultiplier(state)` (which already folds in sellPriceLevel,
 *  items, workers, color tree, rainbow, achievements, school). */
export const goldPerChunk = (
  _sellPriceLevel: number,
  mult: number,
  tier: number,
): Big => big(BASE_GOLD_PER_CHUNK).mul(mult).mul(tierFactor(tier));

/** Gold cost to advance from currentTier to currentTier+1. Idiom matches
 *  the `*UpgradeCost(currentLevel)` pattern elsewhere in this file. */
export const tierUpgradeCost = (currentTier: number): Big =>
  big(TIER_UPGRADE_COST_BASE).pow(Math.max(1, currentTier));

/** Seconds between auto-paints of a single chunk, given the current
 *  speed multiplier. Floors at BASE_CHUNK_INTERVAL when multiplier <= 0
 *  (defensive — no caller should pass non-positive, but cheap to guard). */
export const chunkInterval = (speedMultiplier: number): number =>
  speedMultiplier > 0 ? BASE_CHUNK_INTERVAL / speedMultiplier : BASE_CHUNK_INTERVAL;

// ============================================================================
// Formulas
// ============================================================================

/**
 * Fame gained from converting a given inspiration amount.
 *
 * `max(1, floor((log10(inspi) - 4)^5 * 3.2))` for inspi ≥ 10,000; hard 0 below.
 * Quintic-in-log over the 10k threshold — slows in log-log so end-game fame
 * stays in a tractable range while early ascends still feel meaningful.
 *
 * Curve shape:
 *   - 9,999 inspi:    0 fame (blocked by canAscend)
 *   - 10,000 inspi:   1 fame  (first viable ascend, clamped)
 *   - 100,000 inspi:  3 fame
 *   - 1,000,000 inspi: 102 fame
 *   - 10,000,000 inspi: 777 fame
 *   - 100,000,000 inspi: 3,276 fame
 *   - 1,000,000,000 inspi: 10,000 fame
 */
export const fameOnAscend = (inspi: Big, thresholdReduction = 0): number => {
  const n = inspi.toNumber();
  const log = Math.log10(Math.max(1, n));
  const effectiveThreshold = FAME_THRESHOLD_LOG10 * (1 - thresholdReduction);
  const x = log - effectiveThreshold;
  if (x < 0) return 0;
  return Math.max(1, Math.floor(Math.pow(x, FAME_POWER) * FAME_SCALE));
};

/**
 * Cost in gold to upgrade a tree part from `level` to `level + 1`.
 * Geometric progression on TREE_PART_COST_GROWTH.
 */
export const treePartCost = (level: number, baseCost: number): Big =>
  big(baseCost).mul(big(TREE_PART_COST_GROWTH).pow(level));

/**
 * Gold awarded by a complete canvas at tier T. Chunk-domain: this equals
 * `chunksPerCanvas(T) × goldPerChunk(...)`. Kept as a separate helper for
 * UI sites that want the lump-sum display (StatsRoom, BoundCanvasStage's
 * "next sale" preview). The engine pays per-chunk via `goldPerChunk`.
 */
export const canvasGold = (multiplier: number, tier = 1): Big =>
  big(CANVAS_GOLD_BASE).mul(multiplier).mul(tierFactor(tier));

/**
 * Paint time per canvas in seconds, before speed/crit modifiers.
 * `time = CANVAS_TIME_BASE × size × timeFactor(tier)`. Linear scaling: doubling
 * the canvas doubles the time. Combined with size² gold, this means gold-per-second
 * scales linearly with size — bigger canvas = strictly more efficient.
 * Tier scales base time by ×2 per tier step — `timeFactor(1) = 1` (no change at T1),
 * `timeFactor(2) = 2`, `timeFactor(4) = 8`. Gold grows ×10/tier while time grows
 * ×2/tier, so net gold/sec scales ×5 per tier.
 *
 * size = 1, tier = 1 (no upgrades, no items, no workers) ⇒ time = CANVAS_TIME_BASE = 10s.
 */
export const canvasTime = (size: number, tier = 1): number =>
  CANVAS_TIME_BASE * size * timeFactor(tier);

/**
 * Inspiration produced per second from a list of tree parts and an aggregate multiplier.
 */
export interface TreePartLevel {
  readonly level: number;
  readonly rate: number; // base inspi/sec at level=1
}

/**
 * Level thresholds at which a tree part's output doubles (compounding).
 * Reaching level 10 → ×2, level 25 → ×4, level 50 → ×8, etc.
 */
export const PART_MILESTONES: ReadonlyArray<number> = [10, 25, 50, 100, 200, 400];

/** 2^(count of milestones the part level has crossed). */
export const getPartMilestoneMultiplier = (level: number): number =>
  Math.pow(2, PART_MILESTONES.filter((m) => level >= m).length);

/** Next milestone the part hasn't yet reached, or null if all passed. */
export const getNextPartMilestone = (level: number): number | null =>
  PART_MILESTONES.find((m) => m > level) ?? null;

/** True when buying one more level would hit the next milestone exactly. */
export const isApproachingMilestone = (level: number): boolean => {
  const next = getNextPartMilestone(level);
  return next !== null && next - level === 1;
};

export const inspiPerSec = (
  parts: ReadonlyArray<TreePartLevel>,
  multiplier: number,
): Big =>
  parts
    .reduce(
      (acc, p) => acc.add(big(p.level).mul(p.rate).mul(getPartMilestoneMultiplier(p.level))),
      big(0),
    )
    .mul(multiplier);

/**
 * Cost in gold per craft attempt at the given workshop level.
 * Piecewise: gentle 1.05 ramp through L5; 1.20 climb afterward.
 */
export const craftCost = (level: number): Big => {
  if (level <= 5) {
    return big(CRAFT_COST_BASE).mul(big(CRAFT_COST_EARLY_GROWTH).pow(level - 1));
  }
  const costAtL5 = big(CRAFT_COST_BASE).mul(big(CRAFT_COST_EARLY_GROWTH).pow(4));
  return costAtL5.mul(big(CRAFT_COST_LATE_GROWTH).pow(level - 5));
};

/**
 * XP needed to advance from `currentLevel` to `currentLevel + 1`.
 * Linear in level: `4 * (currentLevel + 1)`. Cumulative to L70 ≈ 9,936 crafts.
 */
export const xpToNext = (currentLevel: number): number => 4 * (currentLevel + 1);

/**
 * Gold cost to upgrade a track from `currentLevel` to `currentLevel + 1`.
 * Shared shape: `BASE × TRACK_COST_GROWTH^currentLevel × costTierFactor(tier)`.
 * Per-track BASEs differ; tier scales the entire curve by COST_GROWTH_BASE per
 * tier step (`costTierFactor(1) = 1` — no change at T1).
 *
 * Mirrors the contract of `craftCost(level)` — the parameter is the CURRENT level (the player's
 * stored value), and the function returns the cost of the NEXT step.
 *
 * For tracks starting at L0 (size/crit/combo), first buy uses formula(0) = base × costTierFactor.
 * For tracks starting at L1 (sell-price/speed), first buy uses formula(1) = base × 1.5 × costTierFactor.
 * No level cap.
 */
export const sellPriceUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(costTierFactor(tier));

export const speedUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SPEED_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(costTierFactor(tier));

export const sizeUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(SIZE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(costTierFactor(tier));

export const critUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(CRIT_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(costTierFactor(tier));

export const comboUpgradeCost = (currentLevel: number, tier = 1): Big =>
  big(COMBO_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel)).mul(costTierFactor(tier));

/**
 * Multiplier on canvas gold from the current combo chain.
 * `1 + COMBO_PER_LINK × chain`. chain=0 → 1.0 (no bonus).
 */
export const comboBonusFactor = (chain: number): number =>
  1 + COMBO_PER_LINK * chain;

/**
 * Effective combo trigger chance after decay-per-link is applied.
 * `base × (1 - decay × chain)`, clamped at 0 (no negative chance).
 * `decay` defaults to `COMBO_DECAY_PER_LINK`; callers can pass a reduced
 * value when capability tags (e.g., `combo_decay_reduction`) apply.
 */
export const comboEffectiveChance = (
  base: number,
  chain: number,
  decay: number = COMBO_DECAY_PER_LINK,
): number => Math.max(0, base * (1 - decay * chain));

// ============================================================================
// Skill-node effect constants (tuning numbers only — formulas stay in multipliers.ts)
// ============================================================================

/** Per-color additive gold bonus per level. Tier-scaled: root +50%, primaries +80%,
 *  secondaries +130%, tertiaries +200%. Full color tree = +1280% (13.80× base before rainbow). */
export const COLOR_PER_LEVEL: Readonly<Record<string, number>> = {
  black_white: 0.50,
  magenta: 0.80,
  cyan: 0.80,
  yellow: 0.80,
  red: 1.30,
  green: 1.30,
  blue: 1.30,
  purple: 2.00,
  brown: 2.00,
  orange: 2.00,
};
/** Rainbow stacks multiplicatively: × (1 + RAINBOW_PER_LEVEL × level). */
export const RAINBOW_PER_LEVEL = 5.00;
/** get_inspired: +50% inspi rate per level (additive). */
export const GET_INSPIRED_PER_LEVEL = 0.50;
/** basic_technique: +5% canvas speed per level (additive). */
export const BASIC_TECHNIQUE_PER_LEVEL = 0.05;
/** muscle_memory: +5% canvas speed per level (additive). */
export const MUSCLE_MEMORY_PER_LEVEL = 0.05;
/** Bargain: -5% tree upgrade cost per level (additive discount). */
export const BARGAIN_PER_LEVEL = 0.05;
/** Tree upgrade cost can never drop below 50% of base, regardless of Bargain level. */
export const BARGAIN_DISCOUNT_FLOOR = 0.5;
/** Craftsmanship: +5 percentage points to affix min/max per level. */
export const CRAFTSMANSHIP_PER_LEVEL = 5;
/** better_scaling: +1 pp to affix bounds per workshop level (per node level). */
export const BETTER_SCALING_PER_WORKSHOP_LEVEL = 1;

// ============================================================================
// Painter's Office formulas
// ============================================================================

export const LEVEL_SCALE_GROWTH = 1.04;

export const levelScale = (level: number): Big =>
  big(LEVEL_SCALE_GROWTH).pow(level);

export const WORKER_XP_BASE = 10;
export const WORKER_XP_GROWTH = 1.15;
export const OFFICE_XP_BASE = 50;
export const OFFICE_XP_GROWTH = 1.30;

export const workerXpToNext = (level: number): Big =>
  big(WORKER_XP_BASE).mul(big(WORKER_XP_GROWTH).pow(level));

export const officeXpToNext = (level: number): Big =>
  big(OFFICE_XP_BASE).mul(big(OFFICE_XP_GROWTH).pow(level));

export const TRICKLE_BASE_SECONDS = 60;
export const TRICKLE_DECAY = 0.97;
export const TRICKLE_FLOOR_SECONDS = 5;

export const trickleSeconds = (officeLevel: number): number =>
  Math.max(TRICKLE_FLOOR_SECONDS, TRICKLE_BASE_SECONDS * Math.pow(TRICKLE_DECAY, officeLevel));

export type WorkerTier = "common" | "magic" | "rare" | "epic" | "legendary";
export const ALL_WORKER_TIERS: ReadonlyArray<WorkerTier> = [
  "common", "magic", "rare", "epic", "legendary",
];

export const OFFICE_TIER_UNLOCK_LEVEL: Record<WorkerTier, number> = {
  common: 1, magic: 3, rare: 8, epic: 20, legendary: 40,
};

export const OFFICE_TIER_AFFIX_COUNT: Record<WorkerTier, number> = {
  common: 1, magic: 2, rare: 3, epic: 4, legendary: 5,
};

interface TierProbRange { readonly min: number; readonly max: number; }
const OFFICE_TIER_PROB_RANGES: Record<Exclude<WorkerTier, "common">, TierProbRange> = {
  magic:     { min: 0.05, max: 0.30 },
  rare:      { min: 0.05, max: 0.25 },
  epic:      { min: 0.05, max: 0.20 },
  legendary: { min: 0.05, max: 0.15 },
};

const OFFICE_PROB_MAX_LEVEL = 100;

export function computeOfficeTierProbabilities(officeLevel: number): Record<WorkerTier, number> {
  let nonCommonSum = 0;
  const out: Record<string, number> = {};
  for (const tier of ALL_WORKER_TIERS) {
    if (tier === "common") continue;
    const range = OFFICE_TIER_PROB_RANGES[tier];
    const unlock = OFFICE_TIER_UNLOCK_LEVEL[tier];
    if (officeLevel < unlock) { out[tier] = 0; continue; }
    const span = OFFICE_PROB_MAX_LEVEL - unlock;
    const t = span <= 0 ? 1 : Math.min(1, (officeLevel - unlock) / span);
    const prob = range.min + (range.max - range.min) * t;
    out[tier] = prob;
    nonCommonSum += prob;
  }
  out.common = Math.max(0, 1 - nonCommonSum);
  return out as Record<WorkerTier, number>;
}

export const HIRE_TIER_BASE: Record<WorkerTier, number> = {
  common: 100, magic: 1_000, rare: 10_000, epic: 100_000, legendary: 1_000_000,
};
export const HIRE_QUALITY_MAX = 5;
export const HIRE_OFFICE_LEVEL_GROWTH = 1.10;
export const XP_GOLD_FRACTION = 0.01;

interface HireCostInput {
  readonly tier: WorkerTier;
  readonly magnitudeSum: number;
  readonly minMagnitudeSum: number;
  readonly maxMagnitudeSum: number;
}

export function hireCost(input: HireCostInput, officeLevel: number): Big {
  const range = input.maxMagnitudeSum - input.minMagnitudeSum;
  const ratio = range > 0
    ? Math.min(1, Math.max(0, (input.magnitudeSum - input.minMagnitudeSum) / range))
    : 0;
  const qualityFactor = 1 + (HIRE_QUALITY_MAX - 1) * ratio;
  return big(HIRE_TIER_BASE[input.tier])
    .mul(qualityFactor)
    .mul(big(HIRE_OFFICE_LEVEL_GROWTH).pow(officeLevel));
}
