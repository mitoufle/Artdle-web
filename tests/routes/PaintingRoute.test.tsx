import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";
import { big } from "@/core/bigNumber";

describe("<PaintingRoute> — 5 track cards", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...initialCanvasState,
      gold: big(1000),
      purchasedNodes: {},
      equipped: {},
      paintMastery: big(0),
    });
  });

  it("renders all 5 track cards by trackId data-attribute", () => {
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    const ids = ["sell_price", "speed", "size", "crit", "combo"];
    for (const id of ids) {
      expect(document.querySelector(`[data-track-id="${id}"]`)).not.toBeNull();
    }
  });

  it("size/crit/combo cards render in locked state when their fame node is not purchased", () => {
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    expect(screen.getAllByText(/Locked/i).length).toBe(3);
  });

  it("all cards render unlocked once their fame node is purchased", () => {
    useGameStore.setState({
      purchasedNodes: {
        unlock_canvas_size: 1,
        unlock_canvas_crit: 1,
        unlock_canvas_combo: 1,
      },
    });
    render(<MemoryRouter><PaintingRoute /></MemoryRouter>);
    expect(screen.queryAllByText(/Locked/i).length).toBe(0);
  });
});
