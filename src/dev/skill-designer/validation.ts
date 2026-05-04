import type { DesignNode } from "./types";

export type ValidationIssueType =
  | "duplicate_id"
  | "missing_parent"
  | "cycle"
  | "orphan"
  | "costs_length_mismatch";

export interface ValidationIssue {
  type: ValidationIssueType;
  nodeId: string;
  message: string;
}

export function validateDesign(
  nodes: ReadonlyArray<DesignNode>,
): ReadonlyArray<ValidationIssue> {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const idSet = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    if (seen.has(node.id)) {
      issues.push({
        type: "duplicate_id",
        nodeId: node.id,
        message: `Duplicate node id "${node.id}"`,
      });
    }
    seen.add(node.id);

    if (node.parentId !== null && !idSet.has(node.parentId)) {
      issues.push({
        type: "missing_parent",
        nodeId: node.id,
        message: `Parent "${node.parentId}" does not exist`,
      });
    }

    if (node.costs.length !== node.maxLevel) {
      issues.push({
        type: "costs_length_mismatch",
        nodeId: node.id,
        message: `Costs length (${node.costs.length}) != maxLevel (${node.maxLevel})`,
      });
    }
  }

  // Cycle detection: walk parent chain from each node; if we revisit start id or any visited id, it's a cycle.
  const cycleReported = new Set<string>();
  for (const start of nodes) {
    let current: string | null = start.parentId;
    const visited = new Set<string>([start.id]);
    while (current !== null) {
      if (visited.has(current)) {
        if (!cycleReported.has(start.id)) {
          issues.push({
            type: "cycle",
            nodeId: start.id,
            message: `Cycle detected involving "${start.id}"`,
          });
          cycleReported.add(start.id);
        }
        break;
      }
      visited.add(current);
      const parent = nodes.find((n) => n.id === current);
      current = parent ? parent.parentId : null;
    }
  }

  // Orphan: parentId === null AND no children.
  const hasChildren = new Set<string>();
  for (const node of nodes) {
    if (node.parentId !== null) hasChildren.add(node.parentId);
  }
  for (const node of nodes) {
    if (node.parentId === null && !hasChildren.has(node.id)) {
      issues.push({
        type: "orphan",
        nodeId: node.id,
        message: `Node "${node.id}" has no parent and no children`,
      });
    }
  }

  return issues;
}
