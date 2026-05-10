import { describe, it, expect, beforeEach } from "vitest";
import {
  canAscend,
  performAscendOrchestrator,
} from "@/systems/ascend";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { fameOnAscend } from "@/core/balance";

describe("systems/ascend", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {}, ascendCount: 0, fame: big(0) });
  });

  // ============================================================================
  // canAscend — gated at 10,000 inspi (first fame point)
  // ============================================================================

  it("canAscend returns false below 10k inspi, true at/above", () => {
    expect(canAscend(useGameStore.getState())).toBe(false);
    useGameStore.getState().add("inspiration", big(9_999));
    expect(canAscend(useGameStore.getState())).toBe(false);
    useGameStore.getState().add("inspiration", big(1));
    expect(canAscend(useGameStore.getState())).toBe(true);
  });

  // ============================================================================
  // performAscendOrchestrator
  // ============================================================================

  it("performAscendOrchestrator on success: gold → 0, inspiration → 0", () => {
    useGameStore.getState().add("gold", big(500));
    useGameStore.getState().add("inspiration", big(12_000));
    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(true);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
  });

  it("performAscendOrchestrator on success: fame increases by fameOnAscend(inspirationBeforeReset)", () => {
    useGameStore.getState().add("inspiration", big(12_000));
    const expectedFameGain = fameOnAscend(big(12_000));
    const beforeFame = useGameStore.getState().fame.toNumber();
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().fame.toNumber()).toBe(beforeFame + expectedFameGain);
  });

  it("performAscendOrchestrator on success: ascendCount increments by 1", () => {
    useGameStore.getState().add("inspiration", big(12_000));
    const beforeCount = useGameStore.getState().ascendCount;
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount + 1);
  });

  it("performAscendOrchestrator on success: tree resets (currentStage=0, all partLevels=0)", () => {
    useGameStore.getState().add("gold", big(10000));
    useGameStore.getState().buyPartLevel("spark");
    useGameStore.getState().buyPartLevel("bud");
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    expect(s.partLevels.spark).toBe(0);
    expect(s.partLevels.bud).toBe(0);
  });

  it("performAscendOrchestrator on success: canvas resets (canvasProgress=0)", () => {
    useGameStore.setState({ canvasProgress: 7.5 });
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("performAscendOrchestrator on success: workshop resets (inventory empty, equipped empty)", () => {
    useGameStore.setState({
      inventory: [
        {
          id: "inv-1",
          slot: "brush" as const,
          tier: "normal" as const,
          affixes: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
        },
      ],
      equipped: {
        brush: {
          id: "eq-1",
          slot: "brush" as const,
          tier: "magic" as const,
          affixes: [{ kind: "-paint_time%" as const, magnitude: 8 }],
        },
      },
    });
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equipped).toEqual({});
  });

  it("performAscendOrchestrator on success: purchasedNodes UNCHANGED (preserved)", () => {
    useGameStore.setState({
      purchasedNodes: { get_inspired: 2, black_white: 1 },
    });
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().purchasedNodes).toEqual({
      get_inspired: 2,
      black_white: 1,
    });
  });

  it("performAscendOrchestrator on success: playerId UNCHANGED", () => {
    const beforeId = useGameStore.getState().playerId;
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().playerId).toBe(beforeId);
  });

  it("performAscendOrchestrator multiple times: ascendCount increments each time", () => {
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(1);
    useGameStore.getState().add("inspiration", big(15_000));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(2);
  });

  it("performAscendOrchestrator with inspi=0: returns false, no fame, no state change", () => {
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
    const beforeFame = useGameStore.getState().fame.toNumber();
    const beforeCount = useGameStore.getState().ascendCount;
    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(false);
    expect(useGameStore.getState().fame.toNumber()).toBe(beforeFame);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount);
  });

  describe("performAscendOrchestrator — pastRuns ledger (v2.0 Round 3)", () => {
    beforeEach(() => {
      useGameStore.getState().resetTree();
      useGameStore.getState().resetCanvas();
      useGameStore.getState().resetWorkshop();
      useGameStore.getState().resetRunCurrencies();
      useGameStore.setState({ ascendCount: 0, fame: big(0), pastRuns: [] });
    });

    it("appends a pastRun entry on successful ascend with the captured fame gain", () => {
      useGameStore.setState({ inspiration: big(12_000) });
      const before = useGameStore.getState().pastRuns.length;
      const ok = useGameStore.getState().performAscend();
      expect(ok).toBe(true);
      const runs = useGameStore.getState().pastRuns;
      expect(runs.length).toBe(before + 1);
      expect(runs[runs.length - 1]!.fame).toBeGreaterThan(0);
      expect(typeof runs[runs.length - 1]!.ascendedAt).toBe("number");
    });

    it("does not append a pastRun when ascend is blocked (below 10k inspi)", () => {
      useGameStore.setState({ inspiration: big(0) });
      const before = useGameStore.getState().pastRuns.length;
      const ok = useGameStore.getState().performAscend();
      expect(ok).toBe(false);
      expect(useGameStore.getState().pastRuns.length).toBe(before);
    });
  });

  // ============================================================================
  // v1.1 reset semantics: paintMastery
  // ============================================================================

  describe("performAscendOrchestrator — v1.1 reset semantics", () => {
    beforeEach(() => {
      useGameStore.getState().resetCanvas();
      useGameStore.getState().resetRunCurrencies();
      useGameStore.getState()._setPaintMastery(big(0));
      useGameStore.getState()._setLifetimeGold(big(0));
    });

    it("ascend preserves paintMastery exactly (no reset)", () => {
      useGameStore.setState({ inspiration: big(12_000) });
      useGameStore.getState()._setPaintMastery(big(12_345));
      useGameStore.getState()._setLifetimeGold(big(99_999));
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
      expect(useGameStore.getState().paintMastery.toNumber()).toBe(12_345);
      expect(useGameStore.getState().lifetimeGold.toNumber()).toBe(99_999);
    });

    it("multi-ascend accumulates paintMastery additively across runs", () => {
      // Run 1: set 100 PM directly, ascend.
      useGameStore.setState({ inspiration: big(12_000) });
      useGameStore.getState()._setPaintMastery(big(100));
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
      expect(useGameStore.getState().paintMastery.toNumber()).toBe(100);

      // Run 2: bypass the tick formula — set PM and lifetimeGold directly to
      // avoid coupling this test to the integer-PM formula details.
      // Simulate that run 2 earned 5 PM (e.g. via 5000g of lifetime gold).
      useGameStore.getState()._setPaintMastery(big(105));
      useGameStore.getState()._setLifetimeGold(big(5_000));

      // Ascend run 2 (count 1 → palier 2000).
      useGameStore.setState({ inspiration: big(12_000) });
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
      // PM accumulates and survives across ascends (not reset).
      expect(useGameStore.getState().paintMastery.toNumber()).toBe(105);
      expect(useGameStore.getState().lifetimeGold.toNumber()).toBe(5_000);
    });
  });
});
