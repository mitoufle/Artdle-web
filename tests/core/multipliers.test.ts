import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getAscendFameMultiplier,
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getTreeUpgradeCostMultiplier,
  getCritChance,
  getCritChunks,
  getComboBaseChance,
  getWorkerGoldFactor,
} from "@/core/multipliers";
import { createWorker } from "@/store/officeSlice";
import type { CanvasMultiplierInputs } from "@/core/multipliers";
import { useGameStore, type GameStore } from "@/store";
import type { Item } from "@/store/workshopSlice";
import { CRIT_SOFT_CAP_CEILING, BASE_CRIT_CHUNKS } from "@/core/balance";

describe("multipliers — sellPriceLevel + speedLevel contributions", () => {
  // Helper: minimal state-shape stub. The selectors only read certain fields.
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {},
    equipped: {},
    roster: [],
    sellPriceLevel: 1,
    speedLevel: 1,
    canvasTier: 1,
    completedResearches: {},
    ...over,
  } as GameStore);

  it("getCanvasGoldMultiplier: includes (1 + 0.15 × sellPriceLevel) additive", () => {
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 1 }))).toBeCloseTo(1.15, 5);
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 5 }))).toBeCloseTo(1.75, 5);
    expect(getCanvasGoldMultiplier(stub({ sellPriceLevel: 10 }))).toBeCloseTo(2.50, 5);
  });

  it("getCanvasSpeedMultiplier: includes (1 + 0.15 × speedLevel) additive", () => {
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 1 }))).toBeCloseTo(1.15, 5);
    expect(getCanvasSpeedMultiplier(stub({ speedLevel: 10 }))).toBeCloseTo(2.50, 5);
  });
});

