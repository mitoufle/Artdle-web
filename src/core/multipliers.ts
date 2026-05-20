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
import { getSchoolBonus } from "@/core/schoolMultipliers";
import { getAchievementBonus } from "@/core/achievementMultipliers";
import { pmMult, SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL, CRIT_PER_LEVEL, COMBO_PER_LEVEL, SIZE_PER_LEVEL, levelScale, CRIT_SOFT_CAP_THRESHOLD, CRIT_SOFT_CAP_CEILING, COLOR_PER_LEVEL, RAINBOW_PER_LEVEL, GET_INSPIRED_PER_LEVEL, BASIC_TECHNIQUE_PER_LEVEL, MUSCLE_MEMORY_PER_LEVEL, BARGAIN_PER_LEVEL, BARGAIN_DISCOUNT_FLOOR, CRAFTSMANSHIP_PER_LEVEL, BETTER_SCALING_PER_WORKSHOP_LEVEL } from "./balance";
import { big, type Big } from "@/core/bigNumber";
import type { AffixKind } from "@/config/workshopAffixes";

/**
 * Set of GameStore fields read by canvas multipliers, their helpers, and the
 * new-node capability selectors. Components composing a `helperState` for
 * canvas-math callsites should type it as this — TypeScript will then flag
 * any missing field at compile time, preventing the recurring class of
 * "helper-state stub forgot field X" bugs that have hit canvasGold NaN and
 * Office-tab-crash regressions before.
 *
 * If a multiplier starts reading a new field, add it here.
 */
export type CanvasMultiplierInputs = Pick<GameStore,
  | "equipped"
  | "roster"
  | "purchasedNodes"
  | "paintMastery"
  | "sellPriceLevel"
  | "speedLevel"
  | "sizeLevel"
  | "critLevel"
  | "comboLevel"
  | "completedResearches"
  | "completedAchievements"
>;

/**
 * Sum of (worker.affix.magnitude / 100) × levelScale(worker.level) for all
 * workers whose affix list contains the given kind. Returns Big — at high
 * levels this is genuinely large (levelScale grows geometrically).
 */
export function getOfficeContribution(state: Pick<GameStore, "roster">, kind: AffixKind): Big {
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
 * Aggregate multiplier on inspiration accrual rate.
 *
 * Wiring:
 *   - get_inspired: +50% per level (additive). 5 levels = +250%.
 *   - workshop items: do NOT contribute (painting-only by design).
 */
export const getInspiMultiplier = (state: Pick<GameStore, "purchasedNodes" | "completedResearches" | "completedAchievements">): number => {
  const bonus = getNodeLevel(state, "get_inspired") * GET_INSPIRED_PER_LEVEL
    + countCapability(state, "inspi_mult_bonus") * 0.10
    + getSchoolBonus(state, "+% inspiration gain")
    + getAchievementBonus(state, "inspi_pct");
  return 1 + bonus;
};

/**
 * Aggregate multiplier on gold credited per canvas sale.
 *
 * Wiring:
 *   - 10 color nodes: tier-scaled additive (50/80/130/200%). Full tree = +1280%.
 *   - Equipped items: `+sell_price%` additive contribution.
 *   - Rainbow: multiplicative on the additive base (× (1 + 5.00 × level)).
 */
export const getCanvasGoldMultiplier = (state: CanvasMultiplierInputs): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+sell_price%");
  bonus += getOfficeContribution(state, "+sell_price%").toNumber();
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    bonus += getNodeLevel(state, id) * perLevel;
  }
  bonus += SELL_PRICE_PER_LEVEL * state.sellPriceLevel;
  bonus += getSchoolBonus(state, "canvas_gold_pct");
  bonus += getAchievementBonus(state, "canvas_gold_pct");
  const additive = 1 + bonus;
  const rainbowMul = 1 + getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;
  return additive * rainbowMul;
};

/**
 * Aggregate multiplier on canvas SPEED. Higher = faster.
 *
 * Wiring:
 *   - basic_technique (per level): +5% additive
 *   - muscle_memory (per level): +5% additive
 *   - speedLevel (canvas-depth track): +5% per level additive
 *   - equipped +speed% affixes: additive (each magnitude is fractional via getEquippedContribution)
 */
export const getCanvasSpeedMultiplier = (state: CanvasMultiplierInputs): number => {
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  bonus += SPEED_PER_LEVEL * state.speedLevel;
  bonus += getEquippedContribution(state, "+speed%"); // already fractional
  bonus += getOfficeContribution(state, "+speed%").toNumber();
  bonus += getSchoolBonus(state, "speed_pct");
  bonus += getAchievementBonus(state, "speed_pct");
  return 1 + bonus;
};

/** Sum of color-tree contributions to canvas gold (additive, fractional). */
export const getColorTreeContribution = (state: Pick<GameStore, "purchasedNodes">): number => {
  let sum = 0;
  for (const [id, perLevel] of Object.entries(COLOR_PER_LEVEL)) {
    sum += getNodeLevel(state, id) * perLevel;
  }
  return sum;
};

/** Multiplicative rainbow factor applied to the additive gold bonus. */
export const getRainbowMultiplier = (state: Pick<GameStore, "purchasedNodes">): number =>
  1 + getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;

/** School bonus contribution to canvas gold (additive fraction). */
export const getSchoolGoldContribution = (state: Pick<GameStore, "completedResearches">): number =>
  getSchoolBonus(state, "canvas_gold_pct");

