import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";

function makeStates(overrides: Record<string, Partial<NodeState>> = {}): Record<string, NodeState> {
  const ids = ["get_inspired", "black_white", "magenta", "cyan", "yellow", "red", "green", "blue", "purple", "brown", "orange", "rainbow", "poke_tree", "basic_technique", "muscle_memory", "gear_up", "Bargain"];
  const out: Record<string, NodeState> = {};
  for (const id of ids) {
    out[id] = {
      level: 0,
      maxLevel: 1,
      available: false,
      affordable: false,
      ...(overrides[id] ?? {}),
    };
  }
  return out;
}

describe("<StarCanvas /> (designer-driven)", () => {
  it("renders an SVG", () => {
    const { container } = render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
    expect(screen.getByText("FAME")).toBeInTheDocument();
  });

  it("renders nodes from the designer JSON (e.g. get_inspired, rainbow)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("node-get_inspired")).toBeInTheDocument();
    expect(screen.getByTestId("node-rainbow")).toBeInTheDocument();
  });

  it("renders an edge from FAME to root nodes (e.g. get_inspired)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("edge-fame-get_inspired")).toBeInTheDocument();
  });

  it("renders a multi-parent node's edges from each parent (red has parents magenta, yellow)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("edge-magenta-red")).toBeInTheDocument();
    expect(screen.getByTestId("edge-yellow-red")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with that id", () => {
    const onSelect = vi.fn();
    render(<StarCanvas selectedId={null} onSelect={onSelect} nodeStates={makeStates()} />);
    fireEvent.click(screen.getByTestId("node-get_inspired"));
    expect(onSelect).toHaveBeenCalledWith("get_inspired");
  });

  it("data-state reflects level: owned (0<level<max), maxed (level=max), locked, available", () => {
    const states = makeStates({
      get_inspired: { level: 0, maxLevel: 5, available: true, affordable: true },
      poke_tree: { level: 3, maxLevel: 5, available: true, affordable: true },
      gear_up: { level: 1, maxLevel: 1, available: true, affordable: false },
    });
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} />);
    expect(screen.getByTestId("node-get_inspired")).toHaveAttribute("data-state", "available");
    expect(screen.getByTestId("node-poke_tree")).toHaveAttribute("data-state", "owned");
    expect(screen.getByTestId("node-gear_up")).toHaveAttribute("data-state", "maxed");
  });

  it("multi-level nodes show a level badge when level > 0", () => {
    const states = makeStates({
      poke_tree: { level: 3, maxLevel: 5, available: true, affordable: true },
    });
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} />);
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
  });
});
