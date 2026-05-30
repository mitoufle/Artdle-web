import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DesignerCanvas } from "@/dev/skill-designer/DesignerCanvas";
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

describe("<DesignerCanvas />", () => {
  it("renders an SVG", () => {
    const { container } = render(
      <DesignerCanvas nodes={[]} selectedId={null} onSelect={() => {}} onMove={() => {}} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    render(<DesignerCanvas nodes={[]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
  });

  it("renders one node circle per design node", () => {
    render(<DesignerCanvas nodes={[n("a"), n("b")]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("designer-node-a")).toBeInTheDocument();
    expect(screen.getByTestId("designer-node-b")).toBeInTheDocument();
  });

  it("renders edges from parent to child (and from FAME to roots)", () => {
    render(<DesignerCanvas nodes={[n("a"), n("b", "a")]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("designer-edge-fame-a")).toBeInTheDocument();
    expect(screen.getByTestId("designer-edge-a-b")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with its id", () => {
    const onSelect = vi.fn();
    render(<DesignerCanvas nodes={[n("a")]} selectedId={null} onSelect={onSelect} onMove={() => {}} />);
    fireEvent.click(screen.getByTestId("designer-node-a"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("selected node has data-selected='true'", () => {
    render(<DesignerCanvas nodes={[n("a")]} selectedId="a" onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("designer-node-a")).toHaveAttribute("data-selected", "true");
  });

  it("renders node label (name) near each node", () => {
    render(<DesignerCanvas nodes={[n("a")]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByText("a")).toBeInTheDocument();
  });
});
