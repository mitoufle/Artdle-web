import { describe, it, expect } from "vitest";
import {
  palierAscend,
  fameOnAscend,
  treePartCost,
  canvasGold,
  canvasTime,
  tierUpgradeCost,
  inspiPerSec,
  pmGainPerSale,
  pmMult,
  PALIER_BASE,
  PALIER_GROWTH,
  MAX_TIER,
  PM_LOG_FACTOR,
} from "@/core/balance";
import { big } from "@/core/bigNumber";

describe("palierAscend", () => {
  it("base palier at count=0", () => {
    expect(palierAscend(0).toNumber()).toBeCloseTo(PALIER_BASE, 5);
  });

  it("doubles each ascend", () => {
    expect(palierAscend(1).toNumber()).toBeCloseTo(PALIER_BASE * PALIER_GROWTH, 5);
    expect(palierAscend(5).toNumber()).toBeCloseTo(PALIER_BASE * Math.pow(PALIER_GROWTH, 5), 5);
  });

  it("scales to large counts without overflow", () => {
    const p = palierAscend(50);
    expect(p.gt(big("1e15"))).toBe(true);
  });
});

describe("fameOnAscend", () => {
  it("returns 0 at inspi = 1 (log10(1) = 0)", () => {
    expect(fameOnAscend(big(1))).toBe(0);
  });

  it("ramps smoothly: returns 9 at inspi = 9 (floor(log10(9)*10))", () => {
    expect(fameOnAscend(big(9))).toBe(9);
  });

  it("returns 10 at inspi = 10", () => {
    expect(fameOnAscend(big(10))).toBe(10);
  });

  it("returns 30 at inspi = 1000", () => {
    expect(fameOnAscend(big(1000))).toBe(30);
  });

  it("returns 60 at inspi = 1e6", () => {
    expect(fameOnAscend(big(1e6))).toBe(60);
  });

  it("returns 0 (not negative) when inspi is 0", () => {
    expect(fameOnAscend(big(0))).toBe(0);
  });

  it("returns 0 (not negative) when inspi is fractional below 1", () => {
    expect(fameOnAscend(big(0.5))).toBe(0);
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

describe("canvasGold", () => {
  it("scales linearly with multiplier", () => {
    expect(canvasGold(1, 1).toNumber()).toBe(10);
    expect(canvasGold(1, 2).toNumber()).toBe(20);
    expect(canvasGold(1, 0.5).toNumber()).toBe(5);
  });
});

describe("canvasGold (v1.1 tier scaling)", () => {
  it("tier 1, mult 1: returns CANVAS_GOLD_BASE × 1 = 10", () => {
    expect(canvasGold(1, 1).toNumber()).toBe(10);
  });

  it("tier 5, mult 1: returns CANVAS_GOLD_BASE × 25 = 250", () => {
    expect(canvasGold(5, 1).toNumber()).toBe(250);
  });

  it("tier 10, mult 1: returns CANVAS_GOLD_BASE × 100 = 1000", () => {
    expect(canvasGold(10, 1).toNumber()).toBe(1000);
  });

  it("tier 10, mult 2: returns 2000 (mult composes)", () => {
    expect(canvasGold(10, 2).toNumber()).toBe(2000);
  });

  it("tier 1, mult 1.5: returns 15", () => {
    expect(canvasGold(1, 1.5).toNumber()).toBeCloseTo(15, 9);
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

describe("canvasTime (v1.1)", () => {
  it("tier 1 paints in 2 seconds", () => {
    expect(canvasTime(1)).toBe(2);
  });

  it("tier 5 paints in 10 seconds (matches v1.0 PAINT_TIME_BASE_SECONDS)", () => {
    expect(canvasTime(5)).toBe(10);
  });

  it("tier 10 paints in 20 seconds", () => {
    expect(canvasTime(10)).toBe(20);
  });

  it("scales linearly with tier (×2)", () => {
    expect(canvasTime(7)).toBe(14);
    expect(canvasTime(3)).toBe(6);
  });
});

describe("tierUpgradeCost (v1.1)", () => {
  it("tier 1 → 2 costs exactly 100 g", () => {
    expect(tierUpgradeCost(1).toNumber()).toBe(100);
  });

  it("tier 5 → 6 costs ≈ 5,973 g", () => {
    expect(tierUpgradeCost(5).toNumber()).toBeCloseTo(5973, 0);
  });

  it("tier 9 → 10 costs ≈ 356,745 g", () => {
    expect(tierUpgradeCost(9).toNumber()).toBeCloseTo(356745, 0);
  });

  it("MAX_TIER is 10", () => {
    expect(MAX_TIER).toBe(10);
  });
});

describe("pmGainPerSale (v1.1)", () => {
  it("tier 1 sale grants 1 PM", () => {
    expect(pmGainPerSale(1).toNumber()).toBe(1);
  });

  it("tier 5 sale grants 25 PM", () => {
    expect(pmGainPerSale(5).toNumber()).toBe(25);
  });

  it("tier 10 sale grants 100 PM", () => {
    expect(pmGainPerSale(10).toNumber()).toBe(100);
  });

  it("returns a Big (not a number)", () => {
    const result = pmGainPerSale(7);
    expect(typeof result.toNumber).toBe("function");
    expect(result.toNumber()).toBe(49);
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
