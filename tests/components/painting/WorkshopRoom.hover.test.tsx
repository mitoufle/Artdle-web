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

  it("Workshop level header hover shows current XP and tier unlock list", () => {
    useGameStore.setState({ workshopLevel: 7, workshopXp: 12 });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("workshop-level-header"));
    expect(useGameStore.getState().hoverTitle).toBe("Workshop Lv 7");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/XP:.*12.*\//);
    expect(container.textContent).toMatch(/Magic.*5/);
    expect(container.textContent).toMatch(/Legendary.*70/);
  });

  it("Workshop level header at Lv 35+ marks Magic, Rare, Epic with check, Legendary unmarked", () => {
    useGameStore.setState({ workshopLevel: 35, workshopXp: 0 });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("workshop-level-header"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Magic at Lv 5 ✓/);
    expect(container.textContent).toMatch(/Rare at Lv 15 ✓/);
    expect(container.textContent).toMatch(/Epic at Lv 35 ✓/);
    expect(container.textContent).toMatch(/Legendary at Lv 70(?! ✓)/);
  });
});
