import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { getTotalLevelsInStage, getProducingParts, canGrowSapling } from "@/store/treeSlice";
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

describe("treeSlice — growSapling + canGrowSapling", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("canGrowSapling returns false at total stage-0 levels = 9", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 9; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(9);
    expect(canGrowSapling(useGameStore.getState())).toBe(false);
  });

  it("canGrowSapling returns true at exact threshold (totalLevels === 10)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(10);
    expect(canGrowSapling(useGameStore.getState())).toBe(true);
  });

  it("growSapling returns false when canGrowSapling is false; currentStage unchanged", () => {
    expect(useGameStore.getState().growSapling()).toBe(false);
    expect(useGameStore.getState().currentStage).toBe(0);
  });

  it("growSapling returns true when threshold is met; currentStage becomes 1", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    expect(useGameStore.getState().growSapling()).toBe(true);
    expect(useGameStore.getState().currentStage).toBe(1);
  });

  it("after growSapling to stage 1, stage-0 parts remain buyable (D5)", () => {
    useGameStore.getState().add("gold", big(100000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    useGameStore.getState().growSapling();
    expect(useGameStore.getState().currentStage).toBe(1);
    // stage-0 part still buyable
    expect(useGameStore.getState().buyPartLevel("bud")).toBe(true);
    expect(useGameStore.getState().partLevels.bud).toBe(1);
    // stage-1 part now also buyable
    expect(useGameStore.getState().buyPartLevel("leaf")).toBe(true);
    expect(useGameStore.getState().partLevels.leaf).toBe(1);
  });

  it("growSapling returns false at currentStage === TREE_STAGES.length - 1 (already at top)", () => {
    // Force-advance to the last stage by direct setState (test-only shortcut).
    useGameStore.setState({ currentStage: TREE_STAGES.length - 1 });
    expect(useGameStore.getState().growSapling()).toBe(false);
    expect(useGameStore.getState().currentStage).toBe(TREE_STAGES.length - 1);
  });
});

describe("treeSlice — treeTick", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("treeTick(1) with no levels: inspiration unchanged (no-op short-circuit)", () => {
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(before);
  });

  it("treeTick(1) with spark at level 5: credits 0.5 inspi (5 * 0.1 * 1)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(0.5, 6);
  });

  it("treeTick respects deltaSeconds linearly: tick(2) credits 2× tick(1)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(2);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(1.0, 6); // 5 * 0.1 * 2 = 1.0
  });

  it("treeTick credits cumulatively across stages (D5: prior-stage parts still produce)", () => {
    // Set up: spark@1 (stage 0), leaf@1 (stage 1). Force currentStage = 1.
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("spark"); // 1 * 0.1 = 0.1
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().buyPartLevel("leaf"); // 1 * 5 = 5
    // Total expected rate: 0.1 + 5 = 5.1 inspi/sec
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(5.1, 6);
  });
});

describe("treeSlice — resetTree", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("resetTree restores currentStage = 0 and zeroes all part levels", () => {
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("spark");
    useGameStore.getState().buyPartLevel("bud");
    useGameStore.setState({ currentStage: 2 });
    useGameStore.getState().resetTree();
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    for (const stage of TREE_STAGES) {
      for (const part of stage.parts) {
        expect(s.partLevels[part.id]).toBe(0);
      }
    }
  });
});
