import { big, type Big } from "./bigNumber";

// ============================================================================
// Tuning constants — touchable in the v1 balance pass (Phase 6).
// ============================================================================

export const PALIER_BASE = 1000;
export const PALIER_GROWTH = 2;
export const FAME_LOG_K = 10;
export const TREE_PART_COST_GROWTH = 1.15;
export const CANVAS_GOLD_BASE = 10;
export const PAINT_TIME_BASE_SECONDS = 10;
export const TIER_UPGRADE_BASE = 100;
export const TIER_UPGRADE_RATIO = 2.78;
export const MAX_TIER = 10;

// ============================================================================
// Formulas
// ============================================================================

/**
 * Inspiration palier required to ascend at the given prior ascend count.
 * count=0 → 1000, count=1 → 2000, count=10 → ~1.024M.
 */
export const palierAscend = (count: number): Big =>
  big(PALIER_BASE).mul(big(PALIER_GROWTH).pow(count));

/**
 * Fame gained from converting a given inspiration amount.
 * floor(log10(max(1, inspi)) * K). Always non-negative.
 */
export const fameOnAscend = (inspi: Big): number => {
  const n = inspi.toNumber();
  return Math.floor(Math.log10(Math.max(1, n)) * FAME_LOG_K);
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
 * Paint Mastery gained per canvas sale.
 * v1.1: `tier²`, equivalent to `grossGold / 10` (where grossGold = 10 × tier²).
 * v1.3: becomes `quality × tier` once quality is implemented; same call site.
 *
 * Computed on gross tier-derived gold (pre-multiplier) — no PM-gold feedback loop.
 */
export const pmGainPerSale = (tier: number): Big =>
  big(tier).mul(tier);

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
