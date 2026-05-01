import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { getTotalLevelsInStage, getProducingParts } from "@/store/treeSlice";
import { big } from "@/core/bigNumber";
import { TREE_STAGES } from "@/config/treeStages";

describe("treeSlice — state + buyPartLevel + selectors", () => {
  beforeEach(() => {
    // Reset run currencies and tree state. fame is preserved (cross-run);
    // we don't touch it here.
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("initializes with currentStage 0 and every configured part at level 0", () => {
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    for (const stage of TREE_STAGES) {
      for (const part of stage.parts) {
        expect(s.partLevels[part.id]).toBe(0);
      }
    }
  });

  it("buyPartLevel('spark') with gold ≥ baseCost succeeds: level → 1, gold deducted", () => {
    useGameStore.getState().add("gold", big(10));
    expect(useGameStore.getState().buyPartLevel("spark")).toBe(true);
    const s = useGameStore.getState();
    expect(s.partLevels.spark).toBe(1);
    expect(s.gold.toNumber()).toBe(0);
  });

  it("buyPartLevel('spark') with insufficient gold returns false; state unchanged (atomic)", () => {
    useGameStore.getState().add("gold", big(9));
    expect(useGameStore.getState().buyPartLevel("spark")).toBe(false);
    const s = useGameStore.getState();
    expect(s.partLevels.spark).toBe(0);
    expect(s.gold.toNumber()).toBe(9);
  });

  it("buyPartLevel('leaf') with currentStage = 0 returns false (locked stage)", () => {
    useGameStore.getState().add("gold", big(10000));
    expect(useGameStore.getState().buyPartLevel("leaf")).toBe(false);
    const s = useGameStore.getState();
    expect(s.partLevels.leaf).toBe(0);
    expect(s.gold.toNumber()).toBe(10000); // not deducted
  });

  it("buyPartLevel('nonexistent') returns false without touching gold", () => {
    useGameStore.getState().add("gold", big(100));
    expect(useGameStore.getState().buyPartLevel("nonexistent")).toBe(false);
    expect(useGameStore.getState().gold.toNumber()).toBe(100);
  });

  it("buying spark 10 times brings getTotalLevelsInStage(state, 0) to 10", () => {
    // Cumulative cost of 10 levels: sum_{i=0..9} 10 * 1.15^i ≈ 203.04
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      expect(useGameStore.getState().buyPartLevel("spark")).toBe(true);
    }
    expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(10);
  });

  it("the 11th spark purchase costs ≈ 10 * 1.15^10 (Big.pow precision: toBeCloseTo)", () => {
    // Phase 0+1 lesson #1: Big.pow uses log-domain math; tests must use toBeCloseTo.
    // Buy 10 levels first, then check cost of the 11th attempt.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    const goldBefore = useGameStore.getState().gold;
    expect(useGameStore.getState().buyPartLevel("spark")).toBe(true);
    const goldAfter = useGameStore.getState().gold;
    const spent = goldBefore.sub(goldAfter).toNumber();
    expect(spent).toBeCloseTo(10 * Math.pow(1.15, 10), 3);
  });

  it("getProducingParts returns only parts with level > 0 from unlocked stages", () => {
    useGameStore.getState().add("gold", big(1000));
    useGameStore.getState().buyPartLevel("spark"); // stage 0, level 1
    // 'bud' stays at level 0
    const producing = getProducingParts(useGameStore.getState());
    expect(producing).toHaveLength(1);
    expect(producing[0]?.level).toBe(1);
    expect(producing[0]?.rate).toBe(0.1);
  });
});
