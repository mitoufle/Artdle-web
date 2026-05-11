import design from "@/config/skillTreeDesign.json";
import {
  computeAutoLayout,
  FAME_HUB_X,
  FAME_HUB_Y,
} from "@/dev/skill-designer/autoLayout";
import type { SkillNodeId } from "@/config/skillTreeNodes";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type EdgeFrom = SkillNodeId | "fame";

const rawPositions = computeAutoLayout(
  design.nodes as Parameters<typeof computeAutoLayout>[0],
);

const PADDING = 80;
const FUTURE_GROWTH = 800;
const TOTAL_MARGIN = PADDING + FUTURE_GROWTH;

const allRawPoints: ReadonlyArray<Point> = [
  { x: FAME_HUB_X, y: FAME_HUB_Y },
  ...Object.values(rawPositions),
];
const xs = allRawPoints.map((p) => p.x);
const ys = allRawPoints.map((p) => p.y);
const minX = Math.min(...xs);
const minY = Math.min(...ys);
const maxX = Math.max(...xs);
const maxY = Math.max(...ys);

const offsetX = TOTAL_MARGIN - minX;
const offsetY = TOTAL_MARGIN - minY;

export const FAME_HUB: Point = { x: FAME_HUB_X + offsetX, y: FAME_HUB_Y + offsetY };

export const NODE_POSITIONS: Record<string, Point> = Object.fromEntries(
  Object.entries(rawPositions).map(([id, p]) => [
    id,
    { x: p.x + offsetX, y: p.y + offsetY },
  ]),
);

export const VIEWBOX = {
  width: (maxX - minX) + 2 * TOTAL_MARGIN,
  height: (maxY - minY) + 2 * TOTAL_MARGIN,
};

export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> = (
  design.nodes as Parameters<typeof computeAutoLayout>[0]
).flatMap((node) => {
  if (node.parentIds.length === 0) {
    return [{ from: "fame" as EdgeFrom, to: node.id }];
  }
  return node.parentIds.map((parentId) => ({ from: parentId as EdgeFrom, to: node.id }));
});
