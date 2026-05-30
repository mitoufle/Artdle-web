# Cluster Authoring in the Skill Designer — Design Spec

**Date:** 2026-05-31
**Status:** Approved (brainstorming), pending implementation plan
**Scope:** Designer-side authoring of constellation clusters. Lets the user create
and edit clusters (with one validated root each) in `/dev/skill-designer`, saved
into `skillTreeDesign.json` as a spec. The agent wires each saved cluster into the
runtime (`skillClusters.ts`). This is the deferred "cluster-aware designer" follow-up
to the [2026-05-30 constellation clusters](2026-05-30-constellation-clusters-design.md) work.

## 1. Goal

Today the seven clusters are hand-coded in `src/config/skillClusters.ts`; the
designer can only assign nodes to that fixed list. The user wants to **create new
clusters from the designer tool**, each with **exactly one identified root node**,
without editing TypeScript.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Where do user-created clusters live? | **Author-as-spec.** Clusters are stored in `skillTreeDesign.json` (the designer's spec file). The agent hand-wires each into `skillClusters.ts` (runtime). Matches the existing "design JSON is a spec, runtime is hand-coded TS" convention. |
| Root designation | **Explicit + validated.** Each cluster has a chosen `rootNodeId`; the designer flags an issue unless that root is the cluster's only parentless member. |
| New-cluster placement | **Auto-place** a new cluster's region in empty sky space; the user shapes the constellation by dragging individual stars (existing behavior). No separate "drag the whole region" tool in this spec. |
| Designer layout source | Designer lays out from `DesignFile.clusters` (so new clusters preview live). The game keeps using `SKILL_CLUSTERS`; wired clusters match. |

## 3. Architecture & data flow

```
User edits clusters/nodes in /dev/skill-designer
        │  (auto-save draft → localStorage; Save to file → POST /api/skill-design)
        ▼
src/config/skillTreeDesign.json   ← clusters[] + nodes[] (the SPEC)
        │
        ├──(runtime, live)→ nodeLayout.ts reads node positions/clusterId/edges
        │
        └──(agent, manual)→ wires clusters[] into skillClusters.ts
                              (+ reconciles node clusterId in skillTreeNodes.ts)
                                      │
                                      ▼
                            Game renders from SKILL_CLUSTERS (TS)
```

The designer is a SPEC editor. Saving never mutates the player's game save (only
writes the config JSON, exactly as today).

## 4. Data model

### 4.1 `DesignCluster` (new) — `src/dev/skill-designer/types.ts`

```ts
export interface DesignCluster {
  id: string;            // slug, unique
  name: string;          // player-facing
  theme: string;         // player-facing flavor
  rootNodeId: string;    // the cluster's single root (a parentless member)
  region: { x: number; y: number; w: number; h: number };
}
```

`DesignFile` gains `clusters: ReadonlyArray<DesignCluster>`.

`completionBonus` and `completionArtPath` are intentionally **absent** — those are
gameplay/asset fields the agent owns in `skillClusters.ts`.

### 4.2 Seeding the existing 7

`skillTreeDesign.json` is updated once to include a `clusters` array mirroring the
current `SKILL_CLUSTERS` (id, name, theme, rootNodeId, region) so the designer shows
them on first load. The runtime `SKILL_CLUSTERS` is unchanged by this seeding.

## 5. Designer UI

### 5.1 Cluster CRUD
- An **"+ Add Cluster"** button (near "+ Add Node"). Creates a `DesignCluster` with a
  generated unique `id` (e.g. `cluster_2`), default name, empty `theme`, `rootNodeId: ""`,
  and an **auto-placed region** (see §5.3).
- A **cluster editor** panel (shown when a cluster is selected, mirroring `NodeForm`):
  edit `name`, `theme`; a **root picker** (a `<select>` of the cluster's member nodes,
  `aria-label="Cluster root"`); a **Delete cluster** button (confirm; deleting a cluster
  reassigns its member nodes to a fallback cluster — see §7).
- A way to **select a cluster** to edit: a cluster list in the rail (reuse/extend the
  existing node-list rail pattern, or a compact list above it).

### 5.2 Node → cluster assignment
- `NodeForm`'s existing cluster picker (`aria-label="Cluster"`) now lists
  `DesignFile.clusters` instead of the hard-coded `SKILL_CLUSTERS`.

### 5.3 Auto-placement of a new cluster's region
- Pure helper `nextClusterRegion(existing: ReadonlyArray<DesignCluster>): Region`.
- Tiles regions left-to-right then wraps to a new row, using a fixed default size
  (e.g. `600×600`) and gutter, choosing the first slot that does not overlap any
  existing cluster's region. Deterministic and testable.

