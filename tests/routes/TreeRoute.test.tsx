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

  it("renders upgrade rows for the parts visible at the current stage", () => {
    renderTreeRoute();
    // At currentStage=0 (Tiny Sprout), 1 part visible: cotyledon.
    expect(screen.getByTestId("upgrade-buy-cotyledon")).toBeInTheDocument();
    // stage 1 part tendril is not yet visible (locked)
    expect(screen.queryByTestId("upgrade-buy-tendril")).not.toBeInTheDocument();
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
