import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("tickAll orchestrator", () => {
  // Captured at suite scope so afterEach restores method references even
  // when an assertion throws inside the spy test (otherwise swapped tickers
  // would leak to subsequent tests in this file).
  const originalTicks = {
    treeTick: useGameStore.getState().treeTick,
    canvasTick: useGameStore.getState().canvasTick,
  };

  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
  });

  afterEach(() => {
    // Idempotent: tests that don't swap still pay zero cost (assigning the
    // already-current methods is a no-op).
    useGameStore.setState({
      treeTick: originalTicks.treeTick,
      canvasTick: originalTicks.canvasTick,
    });
  });

  it("tickAll(1) credits inspiration AND advances canvas in one call", () => {
    // Set up: cotyledon@5 produces 0.5 inspi/sec; canvas starts mid-paint.
    // effectiveTime = canvasTime(0) / speedMult = 2 / (1 + 0.05×1) = 2/1.05 ≈ 1.905s.
    // Start at 1.5s; delta=1 pushes to 2.5 ≥ 1.905 → sale fires, leftover = 2.5 - 2/1.05.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("cotyledon");
    }
    useGameStore.setState({ canvasProgress: 1.5 });
    const inspBefore = useGameStore.getState().inspiration.toNumber();
    const goldBefore = useGameStore.getState().gold.toNumber();

    useGameStore.getState().tickAll(1);

    // Tree credit: 5 * 0.1 * 1 = 0.5
    expect(useGameStore.getState().inspiration.toNumber() - inspBefore).toBeCloseTo(0.5, 6);
    // Canvas: one sale fires; gold = 10 × (1 + 0.30×0) × (1 + 0.10×1) = 11
    // (sizeLevel=0, sellPriceLevel=1, no items).
    expect(useGameStore.getState().gold.toNumber() - goldBefore).toBeCloseTo(11, 5);
    // Progress carries leftover = 2.5 - (2/1.05) ≈ 0.595s (< effectiveTime → no clamp).
    const expectedLeftover = 2.5 - 2 / 1.05;
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(expectedLeftover, 9);
  });

  it("tickAll calls treeTick BEFORE canvasTick (order pinned for Phase 3 forward-compat)", () => {
    // Spy on the slice methods via the live store. afterEach restores them
    // even if an assertion throws.
    const calls: Array<"tree" | "canvas"> = [];
    useGameStore.setState({
      treeTick: (delta: number) => {
        calls.push("tree");
        originalTicks.treeTick(delta);
      },
      canvasTick: (delta: number) => {
        calls.push("canvas");
        originalTicks.canvasTick(delta);
      },
    });

    useGameStore.getState().tickAll(0.1);

    expect(calls).toEqual(["tree", "canvas"]);
  });

  it("tickAll(0) is a valid idle frame: no inspiration change, no gold change", () => {
    const inspBefore = useGameStore.getState().inspiration.toNumber();
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progBefore = useGameStore.getState().canvasProgress;

    useGameStore.getState().tickAll(0);

    expect(useGameStore.getState().inspiration.toNumber()).toBe(inspBefore);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progBefore);
  });
});
