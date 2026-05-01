import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";

describe("tickAll orchestrator", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
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
    // Spy on the slice methods via the live store. We replace them with
    // recording wrappers that capture invocation order.
    const calls: Array<"tree" | "canvas"> = [];
    const original = {
      treeTick: useGameStore.getState().treeTick,
      canvasTick: useGameStore.getState().canvasTick,
    };
    useGameStore.setState({
      treeTick: (delta: number) => {
        calls.push("tree");
        original.treeTick(delta);
      },
      canvasTick: (delta: number) => {
        calls.push("canvas");
        original.canvasTick(delta);
      },
    });

    useGameStore.getState().tickAll(0.1);

    expect(calls).toEqual(["tree", "canvas"]);

    // Restore originals so other tests aren't polluted.
    useGameStore.setState({ treeTick: original.treeTick, canvasTick: original.canvasTick });
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
