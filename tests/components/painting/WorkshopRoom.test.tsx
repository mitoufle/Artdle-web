import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

/** Escape regex special characters so item.kind values like "+canvas_gold%" are safe. */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("<WorkshopRoom />", () => {
  beforeEach(() => {
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
  });

  it("renders the room header 'Workshop'", () => {
    render(<WorkshopRoom />);
    expect(screen.getByRole("heading", { name: /workshop/i })).toBeInTheDocument();
  });

  it("renders Craft button (disabled when player has no gold)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByRole("button", { name: /craft/i })).toBeDisabled();
  });

  it("Craft button is enabled when gold ≥ craft cost", () => {
    useGameStore.setState({ gold: big(10000) });
    render(<WorkshopRoom />);
    expect(screen.getByRole("button", { name: /craft/i })).not.toBeDisabled();
  });

  it("clicking Craft adds an item to inventory", () => {
    useGameStore.setState({ gold: big(10000) });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByRole("button", { name: /craft/i }));
    expect(useGameStore.getState().inventory.length).toBe(1);
  });

  it("renders 'Inventory' and 'Equipped' section headings", () => {
    render(<WorkshopRoom />);
    expect(screen.getByText(/inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/equipped/i)).toBeInTheDocument();
  });

  it("displays an inventory item that can be equipped via click", () => {
    useGameStore.setState({ gold: big(10000) });
    useGameStore.getState().craft();
    render(<WorkshopRoom />);
    const item = useGameStore.getState().inventory[0]!;
    const equipButton = screen.getByRole("button", { name: new RegExp(`${escapeRegex(item.kind)}.*${item.magnitude}`) });
    fireEvent.click(equipButton);
    expect(useGameStore.getState().equippedItems.length).toBe(1);
  });

  it("equipped items can be unequipped via click", () => {
    useGameStore.setState({ gold: big(10000) });
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    render(<WorkshopRoom />);
    const equipped = useGameStore.getState().equippedItems[0]!;
    const buttons = screen.getAllByRole("button", {
      name: new RegExp(`${escapeRegex(equipped.kind)}.*${equipped.magnitude}`),
    });
    // The equipped button (in the equipped section) — click whichever is enabled
    const target = buttons.find((b) => !b.hasAttribute("disabled")) ?? buttons[0]!;
    fireEvent.click(target);
    expect(useGameStore.getState().inventory.length).toBe(1);
  });
});
