import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { getTotalLevelsInStage, getProducingParts, canGrowSapling, getTreeInspiPerSec } from "@/store/treeSlice";
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

  it("buyPartLevel('u1') with gold ≥ baseCost succeeds: level → 1, gold deducted", () => {
    useGameStore.getState().add("gold", big(10));
    expect(useGameStore.getState().buyPartLevel("u1")).toBe(true);
    const s = useGameStore.getState();
    expect(s.partLevels.u1).toBe(1);
    expect(s.gold.toNumber()).toBe(0);
  });

  it("buyPartLevel('u1') with insufficient gold returns false; state unchanged (atomic)", () => {
    useGameStore.getState().add("gold", big(9));
    expect(useGameStore.getState().buyPartLevel("u1")).toBe(false);
    const s = useGameStore.getState();
    expect(s.partLevels.u1).toBe(0);
    expect(s.gold.toNumber()).toBe(9);
  });

  it("buyPartLevel('u2') with currentStage = 0 returns false (locked stage)", () => {
    useGameStore.getState().add("gold", big(10000));
    expect(useGameStore.getState().buyPartLevel("u2")).toBe(false);
    const s = useGameStore.getState();
    expect(s.partLevels.u2).toBe(0);
    expect(s.gold.toNumber()).toBe(10000); // not deducted
  });

  it("buyPartLevel('nonexistent') returns false without touching gold", () => {
    useGameStore.getState().add("gold", big(100));
    expect(useGameStore.getState().buyPartLevel("nonexistent")).toBe(false);
    expect(useGameStore.getState().gold.toNumber()).toBe(100);
  });

  it("buying u1 10 times brings getTotalLevelsInStage(state, 0) to 10", () => {
    // Cumulative cost of 10 levels: sum_{i=0..9} 10 * 1.15^i ≈ 203.04
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      expect(useGameStore.getState().buyPartLevel("u1")).toBe(true);
    }
    expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(10);
  });

  it("the 11th u1 purchase costs ≈ 10 * 1.15^10 (Big.pow precision: toBeCloseTo)", () => {
    // Phase 0+1 lesson #1: Big.pow uses log-domain math; tests must use toBeCloseTo.
    // Buy 10 levels first, then check cost of the 11th attempt.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    const goldBefore = useGameStore.getState().gold;
    expect(useGameStore.getState().buyPartLevel("u1")).toBe(true);
    const goldAfter = useGameStore.getState().gold;
    const spent = goldBefore.sub(goldAfter).toNumber();
    expect(spent).toBeCloseTo(10 * Math.pow(1.15, 10), 3);
  });

  it("getProducingParts returns only parts with level > 0 from unlocked stages", () => {
    useGameStore.getState().add("gold", big(1000));
    useGameStore.getState().buyPartLevel("u1"); // stage 0, level 1
    // 'u2' stays at level 0
    const producing = getProducingParts(useGameStore.getState());
    expect(producing).toHaveLength(1);
    expect(producing[0]?.level).toBe(1);
    expect(producing[0]?.rate).toBe(0.1);
  });
});

describe("treeSlice — inspi/sec tier unlock", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.setState({ gold: big(1e9) });
  });

  it("getTreeInspiPerSec reflects producing parts × global multiplier", () => {
    for (let i = 0; i < 10; i++) useGameStore.getState().buyPartLevel("u1"); // L10: 10*0.1*2 = 2/s
    expect(getTreeInspiPerSec(useGameStore.getState()).toNumber()).toBeCloseTo(2, 5);
  });

  it("cannot grow past tier 1 until inspi/sec >= tier 2 threshold (5/s)", () => {
    useGameStore.getState().buyPartLevel("u1"); // 0.1/s < 5
    expect(canGrowSapling(useGameStore.getState())).toBe(false);
  });

  it("auto-grows into tier 2 once inspi/sec crosses 5/s", () => {
    for (let i = 0; i < 25; i++) useGameStore.getState().buyPartLevel("u1"); // L25: 25*0.1*4 = 10/s >= 5
    expect(getTreeInspiPerSec(useGameStore.getState()).toNumber()).toBeGreaterThanOrEqual(5);
    expect(useGameStore.getState().currentStage).toBeGreaterThanOrEqual(1);
  });
});

