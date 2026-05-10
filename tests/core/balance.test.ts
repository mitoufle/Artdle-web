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

describe("canvasGold (with sizeGoldMult)", () => {
  it("default sizeGoldMult = 1 leaves formula unchanged", () => {
    expect(canvasGold(5, 1).toNumber()).toBeCloseTo(canvasGold(5, 1, 1).toNumber(), 5);
  });

  it("sizeGoldMult scales the per-level rate multiplicatively", () => {
    // BASE × (1 + 0.30 × sizeGoldMult × sizeLevel) × mult
    // sizeLevel 10, sizeGoldMult 2.0, mult 1: 10 × (1 + 0.30 × 2 × 10) × 1 = 10 × 7 = 70
    expect(canvasGold(10, 1, 2).toNumber()).toBeCloseTo(70, 5);
    // sizeLevel 0, sizeGoldMult 2.0: still 10 (no per-level effect)
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

describe("pmGainPerSale (v1.1 integer redesign)", () => {
  it("at lt=0, sale=999g grants 0 PM (sub-threshold)", () => {
    expect(pmGainPerSale(big(999), big(0)).toNumber()).toBe(0);
  });

  it("at lt=0, sale=1000g grants 1 PM (exact threshold)", () => {
    expect(pmGainPerSale(big(1000), big(0)).toNumber()).toBe(1);
  });

  it("at lt=0, sale=1500g grants 1 PM (1500/1000 = 1.5 → floor 1)", () => {
    expect(pmGainPerSale(big(1500), big(0)).toNumber()).toBe(1);
  });

  it("at lt=0, sale=2000g grants 2 PM", () => {
    expect(pmGainPerSale(big(2000), big(0)).toNumber()).toBe(2);
  });

  it("at lt=500, sale=500g grants 1 PM (crosses 1000 threshold)", () => {
    expect(pmGainPerSale(big(500), big(500)).toNumber()).toBe(1);
  });

  it("at lt=999_500, sale=1000g grants 1 PM (just enters phase 2)", () => {
    // pmFromLifetime(999_500) = 999. pmFromLifetime(1_000_500) = 1000.
    expect(pmGainPerSale(big(1000), big(999_500)).toNumber()).toBe(1);
  });

  it("at lt=1M, sale=1000g grants 0 PM (now in phase 2, threshold 1M)", () => {
    expect(pmGainPerSale(big(1000), big(1_000_000)).toNumber()).toBe(0);
  });

  it("at lt=1M, sale=1M grants 1 PM (one phase-2 tick)", () => {
    expect(pmGainPerSale(big(1_000_000), big(1_000_000)).toNumber()).toBe(1);
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

describe("pmFromLifetime (v1.1 integer)", () => {
  it("lt=0 → 0 PM", () => {
    expect(pmFromLifetime(big(0)).toNumber()).toBe(0);
  });

  it("lt=999 → 0 PM (sub-threshold)", () => {
    expect(pmFromLifetime(big(999)).toNumber()).toBe(0);
  });

  it("lt=1000 → 1 PM", () => {
    expect(pmFromLifetime(big(1000)).toNumber()).toBe(1);
  });

  it("lt=999_999 → 999 PM", () => {
    expect(pmFromLifetime(big(999_999)).toNumber()).toBe(999);
  });

  it("lt=1_000_000 → 1000 PM (end of phase 1)", () => {
    expect(pmFromLifetime(big(1_000_000)).toNumber()).toBe(1000);
  });

  it("lt=1_500_000 → 1000 PM (within phase 2 sub-threshold)", () => {
    expect(pmFromLifetime(big(1_500_000)).toNumber()).toBe(1000);
  });

  it("lt=2_000_000 → 1001 PM (one phase-2 tick)", () => {
    expect(pmFromLifetime(big(2_000_000)).toNumber()).toBe(1001);
  });

  it("lt=1e9 → 1999 PM (end of phase 2)", () => {
    expect(pmFromLifetime(big(1e9)).toNumber()).toBe(1999);
  });

  it("lt=1e12 → 2998 PM (end of phase 3)", () => {
    expect(pmFromLifetime(big(1e12)).toNumber()).toBe(2998);
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

describe("pmThreshold (v1.1 PM redesign)", () => {
  it("at lifetime 0, threshold is 1000", () => {
    expect(pmThreshold(big(0)).toNumber()).toBe(1000);
  });

  it("at lifetime 999_999, threshold is still 1000 (phase 1)", () => {
    expect(pmThreshold(big(999_999)).toNumber()).toBe(1000);
  });

  it("at lifetime 1_000_000, threshold steps up to 1_000_000", () => {
    expect(pmThreshold(big(1_000_000)).toNumber()).toBe(1_000_000);
  });

  it("at lifetime 999_999_999, threshold is still 1_000_000 (phase 2)", () => {
    expect(pmThreshold(big(999_999_999)).toNumber()).toBe(1_000_000);
  });

  it("at lifetime 1_000_000_000, threshold steps up to 1e9", () => {
    expect(pmThreshold(big(1_000_000_000)).toNumber()).toBe(1_000_000_000);
  });

  it("at lifetime 1e12, threshold is 1e12", () => {
    expect(pmThreshold(big(1e12)).toNumber()).toBe(1e12);
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
