import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TreeRoute } from "@/routes/TreeRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderTreeRoute() {
  return render(
    <MemoryRouter>
      <TreeRoute />
    </MemoryRouter>,
  );
}

describe("TreeRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.getState().resetRunCurrencies();
  });

  it("renders the scene SVG", () => {
    const { container } = renderTreeRoute();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders InspiReadout with stage name", () => {
    renderTreeRoute();
    expect(screen.getByText(/Stage · Tiny Sprout/i)).toBeInTheDocument();
  });

  it("renders 6 stage chips in the right rail", () => {
    renderTreeRoute();
    expect(screen.getAllByTestId(/stage-chip-/)).toHaveLength(6);
  });

  it("renders upgrade rows for the current tier and the next one", () => {
    renderTreeRoute();
    // At currentStage=0 (Tiny Sprout): stage 0 part (cotyledon) visible.
    expect(screen.getByTestId("upgrade-buy-cotyledon")).toBeInTheDocument();
    // Stage 1 (next tier) is also previewed.
    expect(screen.getByTestId("upgrade-buy-tendril")).toBeInTheDocument();
  });

  it("buy button is disabled when player has 0 gold", () => {
    renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-cotyledon")).toBeDisabled();
  });

  it("buy button is enabled when player has enough gold", () => {
    useGameStore.setState({ gold: big(1000) });
    renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-cotyledon")).not.toBeDisabled();
  });
});
