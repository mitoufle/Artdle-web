import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";

// Mock react-router-dom
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: vi.fn(() => ({ pathname: "/painting" })),
  };
});

describe("<WorkshopPopup />", () => {
  beforeEach(() => {
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({
      workshopPopupOpen: true,
      gold: big(1000),
      purchasedNodes: {},
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
    const innerCard = screen.getByTestId("workshop-popup-card");
    fireEvent.click(innerCard);
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);
    fireEvent.click(dialog);
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });

  it("auto-closes when pathname changes away from '/painting'", () => {
    const { rerender } = render(<WorkshopPopup />);
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);

    // Mock the location change to a different route.
    vi.mocked(useLocation).mockReturnValue({ pathname: "/home" } as any);

    rerender(<WorkshopPopup />);
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });
});
