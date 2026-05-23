import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierUpCard } from "@/components/painting/TierUpCard";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";

describe("<TierUpCard />", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState });
  });

  it("renders in Locked state when gate is not met", () => {
    useGameStore.setState({ sellPriceLevel: 14, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={14} speedLevel={15} canvasTier={1} />);
    expect(screen.getByTestId("tier-up-card")).toHaveAttribute("data-state", "locked");
    expect(screen.getByText(/Reach sell_price L15.*speed L15/)).toBeInTheDocument();
  });

  it("renders in Ready state when gate is met", () => {
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={15} speedLevel={15} canvasTier={1} />);
    expect(screen.getByTestId("tier-up-card")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText(/Tier 2.*×10 base gold/)).toBeInTheDocument();
  });

  it("clicking the Ready card calls tierUp and bumps canvasTier", () => {
    useGameStore.setState({ sellPriceLevel: 15, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={15} speedLevel={15} canvasTier={1} />);
    fireEvent.click(screen.getByTestId("tier-up-card"));
    expect(useGameStore.getState().canvasTier).toBe(2);
    // Levels were reset by tierUp
    expect(useGameStore.getState().sellPriceLevel).toBe(0);
    expect(useGameStore.getState().speedLevel).toBe(0);
  });

  it("clicking the Locked card does nothing", () => {
    useGameStore.setState({ sellPriceLevel: 14, speedLevel: 15, canvasTier: 1 });
    render(<TierUpCard sellPriceLevel={14} speedLevel={15} canvasTier={1} />);
    fireEvent.click(screen.getByTestId("tier-up-card"));
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().sellPriceLevel).toBe(14);
  });
});
