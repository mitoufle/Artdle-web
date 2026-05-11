import { describe, it, expect } from "vitest";
import { rollWorkerClass, rollWorkerWeights } from "@/core/officeRoll";
import { setSeed } from "@/core/rng";
import type { GameStore } from "@/store";

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
