import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getTreeUpgradeCostMultiplier,
  getCritChance,
  getComboBaseChance,
  getCanvasSize,
  getOfficeContribution,
} from "@/core/multipliers";
import { useGameStore, type GameStore } from "@/store";
import type { Item } from "@/store/workshopSlice";
import { big } from "@/core/bigNumber";
import { levelScale } from "@/core/balance";

describe("multipliers — sellPriceLevel + speedLevel contributions", () => {
  // Helper: minimal state-shape stub. The selectors only read certain fields.
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {},
    equipped: {},
    roster: [],
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

  it("getCanvasGoldMultiplier sums equipped +sell_price% items + colors", () => {
    useGameStore.setState({
      purchasedNodes: { black_white: 1 },
      equipped: {
        brush: {
          id: "test-1",
          slot: "brush",
          tier: "normal",
          affixes: [{ kind: "+sell_price%", magnitude: 5 }],
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
});

describe("multipliers — crit + combo chances", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {},
    equipped: {},
    roster: [],
    critLevel: 0,
    comboLevel: 0,
    ...over,
  } as GameStore);

  it("getCritChance returns CRIT_PER_LEVEL × critLevel", () => {
    expect(getCritChance(stub({ critLevel: 0 }))).toBeCloseTo(0, 5);
    expect(getCritChance(stub({ critLevel: 1 }))).toBeCloseTo(0.01, 5);
    expect(getCritChance(stub({ critLevel: 50 }))).toBeCloseTo(0.50, 5);
  });

  it("getCritChance clamps at 1.0 (no multi-crit in this spec)", () => {
    expect(getCritChance(stub({ critLevel: 200 }))).toBe(1.0);
  });

  it("getComboBaseChance returns COMBO_PER_LEVEL × comboLevel", () => {
    expect(getComboBaseChance(stub({ comboLevel: 0 }))).toBeCloseTo(0, 5);
    expect(getComboBaseChance(stub({ comboLevel: 5 }))).toBeCloseTo(0.10, 5);
    expect(getComboBaseChance(stub({ comboLevel: 30 }))).toBeCloseTo(0.60, 5);
  });

  it("getComboBaseChance clamps at 1.0", () => {
    expect(getComboBaseChance(stub({ comboLevel: 100 }))).toBe(1.0);
  });
});

describe("getCanvasSpeedMultiplier — equipped +speed% contribution", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, roster: [], speedLevel: 1, ...over,
  } as GameStore);

  it("includes equipped +speed% magnitudes additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+speed%", magnitude: 10 }, { kind: "+speed%", magnitude: 5 }],
    };
    const state = stub({ equipped: { brush: item } });
    // bonus = SPEED_PER_LEVEL × speedLevel(1) + 0.10 + 0.05 = 0.05 + 0.15 = 0.20
    expect(getCanvasSpeedMultiplier(state)).toBeCloseTo(1.20, 5);
  });
});

describe("getCritChance — equipped +crit_chance% contribution", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, roster: [], critLevel: 0, ...over,
  } as GameStore);

  it("adds equipped +crit_chance% magnitudes (already fractional via getEquippedContribution)", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+crit_chance%", magnitude: 10 }],
    };
    const state = stub({ critLevel: 5, equipped: { brush: item } });
    // critChance = 0.05 (from level) + 0.10 (from affix) = 0.15
    expect(getCritChance(state)).toBeCloseTo(0.15, 5);
  });

  it("clamps at 1.0 even with affix contributions", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+crit_chance%", magnitude: 99 }],
    };
    const state = stub({ critLevel: 50, equipped: { brush: item } });
    expect(getCritChance(state)).toBe(1.0);
  });
});

describe("getComboBaseChance — equipped +combo_chance% contribution", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, roster: [], comboLevel: 0, ...over,
  } as GameStore);

  it("adds equipped +combo_chance% magnitudes additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+combo_chance%", magnitude: 15 }],
    };
    const state = stub({ comboLevel: 10, equipped: { brush: item } });
    // base = 0.20 (from level) + 0.15 (from affix) = 0.35
    expect(getComboBaseChance(state)).toBeCloseTo(0.35, 5);
  });
});

