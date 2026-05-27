import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRevealQueue } from "@/components/painting/useRevealQueue";

describe("useRevealQueue", () => {
  it("starts empty", () => {
    const { result } = renderHook(() =>
      useRevealQueue({
        targetRevealed: 0,
        cellOrder: [0, 1, 2, 3],
        canvasNumber: 1,
        critCells: {},
      }),
    );
    expect(result.current.inFlight).toEqual([]);
    expect(result.current.settled).toEqual([]);
  });

  it("promotes all newly-revealed cells to in-flight immediately when targetRevealed advances", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ target }) =>
        useRevealQueue({
          targetRevealed: target,
          cellOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          canvasNumber: 1,
          critCells: {},
        }),
      { initialProps: { target: 0 } },
    );
    rerender({ target: 10 });
    // No drip — all 10 cells land in-flight in the same frame the engine
    // signals their reveal. No setInterval tick is required.
    expect(result.current.inFlight.length).toBe(10);
    vi.useRealTimers();
  });

  it("does not cap the in-flight pool (crit burst of 50 lights up all at once)", () => {
    vi.useFakeTimers();
    const order = Array.from({ length: 100 }, (_, i) => i);
    const critCells = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [i, true]),
    ) as Record<number, true>;
    const { result, rerender } = renderHook(
      ({ target }) =>
        useRevealQueue({
          targetRevealed: target,
          cellOrder: order,
          canvasNumber: 1,
          critCells,
        }),
      { initialProps: { target: 0 } },
    );
    rerender({ target: 50 });
    expect(result.current.inFlight.length).toBe(50);
    // All 50 are crit, so they share the 600ms crit duration.
    expect(result.current.inFlight.every((c) => c.isCrit)).toBe(true);
    vi.useRealTimers();
  });

  it("moves cells from in-flight to settled after 220ms", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ target }) =>
        useRevealQueue({
          targetRevealed: target,
          cellOrder: [0, 1, 2, 3],
          canvasNumber: 1,
          critCells: {},
        }),
      { initialProps: { target: 0 } },
    );
    rerender({ target: 1 });
    expect(result.current.inFlight.length).toBe(1);
    expect(result.current.settled.length).toBe(0);
    // After 220ms in flight, it settles.
    act(() => {
      vi.advanceTimersByTime(250); // a bit past 220 + tick poll grain
    });
    expect(result.current.inFlight.length).toBe(0);
    expect(result.current.settled).toContain(0);
    vi.useRealTimers();
  });

  it("holds crit cells in-flight for 600ms instead of 220ms", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ target }) =>
        useRevealQueue({
          targetRevealed: target,
          cellOrder: [0, 1],
          canvasNumber: 1,
          critCells: { 0: true },
        }),
      { initialProps: { target: 0 } },
    );
    rerender({ target: 1 });
    expect(result.current.inFlight.length).toBe(1);
    expect(result.current.inFlight[0]?.isCrit).toBe(true);
    act(() => {
      vi.advanceTimersByTime(300);
    }); // under 600 → still in-flight
    expect(result.current.inFlight.length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(400);
    }); // 700ms total → past 600
    expect(result.current.inFlight.length).toBe(0);
    expect(result.current.settled).toContain(0);
    vi.useRealTimers();
  });

  it("resets when canvasNumber changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ target, canvas }) =>
        useRevealQueue({
          targetRevealed: target,
          cellOrder: [0, 1, 2, 3],
          canvasNumber: canvas,
          critCells: {},
        }),
      { initialProps: { target: 4, canvas: 1 } },
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.settled.length).toBeGreaterThan(0);
    rerender({ target: 0, canvas: 2 });
    expect(result.current.inFlight).toEqual([]);
    expect(result.current.settled).toEqual([]);
    vi.useRealTimers();
  });
});
