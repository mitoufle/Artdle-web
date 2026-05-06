import { describe, it, expect } from "vitest";
import { validateDesign } from "@/dev/skill-designer/validation";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, parentId: string | null = null, maxLevel = 1, costs: number[] = [1]): DesignNode {
  return {
    id,
    name: id,
    description: "",
    numericEffect: "",
    parentIds: parentId === null ? [] : [parentId],
    stacking: "additive",
    kind: "minor",
    maxLevel,
    costs,
    position: null,
  };
}

describe("validateDesign", () => {
  it("returns no issues for an empty design", () => {
    expect(validateDesign([])).toEqual([]);
  });

  it("returns no issues for a valid linear chain", () => {
    const issues = validateDesign([n("a"), n("b", "a"), n("c", "b")]);
    expect(issues).toEqual([]);
  });

  it("flags duplicate ids", () => {
    const issues = validateDesign([n("a"), n("a")]);
    expect(issues.some((i) => i.type === "duplicate_id" && i.nodeId === "a")).toBe(true);
  });

  it("flags missing parents", () => {
    const issues = validateDesign([n("a", "ghost")]);
    expect(issues.some((i) => i.type === "missing_parent" && i.nodeId === "a")).toBe(true);
  });

  it("flags simple cycles (a->b->a)", () => {
    const issues = validateDesign([n("a", "b"), n("b", "a")]);
    expect(issues.some((i) => i.type === "cycle")).toBe(true);
  });

  it("flags self-cycles (a->a)", () => {
    const issues = validateDesign([n("a", "a")]);
    expect(issues.some((i) => i.type === "cycle" && i.nodeId === "a")).toBe(true);
  });

  it("flags orphans (root with no children)", () => {
    const issues = validateDesign([n("a"), n("b", "a")]);
    expect(issues.some((i) => i.type === "orphan")).toBe(false);

    const issues2 = validateDesign([n("solo")]);
    expect(issues2.some((i) => i.type === "orphan" && i.nodeId === "solo")).toBe(true);
  });

  it("flags costs.length != maxLevel", () => {
    const issues = validateDesign([n("a", null, 3, [1, 2])]);
    expect(issues.some((i) => i.type === "costs_length_mismatch" && i.nodeId === "a")).toBe(true);
  });
});
