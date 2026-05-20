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
    expect(container.textContent).toMatch(/\+4\.5 inspi\/sec/); // 3 * 1.5 * 1.0
  });

  it("contribution reflects current inspi multiplier (get_inspired levels)", () => {
    // get_inspired Lv 1 = +50% inspi mult → 1.50×.
    // 3 level × 1.5 rate × 1.50 mult = 6.75 → "6.8"
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    render(
      <UpgradeRow
        partId="cotyledon" name="Cotyledon" level={3} rate={1.5}
        cost="120" canAfford={true} onBuy={() => {}}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("upgrade-buy-cotyledon"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/\+6\.8 inspi\/sec/);
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
});
