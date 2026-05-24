import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";

describe("<CanvasStage />", () => {
  it("renders the workshop scene static image inside the frame", () => {
    const { container } = render(
      <CanvasStage
        sizeLevel={1}
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

  it("displays the tier in the title row", () => {
    const { container } = render(
      <CanvasStage
        sizeLevel={5}
        canvasTier={6}
        progressPct={0.6}
        timeElapsed="6.0"
        timeTotal="10.0"
        nextSaleGold="250"
      />,
    );
    const titleEl = container.querySelector("div[class*='title']");
    expect(titleEl?.textContent).toMatch(/Tier 6/);
    expect(titleEl?.textContent).toMatch(/Masterpiece/);
  });

  it("displays painting time as 'elapsed / total' (counts up to total)", () => {
    render(
      <CanvasStage
        sizeLevel={5}
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
        sizeLevel={1}
        canvasTier={1}
        progressPct={0}
        timeElapsed="0.0"
        timeTotal="2.0"
        nextSaleGold="184"
      />,
    );
    expect(screen.getByText(/\+184g/i)).toBeInTheDocument();
  });

  describe("<CanvasStage> — sketch overlay reveal", () => {
    it("renders the sketch overlay with 25 cells at 5x5 grid", () => {
      const { container } = render(
        <CanvasStage
          sizeLevel={1}
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
      expect(overlay?.children.length).toBe(25);
    });

    it("at progressPct=0, zero cells are visible (opacity 1)", () => {
      const { container } = render(
        <CanvasStage
          sizeLevel={1}
          canvasTier={1}
          progressPct={0}
          timeElapsed="0.0"
          timeTotal="10.0"
          nextSaleGold="10"
          canvasNumber={1}
        />,
      );
      const cells = container.querySelectorAll('[data-testid="sketch-overlay"] > div');
      const visible = Array.from(cells).filter((c) => (c as HTMLElement).style.opacity === "1");
      expect(visible.length).toBe(0);
    });

    it("at progressPct=0.5, ~half the cells are revealed", () => {
      const { container } = render(
        <CanvasStage
          sizeLevel={1}
          canvasTier={1}
          progressPct={0.5}
          timeElapsed="5.0"
          timeTotal="10.0"
          nextSaleGold="10"
          canvasNumber={1}
        />,
      );
      const cells = container.querySelectorAll('[data-testid="sketch-overlay"] > div');
      const visible = Array.from(cells).filter(
        (c) => (c as HTMLElement).getAttribute("data-revealed") === "true",
      );
      // floor(0.5 * 25) = 12
      expect(visible.length).toBe(12);
    });

    it("at progressPct=1.0, all 25 cells are revealed", () => {
      const { container } = render(
        <CanvasStage
          sizeLevel={1}
          canvasTier={1}
          progressPct={1.0}
          timeElapsed="10.0"
          timeTotal="10.0"
          nextSaleGold="10"
          canvasNumber={1}
        />,
      );
      const cells = container.querySelectorAll('[data-testid="sketch-overlay"] > div');
      const visible = Array.from(cells).filter(
        (c) => (c as HTMLElement).getAttribute("data-revealed") === "true",
      );
      expect(visible.length).toBe(25);
    });
  });

  describe("<CanvasStage> — combo badge", () => {
    it("renders combo chain badge when comboChain > 0", () => {
      render(
        <CanvasStage
          sizeLevel={3}
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
          sizeLevel={0}
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
          sizeLevel={1}
          canvasTier={1}
          progressPct={0.5}
          timeElapsed="3.0"
          timeTotal="6.0"
          nextSaleGold="100"
        />,
      );
      expect(container.querySelector("[data-testid='crit-indicator']")).toBeNull();
    });

    it("applies the sketchCellCrit modifier to cells listed in critChunks", () => {
      const { container } = render(
        <CanvasStage
          sizeLevel={1}
          canvasTier={1}
          progressPct={1.0}  // all 25 cells revealed at T1
          timeElapsed="6.0"
          timeTotal="6.0"
          nextSaleGold="100"
          critChunks={{ 0: true, 1: true }}
        />,
      );
      const overlay = container.querySelector("[data-testid='sketch-overlay']");
      expect(overlay).not.toBeNull();
      const cells = Array.from(overlay!.querySelectorAll<HTMLDivElement>("div"));
      const critCells = cells.filter((c) => c.className.includes("sketchCellCrit"));
      expect(critCells.length).toBe(2);
    });
  });
});
