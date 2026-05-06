import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDesignerState } from "@/dev/skill-designer/useDesignerState";

describe("useDesignerState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to the on-disk design JSON when localStorage is empty", () => {
    const { result } = renderHook(() => useDesignerState());
    // Without a draft, the hook reads the JSON baseline (17 designed nodes).
    expect(result.current.design.nodes.length).toBeGreaterThan(0);
    expect(result.current.selectedId).toBeNull();
  });

  it("addNode appends a new node and gives it a unique id (after reset)", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.resetAll());
    act(() => result.current.actions.addNode());
    expect(result.current.design.nodes).toHaveLength(1);
    act(() => result.current.actions.addNode());
    expect(result.current.design.nodes).toHaveLength(2);
    expect(result.current.design.nodes[0]!.id).not.toBe(result.current.design.nodes[1]!.id);
  });

  it("updateNode applies the patch to the matching node", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.resetAll());
    act(() => result.current.actions.addNode());
    const id = result.current.design.nodes[0]!.id;
    act(() => result.current.actions.updateNode(id, { name: "Renamed" }));
    expect(result.current.design.nodes[0]!.name).toBe("Renamed");
  });

  it("deleteNode removes the node and nulls children's parentId (after reset)", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.resetAll());
    act(() => result.current.actions.addNode());
    const aId = result.current.design.nodes[0]!.id;
    act(() => result.current.actions.addNode());
    const bId = result.current.design.nodes[1]!.id;
    act(() => result.current.actions.updateNode(bId, { parentIds: [aId] }));
    act(() => result.current.actions.deleteNode(aId));
    expect(result.current.design.nodes).toHaveLength(1);
    expect(result.current.design.nodes[0]!.id).toBe(bId);
    expect(result.current.design.nodes[0]!.parentIds).toEqual([]);
  });

  it("selectNode sets selectedId", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.selectNode("anything"));
    expect(result.current.selectedId).toBe("anything");
  });

  it("resetAll clears the design and selectedId", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addNode());
    act(() => result.current.actions.selectNode("x"));
    act(() => result.current.actions.resetAll());
    expect(result.current.design.nodes).toEqual([]);
    expect(result.current.selectedId).toBeNull();
  });
});
