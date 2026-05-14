import { describe, it, expect } from "vitest";
import { rollWorkerClass, rollWorkerWeights, rollWorkerAffixes, rollCandidate } from "@/core/officeRoll";
import { setSeed } from "@/core/rng";
import type { GameStore } from "@/store";
import { AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";

function stub(over: Partial<GameStore> = {}): GameStore {
  return { purchasedNodes: {}, ...over } as GameStore;
}

describe("rollWorkerClass", () => {
  it("returns generalist when no class capabilities are unlocked", () => {
    setSeed(1);
    for (let i = 0; i < 50; i++) {
      expect(rollWorkerClass(stub())).toBe("generalist");
    }
  });
});

describe("rollWorkerWeights", () => {
  it("generalist: each weight is in [0, 4]", () => {
    setSeed(10);
    for (let i = 0; i < 100; i++) {
      const w = rollWorkerWeights("generalist");
      for (const kind of Object.keys(w) as Array<keyof typeof w>) {
        expect(w[kind]).toBeGreaterThanOrEqual(0);
        expect(w[kind]).toBeLessThanOrEqual(4);
      }
    }
  });

  it("goldsmith: sell + combo in [3, 7]; speed + crit in [0, 2]; size in [1, 3]", () => {
    setSeed(11);
    for (let i = 0; i < 100; i++) {
      const w = rollWorkerWeights("goldsmith");
      expect(w["+sell_price%"]).toBeGreaterThanOrEqual(3);
      expect(w["+sell_price%"]).toBeLessThanOrEqual(7);
      expect(w["+combo_chance%"]).toBeGreaterThanOrEqual(3);
      expect(w["+combo_chance%"]).toBeLessThanOrEqual(7);
      expect(w["+speed%"]).toBeLessThanOrEqual(2);
      expect(w["+crit_chance%"]).toBeLessThanOrEqual(2);
      expect(w["+size%"]).toBeGreaterThanOrEqual(1);
      expect(w["+size%"]).toBeLessThanOrEqual(3);
    }
  });

  it("generalist never returns all-zero weights (rerolls)", () => {
    setSeed(12);
    for (let i = 0; i < 200; i++) {
      const w = rollWorkerWeights("generalist");
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    }
  });
});

describe("rollWorkerAffixes", () => {
  it("rolls exactly tier-slot-count affixes for a legendary (5)", () => {
    setSeed(20);
    const weights = { "+sell_price%": 1, "+speed%": 1, "+size%": 1, "+crit_chance%": 1, "+combo_chance%": 1 };
    const affixes = rollWorkerAffixes(weights, "legendary", stub());
    expect(affixes.length).toBe(5);
  });

  it("rolls 1 affix for common", () => {
    setSeed(21);
    const weights = { "+sell_price%": 2, "+speed%": 2, "+size%": 2, "+crit_chance%": 2, "+combo_chance%": 2 };
    const affixes = rollWorkerAffixes(weights, "common", stub());
    expect(affixes.length).toBe(1);
  });

  it("respects per-worker weights (high-weight kinds dominate)", () => {
    setSeed(22);
    const weights = { "+sell_price%": 100, "+speed%": 0, "+size%": 0, "+crit_chance%": 0, "+combo_chance%": 0 };
    const affixes = rollWorkerAffixes(weights, "legendary", stub());
    for (const a of affixes) {
      expect(a.kind).toBe("+sell_price%");
    }
  });

  it("each affix magnitude is in the AFFIX_MAGNITUDE_RANGE for its kind", () => {
    setSeed(23);
    const weights = { "+sell_price%": 1, "+speed%": 1, "+size%": 1, "+crit_chance%": 1, "+combo_chance%": 1 };
    const affixes = rollWorkerAffixes(weights, "legendary", stub());
    for (const a of affixes) {
      const range = AFFIX_MAGNITUDE_RANGE["normal"][a.kind];
      expect(a.magnitude).toBeGreaterThanOrEqual(range.min);
      expect(a.magnitude).toBeLessThanOrEqual(range.max);
    }
  });
});

describe("rollCandidate", () => {
  it("at office L1 (common-only), tier is common and affix count is 1", () => {
    setSeed(30);
    const c = rollCandidate(1, stub());
    expect(c.tier).toBe("common");
    expect(c.affixes.length).toBe(1);
    expect(c.class).toBe("generalist");
  });

  it("at office L40+, occasionally rolls legendary", () => {
    setSeed(31);
    let sawLegendary = false;
    for (let i = 0; i < 1000; i++) {
      const c = rollCandidate(100, stub());
      if (c.tier === "legendary") {
        sawLegendary = true;
        expect(c.affixes.length).toBe(5);
        break;
      }
    }
    expect(sawLegendary).toBe(true);
  });
});
