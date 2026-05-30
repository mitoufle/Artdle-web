import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDesignerState } from "@/dev/skill-designer/useDesignerState";

beforeEach(() => localStorage.clear());

describe("cluster CRUD", () => {
  it("addCluster creates a unique id, a non-overlapping region, and selects it", () => {
    const { result } = renderHook(() => useDesignerState());
    const before = result.current.design.clusters.length;
    act(() => result.current.actions.addCluster());
    const after = result.current.design.clusters;
    expect(after.length).toBe(before + 1);
    const created = after[after.length - 1]!;
    expect(after.filter((c) => c.id === created.id).length).toBe(1);
    expect(result.current.selectedClusterId).toBe(created.id);
  });

  it("updateCluster patches fields", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addCluster());
    const id = result.current.selectedClusterId!;
    act(() => result.current.actions.updateCluster(id, { name: "Music", rootNodeId: "x" }));
    const c = result.current.design.clusters.find((c) => c.id === id)!;
    expect(c.name).toBe("Music");
    expect(c.rootNodeId).toBe("x");
  });

  it("deleteCluster removes it and reassigns its member nodes to the first remaining cluster", () => {
    const { result } = renderHook(() => useDesignerState());
    const firstId = result.current.design.clusters[0]!.id;
    const fallbackId = result.current.design.clusters[1]!.id;
    act(() => result.current.actions.deleteCluster(firstId));
    expect(result.current.design.clusters.find((c) => c.id === firstId)).toBeUndefined();
    const moved = result.current.design.nodes.filter((n) => n.clusterId === firstId);
    expect(moved.length).toBe(0);
    const inFallback = result.current.design.nodes.some((n) => n.clusterId === fallbackId);
    expect(inFallback).toBe(true);
  });

  it("selecting a node clears cluster selection and vice versa", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addCluster());
    expect(result.current.selectedClusterId).not.toBeNull();
    act(() => result.current.actions.selectNode("get_inspired"));
    expect(result.current.selectedClusterId).toBeNull();
    expect(result.current.selectedId).toBe("get_inspired");
    act(() => result.current.actions.selectCluster(result.current.design.clusters[0]!.id));
    expect(result.current.selectedId).toBeNull();
  });
});
