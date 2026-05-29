import { describe, it, expect } from "vitest";
import { TREE_STAGES } from "@/config/treeStages";

describe("TREE_STAGES — 10 single-upgrade tiers", () => {
  it("has exactly 10 tiers, each with exactly one part", () => {
    expect(TREE_STAGES.length).toBe(10);
    for (const tier of TREE_STAGES) expect(tier.parts.length).toBe(1);
  });
  it("tier 1 is always available; later tiers gate on rising inspi/sec", () => {
    expect(TREE_STAGES[0]!.unlockInspiPerSec).toBe(0);
    for (let i = 1; i < TREE_STAGES.length; i++) {
      expect(TREE_STAGES[i]!.unlockInspiPerSec).toBeGreaterThan(TREE_STAGES[i - 1]!.unlockInspiPerSec);
    }
  });
  it("base rate and base cost ramp ×5 per tier", () => {
    for (let i = 1; i < TREE_STAGES.length; i++) {
      const prev = TREE_STAGES[i - 1]!.parts[0]!;
      const cur = TREE_STAGES[i]!.parts[0]!;
      expect(cur.rate / prev.rate).toBeCloseTo(5, 5);
      expect(cur.baseCost / prev.baseCost).toBeCloseTo(5, 5);
    }
  });
  it("every part id is unique", () => {
    const ids = TREE_STAGES.flatMap((s) => s.parts.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
