import design from "@/config/skillTreeDesign.json";
import {
  computeAutoLayout,
  FAME_HUB_X,
  FAME_HUB_Y,
  CANVAS_WIDTH,
} from "@/dev/skill-designer/autoLayout";
import type { SkillNodeId } from "@/config/skillTreeNodes";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** FAME hub position. Re-exported for StarCanvas. */
export const FAME_HUB: Point = { x: FAME_HUB_X, y: FAME_HUB_Y };

/** ViewBox dimensions used by StarCanvas + MiniMap. */
export const VIEWBOX = { width: CANVAS_WIDTH, height: 600 };

/**
 * Synthetic edge source. "fame" represents the root hub — used for nodes
 * with empty `parentIds`.
 */
export type EdgeFrom = SkillNodeId | "fame";

/**
 * Auto-computed positions, derived from `skillTreeDesign.json` at module load.
 * Manually-positioned nodes (those with `position !== null` in the JSON)
 * are honored; the rest get BFS auto-layout.
 */
export const NODE_POSITIONS: Record<string, Point> = computeAutoLayout(
  design.nodes as Parameters<typeof computeAutoLayout>[0],
);

/**
 * Edges to render. Each child contributes one edge per parent (or one edge
 * from FAME if it has no parents). DAG-ready.
 */
export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> = (
  design.nodes as Parameters<typeof computeAutoLayout>[0]
).flatMap((node) => {
  if (node.parentIds.length === 0) {
    return [{ from: "fame" as EdgeFrom, to: node.id }];
  }
  return node.parentIds.map((parentId) => ({ from: parentId as EdgeFrom, to: node.id }));
});
