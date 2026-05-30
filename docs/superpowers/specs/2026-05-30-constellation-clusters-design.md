# Constellation Clusters — Design Spec

**Date:** 2026-05-30
**Status:** Approved (brainstorming), pending implementation plan
**Scope:** Runtime cluster system + minimal designer adaptation. The full
cluster-aware designer rework and final hand-drawn constellation art are a
**separate follow-up spec**.

## 1. Goal

Replace the single FAME-hub skill tree — where every node hangs off one central
root and the whole graph is one connected web — with **seven independent themed
constellations ("clusters")**. Each cluster:

- has exactly one **starting (root) node**,
- is themed around a game feature,
- is purchasable freely from the start (fame cost is the only gateway),
- grants a **completion bonus** when every node in it is maxed,
- displays a **background illustration** behind its stars once completed.

This is a **structural / visual reorganization**, not a node-content redesign.
The exact set of existing nodes is preserved (re-bucket only).

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Cluster gating | **All clusters open from start.** Fame price is the only gateway. Nodes still chain via prerequisites *within* a cluster. |
| Completion bonus | **Generic mechanism, placeholder values.** Build detection + effect hook + art trigger; real bonus numbers filled in later. |
| Node content | **Re-bucket only.** Keep the exact existing nodes; assign each a cluster; cut cross-cluster prereq links. Lopsided clusters (School=1, Combo=2) accepted. |
| Orphan speed nodes | `basic_technique` + `muscle_memory` fold into **Workshop**. |
| Sky layout | **One pannable night sky.** Reuse the existing StarCanvas; clusters scattered across it. |
| Work split | **Runtime first, designer later.** This spec = runtime + minimal designer survival. Real shape authoring = follow-up spec. |
| Designer scope (this spec) | **Keep it working + cluster field.** Survive FAME-hub retirement; add `clusterId` assignment + free dragging. Background-art placement UI deferred. |

## 3. The seven clusters

Each existing node maps to exactly one cluster. After cutting cross-cluster
links (§5) each cluster is a self-contained DAG with **exactly one root**.

| Cluster | Theme | Root node | Member nodes |
|---|---|---|---|
| **Inspiration** | Inspiration tree growth | `get_inspired` | get_inspired, poke_tree, Bargain, patron, enlightenment |
| **Colors** | Canvas sell price via the color wheel | `black_white` | black_white, magenta, cyan, yellow, red, green, blue, purple, brown, orange, rainbow |
| **Workshop** | Crafting, items, equipment slots, painting speed | `basic_technique` | basic_technique, muscle_memory, gear_up, craftsmanship, wooden_chest, shredder, taylorsim, steel_chest, forget_pain, monk_internship, third_hand, painters_boots, better_scaling, socks, painters_apron, painters_hat, ma_specialist, quantitative_easing, expert_manufacture |
| **Crit** | Critical-hit canvas track | `genius_episode` | genius_episode, consistency, fast_learner |
| **Combo** | Combo canvas track | `unrelentless` | unrelentless, afterburner |
| **Office** | Painter's Office / workers | `entrepreneur` | entrepreneur, hire_manager, accelerator |
| **School** | Painting School | `unlock_school` | unlock_school |

(Node count: Inspiration 5, Colors 11, Workshop 19, Crit 3, Combo 2, Office 3,
School 1 — total 44, matching the current table.)

## 4. Data model

### 4.1 Per-node `clusterId`

`SkillNodeConfig` (`src/config/skillTreeNodes.ts`) and the designer's
`DesignNode` (`src/dev/skill-designer/types.ts`) each gain:

```ts
readonly clusterId: SkillClusterId;
```

Membership is **explicit**, never inferred from graph connectivity.

### 4.2 Cluster table — `src/config/skillClusters.ts` (new)

```ts
export type SkillClusterId = string;

export interface ClusterCompletionArt {
  /** Background illustration shown behind the stars once the cluster is complete.
   *  null until the asset exists. */
  readonly imagePath: string | null;
  /** Where the art draws, in night-sky SVG coordinates. */
  readonly box: { x: number; y: number; w: number; h: number };
}

export interface SkillClusterConfig {
  readonly id: SkillClusterId;
  readonly name: string;
  readonly theme: string;            // player-facing flavor
  readonly rootNodeId: SkillNodeId;  // the single starting node
  /** Capability tag treated as active while the cluster is fully maxed.
   *  Engine reads it like any other capability tag (see §6). */
  readonly completionBonus: string;  // e.g. "cluster_colors_complete"
  readonly completionArt: ClusterCompletionArt;
}

export const SKILL_CLUSTERS: ReadonlyArray<SkillClusterConfig>;
export function getClusterConfig(id: SkillClusterId): SkillClusterConfig | null;
export function getClusterNodes(id: SkillClusterId): ReadonlyArray<SkillNodeConfig>;
```

`completionArt.imagePath` is `null` for all seven clusters in this spec (assets
come later). `box` gets a rough placeholder per cluster.

## 5. Cut the five cross-cluster links

Exactly five children currently have a parent in a different cluster. Remove
that parent so each becomes its cluster's root. **The cut must be applied in
both sources of truth**, because edge rendering and prereq logic read different
files:

| Child node | Parent to remove | Becomes root of |
|---|---|---|
| `black_white` | `basic_technique` | Colors |
| `genius_episode` | `muscle_memory` | Crit |
| `unrelentless` | `fast_learner` | Combo |
| `entrepreneur` | `forget_pain` | Office |
| `unlock_school` | `accelerator` | School |

