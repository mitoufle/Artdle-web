import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierUpgradeButton } from "@/ui/widgets/TierUpgradeButton";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("<TierUpgradeButton />", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();
  });

  it("renders cost label for current tier", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(0) });
    render(<TierUpgradeButton />);
    // Tier 1→2 cost = 100. Label should mention tier 2 and cost.
    expect(screen.getByRole("button")).toHaveTextContent(/Tier 2/);
    expect(screen.getByRole("button")).toHaveTextContent(/100/);
  });

  it("is disabled when gold < cost", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(50) });
    render(<TierUpgradeButton />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is enabled when gold ≥ cost", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(100) });
    render(<TierUpgradeButton />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("click dispatches upgradeTier (tier increments, gold spent)", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(150) });
    render(<TierUpgradeButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(useGameStore.getState().canvasTier).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBe(50);
  });

  it("at MAX_TIER shows 'Tier MAX' and is disabled", () => {
    useGameStore.setState({ canvasTier: 10, gold: big(1e9) });
    render(<TierUpgradeButton />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent(/Tier MAX/);
    expect(btn).toBeDisabled();
  });
});
