import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel, sumLevels } from "@/store/skillTreeSlice";
import { pmMult } from "./balance";

/**
 * 10 color nodes whose levels each contribute +10% additive to canvas gold.
 * Order: black_white (root) + 3 primaries + 3 secondaries + 3 tertiaries.
 */
const COLOR_NODES = [
  "black_white",
  "magenta",
  "cyan",
  "yellow",
  "red",
  "green",
  "blue",
  "purple",
  "brown",
  "orange",
] as const;

const COLOR_PER_LEVEL = 0.10;
const RAINBOW_PER_LEVEL = 0.50;
const GET_INSPIRED_PER_LEVEL = 0.05;
const BASIC_TECHNIQUE_PER_LEVEL = 0.01;
const MUSCLE_MEMORY_PER_LEVEL = 0.01;
const BARGAIN_PER_LEVEL = 0.01;
const BARGAIN_DISCOUNT_FLOOR = 0.5; // never reduce tree costs below 50% of base
const CRAFTSMANSHIP_PER_LEVEL = 1; // +1 percentage point to affix min/max per level

/**
 * Aggregate multiplier on inspiration accrual rate.
 *
 * Wiring:
 *   - get_inspired: +5% per level (additive). 5 levels = +25%.
 *   - workshop items: do NOT contribute (painting-only by design).
 */
export const getInspiMultiplier = (state: GameStore): number => {
  const bonus = getNodeLevel(state, "get_inspired") * GET_INSPIRED_PER_LEVEL;
  return 1 + bonus;
};

/**
 * Aggregate multiplier on gold credited per canvas sale.
 *
 * Wiring:
 *   - 10 color nodes (each level): +10% additive. All 10 = +100%.
 *   - rainbow (per level): +20% additive (per design file's `stacking: additive`).
 *   - Equipped items: existing `+canvas_gold%` contribution.
 */
export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+canvas_gold%");
  bonus += sumLevels(state, [...COLOR_NODES]) * COLOR_PER_LEVEL;
  bonus += getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;
  return 1 + bonus;
};

/**
 * Aggregate multiplier on canvas SPEED. Higher = faster.
 *
 * Wiring:
 *   - basic_technique (per level): +1% additive
 *   - muscle_memory (per level): +1% additive
 *
 * Composes multiplicatively at the call site with `getPaintTimeMultiplier`
 * (the item-driven speed multiplier).
 */
export const getCanvasSpeedMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  return 1 + bonus;
};

/**
 * Multiplier on tree-part upgrade costs (spark/bud/leaf/branch). 1.0 = no
 * discount; <1.0 = discounted. Floored at BARGAIN_DISCOUNT_FLOOR.
 *
 * Wiring:
 *   - Bargain (per level): -1% additive.
 */
export const getTreeUpgradeCostMultiplier = (state: GameStore): number => {
  const reduction = getNodeLevel(state, "Bargain") * BARGAIN_PER_LEVEL;
  return Math.max(BARGAIN_DISCOUNT_FLOOR, 1 - reduction);
};

/**
 * Paint-speed multiplier from items only — `effectivePaintTime = canvasTime / multiplier`.
 * Skill-tree speed contributions live in `getCanvasSpeedMultiplier`.
 */
export const getPaintTimeMultiplier = (state: GameStore): number => {
  let bonus = 0;
  for (const item of Object.values(state.equipped)) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.kind === "-paint_time%") {
        const v = affix.magnitude / 100;
        bonus += v / (1 - v);
      }
    }
  }
  return 1 + bonus;
};

/** Paint Mastery multiplier on canvas gold output. */
export const getPmMultiplier = (state: GameStore): number =>
  pmMult(state.paintMastery);

/**
 * Bonus added to BOTH affix min and max magnitude at roll time.
 * Wiring: Craftsmanship (+1 pp per level, 5 levels = +5 pp).
 */
export const getAffixMagnitudeBonus = (state: GameStore): number =>
  getNodeLevel(state, "craftsmanship") * CRAFTSMANSHIP_PER_LEVEL;
