import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getTreeUpgradeCostMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("core/multipliers — skill-tree v3 (designer-driven)", () => {
  beforeEach(() => {
    useGameStore.setState({
      purchasedNodes: {},
      equipped: {},
      paintMastery: big(0),
    });
  });

  it("getInspiMultiplier returns 1 with no nodes", () => {
    expect(getInspiMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getInspiMultiplier returns 1.05 with get_inspired level 1", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.05, 5);
  });

  it("getInspiMultiplier returns 1.25 with get_inspired level 5", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 5 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.25, 5);
  });

  it("getCanvasGoldMultiplier returns 1.0 with no nodes and no items", () => {
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1.10 with black_white level 1", () => {
    useGameStore.setState({ purchasedNodes: { black_white: 1 } });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.10, 5);
  });

  it("getCanvasGoldMultiplier returns 2.00 with all 10 color nodes at level 1", () => {
    useGameStore.setState({
      purchasedNodes: {
        black_white: 1, magenta: 1, cyan: 1, yellow: 1,
        red: 1, green: 1, blue: 1,
        purple: 1, brown: 1, orange: 1,
      },
    });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(2.00, 5);
  });

  it("getCanvasGoldMultiplier adds 0.50 per rainbow level (single-level major node)", () => {
    useGameStore.setState({ purchasedNodes: { rainbow: 1 } });
    // 1 + 0.50 * 1 = 1.50
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.50, 5);
  });

  it("getAffixMagnitudeBonus: 0 with no Craftsmanship", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(0);
  });

  it("getAffixMagnitudeBonus: +N per Craftsmanship level", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { craftsmanship: 5 } });
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(5);
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
    // 1 + 0.10 (black_white) + 0.05 (item) = 1.15
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.15, 5);
  });

  it("getCanvasSpeedMultiplier returns 1 with no nodes", () => {
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasSpeedMultiplier sums basic_technique + muscle_memory at 1% each per level", () => {
    useGameStore.setState({ purchasedNodes: { basic_technique: 5, muscle_memory: 5 } });
    // 1 + 0.01*5 + 0.01*5 = 1.10
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBeCloseTo(1.10, 5);
  });

  it("getTreeUpgradeCostMultiplier returns 1 with no Bargain", () => {
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getTreeUpgradeCostMultiplier discounts 1% per Bargain level", () => {
    useGameStore.setState({ purchasedNodes: { Bargain: 5 } });
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBeCloseTo(0.95, 5);
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
