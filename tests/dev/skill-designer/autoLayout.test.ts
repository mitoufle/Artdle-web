import { describe, it, expect } from "vitest";
import {
  computeAutoLayout,
  FAME_HUB_X,
  FAME_HUB_Y,
  RADIUS_INITIAL,
  RADIUS_STEP,
} from "@/dev/skill-designer/autoLayout";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(
  id: string,
  parentId: string | null = null,
  position: { x: number; y: number } | null = null,
): DesignNode {
  return {
    id,
    name: id,
    description: "",
    numericEffect: "",
    parentIds: parentId === null ? [] : [parentId],
    stacking: "additive",
    maxLevel: 1,
    costs: [1],
    position,
  };
}

function distance(p: { x: number; y: number }, q: { x: number; y: number }): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

const HUB = { x: FAME_HUB_X, y: FAME_HUB_Y };

describe("computeAutoLayout (radial)", () => {
  it("returns empty record for empty design", () => {
    expect(computeAutoLayout([])).toEqual({});
  });

  it("FAME hub is at the center of the canvas (300, 300)", () => {
    expect(FAME_HUB_X).toBe(300);
    expect(FAME_HUB_Y).toBe(300);
  });

  it("places a single root at RADIUS_INITIAL above the hub (-π/2 angle)", () => {
    const positions = computeAutoLayout([n("a")]);
    expect(positions.a!.x).toBeCloseTo(FAME_HUB_X, 5);
    expect(positions.a!.y).toBeCloseTo(FAME_HUB_Y - RADIUS_INITIAL, 5);
  });

  it("multiple roots are equidistant from the hub at RADIUS_INITIAL", () => {
    const positions = computeAutoLayout([n("a"), n("b"), n("c")]);
    expect(distance(positions.a!, HUB)).toBeCloseTo(RADIUS_INITIAL, 5);
    expect(distance(positions.b!, HUB)).toBeCloseTo(RADIUS_INITIAL, 5);
    expect(distance(positions.c!, HUB)).toBeCloseTo(RADIUS_INITIAL, 5);
  });

  it("a child sits at parent radius + RADIUS_STEP from the hub", () => {
    const positions = computeAutoLayout([n("a"), n("b", "a")]);
    expect(distance(positions.b!, HUB)).toBeCloseTo(RADIUS_INITIAL + RADIUS_STEP, 5);
  });

  it("multi-level chain: each level sits one RADIUS_STEP further from the hub", () => {
    const positions = computeAutoLayout([n("a"), n("b", "a"), n("c", "b")]);
    expect(distance(positions.a!, HUB)).toBeCloseTo(RADIUS_INITIAL, 5);
    expect(distance(positions.b!, HUB)).toBeCloseTo(RADIUS_INITIAL + RADIUS_STEP, 5);
    expect(distance(positions.c!, HUB)).toBeCloseTo(RADIUS_INITIAL + 2 * RADIUS_STEP, 5);
  });

  it("honors manually-set positions; does NOT overwrite them", () => {
    const positions = computeAutoLayout([n("a", null, { x: 50, y: 50 })]);
    expect(positions.a).toEqual({ x: 50, y: 50 });
  });

  it("auto-positions a child even when its parent has a manual position (uses computed parent angle, not manual XY)", () => {
    // The manual position doesn't change the parent's logical angle — children
    // still spread radially from the hub through the manually-placed parent's
    // BFS slot. We just assert the child gets a computed position.
    const positions = computeAutoLayout([n("a", null, { x: 100, y: 200 }), n("b", "a")]);
    expect(positions.a).toEqual({ x: 100, y: 200 });
    expect(positions.b).toBeDefined();
  });
});
