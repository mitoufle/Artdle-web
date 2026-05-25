import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";

describe("CanvasStage under crit-storm load", () => {
  it("never exposes more than 8 in-flight cells at any single frame", () => {
    vi.useFakeTimers();
    let maxInFlight = 0;
    const { rerender, container } = render(
      <CanvasStage
        sizeLevel={1}
        canvasTier={5}
        progressPct={0}
        timeElapsed="0"
        timeTotal="10"
        nextSaleGold="100"
        canvasNumber={1}
        critChunks={{}}
      />,
    );

    // Engine signals all 400 cells revealed in a single tick. The first 50 are crits.
    rerender(
      <CanvasStage
        sizeLevel={1}
        canvasTier={5}
        progressPct={1}
        timeElapsed="10"
        timeTotal="10"
        nextSaleGold="100"
        canvasNumber={1}
        critChunks={Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [i, true]),
        )}
      />,
    );

    // Sample the DOM after every drip-interval (50ms) over 5 seconds.
    for (let t = 0; t < 5000; t += 50) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      const inFlightDivs = container.querySelectorAll(
        '[data-testid="sketch-overlay-in-flight"] > div',
      );
      maxInFlight = Math.max(maxInFlight, inFlightDivs.length);
    }

    expect(maxInFlight).toBeLessThanOrEqual(8);
    vi.useRealTimers();
  });

  it("eventually drains the queue after a 400-cell storm", () => {
    vi.useFakeTimers();
    const { rerender, container } = render(
      <CanvasStage
        sizeLevel={1}
        canvasTier={5}
        progressPct={0}
        timeElapsed="0"
        timeTotal="10"
        nextSaleGold="100"
        canvasNumber={1}
        critChunks={{}}
      />,
    );
    rerender(
      <CanvasStage
        sizeLevel={1}
        canvasTier={5}
        progressPct={1}
        timeElapsed="10"
        timeTotal="10"
        nextSaleGold="100"
        canvasNumber={1}
        critChunks={{}}
      />,
    );

    // 400 cells × 50ms drip ≈ 20s minimum to fully drain; add slack for the
    // 220ms tail of the last cell + scheduling jitter.
    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    const inFlightDivs = container.querySelectorAll(
      '[data-testid="sketch-overlay-in-flight"] > div',
    );
    expect(inFlightDivs.length).toBe(0);
    vi.useRealTimers();
  });
});
