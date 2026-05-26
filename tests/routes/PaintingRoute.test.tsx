import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";
import { big } from "@/core/bigNumber";

describe("<PaintingRoute> — 4 track cards (post chunk-domain rework)", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...initialCanvasState,
      gold: big(1000),
      purchasedNodes: {},
      equipped: {},
    });
  });

  it("renders all 4 track cards by trackId data-attribute (size removed)", () => {
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    const ids = ["sell_price", "speed", "crit", "combo"];
    for (const id of ids) {
      expect(document.querySelector(`[data-track-id="${id}"]`)).not.toBeNull();
    }
    // Size track is gone — Size was folded into Tier.
    expect(document.querySelector(`[data-track-id="size"]`)).toBeNull();
  });

  it("crit/combo cards render in locked state when their fame node is not purchased", () => {
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    expect(screen.getAllByText(/Locked/i).length).toBe(2);
  });

  it("all cards render unlocked once their fame node is purchased", () => {
    useGameStore.setState({
      purchasedNodes: {
        genius_episode: 1,
        unrelentless: 1,
      },
    });
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    expect(screen.queryAllByText(/Locked/i).length).toBe(0);
  });
});
