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
  // canAscend — always true (no palier gate)
  // ============================================================================

  it("canAscend returns true regardless of inspiration", () => {
    expect(canAscend(useGameStore.getState())).toBe(true);
    useGameStore.getState().add("inspiration", big(999));
    expect(canAscend(useGameStore.getState())).toBe(true);
    useGameStore.getState().add("inspiration", big(1));
    expect(canAscend(useGameStore.getState())).toBe(true);
  });

  // ============================================================================
  // performAscendOrchestrator
  // ============================================================================

  it("performAscendOrchestrator on success: gold → 0, inspiration → 0", () => {
    useGameStore.getState().add("gold", big(500));
    useGameStore.getState().add("inspiration", big(1500));
    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(true);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
  });

  it("performAscendOrchestrator on success: fame increases by fameOnAscend(inspirationBeforeReset)", () => {
    useGameStore.getState().add("inspiration", big(1500));
    const expectedFameGain = fameOnAscend(big(1500));
    const beforeFame = useGameStore.getState().fame.toNumber();
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().fame.toNumber()).toBe(beforeFame + expectedFameGain);
  });

  it("performAscendOrchestrator on success: ascendCount increments by 1", () => {
    useGameStore.getState().add("inspiration", big(1500));
    const beforeCount = useGameStore.getState().ascendCount;
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount + 1);
  });

  it("performAscendOrchestrator on success: tree resets (currentStage=0, all partLevels=0)", () => {
    useGameStore.getState().add("gold", big(10000));
    useGameStore.getState().buyPartLevel("spark");
    useGameStore.getState().buyPartLevel("bud");
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    expect(s.partLevels.spark).toBe(0);
    expect(s.partLevels.bud).toBe(0);
  });

  it("performAscendOrchestrator on success: canvas resets (canvasProgress=0)", () => {
    useGameStore.setState({ canvasProgress: 7.5 });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("performAscendOrchestrator on success: workshop resets (inventory empty, equippedItems empty)", () => {
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%", magnitude: 10 }],
      equippedItems: [{ kind: "-paint_time%", magnitude: 8 }],
    });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([]);
  });

  it("performAscendOrchestrator on success: purchasedNodes UNCHANGED (preserved)", () => {
    useGameStore.setState({
      purchasedNodes: { get_inspired: 2, black_white: 1 },
    });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().purchasedNodes).toEqual({
      get_inspired: 2,
      black_white: 1,
    });
  });

  it("performAscendOrchestrator on success: playerId UNCHANGED", () => {
    const beforeId = useGameStore.getState().playerId;
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().playerId).toBe(beforeId);
  });

  it("performAscendOrchestrator multiple times: ascendCount increments each time", () => {
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(1);
    useGameStore.getState().add("inspiration", big(2500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(2);
  });

  it("performAscendOrchestrator with inspi=0: still succeeds, gives 1 fame (clamp)", () => {
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(true);
    // 1-fame clamp: even a 0-inspi ascend gives 1 fame.
    expect(useGameStore.getState().fame.toNumber()).toBe(1);
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
      useGameStore.setState({ inspiration: big(2_000) });
      const before = useGameStore.getState().pastRuns.length;
      const ok = useGameStore.getState().performAscend();
      expect(ok).toBe(true);
      const runs = useGameStore.getState().pastRuns;
      expect(runs.length).toBe(before + 1);
      expect(runs[runs.length - 1]!.fame).toBeGreaterThan(0);
      expect(typeof runs[runs.length - 1]!.ascendedAt).toBe("number");
    });

    it("appends a pastRun even when ascending at 0 inspi (1-fame clamp)", () => {
      useGameStore.setState({ inspiration: big(0) });
      const before = useGameStore.getState().pastRuns.length;
      const ok = useGameStore.getState().performAscend();
      expect(ok).toBe(true);
      expect(useGameStore.getState().pastRuns.length).toBe(before + 1);
    });
  });

  // ============================================================================
  // v1.1 reset semantics: canvasTier and paintMastery
  // ============================================================================

  describe("performAscendOrchestrator — v1.1 reset semantics", () => {
    beforeEach(() => {
      useGameStore.getState().resetCanvas();
      useGameStore.getState().resetRunCurrencies();
      useGameStore.getState()._setPaintMastery(big(0));
      useGameStore.getState()._setLifetimeGold(big(0));
    });

    it("ascend resets canvasTier to 1", () => {
      // Set up an ascendable state.
      useGameStore.setState({ canvasTier: 7, inspiration: big(2_000) });
      const ok = performAscendOrchestrator(
        useGameStore.setState,
        useGameStore.getState,
      );
      expect(ok).toBe(true);
      expect(useGameStore.getState().canvasTier).toBe(1);
    });

    it("ascend preserves paintMastery exactly (no reset)", () => {
      useGameStore.setState({ inspiration: big(2_000) });
      useGameStore.getState()._setPaintMastery(big(12_345));
      useGameStore.getState()._setLifetimeGold(big(99_999));
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
      expect(useGameStore.getState().paintMastery.toNumber()).toBe(12_345);
      expect(useGameStore.getState().lifetimeGold.toNumber()).toBe(99_999);
    });

    it("multi-ascend accumulates paintMastery additively across runs", () => {
      // Run 1: set 100 PM directly, ascend.
      useGameStore.setState({ inspiration: big(2_000) });
      useGameStore.getState()._setPaintMastery(big(100));
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
      expect(useGameStore.getState().paintMastery.toNumber()).toBe(100);

      // Run 2: bypass the tick formula — set PM and lifetimeGold directly to
      // avoid coupling this test to the integer-PM formula details.
      // Simulate that run 2 earned 5 PM (e.g. via 5000g of lifetime gold).
      useGameStore.getState()._setPaintMastery(big(105));
      useGameStore.getState()._setLifetimeGold(big(5_000));

      // Ascend run 2 (count 1 → palier 2000).
      useGameStore.setState({ inspiration: big(4_000) });
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
      // PM accumulates and survives across ascends (not reset).
      expect(useGameStore.getState().paintMastery.toNumber()).toBe(105);
      expect(useGameStore.getState().lifetimeGold.toNumber()).toBe(5_000);
    });
  });
});
