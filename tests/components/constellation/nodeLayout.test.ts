import { describe, it, expect } from "vitest";
import { NODE_POSITIONS, EDGES, VIEWBOX, CLUSTER_REGIONS } from "@/components/constellation/nodeLayout";
import { SKILL_NODES } from "@/config/skillTreeNodes";

describe("nodeLayout (hubless)", () => {
  it("has a position for every node", () => {
    for (const n of SKILL_NODES) {
      expect(NODE_POSITIONS[n.id]).toBeDefined();
    }
  });

  it("emits no fame edges — every edge is parent→child between real nodes", () => {
    const ids = new Set(SKILL_NODES.map((n) => n.id));
    for (const e of EDGES) {
      expect(e.from).not.toBe("fame");
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it("exposes one region per cluster for background art", () => {
    expect(CLUSTER_REGIONS.length).toBe(7);
    for (const r of CLUSTER_REGIONS) {
      expect(r.completionArtPath).toBeNull();
      expect(r.region.w).toBeGreaterThan(0);
    }
  });

  it("VIEWBOX covers all node positions", () => {
    for (const n of SKILL_NODES) {
      const p = NODE_POSITIONS[n.id]!;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(VIEWBOX.width);
      expect(p.y).toBeLessThanOrEqual(VIEWBOX.height);
    }
  });
});
