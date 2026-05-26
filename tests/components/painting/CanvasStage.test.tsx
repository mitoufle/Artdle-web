import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";
import { getCanvasCellLayout } from "@/components/painting/canvasArt";
import { useGameStore } from "@/store";

describe("<CanvasStage />", () => {
  it("renders the workshop scene static image inside the frame", () => {
    const { container } = render(
      <CanvasStage
        canvasTier={1}
        progressPct={0}
        timeElapsed="0.0"
        timeTotal="2.0"
        nextSaleGold="10"
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement | null;
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("alt")).toMatch(/workshop/i);
    expect(img?.getAttribute("src")).toBeTruthy();
  });

  it("displays the tier in the overlay TierUpgradeCard", () => {
    useGameStore.setState({ canvasTier: 6 });
    const { container } = render(
      <CanvasStage
        canvasTier={6}
        progressPct={0.6}
        timeElapsed="6.0"
        timeTotal="10.0"
        nextSaleGold="250"
      />,
    );
    const tierButton = container.querySelector("button[aria-label*='Tier 7']");
    expect(tierButton).not.toBeNull();
    expect(tierButton?.textContent).toMatch(/Tier 6/);
    expect(tierButton?.textContent).toMatch(/Masterpiece/);
    expect(tierButton?.textContent).toMatch(/Tier 7/);
  });

  it("displays painting time as 'elapsed / total' (counts up to total)", () => {
    render(
      <CanvasStage
        canvasTier={5}
        progressPct={0.6}
        timeElapsed="6.0"
        timeTotal="10.0"
        nextSaleGold="250"
      />,
    );
    expect(screen.getByText(/6\.0.*10\.0/)).toBeInTheDocument();
  });

  it("displays next sale gold preview", () => {
    render(
      <CanvasStage
        canvasTier={1}
        progressPct={0}
        timeElapsed="0.0"
        timeTotal="2.0"
        nextSaleGold="184"
      />,
    );
    expect(screen.getByText(/\+184g/i)).toBeInTheDocument();
  });

  describe("<CanvasStage> — cell layout (chunk-domain)", () => {
    it("renders the correct cell grid at T1 (2×5)", () => {
      const layout = getCanvasCellLayout(1);
      expect(layout.rows).toBe(2);
      expect(layout.cols).toBe(5);
      const { container } = render(
        <CanvasStage
          canvasTier={1}
          progressPct={0}
          timeElapsed="0.0"
          timeTotal="10.0"
          nextSaleGold="10"
          canvasNumber={1}
        />,
      );
      const inFlight = container.querySelector(
        '[data-testid="sketch-overlay-in-flight"]',
      ) as HTMLElement | null;
      expect(inFlight).toBeInTheDocument();
      expect(inFlight?.style.gridTemplateColumns).toBe("repeat(5, 1fr)");
      expect(inFlight?.style.gridTemplateRows).toBe("repeat(2, 1fr)");
    });

    it("renders 640 cells at T7 (cell cap reached, 1 chunk per cell)", () => {
      const layout = getCanvasCellLayout(7);
      expect(layout.cellsRendered).toBe(640);
      expect(layout.chunksPerCell).toBe(1);
    });

    it("renders 640 cells at T8 (chunks > cap, 2 chunks per cell)", () => {
      const layout = getCanvasCellLayout(8);
      expect(layout.cellsRendered).toBe(640);
      expect(layout.chunksPerCell).toBe(2);
    });
  });

  describe("<CanvasStage> — sketch overlay reveal", () => {
    it("renders the settled sketch overlay (canvas element) and an in-flight grid sized 2x5 at T1", () => {
      const { container } = render(
        <CanvasStage
          canvasTier={1}
          progressPct={0}
          timeElapsed="0.0"
          timeTotal="10.0"
          nextSaleGold="10"
          canvasNumber={1}
        />,
      );
      const overlay = container.querySelector('[data-testid="sketch-overlay"]');
      expect(overlay).toBeInTheDocument();
      // Settled overlay is a 400×400 canvas; CSS scales it to the easel bbox.
      expect(overlay?.tagName.toLowerCase()).toBe("canvas");
      expect((overlay as HTMLCanvasElement).width).toBe(400);
      expect((overlay as HTMLCanvasElement).height).toBe(400);
      // The in-flight overlay is a sibling grid sized to the T1 cell layout (2×5).
      const inFlight = container.querySelector(
        '[data-testid="sketch-overlay-in-flight"]',
      ) as HTMLElement | null;
      expect(inFlight).toBeInTheDocument();
      expect(inFlight?.style.gridTemplateColumns).toBe("repeat(5, 1fr)");
      expect(inFlight?.style.gridTemplateRows).toBe("repeat(2, 1fr)");
    });

    it("at progressPct=0, the in-flight overlay is empty (no cells queued or animating)", () => {
      const { container } = render(
        <CanvasStage
          canvasTier={1}
          progressPct={0}
          timeElapsed="0.0"
          timeTotal="10.0"
          nextSaleGold="10"
          canvasNumber={1}
        />,
      );
      const inFlight = container.querySelector(
        '[data-testid="sketch-overlay-in-flight"]',
      );
      expect(inFlight?.children.length).toBe(0);
    });

    it("at progressPct=0.5, the queue surfaces cells into the in-flight overlay as time advances (max 8 simultaneously)", () => {
      vi.useFakeTimers();
      try {
        // Use T5 (160 cells) so a half-canvas reveal (80 cells) saturates the
        // 8-in-flight pool over a 400ms drip window. T1's 10-cell layout
        // drains too fast to assert presence.
        const { container } = render(
          <CanvasStage
            canvasTier={5}
            progressPct={0.5}
            timeElapsed="5.0"
            timeTotal="10.0"
            nextSaleGold="10"
            canvasNumber={1}
          />,
        );
        // Drive a few drip-ticks so the queue promotes pending into in-flight.
        act(() => {
          vi.advanceTimersByTime(400);
        });
        const inFlight = container.querySelector(
          '[data-testid="sketch-overlay-in-flight"]',
        );
        // Engine reports floor(0.5 * 160) = 80 cells revealed at T5; queue caps at 8.
        expect(inFlight?.children.length ?? 0).toBeGreaterThan(0);
        expect(inFlight?.children.length ?? 0).toBeLessThanOrEqual(8);
      } finally {
        vi.useRealTimers();
      }
    });

    it("at progressPct=1.0, the engine target is reached and the queue eventually drains all reveals (max 8 concurrent)", () => {
      vi.useFakeTimers();
      try {
        const { container } = render(
          <CanvasStage
            canvasTier={1}
            progressPct={1.0}
            timeElapsed="10.0"
            timeTotal="10.0"
            nextSaleGold="10"
            canvasNumber={1}
          />,
        );
        // Saturate the queue with several drip-ticks.
        act(() => {
          vi.advanceTimersByTime(400);
        });
        const inFlight = container.querySelector(
          '[data-testid="sketch-overlay-in-flight"]',
        );
        // At T1 we have 10 cells total; in-flight stays capped at 8.
        expect(inFlight?.children.length ?? 0).toBeLessThanOrEqual(8);
        // Drain the queue: 10 cells * ~50ms drip + 220ms animation tail.
        act(() => {
          vi.advanceTimersByTime(2000);
        });
        expect(inFlight?.children.length ?? 0).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("<CanvasStage> — combo badge", () => {
    it("renders combo chain badge when comboChain > 0", () => {
      render(
        <CanvasStage
          canvasTier={1}
          progressPct={0.5}
          timeElapsed="1.0"
          timeTotal="2.0"
          nextSaleGold="100"
          comboChain={3}
        />,
      );
      expect(screen.getByTestId("combo-badge")).toBeInTheDocument();
      // +30% gold from 3 chain links
      expect(screen.getByTestId("combo-badge").textContent).toMatch(/3/);
      expect(screen.getByTestId("combo-badge").textContent).toMatch(/30/);
    });

    it("does NOT render combo badge when comboChain = 0", () => {
      render(
        <CanvasStage
          canvasTier={1}
          progressPct={0}
          timeElapsed="0.0"
          timeTotal="2.0"
          nextSaleGold="10"
          comboChain={0}
        />,
      );
      expect(screen.queryByTestId("combo-badge")).toBeNull();
    });
  });

  describe("<CanvasStage> — crit chunks (per-chunk gold flash)", () => {
    it("does not render a CRIT badge (canvas-level crit removed)", () => {
      const { container } = render(
        <CanvasStage
          canvasTier={1}
          progressPct={0.5}
          timeElapsed="3.0"
          timeTotal="6.0"
          nextSaleGold="100"
        />,
      );
      expect(container.querySelector("[data-testid='crit-indicator']")).toBeNull();
    });

    it("applies the sketchCellCrit modifier to in-flight cells listed in critChunks", () => {
      vi.useFakeTimers();
      try {
        const { container } = render(
          <CanvasStage
            canvasTier={1}
            progressPct={1.0}  // all 10 cells revealed at T1
            timeElapsed="6.0"
            timeTotal="6.0"
            nextSaleGold="100"
            critChunks={{ 0: true, 1: true }}
          />,
        );
        // Drip the queue enough for the first cells (which include the
        // critChunks indices since they sit early in the engine reveal order)
        // to be in-flight. The crit cells stay in-flight for 600ms.
        act(() => {
          vi.advanceTimersByTime(150);
        });
        const inFlight = container.querySelector(
          "[data-testid='sketch-overlay-in-flight']",
        );
        expect(inFlight).not.toBeNull();
        const cells = Array.from(
          inFlight!.querySelectorAll<HTMLDivElement>("div"),
        );
        // The two crit cells (indices 0 and 1) are early in cellOrder for
        // canvasNumber=0 (default), so they appear in the first in-flight
        // batch. We assert the modifier is applied somewhere on the screen
        // during the in-flight window.
        const critCells = cells.filter((c) =>
          c.className.includes("sketchCellCrit"),
        );
        const critIndices = critCells.map((c) =>
          Number(c.getAttribute("data-cell-index")),
        );
        // Both crit-marked indices that appear in-flight should be flagged.
        for (const idx of critIndices) {
          expect([0, 1]).toContain(idx);
        }
        // At least one of the two crit cells should be in-flight by now.
        expect(critCells.length).toBeGreaterThanOrEqual(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
