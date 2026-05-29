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

  it("renders 2 stage chips (current + next) in the right rail", () => {
    renderTreeRoute();
    expect(screen.getAllByTestId(/stage-chip-/)).toHaveLength(2);
  });

  it("renders upgrade rows only for currently unlocked stages (0..currentStage)", () => {
    renderTreeRoute();
    // At currentStage=0: stage 0 part (u1 = Cotyledon) visible.
    expect(screen.getByTestId("upgrade-buy-u1")).toBeInTheDocument();
    // Stage 1 is locked — its parts must NOT appear in the upgrade list.
    expect(screen.queryByTestId("upgrade-buy-u2")).not.toBeInTheDocument();
  });

  it("keeps previous-stage parts visible after advancing to stage 1", () => {
    useGameStore.setState({ currentStage: 1 });
    renderTreeRoute();
    // Stage 0 part (u1 = Cotyledon) must still be upgradeable.
    expect(screen.getByTestId("upgrade-buy-u1")).toBeInTheDocument();
    // Stage 1 parts are now unlocked.
    expect(screen.getByTestId("upgrade-buy-u2")).toBeInTheDocument();
    // Stage 2 is still locked — must not appear.
    expect(screen.queryByTestId("upgrade-buy-u3")).not.toBeInTheDocument();
  });

  it("buy button is disabled when player has 0 gold", () => {
    renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-u1")).toBeDisabled();
  });

  it("buy button is enabled when player has enough gold", () => {
    useGameStore.setState({ gold: big(1000) });
    renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-u1")).not.toBeDisabled();
  });

  it("Bargain discount: lowers displayed cost AND enables a buy that would otherwise be unaffordable", () => {
    // u1 (Cotyledon) raw cost = 10g (treeStages.ts). Bargain L5 = -25%, so discounted = 7.5g.
    // With gold=8 and no Bargain → can't afford; with Bargain L5 → can afford and the
    // displayed price drops to 7-8 (formatBig rounds).
    useGameStore.setState({ gold: big(8) });
    const { unmount } = renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-u1")).toBeDisabled();
    unmount();

    useGameStore.setState({ gold: big(8), purchasedNodes: { Bargain: 5 } });
    renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-u1")).not.toBeDisabled();
  });
});
