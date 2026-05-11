import { describe, it, expect } from "vitest";
import {
  fameOnAscend,
  treePartCost,
  canvasGold,
  canvasTime,
  inspiPerSec,
  pmGainPerSale,
  pmFromLifetime,
  pmMult,
  pmThreshold,
  PM_LOG_FACTOR,
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
  SIZE_GOLD_PER_LEVEL,
  SIZE_TIME_PER_LEVEL,
  CRIT_PER_LEVEL,
  CRIT_SPEED_FACTOR,
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

describe("canvasGold (size-driven)", () => {
  it("returns BASE × (1 + SIZE_GOLD_PER_LEVEL × sizeLevel) × multiplier", () => {
    // sizeLevel 0, mult 1 → BASE × 1 × 1 = 10
    expect(canvasGold(0, 1).toNumber()).toBeCloseTo(10, 5);
    // sizeLevel 10, mult 1 → 10 × (1 + 0.3 × 10) = 40
    expect(canvasGold(10, 1).toNumber()).toBeCloseTo(40, 5);
    // sizeLevel 5, mult 2 → 10 × 2.5 × 2 = 50
    expect(canvasGold(5, 2).toNumber()).toBeCloseTo(50, 5);
  });

  it("scales linearly in sizeLevel (not quadratically)", () => {
    const a = canvasGold(0, 1).toNumber();
    const b = canvasGold(1, 1).toNumber();
    const c = canvasGold(2, 1).toNumber();
    expect(b - a).toBeCloseTo(c - b, 5);
  });
});

describe("canvasGold (with sizeMult)", () => {
  it("default sizeMult = 1 leaves formula unchanged", () => {
    expect(canvasGold(5, 1).toNumber()).toBeCloseTo(canvasGold(5, 1, 1).toNumber(), 5);
  });

  it("sizeMult scales the per-level rate multiplicatively", () => {
    // BASE × (1 + 0.30 × sizeMult × sizeLevel) × mult
    // sizeLevel 10, sizeMult 2.0, mult 1: 10 × (1 + 0.30 × 2 × 10) × 1 = 10 × 7 = 70
    expect(canvasGold(10, 1, 2).toNumber()).toBeCloseTo(70, 5);
    // sizeLevel 0, sizeMult 2.0: still 10 (no per-level effect)
    expect(canvasGold(0, 1, 2).toNumber()).toBeCloseTo(10, 5);
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

describe("canvasTime (size-driven)", () => {
  it("returns CANVAS_TIME_BASE × (1 + SIZE_TIME_PER_LEVEL × sizeLevel)", () => {
    // sizeLevel 0 → 2 × 1 = 2 (matches old tier-1 baseline)
    expect(canvasTime(0)).toBeCloseTo(2, 5);
    // sizeLevel 10 → 2 × 2.5 = 5
    expect(canvasTime(10)).toBeCloseTo(5, 5);
    // sizeLevel 4 → 2 × 1.6 = 3.2
    expect(canvasTime(4)).toBeCloseTo(3.2, 5);
  });
});

describe("canvasTime (with sizeMult)", () => {
  it("default sizeMult = 1 leaves formula unchanged", () => {
    expect(canvasTime(4, 1)).toBeCloseTo(canvasTime(4), 5);
    expect(canvasTime(10, 1)).toBeCloseTo(canvasTime(10), 5);
  });

  it("sizeLevel 0 ignores sizeMult (no per-level contribution at L0)", () => {
    // CANVAS_TIME_BASE × (1 + 0.15 × 0 × sizeMult) = 2 regardless of sizeMult
    expect(canvasTime(0, 2)).toBeCloseTo(2, 5);
    expect(canvasTime(0, 5)).toBeCloseTo(2, 5);
  });

  it("sizeMult scales time per-level rate multiplicatively", () => {
    // sizeLevel 10, sizeMult 2: 2 × (1 + 0.15 × 10 × 2) = 2 × 4 = 8
    expect(canvasTime(10, 2)).toBeCloseTo(8, 5);
    // sizeLevel 4, sizeMult 1.5: 2 × (1 + 0.15 × 4 × 1.5) = 2 × 1.9 = 3.8
    expect(canvasTime(4, 1.5)).toBeCloseTo(3.8, 5);
  });
});

describe("pmGainPerSale (linear)", () => {
  it("returns constant rate: every 1000 gold of sale = +1 PM at the differential", () => {
    // At lt=0: a 1000 gold sale ticks +1 PM
    expect(pmGainPerSale(big(1000), big(0)).toNumber()).toBe(1);
    // At lt=999: a 1 gold sale crosses the 1000 boundary → +1 PM
    expect(pmGainPerSale(big(1), big(999)).toNumber()).toBe(1);
    // At lt=1000: a 999 gold sale stays under the next boundary → 0 PM
    expect(pmGainPerSale(big(999), big(1000)).toNumber()).toBe(0);
    // At lt=1M: a 1k gold sale ticks +1 PM (same rate, no slowdown)
    expect(pmGainPerSale(big(1000), big(1_000_000)).toNumber()).toBe(1);
  });

  it("at high lifetime gold, gain rate is still 1 PM per 1k gold (no ratcheting)", () => {
    // At lt=1e15 (way past old ratchet phases), 1k gold sale still gives +1 PM
    // pmFromLifetime(1e15) = 1e12, pmFromLifetime(1e15 + 1000) = 1e12 + 1
    expect(pmGainPerSale(big(1000), big("1000000000000000")).toNumber()).toBe(1);
  });

  it("0g sale grants 0 PM", () => {
    expect(pmGainPerSale(big(0), big(0)).toNumber()).toBe(0);
  });

  it("returns a Big (not a number)", () => {
    const result = pmGainPerSale(big(1000), big(0));
    expect(typeof result.toNumber).toBe("function");
    expect(result.toNumber()).toBe(1);
  });
});

describe("pmFromLifetime (linear)", () => {
  it("returns floor(lifetimeGold / 1000)", () => {
    expect(pmFromLifetime(big(0)).toNumber()).toBe(0);
    expect(pmFromLifetime(big(999)).toNumber()).toBe(0);
    expect(pmFromLifetime(big(1000)).toNumber()).toBe(1);
    expect(pmFromLifetime(big(1500)).toNumber()).toBe(1);
    expect(pmFromLifetime(big(1_000_000)).toNumber()).toBe(1000);
    expect(pmFromLifetime(big(1_000_000_000)).toNumber()).toBe(1_000_000);
  });

  it("grows past the old 30k phase-cap (no ratcheting)", () => {
    expect(pmFromLifetime(big("1e9")).toNumber()).toBeCloseTo(1e6, -2);
    expect(pmFromLifetime(big("1e12")).toNumber()).toBeCloseTo(1e9, -4);
  });

  it("handles Big values past Number.MAX_SAFE_INTEGER", () => {
    const lt = big("1e30");
    const pm = pmFromLifetime(lt);
    // PM = lt / 1000 = 1e27
    expect(pm.gt(big("1e26"))).toBe(true);
  });
});

describe("pmMult (v1.1)", () => {
  it("PM = 0 returns exactly 1.0 (no mult)", () => {
    expect(pmMult(big(0))).toBe(1);
  });

  it("PM = 100 returns ≈ 11.0", () => {
    expect(pmMult(big(100))).toBeCloseTo(11.0, 1);
  });

  it("PM = 1,000 returns ≈ 16.0", () => {
    expect(pmMult(big(1_000))).toBeCloseTo(16.0, 1);
  });

  it("PM = 1,000,000 returns ≈ 31.0", () => {
    expect(pmMult(big(1_000_000))).toBeCloseTo(31.0, 1);
  });

  it("PM = 1e10 returns ≈ 51.0", () => {
    expect(pmMult(big(1e10))).toBeCloseTo(51.0, 1);
  });

  it("PM_LOG_FACTOR is 5.0", () => {
    expect(PM_LOG_FACTOR).toBe(5.0);
  });
});

describe("pmMult — uncapped via Big.log10", () => {
  it("returns expected mult at PM beyond Number.MAX_SAFE_INTEGER", () => {
    expect(pmMult(big("1e20"))).toBeCloseTo(101, 0); // 1 + 5 × 20
    expect(pmMult(big("1e50"))).toBeCloseTo(251, 0); // 1 + 5 × 50
  });
});

describe("pmFromLifetime — high lifetime gold", () => {
  it("doesn't cap at 30,000 PM (loop bound bumped to 100)", () => {
    // lt = 10^200: should yield ~66 phases × ~1000 PM = ~66k PM, not 30k cap
    const pm = pmFromLifetime(big("1e200"));
    expect(pm.gt(big(40000))).toBe(true);
  });
});

describe("pmThreshold (linear) — constant 1000", () => {
  it("returns 1000 regardless of lifetime gold", () => {
    expect(pmThreshold(big(0)).toNumber()).toBe(1000);
    expect(pmThreshold(big(1_000_000)).toNumber()).toBe(1000);
    expect(pmThreshold(big("1e30")).toNumber()).toBe(1000);
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
    expect(SIZE_GOLD_PER_LEVEL).toBeCloseTo(0.30, 5);
    expect(SIZE_TIME_PER_LEVEL).toBeCloseTo(0.15, 5);
    expect(CRIT_PER_LEVEL).toBeCloseTo(0.01, 5);
    expect(CRIT_SPEED_FACTOR).toBe(10);
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
    expect(CANVAS_TIME_BASE).toBe(2);
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
