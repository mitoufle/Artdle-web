import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getTreeUpgradeCostMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import { useGameStore, type GameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("multipliers — sellPriceLevel + speedLevel contributions", () => {
  // Helper: minimal state-shape stub. The selectors only read certain fields.
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {},
    equipped: {},
    sellPriceLevel: 1,
    speedLevel: 1,
    paintMastery: big(0),
    ...over,
  } as GameStore);

  it("getCanvasGoldMultiplier: includes (1 + 0.10 × sellPriceLevel) additive", () => {
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 1 }))).toBeCloseTo(1.10, 5);
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 5 }))).toBeCloseTo(1.50, 5);
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 10 }))).toBeCloseTo(2.00, 5);
  });

  it("getCanvasSpeedMultiplier: includes (1 + 0.05 × speedLevel) additive", () => {
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 1 }))).toBeCloseTo(1.05, 5);
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 10 }))).toBeCloseTo(1.50, 5);
  });
});

describe("core/multipliers — skill-tree v3 (designer-driven)", () => {
  beforeEach(() => {
    useGameStore.setState({
      purchasedNodes: {},
      equipped: {},
      paintMastery: big(0),
      sellPriceLevel: 0,
      speedLevel: 0,
    });
  });

  it("getInspiMultiplier returns 1 with no nodes", () => {
    expect(getInspiMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getInspiMultiplier returns 1.25 with get_inspired level 1", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.25, 5);
  });

  it("getInspiMultiplier returns 2.25 with get_inspired level 5 (5 × 0.25)", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 5 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(2.25, 5);
  });

  it("getCanvasGoldMultiplier returns 1.0 with no nodes and no items", () => {
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1.20 with black_white level 1 (root tier 20%)", () => {
    useGameStore.setState({ purchasedNodes: { black_white: 1 } });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.20, 5);
  });

  it("getCanvasGoldMultiplier returns 4.80 with all 10 color nodes (tiered: 20+3×30+3×40+3×50)", () => {
    useGameStore.setState({
      purchasedNodes: {
        black_white: 1, magenta: 1, cyan: 1, yellow: 1,
        red: 1, green: 1, blue: 1,
        purple: 1, brown: 1, orange: 1,
      },
    });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(4.80, 5);
  });

  it("getCanvasGoldMultiplier applies rainbow multiplicatively (× 1.50 at level 1)", () => {
    useGameStore.setState({ purchasedNodes: { rainbow: 1 } });
    // (1 + 0) * (1 + 0.50) = 1.50 — alone, indistinguishable from old additive form
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.50, 5);
  });

  it("getCanvasGoldMultiplier composes rainbow multiplicatively over color sum", () => {
    useGameStore.setState({
      purchasedNodes: {
        black_white: 1, magenta: 1, cyan: 1, yellow: 1,
        red: 1, green: 1, blue: 1,
        purple: 1, brown: 1, orange: 1,
        rainbow: 1,
      },
    });
    // (1 + 3.80) × (1 + 0.50) = 4.80 × 1.50 = 7.20
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(7.20, 5);
  });

  it("getAffixMagnitudeBonus: 0 with no Craftsmanship", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(0);
  });

  it("getAffixMagnitudeBonus: +5 per Craftsmanship level (5 levels = +25 pp)", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { craftsmanship: 5 } });
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(25);
  });

  it("getCanvasGoldMultiplier sums equipped +canvas_gold% items + colors", () => {
    useGameStore.setState({
      purchasedNodes: { black_white: 1 },
      equipped: {
        brush: {
          id: "test-1",
          slot: "brush",
          tier: "normal",
          affixes: [{ kind: "+canvas_gold%", magnitude: 5 }],
        },
      },
    });
    // 1 + 0.20 (black_white) + 0.05 (item) = 1.25
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.25, 5);
  });

  it("getCanvasSpeedMultiplier returns 1 with no nodes", () => {
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasSpeedMultiplier sums basic_technique 2%/lvl + muscle_memory 5%/lvl", () => {
    useGameStore.setState({ purchasedNodes: { basic_technique: 5, muscle_memory: 5 } });
    // 1 + 0.02*5 + 0.05*5 = 1 + 0.10 + 0.25 = 1.35
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBeCloseTo(1.35, 5);
  });

  it("getTreeUpgradeCostMultiplier returns 1 with no Bargain", () => {
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getTreeUpgradeCostMultiplier discounts 5% per Bargain level (5 levels = 25%)", () => {
    useGameStore.setState({ purchasedNodes: { Bargain: 5 } });
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBeCloseTo(0.75, 5);
  });

  it("getTreeUpgradeCostMultiplier floors at 0.5 (50% off)", () => {
    // Even with 100 levels (impossible, max is 5), floor still applies.
    useGameStore.setState({ purchasedNodes: { Bargain: 100 } });
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBe(0.5);
  });

  it("getPaintTimeMultiplier returns 1 with no items", () => {
    expect(getPaintTimeMultiplier(useGameStore.getState())).toBe(1);
  });
});
