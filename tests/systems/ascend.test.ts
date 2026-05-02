import { describe, it, expect, beforeEach } from "vitest";
import {
  getEffectivePalier,
  canAscend,
  performAscendOrchestrator,
} from "@/systems/ascend";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { palierAscend, fameOnAscend } from "@/core/balance";

describe("systems/ascend", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {}, ascendCount: 0, fame: big(0) });
  });

  // ============================================================================
  // getEffectivePalier
  // ============================================================================

  it("getEffectivePalier(state, 0) returns big(1000) (base, no Faster Strokes)", () => {
    expect(getEffectivePalier(useGameStore.getState(), 0).toNumber()).toBe(1000);
  });

  it("getEffectivePalier(state, 0) with Faster Strokes returns big(900) (10% reduction)", () => {
    useGameStore.setState({ purchasedNodes: { faster_strokes: true } });
    expect(getEffectivePalier(useGameStore.getState(), 0).toNumber()).toBeCloseTo(900, 6);
  });

  it("getEffectivePalier(state, 5) with Faster Strokes returns palierAscend(5) * 0.9 (Big.pow precision: toBeCloseTo)", () => {
    useGameStore.setState({ purchasedNodes: { faster_strokes: true } });
    const expected = palierAscend(5).mul(0.9).toNumber();
    expect(getEffectivePalier(useGameStore.getState(), 5).toNumber()).toBeCloseTo(expected, 3);
  });

  // ============================================================================
  // canAscend
  // ============================================================================

  it("canAscend returns false when inspiration < palier", () => {
    useGameStore.getState().add("inspiration", big(999));
    expect(canAscend(useGameStore.getState())).toBe(false);
  });

  it("canAscend returns true at exact threshold (inspiration === palier)", () => {
    useGameStore.getState().add("inspiration", big(1000));
    expect(canAscend(useGameStore.getState())).toBe(true);
  });

  it("canAscend becomes true earlier with Faster Strokes (palier reduced to 900)", () => {
    useGameStore.getState().add("inspiration", big(900));
    expect(canAscend(useGameStore.getState())).toBe(false);
    useGameStore.setState({ purchasedNodes: { faster_strokes: true } });
    expect(canAscend(useGameStore.getState())).toBe(true);
  });

  // ============================================================================
  // performAscendOrchestrator
  // ============================================================================

  it("performAscendOrchestrator returns false when canAscend is false; state unchanged", () => {
    useGameStore.getState().add("gold", big(50));
    useGameStore.getState().add("inspiration", big(500));
    const beforeGold = useGameStore.getState().gold.toNumber();
    const beforeInsp = useGameStore.getState().inspiration.toNumber();
    const beforeCount = useGameStore.getState().ascendCount;

    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(false);

    expect(useGameStore.getState().gold.toNumber()).toBe(beforeGold);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(beforeInsp);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount);
  });

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
      equippedItems: [{ kind: "+inspiration_rate%", magnitude: 8 }],
    });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([]);
  });

  it("performAscendOrchestrator on success: purchasedNodes UNCHANGED (preserved)", () => {
    useGameStore.setState({
      purchasedNodes: { goldsmith: true, patient_eye: true },
    });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().purchasedNodes).toEqual({
      goldsmith: true,
      patient_eye: true,
    });
  });

  it("performAscendOrchestrator on success: playerId UNCHANGED", () => {
    const beforeId = useGameStore.getState().playerId;
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().playerId).toBe(beforeId);
  });

  it("performAscendOrchestrator second time: ascendCount goes 1→2; palier doubles per the formula", () => {
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(1);
    useGameStore.getState().add("inspiration", big(2500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(2);
    useGameStore.getState().add("inspiration", big(3999));
    expect(canAscend(useGameStore.getState())).toBe(false);
  });

  it("performAscendOrchestrator with inspi=0: returns false (palier > 0)", () => {
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(false);
  });
});
