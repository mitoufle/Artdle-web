import { describe, it, expect } from "vitest";
import { validateDesign } from "@/dev/skill-designer/validation";
import type { DesignNode, DesignCluster } from "@/dev/skill-designer/types";

function node(p: Partial<DesignNode> & { id: string; clusterId: string }): DesignNode {
  return { name: p.id, description: "", numericEffect: "", parentIds: [], stacking: "additive",
    kind: "minor", maxLevel: 1, costs: [0], unlocks: [], position: null, ...p };
}
function cluster(p: Partial<DesignCluster> & { id: string }): DesignCluster {
  return { name: p.id, theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 600, h: 600 }, ...p };
}

describe("cluster validation", () => {
  it("flags a cluster with no members", () => {
    const issues = validateDesign([], [cluster({ id: "c1", rootNodeId: "x" })]);
    expect(issues.some((i) => i.type === "cluster_empty" && i.nodeId === "c1")).toBe(true);
  });

  it("flags a root that has a parent", () => {
    const nodes = [node({ id: "r", clusterId: "c1" }), node({ id: "k", clusterId: "c1", parentIds: ["r"] })];
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "k" })]);
    expect(issues.some((i) => i.type === "cluster_root_has_parent" && i.nodeId === "c1")).toBe(true);
  });

  it("flags when the parentless members are not exactly [rootNodeId]", () => {
    const nodes = [node({ id: "a", clusterId: "c1" }), node({ id: "b", clusterId: "c1" })];
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "a" })]);
    expect(issues.some((i) => i.type === "cluster_root_count" && i.nodeId === "c1")).toBe(true);
  });

  it("flags a node whose clusterId references an unknown cluster", () => {
    const nodes = [node({ id: "a", clusterId: "ghost" })];
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "" })]);
    expect(issues.some((i) => i.type === "unknown_cluster" && i.nodeId === "a")).toBe(true);
  });

  it("is silent on a well-formed cluster (one root, root parentless, members present)", () => {
    const nodes = [node({ id: "r", clusterId: "c1" }), node({ id: "k", clusterId: "c1", parentIds: ["r"] })];
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "r" })]);
    const clusterIssues = issues.filter((i) => i.type.startsWith("cluster_") || i.type === "unknown_cluster");
    expect(clusterIssues).toEqual([]);
  });
});
