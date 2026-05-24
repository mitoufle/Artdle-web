import { describe, it, expect } from "vitest";
import {
  fameOnAscend,
  treePartCost,
  canvasGold,
  canvasTime,
  inspiPerSec,
  craftCost,
  xpToNext,
  sellPriceUpgradeCost,
  speedUpgradeCost,
  sizeUpgradeCost,
  critUpgradeCost,
  comboUpgradeCost,
  comboBonusFactor,
  comboEffectiveChance,
  SELL_PRICE_PER_LEVEL,
  SPEED_PER_LEVEL,
  SIZE_PER_LEVEL,
  CRIT_PER_LEVEL,
  BASE_CRIT_CHANCE,
  BASE_CRIT_CHUNKS,
  MAX_CRIT_LEVEL,
  COMBO_PER_LEVEL,
  COMBO_PER_LINK,
  COMBO_DECAY_PER_LINK,
  SELL_PRICE_COST_BASE,
  SPEED_COST_BASE,
  SIZE_COST_BASE,
  CRIT_COST_BASE,
  COMBO_COST_BASE,
  TRACK_COST_GROWTH,
  CANVAS_TIME_BASE,
  levelScale,
  workerXpToNext,
  officeXpToNext,
  WORKER_XP_BASE,
  OFFICE_XP_BASE,
  trickleSeconds,
  TRICKLE_BASE_SECONDS,
  TRICKLE_FLOOR_SECONDS,
  OFFICE_TIER_UNLOCK_LEVEL,
  OFFICE_TIER_AFFIX_COUNT,
  computeOfficeTierProbabilities,
  hireCost,
  HIRE_TIER_BASE,
  XP_GOLD_FRACTION,
  HIRE_OFFICE_LEVEL_GROWTH,
  PART_MILESTONES,
  getPartMilestoneMultiplier,
  getNextPartMilestone,
  tierFactor,
  timeFactor,
  costTierFactor,
  COST_GROWTH_BASE,
} from "@/core/balance";
import { big } from "@/core/bigNumber";

