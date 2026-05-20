import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAchievementDesignerState } from "@/dev/achievement-designer/useAchievementDesignerState";
import type { DesignAchievement, DesignFile } from "@/dev/achievement-designer/types";

function ach(id: string, category: DesignAchievement["category"] = "canvas"): DesignAchievement {
  return {
    id,
    _stableKey: id,
    name: id,
    description: "",
    icon: "",
    category,
    condition: { stat: "x", op: ">=", value: 0 },
    effects: [],
  };
}

describe("useAchievementDesignerState — moveAchievement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setup(design: DesignFile) {
    const hook = renderHook(() => useAchievementDesignerState());
    act(() => hook.result.current.actions.importDesign(design));
    return hook;
  }

  it("moves an achievement to a later index", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c"), ach("d")]);
    act(() => result.current.actions.moveAchievement("a", 2));
    expect(result.current.design.map((a) => a.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an achievement to an earlier index", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c"), ach("d")]);
    act(() => result.current.actions.moveAchievement("d", 1));
    expect(result.current.design.map((a) => a.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op when moving to the same index", () => {
    const before: DesignFile = [ach("a"), ach("b"), ach("c")];
    const { result } = setup(before);
    act(() => result.current.actions.moveAchievement("b", 1));
    expect(result.current.design.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("is a no-op when the id is unknown", () => {
    const { result } = setup([ach("a"), ach("b")]);
    act(() => result.current.actions.moveAchievement("ghost", 0));
    expect(result.current.design.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("clamps toIndex below 0 to 0", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c")]);
    act(() => result.current.actions.moveAchievement("c", -5));
    expect(result.current.design.map((a) => a.id)).toEqual(["c", "a", "b"]);
  });

  it("clamps toIndex >= length to the last index", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c")]);
    act(() => result.current.actions.moveAchievement("a", 99));
    expect(result.current.design.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });

  it("addAchievement assigns a non-empty _stableKey", () => {
    const hook = renderHook(() => useAchievementDesignerState());
    act(() => hook.result.current.actions.importDesign([]));
    act(() => hook.result.current.actions.addAchievement());
    const added = hook.result.current.design[0];
    expect(added).toBeDefined();
    expect(typeof added!._stableKey).toBe("string");
    expect(added!._stableKey.length).toBeGreaterThan(0);
  });
});
