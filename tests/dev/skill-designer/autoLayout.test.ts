import { describe, it, expect } from "vitest";
import { computeAutoLayout, FAME_HUB_X, FAME_HUB_Y, ROOT_Y, LEVEL_HEIGHT } from "@/dev/skill-designer/autoLayout";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, parentId: string | null = null, position: { x: number; y: number } | null = null): DesignNode {
  return {
    id,
    name: id,
    description: "",
    numericEffect: "",
    parentId,
    maxLevel: 1,
    costs: [1],
    position,
  };
}

describe("computeAutoLayout", () => {
  it("returns empty record for empty design", () => {
    expect(computeAutoLayout([])).toEqual({});
  });

  it("places a single root at center, on ROOT_Y", () => {
    const positions = computeAutoLayout([n("a")]);
    expect(positions.a).toBeDefined();
    expect(positions.a!.x).toBe(300);
    expect(positions.a!.y).toBe(ROOT_Y);
  });

  it("places multiple roots evenly across the canvas", () => {
    const positions = computeAutoLayout([n("a"), n("b"), n("c")]);
    expect(positions.a!.y).toBe(ROOT_Y);
    expect(positions.b!.y).toBe(ROOT_Y);
    expect(positions.c!.y).toBe(ROOT_Y);
    expect(positions.a!.x).toBeLessThan(positions.b!.x);
    expect(positions.b!.x).toBeLessThan(positions.c!.x);
  });

  it("places a child above its parent (lower Y)", () => {
    const positions = computeAutoLayout([n("a"), n("b", "a")]);
    expect(positions.b!.y).toBe(ROOT_Y - LEVEL_HEIGHT);
  });

  it("places multi-level chain with each level above the previous", () => {
    const positions = computeAutoLayout([n("a"), n("b", "a"), n("c", "b")]);
    expect(positions.a!.y).toBe(ROOT_Y);
    expect(positions.b!.y).toBe(ROOT_Y - LEVEL_HEIGHT);
    expect(positions.c!.y).toBe(ROOT_Y - 2 * LEVEL_HEIGHT);
  });

  it("honors manually-set positions; does NOT overwrite them", () => {
    const positions = computeAutoLayout([n("a", null, { x: 50, y: 50 })]);
    expect(positions.a).toEqual({ x: 50, y: 50 });
  });

  it("places auto-laid-out children relative to a manually-positioned parent", () => {
    const positions = computeAutoLayout([n("a", null, { x: 100, y: 200 }), n("b", "a")]);
    expect(positions.a).toEqual({ x: 100, y: 200 });
    expect(positions.b!.y).toBe(200 - LEVEL_HEIGHT);
  });

  it("exports FAME_HUB_X = 300 and FAME_HUB_Y = 510 (constants for canvas use)", () => {
    expect(FAME_HUB_X).toBe(300);
    expect(FAME_HUB_Y).toBe(510);
  });
});
