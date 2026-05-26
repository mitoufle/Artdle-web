import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { TierUpgradeCard } from "@/components/painting/TierUpgradeCard";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState());
});

describe("TierUpgradeCard", () => {
  it("shows the next tier number and cost", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(0) });
    render(<TierUpgradeCard />);
    expect(screen.getByText(/Tier 2/i)).toBeInTheDocument();
    // formatBig(1000) → "1.00K"; accept that, "1,000", or "1k" as the cost rendering.
    expect(screen.getByText(/1[.,]?000|1\.?00?k/i)).toBeInTheDocument();
  });

  it("does NOT apply the rainbow border class when unaffordable", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(999) });
    const { container } = render(<TierUpgradeCard />);
    expect(container.querySelector("[data-affordable='true']")).toBeNull();
  });

  it("applies the rainbow border class when affordable", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(1000) });
    const { container } = render(<TierUpgradeCard />);
    expect(container.querySelector("[data-affordable='true']")).not.toBeNull();
  });

  it("clicking when affordable spends gold and increments tier", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(1000) });
    render(<TierUpgradeCard />);
    fireEvent.click(screen.getByRole("button"));
    expect(useGameStore.getState().canvasTier).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
  });

  it("clicking when unaffordable is a no-op", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(500) });
    render(<TierUpgradeCard />);
    fireEvent.click(screen.getByRole("button"));
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(500);
  });
});
