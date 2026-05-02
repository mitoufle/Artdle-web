import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { PAINT_TIME_BASE_SECONDS, CANVAS_GOLD_BASE } from "@/core/balance";

describe("multipliers — Phase 3 contributors", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {} });
  });

  // ============================================================================
  // getInspiMultiplier
  // ============================================================================

  it("getInspiMultiplier returns 1 with no equipped items + no Patient Eye", () => {
    expect(getInspiMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getInspiMultiplier returns 1.15 with Patient Eye purchased", () => {
    useGameStore.setState({ purchasedNodes: { patient_eye: true } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.15, 6);
  });

  it("getInspiMultiplier returns 1 + magnitude/100 with one +inspiration_rate% item equipped", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "+inspiration_rate%", magnitude: 12 }],
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.12, 6);
  });

  it("getInspiMultiplier sums multiple +inspiration_rate% items", () => {
    useGameStore.setState({
      equippedItems: [
        { kind: "+inspiration_rate%", magnitude: 10 },
        { kind: "+inspiration_rate%", magnitude: 5 },
      ],
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.15, 6);
  });

  it("getInspiMultiplier combines item + Patient Eye contributions", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "+inspiration_rate%", magnitude: 10 }],
      purchasedNodes: { patient_eye: true },
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.25, 6);
  });

  // ============================================================================
  // getCanvasGoldMultiplier
  // ============================================================================

  it("getCanvasGoldMultiplier returns 1 with no contributors", () => {
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1.10 with Goldsmith purchased", () => {
    useGameStore.setState({ purchasedNodes: { goldsmith: true } });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.10, 6);
  });

  it("getCanvasGoldMultiplier sums equipped +canvas_gold% items + Goldsmith", () => {
    useGameStore.setState({
      equippedItems: [
        { kind: "+canvas_gold%", magnitude: 8 },
        { kind: "+canvas_gold%", magnitude: 12 },
      ],
      purchasedNodes: { goldsmith: true },
    });
    // 1 + 0.08 + 0.12 + 0.10 = 1.30
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.30, 6);
  });

  // ============================================================================
  // getPaintTimeMultiplier (per-item v/(1-v) conversion)
  // ============================================================================

  it("getPaintTimeMultiplier returns 1 with no equipped items", () => {
    expect(getPaintTimeMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getPaintTimeMultiplier converts -paint_time% 10 into 1.111... (v/(1-v))", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "-paint_time%", magnitude: 10 }],
    });
    const m = getPaintTimeMultiplier(useGameStore.getState());
    // v=0.10 → v/(1-v) = 0.111...; multiplier = 1.111...
    expect(m).toBeCloseTo(1 + 0.10 / 0.90, 6);
    // Effective paint time = base / multiplier = 10 / 1.111... = 9.0
    const effectiveTime = PAINT_TIME_BASE_SECONDS / m;
    expect(effectiveTime).toBeCloseTo(9.0, 6);
  });

  it("getPaintTimeMultiplier sums per-item conversions for two -paint_time% items", () => {
    useGameStore.setState({
      equippedItems: [
        { kind: "-paint_time%", magnitude: 10 },
        { kind: "-paint_time%", magnitude: 10 },
      ],
    });
    const m = getPaintTimeMultiplier(useGameStore.getState());
    // Two items at v=0.10 each → bonus = 2 * (0.10/0.90) = 0.222...; multiplier = 1.222...
    expect(m).toBeCloseTo(1 + 2 * (0.10 / 0.90), 6);
  });

  // ============================================================================
  // Integration: multipliers flow through to tick outputs
  // ============================================================================

  it("Patient Eye purchased → treeTick credits 1.15× the no-multiplier inspi rate", () => {
    // Set up: spark at level 5 = 0.5 inspi/sec base.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    useGameStore.setState({ purchasedNodes: { patient_eye: true } });
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const gain = useGameStore.getState().inspiration.toNumber() - before;
    expect(gain).toBeCloseTo(0.5 * 1.15, 6);
  });

  it("Goldsmith purchased → canvasTick credits 1.10× the no-multiplier gold per sale", () => {
    useGameStore.setState({ purchasedNodes: { goldsmith: true } });
    const before = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    const gain = useGameStore.getState().gold.toNumber() - before;
    expect(gain).toBeCloseTo(CANVAS_GOLD_BASE * 1.10, 6);
  });
});
