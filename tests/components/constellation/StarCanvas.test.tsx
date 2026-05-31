import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";
import { DEFAULT_VIEWPORT } from "@/components/constellation/viewport";

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
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders no fame hub", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />);
    expect(screen.queryByTestId("fame-hub")).toBeNull();
  });

  it("renders no cluster-art layer while no asset/cluster is complete", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />);
    expect(document.querySelectorAll('[data-testid^="cluster-art-"]').length).toBe(0);
  });

  it("renders nodes from the designer JSON (e.g. get_inspired, rainbow)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />);
    expect(screen.getByTestId("node-get_inspired")).toBeInTheDocument();
    expect(screen.getByTestId("node-rainbow")).toBeInTheDocument();
  });

  it("renders a multi-parent node's edges from each parent (rainbow has parents orange, brown, purple)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />);
    expect(screen.getByTestId("edge-orange-rainbow")).toBeInTheDocument();
    expect(screen.getByTestId("edge-brown-rainbow")).toBeInTheDocument();
    expect(screen.getByTestId("edge-purple-rainbow")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with that id", () => {
    const onSelect = vi.fn();
    render(<StarCanvas selectedId={null} onSelect={onSelect} nodeStates={makeStates()} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />);
    fireEvent.click(screen.getByTestId("node-get_inspired"));
    expect(onSelect).toHaveBeenCalledWith("get_inspired");
  });

  it("data-state reflects level: owned (0<level<max), maxed (level=max), locked, available", () => {
    const states = makeStates({
      get_inspired: { level: 0, maxLevel: 5, available: true, affordable: true },
      poke_tree: { level: 3, maxLevel: 5, available: true, affordable: true },
      gear_up: { level: 1, maxLevel: 1, available: true, affordable: false },
    });
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />);
    expect(screen.getByTestId("node-get_inspired")).toHaveAttribute("data-state", "available");
    expect(screen.getByTestId("node-poke_tree")).toHaveAttribute("data-state", "owned");
    expect(screen.getByTestId("node-gear_up")).toHaveAttribute("data-state", "maxed");
  });

  it("multi-level nodes show a level badge when level > 0", () => {
    const states = makeStates({
      poke_tree: { level: 3, maxLevel: 5, available: true, affordable: true },
    });
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} completedClusterIds={new Set()} />);
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
  });
});
