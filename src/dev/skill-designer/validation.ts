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

/**
 * DFS over the parents-DAG. Returns true if `start` can reach itself.
 */
function hasCycleFrom(
  start: string,
  byId: Map<string, DesignNode>,
): boolean {
  const stack: string[] = [];
  const startNode = byId.get(start);
  if (!startNode) return false;
  for (const parent of startNode.parentIds) stack.push(parent);

  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === start) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const node = byId.get(current);
    if (!node) continue;
    for (const parent of node.parentIds) stack.push(parent);
  }
  return false;
}

export function validateDesign(
  nodes: ReadonlyArray<DesignNode>,
): ReadonlyArray<ValidationIssue> {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const idSet = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    if (seen.has(node.id)) {
      issues.push({
        type: "duplicate_id",
        nodeId: node.id,
        message: `Duplicate node id "${node.id}"`,
      });
    }
    seen.add(node.id);

    for (const parentId of node.parentIds) {
      if (!idSet.has(parentId)) {
        issues.push({
          type: "missing_parent",
          nodeId: node.id,
          message: `Parent "${parentId}" does not exist`,
        });
      }
    }

    if (node.costs.length !== node.maxLevel) {
      issues.push({
        type: "costs_length_mismatch",
        nodeId: node.id,
        message: `Costs length (${node.costs.length}) != maxLevel (${node.maxLevel})`,
      });
    }
  }

  // Cycle detection over the DAG.
  for (const node of nodes) {
    if (hasCycleFrom(node.id, byId)) {
      issues.push({
        type: "cycle",
        nodeId: node.id,
        message: `Cycle detected involving "${node.id}"`,
      });
    }
  }

  // Orphan: no parents AND no children.
  const hasChildren = new Set<string>();
  for (const node of nodes) {
    for (const parentId of node.parentIds) {
      hasChildren.add(parentId);
    }
  }
  for (const node of nodes) {
    if (node.parentIds.length === 0 && !hasChildren.has(node.id)) {
      issues.push({
        type: "orphan",
        nodeId: node.id,
        message: `Node "${node.id}" has no parents and no children`,
      });
    }
  }

  return issues;
}