/** Achievement bonus contribution to canvas gold (additive fraction). */
export const getAchievementGoldContribution = (state: { completedAchievements?: Record<string, true> }): number =>
  getAchievementBonus(state, "canvas_gold_pct");

/** School bonus contribution to canvas speed (additive fraction). */
export const getSchoolSpeedContribution = (state: Pick<GameStore, "completedResearches">): number =>
  getSchoolBonus(state, "speed_pct");

/** Achievement bonus contribution to canvas speed (additive fraction). */
export const getAchievementSpeedContribution = (state: { completedAchievements?: Record<string, true> }): number =>
  getAchievementBonus(state, "speed_pct");

/** Sum of skill-tree contributions to canvas speed (additive, fractional). */
export const getSkillTreeSpeedContribution = (state: Pick<GameStore, "purchasedNodes">): number =>
  getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL +
  getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;

/**
 * Multiplier on tree-part upgrade costs (cotyledon/tendril/budtip/...). 1.0 = no
 * discount; <1.0 = discounted. Floored at BARGAIN_DISCOUNT_FLOOR.
 *
 * Wiring:
 *   - Bargain (per level): -1% additive.
 */
export const getTreeUpgradeCostMultiplier = (state: Pick<GameStore, "purchasedNodes">): number => {
  const reduction = getNodeLevel(state, "Bargain") * BARGAIN_PER_LEVEL;
  return Math.max(BARGAIN_DISCOUNT_FLOOR, 1 - reduction);
};

/** Paint Mastery multiplier on canvas gold output. */
export const getPmMultiplier = (state: Pick<GameStore, "paintMastery">): number =>
  pmMult(state.paintMastery);

/**
 * Bonus added to BOTH affix min and max magnitude at roll time.
 * Wiring: Craftsmanship (+5 pp per level) + better_scaling (+workshopLevel pp per level).
 */
export const getAffixMagnitudeBonus = (state: Pick<GameStore, "purchasedNodes" | "workshopLevel">): number =>
  getNodeLevel(state, "craftsmanship") * CRAFTSMANSHIP_PER_LEVEL
  + getNodeLevel(state, "better_scaling") * state.workshopLevel * BETTER_SCALING_PER_WORKSHOP_LEVEL;

/**
 * Crit chance (0..CRIT_SOFT_CAP_CEILING). Sources sum linearly up to
 * CRIT_SOFT_CAP_THRESHOLD; above that, exponential diminishing returns compress
 * further investment so 100% is unreachable. Formula:
 *   raw <= threshold  →  effective = raw
 *   raw  > threshold  →  effective = threshold + range × (1 − exp(−excess / (range × 0.5)))
 * where range = ceiling − threshold.
 */
export const getCritChance = (state: CanvasMultiplierInputs): number => {
  let raw = CRIT_PER_LEVEL * state.critLevel;
  raw += getEquippedContribution(state, "+crit_chance%");
  raw += getOfficeContribution(state, "+crit_chance%").toNumber();
  if (raw <= CRIT_SOFT_CAP_THRESHOLD) return raw;
  const range = CRIT_SOFT_CAP_CEILING - CRIT_SOFT_CAP_THRESHOLD;
  return CRIT_SOFT_CAP_THRESHOLD + range * (1 - Math.exp(-(raw - CRIT_SOFT_CAP_THRESHOLD) / (range * 0.5)));
};

/**
 * Base combo trigger chance, BEFORE per-link decay. Clamped at 1.0.
 * Consumes both comboLevel and equipped +combo_chance% affixes additively.
 * Decay is applied at use sites (canvasTick) via comboEffectiveChance.
 */
export const getComboBaseChance = (state: CanvasMultiplierInputs): number => {
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
export const getCanvasSize = (state: CanvasMultiplierInputs): number => {
  return 1
    + SIZE_PER_LEVEL * state.sizeLevel
    + getEquippedContribution(state, "+size%")
    + getOfficeContribution(state, "+size%").toNumber()
    + countCapability(state, "canvas_size_bonus") * 0.05;
};

/** Worker XP gain per canvas sale, multiplied by accelerator nodes and school bonuses. */
export const getWorkerXpMultiplier = (
  state: Pick<GameStore, "purchasedNodes" | "completedResearches">,
): number =>
  1 + countCapability(state, "worker_xp_mult") * 0.10 + getSchoolBonus(state, "worker_xp_pct");

/** Hire cost reduction, floored at 90% (so cost can't go below 10% of base). */
export const getHireCostMultiplier = (state: Pick<GameStore, "purchasedNodes">): number =>
  Math.max(0.1, 1 - countCapability(state, "hire_cost_reduction") * 0.10);

/** Combo decay reduction per chain link (subtracted from COMBO_DECAY_PER_LINK). */
export const getComboDecayReduction = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "combo_decay_reduction") * 0.01;

/** Bonus % applied to canvas gold when the canvas is a crit. 0 if no nodes purchased. */
export const getCritGoldBonus = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "crit_gold_bonus") * 0.20;

/** Ascend threshold reduction in log10-space (used by canAscend + fameOnAscend). */
export const getAscendThresholdReduction = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "ascend_threshold_reduction") * 0.05;

/** Multiplicative boost on both affix min and max magnitude at roll time (school bonus). */
export const getSchoolAffixMagnitudeMultiplier = (
  state: Pick<GameStore, "completedResearches">,
): number => 1 + getSchoolBonus(state, "Item min/max affix magnitude");
