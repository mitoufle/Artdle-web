import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpgradeRow } from "@/components/tree/UpgradeRow";
import { useGameStore } from "@/store";

describe("UpgradeRow hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
      purchasedNodes: {},
    });
  });

  it("hover on buy button pushes name as title and shows level + cost + contribution", () => {
    render(
      <UpgradeRow
        partId="cotyledon" name="Cotyledon" level={3} rate={1.5}
        cost="120" canAfford={true} onBuy={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("upgrade-buy-cotyledon"));
    expect(useGameStore.getState().hoverTitle).toBe("Cotyledon");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Level: 3/);
    expect(container.textContent).toMatch(/Next cost: 120 g/);
    expect(container.textContent).toMatch(/\+4\.50 inspi\/sec/); // 3 * 1.5 * 1.0
  });

  it("contribution reflects current inspi multiplier (get_inspired levels)", () => {
    // get_inspired Lv 1 = +20% inspi mult → 1.20×.
    // 3 level × 1.5 rate × 1.20 mult = 5.40 → "5.40"
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    render(
      <UpgradeRow
        partId="cotyledon" name="Cotyledon" level={3} rate={1.5}
        cost="120" canAfford={true} onBuy={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("upgrade-buy-cotyledon"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/\+5\.40 inspi\/sec/);
  });

  it("footer reads the static scaling note", () => {
    render(
      <UpgradeRow
        partId="tendril" name="Tendril" level={0} rate={2.0}
        cost="200" canAfford={false} onBuy={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("upgrade-buy-tendril"));
    expect(String(useGameStore.getState().hoverFooter)).toMatch(/global inspi multiplier/);
  });

  it("hover shows the real next milestone factor, not ×2, for levels where the next factor differs (Lv 60 → ×3 at Lv 100)", () => {
    // PART_MILESTONES = [10,25,50,100,200,400,800,1000]
    // PART_MILESTONE_FACTORS = [2,2,3,3,4,5,6,8]
    // Level 60: milestones ≤60 are 10(×2), 25(×2), 50(×3) → cumulative 12.
    // Next milestone is Lv 100 with factor ×3, NOT ×2.
    render(
      <UpgradeRow
        partId="cotyledon" name="Cotyledon" level={60} rate={1.0}
        cost="500" canAfford={true} onBuy={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("upgrade-buy-cotyledon"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Next milestone: Lv 100 \(×3\)/);
    expect(container.textContent).not.toMatch(/Next milestone: Lv 100 \(×6\)/);
    expect(container.textContent).not.toMatch(/Next milestone: Lv 100 \(×24\)/);
  });
});
