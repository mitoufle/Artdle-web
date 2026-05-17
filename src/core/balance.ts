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
export const PAINT_TIME_BASE_SECONDS = 10;
export const PM_LOG_FACTOR = 5.0;

// Workshop leveling — see docs/superpowers/specs/2026-05-06-workshop-leveling-design.md
export const MAX_WORKSHOP_LEVEL = 100;
export const CRAFT_COST_BASE = 100;
export const CRAFT_COST_EARLY_GROWTH = 1.05;  // L1..L5 — gentle ramp
export const CRAFT_COST_LATE_GROWTH = 1.20;   // L5+   — exponential climb

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
/** Crit canvases paint in `time / CRIT_SPEED_FACTOR`. Fixed at 10× (= 90% faster). */
export const CRIT_SPEED_FACTOR = 10;
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
export const CANVAS_TIME_BASE = 2;

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
 * Gold awarded when a canvas is sold, before sell-price / PM / combo modifiers.
 * `gold = CANVAS_GOLD_BASE × size² × multiplier`. Size² scaling is the design
 * relationship: doubling the canvas quadruples the gold.
 */
export const canvasGold = (size: number, multiplier: number): Big =>
  big(CANVAS_GOLD_BASE).mul(size * size).mul(multiplier);

/**
 * Paint time per canvas in seconds, before speed/crit modifiers.
 * `time = CANVAS_TIME_BASE × size`. Linear scaling: doubling the canvas
 * doubles the time. Combined with size² gold, this means gold-per-second
 * scales linearly with size — bigger canvas = strictly more efficient.
 *
 * size = 1 (no upgrades, no items, no workers) ⇒ time = CANVAS_TIME_BASE = 2s.
 */
export const canvasTime = (size: number): number =>
  CANVAS_TIME_BASE * size;

/**
 * Paint Mastery multiplier on canvas gold output.
 * `1 + PM_LOG_FACTOR × log10(pm + 1)`. Returns a plain number — composes with
 * existing `getCanvasGoldMultiplier` (additive `1 + Σ`) by simple multiplication
 * at the call site.
 *
 * At PM = 0: returns 1 exactly. At PM = 1e10: returns ~51. The log shape
 * preserves the rescope spec's "pas ×1000" intent even at factor 5.0.
 *
 * Uses Big.log10() natively — supports PM far beyond Number.MAX_SAFE_INTEGER
 * without saturation.
 */
export const pmMult = (pm: Big): number => {
  // Big.log10() handles values far beyond Number.MAX_SAFE_INTEGER natively.
  // For pm = 0, log10(1) = 0 → returns 1 exactly.
  return 1 + PM_LOG_FACTOR * pm.add(1).log10().toNumber();
};

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
 * Shared shape: `BASE × TRACK_COST_GROWTH^currentLevel`. Per-track BASEs differ.
 *
 * Mirrors the contract of `craftCost(level)` — the parameter is the CURRENT level (the player's
 * stored value), and the function returns the cost of the NEXT step.
 *
 * For tracks starting at L0 (size/crit/combo), first buy uses formula(0) = base.
 * For tracks starting at L1 (sell-price/speed), first buy uses formula(1) = base × 1.5.
 * No level cap.
 */
export const sellPriceUpgradeCost = (currentLevel: number): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const speedUpgradeCost = (currentLevel: number): Big =>
  big(SPEED_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const sizeUpgradeCost = (currentLevel: number): Big =>
  big(SIZE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const critUpgradeCost = (currentLevel: number): Big =>
  big(CRIT_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const comboUpgradeCost = (currentLevel: number): Big =>
  big(COMBO_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

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

/** Per-color additive gold bonus per level. Tier-scaled: root +20%, primaries +30%,
 *  secondaries +40%, tertiaries +50%. Full color tree = +380% (4.80× base before rainbow). */
export const COLOR_PER_LEVEL: Readonly<Record<string, number>> = {
  black_white: 0.20,
  magenta: 0.30,
  cyan: 0.30,
  yellow: 0.30,
  red: 0.40,
  green: 0.40,
  blue: 0.40,
  purple: 0.50,
  brown: 0.50,
  orange: 0.50,
};
/** Rainbow stacks multiplicatively: × (1 + RAINBOW_PER_LEVEL × level). */
export const RAINBOW_PER_LEVEL = 0.50;
/** get_inspired: +25% inspi rate per level (additive). */
export const GET_INSPIRED_PER_LEVEL = 0.25;
/** basic_technique: +2% canvas speed per level (additive). */
export const BASIC_TECHNIQUE_PER_LEVEL = 0.02;
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
