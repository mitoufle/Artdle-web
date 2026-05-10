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
export const TIER_UPGRADE_BASE = 100;
export const TIER_UPGRADE_RATIO = 2.78;
export const MAX_TIER = 10;
export const PM_LOG_FACTOR = 5.0;

// Workshop leveling — see docs/superpowers/specs/2026-05-06-workshop-leveling-design.md
export const MAX_WORKSHOP_LEVEL = 100;
export const CRAFT_COST_BASE = 100;
export const CRAFT_COST_EARLY_GROWTH = 1.05;  // L1..L5 — gentle ramp
export const CRAFT_COST_LATE_GROWTH = 1.20;   // L5+   — exponential climb
export const XP_PER_CRAFT = 1;

// ============================================================================
// Canvas depth — see docs/superpowers/specs/2026-05-10-canvas-depth-design.md
// ============================================================================
/** +10% gold per sell-price level (additive). */
export const SELL_PRICE_PER_LEVEL = 0.10;
/** +5% speed per speed level (additive). */
export const SPEED_PER_LEVEL = 0.05;
/** +30% gold per size level (additive on BASE). */
export const SIZE_GOLD_PER_LEVEL = 0.30;
/** +15% time per size level (additive on BASE). */
export const SIZE_TIME_PER_LEVEL = 0.15;
/** +1% crit chance per crit level. */
export const CRIT_PER_LEVEL = 0.01;
/** Crit canvases paint in `time / CRIT_SPEED_FACTOR`. Fixed at 10× (= 90% faster). */
export const CRIT_SPEED_FACTOR = 10;
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
export const fameOnAscend = (inspi: Big): number => {
  const n = inspi.toNumber();
  const log = Math.log10(Math.max(1, n));
  const x = log - FAME_THRESHOLD_LOG10;
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
 * Gold awarded when a canvas is sold, before equipped-item modifiers.
 * v1.1: scales as `BASE × tier² × multiplier`. The `tier²` substitutes for
 * the `quality × tier` shape from canvas-design.md §6.3 with `quality = tier`;
 * v1.3 will replace `tier × tier` with `quality × tier` (one-line drop-in).
 *
 * `multiplier` is the aggregated canvas-gold multiplier from skill tree + items
 * + PM mult (composed by the caller in `multipliers.ts`).
 */
export const canvasGold = (tier: number, multiplier: number): Big =>
  big(CANVAS_GOLD_BASE).mul(tier).mul(tier).mul(multiplier);

/**
 * Paint time per canvas in seconds, before paint-speed multipliers.
 * v1.1: `tier × 2`. Stripped form of canvas-design.md §6.5
 * (`tier * 2 + style * 1`) with style → 0; v1.3 adds the style term.
 *
 * Tier 1 = 2s, tier 5 = 10s (matches v1.0's PAINT_TIME_BASE_SECONDS),
 * tier 10 = 20s.
 */
export const canvasTime = (tier: number): number => tier * 2;

/**
 * Gold cost to upgrade canvas from `currentTier` to `currentTier + 1`.
 * Defined for currentTier ∈ [1, MAX_TIER - 1]; tier MAX_TIER has no upgrade.
 *
 * Calibration target (canvas-design.md §10): "100 → 1M g across 10 tiers".
 * `100 × 2.78^(currentTier - 1)` lands tier 1→2 at 100, tier 9→10 at ~357k.
 * Total path 1→10: ~558k.
 */
export const tierUpgradeCost = (currentTier: number): Big =>
  big(TIER_UPGRADE_BASE).mul(big(TIER_UPGRADE_RATIO).pow(currentTier - 1));

/**
 * Total PM accumulated at a given lifetime canvas gold.
 * v1.1 redesign (integer): PM ticks only when lifetimeGold crosses a multiple
 * of the current threshold. Phase 1 (lt < 1M): floor(lt / 1000), max 1000.
 * Phase 2 (1M ≤ lt < 1B): 1000 + floor((lt - 1M) / 1M), max 1999.
 * Each subsequent phase adds up to 999 PM as threshold ratchets ×1000.
 *
 * Returns Big for cross-precision arithmetic but the value is always
 * integer-valued.
 */
export const pmFromLifetime = (lt: Big): Big => {
  if (lt.lte(0)) return big(0);
  let pm = big(0);
  let phaseStart = big(0);
  let threshold = big(1000);
  // Upper bound on phases — generous but bounded to keep the loop terminating.
  // 30 phases covers lifetime gold up to 10^33; well past any reachable scenario.
  for (let i = 0; i < 30; i++) {
    if (lt.lte(phaseStart)) break;
    const phaseEnd = threshold.mul(1000);
    if (lt.gte(phaseEnd)) {
      // Full phase consumed.
      pm = pm.add(phaseEnd.sub(phaseStart).div(threshold).floor());
      phaseStart = phaseEnd;
      threshold = threshold.mul(1000);
    } else {
      // Partial phase.
      pm = pm.add(lt.sub(phaseStart).div(threshold).floor());
      break;
    }
  }
  return pm;
};

/**
 * Paint Mastery gained per canvas sale.
 * v1.1 integer redesign: gain = pmFromLifetime(lt + saleGold) - pmFromLifetime(lt).
 * Always integer. Sub-threshold sales return 0; ticks fire when crossing
 * a multiple of the current threshold.
 */
export const pmGainPerSale = (saleGold: Big, lifetimeGold: Big): Big => {
  if (saleGold.lte(0)) return big(0);
  const newLt = lifetimeGold.add(saleGold);
  const diff = pmFromLifetime(newLt).sub(pmFromLifetime(lifetimeGold));
  // Guard against break_eternity's -0 on equal subtraction.
  return diff.lte(0) ? big(0) : diff;
};

/**
 * Paint Mastery multiplier on canvas gold output.
 * `1 + PM_LOG_FACTOR × log10(pm + 1)`. Returns a plain number — composes with
 * existing `getCanvasGoldMultiplier` (additive `1 + Σ`) by simple multiplication
 * at the call site.
 *
 * At PM = 0: returns 1 exactly. At PM = 1e10: returns ~51. The log shape
 * preserves the rescope spec's "pas ×1000" intent even at factor 5.0.
 *
 * Saturates `pm.toNumber()` at Number.MAX_SAFE_INTEGER (~9e15); v1.1 stays
 * well below that.
 */
export const pmMult = (pm: Big): number =>
  1 + PM_LOG_FACTOR * Math.log10(pm.toNumber() + 1);

/**
 * Inspiration produced per second from a list of tree parts and an aggregate multiplier.
 */
export interface TreePartLevel {
  readonly level: number;
  readonly rate: number; // base inspi/sec at level=1
}

export const inspiPerSec = (
  parts: ReadonlyArray<TreePartLevel>,
  multiplier: number,
): Big =>
  parts
    .reduce((acc, p) => acc.add(big(p.level).mul(p.rate)), big(0))
    .mul(multiplier);

/**
 * Cost-per-PM at the given lifetime canvas gold.
 * v1.1 PM redesign: rate ratchets down by 1000× at each milestone.
 *
 * Returns:
 * - 1000 g per PM while lifetime gold < 1M
 * - 1M g per PM while 1M ≤ lifetime gold < 1B
 * - 1B g per PM while 1B ≤ lifetime gold < 1T
 * - 1T g per PM while 1T ≤ lifetime gold < 1Q
 * - ...
 *
 * Formula: max(1000, 10^(3 × floor(log10(lifetimeGold) / 3))).
 *
 * The pmGainPerSale(saleGold, lifetimeGold) function divides saleGold by this
 * threshold to compute PM gain. As lifetime gold grows by 1000×, each new PM
 * costs 1000× more gold — log-shaped accumulation by design.
 */
export const pmThreshold = (lifetimeGold: Big): Big => {
  const lt = lifetimeGold.toNumber();
  if (lt <= 0) return big(1000);
  const phase = Math.floor(Math.log10(lt) / 3);
  const exp = Math.max(3, 3 * phase);
  return big(10).pow(exp);
};

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
