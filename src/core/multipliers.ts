/**
 * Canvas multipliers return JS `number`. Workers no longer feed these
 * (the redesigned Office contributes via the canvas tick in Phase B), so the
 * roster is intentionally absent from CanvasMultiplierInputs.
 */

import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";
import type { Item } from "@/store/workshopSlice";
import { getNodeLevel, countCapability, hasCapability } from "@/store/skillTreeSlice";
import { getSchoolBonus } from "@/core/schoolMultipliers";
import { MUSE_BURST_INSPI_MULT } from "@/core/skillTreeTickPure";
import { getAchievementBonus } from "@/core/achievementMultipliers";
import { SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL, CRIT_PER_LEVEL, BASE_CRIT_CHANCE, BASE_CRIT_CHUNKS, MAX_CRIT_LEVEL, COMBO_PER_LEVEL, CRIT_SOFT_CAP_THRESHOLD, CRIT_SOFT_CAP_CEILING, COLOR_PER_LEVEL, RAINBOW_PER_LEVEL, GET_INSPIRED_PER_LEVEL, BASIC_TECHNIQUE_PER_LEVEL, MUSCLE_MEMORY_PER_LEVEL, BARGAIN_PER_LEVEL, BARGAIN_DISCOUNT_FLOOR, CRAFTSMANSHIP_PER_LEVEL, BETTER_SCALING_PER_WORKSHOP_LEVEL, ACCELERATOR_XP_PER_LEVEL } from "./balance";
import type { SlotKind } from "@/config/workshopAffixes";

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
  | "purchasedNodes"
  | "sellPriceLevel"
  | "speedLevel"
  | "critLevel"
  | "comboLevel"
  | "canvasTier"
  | "completedResearches"
  | "completedAchievements"
>;

/** Zion (`zion_tree_milestone`): +10% inspiration per tree upgrade at this level. */
const ZION_MILESTONE_LEVEL = 100;
const ZION_INSPI_PER_MILESTONE = 0.10;
/** Babylon King (`babylon_inspi_bonus`): +100% inspiration per level (additive). */
const BABYLON_INSPI_PER_LEVEL = 1.0;
/** Royalties (`ascend_fame_bonus`): +70% fame on ascend per level. */
const ROYALTIES_FAME_PER_LEVEL = 0.70;

/** Count of tree upgrades that have reached `level`. Guards an absent map. */
const countTreeUpgradesAtLevel = (
  partLevels: Record<string, number> | undefined,
  level: number,
): number => {
  if (!partLevels) return 0;
  let n = 0;
  for (const lvl of Object.values(partLevels)) {
    if ((lvl ?? 0) >= level) n += 1;
  }
  return n;
};

/**
 * Aggregate multiplier on inspiration accrual rate.
 *
 * Wiring:
 *   - get_inspired: +50% per level (additive). 5 levels = +250%.
 *   - zion (`zion_tree_milestone`): +10% per tree upgrade at level ≥ 100.
 *   - babylon_king (`babylon_inspi_bonus`): +100% per level (additive).
 *   - muse_burst (`museBurstTimer`): ×7 the whole rate while the buff is active.
 *   - workshop items: do NOT contribute (painting-only by design).
 */
export const getInspiMultiplier = (state: Pick<GameStore, "purchasedNodes" | "completedResearches" | "completedAchievements" | "partLevels" | "museBurstTimer">): number => {
  const zionBonus = hasCapability(state, "zion_tree_milestone")
    ? ZION_INSPI_PER_MILESTONE * countTreeUpgradesAtLevel(state.partLevels, ZION_MILESTONE_LEVEL)
    : 0;
  const bonus = getNodeLevel(state, "get_inspired") * GET_INSPIRED_PER_LEVEL
    + countCapability(state, "inspi_mult_bonus") * 0.10
    + countCapability(state, "babylon_inspi_bonus") * BABYLON_INSPI_PER_LEVEL
    + zionBonus
    + getSchoolBonus(state, "+% inspiration gain")
    + getAchievementBonus(state, "inspi_pct");
  const museBurstMult = (state.museBurstTimer ?? 0) > 0 ? MUSE_BURST_INSPI_MULT : 1;
  return (1 + bonus) * museBurstMult;
};

/**
 * Multiplier on fame gained per ascend. Stacks additively:
 *   - Royalties node (`ascend_fame_bonus`): +0.70 per level.
 *   - Spotlight achievement (`ascend_fame_pct`): +0.10.
 * Applied on top of the base fame curve and the school "+% Fame gain" bonus —
 * see computeAscendFameGain.
 */
export const getAscendFameMultiplier = (state: Pick<GameStore, "purchasedNodes" | "completedAchievements">): number =>
  1 + countCapability(state, "ascend_fame_bonus") * ROYALTIES_FAME_PER_LEVEL
    + getAchievementBonus(state, "ascend_fame_pct");

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
 *   - basic_technique (per level): +10% additive
 *   - muscle_memory (per level): +10% additive
 *   - speedLevel (canvas-depth track): +15% per level additive
 *   - equipped +speed% affixes: additive (each magnitude is fractional via getEquippedContribution)
 */
