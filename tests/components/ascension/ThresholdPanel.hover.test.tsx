import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThresholdPanel } from "@/components/ascension/ThresholdPanel";
import { useGameStore } from "@/store";

describe("ThresholdPanel hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
    });
  });

  it("hover pushes title 'Inspiration → Fame' and the milestone table", () => {
    render(<ThresholdPanel currentInspi="0" />);
    fireEvent.mouseEnter(screen.getByTestId("threshold-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("Inspiration → Fame");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/9,999.*0.*blocked/);
    expect(container.textContent).toMatch(/10,000.*1/);
    expect(container.textContent).toMatch(/100,000.*3/);
    expect(container.textContent).toMatch(/1,000,000.*102/);
    expect(container.textContent).toMatch(/1B.*10,000/);
  });

  it("footer reads the curve formula", () => {
    render(<ThresholdPanel currentInspi="0" />);
    fireEvent.mouseEnter(screen.getByTestId("threshold-panel"));
    const footer = String(useGameStore.getState().hoverFooter);
    expect(footer).toMatch(/log₁₀\(inspi\)−4/);
    expect(footer).toMatch(/10k gate/);
  });

  it("Mouse leave clears hoverTitle", () => {
    render(<ThresholdPanel currentInspi="0" />);
    fireEvent.mouseEnter(screen.getByTestId("threshold-panel"));
    fireEvent.mouseLeave(screen.getByTestId("threshold-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("");
  });
});