Files to edit:
- `src/config/skillTreeNodes.ts` — prereq logic source (`parentIds`).
- `src/config/skillTreeDesign.json` — edge-rendering source (`parentIds`).

No other cross-cluster edges exist (verified by mapping every node's
`parentIds` against its cluster). All remaining multi-parent links
(`red`←[magenta,yellow], `forget_pain`←[steel_chest,taylorsim], etc.) are
intra-cluster.

**No save migration.** Node IDs are unchanged; only parent arrays shrink.
`purchasedNodes` keys remain valid.

## 6. Completion system (derived, capability-based)

Completion is **derived from `purchasedNodes` on every render**, not a one-time
grant event — this avoids any save/migration complexity.

```ts
// clusterComplete(state, clusterId): true when every node in the cluster is at maxLevel.
export function clusterComplete(
  state: Pick<GameStore, "purchasedNodes">,
  clusterId: SkillClusterId,
): boolean;
```

**Bonus application** reuses the existing capability-tag pattern (`hasCapability`
in `skillTreeSlice.ts` + consumers in `core/multipliers.ts`). Extend the
capability lookup so that a cluster's `completionBonus` tag reads as **active
whenever `clusterComplete` is true** for that cluster. Concretely: `hasCapability`
(or a thin wrapper the multipliers call) returns true for a tag that matches a
completed cluster's `completionBonus`, in addition to its existing per-node tag
scan.

For this spec the bonuses are **placeholders** — the tags exist and resolve, but
no multiplier consumes them yet (or they multiply by 1.0 / add 0). Real values
land later without further structural change.

## 7. Rendering — runtime

### 7.1 Retire the FAME hub

Remove from the **runtime** path:
- `FAME_HUB`, `FAME_HUB_X`, `FAME_HUB_Y` usage.
- `computeAutoLayout` import in `src/components/constellation/nodeLayout.ts`.
- The `"fame"` edge source in `EDGES` / `EdgeFrom`.

Every node now carries an **authored, non-null `position`** (from
`skillTreeDesign.json`). Edges become **parent→child only**. `nodeLayout.ts`
derives positions and the viewbox directly from authored positions (no hub
anchor).

### 7.2 Placeholder cluster positions

Seed rough hand-placed positions in `skillTreeDesign.json` so the seven clusters
occupy distinct, non-overlapping regions of the pannable night sky. These are
**placeholders** — they keep the game playable and testable; the real
pencil/palette/worker silhouettes are authored in the follow-up.

### 7.3 StarCanvas / rail

- **StarCanvas** draws each cluster's stars + their connecting (prereq) lines,
  always. When a cluster is complete, render its `completionArt` background PNG
  in `box` *behind* that cluster's stars (skip if `imagePath === null`).
- **MiniMap** and **ClusterList** show the seven clusters and each cluster's
  completion state (e.g. owned/total per cluster, "complete" marker). The
  current `ClusterList` already takes owned/total counts; extend it to per-cluster.
- The **Fame to spend** display and fame currency are unchanged — fame stays the
  global gateway.

### 7.4 Caveat (by design)

Under re-bucket-only, **edge topology is locked by the existing prereq DAG**.
Authored positions can *suggest* a silhouette, but the connecting lines between
stars are fixed — the background art must work with the existing connections,
not arbitrary outlines.

## 8. Designer adaptation (minimal — this spec)

`src/dev/skill-designer/`:
- `DesignNode` gains `clusterId`; `NodeForm` gets a **cluster picker** to assign it.
- **Retire the FAME hub in the designer too:** remove the `FAME` circle
  (`data-testid="fame-hub"`) and the `"fame"` root edges in `DesignerCanvas.tsx`.
  Cluster-root nodes render with no incoming edge (matching runtime).
- Keep **free star-dragging** (already works via `onMove`).
- `computeAutoLayout` stays **only** as a dev-side fallback for nodes with
  `position === null`, decoupled from any single hub. Runtime no longer imports it.

**Deferred to follow-up spec:** background-image placement UI, cluster-region
authoring affordances, and the final hand-drawn shapes.

## 9. Testing

Invariant tests (pure, over `SKILL_NODES` + `SKILL_CLUSTERS`):
- Every node belongs to **exactly one** cluster; every `clusterId` is a known cluster.
- Each cluster has **exactly one root** (one node with empty `parentIds`), and it
  equals the cluster's declared `rootNodeId`.
- Each cluster is **internally connected** (all nodes reachable from the root via
  parent links).
- **No cross-cluster edges** remain: every `parentId` of a node shares that node's
  `clusterId`.
- The five named cuts are present (the specific parents are gone).

Selector / behavior tests:
- `clusterComplete` is false when any member node is below `maxLevel`, true when all maxed.
- A completed cluster's `completionBonus` tag resolves as active via the capability lookup; an incomplete cluster's does not.

Designer:
- Existing designer tests updated for FAME-hub removal (no `fame-hub` testid, no
  `fame`-sourced edges); a node's `clusterId` round-trips through save/load.

## 10. Out of scope (this spec)

- Real completion-bonus values / multipliers.
- Final constellation art assets and their precise placement boxes.
- Cluster-aware designer authoring UX (background-image placement, region tools).
- Any node-content redesign (new nodes, rebalancing thin clusters).
