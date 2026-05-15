import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderRoute() {
  return render(
    <MemoryRouter>
      <AscensionRoute />
    </MemoryRouter>,
  );
}

describe("AscensionRoute hover wiring (Step Through button)", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
      inspiration: big(0), fame: big(0),
      ascendCount: 0, pastRuns: [], purchasedNodes: {},
    });
  });

  it("hover below the gate shows the 'Need 10,000 inspiration' message", () => {
    useGameStore.setState({ inspiration: big(0) });
    renderRoute();
    fireEvent.mouseEnter(screen.getByTestId("step-through-btn"));
    expect(useGameStore.getState().hoverTitle).toBe("Ascend");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Need 10,000 inspiration/);
  });

  it("hover at gate shows current inspi, fame gain, formula, milestones", () => {
    useGameStore.setState({ inspiration: big(10_000) });
    renderRoute();
    fireEvent.mouseEnter(screen.getByTestId("step-through-btn"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Current inspi: 10\.00K/);
    expect(container.textContent).toMatch(/Fame gain: \+1/);
    expect(container.textContent).toMatch(/Formula:/);
    expect(container.textContent).toMatch(/Milestones:/);
    expect(container.textContent).toMatch(/1M inspi → 102 fame/);
    expect(container.textContent).toMatch(/1B inspi → 10,000 fame/);
  });

  it("hover at 1M inspi shows fame gain of +102", () => {
    useGameStore.setState({ inspiration: big(1_000_000) });
    renderRoute();
    fireEvent.mouseEnter(screen.getByTestId("step-through-btn"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Fame gain: \+102/);
  });

  it("footer reads the reset summary", () => {
    renderRoute();
    fireEvent.mouseEnter(screen.getByTestId("step-through-btn"));
    expect(String(useGameStore.getState().hoverFooter))
      .toMatch(/resets gold, inspi, tree, canvas, workshop/);
  });
});
