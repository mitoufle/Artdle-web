import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("WorkshopRoom hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      workshopLevel: 1, workshopXp: 0,
      gold: big(0), inventory: [], equipped: {},
      purchasedNodes: {},
      hoverTitle: "", hoverBody: "", hoverFooter: "",
    });
  });

  it("Craft button hover pushes title 'Craft Item' and body with cost + Normal probability", () => {
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    expect(useGameStore.getState().hoverTitle).toBe("Craft Item");
    // Body is a ReactNode — render it to assert text content.
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Cost:/);
    expect(container.textContent).toMatch(/Normal/);
  });

  it("Craft button hover at Lv 1 shows '—' for locked tiers (Magic, Rare, Epic, Legendary)", () => {
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Magic[^\n]*—/);
    expect(container.textContent).toMatch(/Legendary[^\n]*—/);
  });

  it("Craft button hover at Lv 70 shows non-zero probability for all tiers", () => {
    useGameStore.setState({ workshopLevel: 70 });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Legendary[^\n]*\d+\.\d+%/);
  });

  it("Mouse leave clears hoverTitle", () => {
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    fireEvent.mouseLeave(screen.getByTestId("craft-button"));
    expect(useGameStore.getState().hoverTitle).toBe("");
  });
});
