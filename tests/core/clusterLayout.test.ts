import { describe, it, expect } from "vitest";
import { computeClusterLayout } from "@/core/clusterLayout";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { SKILL_CLUSTERS, getClusterConfig } from "@/config/skillClusters";

describe("computeClusterLayout", () => {
  const layout = computeClusterLayout(SKILL_NODES, SKILL_CLUSTERS);

  it("places every node", () => {
    for (const n of SKILL_NODES) {
      expect(layout[n.id], `position for ${n.id}`).toBeDefined();
    }
  });

  it("places each node inside (or near) its cluster region", () => {
    for (const n of SKILL_NODES) {
      const region = getClusterConfig(n.clusterId)!.region;
      const p = layout[n.id]!;
      const m = 200;
      expect(p.x).toBeGreaterThanOrEqual(region.x - m);
      expect(p.x).toBeLessThanOrEqual(region.x + region.w + m);
      expect(p.y).toBeGreaterThanOrEqual(region.y - m);
      expect(p.y).toBeLessThanOrEqual(region.y + region.h + m);
    }
  });

  it("honors a non-null authored position override", () => {
    const overridden = SKILL_NODES.map((n) =>
      n.id === "get_inspired" ? { ...n, position: { x: 42, y: 99 } } : n,
    );
    const l = computeClusterLayout(overridden, SKILL_CLUSTERS);
    expect(l["get_inspired"]).toEqual({ x: 42, y: 99 });
  });
});
