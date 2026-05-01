import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";

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
    // Set up: spark@5 produces 0.5 inspi/sec; canvas starts mid-paint.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    useGameStore.setState({ canvasProgress: PAINT_TIME_BASE_SECONDS - 0.5 });
    const inspBefore = useGameStore.getState().inspiration.toNumber();
    const goldBefore = useGameStore.getState().gold.toNumber();

    useGameStore.getState().tickAll(1);

    // Tree credit: 5 * 0.1 * 1 = 0.5
    expect(useGameStore.getState().inspiration.toNumber() - inspBefore).toBeCloseTo(0.5, 6);
    // Canvas: 9.5 + 1 = 10.5 ≥ 10, so one sale fires; gold += CANVAS_GOLD_BASE.
    expect(useGameStore.getState().gold.toNumber() - goldBefore).toBe(10);
    // Progress carries 0.5s leftover.
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(0.5, 9);
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
