import { describe, it, expect } from "vitest";
import { TREE_STAGES } from "@/config/treeStages";

describe("TREE_STAGES config", () => {
  it("has exactly 3 stages, ordered seed → sapling → tree", () => {
    expect(TREE_STAGES).toHaveLength(3);
    expect(TREE_STAGES[0]?.id).toBe("seed");
    expect(TREE_STAGES[1]?.id).toBe("sapling");
    expect(TREE_STAGES[2]?.id).toBe("tree");
  });

  it("unlockThreshold is strictly increasing across stages", () => {
    expect(TREE_STAGES[0]?.unlockThreshold).toBe(0);
    expect(TREE_STAGES[1]?.unlockThreshold).toBe(10);
    expect(TREE_STAGES[2]?.unlockThreshold).toBe(100);
    // Pin the strict-increase invariant for future-wave additions.
    for (let i = 1; i < TREE_STAGES.length; i++) {
      expect(TREE_STAGES[i]!.unlockThreshold).toBeGreaterThan(
        TREE_STAGES[i - 1]!.unlockThreshold,
      );
    }
  });

  it("all part IDs are unique across all stages", () => {
    const allIds = TREE_STAGES.flatMap((s) => s.parts.map((p) => p.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("all stage IDs are unique", () => {
    const ids = TREE_STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every part has positive baseCost and rate", () => {
    for (const stage of TREE_STAGES) {
      for (const part of stage.parts) {
        expect(part.baseCost).toBeGreaterThan(0);
        expect(part.rate).toBeGreaterThan(0);
      }
    }
  });

  it("stage 0 is the only stage with unlockThreshold 0", () => {
    const zeros = TREE_STAGES.filter((s) => s.unlockThreshold === 0);
    expect(zeros).toHaveLength(1);
    expect(zeros[0]?.id).toBe("seed");
  });
});