export const getCanvasSpeedMultiplier = (state: CanvasMultiplierInputs): number => {
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  bonus += SPEED_PER_LEVEL * state.speedLevel;
  bonus += getEquippedContribution(state, "+speed%"); // already fractional
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

/**
 * Bonus added to BOTH affix min and max magnitude at roll time.
 * Wiring: Craftsmanship (+5 pp per level) + better_scaling (+workshopLevel pp per level).
 */
export const getAffixMagnitudeBonus = (state: Pick<GameStore, "purchasedNodes" | "workshopLevel">): number =>
  getNodeLevel(state, "craftsmanship") * CRAFTSMANSHIP_PER_LEVEL
  + getNodeLevel(state, "better_scaling") * state.workshopLevel * BETTER_SCALING_PER_WORKSHOP_LEVEL;

/**
 * Crit chance (0..CRIT_SOFT_CAP_CEILING). Sources:
 *   - BASE_CRIT_CHANCE (1% floor)
 *   - CRIT_PER_LEVEL × min(critLevel, MAX_CRIT_LEVEL)
 *   - countCapability(state, "crit_chance") × 0.01  (skill-tree hook; 0 today)
 * Items contribute to crit_chunks instead (separate stat).
 * Soft-cap formula unchanged: raw above CRIT_SOFT_CAP_THRESHOLD compresses
 * toward CRIT_SOFT_CAP_CEILING.
 */
export const getCritChance = (state: CanvasMultiplierInputs): number => {
  let raw = BASE_CRIT_CHANCE;
  raw += CRIT_PER_LEVEL * Math.min(state.critLevel, MAX_CRIT_LEVEL);
  raw += countCapability(state, "crit_chance") * 0.01;
  if (raw <= CRIT_SOFT_CAP_THRESHOLD) return raw;
  const range = CRIT_SOFT_CAP_CEILING - CRIT_SOFT_CAP_THRESHOLD;
  return CRIT_SOFT_CAP_THRESHOLD + range * (1 - Math.exp(-(raw - CRIT_SOFT_CAP_THRESHOLD) / (range * 0.5)));
};

/**
 * Bonus chunks added per crit. Returns an integer >= 0.
 * Sources:
 *   - BASE_CRIT_CHUNKS (1), scaled by item-contributed percentages
 *   - Equipped items with +crit_chunks affix: magnitude is read as a PERCENT of the base
 *     (e.g. magnitude 85 → +85% → base × 1.85). Socks ×1.5 multiplier applies to the
 *     boots slot percentage. Additively stacked across all equipped items.
 */
export const getCritChunks = (state: CanvasMultiplierInputs): number => {
  const hasSocks = getNodeLevel(state, "socks") > 0;

  // Items contribute a PERCENTAGE of the base additional-chunks-per-crit.
  // magnitude is read as a percent (85 -> +85%); socks x1.5 on boots.
  let itemPct = 0;
  for (const entry of Object.entries(state.equipped)) {
    const [slot, item] = entry as [SlotKind, Item | undefined];
    if (!item) continue;
    const slotMult = hasSocks && slot === "boots" ? 1.5 : 1.0;
    for (const affix of item.affixes) {
      if (affix.kind === "+crit_chunks") itemPct += (affix.magnitude / 100) * slotMult;
    }
  }
  const chunks = BASE_CRIT_CHUNKS * (1 + itemPct);
  return Math.max(0, Math.floor(chunks));
};

/**
 * Base combo trigger chance, BEFORE per-link decay. Clamped at 1.0.
 * Consumes both comboLevel and equipped +combo_chance% affixes additively.
 * Decay is applied at use sites (canvasTick) via comboEffectiveChance.
 */
export const getComboBaseChance = (state: CanvasMultiplierInputs): number => {
  let chance = COMBO_PER_LEVEL * state.comboLevel;
  chance += getEquippedContribution(state, "+combo_chance%");
  return Math.min(1.0, chance);
};

/** Combo decay reduction per chain link (subtracted from COMBO_DECAY_PER_LINK). */
export const getComboDecayReduction = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "combo_decay_reduction") * 0.01;

/** Ascend threshold reduction in log10-space (used by canAscend + fameOnAscend). */
export const getAscendThresholdReduction = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "ascend_threshold_reduction") * 0.05;

/** Multiplicative boost on both affix min and max magnitude at roll time (school bonus). */
export const getSchoolAffixMagnitudeMultiplier = (
  state: Pick<GameStore, "completedResearches">,
): number => 1 + getSchoolBonus(state, "Item min/max affix magnitude");

/**
 * Multiplicative boost on both affix min and max magnitude at roll time,
 * granted by skill-tree nodes. +25% per level summed across nodes that
 * carry the `affix_magnitude_pct` capability (Expert manufacture).
 */
export const getSkillAffixMagnitudeMultiplier = (
  state: Pick<GameStore, "purchasedNodes">,
): number => 1 + countCapability(state, "affix_magnitude_pct") * 0.25;

/**
 * Multiplier on the worker ascend-XP pool from the Accelerator node
 * (`worker_xp_mult` capability): `1 + ACCELERATOR_XP_PER_LEVEL × levels`.
 * Replaces the old per-sale `getWorkerXpMultiplier` (deleted in Phase C cleanup).
 */
export const getWorkerXpPoolMultiplier = (state: Pick<GameStore, "purchasedNodes">): number =>
  1 + countCapability(state, "worker_xp_mult") * ACCELERATOR_XP_PER_LEVEL;

/**
 * Multiplicative gold factor contributed by the worker roster:
 * `∏ (1 + worker.stats.goldPct)`. 1.0 for an empty roster (solo play
 * unaffected). Used ONLY by the canvas tick on sale — kept out of
 * CanvasMultiplierInputs so the other canvas multipliers stay worker-free
 * (the A2 structural guarantee). Tunable: multiplicative per spec §2.2.
 */
export const getWorkerGoldFactor = (state: Pick<GameStore, "roster">): number => {
  let factor = 1;
  for (const w of state.roster) factor *= 1 + w.stats.goldPct;
  return factor;
};
