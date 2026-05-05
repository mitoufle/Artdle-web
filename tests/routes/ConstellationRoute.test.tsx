import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConstellationRoute } from "@/routes/ConstellationRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderConstellationRoute() {
  return render(
    <MemoryRouter>
      <ConstellationRoute />
    </MemoryRouter>,
  );
}

describe("ConstellationRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.setState({
      fame: big(0),
      purchasedNodes: {},
    });
  });

  it("renders the star canvas SVG", () => {
    const { container } = renderConstellationRoute();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    renderConstellationRoute();
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
  });

  it("renders skill nodes in the canvas", () => {
    renderConstellationRoute();
    expect(screen.getByTestId("node-get_inspired")).toBeInTheDocument();
    expect(screen.getByTestId("node-black_white")).toBeInTheDocument();
  });

  it("renders the right-rail Mini-map and ClusterList", () => {
    renderConstellationRoute();
    expect(screen.getByText(/Mini-map/i)).toBeInTheDocument();
    expect(screen.getByText(/Starters/i)).toBeInTheDocument();
  });

  it("clicking a skill node opens the NodeCard with that node's name", () => {
    renderConstellationRoute();
    fireEvent.click(screen.getByTestId("node-black_white"));
    expect(screen.getByRole("heading", { name: /Black & White/i })).toBeInTheDocument();
  });

  it("clicking Acquire on a selected affordable node calls buyNode", () => {
    useGameStore.setState({ fame: big(1) });
    renderConstellationRoute();
    fireEvent.click(screen.getByTestId("node-black_white"));
    fireEvent.click(screen.getByTestId("node-acquire-black_white"));
    expect(useGameStore.getState().purchasedNodes.black_white).toBe(1);
  });

  it("renders the Fame to spend display in the right rail", () => {
    useGameStore.setState({ fame: big(12) });
    renderConstellationRoute();
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText(/Fame to spend/i)).toBeInTheDocument();
  });
});
