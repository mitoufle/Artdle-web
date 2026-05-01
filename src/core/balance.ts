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
 * `multiplier` is the aggregated canvas-gold multiplier from skill tree + items.
 */
export const canvasGold = (multiplier: number): Big =>
  big(CANVAS_GOLD_BASE).mul(multiplier);

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
