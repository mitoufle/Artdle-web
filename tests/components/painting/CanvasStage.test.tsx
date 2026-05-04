import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";

describe("<CanvasStage />", () => {
  it("renders the canvas SVG inside the frame", () => {
    const { container } = render(
      <CanvasStage
        tier={1}
        progressPct={0}
        timeRemaining="2.0"
        timeTotal="2.0"
        nextSaleGold="10"
      />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("displays the tier in the title row", () => {
    render(
      <CanvasStage
        tier={5}
        progressPct={0.6}
        timeRemaining="4.0"
        timeTotal="10.0"
        nextSaleGold="250"
      />,
    );
    expect(screen.getByText(/Masterpiece/i)).toBeInTheDocument();
  });

  it("displays painting time as 'remaining / total'", () => {
    render(
      <CanvasStage
        tier={5}
        progressPct={0.6}
        timeRemaining="4.0"
        timeTotal="10.0"
        nextSaleGold="250"
      />,
    );
    expect(screen.getByText(/4\.0.*10\.0/)).toBeInTheDocument();
  });

  it("displays next sale gold preview", () => {
    render(
      <CanvasStage
        tier={1}
        progressPct={0}
        timeRemaining="2.0"
        timeTotal="2.0"
        nextSaleGold="184"
      />,
    );
    expect(screen.getByText(/\+184g/i)).toBeInTheDocument();
  });

  it("paint-fill overlay reflects progressPct via inline height style", () => {
    const { container } = render(
      <CanvasStage
        tier={1}
        progressPct={0.4}
        timeRemaining="1.2"
        timeTotal="2.0"
        nextSaleGold="10"
      />,
    );
    const fill = container.querySelector('[data-testid="canvas-fill"]') as HTMLElement;
    expect(fill).toBeInTheDocument();
    expect(fill?.style.height).toBe("40%");
  });
});
