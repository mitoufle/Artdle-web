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
/** +15% gold per sell-price level (additive). */
export const SELL_PRICE_PER_LEVEL = 0.15;
/** +15% speed per speed level (additive). Matched to SELL_PRICE_PER_LEVEL so the two
 *  canvas-depth tracks have identical marginal efficiency (same cost curve, same per-level %). */
export const SPEED_PER_LEVEL = 0.15;
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
export const CRIT_COST_BASE = 5000;
export const COMBO_COST_BASE = 5000;
/** Shared exponential growth factor for all 5 track cost curves: cost = base × growth^(level-1). */
export const TRACK_COST_GROWTH = 1.5;

/**
 * Multiplier on base canvas gold at canvas tier T.
 * `tierFactor(1) = 1`, `tierFactor(2) = 10`, `tierFactor(3) = 100`, ...
 *
 * Used by `canvasGold(mult, tier)` and `goldPerChunk(...)` to scale base
 * canvas gold. The ×10/tier ramp matches the spec's prestige design — see
 * `docs/superpowers/specs/2026-05-23-canvas-tier-system-design.md`.
 */
export const tierFactor = (tier: number): number => Math.pow(10, tier - 1);

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
 * Inspiration produced per second from a list of tree parts and an aggregate multiplier.
 */
export interface TreePartLevel {
  readonly level: number;
  readonly rate: number; // base inspi/sec at level=1
}

/**
 * Level thresholds at which a tree upgrade's output gets a milestone multiplier.
 * Back-loaded: the big jumps live at 400/800/1000 so deep-leveling an OLD upgrade
 * is a deliberate late-game investment that lets it catch up to the frontier tier.
 * TUNABLE (shape locked: 8 back-loaded milestones).
 */
export const PART_MILESTONES: ReadonlyArray<number> = [10, 25, 50, 100, 200, 400, 800, 1000];

/** Per-milestone multiplier, index-aligned with PART_MILESTONES. Cumulative product
 *  at L1000 ≈ ×34,560 — enough to offset a ×5-per-tier base-rate gap. TUNABLE. */
export const PART_MILESTONE_FACTORS: ReadonlyArray<number> = [2, 2, 3, 3, 4, 5, 6, 8];

/** Product of the factors of every milestone the level has reached. */
export const getPartMilestoneMultiplier = (level: number): number => {
  let mult = 1;
  for (let i = 0; i < PART_MILESTONES.length; i++) {
    if (level >= PART_MILESTONES[i]!) mult *= PART_MILESTONE_FACTORS[i]!;
  }
  return mult;
};

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
 * For tracks starting at L0, first buy uses formula(0) = base. No level cap.
 *
 * Tier-scaling lives on the separate `tierUpgradeCost(currentTier)` dial — the four
 * within-tier track costs are tier-independent.
 */
export const sellPriceUpgradeCost = (currentLevel: number): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const speedUpgradeCost = (currentLevel: number): Big =>
  big(SPEED_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

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
/** basic_technique: +10% canvas speed per level (additive). */
export const BASIC_TECHNIQUE_PER_LEVEL = 0.10;
/** muscle_memory: +10% canvas speed per level (additive). */
export const MUSCLE_MEMORY_PER_LEVEL = 0.10;
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

export const WORKER_XP_BASE = 1000;
export const WORKER_XP_GROWTH = 1.5;

/** Cost (xp = ascend fame) to go from `level` → `level + 1`. Worker.level starts
 *  at 1, so the first level-up uses level=1 → BASE. Curve: 1000 × 1.5^(level-1)
 *  → 1000, 1500, 2250, 3375, … (eased from 3000 × 1.9 — XP was too punishing
 *  relative to the per-ascend fame pool; see GitHub issue #4). */
export const workerXpToNext = (level: number, growth: number = WORKER_XP_GROWTH): Big =>
  big(WORKER_XP_BASE).mul(big(growth).pow(level - 1));

// ============================================================================
// Worker stat model — redesigned Painter's Office (autonomous painters).
// See docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md.
// TUNABLE values; the stat set + roll shape are locked.
// ============================================================================

/** A level-1 worker ≈ a fresh painter. */
export const WORKER_BASE_STATS = Object.freeze({
  goldPct: 0,        // additive fraction → gold multiplier = 1 + goldPct
  speed: 1,          // stroke-rate multiplier (interval = BASE_CHUNK_INTERVAL / speed)
  critChance: 0.01,  // per-stroke crit probability (capped at WORKER_CRIT_CHANCE_CAP)
  strokesPerCrit: 1, // integer bonus chunks per crit
  comboChance: 0,    // combo trigger probability when this worker completes a sale
});

/** Per-level-up increment options for the four fractional stats: +0..+5pp in 1-pt steps. */
export const WORKER_PCT_INCREMENTS: ReadonlyArray<number> = [0, 0.01, 0.02, 0.03, 0.04, 0.05];

/** Per-level-up increment options for strokes-per-crit: +0 or +1. */
export const WORKER_STROKES_PER_CRIT_INCREMENTS: ReadonlyArray<number> = [0, 1];

/** Hard ceiling on a worker's crit chance. */
export const WORKER_CRIT_CHANCE_CAP = 0.5;

// ── Office skill-node worker bonuses (2026-06-01 design submission) ──────────
// These modify a worker's SPAWN base stats / XP curve. Existing workers keep
// the stats they were hired with; only newly-spawned workers get the boosts.
/** food_regulation: +1 native step to every spawn base stat — +0.01 to the four
 *  fractional stats (1 percentage point, matching WORKER_PCT_INCREMENTS) … */
export const FOOD_REGULATION_PCT_STEP = 0.01;
/** … and +1 to strokesPerCrit (matching WORKER_STROKES_PER_CRIT_INCREMENTS). */
export const FOOD_REGULATION_STROKES_STEP = 1;
/** robin_hood: +7% to a worker's spawn goldPct base, per level (maxLevel 5). */
export const ROBIN_HOOD_GOLDPCT_PER_LEVEL = 0.07;
/** blury_hand: +10% to a worker's spawn speed base, per level (maxLevel 1). */
export const BLURY_HAND_SPEED_PER_LEVEL = 0.10;
/** learning_curve: each level lowers the worker XP growth multiplier by 0.05
 *  (1.5 → 1.45 at maxLevel), gently flattening the curve while keeping it
 *  exponential. Floored at WORKER_XP_GROWTH_FLOOR so it can never go flat. */
export const LEARNING_CURVE_GROWTH_REDUCTION = 0.05;
export const WORKER_XP_GROWTH_FLOOR = 1.0;

/** Ascend-XP pool split: this fraction is distributed EQUALLY across the roster
 *  (the baseline floor — so a fresh / zero-stroke worker still climbs); the
 *  remainder is distributed by each worker's strokesThisRun share. TUNABLE
 *  (central knob per spec §4.1). */
export const WORKER_BASELINE_XP_FRACTION = 0.5;

/** Accelerator (worker_xp_mult capability): +10% to the worker ascend-XP pool per level. */
export const ACCELERATOR_XP_PER_LEVEL = 0.10;

