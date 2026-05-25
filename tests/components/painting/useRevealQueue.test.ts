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

  it("queues new reveals when targetRevealed advances", () => {
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
    // After one drip interval (~50ms), one cell should be in-flight.
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.inFlight.length).toBeGreaterThan(0);
    expect(result.current.inFlight.length).toBeLessThanOrEqual(8);
    vi.useRealTimers();
  });

  it("caps in-flight count at 8", () => {
    vi.useFakeTimers();
    const order = Array.from({ length: 100 }, (_, i) => i);
    const { result, rerender } = renderHook(
      ({ target }) =>
        useRevealQueue({
          targetRevealed: target,
          cellOrder: order,
          canvasNumber: 1,
          critCells: {},
        }),
      { initialProps: { target: 0 } },
    );
    rerender({ target: 100 });
    // After 8 drip intervals (~400ms), the pool should be saturated.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.inFlight.length).toBeLessThanOrEqual(8);
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
    // First cell enters in-flight at t=50ms (one drip).
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.inFlight.length).toBe(1);
    expect(result.current.settled.length).toBe(0);
    // After 220ms in flight, it settles. Total elapsed: 50ms drip + 220ms in-flight = 270ms.
    act(() => {
      vi.advanceTimersByTime(220);
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
    act(() => {
      vi.advanceTimersByTime(50);
    }); // cell 0 enters in-flight
    expect(result.current.inFlight.length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(250);
    }); // 300ms total in-flight — under 600
    expect(result.current.inFlight.length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(400);
    }); // 700ms total in-flight — past 600
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
