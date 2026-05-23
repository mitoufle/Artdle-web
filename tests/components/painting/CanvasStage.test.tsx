import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";

describe("<CanvasStage />", () => {
  it("renders the workshop scene image inside the frame", () => {
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
    expect(container.querySelector("img")).toBeInTheDocument();
    expect(container.querySelector("img")?.getAttribute("alt"))
      .toMatch(/workshop/i);
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

  describe("<CanvasStage> — combo + crit badges", () => {
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
          isCrit={false}
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
          isCrit={false}
        />,
      );
      expect(screen.queryByTestId("combo-badge")).toBeNull();
    });

    it("renders crit indicator when isCrit=true", () => {
      render(
        <CanvasStage
          sizeLevel={0}
          canvasTier={1}
          progressPct={0.1}
          timeElapsed="0.1"
          timeTotal="0.2"
          nextSaleGold="10"
          comboChain={0}
          isCrit={true}
        />,
      );
      expect(screen.getByTestId("crit-indicator")).toBeInTheDocument();
    });

    it("does NOT render crit indicator when isCrit=false", () => {
      render(
        <CanvasStage
          sizeLevel={0}
          canvasTier={1}
          progressPct={0.1}
          timeElapsed="0.1"
          timeTotal="2.0"
          nextSaleGold="10"
          comboChain={0}
          isCrit={false}
        />,
      );
      expect(screen.queryByTestId("crit-indicator")).toBeNull();
    });
  });
});