describe("treeSlice — growSapling + canGrowSapling", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("canGrowSapling returns false when inspi/sec < tier 2 threshold (5/s)", () => {
    useGameStore.getState().add("gold", big(10000));
    // 10 levels of u1: 10 * 0.1 * 2 = 2/s < 5
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    // auto-grow won't fire (2/s < 5/s); verify we're still at stage 0
    useGameStore.setState({ currentStage: 0 });
    expect(canGrowSapling(useGameStore.getState())).toBe(false);
  });

  it("canGrowSapling returns true once inspi/sec >= 5/s (25 levels of u1 = 10/s)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 25; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    // Auto-grow fires on the 25th buy; reset stage so we can test canGrowSapling directly.
    useGameStore.setState({ currentStage: 0 });
    expect(canGrowSapling(useGameStore.getState())).toBe(true);
  });

  it("growSapling returns false when canGrowSapling is false; currentStage unchanged", () => {
    expect(useGameStore.getState().growSapling()).toBe(false);
    expect(useGameStore.getState().currentStage).toBe(0);
  });

  it("growSapling returns true when inspi/sec threshold is met; currentStage becomes 1", () => {
    useGameStore.getState().add("gold", big(10000));
    // 25 levels of u1: 25 * 0.1 * 4 = 10/s >= 5/s threshold for tier 2
    for (let i = 0; i < 25; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    // buyPartLevel auto-advances on the 25th purchase; reset stage so we can
    // test growSapling() directly as the canonical mutation point.
    useGameStore.setState({ currentStage: 0 });
    expect(useGameStore.getState().growSapling()).toBe(true);
    expect(useGameStore.getState().currentStage).toBe(1);
  });

  it("after growSapling to stage 1, stage-0 parts remain buyable (D5)", () => {
    useGameStore.getState().add("gold", big(100000));
    for (let i = 0; i < 25; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    useGameStore.getState().growSapling();
    expect(useGameStore.getState().currentStage).toBe(1);
    // stage-0 part still buyable
    expect(useGameStore.getState().buyPartLevel("u1")).toBe(true);
    expect(useGameStore.getState().partLevels.u1).toBe(26);
    // stage-1 part now also buyable
    expect(useGameStore.getState().buyPartLevel("u2")).toBe(true);
    expect(useGameStore.getState().partLevels.u2).toBe(1);
  });

  it("growSapling returns false at currentStage === TREE_STAGES.length - 1 (already at top)", () => {
    // Force-advance to the last stage by direct setState (test-only shortcut).
    useGameStore.setState({ currentStage: TREE_STAGES.length - 1 });
    expect(useGameStore.getState().growSapling()).toBe(false);
    expect(useGameStore.getState().currentStage).toBe(TREE_STAGES.length - 1);
  });

  it("buyPartLevel auto-advances stage when the buy brings inspi/sec to threshold", () => {
    useGameStore.getState().add("gold", big(10000));
    // Buy u1 24 times — 24 * 0.1 * 2 = 4.8/s < 5/s threshold
    for (let i = 0; i < 24; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    expect(useGameStore.getState().currentStage).toBe(0);
    // The 25th buy: 25 * 0.1 * 4 = 10/s >= 5/s — stage should auto-advance.
    expect(useGameStore.getState().buyPartLevel("u1")).toBe(true);
    expect(useGameStore.getState().currentStage).toBe(1);
  });

  it("buyPartLevel does NOT auto-advance when inspi/sec < threshold", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 24; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    expect(useGameStore.getState().currentStage).toBe(0);
  });

  it("buyPartLevel auto-advances are idempotent at the final stage (top stage cannot grow)", () => {
    useGameStore.setState({ currentStage: TREE_STAGES.length - 1 });
    useGameStore.getState().add("gold", big(1_000_000_000));
    // Buy a top-stage part — should succeed but not advance.
    const lastStageFirstPartId = TREE_STAGES[TREE_STAGES.length - 1]!.parts[0]!.id;
    expect(useGameStore.getState().buyPartLevel(lastStageFirstPartId)).toBe(true);
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

  it("treeTick(1) with u1 at level 5: credits 0.5 inspi (5 * 0.1 * 1)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(0.5, 6);
  });

  it("treeTick respects deltaSeconds linearly: tick(2) credits 2× tick(1)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("u1");
    }
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(2);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(1.0, 6); // 5 * 0.1 * 2 = 1.0
  });

  it("treeTick credits cumulatively across stages (D5: prior-stage parts still produce)", () => {
    // Set up: u1@1 (stage 0), u2@1 (stage 1). Force currentStage = 1.
    // u1: 1 * 0.1 = 0.1/s; u2: 1 * 0.5 = 0.5/s. Total: 0.6 inspi/sec.
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("u1"); // 1 * 0.1 = 0.1
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().buyPartLevel("u2"); // 1 * 0.5 = 0.5
    // Total expected rate: 0.1 + 0.5 = 0.6 inspi/sec
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(0.6, 6);
  });

  it("treeTick auto-advances stage when state qualifies on entry", () => {
    // Simulate post-migration state where partLevels qualify but currentStage didn't advance.
    // 25 levels of u1: 25 * 0.1 * 4 = 10/s >= 5/s threshold for tier 2.
    useGameStore.setState({
      currentStage: 0,
      partLevels: {
        ...useGameStore.getState().partLevels,
        u1: 25,
      },
    });
    useGameStore.getState().treeTick(0.1);
    expect(useGameStore.getState().currentStage).toBe(1);
  });

  it("treeTick does NOT auto-advance at the final stage", () => {
    useGameStore.setState({ currentStage: TREE_STAGES.length - 1 });
    useGameStore.getState().treeTick(0.1);
    expect(useGameStore.getState().currentStage).toBe(TREE_STAGES.length - 1);
  });
});

describe("treeSlice — resetTree", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("resetTree restores currentStage = 0 and zeroes all part levels", () => {
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("u1");
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().buyPartLevel("u2");
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
