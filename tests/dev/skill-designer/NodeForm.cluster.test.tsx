import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { NodeForm } from "@/dev/skill-designer/NodeForm";
import type { DesignNode } from "@/dev/skill-designer/types";

const node: DesignNode = {
  id: "x", name: "X", description: "", numericEffect: "",
  parentIds: [], stacking: "additive", kind: "minor",
  maxLevel: 1, costs: [0], unlocks: [], position: null, clusterId: "colors",
};

const clusters = [
  { id: "colors", name: "Colors", theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 1, h: 1 } },
  { id: "workshop", name: "Workshop", theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 1, h: 1 } },
];

describe("NodeForm cluster picker", () => {
  it("shows the current clusterId and emits a patch on change", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <NodeForm node={node} allNodes={[node]} clusters={clusters} onChange={onChange} onDelete={() => {}} />,
    );
    const select = getByLabelText(/cluster/i) as HTMLSelectElement;
    expect(select.value).toBe("colors");
    fireEvent.change(select, { target: { value: "workshop" } });
    expect(onChange).toHaveBeenCalledWith("x", { clusterId: "workshop" });
  });
});
