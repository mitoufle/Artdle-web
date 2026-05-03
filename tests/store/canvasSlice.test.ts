import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { PAINT_TIME_BASE_SECONDS, CANVAS_GOLD_BASE } from "@/core/balance";

describe("canvasSlice — canvasTick", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
  });

  it("initializes with canvasProgress 0", () => {
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(5) advances progress to 5; gold unchanged", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5);
    expect(useGameStore.getState().canvasProgress).toBe(5);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("two canvasTick(5) calls cross threshold: gold += CANVAS_GOLD_BASE, progress = 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5);
    useGameStore.getState().canvasTick(5);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(PAINT_TIME_BASE_SECONDS) at exact threshold: one sale, progress = 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(paintTime + 0.5) carries 0.5s leftover", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS + 0.5);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    // Floating point: leftover is 0.5 give or take rounding.
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(0.5, 9);
  });

  it("canvasTick(5 * paintTime) — synthetic huge delta — credits exactly one sale; progress clamped to 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5 * PAINT_TIME_BASE_SECONDS);
    // Exactly one sale, never more (D2 / spec §7).
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    // Leftover would have been 4 * paintTime ≥ paintTime → clamp to 0.
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(0) is a no-op: no sale, no progress change, no gold change", () => {
    useGameStore.setState({ canvasProgress: 3 });
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().canvasProgress).toBe(3);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("with multipliers returning 1 (Phase 2), one sale credits exactly CANVAS_GOLD_BASE", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
  });
});

describe("canvasSlice — resetCanvas", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
  });

  it("resetCanvas sets canvasProgress to 0", () => {
    useGameStore.setState({ canvasProgress: 7.3 });
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });
});

describe("canvasSlice — lastSale animation trigger", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
  });

  it("initializes with lastSale = null", () => {
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("a sale sets lastSale to {id: 1, amount: CANVAS_GOLD_BASE big}", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    const ls = useGameStore.getState().lastSale;
    expect(ls).not.toBeNull();
    expect(ls!.id).toBe(1);
    expect(ls!.amount.toNumber()).toBe(CANVAS_GOLD_BASE);
  });

  it("two sales increment lastSale.id from 1 to 2", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale!.id).toBe(2);
  });

  it("clearLastSale() resets lastSale to null", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("clearLastSale() does not affect canvasProgress or gold", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS + 0.5);
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progressBefore = useGameStore.getState().canvasProgress;
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progressBefore);
  });

  it("a no-op tick (delta=0) does not advance lastSale", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS); // first sale → id=1
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
  });

  it("resetCanvas() clears lastSale alongside progress", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().lastSale).toBeNull();
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });
});
