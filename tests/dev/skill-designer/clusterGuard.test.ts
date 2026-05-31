import { describe, it, expect } from "vitest";
import { SKILL_CLUSTERS } from "@/config/skillClusters";
import design from "@/config/skillTreeDesign.json";

describe("design JSON clusters ⇄ runtime SKILL_CLUSTERS", () => {
  const jsonClusters = (design as { clusters: { id: string; name: string; theme: string; rootNodeId: string; region: { x: number; y: number; w: number; h: number } }[] }).clusters;

  it("every runtime cluster has a matching JSON cluster (id, name, rootNodeId, region)", () => {
    for (const rc of SKILL_CLUSTERS) {
      const jc = jsonClusters.find((c) => c.id === rc.id);
      expect(jc, `JSON cluster ${rc.id}`).toBeDefined();
      expect(jc!.rootNodeId).toBe(rc.rootNodeId);
      expect(jc!.region).toEqual(rc.region);
      expect(jc!.name).toBe(rc.name);
    }
  });

  it("the seven shipped clusters are present in both TS and JSON", () => {
    const shipped = ["inspiration", "colors", "workshop", "crit", "combo", "office", "school"];
    for (const id of shipped) {
      expect(SKILL_CLUSTERS.some((c) => c.id === id), `runtime ${id}`).toBe(true);
      expect(jsonClusters.some((c) => c.id === id), `json ${id}`).toBe(true);
    }
  });
});
