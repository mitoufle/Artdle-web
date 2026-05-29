import { describe, it, expect } from "vitest";
import {
  fameOnAscend,
  treePartCost,
  canvasGold,
  inspiPerSec,
  craftCost,
  xpToNext,
  sellPriceUpgradeCost,
  speedUpgradeCost,
  critUpgradeCost,
  comboUpgradeCost,
  comboBonusFactor,
  comboEffectiveChance,
  SELL_PRICE_PER_LEVEL,
  SPEED_PER_LEVEL,
  CRIT_PER_LEVEL,
  BASE_CRIT_CHANCE,
  BASE_CRIT_CHUNKS,
  MAX_CRIT_LEVEL,
  COMBO_PER_LEVEL,
  COMBO_PER_LINK,
  COMBO_DECAY_PER_LINK,
  SELL_PRICE_COST_BASE,
  SPEED_COST_BASE,
  CRIT_COST_BASE,
  COMBO_COST_BASE,
  TRACK_COST_GROWTH,
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
  PART_MILESTONE_FACTORS,
  getPartMilestoneMultiplier,
  getNextPartMilestone,
  tierFactor,
  BASE_CHUNK_INTERVAL,
  BASE_GOLD_PER_CHUNK,
  TIER_UPGRADE_COST_BASE,
  CELL_RENDER_CAP,
  chunksPerCanvas,
  goldPerChunk,
  tierUpgradeCost,
  chunkInterval,
  CANVAS_GOLD_BASE,
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

describe("canvasGold (chunk-domain)", () => {
  it("T1 base mult=1 returns CANVAS_GOLD_BASE × tierFactor(1) = 10", () => {
    expect(canvasGold(1, 1).toNumber()).toBe(10);
  });
  it("scales linearly with multiplier", () => {
    expect(canvasGold(2.5, 1).toNumber()).toBe(25);
  });
  it("scales by tierFactor(T)", () => {
    expect(canvasGold(1, 2).toNumber()).toBe(10 * tierFactor(2));
    expect(canvasGold(1, 3).toNumber()).toBe(10 * tierFactor(3));
  });
  it("CANVAS_GOLD_BASE constant is 10", () => {
    expect(CANVAS_GOLD_BASE).toBe(10);
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
    expect(SELL_PRICE_PER_LEVEL).toBeCloseTo(0.15, 5);
    expect(SPEED_PER_LEVEL).toBeCloseTo(0.15, 5);
    expect(CRIT_PER_LEVEL).toBeCloseTo(0.01, 5);
    expect(COMBO_PER_LEVEL).toBeCloseTo(0.02, 5);
    expect(COMBO_PER_LINK).toBeCloseTo(0.10, 5);
    expect(COMBO_DECAY_PER_LINK).toBeCloseTo(0.05, 5);
  });

  it("exposes per-track cost bases + shared growth factor", () => {
    expect(SELL_PRICE_COST_BASE).toBe(100);
    expect(SPEED_COST_BASE).toBe(100);
    expect(CRIT_COST_BASE).toBe(5000);
    expect(COMBO_COST_BASE).toBe(5000);
    expect(TRACK_COST_GROWTH).toBeCloseTo(1.5, 5);
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
// Tree part milestones — escalating back-loaded schedule
// ============================================================================
describe("getPartMilestoneMultiplier — escalating back-loaded schedule", () => {
  it("milestone levels and factors are aligned and back-loaded", () => {
    expect(PART_MILESTONES).toEqual([10, 25, 50, 100, 200, 400, 800, 1000]);
    expect(PART_MILESTONE_FACTORS).toEqual([2, 2, 3, 3, 4, 5, 6, 8]);
    expect(PART_MILESTONES.length).toBe(PART_MILESTONE_FACTORS.length);
  });
  it("is 1 below the first milestone", () => {
    expect(getPartMilestoneMultiplier(0)).toBe(1);
    expect(getPartMilestoneMultiplier(9)).toBe(1);
  });
  it("compounds the factors of every milestone reached", () => {
    expect(getPartMilestoneMultiplier(10)).toBe(2);
    expect(getPartMilestoneMultiplier(25)).toBe(4);
    expect(getPartMilestoneMultiplier(50)).toBe(12);
    expect(getPartMilestoneMultiplier(100)).toBe(36);
    expect(getPartMilestoneMultiplier(1000)).toBe(34560);
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
    expect(getNextPartMilestone(400)).toBe(800);
    expect(getNextPartMilestone(800)).toBe(1000);
  });

  it("returns null when all milestones passed (L1000+)", () => {
    expect(getNextPartMilestone(1000)).toBeNull();
    expect(getNextPartMilestone(1500)).toBeNull();
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
// Per-track upgrade cost — confirms no tier scaling (level-only)
// ============================================================================
describe("sellPriceUpgradeCost (no tier scaling)", () => {
  it("L0 → cost = SELL_PRICE_COST_BASE", () => {
    expect(sellPriceUpgradeCost(0).toNumber()).toBe(SELL_PRICE_COST_BASE);
  });
  it("ramps with TRACK_COST_GROWTH per level only", () => {
    expect(sellPriceUpgradeCost(2).toNumber()).toBeCloseTo(
      SELL_PRICE_COST_BASE * Math.pow(TRACK_COST_GROWTH, 2),
      5,
    );
  });
});

describe("speedUpgradeCost (no tier scaling)", () => {
  it("L0 → cost = SPEED_COST_BASE", () => {
    expect(speedUpgradeCost(0).toNumber()).toBe(SPEED_COST_BASE);
  });
  it("ramps with TRACK_COST_GROWTH per level only", () => {
    expect(speedUpgradeCost(2).toNumber()).toBeCloseTo(
      SPEED_COST_BASE * Math.pow(TRACK_COST_GROWTH, 2),
      5,
    );
  });
});

describe("critUpgradeCost (no tier scaling)", () => {
  it("L0 → cost = CRIT_COST_BASE", () => {
    expect(critUpgradeCost(0).toNumber()).toBe(CRIT_COST_BASE);
  });
  it("ramps with TRACK_COST_GROWTH per level only", () => {
    expect(critUpgradeCost(2).toNumber()).toBeCloseTo(
      CRIT_COST_BASE * Math.pow(TRACK_COST_GROWTH, 2),
      5,
    );
  });
});

describe("comboUpgradeCost (no tier scaling)", () => {
  it("L0 → cost = COMBO_COST_BASE", () => {
    expect(comboUpgradeCost(0).toNumber()).toBe(COMBO_COST_BASE);
  });
  it("ramps with TRACK_COST_GROWTH per level only", () => {
    expect(comboUpgradeCost(2).toNumber()).toBeCloseTo(
      COMBO_COST_BASE * Math.pow(TRACK_COST_GROWTH, 2),
      5,
    );
  });
});

describe("chunksPerCanvas", () => {
  it("T1 = 10", () => expect(chunksPerCanvas(1)).toBe(10));
  it("T2 = 20", () => expect(chunksPerCanvas(2)).toBe(20));
  it("T3 = 40", () => expect(chunksPerCanvas(3)).toBe(40));
  it("T7 = 640", () => expect(chunksPerCanvas(7)).toBe(640));
  it("T8 = 1280 (chunks scale past cell cap)", () => expect(chunksPerCanvas(8)).toBe(1280));
  it("T10 = 5120", () => expect(chunksPerCanvas(10)).toBe(5120));
  it("clamps tier to >= 1", () => expect(chunksPerCanvas(0)).toBe(10));
});

describe("goldPerChunk", () => {
  it("T1 base level=0 mult=1 returns 1", () => {
    expect(goldPerChunk(0, 1, 1).toNumber()).toBe(1);
  });
  it("scales ×10 per tier (tierFactor)", () => {
    expect(goldPerChunk(0, 1, 2).toNumber()).toBe(10);
    expect(goldPerChunk(0, 1, 3).toNumber()).toBe(100);
  });
  it("applies multiplier", () => {
    expect(goldPerChunk(0, 2.5, 1).toNumber()).toBe(2.5);
  });
  it("level adds SELL_PRICE_PER_LEVEL (0.15) per level — encoded inside multiplier by callers, formula itself takes mult literally", () => {
    expect(goldPerChunk(99, 1, 1).toNumber()).toBe(1);
  });
});

describe("tierUpgradeCost", () => {
  it("T1 → T2 costs 1000", () => expect(tierUpgradeCost(1).toString()).toBe("1000"));
  it("T2 → T3 costs 1,000,000", () => expect(tierUpgradeCost(2).toString()).toBe("1000000"));
  it("T3 → T4 costs 1,000,000,000", () => expect(tierUpgradeCost(3).toString()).toBe("1000000000"));
});

describe("chunkInterval", () => {
  it("speed multiplier 1 → 5s", () => expect(chunkInterval(1)).toBe(5));
  it("speed multiplier 2 → 2.5s", () => expect(chunkInterval(2)).toBe(2.5));
  it("speed multiplier 10 → 0.5s", () => expect(chunkInterval(10)).toBe(0.5));
  it("guards against zero/negative speed multiplier", () => {
    expect(chunkInterval(0)).toBe(BASE_CHUNK_INTERVAL);
    expect(chunkInterval(-1)).toBe(BASE_CHUNK_INTERVAL);
  });
});

describe("constants", () => {
  it("BASE_CHUNK_INTERVAL = 5", () => expect(BASE_CHUNK_INTERVAL).toBe(5));
  it("BASE_GOLD_PER_CHUNK = 1", () => expect(BASE_GOLD_PER_CHUNK).toBe(1));
  it("TIER_UPGRADE_COST_BASE = 1000", () => expect(TIER_UPGRADE_COST_BASE).toBe(1000));
  it("CELL_RENDER_CAP = 640", () => expect(CELL_RENDER_CAP).toBe(640));
});

// ============================================================================
// Worker stat model constants (redesigned Painter's Office)
// ============================================================================
import {
  WORKER_BASE_STATS, WORKER_PCT_INCREMENTS, WORKER_STROKES_PER_CRIT_INCREMENTS, WORKER_CRIT_CHANCE_CAP,
  WORKER_BASELINE_XP_FRACTION, ACCELERATOR_XP_PER_LEVEL,
} from "@/core/balance";

describe("ascend-xp constants", () => {
  it("baseline split fraction is in (0,1)", () => {
    expect(WORKER_BASELINE_XP_FRACTION).toBeGreaterThan(0);
    expect(WORKER_BASELINE_XP_FRACTION).toBeLessThan(1);
  });
  it("accelerator boosts the ascend pool by +10% per level", () => {
    expect(ACCELERATOR_XP_PER_LEVEL).toBe(0.10);
  });
});

describe("worker stat model constants", () => {
  it("base stats match a fresh painter", () => {
    expect(WORKER_BASE_STATS).toEqual({ goldPct: 0, speed: 1, critChance: 0.01, strokesPerCrit: 1, comboChance: 0 });
  });
  it("percent-stat increments are 0..5 points in 1-point steps", () => {
    expect(WORKER_PCT_INCREMENTS).toEqual([0, 0.01, 0.02, 0.03, 0.04, 0.05]);
  });
  it("strokes-per-crit increments are 0 or 1", () => {
    expect(WORKER_STROKES_PER_CRIT_INCREMENTS).toEqual([0, 1]);
  });
  it("crit chance is hard-capped at 50%", () => {
    expect(WORKER_CRIT_CHANCE_CAP).toBe(0.5);
  });
});
