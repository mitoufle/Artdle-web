import type { SkillClusterConfig } from "@/config/skillClusters";

export interface Position {
  readonly x: number;
  readonly y: number;
}

/** Minimal node shape this layout needs. Compatible with SkillNodeConfig and design JSON nodes. */
export interface LayoutNode {
  readonly id: string;
  readonly clusterId: string;
  readonly parentIds: ReadonlyArray<string>;
  /** Optional authored override; when non-null it wins over the computed position. */
  readonly position?: { x: number; y: number } | null;
}

const RADIUS_INITIAL = 60;
const RADIUS_STEP = 55;

/**
 * Constant margin added around the cluster sky so no node sits at coordinate 0.
 * Baked into the layout (rather than applied as a separate offset downstream) so
 * that computed positions, authored `position` overrides, the runtime canvas, and
 * the skill designer all live in ONE coordinate space — a star dragged in the
 * designer lands exactly where the game renders it.
 */
export const WORLD_PAD = 200;

/**
 * Total sky size in the shared coordinate space — bounds both the cluster regions
 * and the actual node positions (a deep chain can fan a little past its region),
 * plus a WORLD_PAD margin. Pass the positions from computeClusterLayout.
 */
export function constellationViewbox(
  positions: Record<string, Position>,
  clusters: ReadonlyArray<SkillClusterConfig>,
): { width: number; height: number } {
  const pts = Object.values(positions);
  const maxRegionX = Math.max(...clusters.map((c) => WORLD_PAD + c.region.x + c.region.w));
  const maxRegionY = Math.max(...clusters.map((c) => WORLD_PAD + c.region.y + c.region.h));
  const maxNodeX = pts.length ? Math.max(...pts.map((p) => p.x)) : 0;
  const maxNodeY = pts.length ? Math.max(...pts.map((p) => p.y)) : 0;
  return {
    width: Math.max(maxRegionX, maxNodeX) + WORLD_PAD,
    height: Math.max(maxRegionY, maxNodeY) + WORLD_PAD,
  };
}

/** A cluster's region shifted into the shared (WORLD_PAD-padded) coordinate space. */
export function paddedRegion(region: {
  x: number;
  y: number;
  w: number;
  h: number;
}): { x: number; y: number; w: number; h: number } {
  return { x: WORLD_PAD + region.x, y: WORLD_PAD + region.y, w: region.w, h: region.h };
}

/**
 * Lay out every node inside its cluster's region. Each cluster is an independent
 * radial-BFS tree rooted at its single root node, centered on the region center
 * (shifted by WORLD_PAD). Hubless — there is no FAME node. Non-null authored
 * positions override and are taken verbatim (already in the shared space).
 */
export function computeClusterLayout(
  nodes: ReadonlyArray<LayoutNode>,
  clusters: ReadonlyArray<SkillClusterConfig>,
): Record<string, Position> {
  const positions: Record<string, Position> = {};
  const byCluster = new Map<string, LayoutNode[]>();
  for (const n of nodes) {
    if (!byCluster.has(n.clusterId)) byCluster.set(n.clusterId, []);
    byCluster.get(n.clusterId)!.push(n);
  }

  for (const cluster of clusters) {
    const members = byCluster.get(cluster.id) ?? [];
    const cx = WORLD_PAD + cluster.region.x + cluster.region.w / 2;
    const cy = WORLD_PAD + cluster.region.y + cluster.region.h / 2;

    const childrenOf = new Map<string, string[]>();
    const roots: string[] = [];
    for (const n of members) {
      if (n.parentIds.length === 0) roots.push(n.id);
      const key = n.parentIds[0];
      if (key !== undefined) {
        if (!childrenOf.has(key)) childrenOf.set(key, []);
        childrenOf.get(key)!.push(n.id);
      }
    }
    for (const list of childrenOf.values()) list.sort();
    roots.sort();

    const angleOf: Record<string, number> = {};
    const radiusOf: Record<string, number> = {};

    if (roots.length === 1) {
      angleOf[roots[0]!] = -Math.PI / 2;
      radiusOf[roots[0]!] = 0;
    } else {
      const step = (2 * Math.PI) / Math.max(1, roots.length);
      roots.forEach((id, i) => {
        angleOf[id] = -Math.PI / 2 + i * step;
        radiusOf[id] = RADIUS_INITIAL;
      });
    }

    const queue = [...roots];
    const visited = new Set<string>(roots);
    const wedgeForDepth = (d: number) => Math.PI / 3 / Math.max(1, d);

    while (queue.length) {
      const pid = queue.shift()!;
      const kids = childrenOf.get(pid) ?? [];
      if (kids.length === 0) continue;
      const pAngle = angleOf[pid] ?? -Math.PI / 2;
      const pRadius = radiusOf[pid] ?? 0;
      const childRadius = pRadius + RADIUS_STEP;
      const depth = Math.round(pRadius / RADIUS_STEP) + 1;
      const wedge = wedgeForDepth(depth);
      kids.forEach((cid, i) => {
        const offset =
          kids.length === 1
            ? 0
            : (i - (kids.length - 1) / 2) * (wedge / Math.max(1, kids.length - 1)) * 2;
        const a = pAngle + offset;
        angleOf[cid] = a;
        radiusOf[cid] = childRadius;
        if (!visited.has(cid)) {
          visited.add(cid);
          queue.push(cid);
        }
      });
    }

    for (const n of members) {
      if (n.position) {
        positions[n.id] = n.position;
        continue;
      }
      const a = angleOf[n.id] ?? -Math.PI / 2;
      const r = radiusOf[n.id] ?? 0;
      positions[n.id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }
  }

  return positions;
}
