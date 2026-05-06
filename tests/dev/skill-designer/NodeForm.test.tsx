import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeForm } from "@/dev/skill-designer/NodeForm";
import type { DesignNode } from "@/dev/skill-designer/types";

const baseNode: DesignNode = {
  id: "test_node",
  name: "Test Node",
  description: "Test description",
  numericEffect: "+10%",
  parentIds: [],
  stacking: "additive",
  kind: "minor",
  maxLevel: 2,
  costs: [10, 25],
  position: null,
};

const otherNode: DesignNode = {
  id: "other",
  name: "Other",
  description: "",
  numericEffect: "",
  parentIds: [],
  stacking: "additive",
  kind: "minor",
  maxLevel: 1,
  costs: [1],
  position: null,
};

describe("<NodeForm />", () => {
  it("shows placeholder when no node is selected", () => {
    render(<NodeForm node={null} allNodes={[]} onChange={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it("renders the selected node's name in a text input", () => {
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={() => {}} onDelete={() => {}} />);
    const input = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(input.value).toBe("Test Node");
  });

  it("renders one cost input per level", () => {
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={() => {}} onDelete={() => {}} />);
    expect(screen.getByLabelText(/Lvl 1 cost/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lvl 2 cost/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Lvl 3 cost/i)).not.toBeInTheDocument();
  });

  it("changing the name calls onChange with the patch", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={onChange} onDelete={() => {}} />);
    const input = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed" } });
    expect(onChange).toHaveBeenCalledWith("test_node", { name: "Renamed" });
  });

  it("changing maxLevel calls onChange with new costs array (zero-padded if extending)", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={onChange} onDelete={() => {}} />);
    const input = screen.getByLabelText(/max level/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith("test_node", { maxLevel: 3, costs: [10, 25, 0] });
  });

  it("toggling a parent checkbox calls onChange with new parentIds", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode, otherNode]} onChange={onChange} onDelete={() => {}} />);
    const checkbox = screen.getByRole("checkbox", { name: /Other/i });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("test_node", { parentIds: ["other"] });
  });

  it("toggling stacking radio to multiplicative calls onChange", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={onChange} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /multiplicative/i }));
    expect(onChange).toHaveBeenCalledWith("test_node", { stacking: "multiplicative" });
  });

  it("toggling kind radio to major calls onChange", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={onChange} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /^major/i }));
    expect(onChange).toHaveBeenCalledWith("test_node", { kind: "major" });
  });

  it("clicking Delete calls onDelete with the node id", () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("test_node");
    confirmSpy.mockRestore();
  });

  it("clicking 'Reset position' calls onChange with position: null", () => {
    const onChange = vi.fn();
    const positioned: DesignNode = { ...baseNode, position: { x: 100, y: 100 } };
    render(<NodeForm node={positioned} allNodes={[positioned]} onChange={onChange} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /reset position/i }));
    expect(onChange).toHaveBeenCalledWith("test_node", { position: null });
  });
});
