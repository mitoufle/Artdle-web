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
    expect(container.textContent).toMatch(/Magic.*3/);
    expect(container.textContent).toMatch(/Legendary.*40/);
  });

  it("Workshop level header at Lv 35+ marks Magic, Rare, Epic with check, Legendary unmarked", () => {
    useGameStore.setState({ workshopLevel: 35, workshopXp: 0 });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("workshop-level-header"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Magic at Lv 3 ✓/);
    expect(container.textContent).toMatch(/Rare at Lv 8 ✓/);
    expect(container.textContent).toMatch(/Epic at Lv 20 ✓/);
    expect(container.textContent).toMatch(/Legendary at Lv 40(?! ✓)/);
  });

  it("Inventory item hover shows tier + slot in title and affix effects in body", () => {
    useGameStore.setState({
      inventory: [{
        id: "test-1", slot: "brush", tier: "rare",
        affixes: [
          { kind: "+sell_price%", magnitude: 12 },
          { kind: "+speed%", magnitude: 8 },
        ],
      }],
    });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("inventory-equip-test-1"));
    expect(useGameStore.getState().hoverTitle).toBe("Rare brush");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/\+12% sell price/);
    expect(container.textContent).toMatch(/\+8% speed/);
  });

  it("Inventory item hover footer reads 'Click to equip.'", () => {
    useGameStore.setState({
      inventory: [{
        id: "x-1", slot: "palette", tier: "normal",
        affixes: [{ kind: "+sell_price%", magnitude: 3 }],
      }],
    });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("inventory-equip-x-1"));
    expect(String(useGameStore.getState().hoverFooter)).toBe("Click to equip.");
  });

  it("Equipped slot hover shows item details and 'Click to unequip' footer", () => {
    useGameStore.setState({
      purchasedNodes: { gear_up: 1 },
      equipped: {
        brush: {
          id: "eq-1", slot: "brush", tier: "magic",
          affixes: [{ kind: "+sell_price%", magnitude: 5 }],
        },
      },
    });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("slot-unequip-brush"));
    expect(useGameStore.getState().hoverTitle).toBe("Magic brush — equipped");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/\+5% sell price/);
    expect(String(useGameStore.getState().hoverFooter)).toBe("Click to unequip.");
  });

  it("Empty slot hover shows '(empty)' title and a hint body", () => {
    useGameStore.setState({ purchasedNodes: { gear_up: 1 }, equipped: {} });
    render(<WorkshopRoom />);
    // Both brush and palette slots are unlocked at this point — pick brush.
    // The hover target is the <li data-testid="slot-brush">'s child (the empty div).
    // Since Hoverable wraps the empty div, we must hover the wrapping element.
    // The slot <li> contains exactly the wrapper, so hovering the <li>'s only
    // child (which is now the Hoverable's <div>) propagates onto it.
    // Use within() to find the wrapper inside slot-brush and hover it.
    const slotLi = screen.getByTestId("slot-brush");
    fireEvent.mouseEnter(slotLi.firstElementChild!);
    expect(useGameStore.getState().hoverTitle).toBe("brush (empty)");
    expect(String(useGameStore.getState().hoverBody)).toBe("Equip an item from your inventory.");
  });
});
