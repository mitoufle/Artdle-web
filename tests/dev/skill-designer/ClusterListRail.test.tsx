import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ClusterListRail } from "@/dev/skill-designer/ClusterListRail";

const clusters = [
  { id: "inspiration", name: "Inspiration", theme: "", rootNodeId: "get_inspired", region: { x: 0, y: 0, w: 600, h: 600 } },
  { id: "colors", name: "Colors", theme: "", rootNodeId: "black_white", region: { x: 0, y: 0, w: 600, h: 600 } },
];

describe("ClusterListRail", () => {
  it("lists clusters and fires onAdd", () => {
    const onAdd = vi.fn();
    const { getByText, getByTestId } = render(
      <ClusterListRail clusters={clusters} selectedClusterId={null} onSelect={() => {}} onAdd={onAdd} />,
    );
    expect(getByText("Inspiration")).toBeTruthy();
    fireEvent.click(getByTestId("add-cluster"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("fires onSelect with the cluster id and marks the selected row", () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <ClusterListRail clusters={clusters} selectedClusterId="colors" onSelect={onSelect} onAdd={() => {}} />,
    );
    fireEvent.click(getByTestId("cluster-list-row-inspiration"));
    expect(onSelect).toHaveBeenCalledWith("inspiration");
    expect(getByTestId("cluster-list-row-colors").getAttribute("data-selected")).toBe("true");
  });
});
