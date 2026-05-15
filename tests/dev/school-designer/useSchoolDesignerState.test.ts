import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSchoolDesignerState } from "@/dev/school-designer/useSchoolDesignerState";
import { EMPTY_DESIGN } from "@/dev/school-designer/types";

describe("useSchoolDesignerState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to file baseline when localStorage is empty", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    expect(result.current.design.length).toBeGreaterThan(0);
    expect(result.current.design[0]?.tier).toBe(1);
  });

  it("addTier appends a new tier with the next tier number", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    expect(result.current.design).toHaveLength(1);
    expect(result.current.design[0]?.tier).toBe(1);
    act(() => result.current.actions.addTier());
    expect(result.current.design).toHaveLength(2);
    expect(result.current.design[1]?.tier).toBe(2);
  });

  it("deleteTier removes the tier and renumbers remaining tiers", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier()); // tier 1
    act(() => result.current.actions.addTier()); // tier 2
    act(() => result.current.actions.addTier()); // tier 3
    act(() => result.current.actions.deleteTier(2));
    expect(result.current.design).toHaveLength(2);
    expect(result.current.design[0]?.tier).toBe(1);
    expect(result.current.design[1]?.tier).toBe(2); // was tier 3, renumbered
  });

  it("updateTier applies patch to the matching tier", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.updateTier(1, { label: "Maître" }));
    expect(result.current.design[0]?.label).toBe("Maître");
  });

  it("addResearch adds a research to the specified tier", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.addResearch(1));
    expect(result.current.design[0]?.researches).toHaveLength(1);
  });

  it("updateResearch patches the matching research", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.addResearch(1));
    const researchId = result.current.design[0]!.researches[0]!.id;
    act(() => result.current.actions.updateResearch(1, researchId, { name: "Renamed" }));
    expect(result.current.design[0]?.researches[0]?.name).toBe("Renamed");
  });

  it("deleteResearch removes the matching research", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.addResearch(1));
    act(() => result.current.actions.addResearch(1));
    const researchId = result.current.design[0]!.researches[0]!.id;
    act(() => result.current.actions.deleteResearch(1, researchId));
    expect(result.current.design[0]?.researches).toHaveLength(1);
  });

  it("resetAll reloads the file baseline", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.resetAll());
    expect(result.current.design.length).toBeGreaterThan(0);
  });
});
