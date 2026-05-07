import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel } from "@/store/skillTreeSlice";
import { pmMult } from "./balance";

/**
 * Per-color additive bonus to canvas gold. Tier-scaled per the v3.2 design:
 * black_white (root) +20%, primaries +30%, secondaries +40%, tertiaries +50%.
 * Sum at full color tree = +380% (4.80× base before rainbow).
 */
const COLOR_PER_LEVEL: Readonly<Record<string, number>> = {
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

/** Rainbow now stacks multiplicatively: × (1 + 0.50 × level). */
const RAINBOW_PER_LEVEL = 0.50;
const GET_INSPIRED_PER_LEVEL = 0.25;
const BASIC_TECHNIQUE_PER_LEVEL = 0.02;
const MUSCLE_MEMORY_PER_LEVEL = 0.05;
const BARGAIN_PER_LEVEL = 0.05;
const BARGAIN_DISCOUNT_FLOOR = 0.5; // never reduce tree costs below 50% of base
const CRAFTSMANSHIP_PER_LEVEL = 5; // +5 percentage points to affix min/max per level

/**
 * Aggregate multiplier on inspiration accrual rate.
 *
 * Wiring:
 *   - get_inspired: +25% per level (additive). 5 levels = +125%.
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
 *   - 10 color nodes: tier-scaled additive (20/30/40/50%). Full tree = +380%.
 *   - Equipped items: `+canvas_gold%` additive contribution.
 *   - Rainbow: multiplicative on the additive base (× (1 + 0.50 × level)).
 */
export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+canvas_gold%");
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    bonus += getNodeLevel(state, id) * perLevel;
  }
  const additive = 1 + bonus;
  const rainbowMul = 1 + getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;
  return additive * rainbowMul;
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
