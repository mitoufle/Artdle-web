import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpgradeRow } from "@/components/tree/UpgradeRow";

describe("<UpgradeRow />", () => {
  it("renders monogram, name, level, rate, cost", () => {
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
    expect(screen.getByText(/0\.1/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
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
