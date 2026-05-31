import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ClusterForm } from "@/dev/skill-designer/ClusterForm";
import type { DesignCluster, DesignNode } from "@/dev/skill-designer/types";

const cluster: DesignCluster = { id: "c1", name: "C1", theme: "", rootNodeId: "r", region: { x: 0, y: 0, w: 600, h: 600 } };
function node(id: string, parentIds: string[] = []): DesignNode {
  return { id, name: id, description: "", numericEffect: "", parentIds, stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [], position: null, clusterId: "c1" };
}
const members = [node("r"), node("k", ["r"])];

describe("ClusterForm", () => {
  it("edits name and root, emitting patches", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <ClusterForm cluster={cluster} members={members} onChange={onChange} onDelete={() => {}} />,
    );
    fireEvent.change(getByLabelText(/name/i), { target: { value: "Music" } });
    expect(onChange).toHaveBeenCalledWith("c1", { name: "Music" });
    const root = getByLabelText(/cluster root/i) as HTMLSelectElement;
    expect(root.value).toBe("r");
    fireEvent.change(root, { target: { value: "k" } });
    expect(onChange).toHaveBeenCalledWith("c1", { rootNodeId: "k" });
  });

  it("fires onDelete", () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { getByText } = render(
      <ClusterForm cluster={cluster} members={members} onChange={() => {}} onDelete={onDelete} />,
    );
    fireEvent.click(getByText(/delete cluster/i));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("renders placeholder when no cluster is selected", () => {
    const { getByText } = render(
      <ClusterForm cluster={null} members={[]} onChange={() => {}} onDelete={() => {}} />,
    );
    expect(getByText(/select a cluster/i)).toBeTruthy();
  });
});
