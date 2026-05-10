import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("CanvasStage hover wiring (sell preview)", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
      purchasedNodes: {},
      equipped: {},
      paintMastery: big(0),
    });
  });

  it("hover on gold preview pushes title 'Sell Canvas' and a body with Total line", () => {
    render(
      <CanvasStage sizeLevel={3} progressPct={0.5} timeElapsed="3.0" timeTotal="6.0" nextSaleGold="90" />,
    );
    fireEvent.mouseEnter(screen.getByTestId("canvas-sell-preview"));
    expect(useGameStore.getState().hoverTitle).toBe("Sell Canvas");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Base × tier²: 10 × 3² = 90/);
    expect(container.textContent).toMatch(/Total:/);
    expect(container.textContent).toMatch(/per canvas/);
  });

  it("hover body reflects rainbow factor when rainbow is owned", () => {
    useGameStore.setState({ purchasedNodes: { rainbow: 1 } });
    render(
      <CanvasStage sizeLevel={1} progressPct={0} timeElapsed="0.0" timeTotal="2.0" nextSaleGold="15" />,
    );
    fireEvent.mouseEnter(screen.getByTestId("canvas-sell-preview"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Rainbow:.*×1\.50/);
  });

  it("footer reads 'Auto-sells when paint progress reaches 100%.'", () => {
    render(
      <CanvasStage sizeLevel={1} progressPct={0} timeElapsed="0.0" timeTotal="2.0" nextSaleGold="10" />,
    );
    fireEvent.mouseEnter(screen.getByTestId("canvas-sell-preview"));
    expect(String(useGameStore.getState().hoverFooter)).toBe("Auto-sells when paint progress reaches 100%.");
  });
});
