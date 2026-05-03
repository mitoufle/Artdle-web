import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
  getPmMultiplier,
} from "@/core/multipliers";
import { useGameStore, type GameStore } from "@/store";
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

  it("getInspiMultiplier ignores equipped workshop items (items are painting-only)", () => {
    // Items now only affect painting mechanics; tree-side bonuses come from
    // the skill tree only. Even with painting-related affixes equipped,
    // getInspiMultiplier should return 1 (no equipped contribution).
    useGameStore.setState({
      equippedItems: [
        { kind: "+canvas_gold%", magnitude: 12 },
        { kind: "-paint_time%", magnitude: 10 },
      ],
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getInspiMultiplier with Patient Eye + equipped items still equals 1.15 (items don't contribute)", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "+canvas_gold%", magnitude: 10 }],
      purchasedNodes: { patient_eye: true },
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.15, 6);
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

  it("equipped -paint_time% 10 item → canvasTick(9.0) crosses threshold (effective time = 10/1.111 ≈ 9.0)", () => {
    // Without the paint-time multiplier, canvasTick(9.0) would NOT cross the
    // 10s threshold (9 < 10) and no sale fires. With one -paint_time% 10 item
    // equipped, the multiplier becomes 1.111, effective paint time becomes 9.0,
    // and canvasTick(9.0) DOES cross the threshold — a sale fires.
    //
    // This integration test specifically guards against canvasSlice.canvasTick
    // silently dropping the getPaintTimeMultiplier(state) call.
    useGameStore.setState({
      equippedItems: [{ kind: "-paint_time%", magnitude: 10 }],
    });
    const before = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(9.0);
    const gain = useGameStore.getState().gold.toNumber() - before;
    expect(gain).toBe(CANVAS_GOLD_BASE);
    // Sanity: without the equipped item, canvasTick(9.0) would have gained 0.
  });

  // ============================================================================
  // getPmMultiplier
  // ============================================================================

  it("returns 1.0 when paintMastery is 0", () => {
    const state = { paintMastery: big(0) } as unknown as GameStore;
    expect(getPmMultiplier(state)).toBe(1);
  });

  it("returns ~11 at paintMastery 100", () => {
    const state = { paintMastery: big(100) } as unknown as GameStore;
    expect(getPmMultiplier(state)).toBeCloseTo(11.0, 1);
  });

  it("returns ~31 at paintMastery 1,000,000", () => {
    const state = { paintMastery: big(1_000_000) } as unknown as GameStore;
    expect(getPmMultiplier(state)).toBeCloseTo(31.0, 1);
  });
});