describe("fameOnAscend (quintic-in-log, gated at 10k inspi)", () => {
  // Formula: max(1, floor((log10(inspi) - 4)^5 * 3.2)) for inspi ≥ 10k; 0 below.

  it("returns 0 below the 10k threshold", () => {
    expect(fameOnAscend(big(0))).toBe(0);
    expect(fameOnAscend(big(1))).toBe(0);
    expect(fameOnAscend(big(1000))).toBe(0);
    expect(fameOnAscend(big(9999))).toBe(0);
  });

  it("returns exactly 1 at 10,000 inspi (first viable ascend, clamped)", () => {
    // x = 0 → x^5 = 0 → max(1, floor(0)) = 1
    expect(fameOnAscend(big(10_000))).toBe(1);
  });

  it("returns 1 between 10k and ~100k (sub-integer formula values clamp to 1)", () => {
    // 30k: x≈0.477, x^5 ≈ 0.0247, *3.2 ≈ 0.079 → floor 0 → clamp to 1
    expect(fameOnAscend(big(30_000))).toBe(1);
    // 50k: x≈0.699, x^5 ≈ 0.166, *3.2 ≈ 0.531 → floor 0 → clamp to 1
    expect(fameOnAscend(big(50_000))).toBe(1);
  });

  it("returns 3 at inspi = 100,000", () => {
    // x = 1 → x^5 = 1 → 3.2 → floor 3
    expect(fameOnAscend(big(100_000))).toBe(3);
  });

  it("returns 102 at inspi = 1,000,000", () => {
    // x = 2 → 2^5 = 32 → *3.2 = 102.4 → floor 102
    expect(fameOnAscend(big(1_000_000))).toBe(102);
  });

  it("returns exactly 10,000 at inspi = 1e9", () => {
    // x = 5 → 5^5 = 3125 → *3.2 = 10000.0 → floor 10000
    expect(fameOnAscend(big(1e9))).toBe(10_000);
  });

  it("returns 0 (not negative) when inspi is fractional below 1", () => {
    expect(fameOnAscend(big(0.5))).toBe(0);
  });

  it("monotonically non-decreasing: each doubling yields ≥ previous fame", () => {
    let prev = fameOnAscend(big(10_000));
    for (let inspi = 20_000; inspi <= 1e9; inspi *= 2) {
      const cur = fameOnAscend(big(inspi));
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("treePartCost", () => {
  it("at level 0 returns the base cost", () => {
    expect(treePartCost(0, 100).toNumber()).toBe(100);
  });

  it("grows geometrically with level", () => {
    const c0 = treePartCost(0, 100).toNumber();
    const c5 = treePartCost(5, 100).toNumber();
    const c10 = treePartCost(10, 100).toNumber();
    expect(c5 > c0).toBe(true);
    expect(c10 > c5).toBe(true);
    // ~1.15 growth per level
    expect(c10 / c0).toBeCloseTo(Math.pow(1.15, 10), 5);
  });
});

describe("canvasGold (size² scaling)", () => {
  it("returns BASE × size² × multiplier", () => {
    // size 1, mult 1 → 10 × 1² × 1 = 10
    expect(canvasGold(1, 1).toNumber()).toBeCloseTo(10, 5);
    // size 2, mult 1 → 10 × 4 × 1 = 40
    expect(canvasGold(2, 1).toNumber()).toBeCloseTo(40, 5);
    // size 1.5, mult 2 → 10 × 2.25 × 2 = 45
    expect(canvasGold(1.5, 2).toNumber()).toBeCloseTo(45, 5);
  });

  it("doubles size quadruples gold (size² relationship)", () => {
    const a = canvasGold(1, 1).toNumber();
    const b = canvasGold(2, 1).toNumber();
    expect(b / a).toBeCloseTo(4, 5);
  });
});

describe("inspiPerSec", () => {
  it("zero parts produces zero", () => {
    expect(inspiPerSec([], 1).toNumber()).toBe(0);
  });

  it("sums level*rate across parts", () => {
    expect(
      inspiPerSec([{ level: 2, rate: 1 }, { level: 3, rate: 2 }], 1).toNumber(),
    ).toBe(2 * 1 + 3 * 2);
  });

  it("applies the global multiplier", () => {
    expect(
      inspiPerSec([{ level: 1, rate: 1 }], 5).toNumber(),
    ).toBe(5);
  });

  it("handles a level-zero part as 0 contribution", () => {
    expect(
      inspiPerSec([{ level: 0, rate: 100 }, { level: 1, rate: 2 }], 1).toNumber(),
    ).toBe(2);
  });
});

describe("canvasTime (linear size scaling)", () => {
  it("returns CANVAS_TIME_BASE × size", () => {
    // size 1 → 10s (baseline canvas)
    expect(canvasTime(1)).toBeCloseTo(10, 5);
    // size 2 → 20s (double canvas, double time)
    expect(canvasTime(2)).toBeCloseTo(20, 5);
    // size 1.5 → 15s
    expect(canvasTime(1.5)).toBeCloseTo(15, 5);
  });

  it("doubles size doubles time (linear relationship)", () => {
    const a = canvasTime(1);
    const b = canvasTime(2);
    expect(b / a).toBeCloseTo(2, 5);
  });
});

// ============================================================================
// Workshop leveling
// ============================================================================
describe("craftCost (workshop level)", () => {
  it("returns 100 at level 1", () => {
    expect(craftCost(1).toNumber()).toBeCloseTo(100, 5);
  });

  it("scales by 1.05 per level for L1..L5", () => {
    expect(craftCost(2).toNumber()).toBeCloseTo(105, 1);
    expect(craftCost(5).toNumber()).toBeCloseTo(122, 0);
  });

  it("scales by 1.20 per level past L5", () => {
    // costAtL5 = 100 * 1.05^4 ≈ 121.55
    // L10 = 121.55 * 1.20^5 ≈ 302.45
    expect(craftCost(10).toNumber()).toBeCloseTo(302.5, -1);
    // L70 = 121.55 * 1.20^65 ≈ 17M+
    expect(craftCost(70).gt(big(15_000_000))).toBe(true);
    expect(craftCost(70).lt(big(20_000_000))).toBe(true);
  });

  it("monotonically increasing", () => {
    let prev = craftCost(1);
    for (let lvl = 2; lvl <= 100; lvl++) {
      const cur = craftCost(lvl);
      expect(cur.gt(prev)).toBe(true);
      prev = cur;
    }
  });
});

describe("xpToNext", () => {
  it("returns 8 at level 1 (= 4*(1+1))", () => {
    expect(xpToNext(1)).toBe(8);
  });

  it("returns 280 at level 69 (last to reach L70)", () => {
    expect(xpToNext(69)).toBe(280);
  });

  it("monotonically increasing", () => {
    let prev = xpToNext(1);
    for (let lvl = 2; lvl <= 99; lvl++) {
      const cur = xpToNext(lvl);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });

  it("cumulative XP to reach L70 is ~9,936", () => {
    let total = 0;
    for (let lvl = 1; lvl <= 69; lvl++) total += xpToNext(lvl);
    expect(total).toBe(9_936);
  });
});

// ============================================================================
// Canvas depth — tuning constants (spec §10 defaults)
// ============================================================================
describe("canvas-depth tuning constants", () => {
  it("exposes per-level rates matching spec §10 defaults", () => {
    expect(SELL_PRICE_PER_LEVEL).toBeCloseTo(0.10, 5);
    expect(SPEED_PER_LEVEL).toBeCloseTo(0.05, 5);
    expect(SIZE_PER_LEVEL).toBeCloseTo(0.15, 5);
    expect(CRIT_PER_LEVEL).toBeCloseTo(0.01, 5);
    expect(COMBO_PER_LEVEL).toBeCloseTo(0.02, 5);
    expect(COMBO_PER_LINK).toBeCloseTo(0.10, 5);
    expect(COMBO_DECAY_PER_LINK).toBeCloseTo(0.05, 5);
  });

  it("exposes per-track cost bases + shared growth factor", () => {
    expect(SELL_PRICE_COST_BASE).toBe(100);
    expect(SPEED_COST_BASE).toBe(100);
    expect(SIZE_COST_BASE).toBe(1000);
    expect(CRIT_COST_BASE).toBe(5000);
    expect(COMBO_COST_BASE).toBe(5000);
    expect(TRACK_COST_GROWTH).toBeCloseTo(1.5, 5);
  });

  it("exposes new canvas time base", () => {
    expect(CANVAS_TIME_BASE).toBe(10);
  });
});

// ============================================================================
// Per-track upgrade costs (canvas-depth §11)
// ============================================================================
describe("per-track upgrade costs", () => {
  // Contract: formula(currentLevel) = cost to advance FROM currentLevel TO currentLevel+1.
  // Formula shape: base × TRACK_COST_GROWTH^currentLevel.
  // Mirrors the project's existing craftCost(level) contract.

  it("sellPriceUpgradeCost: 100 × 1.5^level", () => {
    expect(sellPriceUpgradeCost(0).toNumber()).toBeCloseTo(100, 5);
    expect(sellPriceUpgradeCost(1).toNumber()).toBeCloseTo(150, 5);
    expect(sellPriceUpgradeCost(2).toNumber()).toBeCloseTo(225, 5);
    expect(sellPriceUpgradeCost(10).toNumber()).toBeCloseTo(100 * 1.5 ** 10, 0);
  });

  it("speedUpgradeCost shares base 100 with sell-price", () => {
    expect(speedUpgradeCost(0).toNumber()).toBeCloseTo(100, 5);
    expect(speedUpgradeCost(5).toNumber()).toBeCloseTo(100 * 1.5 ** 5, 1);
  });

  it("sizeUpgradeCost uses base 1000", () => {
    expect(sizeUpgradeCost(0).toNumber()).toBeCloseTo(1000, 5);
    expect(sizeUpgradeCost(5).toNumber()).toBeCloseTo(1000 * 1.5 ** 5, 0);
  });

  it("critUpgradeCost and comboUpgradeCost share base 5000", () => {
    expect(critUpgradeCost(0).toNumber()).toBeCloseTo(5000, 5);
    expect(comboUpgradeCost(0).toNumber()).toBeCloseTo(5000, 5);
    expect(critUpgradeCost(3).toNumber()).toBeCloseTo(5000 * 1.5 ** 3, 0);
  });
});

// ============================================================================
// Combo formulas (canvas-depth §12)
// ============================================================================
describe("combo formulas", () => {
  it("comboBonusFactor(0) = 1 (no chain → no bonus)", () => {
    expect(comboBonusFactor(0)).toBeCloseTo(1, 5);
  });

  it("comboBonusFactor(N) = 1 + COMBO_PER_LINK × N", () => {
    expect(comboBonusFactor(1)).toBeCloseTo(1.10, 5);
    expect(comboBonusFactor(5)).toBeCloseTo(1.50, 5);
    expect(comboBonusFactor(10)).toBeCloseTo(2.00, 5);
  });

  it("comboEffectiveChance: base × (1 - DECAY × chain), clamped at 0", () => {
    // base 0.50, chain 0 → 0.50
    expect(comboEffectiveChance(0.50, 0)).toBeCloseTo(0.50, 5);
    // base 0.50, chain 5 → 0.50 × 0.75 = 0.375
    expect(comboEffectiveChance(0.50, 5)).toBeCloseTo(0.375, 5);
    // base 0.10, chain 25 → would go negative → clamped at 0
    expect(comboEffectiveChance(0.10, 25)).toBe(0);
  });
});

// ============================================================================
// Painter's Office balance formulas
// ============================================================================

describe("levelScale (per-worker geometric XP scaling)", () => {
  it("returns 1 at L0", () => {
    expect(levelScale(0).toNumber()).toBeCloseTo(1, 6);
  });
  it("returns 1.04 at L1", () => {
    expect(levelScale(1).toNumber()).toBeCloseTo(1.04, 6);
  });
  it("returns ~2.19 at L20", () => {
    expect(levelScale(20).toNumber()).toBeCloseTo(Math.pow(1.04, 20), 4);
  });
  it("returns Big past L100 (no Number saturation)", () => {
    const s = levelScale(500);
    expect(s.gt(big(1e6))).toBe(true);
  });
});

describe("workerXpToNext", () => {
  it("equals WORKER_XP_BASE at L0", () => {
    expect(workerXpToNext(0).eq(big(WORKER_XP_BASE))).toBe(true);
  });
  it("grows by 1.15 per level", () => {
    const l0 = workerXpToNext(0);
    const l1 = workerXpToNext(1);
    expect(l1.div(l0).toNumber()).toBeCloseTo(1.15, 4);
  });
});

describe("officeXpToNext", () => {
  it("equals OFFICE_XP_BASE at L0", () => {
    expect(officeXpToNext(0).eq(big(OFFICE_XP_BASE))).toBe(true);
  });
  it("grows by 1.30 per level (steeper than worker curve)", () => {
    const l0 = officeXpToNext(0);
    const l1 = officeXpToNext(1);
    expect(l1.div(l0).toNumber()).toBeCloseTo(1.30, 4);
  });
});

describe("trickleSeconds (geometric decay with floor)", () => {
  it("returns TRICKLE_BASE_SECONDS at L0", () => {
    expect(trickleSeconds(0)).toBeCloseTo(TRICKLE_BASE_SECONDS, 4);
  });
  it("decays by 0.97 per level", () => {
    expect(trickleSeconds(1)).toBeCloseTo(TRICKLE_BASE_SECONDS * 0.97, 4);
  });
  it("floors at TRICKLE_FLOOR_SECONDS by high L", () => {
    expect(trickleSeconds(1000)).toBe(TRICKLE_FLOOR_SECONDS);
  });
});

describe("Office tier table", () => {
  it("Common = L1, Magic = L3, Rare = L8, Epic = L20, Legendary = L40", () => {
    expect(OFFICE_TIER_UNLOCK_LEVEL.common).toBe(1);
    expect(OFFICE_TIER_UNLOCK_LEVEL.magic).toBe(3);
    expect(OFFICE_TIER_UNLOCK_LEVEL.rare).toBe(8);
    expect(OFFICE_TIER_UNLOCK_LEVEL.epic).toBe(20);
    expect(OFFICE_TIER_UNLOCK_LEVEL.legendary).toBe(40);
  });
  it("affix slot count = 1/2/3/4/5", () => {
    expect(OFFICE_TIER_AFFIX_COUNT.common).toBe(1);
    expect(OFFICE_TIER_AFFIX_COUNT.legendary).toBe(5);
  });
});

describe("computeOfficeTierProbabilities", () => {
  it("at L1, only common rolls", () => {
    const p = computeOfficeTierProbabilities(1);
    expect(p.common).toBe(1);
    expect(p.magic).toBe(0);
  });
  it("at L100, non-common sum < 1", () => {
    const p = computeOfficeTierProbabilities(100);
    const nonCommon = p.magic + p.rare + p.epic + p.legendary;
    expect(nonCommon).toBeCloseTo(0.30 + 0.25 + 0.20 + 0.15, 4);
    expect(p.common).toBeCloseTo(0.10, 4);
  });
});

describe("hireCost", () => {
  it("at min-roll Common, L0, cost ≈ tierBase × 1", () => {
    const c = hireCost({
      tier: "common", magnitudeSum: 5, minMagnitudeSum: 5, maxMagnitudeSum: 15,
    }, 0);
    // qualityFactor at min = 1
    expect(c.toNumber()).toBeCloseTo(HIRE_TIER_BASE.common, 4);
  });
  it("at max-roll Legendary, L0, cost ≈ tierBase × 5", () => {
    const c = hireCost({
      tier: "legendary", magnitudeSum: 75, minMagnitudeSum: 15, maxMagnitudeSum: 75,
    }, 0);
    // qualityFactor at max = 5 (HIRE_QUALITY_MAX)
    expect(c.toNumber()).toBeCloseTo(HIRE_TIER_BASE.legendary * 5, 4);
  });
  it("officeLevelFactor at L20 ≈ 1.10^20", () => {
    const c1 = hireCost({ tier: "common", magnitudeSum: 5, minMagnitudeSum: 5, maxMagnitudeSum: 15 }, 20);
    const c0 = hireCost({ tier: "common", magnitudeSum: 5, minMagnitudeSum: 5, maxMagnitudeSum: 15 }, 0);
    expect(c1.div(c0).toNumber()).toBeCloseTo(Math.pow(1.10, 20), 4);
  });
});

// ============================================================================
// Tree part milestones
// ============================================================================
describe("PART_MILESTONES", () => {
  it("is [10, 25, 50, 100, 200, 400]", () => {
    expect(PART_MILESTONES).toEqual([10, 25, 50, 100, 200, 400]);
  });
});

describe("getPartMilestoneMultiplier", () => {
  it("returns 1 below the first threshold (L0–L9)", () => {
    expect(getPartMilestoneMultiplier(0)).toBe(1);
    expect(getPartMilestoneMultiplier(9)).toBe(1);
  });

  it("doubles at L10 → ×2", () => {
    expect(getPartMilestoneMultiplier(10)).toBe(2);
    expect(getPartMilestoneMultiplier(24)).toBe(2);
  });

  it("doubles again at L25 → ×4", () => {
    expect(getPartMilestoneMultiplier(25)).toBe(4);
    expect(getPartMilestoneMultiplier(49)).toBe(4);
  });

  it("compounding: ×8 at L50, ×16 at L100, ×32 at L200, ×64 at L400", () => {
    expect(getPartMilestoneMultiplier(50)).toBe(8);
    expect(getPartMilestoneMultiplier(100)).toBe(16);
    expect(getPartMilestoneMultiplier(200)).toBe(32);
    expect(getPartMilestoneMultiplier(400)).toBe(64);
  });

  it("stays at ×64 above L400", () => {
    expect(getPartMilestoneMultiplier(1000)).toBe(64);
  });
});

describe("getNextPartMilestone", () => {
  it("returns 10 when level is 0", () => {
    expect(getNextPartMilestone(0)).toBe(10);
  });

  it("returns 10 when level is 9 (just before threshold)", () => {
    expect(getNextPartMilestone(9)).toBe(10);
  });

  it("returns 25 once level 10 is reached", () => {
    expect(getNextPartMilestone(10)).toBe(25);
    expect(getNextPartMilestone(24)).toBe(25);
  });

  it("returns the correct next threshold at each step", () => {
    expect(getNextPartMilestone(25)).toBe(50);
    expect(getNextPartMilestone(50)).toBe(100);
    expect(getNextPartMilestone(100)).toBe(200);
    expect(getNextPartMilestone(200)).toBe(400);
  });

  it("returns null when all milestones passed (L400+)", () => {
    expect(getNextPartMilestone(400)).toBeNull();
    expect(getNextPartMilestone(1000)).toBeNull();
  });
});

describe("inspiPerSec — milestone multiplier applied per part", () => {
  it("applies ×2 at L10", () => {
    // level 10 → 2^1 = ×2; rate 1; global mult 1 → 10 * 1 * 2 * 1 = 20
    expect(inspiPerSec([{ level: 10, rate: 1 }], 1).toNumber()).toBe(20);
  });

  it("applies ×4 at L25", () => {
    // level 25 → 2^2 = ×4; rate 1; global mult 1 → 25 * 1 * 4 = 100
    expect(inspiPerSec([{ level: 25, rate: 1 }], 1).toNumber()).toBe(100);
  });

  it("applies different milestone multipliers per part independently", () => {
    // part1: L9, rate 1 → 9 * 1 * 1 = 9
    // part2: L25, rate 2 → 25 * 2 * 4 = 200
    // total × globalMult 1 = 209
    expect(
      inspiPerSec([{ level: 9, rate: 1 }, { level: 25, rate: 2 }], 1).toNumber(),
    ).toBe(209);
  });

  it("global multiplier still applies on top of milestone multipliers", () => {
    // L10, rate 1, global ×3 → 10 * 1 * 2 * 3 = 60
    expect(inspiPerSec([{ level: 10, rate: 1 }], 3).toNumber()).toBe(60);
  });

  it("existing sub-threshold tests unaffected (milestone mult = 1 for L<10)", () => {
    expect(inspiPerSec([{ level: 2, rate: 1 }, { level: 3, rate: 2 }], 1).toNumber()).toBe(8);
  });
});

// ============================================================================
// Canvas tier system helpers
// ============================================================================
describe("tierFactor (canvas tier scaling)", () => {
  it("T1 returns 1 (no scaling)", () => {
    expect(tierFactor(1)).toBe(1);
  });

  it("T2 returns 10", () => {
    expect(tierFactor(2)).toBe(10);
  });

  it("T3 returns 100", () => {
    expect(tierFactor(3)).toBe(100);
  });

  it("T5 returns 10000", () => {
    expect(tierFactor(5)).toBe(10000);
  });
});

describe("costTierFactor (canvas upgrade-cost scaling)", () => {
  it("returns 1 at tier 1 (no scaling)", () => {
    expect(costTierFactor(1)).toBe(1);
  });

  it("returns COST_GROWTH_BASE at tier 2", () => {
    expect(costTierFactor(2)).toBe(COST_GROWTH_BASE);
  });

  it("returns COST_GROWTH_BASE squared at tier 3", () => {
    expect(costTierFactor(3)).toBe(COST_GROWTH_BASE * COST_GROWTH_BASE);
  });

  it("returns COST_GROWTH_BASE cubed at tier 4", () => {
    expect(costTierFactor(4)).toBe(COST_GROWTH_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE);
  });

  it("differs from tierFactor at tier 2 (decoupling)", () => {
    expect(costTierFactor(2)).not.toBe(tierFactor(2));
  });
});

describe("timeFactor (canvas tier base-time scaling)", () => {
  it("T1 returns 1", () => {
    expect(timeFactor(1)).toBe(1);
  });

  it("T2 returns 2", () => {
    expect(timeFactor(2)).toBe(2);
  });

  it("T4 returns 8", () => {
    expect(timeFactor(4)).toBe(8);
  });
});

// ============================================================================
// Crit per-chunk constants (Task 1 of T12)
// ============================================================================
describe("crit per-chunk constants", () => {
  it("BASE_CRIT_CHANCE is 0.01 (1% always-on floor)", () => {
    expect(BASE_CRIT_CHANCE).toBe(0.01);
  });

  it("BASE_CRIT_CHUNKS is 1 (one bonus chunk per crit at base)", () => {
    expect(BASE_CRIT_CHUNKS).toBe(1);
  });

  it("MAX_CRIT_LEVEL is 50 (hard cap on the critLevel upgrade track)", () => {
    expect(MAX_CRIT_LEVEL).toBe(50);
  });

  it("CRIT_SPEED_FACTOR is no longer exported (canvas-level crit speed bonus removed)", async () => {
    const mod = await import("@/core/balance");
    expect((mod as Record<string, unknown>).CRIT_SPEED_FACTOR).toBeUndefined();
  });
});

// ============================================================================
// Tier-scaled formula variants (CT4)
// ============================================================================
describe("canvasGold (tier-scaled)", () => {
  it("T1 unchanged: returns CANVAS_GOLD_BASE × size² × mult", () => {
    expect(canvasGold(1, 1, 1).toNumber()).toBeCloseTo(10, 5);
    expect(canvasGold(1, 1).toNumber()).toBeCloseTo(10, 5); // default tier=1
  });

  it("T2: ×10 base", () => {
    expect(canvasGold(1, 1, 2).toNumber()).toBeCloseTo(100, 5);
  });

  it("T3: ×100 base", () => {
    expect(canvasGold(1, 1, 3).toNumber()).toBeCloseTo(1000, 5);
  });

  it("tier composes with size² and multiplier", () => {
    // T2, size=2, mult=3: 10 × 4 × 3 × 10 = 1200
    expect(canvasGold(2, 3, 2).toNumber()).toBeCloseTo(1200, 5);
  });
});

describe("canvasTime (tier-scaled)", () => {
  it("T1 unchanged: returns CANVAS_TIME_BASE × size", () => {
    expect(canvasTime(1, 1)).toBeCloseTo(10, 5);
    expect(canvasTime(1)).toBeCloseTo(10, 5); // default tier=1
  });

  it("T2: ×2 base time", () => {
    expect(canvasTime(1, 2)).toBeCloseTo(20, 5);
  });

  it("T4: ×8 base time", () => {
    expect(canvasTime(1, 4)).toBeCloseTo(80, 5);
  });
});

describe("sellPriceUpgradeCost (tier-scaled)", () => {
  it("T1 L1 = 100 (unchanged)", () => {
    expect(sellPriceUpgradeCost(0, 1).toNumber()).toBeCloseTo(100, 1);
    expect(sellPriceUpgradeCost(0).toNumber()).toBeCloseTo(100, 1); // default tier=1
  });

  it("tier-scaling composes with 1.5^level cost ladder", () => {
    // T2, L5: SELL_PRICE_COST_BASE × costTierFactor(2) × 1.5^5 = 100 × 20 × 7.59375 = 15187.5
    expect(sellPriceUpgradeCost(5, 2).toNumber()).toBeCloseTo(
      SELL_PRICE_COST_BASE * COST_GROWTH_BASE * Math.pow(TRACK_COST_GROWTH, 5),
      0,
    );
  });

  it("scales with costTierFactor, not tierFactor, at tier 2", () => {
    expect(sellPriceUpgradeCost(0, 2).toNumber())
      .toBeCloseTo(SELL_PRICE_COST_BASE * COST_GROWTH_BASE, 5);
  });

  it("scales with costTierFactor at tier 3", () => {
    expect(sellPriceUpgradeCost(0, 3).toNumber())
      .toBeCloseTo(SELL_PRICE_COST_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE, 5);
  });
});

describe("speedUpgradeCost (tier-scaled)", () => {
  it("T1 L1 = 100 (unchanged)", () => {
    expect(speedUpgradeCost(0, 1).toNumber()).toBeCloseTo(100, 1);
  });

  it("scales with costTierFactor, not tierFactor, at tier 2", () => {
    expect(speedUpgradeCost(0, 2).toNumber())
      .toBeCloseTo(SPEED_COST_BASE * COST_GROWTH_BASE, 5);
  });

  it("scales with costTierFactor at tier 3", () => {
    expect(speedUpgradeCost(0, 3).toNumber())
      .toBeCloseTo(SPEED_COST_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE, 5);
  });
});

describe("sizeUpgradeCost (tier-scaled)", () => {
  it("T1 L1 = 1000 (unchanged)", () => {
    expect(sizeUpgradeCost(0, 1).toNumber()).toBeCloseTo(1000, 1);
  });

  it("scales with costTierFactor, not tierFactor, at tier 2", () => {
    expect(sizeUpgradeCost(0, 2).toNumber())
      .toBeCloseTo(SIZE_COST_BASE * COST_GROWTH_BASE, 5);
  });

  it("scales with costTierFactor at tier 3", () => {
    expect(sizeUpgradeCost(0, 3).toNumber())
      .toBeCloseTo(SIZE_COST_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE, 5);
  });
});

describe("critUpgradeCost (tier-scaled)", () => {
  it("T1 L1 = 5000 (unchanged)", () => {
    expect(critUpgradeCost(0, 1).toNumber()).toBeCloseTo(5000, 1);
  });

  it("scales with costTierFactor, not tierFactor, at tier 2", () => {
    expect(critUpgradeCost(0, 2).toNumber())
      .toBeCloseTo(CRIT_COST_BASE * COST_GROWTH_BASE, 5);
  });

  it("scales with costTierFactor at tier 3", () => {
    expect(critUpgradeCost(0, 3).toNumber())
      .toBeCloseTo(CRIT_COST_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE, 5);
  });
});

describe("comboUpgradeCost (tier-scaled)", () => {
  it("T1 L1 = 5000 (unchanged)", () => {
    expect(comboUpgradeCost(0, 1).toNumber()).toBeCloseTo(5000, 1);
  });

  it("scales with costTierFactor, not tierFactor, at tier 2", () => {
    expect(comboUpgradeCost(0, 2).toNumber())
      .toBeCloseTo(COMBO_COST_BASE * COST_GROWTH_BASE, 5);
  });

  it("scales with costTierFactor at tier 3", () => {
    expect(comboUpgradeCost(0, 3).toNumber())
      .toBeCloseTo(COMBO_COST_BASE * COST_GROWTH_BASE * COST_GROWTH_BASE, 5);
  });
});
