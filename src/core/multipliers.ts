/**
 * Canvas multipliers return JS `number`. Office contribution from
 * getOfficeContribution() is Big-valued and gets `.toNumber()`'d before
 * adding to the multiplier sum. This saturates at MAX_SAFE_INTEGER if a
 * single worker stacks magnitudes × levelScale beyond ~9e15 — which only
 * happens past office L~100 with deep worker leveling. A future refactor
 * can move the canvas multipliers to Big if this becomes a progression
 * blocker; for v1.x of the Office, the saturation point is "you've won."
 */

import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel, countCapability } from "@/store/skillTreeSlice";
import { pmMult, SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL, CRIT_PER_LEVEL, COMBO_PER_LEVEL, SIZE_PER_LEVEL, levelScale } from "./balance";
import { big, type Big } from "@/core/bigNumber";
import type { AffixKind } from "@/config/workshopAffixes";

/**
 * Sum of (worker.affix.magnitude / 100) × levelScale(worker.level) for all
 * workers whose affix list contains the given kind. Returns Big — at high
 * levels this is genuinely large (levelScale grows geometrically).
 */
export function getOfficeContribution(state: GameStore, kind: AffixKind): Big {
  let total: Big = big(0);
  for (const worker of state.roster) {
    const scale = levelScale(worker.level);
    for (const affix of worker.affixes) {
      if (affix.kind === kind) {
        total = total.add(big(affix.magnitude / 100).mul(scale));
      }
    }
  }
  return total;
}

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
  const bonus = getNodeLevel(state, "get_inspired") * GET_INSPIRED_PER_LEVEL
    + countCapability(state, "inspi_mult_bonus") * 0.10;
  return 1 + bonus;
};

/**
 * Aggregate multiplier on gold credited per canvas sale.
 *
 * Wiring:
 *   - 10 color nodes: tier-scaled additive (20/30/40/50%). Full tree = +380%.
 *   - Equipped items: `+sell_price%` additive contribution.
 *   - Rainbow: multiplicative on the additive base (× (1 + 0.50 × level)).
 */
export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+sell_price%");
  bonus += getOfficeContribution(state, "+sell_price%").toNumber();
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    bonus += getNodeLevel(state, id) * perLevel;
  }
  bonus += SELL_PRICE_PER_LEVEL * state.sellPriceLevel;
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
 *   - speedLevel (canvas-depth track): +5% per level additive
 *   - equipped +speed% affixes: additive (each magnitude is fractional via getEquippedContribution)
 */
export const getCanvasSpeedMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  bonus += SPEED_PER_LEVEL * state.speedLevel;
  bonus += getEquippedContribution(state, "+speed%"); // already fractional
  bonus += getOfficeContribution(state, "+speed%").toNumber();
  return 1 + bonus;
};

/** Sum of color-tree contributions to canvas gold (additive, fractional). */
export const getColorTreeContribution = (state: GameStore): number => {
  let sum = 0;
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    sum += getNodeLevel(state, id) * perLevel;
  }
  return sum;
};

/** Multiplicative rainbow factor applied to the additive gold bonus. */
export const getRainbowMultiplier = (state: GameStore): number =>
  1 + getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;

/** Sum of skill-tree contributions to canvas speed (additive, fractional). */
export const getSkillTreeSpeedContribution = (state: GameStore): number =>
  getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL +
  getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;

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

/** Paint Mastery multiplier on canvas gold output. */
export const getPmMultiplier = (state: GameStore): number =>
  pmMult(state.paintMastery);

/**
 * Bonus added to BOTH affix min and max magnitude at roll time.
 * Wiring: Craftsmanship (+1 pp per level, 5 levels = +5 pp).
 */
export const getAffixMagnitudeBonus = (state: GameStore): number =>
  getNodeLevel(state, "craftsmanship") * CRAFTSMANSHIP_PER_LEVEL;

/**
 * Crit chance (0 to 1). Clamped at 1.0 — multi-crit is out of scope
 * (canvas-depth spec §3.4). Consumes both critLevel and equipped +crit_chance%
 * affixes additively (already fractional via getEquippedContribution).
 */
export const getCritChance = (state: GameStore): number => {
  let chance = CRIT_PER_LEVEL * state.critLevel;
  chance += getEquippedContribution(state, "+crit_chance%"); // already fractional
  chance += getOfficeContribution(state, "+crit_chance%").toNumber();
  return Math.min(1.0, chance);
};

/**
 * Base combo trigger chance, BEFORE per-link decay. Clamped at 1.0.
 * Consumes both comboLevel and equipped +combo_chance% affixes additively.
 * Decay is applied at use sites (canvasTick) via comboEffectiveChance.
 */
export const getComboBaseChance = (state: GameStore): number => {
  let chance = COMBO_PER_LEVEL * state.comboLevel;
  chance += getEquippedContribution(state, "+combo_chance%");
  chance += getOfficeContribution(state, "+combo_chance%").toNumber();
  return Math.min(1.0, chance);
};

/**
 * Total canvas size, base 1. Every source contributes additively:
 *   - canvas size-track level: SIZE_PER_LEVEL × sizeLevel
 *   - equipped +size% items: getEquippedContribution(state, "+size%")
 *   - hired workers' +size% affixes: getOfficeContribution(state, "+size%")
 *   - future fame nodes can be wired in here when authored.
 *
 * Used by `canvasGold` (size² scaling) and `canvasTime` (linear scaling).
 * Gold-per-second scales linearly with size — doubling size doubles efficiency.
 */
export const getCanvasSize = (state: GameStore): number => {
  return 1
    + SIZE_PER_LEVEL * state.sizeLevel
    + getEquippedContribution(state, "+size%")
    + getOfficeContribution(state, "+size%").toNumber()
    + countCapability(state, "canvas_size_bonus") * 0.05;
};

/** Worker XP gain per canvas sale, multiplied by accelerator nodes. */
export const getWorkerXpMultiplier = (state: GameStore): number =>
  1 + countCapability(state, "worker_xp_mult") * 0.10;

/** Hire cost reduction, floored at 90% (so cost can't go below 10% of base). */
export const getHireCostMultiplier = (state: GameStore): number =>
  Math.max(0.1, 1 - countCapability(state, "hire_cost_reduction") * 0.10);

/** Combo decay reduction per chain link (subtracted from COMBO_DECAY_PER_LINK). */
export const getComboDecayReduction = (state: GameStore): number =>
  countCapability(state, "combo_decay_reduction") * 0.01;

/** Bonus % applied to canvas gold when the canvas is a crit. 0 if no nodes purchased. */
export const getCritGoldBonus = (state: GameStore): number =>
  countCapability(state, "crit_gold_bonus") * 0.20;

/** Ascend threshold reduction in log10-space (used by canAscend + fameOnAscend). */
export const getAscendThresholdReduction = (state: GameStore): number =>
  countCapability(state, "ascend_threshold_reduction") * 0.05;