describe("core/multipliers — skill-tree v3 (designer-driven)", () => {
  beforeEach(() => {
    useGameStore.setState({
      purchasedNodes: {},
      equipped: {},
      sellPriceLevel: 0,
      speedLevel: 0,
      museBurstTimer: 0,
    });
  });

  it("getInspiMultiplier returns 1 with no nodes", () => {
    expect(getInspiMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getInspiMultiplier returns 1.50 with get_inspired level 1", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.50, 5);
  });

  it("getInspiMultiplier returns 3.50 with get_inspired level 5 (5 × 0.50)", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 5 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(3.50, 5);
  });

  it("Zion: no bonus when not owned, even with upgrades at level 100", () => {
    useGameStore.setState({ purchasedNodes: {}, partLevels: { a: 100, b: 140 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1, 5);
  });

  it("Zion: no bonus when owned but no upgrade has reached level 100", () => {
    useGameStore.setState({ purchasedNodes: { zion: 1 }, partLevels: { a: 99, b: 50 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1, 5);
  });

  it("Zion: +10% per upgrade at level >= 100 (counted once each)", () => {
    useGameStore.setState({ purchasedNodes: { zion: 1 }, partLevels: { a: 100, b: 140, c: 99 } });
    // two upgrades >= 100 => +20%
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.20, 5);
  });

  it("Zion: stacks additively with get_inspired", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 2, zion: 1 }, partLevels: { a: 100 } });
    // 1 + 2*0.50 + 1*0.10 = 2.10
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(2.10, 5);
  });

  it("Babylon King: +100% inspiration per level (additive)", () => {
    useGameStore.setState({ purchasedNodes: { babylon_king: 2 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(3.0, 5);
  });

  it("Babylon King: stacks additively with get_inspired", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1, babylon_king: 1 } });
    // 1 + 0.50 + 1.00 = 2.50
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(2.5, 5);
  });

  it("Muse Burst: x7 inspiration multiplier while the buff timer is active", () => {
    useGameStore.setState({ purchasedNodes: {}, museBurstTimer: 42 });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(7, 5);
  });

  it("Muse Burst: no effect when the timer is 0", () => {
    useGameStore.setState({ purchasedNodes: {}, museBurstTimer: 0 });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1, 5);
  });

  it("Muse Burst: multiplies the whole bonus pool (stacks with get_inspired)", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 }, museBurstTimer: 42 });
    // (1 + 0.50) * 7 = 10.5
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(10.5, 5);
  });

  it("getAscendFameMultiplier: 1.0 without Royalties, +70% per level with", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getAscendFameMultiplier(useGameStore.getState())).toBeCloseTo(1, 5);
    useGameStore.setState({ purchasedNodes: { royalties: 3 } });
    // 1 + 3 * 0.70 = 3.10
    expect(getAscendFameMultiplier(useGameStore.getState())).toBeCloseTo(3.10, 5);
  });

  it("getCanvasGoldMultiplier returns 1.0 with no nodes and no items", () => {
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1.50 with black_white level 1 (root tier 50%)", () => {
    useGameStore.setState({ purchasedNodes: { black_white: 1 } });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.50, 5);
  });

  it("getCanvasGoldMultiplier returns 13.80 with all 10 color nodes (tiered: 50+3×80+3×130+3×200)", () => {
    useGameStore.setState({
      purchasedNodes: {
        black_white: 1, magenta: 1, cyan: 1, yellow: 1,
        red: 1, green: 1, blue: 1,
        purple: 1, brown: 1, orange: 1,
      },
    });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(13.80, 5);
  });

  it("getCanvasGoldMultiplier applies rainbow multiplicatively (× 6.00 at level 1)", () => {
    useGameStore.setState({ purchasedNodes: { rainbow: 1 } });
    // (1 + 0) * (1 + 5.00) = 6.00
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(6.00, 5);
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
    // (1 + 12.80) × (1 + 5.00) = 13.80 × 6.00 = 82.80
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(82.80, 5);
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

  it("getAffixMagnitudeBonus: better_scaling adds workshopLevel pp when purchased", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { better_scaling: 1 }, workshopLevel: 10 });
    // 0 craftsmanship + 1 × 10 (workshopLevel) = 10
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(10);
  });

  it("getAffixMagnitudeBonus: better_scaling stacks with Craftsmanship", async () => {
    const { getAffixMagnitudeBonus } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { craftsmanship: 3, better_scaling: 1 }, workshopLevel: 5 });
    // 3 × 5 (craftsmanship) + 1 × 5 (better_scaling × workshopLevel) = 15 + 5 = 20
    expect(getAffixMagnitudeBonus(useGameStore.getState())).toBe(20);
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
          fuseCount: 0,
        },
      },
    });
    // 1 + 0.50 (black_white) + 0.05 (item) = 1.55
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.55, 5);
  });

  it("getCanvasSpeedMultiplier returns 1 with no nodes", () => {
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasSpeedMultiplier sums basic_technique 10%/lvl + muscle_memory 10%/lvl", () => {
    useGameStore.setState({ purchasedNodes: { basic_technique: 5, muscle_memory: 5 } });
    // 1 + 0.10*5 + 0.10*5 = 1 + 0.50 + 0.50 = 2.00
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBeCloseTo(2.00, 5);
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
    canvasTier: 1,
    ...over,
  } as GameStore);

  it("getCritChance is linear below soft-cap threshold (0.30)", () => {
    // BASE_CRIT_CHANCE = 0.01; critLevel 0 → raw = 0.01
    expect(getCritChance(stub({ critLevel: 0 }))).toBeCloseTo(0.01, 5);
    expect(getCritChance(stub({ critLevel: 1 }))).toBeCloseTo(0.02, 5);
    // critLevel 29 → raw = 0.01 + 0.29 = 0.30 = threshold, still linear
    expect(getCritChance(stub({ critLevel: 29 }))).toBeCloseTo(0.30, 5);
  });

  it("getCritChance applies diminishing returns above threshold", () => {
    // critLevel 50 → raw = 0.01 + 0.50 = 0.51 → soft-cap compresses
    // 0.30 + 0.65 × (1 − exp(−0.21/0.325)) ≈ 0.614
    expect(getCritChance(stub({ critLevel: 50 }))).toBeGreaterThan(0.30);
    expect(getCritChance(stub({ critLevel: 50 }))).toBeLessThan(CRIT_SOFT_CAP_CEILING);
  });

  it("getCritChance never exceeds CRIT_SOFT_CAP_CEILING", () => {
    // critLevel 200: raw=2.01 → effective clearly below ceiling
    expect(getCritChance(stub({ critLevel: 200 }))).toBeLessThan(CRIT_SOFT_CAP_CEILING);
    // critLevel 9999: raw≈100.0 → exp underflows to 0, formula returns exactly ceiling
    expect(getCritChance(stub({ critLevel: 9999 }))).toBeLessThanOrEqual(CRIT_SOFT_CAP_CEILING);
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
    purchasedNodes: {}, equipped: {}, roster: [], speedLevel: 1, canvasTier: 1, completedResearches: {}, ...over,
  } as GameStore);

  it("includes equipped +speed% magnitudes additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+speed%", magnitude: 10 }, { kind: "+speed%", magnitude: 5 }],
      fuseCount: 0,
    };
    const state = stub({ equipped: { brush: item }, speedLevel: 1 });
    // bonus = SPEED_PER_LEVEL × speedLevel(1) + 0.10 + 0.05 = 0.15 + 0.15 = 0.30
    expect(getCanvasSpeedMultiplier(state)).toBeCloseTo(1.30, 5);
  });
});

