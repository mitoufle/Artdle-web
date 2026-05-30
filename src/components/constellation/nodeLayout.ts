import design from "@/config/skillTreeDesign.json";
import {
  computeClusterLayout,
  constellationViewbox,
  paddedRegion,
  type LayoutNode,
} from "@/core/clusterLayout";
import { SKILL_CLUSTERS, type SkillClusterConfig } from "@/config/skillClusters";
import type { SkillNodeId } from "@/config/skillTreeNodes";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** No more FAME hub: edges run parent→child between real nodes only. */
export type EdgeFrom = SkillNodeId;

const designNodes = design.nodes as ReadonlyArray<LayoutNode>;

/**
 * Positions live in the WORLD_PAD-padded space produced by computeClusterLayout.
 * The skill designer consumes the SAME function over the same cluster config, so
 * designer and game render node positions identically.
 */
export const NODE_POSITIONS: Record<string, Point> = computeClusterLayout(
  designNodes,
  SKILL_CLUSTERS,
);

export const VIEWBOX = constellationViewbox(NODE_POSITIONS, SKILL_CLUSTERS);

/** Per-cluster region (in the shared padded space) + its completion art. */
export interface ClusterRegion {
  readonly id: string;
  readonly region: { x: number; y: number; w: number; h: number };
  readonly completionArtPath: string | null;
}

export const CLUSTER_REGIONS: ReadonlyArray<ClusterRegion> = SKILL_CLUSTERS.map(
  (c: SkillClusterConfig) => ({
    id: c.id,
    region: paddedRegion(c.region),
    completionArtPath: c.completionArtPath,
  }),
);

export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> =
  designNodes.flatMap((node) =>
    node.parentIds.map((parentId) => ({ from: parentId, to: node.id })),
  );
