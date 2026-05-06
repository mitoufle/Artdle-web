import type { DesignNode } from "./types";

export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 600;
/** FAME hub at the geometric center; tree grows radially outward. */
export const FAME_HUB_X = CANVAS_WIDTH / 2;
export const FAME_HUB_Y = CANVAS_HEIGHT / 2;
/** Distance from FAME hub to root nodes. */
export const RADIUS_INITIAL = 70;
/** Distance added per tree depth level. */
export const RADIUS_STEP = 50;

export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Compute positions for any node whose `position === null`. Manually-positioned
 * nodes are returned as-is.
 *
 * Layout: radial BFS rooted at the FAME hub. Roots spread evenly around a
 * circle of radius RADIUS_INITIAL; children sit further out, in an angular
 * wedge centered on their parent's angle. Multi-parent nodes use the first
 * parent for layout — additional parent edges are drawn but do not affect
 * positioning.
 *
 * The starting angle is -π/2 (top of the circle), so a single root sits
 * directly above the hub.
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

  const angleOf: Record<string, number> = {};
  const radiusOf: Record<string, number> = {};

  // Place roots evenly around the FAME hub.
  const roots = childrenOf[ROOT_KEY] ?? [];
  if (roots.length === 1) {
    const id = roots[0]!;
    angleOf[id] = -Math.PI / 2;
    radiusOf[id] = RADIUS_INITIAL;
    if (!positions[id]) {
      positions[id] = polarToXY(angleOf[id], radiusOf[id]);
    }
  } else if (roots.length > 1) {
    const angleStep = (2 * Math.PI) / roots.length;
    roots.forEach((id, i) => {
      const a = -Math.PI / 2 + i * angleStep;
      angleOf[id] = a;
      radiusOf[id] = RADIUS_INITIAL;
      if (!positions[id]) positions[id] = polarToXY(a, RADIUS_INITIAL);
    });
  }

  // BFS through tree, fanning children in a wedge around each parent.
  const queue: string[] = [...roots];
  const visited = new Set<string>(roots);
  /** Wedge half-width per child rank. Shrinks with depth so subtrees don't overlap. */
  const wedgeForDepth = (depth: number) => Math.PI / 4 / Math.max(1, depth);

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = childrenOf[parentId] ?? [];
    if (children.length === 0) continue;

    const parentAngle = angleOf[parentId] ?? 0;
    const parentRadius = radiusOf[parentId] ?? RADIUS_INITIAL;
    const childRadius = parentRadius + RADIUS_STEP;
    const depth = Math.round((parentRadius - RADIUS_INITIAL) / RADIUS_STEP) + 1;
    const wedge = wedgeForDepth(depth);

    children.forEach((childId, i) => {
      const offset = children.length === 1
        ? 0
        : (i - (children.length - 1) / 2) * (wedge / Math.max(1, children.length - 1)) * 2;
      const a = parentAngle + offset;
      angleOf[childId] = a;
      radiusOf[childId] = childRadius;
      if (!positions[childId]) {
        positions[childId] = polarToXY(a, childRadius);
      }
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    });
  }

  return positions;
}

function polarToXY(angle: number, radius: number): Position {
  return {
    x: FAME_HUB_X + radius * Math.cos(angle),
    y: FAME_HUB_Y + radius * Math.sin(angle),
  };
}
