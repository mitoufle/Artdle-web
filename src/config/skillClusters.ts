// src/config/skillClusters.ts
import { SKILL_NODES, type SkillNodeConfig, type SkillNodeId } from "@/config/skillTreeNodes";

/** Cluster identifier. String — data-driven, matches SkillNodeId style. */
export type SkillClusterId = string;

/** A rectangle in night-sky SVG coordinates. */
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface SkillClusterConfig {
  readonly id: SkillClusterId;
  readonly name: string;
  /** Player-facing flavor describing the theme. */
  readonly theme: string;
  /** The single starting node — the only node in the cluster with no parents. */
  readonly rootNodeId: SkillNodeId;
  /**
   * Capability tag treated as ACTIVE while every node in the cluster is maxed.
   * Read by hasCapability() like any other capability tag. Placeholder for now:
   * no multiplier consumes it yet.
   */
  readonly completionBonus: string;
  /** Where the cluster's stars are laid out, and where its art draws. */
  readonly region: Region;
  /** Background illustration shown once complete. null until the asset exists. */
  readonly completionArtPath: string | null;
}

/**
 * The seven clusters. Regions are PLACEHOLDER positions across one pannable
 * night sky — distinct, non-overlapping. Final hand-drawn constellation shapes
 * are authored later via the (future) cluster-aware skill designer.
 *
 * Workshop is the largest (19 nodes incl. the two painting-speed nodes) so it
 * gets the biggest region.
 */
export const SKILL_CLUSTERS: ReadonlyArray<SkillClusterConfig> = [
  { id: "inspiration", name: "Inspiration", theme: "Grow and harvest the inspiration tree.", rootNodeId: "get_inspired", completionBonus: "cluster_inspiration_complete", region: { x: 0, y: 0, w: 600, h: 600 }, completionArtPath: null },
  { id: "colors", name: "Colors", theme: "Master the color wheel to raise canvas value.", rootNodeId: "black_white", completionBonus: "cluster_colors_complete", region: { x: 700, y: 0, w: 760, h: 760 }, completionArtPath: null },
  { id: "workshop", name: "Workshop", theme: "Craft, store, and equip items; paint faster.", rootNodeId: "basic_technique", completionBonus: "cluster_workshop_complete", region: { x: 1560, y: 0, w: 960, h: 960 }, completionArtPath: null },
  { id: "crit", name: "Crit", theme: "Land critical strokes on the canvas.", rootNodeId: "genius_episode", completionBonus: "cluster_crit_complete", region: { x: 0, y: 700, w: 520, h: 520 }, completionArtPath: null },
  { id: "combo", name: "Combo", theme: "Chain strokes into escalating combos.", rootNodeId: "unrelentless", completionBonus: "cluster_combo_complete", region: { x: 620, y: 860, w: 420, h: 420 }, completionArtPath: null },
  { id: "office", name: "Office", theme: "Hire and grow a studio of workers.", rootNodeId: "entrepreneur", completionBonus: "cluster_office_complete", region: { x: 1140, y: 1060, w: 520, h: 420 }, completionArtPath: null },
  { id: "school", name: "School", theme: "Open the Painting School for permanent research.", rootNodeId: "unlock_school", completionBonus: "cluster_school_complete", region: { x: 1760, y: 1060, w: 960, h: 960 }, completionArtPath: null },
];

/** All known cluster ids, for exhaustive checks. */
export const CLUSTER_IDS: ReadonlyArray<SkillClusterId> = SKILL_CLUSTERS.map(
  (c) => c.id,
);

/** Lookup helper. Returns null if id unknown. */
export function getClusterConfig(id: SkillClusterId): SkillClusterConfig | null {
  return SKILL_CLUSTERS.find((c) => c.id === id) ?? null;
}

/** All nodes whose clusterId === id, in table order. */
export function getClusterNodes(
  id: SkillClusterId,
): ReadonlyArray<SkillNodeConfig> {
  return SKILL_NODES.filter((n) => n.clusterId === id);
}
