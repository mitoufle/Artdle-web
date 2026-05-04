import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeListRail } from "@/dev/skill-designer/NodeListRail";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, name = id, maxLevel = 1): DesignNode {
  return {
    id,
    name,
    description: "",
    numericEffect: "",
    parentId: null,
    maxLevel,
    costs: Array(maxLevel).fill(1),
    position: null,
  };
}

describe("<NodeListRail />", () => {
  it("renders the Add Node button", () => {
    render(<NodeListRail nodes={[]} selectedId={null} onSelect={() => {}} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /add node/i })).toBeInTheDocument();
  });

  it("clicking Add Node calls onAdd", () => {
    const onAdd = vi.fn();
    render(<NodeListRail nodes={[]} selectedId={null} onSelect={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /add node/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("renders one row per node, showing name + level pill", () => {
    render(<NodeListRail nodes={[n("a", "Alpha", 1), n("b", "Beta", 3)]} selectedId={null} onSelect={() => {}} onAdd={() => {}} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText(/1 lvl/i)).toBeInTheDocument();
    expect(screen.getByText(/3 lvls/i)).toBeInTheDocument();
  });

  it("clicking a row calls onSelect with that node's id", () => {
    const onSelect = vi.fn();
    render(<NodeListRail nodes={[n("a", "Alpha")]} selectedId={null} onSelect={onSelect} onAdd={() => {}} />);
    fireEvent.click(screen.getByText("Alpha"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("the selected row has data-selected='true'", () => {
    render(<NodeListRail nodes={[n("a", "Alpha")]} selectedId="a" onSelect={() => {}} onAdd={() => {}} />);
    const row = screen.getByText("Alpha").closest("[data-testid^='node-row-']");
    expect(row).toHaveAttribute("data-selected", "true");
  });

  it("typing in search filters the list (case-insensitive substring)", () => {
    render(<NodeListRail nodes={[n("a", "Alpha"), n("b", "Beta")]} selectedId={null} onSelect={() => {}} onAdd={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "be" } });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});