describe("getCritChance — per-chunk rework", () => {
  it("returns BASE_CRIT_CHANCE (0.01) at default state", () => {
    const state = { critLevel: 0, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(state)).toBeCloseTo(0.01, 6);
  });

  it("adds CRIT_PER_LEVEL per critLevel up to MAX_CRIT_LEVEL", () => {
    const s1 = { critLevel: 10, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(s1)).toBeCloseTo(0.01 + 0.01 * 10, 6);  // 0.11
    const s50 = { critLevel: 50, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(s50)).toBeGreaterThan(0.30);  // past soft-cap threshold; formula compresses
  });

  it("caps critLevel contribution at MAX_CRIT_LEVEL even when state.critLevel exceeds it", () => {
    const s60 = { critLevel: 60, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    const s50 = { critLevel: 50, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(s60)).toBe(getCritChance(s50));
  });

  it("ignores items and workers (sources moved to getCritChunks)", () => {
    const stateWithItem = {
      critLevel: 0,
      equipped: { brush: { slot: "brush", tier: "normal", affixes: [{ kind: "+crit_chunks", magnitude: 50 }], fuseCount: 0 } },
      roster: [],
      purchasedNodes: {},
    } as unknown as GameStore;
    // Even though a +crit_chunks affix is present, getCritChance must not see it.
    expect(getCritChance(stateWithItem)).toBeCloseTo(0.01, 6);
  });
});

describe("getCritChunks", () => {
  it("returns BASE_CRIT_CHUNKS (1) at default state", () => {
    const state = { equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChunks(state)).toBe(1);
  });

  it("returns at least 0; never NaN even with empty equipped/roster", () => {
    const state = { equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(Number.isFinite(getCritChunks(state))).toBe(true);
    expect(getCritChunks(state)).toBeGreaterThanOrEqual(0);
  });
});

describe("getCritChunks — item magnitude as percent of base", () => {
  /** Minimal state for getCritChunks: it reads equipped, roster, and purchasedNodes (socks). */
  function critState(
    equipped: Record<string, { affixes: { kind: string; magnitude: number }[] }>,
    opts: { socks?: boolean } = {},
  ): CanvasMultiplierInputs {
    return {
      equipped,
      roster: [],
      purchasedNodes: opts.socks ? { socks: 1 } : {},
    } as unknown as CanvasMultiplierInputs;
  }

  it("returns BASE_CRIT_CHUNKS when nothing is equipped", () => {
    expect(getCritChunks(critState({}))).toBe(BASE_CRIT_CHUNKS); // 1
  });

  it("reads a single +crit_chunks magnitude as a percent (85 -> +85% of base -> floor 1.85 = 1)", () => {
    const s = critState({ brush: { affixes: [{ kind: "+crit_chunks", magnitude: 85 }] } });
    expect(getCritChunks(s)).toBe(1); // floor(1 * 1.85)
  });

  it("stacks item percentages additively (85 + 85 -> +170% -> floor 2.7 = 2)", () => {
    const s = critState({
      brush: { affixes: [{ kind: "+crit_chunks", magnitude: 85 }] },
      palette: { affixes: [{ kind: "+crit_chunks", magnitude: 85 }] },
    });
    expect(getCritChunks(s)).toBe(2);
  });

  it("applies socks x1.5 to a boots crit affix percentage (100 * 1.5 = +150% -> floor 2.5 = 2)", () => {
    const s = critState(
      { boots: { affixes: [{ kind: "+crit_chunks", magnitude: 100 }] } },
      { socks: true },
    );
    expect(getCritChunks(s)).toBe(2);
  });
});

// getCritGoldBonus tests are removed — function is being deleted.

describe("getComboBaseChance — equipped +combo_chance% contribution", () => {
  const stub = (over: Partial<GameStore> = {}): GameStore => ({
    purchasedNodes: {}, equipped: {}, roster: [], comboLevel: 0, canvasTier: 1, ...over,
  } as GameStore);

  it("adds equipped +combo_chance% magnitudes additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+combo_chance%", magnitude: 15 }],
      fuseCount: 0,
    };
    const state = stub({ comboLevel: 10, equipped: { brush: item } });
    // base = 0.20 (from level) + 0.15 (from affix) = 0.35
    expect(getComboBaseChance(state)).toBeCloseTo(0.35, 5);
  });
});

