import { describe, it, expect } from "vitest";
import {
  palierAscend,
  fameOnAscend,
  treePartCost,
  canvasGold,
  inspiPerSec,
  PALIER_BASE,
  PALIER_GROWTH,
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
    expect(canvasGold(1).toNumber()).toBe(10);
    expect(canvasGold(2).toNumber()).toBe(20);
    expect(canvasGold(0.5).toNumber()).toBe(5);
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
