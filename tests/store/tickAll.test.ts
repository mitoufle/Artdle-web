import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { BASE_CHUNK_INTERVAL, chunksPerCanvas } from "@/core/balance";

// T1 chunk-domain: chunksPerCanvas(1) = 10, chunkInterval = 5s → 50s per canvas sale.
const T1_CANVAS_TIME = BASE_CHUNK_INTERVAL * chunksPerCanvas(1);

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
    // Set up: cotyledon@5 produces 0.5 inspi/sec; canvas starts at chunk 9 of 10.
    // Chunk-domain T1: chunkInterval = 5s. canvasProgress=9 means 9 chunks done.
    // A 1s tick adds 0.2 chunks → progress 9.2. No sale yet (need to reach 10).
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("cotyledon");
    }
    useGameStore.setState({ canvasProgress: 9 });
    const inspBefore = useGameStore.getState().inspiration.toNumber();
    const goldBefore = useGameStore.getState().gold.toNumber();

    useGameStore.getState().tickAll(1);

    // Tree credit: 5 * 0.1 * 1 = 0.5
    expect(useGameStore.getState().inspiration.toNumber() - inspBefore).toBeCloseTo(0.5, 6);
    // Canvas: 1s = 0.2 chunks. No sale yet — partial chunk progress only,
    // and no chunk boundary crossed → no per-chunk gold credit either.
    expect(useGameStore.getState().gold.toNumber() - goldBefore).toBe(0);
    // Progress: 9 + 0.2 = 9.2 (no chunk completes).
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(9.2, 5);
  });

  it("tickAll(full canvas time) fires a sale and credits canvas gold", () => {
    // From canvasProgress=0, ticking exactly past one full canvas worth of time
    // (50s + ε at T1) fires one sale → 10g credited.
    useGameStore.setState({ canvasProgress: 0 });
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().tickAll(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().gold.toNumber() - goldBefore).toBeGreaterThanOrEqual(10);
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
