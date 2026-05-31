import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DesignerCanvas } from "@/dev/skill-designer/DesignerCanvas";
import { snapToGrid } from "@/dev/skill-designer/gridSnap";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, parentId: string | null = null, position: { x: number; y: number } | null = null): DesignNode {
  return {
    id,
    name: id,
    description: "",
    numericEffect: "",
    parentIds: parentId === null ? [] : [parentId],
    stacking: "additive",
    kind: "minor",
    maxLevel: 1,
    costs: [1],
    unlocks: [],
    position,
    clusterId: "inspiration",
  };
}

const clusters = [{ id: "inspiration", name: "Inspiration", theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 600, h: 600 } }];

describe("<DesignerCanvas />", () => {
  it("renders an SVG", () => {
    const { container } = render(
      <DesignerCanvas nodes={[]} clusters={clusters} selectedId={null} onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders no fame hub and no fame-sourced edges", () => {
    const { queryByTestId, container } = render(
      <DesignerCanvas nodes={[n("a"), n("b", "a")]} clusters={clusters} selectedId={null} onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />,
    );
    expect(queryByTestId("fame-hub")).toBeNull();
    expect(container.querySelector('[data-testid^="designer-edge-fame-"]')).toBeNull();
  });

  it("renders one node circle per design node", () => {
    render(<DesignerCanvas nodes={[n("a"), n("b")]} clusters={clusters} selectedId={null} onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />);
    expect(screen.getByTestId("designer-node-a")).toBeInTheDocument();
    expect(screen.getByTestId("designer-node-b")).toBeInTheDocument();
  });

  it("renders edge from parent to child (no fame edges for roots)", () => {
    render(<DesignerCanvas nodes={[n("a"), n("b", "a")]} clusters={clusters} selectedId={null} onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />);
    expect(screen.queryByTestId("designer-edge-fame-a")).toBeNull();
    expect(screen.getByTestId("designer-edge-a-b")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with its id", () => {
    const onSelect = vi.fn();
    render(<DesignerCanvas nodes={[n("a")]} clusters={clusters} selectedId={null} onSelect={onSelect} onMove={() => {}} onToggleLink={() => {}} />);
    fireEvent.click(screen.getByTestId("designer-node-a"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("ctrl+clicking another node while one is active calls onToggleLink with the clicked id", () => {
    const onSelect = vi.fn();
    const onToggleLink = vi.fn();
    render(<DesignerCanvas nodes={[n("a"), n("b")]} clusters={clusters} selectedId="a" onSelect={onSelect} onMove={() => {}} onToggleLink={onToggleLink} />);
    fireEvent.click(screen.getByTestId("designer-node-b"), { ctrlKey: true });
    expect(onToggleLink).toHaveBeenCalledWith("b");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ctrl+clicking with no active node falls back to selecting", () => {
    const onSelect = vi.fn();
    const onToggleLink = vi.fn();
    render(<DesignerCanvas nodes={[n("a")]} clusters={clusters} selectedId={null} onSelect={onSelect} onMove={() => {}} onToggleLink={onToggleLink} />);
    fireEvent.click(screen.getByTestId("designer-node-a"), { ctrlKey: true });
    expect(onToggleLink).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("ctrl+clicking the already-active node does not toggle (no self-link)", () => {
    const onToggleLink = vi.fn();
    render(<DesignerCanvas nodes={[n("a")]} clusters={clusters} selectedId="a" onSelect={() => {}} onMove={() => {}} onToggleLink={onToggleLink} />);
    fireEvent.click(screen.getByTestId("designer-node-a"), { ctrlKey: true });
    expect(onToggleLink).not.toHaveBeenCalled();
  });

  it("selected node has data-selected='true'", () => {
    render(<DesignerCanvas nodes={[n("a")]} clusters={clusters} selectedId="a" onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />);
    expect(screen.getByTestId("designer-node-a")).toHaveAttribute("data-selected", "true");
  });

  it("renders node label (name) near each node", () => {
    render(<DesignerCanvas nodes={[n("a")]} clusters={clusters} selectedId={null} onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />);
    expect(screen.getByText("a")).toBeInTheDocument();
  });

  it("shows a grid by default and toggles it off", () => {
    const { container } = render(<DesignerCanvas nodes={[n("a")]} clusters={clusters} selectedId={null} onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />);
    expect(container.querySelector("pattern")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /grid/i }));
    expect(container.querySelector("pattern")).toBeNull();
  });

  it("exposes a grid-size input while the grid is on", () => {
    render(<DesignerCanvas nodes={[n("a")]} clusters={clusters} selectedId={null} onSelect={() => {}} onMove={() => {}} onToggleLink={() => {}} />);
    expect(screen.getByLabelText(/size/i)).toBeInTheDocument();
  });
});

describe("snapToGrid", () => {
  it("rounds to the nearest multiple of the grid size", () => {
    expect(snapToGrid(52, 50)).toBe(50);
    expect(snapToGrid(76, 50)).toBe(100);
    expect(snapToGrid(74, 50)).toBe(50);
    expect(snapToGrid(0, 50)).toBe(0);
  });

  it("handles negative coordinates symmetrically", () => {
    expect(snapToGrid(-30, 50)).toBe(-50);
    expect(snapToGrid(-12, 50)).toBe(-0);
  });

  it("returns the value unchanged for a non-positive grid size", () => {
    expect(snapToGrid(37, 0)).toBe(37);
    expect(snapToGrid(37, -10)).toBe(37);
  });
});
