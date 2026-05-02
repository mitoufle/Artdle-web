import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";

describe("<WorkshopPopup />", () => {
  beforeEach(() => {
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({
      workshopPopupOpen: true,
      gold: big(1000),
      purchasedNodes: {},
      currentView: "painting",
    });
    setSeed(42);
  });

  it("renders nothing when workshopPopupOpen=false", () => {
    useGameStore.setState({ workshopPopupOpen: false });
    const { container } = render(<WorkshopPopup />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Craft, Inventory, Equipped sections when open", () => {
    render(<WorkshopPopup />);
    expect(screen.getByRole("button", { name: /^craft$/i })).toBeInTheDocument();
    expect(screen.getByText(/^inventory$/i)).toBeInTheDocument();
    expect(screen.getByText(/^equipped/i)).toBeInTheDocument();
  });

  it("disables Craft when gold < 100", () => {
    useGameStore.setState({ gold: big(99) });
    render(<WorkshopPopup />);
    expect(screen.getByRole("button", { name: /^craft$/i })).toBeDisabled();
  });

  it("Craft click adds an item to inventory", () => {
    render(<WorkshopPopup />);
    expect(useGameStore.getState().inventory.length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /^craft$/i }));
    expect(useGameStore.getState().inventory.length).toBe(1);
  });

  it("Inventory card click equips the item (moves to equippedItems)", () => {
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
    });
    render(<WorkshopPopup />);
    fireEvent.click(screen.getByRole("button", { name: /^\+canvas_gold% 10%$/i }));
    expect(useGameStore.getState().inventory.length).toBe(0);
    expect(useGameStore.getState().equippedItems.length).toBe(1);
  });

  it("Equipped card click unequips (moves item back to inventory)", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
    });
    render(<WorkshopPopup />);
    fireEvent.click(screen.getByRole("button", { name: /\+canvas_gold% 10/i }));
    expect(useGameStore.getState().equippedItems.length).toBe(0);
    expect(useGameStore.getState().inventory.length).toBe(1);
  });

  it("Discard ✕ removes item from inventory without affecting equipped", () => {
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
      equippedItems: [{ kind: "-paint_time%" as const, magnitude: 8 }],
    });
    render(<WorkshopPopup />);
    fireEvent.click(screen.getByRole("button", { name: /^discard \+canvas_gold% 10%$/i }));
    expect(useGameStore.getState().inventory.length).toBe(0);
    expect(useGameStore.getState().equippedItems.length).toBe(1);
  });

  it("Esc keydown closes the popup", () => {
    render(<WorkshopPopup />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });

  it("Backdrop click closes the popup; clicking the inner card does not", () => {
    render(<WorkshopPopup />);
    const dialog = screen.getByRole("dialog");
    // Inner card is the only child div with bg-app-bg.
    const innerCard = dialog.firstChild as HTMLElement;
    fireEvent.click(innerCard);
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);
    fireEvent.click(dialog);
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });

  it("auto-closes when currentView changes away from 'painting'", () => {
    render(<WorkshopPopup />);
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);
    act(() => { useGameStore.setState({ currentView: "home" }); });
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });
});
