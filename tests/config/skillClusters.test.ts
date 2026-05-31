// tests/config/skillClusters.test.ts
import { describe, it, expect } from "vitest";
import {
  SKILL_CLUSTERS,
  getClusterConfig,
  CLUSTER_IDS,
  getClusterNodes,
} from "@/config/skillClusters";
import { SKILL_NODES, getSkillNodeConfig } from "@/config/skillTreeNodes";
import design from "@/config/skillTreeDesign.json";

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

describe("node → cluster invariants", () => {
  it("every node has a clusterId pointing at a known cluster", () => {
    const known = new Set(SKILL_CLUSTERS.map((c) => c.id));
    for (const n of SKILL_NODES) {
      expect(known.has(n.clusterId)).toBe(true);
    }
  });

  it("every node belongs to exactly one cluster (partition by clusterId)", () => {
    const counts = new Map<string, number>();
    for (const n of SKILL_NODES) {
      counts.set(n.clusterId, (counts.get(n.clusterId) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(SKILL_NODES.length);
    expect(SKILL_NODES.length).toBe(61);
  });

  it("each cluster has exactly one root, equal to its declared rootNodeId", () => {
    for (const c of SKILL_CLUSTERS) {
      const members = getClusterNodes(c.id);
      const roots = members.filter((n) => n.parentIds.length === 0);
      expect(roots.map((r) => r.id)).toEqual([c.rootNodeId]);
    }
  });

  it("has no cross-cluster edges — every parent shares the child's cluster", () => {
    for (const n of SKILL_NODES) {
      for (const pid of n.parentIds) {
        const parent = getSkillNodeConfig(pid);
        expect(parent, `parent ${pid} of ${n.id} exists`).not.toBeNull();
        expect(parent!.clusterId).toBe(n.clusterId);
      }
    }
  });

  it("each cluster is internally connected from its root", () => {
    for (const c of SKILL_CLUSTERS) {
      const members = getClusterNodes(c.id);
      const ids = new Set(members.map((n) => n.id));
      const childrenOf = new Map<string, string[]>();
      for (const n of members) {
        for (const p of n.parentIds) {
          if (!childrenOf.has(p)) childrenOf.set(p, []);
          childrenOf.get(p)!.push(n.id);
        }
      }
      const seen = new Set<string>([c.rootNodeId]);
      const queue = [c.rootNodeId];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const ch of childrenOf.get(cur) ?? []) {
          if (!seen.has(ch)) {
            seen.add(ch);
            queue.push(ch);
          }
        }
      }
      expect(seen.size).toBe(ids.size);
    }
  });

  it("the five named cross-cluster parents are cut", () => {
    expect(getSkillNodeConfig("black_white")!.parentIds).not.toContain("basic_technique");
    expect(getSkillNodeConfig("genius_episode")!.parentIds).not.toContain("muscle_memory");
    expect(getSkillNodeConfig("unrelentless")!.parentIds).not.toContain("fast_learner");
    expect(getSkillNodeConfig("entrepreneur")!.parentIds).not.toContain("forget_pain");
    expect(getSkillNodeConfig("unlock_school")!.parentIds).not.toContain("accelerator");
  });
});

describe("design JSON ↔ runtime table agreement", () => {
  it("parentIds and clusterId match between JSON and SKILL_NODES", () => {
    const byId = new Map(SKILL_NODES.map((n) => [n.id, n]));
    for (const dn of design.nodes as ReadonlyArray<{ id: string; parentIds: string[]; clusterId?: string }>) {
      const rt = byId.get(dn.id);
      expect(rt, `runtime node ${dn.id}`).toBeDefined();
      expect([...rt!.parentIds].sort()).toEqual([...dn.parentIds].sort());
      expect(dn.clusterId).toBe(rt!.clusterId);
    }
  });
});