describe("multipliers — additive stacking across canvas + items", () => {
  it("getCanvasGoldMultiplier sums canvas + item sources additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const state = {
      purchasedNodes: {},
      equipped: { brush: item },
      sellPriceLevel: 5,
      speedLevel: 0, critLevel: 0, comboLevel: 0,
      canvasTier: 1,
      completedResearches: {},
    } as unknown as GameStore;
    // Canvas: 0.15 × 5 = 0.75; Items: 10/100 = 0.10
    // Total bonus = 0.85 → multiplier = 1.85 (no rainbow, no color tree, no workers)
    expect(getCanvasGoldMultiplier(state)).toBeCloseTo(1.85, 4);
  });

  it("getCanvasSpeedMultiplier sums canvas + item sources additively", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+speed%", magnitude: 10 }],
      fuseCount: 0,
    };
    const state = {
      purchasedNodes: {},
      equipped: { brush: item },
      sellPriceLevel: 0, speedLevel: 4, critLevel: 0, comboLevel: 0,
      canvasTier: 1,
      completedResearches: {},
    } as unknown as GameStore;
    // Canvas: 0.15 × 4 = 0.60; Items: 0.10
    // Total bonus = 0.70 → multiplier = 1.70 (no workers)
    expect(getCanvasSpeedMultiplier(state)).toBeCloseTo(1.70, 4);
  });

  it("getCritChance: only critLevel contributes (items moved to getCritChunks)", () => {
    const item: Item = {
      id: "i1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+crit_chunks", magnitude: 5 }],
      fuseCount: 0,
    };
    const state = {
      purchasedNodes: {},
      equipped: { brush: item },
      sellPriceLevel: 0, speedLevel: 0, critLevel: 10, comboLevel: 0,
      canvasTier: 1,
    } as unknown as GameStore;
    // BASE_CRIT_CHANCE (0.01) + CRIT_PER_LEVEL × 10 (0.10) = 0.11 — items ignored
    expect(getCritChance(state)).toBeCloseTo(0.11, 4);
  });
});