describe("getCanvasSize — single unified size value", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, roster: [], sizeLevel: 0, ...over,
  } as GameStore);

  it("returns 1.0 with no contributions (base canvas)", () => {
    expect(getCanvasSize(stub())).toBeCloseTo(1.0, 5);
  });

  it("canvas upgrade contributes SIZE_PER_LEVEL × sizeLevel", () => {
    // sizeLevel 5, SIZE_PER_LEVEL 0.15 → 1 + 0.75 = 1.75
    expect(getCanvasSize(stub({ sizeLevel: 5 }))).toBeCloseTo(1.75, 5);
  });

  it("equipped +size% items add to size additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [
        { kind: "+size%", magnitude: 10 },
        { kind: "+size%", magnitude: 7 },
      ],
    };
    const state = stub({ equipped: { brush: item } });
    expect(getCanvasSize(state)).toBeCloseTo(1.17, 5);
  });

  it("canvas + items + workers all stack additively into size", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+size%", magnitude: 10 }],
    };
    const state = stub({
      sizeLevel: 4,                 // +0.60
      equipped: { brush: item },    // +0.10
      roster: [
        {
          id: "w1", class: "generalist", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+size%", magnitude: 20 }],   // 0.20 × 1.04 = 0.208
        },
      ],
    } as unknown as GameStore);
    // 1 + 0.60 + 0.10 + 0.208 = 1.908
    expect(getCanvasSize(state)).toBeCloseTo(1.908, 4);
  });
});

describe("getOfficeContribution — sums worker affix magnitudes × levelScale", () => {
  it("returns 0 with empty roster", () => {
    const state = { roster: [] } as unknown as GameStore;
    expect(getOfficeContribution(state, "+sell_price%").eq(big(0))).toBe(true);
  });

  it("sums one worker's matching affixes (with level scale)", () => {
    const state = {
      roster: [
        {
          id: "w1", class: "generalist", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+sell_price%", magnitude: 10 }],
        },
      ],
    } as unknown as GameStore;
    const expected = big(10 / 100).mul(levelScale(1));
    expect(getOfficeContribution(state, "+sell_price%").toNumber()).toBeCloseTo(expected.toNumber(), 6);
  });

  it("returns 0 for kinds no worker has", () => {
    const state = {
      roster: [
        {
          id: "w1", class: "generalist", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+sell_price%", magnitude: 10 }],
        },
      ],
    } as unknown as GameStore;
    expect(getOfficeContribution(state, "+speed%").eq(big(0))).toBe(true);
  });
});

describe("multipliers — additive stacking across canvas + items + workers", () => {
  it("getCanvasGoldMultiplier sums all three sources additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
    };
    const state = {
      purchasedNodes: {},
      equipped: { brush: item },
      sellPriceLevel: 5,
      speedLevel: 0, critLevel: 0, comboLevel: 0,
      paintMastery: big(0),
      roster: [
        {
          id: "w1", class: "generalist", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+sell_price%", magnitude: 20 }],
        },
      ],
    } as unknown as GameStore;
    // Canvas: 0.10 × 5 = 0.50; Items: 10/100 = 0.10; Workers: (20/100) × 1.04 = 0.208
    // Total bonus = 0.808 → multiplier = 1.808 (no rainbow, no color tree)
    expect(getCanvasGoldMultiplier(state)).toBeCloseTo(1.808, 4);
  });

  it("getCanvasSpeedMultiplier sums all three sources additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+speed%", magnitude: 10 }],
    };
    const state = {
      purchasedNodes: {},
      equipped: { brush: item },
      sellPriceLevel: 0, speedLevel: 4, critLevel: 0, comboLevel: 0,
      paintMastery: big(0),
      roster: [
        {
          id: "w1", class: "speedrunner", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+speed%", magnitude: 15 }],
        },
      ],
    } as unknown as GameStore;
    // Canvas: 0.05 × 4 = 0.20; Items: 0.10; Workers: 0.15 × 1.04 = 0.156
    // Total bonus = 0.456 → multiplier = 1.456
    expect(getCanvasSpeedMultiplier(state)).toBeCloseTo(1.456, 4);
  });

  it("getCritChance sums canvas + items + workers additively, clamped at 1.0", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+crit_chance%", magnitude: 5 }],
    };
    const state = {
      purchasedNodes: {},
      equipped: { brush: item },
      sellPriceLevel: 0, speedLevel: 0, critLevel: 10, comboLevel: 0,
      paintMastery: big(0),
      roster: [
        {
          id: "w1", class: "speedrunner", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+crit_chance%", magnitude: 5 }],
        },
      ],
    } as unknown as GameStore;
    // Canvas: 0.01 × 10 = 0.10; Items: 0.05; Workers: 0.05 × 1.04 = 0.052
    // Total = 0.202 (well under 1.0)
    expect(getCritChance(state)).toBeCloseTo(0.202, 4);
  });
});

