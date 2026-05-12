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
        partId="leaflet"
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
});
