import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderPaintingRoute() {
  return render(
    <MemoryRouter>
      <PaintingRoute />
    </MemoryRouter>,
  );
}

describe("PaintingRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
  });

  it("renders the canvas SVG", () => {
    const { container } = renderPaintingRoute();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the TierCard", () => {
    renderPaintingRoute();
    expect(screen.getByTestId("tier-card-upgrade")).toBeInTheDocument();
  });

  it("renders the room rail with 4 tabs", () => {
    renderPaintingRoute();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("renders the WorkshopRoom (Craft button visible)", () => {
    renderPaintingRoute();
    expect(screen.getByTestId("craft-button")).toBeInTheDocument();
  });

  it("tier upgrade button works (clicking spends gold + bumps tier)", () => {
    useGameStore.setState({ gold: big(1000), canvasTier: 1 });
    renderPaintingRoute();
    const before = useGameStore.getState().canvasTier;
    screen.getByTestId("tier-card-upgrade").click();
    expect(useGameStore.getState().canvasTier).toBe(before + 1);
  });
});
