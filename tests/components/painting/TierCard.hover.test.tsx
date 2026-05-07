import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierCard } from "@/components/painting/TierCard";
import { useGameStore } from "@/store";

describe("TierCard hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
    });
  });

  it("hover at tier 3 shows 'Upgrade to Tier 4' title and cost/before-after stats", () => {
    render(
      <TierCard tier={3} cost="100" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    fireEvent.mouseEnter(screen.getByTestId("tier-card-upgrade"));
    expect(useGameStore.getState().hoverTitle).toBe("Upgrade to Tier 4");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Cost:/);
    expect(container.textContent).toMatch(/Paint time:.*6s.*8s/); // tier 3 = 6s, tier 4 = 8s
    expect(container.textContent).toMatch(/Gold\/canvas:/);
  });

  it("hover at tier 9 shows the 'Tier 10 is the cap' footer", () => {
    render(
      <TierCard tier={9} cost="x" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    fireEvent.mouseEnter(screen.getByTestId("tier-card-upgrade"));
    expect(String(useGameStore.getState().hoverFooter)).toMatch(/Tier 10 is the cap/);
  });

  it("hover at tier 10 (isMax) shows 'Tier MAX' title and a max-state body", () => {
    render(
      <TierCard tier={10} cost="0" canAfford={false} isMax={true} onUpgrade={() => {}} />,
    );
    fireEvent.mouseEnter(screen.getByTestId("tier-card-upgrade"));
    expect(useGameStore.getState().hoverTitle).toBe("Tier MAX");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/maximum/i);
  });

  it("Mouse leave clears hoverTitle", () => {
    render(
      <TierCard tier={2} cost="x" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    fireEvent.mouseEnter(screen.getByTestId("tier-card-upgrade"));
    fireEvent.mouseLeave(screen.getByTestId("tier-card-upgrade"));
    expect(useGameStore.getState().hoverTitle).toBe("");
  });
});