### 5.4 Layout preview
- `DesignerCanvas` passes `DesignFile.clusters` to `computeClusterLayout` /
  `constellationViewbox` instead of importing the hard-coded `SKILL_CLUSTERS`. New
  clusters therefore lay out and render in the designer immediately.
- **Loosen the layout signatures.** `computeClusterLayout` and `constellationViewbox`
  currently type their clusters param as `SkillClusterConfig` (which carries
  `completionBonus`/`completionArtPath`). `DesignCluster` lacks those, so introduce a
  minimal structural type in `core/clusterLayout.ts` —
  `interface LayoutCluster { readonly id: string; readonly region: { x; y; w; h: number } }`
  — and type both functions' param as `ReadonlyArray<LayoutCluster>`. Both
  `SkillClusterConfig` and `DesignCluster` satisfy it, so the runtime (`nodeLayout.ts`)
  and the designer can each pass their own cluster list with no behavior change.

## 6. Validation (the "one root per cluster" requirement)

Extend the designer's validation (`validation.ts`) so the ⚠ issue list reports, per
cluster:
- **No members** — a cluster with zero assigned nodes.
- **Root not set / not a member** — `rootNodeId` is empty or not a node in the cluster.
- **Root has a parent** — the chosen root's `parentIds` is non-empty.
- **Wrong number of roots** — the cluster's parentless members ≠ exactly `[rootNodeId]`
  (catches zero or multiple parentless nodes, and a root that isn't the parentless one).
- **Unknown clusterId** — a node whose `clusterId` references no cluster in `clusters`.

Each issue is a human-readable string in the existing issue list; issues do not block
saving (consistent with current designer behavior).

## 7. Persistence & migration

- `saveDraft`/`loadDraft` (localStorage) and `saveToFile` (`/api/skill-design`)
  serialize the whole `DesignFile`, so `clusters` ride along automatically.
- `migrate` (storage.ts) defaults a missing/invalid `clusters` to the seeded 7 so
  older drafts keep working. (Same defensive pattern as the node `clusterId` default.)
- `useDesignerState.loadFileBaseline()` reads `clusters` from `skillTreeDesign.json`
  (defaulting to the seeded 7 if absent).
- **Deleting a cluster** reassigns its members' `clusterId` to a fallback (the first
  remaining cluster, e.g. `inspiration`) so no node is left orphaned with an unknown
  `clusterId`.

## 8. Agent wiring handoff (documented, not built)

When the user saves a new/edited cluster, the agent:
1. Reads `clusters[]` from `skillTreeDesign.json`.
2. Adds/updates the matching entry in `src/config/skillClusters.ts` using the user's
   `id/name/theme/rootNodeId/region`, plus a minted `completionBonus`
   (`cluster_<id>_complete`) and `completionArtPath: null`.
3. Reconciles node `clusterId`s in `src/config/skillTreeNodes.ts` to match the JSON.
4. Runs the guard test (§9) to confirm JSON spec and TS runtime agree.

A short note documenting this handoff lives in `docs/agent_docs/` or the designer's
header text so the loop is discoverable.

## 9. Testing

- **`nextClusterRegion`** — returns a non-overlapping region; wraps rows; deterministic.
- **Cluster CRUD** (in `useDesignerState`) — add creates a unique id + auto region;
  delete removes the cluster and reassigns its members to the fallback.
- **Validation** — each rule in §6 fires on a crafted bad design and stays silent on a
  good one (exactly-one-root, root-with-parent, no-members, unknown-clusterId).
- **NodeForm picker** — lists `DesignFile.clusters` (including a user-added cluster) and
  emits a `clusterId` patch on change.
- **DesignerCanvas layout** — a node in a user-added cluster renders inside that
  cluster's region; nodes in unknown clusters are not placed.
- **Persistence round-trip** — a `DesignFile` with custom clusters survives
  save→load (localStorage) and the file-baseline default.
- **Guard test (agent-facing)** — `SKILL_CLUSTERS` (TS) and `skillTreeDesign.json`
  `clusters` agree on `id`, `rootNodeId`, and `region` for every wired cluster.

## 10. Out of scope (this spec)

- Editing `completionBonus` / wiring real bonus effects (agent-owned).
- Background-art placement UI / assets.
- Dragging a whole cluster region as a unit (user shapes by dragging stars).
- The runtime reading clusters live from JSON (explicitly rejected — author-as-spec).
- Renaming a cluster's `id` after creation with cascade to node `clusterId`s — out of
  scope; create with the intended id. (Members reference `clusterId`; an id-rename
  cascade can be a later nicety.)