describe("school bonuses on multipliers", () => {
  it("getInspiMultiplier: school +% inspiration gain stacks additively", () => {
    // closer_to_nature: kind="+% inspiration gain", value=0.15
    const state = {
      purchasedNodes: {},
      completedResearches: { closer_to_nature: true },
    } as unknown as GameStore;
    expect(getInspiMultiplier(state)).toBeCloseTo(1.15, 5);
  });

  it("getInspiMultiplier: stacks school bonus with get_inspired nodes", () => {
    const state = {
      purchasedNodes: { get_inspired: 2 },
      completedResearches: { closer_to_nature: true },
    } as unknown as GameStore;
    // 1 + 2*0.50 + 0.15 = 2.15
    expect(getInspiMultiplier(state)).toBeCloseTo(2.15, 5);
  });

  it("getSchoolAffixMagnitudeMultiplier: 1.0 with no completed research", async () => {
    const { getSchoolAffixMagnitudeMultiplier } = await import("@/core/multipliers");
    const state = { completedResearches: {} } as unknown as GameStore;
    expect(getSchoolAffixMagnitudeMultiplier(state)).toBeCloseTo(1.0, 5);
  });

  it("getSchoolAffixMagnitudeMultiplier: 1.10 with expensive_machinery completed", async () => {
    const { getSchoolAffixMagnitudeMultiplier } = await import("@/core/multipliers");
    const state = { completedResearches: { expensive_machinery: true } } as unknown as GameStore;
    // 1 + 0.1 = 1.10
    expect(getSchoolAffixMagnitudeMultiplier(state)).toBeCloseTo(1.10, 5);
  });

  it("getSkillAffixMagnitudeMultiplier: 1.0 with no expert_manufacture node", async () => {
    const { getSkillAffixMagnitudeMultiplier } = await import("@/core/multipliers");
    const state = { purchasedNodes: {} } as unknown as GameStore;
    expect(getSkillAffixMagnitudeMultiplier(state)).toBeCloseTo(1.0, 5);
  });

  it("getSkillAffixMagnitudeMultiplier: 1.75 at expert_manufacture L3 (+25% per level)", async () => {
    const { getSkillAffixMagnitudeMultiplier } = await import("@/core/multipliers");
    const state = { purchasedNodes: { expert_manufacture: 3 } } as unknown as GameStore;
    // 1 + 3 × 0.25 = 1.75
    expect(getSkillAffixMagnitudeMultiplier(state)).toBeCloseTo(1.75, 5);
  });

  it("getSkillAffixMagnitudeMultiplier: 2.25 at expert_manufacture L5 (max)", async () => {
    const { getSkillAffixMagnitudeMultiplier } = await import("@/core/multipliers");
    const state = { purchasedNodes: { expert_manufacture: 5 } } as unknown as GameStore;
    // 1 + 5 × 0.25 = 2.25
    expect(getSkillAffixMagnitudeMultiplier(state)).toBeCloseTo(2.25, 5);
  });
});

describe("new-node capabilities (fame-tree additions 2026-05-11)", () => {
  it("patron: inspi_mult_bonus adds +10% per level on top of get_inspired", async () => {
    const { getInspiMultiplier } = await import("@/core/multipliers");
    useGameStore.setState({ purchasedNodes: { get_inspired: 5, patron: 3 } });
    // 5 × 0.50 (get_inspired) + 3 × 0.10 (patron) = 2.80 bonus → ×3.80
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(3.80, 4);
  });

  it("afterburner: combo_decay_reduction returns 0.01 × level", async () => {
    const { getComboDecayReduction } = await import("@/core/multipliers");
    const state = { purchasedNodes: { afterburner: 3 } } as unknown as GameStore;
    expect(getComboDecayReduction(state)).toBeCloseTo(0.03, 4);
  });

  it("enlightenment: ascend_threshold_reduction returns 0.05 × level", async () => {
    const { getAscendThresholdReduction } = await import("@/core/multipliers");
    const state = { purchasedNodes: { enlightenment: 4 } } as unknown as GameStore;
    expect(getAscendThresholdReduction(state)).toBeCloseTo(0.20, 4);
  });

});

