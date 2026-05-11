import { describe, it, expect } from "vitest";
import { rollWorkerClass } from "@/core/officeRoll";
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
