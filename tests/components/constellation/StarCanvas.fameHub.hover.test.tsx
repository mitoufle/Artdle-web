import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";
import { DEFAULT_VIEWPORT } from "@/components/constellation/viewport";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function makeStates(): Record<string, NodeState> {
  const ids = [
    "get_inspired", "black_white", "magenta", "cyan", "yellow", "red",
    "green", "blue", "purple", "brown", "orange", "rainbow",
    "poke_tree", "basic_technique", "muscle_memory", "gear_up", "Bargain",
  ];
  const out: Record<string, NodeState> = {};
  for (const id of ids) {
    out[id] = { level: 0, maxLevel: 1, available: false, affordable: false };
  }
  return out;
}

function renderCanvas() {
  return render(
    <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} viewport={DEFAULT_VIEWPORT} onViewportChange={() => {}} />,
  );
}

describe("StarCanvas FAME hub hover", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
      fame: big(0), ascendCount: 0, pastRuns: [],
    });
  });

  it("hover on FAME hub pushes title 'FAME' and body with current fame, lifetime, and ascends", () => {
    useGameStore.setState({
      fame: big(7),
      ascendCount: 2,
      pastRuns: [
        { fame: 3, ascendedAt: 1 },
        { fame: 5, ascendedAt: 2 },
      ],
    });
    renderCanvas();
    fireEvent.mouseEnter(screen.getByTestId("fame-hub"));
    expect(useGameStore.getState().hoverTitle).toBe("FAME");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/To spend: 7/);
    expect(container.textContent).toMatch(/Lifetime earned: 15/); // 7 + 3 + 5
    expect(container.textContent).toMatch(/Ascends: 2/);
    expect(String(useGameStore.getState().hoverFooter)).toMatch(/Permanent currency/);
  });

  it("Mouse leave clears hoverTitle", () => {
    renderCanvas();
    fireEvent.mouseEnter(screen.getByTestId("fame-hub"));
    fireEvent.mouseLeave(screen.getByTestId("fame-hub"));
    expect(useGameStore.getState().hoverTitle).toBe("");
  });
});
