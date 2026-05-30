import { describe, it, expect } from "vitest";
import { nextClusterRegion, CLUSTER_DEFAULT_SIZE } from "@/dev/skill-designer/clusterRegion";

interface C { region: { x: number; y: number; w: number; h: number }; }

function overlaps(a: C["region"], b: C["region"]): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe("nextClusterRegion", () => {
  it("places the first cluster at the origin slot with the default size", () => {
    const r = nextClusterRegion([]);
    expect(r).toEqual({ x: 0, y: 0, w: CLUSTER_DEFAULT_SIZE, h: CLUSTER_DEFAULT_SIZE });
  });

  it("returns a region that overlaps none of the existing ones", () => {
    const existing = [
      { region: { x: 0, y: 0, w: 600, h: 600 } },
      { region: { x: 700, y: 0, w: 760, h: 760 } },
      { region: { x: 1560, y: 0, w: 960, h: 960 } },
    ];
    const r = nextClusterRegion(existing);
    for (const c of existing) expect(overlaps(r, c.region)).toBe(false);
  });

  it("is deterministic", () => {
    const existing = [{ region: { x: 0, y: 0, w: 600, h: 600 } }];
    expect(nextClusterRegion(existing)).toEqual(nextClusterRegion(existing));
  });
});
