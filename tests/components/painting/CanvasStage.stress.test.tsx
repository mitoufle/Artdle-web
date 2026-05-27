import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";

describe("CanvasStage under crit-storm load", () => {
  it("renders all 640 cells in-flight immediately at T7 (no cap)", () => {
    vi.useFakeTimers();
    const { rerender, container } = render(
      <CanvasStage
        canvasTier={7}
        progressPct={0}
        timeElapsed="0"
        timeTotal="10"
        nextSaleGold="100"
        canvasNumber={1}
        critChunks={{}}
      />,
    );

    // Engine signals all 640 cells revealed in a single tick. The first 50 are crits.
    rerender(
      <CanvasStage
        canvasTier={7}
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

    // No setInterval tick required — the advance-target effect places every
    // newly-revealed cell into in-flight in the same render pass. This locks
    // in the "crit instantly fills its cells" behavior.
    const inFlightDivs = container.querySelectorAll(
      '[data-testid="sketch-overlay-in-flight"] > div',
    );
    expect(inFlightDivs.length).toBe(640);
    vi.useRealTimers();
  });

  it("eventually drains the queue after a 640-cell storm", () => {
    vi.useFakeTimers();
    const { rerender, container } = render(
      <CanvasStage
        canvasTier={7}
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
        canvasTier={7}
        progressPct={1}
        timeElapsed="10"
        timeTotal="10"
        nextSaleGold="100"
        canvasNumber={1}
        critChunks={{}}
      />,
    );

    // With no drip and a 220ms non-crit duration, the entire wave graduates
    // shortly after 220ms. Add slack for the 50ms tick-poll granularity.
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const inFlightDivs = container.querySelectorAll(
      '[data-testid="sketch-overlay-in-flight"] > div',
    );
    expect(inFlightDivs.length).toBe(0);
    vi.useRealTimers();
  });
});
