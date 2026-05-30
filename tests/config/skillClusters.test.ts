// tests/config/skillClusters.test.ts
import { describe, it, expect } from "vitest";
import {
  SKILL_CLUSTERS,
  getClusterConfig,
  CLUSTER_IDS,
} from "@/config/skillClusters";

describe("SKILL_CLUSTERS table", () => {
  it("defines exactly the seven clusters", () => {
    expect(SKILL_CLUSTERS.map((c) => c.id).sort()).toEqual(
      [...CLUSTER_IDS].sort(),
    );
    expect(SKILL_CLUSTERS).toHaveLength(7);
  });

  it("has unique ids and unique completion-bonus tags", () => {
    const ids = SKILL_CLUSTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tags = SKILL_CLUSTERS.map((c) => c.completionBonus);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("each cluster declares a non-empty region with positive size", () => {
    for (const c of SKILL_CLUSTERS) {
      expect(c.region.w).toBeGreaterThan(0);
      expect(c.region.h).toBeGreaterThan(0);
    }
  });

  it("getClusterConfig returns the cluster or null", () => {
    expect(getClusterConfig("colors")?.name).toBe("Colors");
    expect(getClusterConfig("nope")).toBeNull();
  });

  it("completionArtPath is null for every cluster (assets come later)", () => {
    for (const c of SKILL_CLUSTERS) {
      expect(c.completionArtPath).toBeNull();
    }
  });
});
