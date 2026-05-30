import design from "@/config/skillTreeDesign.json";
import { computeClusterLayout, type LayoutNode } from "@/core/clusterLayout";
import { SKILL_CLUSTERS, type SkillClusterConfig } from "@/config/skillClusters";
import type { SkillNodeId } from "@/config/skillTreeNodes";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** No more FAME hub: edges run parent→child between real nodes only. */
export type EdgeFrom = SkillNodeId;

const designNodes = design.nodes as ReadonlyArray<LayoutNode>;

const rawPositions = computeClusterLayout(designNodes, SKILL_CLUSTERS);

const PADDING = 120;

const xs = Object.values(rawPositions).map((p) => p.x);
const ys = Object.values(rawPositions).map((p) => p.y);
const regionMaxX = Math.max(...SKILL_CLUSTERS.map((c) => c.region.x + c.region.w));
const regionMaxY = Math.max(...SKILL_CLUSTERS.map((c) => c.region.y + c.region.h));
const minX = Math.min(...xs, 0);
const minY = Math.min(...ys, 0);

const offsetX = PADDING - minX;
const offsetY = PADDING - minY;

export const NODE_POSITIONS: Record<string, Point> = Object.fromEntries(
  Object.entries(rawPositions).map(([id, p]) => [
    id,
    { x: p.x + offsetX, y: p.y + offsetY },
  ]),
);

export const VIEWBOX = {
  width: Math.max(...xs, regionMaxX) + offsetX + PADDING,
  height: Math.max(...ys, regionMaxY) + offsetY + PADDING,
};

/** Per-cluster region (offset to match NODE_POSITIONS) + its completion art. */
export interface ClusterRegion {
  readonly id: string;
  readonly region: { x: number; y: number; w: number; h: number };
  readonly completionArtPath: string | null;
}

export const CLUSTER_REGIONS: ReadonlyArray<ClusterRegion> = SKILL_CLUSTERS.map(
  (c: SkillClusterConfig) => ({
    id: c.id,
    region: {
      x: c.region.x + offsetX,
      y: c.region.y + offsetY,
      w: c.region.w,
      h: c.region.h,
    },
    completionArtPath: c.completionArtPath,
  }),
);

export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> =
  designNodes.flatMap((node) =>
    node.parentIds.map((parentId) => ({ from: parentId, to: node.id })),
  );