describe("new-node capabilities (fame-tree additions 2026-05-11)", () => {
  it("patron: inspi_mult_bonus adds +10% per level on top of get_inspired", async () => {
    const { getInspiMultiplier } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { get_inspired: 5, patron: 3 } });
    // 5 × 0.25 (get_inspired) + 3 × 0.10 (patron) = 1.55 bonus → ×2.55
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(2.55, 4);
  });

  it("expanding_horizon: canvas_size_bonus adds +5% size per level", async () => {
    const { getCanvasSize } = await import("@/core/multipliers");
    const state = {
      sizeLevel: 4, purchasedNodes: { expanding_horizon: 3 },
      equipped: {}, roster: [],
    } as unknown as GameStore;
    // 1 + 0.15×4 + 0.05×3 = 1.75
    expect(getCanvasSize(state)).toBeCloseTo(1.75, 4);
  });

  it("accelerator: worker_xp_mult returns 1 + 0.10 × level", async () => {
    const { getWorkerXpMultiplier } = await import("@/core/multipliers");
    const state = { purchasedNodes: { accelerator: 4 } } as unknown as GameStore;
    expect(getWorkerXpMultiplier(state)).toBeCloseTo(1.40, 4);
  });

  it("bookkeeper: hire_cost_reduction returns max(0.1, 1 - 0.10 × level), floored", async () => {
    const { getHireCostMultiplier } = await import("@/core/multipliers");
    const stateLow = { purchasedNodes: { bookkeeper: 2 } } as unknown as GameStore;
    expect(getHireCostMultiplier(stateLow)).toBeCloseTo(0.80, 4);
    // Maxed bookkeeper at L4 → 1 - 0.40 = 0.60 (still above the 0.1 floor)
    const stateMax = { purchasedNodes: { bookkeeper: 4 } } as unknown as GameStore;
    expect(getHireCostMultiplier(stateMax)).toBeCloseTo(0.60, 4);
  });

  it("afterburner: combo_decay_reduction returns 0.01 × level", async () => {
    const { getComboDecayReduction } = await import("@/core/multipliers");
    const state = { purchasedNodes: { afterburner: 3 } } as unknown as GameStore;
    expect(getComboDecayReduction(state)).toBeCloseTo(0.03, 4);
  });

  it("prismatic_eye: crit_gold_bonus returns 0.20 × level", async () => {
    const { getCritGoldBonus } = await import("@/core/multipliers");
    const state = { purchasedNodes: { prismatic_eye: 2 } } as unknown as GameStore;
    expect(getCritGoldBonus(state)).toBeCloseTo(0.40, 4);
  });

  it("enlightenment: ascend_threshold_reduction returns 0.05 × level", async () => {
    const { getAscendThresholdReduction } = await import("@/core/multipliers");
    const state = { purchasedNodes: { enlightenment: 4 } } as unknown as GameStore;
    expect(getAscendThresholdReduction(state)).toBeCloseTo(0.20, 4);
  });

  it("master_painter: unlocks class_goldsmith capability", async () => {
    const { hasCapability } = await import("@/store/skillTreeSlice");
    useGameStore.setState({ purchasedNodes: { master_painter: 1 } });
    expect(hasCapability(useGameStore.getState(), "class_goldsmith")).toBe(true);
  });

  it("apprentice_pool: adds inventory slots", async () => {
    const { getMaxInventorySlots } = await import("@/store/workshopSlice");
    useGameStore.setState({ purchasedNodes: { apprentice_pool: 3 } });
    // Base MAX_INVENTORY_SLOTS + 0 chests + 3 from apprentice_pool
    expect(getMaxInventorySlots(useGameStore.getState())).toBe(3 + 3); // assuming MAX_INVENTORY_SLOTS = 3
  });
});
