import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderAscensionRoute() {
  return render(
    <MemoryRouter>
      <AscensionRoute />
    </MemoryRouter>,
  );
}

describe("AscensionRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.setState({
      ascendCount: 0,
      fame: big(0),
      pastRuns: [],
      purchasedNodes: {},
    });
  });

  it("renders the cavern with crystals", () => {
    renderAscensionRoute();
    expect(screen.getByTestId("crystal-0")).toBeInTheDocument();
  });

  it("renders the portal SVG", () => {
    const { container } = renderAscensionRoute();
    expect(container.querySelector('[data-testid="portal-keystone"]')).toBeInTheDocument();
  });

  it("renders the right-rail panels (threshold + fame preview + past runs)", () => {
    renderAscensionRoute();
    expect(screen.getByText(/Current inspiration/i)).toBeInTheDocument();
    expect(screen.getByText(/If you ascend now/i)).toBeInTheDocument();
    expect(screen.getByText(/Past ascensions/i)).toBeInTheDocument();
  });

  it("Step Through button is disabled below palier", () => {
    useGameStore.setState({ inspiration: big(0) });
    renderAscensionRoute();
    expect(screen.getByRole("button", { name: /step through/i })).toBeDisabled();
  });

  it("Step Through button is enabled at-or-above palier", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    expect(screen.getByRole("button", { name: /step through/i })).not.toBeDisabled();
  });

  it("clicking Step Through shows the confirmation modal", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("confirmation Cancel button closes the modal without ascending", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useGameStore.getState().ascendCount).toBe(0);
  });

  it("confirmation Ascend button performs the ascend", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend\s+\+/i }));
    expect(useGameStore.getState().ascendCount).toBe(1);
  });

  it("ledger reflects past ascends after performing one", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend\s+\+/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/No past ascends/i)).not.toBeInTheDocument();
  });
});
