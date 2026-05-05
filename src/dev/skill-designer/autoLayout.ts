import type { DesignNode } from "./types";

export const FAME_HUB_X = 300;
export const FAME_HUB_Y = 510;
export const ROOT_Y = 400;
export const LEVEL_HEIGHT = 100;
export const CANVAS_WIDTH = 600;
export const CANVAS_PADDING_X = 80;

export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Compute positions for any node whose `position === null`. Manually-positioned
 * nodes are returned as-is.
 *
 * For multi-parent nodes, the BFS uses the FIRST parent for positioning.
 * Visually the canvas draws an edge to each parent.
 */
export function computeAutoLayout(
  nodes: ReadonlyArray<DesignNode>,
): Record<string, Position> {
  const positions: Record<string, Position> = {};

  for (const node of nodes) {
    if (node.position !== null) {
      positions[node.id] = node.position;
    }
  }

  const ROOT_KEY = "__root__";
  const childrenOf: Record<string, string[]> = {};
  for (const node of nodes) {
    const key = node.parentIds.length === 0 ? ROOT_KEY : node.parentIds[0]!;
    if (!childrenOf[key]) childrenOf[key] = [];
    const children = childrenOf[key];
    if (children) children.push(node.id);
  }
  for (const key of Object.keys(childrenOf)) {
    const children = childrenOf[key];
    if (children) children.sort();
  }

  const roots = childrenOf[ROOT_KEY] ?? [];
  if (roots.length === 1) {
    const rootId = roots[0];
    if (rootId && !positions[rootId]) {
      positions[rootId] = { x: CANVAS_WIDTH / 2, y: ROOT_Y };
    }
  } else if (roots.length > 1) {
    const span = CANVAS_WIDTH - 2 * CANVAS_PADDING_X;
    const step = span / (roots.length - 1);
    roots.forEach((id, i) => {
      if (!positions[id]) {
        positions[id] = { x: CANVAS_PADDING_X + i * step, y: ROOT_Y };
      }
    });
  }

  const queue: string[] = [...roots];
  const visited = new Set<string>(roots);

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const parentPos = positions[parentId];
    const children = childrenOf[parentId] ?? [];
    if (!parentPos || children.length === 0) continue;

    const childY = parentPos.y - LEVEL_HEIGHT;
    children.forEach((childId, i) => {
      if (!positions[childId]) {
        const offset = (i - (children.length - 1) / 2) * 80;
        positions[childId] = { x: parentPos.x + offset, y: childY };
      }
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    });
  }

  return positions;
}