describe("multipliers — per-level effects do NOT scale with canvasTier", () => {
  // Per-level effects stay flat across tiers. The tier-scaling reward comes from
  // base canvas gold (×10/tier in canvasGold / goldPerChunk) and chunks-per-canvas
  // (×2/tier in chunksPerCanvas). Multiplying the per-level *effect* by tierFactor
  // would compound destructively on speed (which divides chunkInterval), making
  // a single L1 speed upgrade at T6 collapse chunk time to near zero.

  it("getCanvasGoldMultiplier: same per-level effect at T1, T2, T6", () => {
    const baseState = {
      purchasedNodes: {}, equipped: {}, roster: [],
      sellPriceLevel: 5, speedLevel: 0, critLevel: 0, comboLevel: 0,
      completedResearches: {}, completedAchievements: {},
    };
    // 1 + 0.15 × 5 = 1.75, regardless of tier
    expect(getCanvasGoldMultiplier({ ...baseState, canvasTier: 1 } as never)).toBeCloseTo(1.75, 5);
    expect(getCanvasGoldMultiplier({ ...baseState, canvasTier: 2 } as never)).toBeCloseTo(1.75, 5);
    expect(getCanvasGoldMultiplier({ ...baseState, canvasTier: 6 } as never)).toBeCloseTo(1.75, 5);
  });

  it("getCanvasSpeedMultiplier: same per-level effect at T1, T2, T6 (was the worst-case bug)", () => {
    const baseState = {
      purchasedNodes: {}, equipped: {}, roster: [],
      sellPriceLevel: 0, speedLevel: 1, critLevel: 0, comboLevel: 0,
      completedResearches: {}, completedAchievements: {},
    };
    // 1 + 0.15 × 1 = 1.15, regardless of tier
    expect(getCanvasSpeedMultiplier({ ...baseState, canvasTier: 1 } as never)).toBeCloseTo(1.15, 5);
    expect(getCanvasSpeedMultiplier({ ...baseState, canvasTier: 6 } as never)).toBeCloseTo(1.15, 5);
  });

  it("getCritChance: same per-level effect at T1 and T2", () => {
    const baseState = {
      purchasedNodes: {}, equipped: {}, roster: [],
      sellPriceLevel: 0, speedLevel: 0, critLevel: 5, comboLevel: 0,
      completedResearches: {}, completedAchievements: {},
    };
    // BASE_CRIT_CHANCE (0.01) + 0.01 × 5 = 0.06, regardless of tier (below soft-cap on both)
    expect(getCritChance({ ...baseState, canvasTier: 1 } as never)).toBeCloseTo(0.06, 5);
    expect(getCritChance({ ...baseState, canvasTier: 2 } as never)).toBeCloseTo(0.06, 5);
  });

  it("getComboBaseChance: same per-level effect at T1 and T2", () => {
    const baseState = {
      purchasedNodes: {}, equipped: {}, roster: [],
      sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 10,
      completedResearches: {}, completedAchievements: {},
    };
    // 0.02 × 10 = 0.20, regardless of tier
    expect(getComboBaseChance({ ...baseState, canvasTier: 1 } as never)).toBeCloseTo(0.20, 5);
    expect(getComboBaseChance({ ...baseState, canvasTier: 2 } as never)).toBeCloseTo(0.20, 5);
  });

  it("item / worker / school / achievement contributions are NOT tier-scaled either", () => {
    const itemOnly = {
      purchasedNodes: {}, equipped: {
        brush: {
          id: "test", slot: "brush" as const, tier: "rare" as const, fuseCount: 0,
          affixes: [{ kind: "+sell_price%" as const, magnitude: 20 }],
        },
      },
      roster: [],
      sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 0,
      completedResearches: {}, completedAchievements: {},
    };
    expect(getCanvasGoldMultiplier({ ...itemOnly, canvasTier: 1 } as never)).toBeCloseTo(1.20, 5);
    expect(getCanvasGoldMultiplier({ ...itemOnly, canvasTier: 3 } as never)).toBeCloseTo(1.20, 5);
  });
});

describe("getWorkerGoldFactor", () => {
  it("is 1.0 with an empty roster (solo player unaffected)", () => {
    expect(getWorkerGoldFactor({ roster: [] } as unknown as GameStore)).toBe(1);
  });

  it("multiplies (1 + goldPct) across the roster", () => {
    const a = { ...createWorker(), stats: { ...createWorker().stats, goldPct: 0.10 } };
    const b = { ...createWorker(), stats: { ...createWorker().stats, goldPct: 0.25 } };
    // (1.10) * (1.25) = 1.375
    expect(getWorkerGoldFactor({ roster: [a, b] } as unknown as GameStore)).toBeCloseTo(1.375, 9);
  });
});

import { getWorkerXpPoolMultiplier } from "@/core/multipliers";

describe("getWorkerXpPoolMultiplier", () => {
  it("is 1.0 with no accelerator nodes", () => {
    expect(getWorkerXpPoolMultiplier({ purchasedNodes: {} } as GameStore)).toBe(1);
  });
  it("adds +10% per worker_xp_mult capability level", () => {
    // accelerator carries `worker_xp_mult`; 3 levels → 1.30
    expect(getWorkerXpPoolMultiplier({ purchasedNodes: { accelerator: 3 } } as unknown as GameStore)).toBeCloseTo(1.30, 9);
  });
});
