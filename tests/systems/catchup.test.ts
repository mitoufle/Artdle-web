import { describe, expect, it } from "vitest";
import { runCatchupSimulation, chooseDelta } from "@/systems/catchup";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("chooseDelta", () => {
  it("returns 0.1 for < 30 min", () => expect(chooseDelta(60)).toBe(0.1));
  it("returns 1 for 30min – 1h", () => expect(chooseDelta(2000)).toBe(1));
  it("returns 10 for 1h – 1d", () => expect(chooseDelta(10_000)).toBe(10));
  it("returns 60 for >= 1d", () => expect(chooseDelta(100_000)).toBe(60));
});

describe("runCatchupSimulation", () => {
  it("no-op on elapsed = 0", async () => {
    const gold = useGameStore.getState().gold;
    const result = await runCatchupSimulation(0, () => {});
    expect(result.elapsedSeconds).toBe(0);
    expect(useGameStore.getState().gold.eq(gold)).toBe(true);
  });

  it("clamps negative elapsed to 0", async () => {
    const result = await runCatchupSimulation(-100, () => {});
    expect(result.elapsedSeconds).toBe(0);
  });

  it("credits inspiration over 1h for a producing tree", async () => {
    // Stage-0 part is `cotyledon` (see src/config/treeStages.ts). With 5 levels
    // the tree produces 0.5 inspi/sec at the base rate.
    useGameStore.setState({
      currentStage: 0,
      partLevels: { cotyledon: 5 },
      inspiration: big(0),
    });
    const result = await runCatchupSimulation(3600, () => {});
    expect(result.inspiGained.gt(0)).toBe(true);
    expect(useGameStore.getState().inspiration.gt(0)).toBe(true);
  });

  it("calls onProgress monotonically from 0 to 1", async () => {
    const pcts: number[] = [];
    await runCatchupSimulation(3600, (p) => pcts.push(p));
    expect(pcts.length).toBeGreaterThan(0);
    for (let i = 1; i < pcts.length; i++) {
      expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i - 1]);
    }
    expect(pcts[pcts.length - 1]).toBeCloseTo(1, 2);
  });
});
