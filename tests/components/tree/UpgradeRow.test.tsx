import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpgradeRow } from "@/components/tree/UpgradeRow";
import { useGameStore } from "@/store";

describe("<UpgradeRow />", () => {
  beforeEach(() => {
    useGameStore.setState({ purchasedNodes: {}, completedResearches: {}, completedAchievements: {}, museBurstTimer: 0 });
  });
  it("renders monogram, name, level, contribution, cost", () => {
    render(
      <UpgradeRow
        partId="cotyledon"
        name="Cotyledon"
        level={3}
        rate={0.1}
        cost="120"
        canAfford={true}
        onBuy={() => {}}
      />,
    );
    expect(screen.getByText("C")).toBeInTheDocument(); // monogram
    expect(screen.getByText("Cotyledon")).toBeInTheDocument();
    expect(screen.getByText(/Lv 3/i)).toBeInTheDocument();
    // Tile shows the live contribution: level 3 × rate 0.1 × milestone 1.0 × global mult 1.0 = 0.30
    expect(screen.getByText(/\+0\.30 inspi\/s/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  it("tile contribution reflects external inspi modifiers (get_inspired Lv 1 = ×1.2)", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    render(
      <UpgradeRow
        partId="cotyledon" name="Cotyledon" level={3} rate={0.1}
        cost="120" canAfford={true} onBuy={() => {}}
      />,
    );
    // 3 × 0.1 × milestone 1.0 × 1.2 mult = 0.36
    expect(screen.getByText(/\+0\.36 inspi\/s/)).toBeInTheDocument();
  });

  it("tile contribution reflects the milestone multiplier at the current level (Lv 10 = ×2)", () => {
    render(
      <UpgradeRow
        partId="cotyledon" name="Cotyledon" level={10} rate={0.1}
        cost="500" canAfford={true} onBuy={() => {}}
      />,
    );
    // 10 × 0.1 × milestone 2.0 × 1.0 mult = 2.00
    expect(screen.getByText(/\+2(\.00)? inspi\/s/)).toBeInTheDocument();
  });

  it("calls onBuy when the button is clicked and affordable", () => {
    const onBuy = vi.fn();
    render(
      <UpgradeRow
        partId="cotyledon"
        name="Cotyledon"
        level={0}
        rate={0.1}
        cost="10"
        canAfford={true}
        onBuy={onBuy}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onBuy).toHaveBeenCalledOnce();
  });

  it("button is disabled when canAfford=false", () => {
    render(
      <UpgradeRow
        partId="cotyledon"
        name="Cotyledon"
        level={0}
        rate={0.1}
        cost="10"
        canAfford={false}
        onBuy={() => {}}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not call onBuy when disabled and clicked", () => {
    const onBuy = vi.fn();
    render(
      <UpgradeRow
        partId="cotyledon"
        name="Cotyledon"
        level={0}
        rate={0.1}
        cost="10"
        canAfford={false}
        onBuy={onBuy}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onBuy).not.toHaveBeenCalled();
  });

  it("monogram is the uppercased first letter of the name", () => {
    render(
      <UpgradeRow
        partId="leaftip"
        name="Leaflet"
        level={0}
        rate={50}
        cost="5K"
        canAfford={true}
        onBuy={() => {}}
      />,
    );
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("shows milestone hint with next factor when below max milestone", () => {
    render(
      <UpgradeRow
        partId="cotyledon"
        name="Cotyledon"
        level={3}
        rate={0.1}
        cost="120"
        canAfford={true}
        onBuy={() => {}}
      />,
    );
    // Level 3 → next milestone is Lv 10, factor ×2
    expect(screen.getByText(/next ×2 at Lv 10/i)).toBeInTheDocument();
  });

  it("does not show milestone hint when at max milestone level", () => {
    render(
      <UpgradeRow
        partId="cotyledon"
        name="Cotyledon"
        level={1000}
        rate={0.1}
        cost="9999"
        canAfford={true}
        onBuy={() => {}}
      />,
    );
    expect(screen.queryByText(/next ×/i)).not.toBeInTheDocument();
  });
});
