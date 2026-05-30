# Constellation Clusters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single FAME-hub skill tree with seven independent themed constellations ("clusters"), each opened by fame cost alone, each granting a placeholder completion bonus + background-art hook when fully maxed.

**Architecture:** Add an explicit cluster table (`skillClusters.ts`) and a per-node `clusterId`. Cut the five cross-cluster prerequisite links so each cluster is a self-contained DAG with one root. Retire the FAME hub: a new pure `core/clusterLayout.ts` lays out each cluster's DAG inside its own region of one big pannable night sky (replacing the dev-folder `computeAutoLayout` in the runtime path). Completion is *derived* from `purchasedNodes` each render and flows through the existing `hasCapability` tag system, so no save migration is needed.

**Tech Stack:** React 19 + TypeScript strict, Vite, Zustand 5, Vitest, SVG rendering. `@/` aliases `src/`.

> **Spec refinement (read before starting):** The spec (§7.2) said "hand-placed placeholder positions in the JSON." During planning we found all 44 nodes have `position: null` and positions are fully computed. So instead of hand-typing 44 coordinates, this plan computes per-cluster placeholder positions in `core/clusterLayout.ts`, still honoring any non-null authored `position` as an override. Net effect is identical (clusters in distinct regions, playable now, real shapes authored later) and far more maintainable.

---

## File structure

**New files:**
- `src/config/skillClusters.ts` — cluster table + lookup helpers (pure data).
- `src/core/clusterLayout.ts` — pure per-cluster regional layout (runtime owns this; no dev-folder dependency).
- `tests/config/skillClusters.test.ts` — cluster table + node→cluster invariants.
- `tests/core/clusterLayout.test.ts` — layout math.

**Modified files:**
- `src/config/skillTreeNodes.ts` — add `clusterId` to interface + every node; cut 4 of 5 parent links here.
- `src/config/skillTreeDesign.json` — add `clusterId` to every node; cut the same parent links (edge-render source of truth).
- `src/store/skillTreeSlice.ts` — `clusterComplete` selector; extend `hasCapability` to honor completed-cluster bonus tags.
- `src/components/constellation/nodeLayout.ts` — consume `clusterLayout`; drop FAME hub + `"fame"` edges; parent→child edges only; export per-cluster regions.
- `src/components/constellation/StarCanvas.tsx` — remove FAME hub; render completion background art per cluster.
- `src/components/constellation/MiniMap.tsx` — remove FAME hub dot.
- `src/components/constellation/ClusterList.tsx` — per-cluster owned/total + completion marker.
- `src/routes/ConstellationRoute.tsx` — wire per-cluster data into ClusterList.
- `src/dev/skill-designer/types.ts` — add `clusterId` to `DesignNode`.
- `src/dev/skill-designer/NodeForm.tsx` — cluster picker.
- `src/dev/skill-designer/useDesignerState.ts` — round-trip `clusterId` (baseline + new node default).
- `src/dev/skill-designer/DesignerCanvas.tsx` — remove FAME hub circle + `"fame"` edges.

**Test files updated (FAME-hub removal / link cuts):**
- `tests/store/skillTreeSlice.test.ts`, `tests/components/constellation/StarCanvas.test.tsx`, `tests/components/constellation/StarCanvas.fameHub.hover.test.tsx` (deleted), `tests/routes/ConstellationRoute.test.tsx`, `tests/dev/skill-designer/DesignerCanvas.test.tsx`, `tests/dev/skill-designer/autoLayout.test.ts` (only if it asserts runtime behavior — see Task 12).

---

## Phase A — Config & data model

### Task 1: Cluster table + lookup helpers

**Files:**
- Create: `src/config/skillClusters.ts`
- Test: `tests/config/skillClusters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config/skillClusters.test.ts
import { describe, it, expect } from "vitest";
import {
  SKILL_CLUSTERS,
  getClusterConfig,
  CLUSTER_IDS,
} from "@/config/skillClusters";

describe("SKILL_CLUSTERS table", () => {
  it("defines exactly the seven clusters", () => {
    expect(SKILL_CLUSTERS.map((c) => c.id).sort()).toEqual(
      [...CLUSTER_IDS].sort(),
    );
    expect(SKILL_CLUSTERS).toHaveLength(7);
  });

  it("has unique ids and unique completion-bonus tags", () => {
    const ids = SKILL_CLUSTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tags = SKILL_CLUSTERS.map((c) => c.completionBonus);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("each cluster declares a non-empty region with positive size", () => {
    for (const c of SKILL_CLUSTERS) {
      expect(c.region.w).toBeGreaterThan(0);
      expect(c.region.h).toBeGreaterThan(0);
    }
  });

  it("getClusterConfig returns the cluster or null", () => {
    expect(getClusterConfig("colors")?.name).toBe("Colors");
    expect(getClusterConfig("nope")).toBeNull();
  });

  it("completionArtPath is null for every cluster (assets come later)", () => {
    for (const c of SKILL_CLUSTERS) {
      expect(c.completionArtPath).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/skillClusters.test.ts`
Expected: FAIL — cannot resolve `@/config/skillClusters`.

- [ ] **Step 3: Write the cluster table**

```ts
// src/config/skillClusters.ts
import type { SkillNodeId } from "@/config/skillTreeNodes";

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
  { id: "school", name: "School", theme: "Open the Painting School for permanent research.", rootNodeId: "unlock_school", completionBonus: "cluster_school_complete", region: { x: 1760, y: 1060, w: 420, h: 420 }, completionArtPath: null },
];

/** All known cluster ids, for exhaustive checks. */
export const CLUSTER_IDS: ReadonlyArray<SkillClusterId> = SKILL_CLUSTERS.map(
  (c) => c.id,
);

/** Lookup helper. Returns null if id unknown. */
export function getClusterConfig(id: SkillClusterId): SkillClusterConfig | null {
  return SKILL_CLUSTERS.find((c) => c.id === id) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config/skillClusters.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/skillClusters.ts tests/config/skillClusters.test.ts
git commit -m "config(constellation): add seven-cluster table + lookup helpers"
```

---

### Task 2: Add `clusterId` to every node + cut the five cross-cluster links

This task changes both sources of truth together so they never diverge: `skillTreeNodes.ts` (prereq logic) and `skillTreeDesign.json` (edge rendering). It also adds `getClusterNodes` to `skillClusters.ts`.

**Files:**
- Modify: `src/config/skillTreeNodes.ts` (interface + all 44 entries + 4 link cuts)
- Modify: `src/config/skillTreeDesign.json` (all 44 entries + 5 link cuts)
- Modify: `src/config/skillClusters.ts` (add `getClusterNodes`)
- Test: `tests/config/skillClusters.test.ts` (extend with invariants)

> Note: 4 cuts are in `skillTreeNodes.ts` and the SAME 5 cuts in the JSON. Both tables list 5 cross-cluster children; they are identical sets. "4 vs 5" is only because one file is read for prereqs and one for edges — apply all five to BOTH.

- [ ] **Step 1: Write the failing invariant tests** (append to `tests/config/skillClusters.test.ts`)

```ts
import { SKILL_NODES, getSkillNodeConfig } from "@/config/skillTreeNodes";
import { getClusterNodes } from "@/config/skillClusters";

describe("node → cluster invariants", () => {
  it("every node has a clusterId pointing at a known cluster", () => {
    const known = new Set(SKILL_CLUSTERS.map((c) => c.id));
    for (const n of SKILL_NODES) {
      expect(known.has(n.clusterId)).toBe(true);
    }
  });

  it("every node belongs to exactly one cluster (partition by clusterId)", () => {
    const counts = new Map<string, number>();
    for (const n of SKILL_NODES) {
      counts.set(n.clusterId, (counts.get(n.clusterId) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(SKILL_NODES.length);
    expect(SKILL_NODES.length).toBe(44);
  });

  it("each cluster has exactly one root, equal to its declared rootNodeId", () => {
    for (const c of SKILL_CLUSTERS) {
      const members = getClusterNodes(c.id);
      const roots = members.filter((n) => n.parentIds.length === 0);
      expect(roots.map((r) => r.id)).toEqual([c.rootNodeId]);
    }
  });

  it("has no cross-cluster edges — every parent shares the child's cluster", () => {
    for (const n of SKILL_NODES) {
      for (const pid of n.parentIds) {
        const parent = getSkillNodeConfig(pid);
        expect(parent, `parent ${pid} of ${n.id} exists`).not.toBeNull();
        expect(parent!.clusterId).toBe(n.clusterId);
      }
    }
  });

  it("each cluster is internally connected from its root", () => {
    for (const c of SKILL_CLUSTERS) {
      const members = getClusterNodes(c.id);
      const ids = new Set(members.map((n) => n.id));
      // reachable from root following child links
      const childrenOf = new Map<string, string[]>();
      for (const n of members) {
        for (const p of n.parentIds) {
          if (!childrenOf.has(p)) childrenOf.set(p, []);
          childrenOf.get(p)!.push(n.id);
        }
      }
      const seen = new Set<string>([c.rootNodeId]);
      const queue = [c.rootNodeId];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const ch of childrenOf.get(cur) ?? []) {
          if (!seen.has(ch)) {
            seen.add(ch);
            queue.push(ch);
          }
        }
      }
      expect(seen.size).toBe(ids.size);
    }
  });

  it("the five named cross-cluster parents are cut", () => {
    expect(getSkillNodeConfig("black_white")!.parentIds).not.toContain("basic_technique");
    expect(getSkillNodeConfig("genius_episode")!.parentIds).not.toContain("muscle_memory");
    expect(getSkillNodeConfig("unrelentless")!.parentIds).not.toContain("fast_learner");
    expect(getSkillNodeConfig("entrepreneur")!.parentIds).not.toContain("forget_pain");
    expect(getSkillNodeConfig("unlock_school")!.parentIds).not.toContain("accelerator");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/config/skillClusters.test.ts`
Expected: FAIL — `clusterId` missing on nodes / `getClusterNodes` not exported.

- [ ] **Step 3a: Add `getClusterNodes` to `src/config/skillClusters.ts`**

Append at the bottom of the file:

```ts
import { SKILL_NODES, type SkillNodeConfig } from "@/config/skillTreeNodes";

/** All nodes whose clusterId === id, in table order. */
export function getClusterNodes(
  id: SkillClusterId,
): ReadonlyArray<SkillNodeConfig> {
  return SKILL_NODES.filter((n) => n.clusterId === id);
}
```

(Keep the existing `import type { SkillNodeId }` line at the top; this adds a value import of `SKILL_NODES`.)

- [ ] **Step 3b: Add `clusterId` to the interface in `src/config/skillTreeNodes.ts`**

In `interface SkillNodeConfig`, add after the `id` field:

```ts
  readonly id: SkillNodeId;
  /** Which constellation cluster this node belongs to. See skillClusters.ts. */
  readonly clusterId: string;
```

- [ ] **Step 3c: Replace the `SKILL_NODES` array body** in `src/config/skillTreeNodes.ts` with the version below (adds `clusterId` to all 44 nodes; removes the 5 cross-cluster parents — see the four `parentIds: []` roots `black_white`, `genius_episode`, `unrelentless`, `entrepreneur` and `unlock_school`)

```ts
export const SKILL_NODES: ReadonlyArray<SkillNodeConfig> = [
  { id: "get_inspired", clusterId: "inspiration", name: "Get Inspired", description: "each level increase inspiration gain", numericEffect: "50%", parentIds: [], stacking: "additive", kind: "minor", maxLevel: 5, costs: [1, 2, 3, 5, 8], unlocks: [] },
  { id: "black_white", clusterId: "colors", name: "Black & White", description: "increases canvas sell price", numericEffect: "50%", parentIds: [], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3], unlocks: [] },
  { id: "magenta", clusterId: "colors", name: "Magenta", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "cyan", clusterId: "colors", name: "Cyan", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "yellow", clusterId: "colors", name: "Yellow", description: "increases canvas sell price", numericEffect: "80%", parentIds: ["black_white"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [8], unlocks: [] },
  { id: "red", clusterId: "colors", name: "Red", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["magenta", "yellow"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "green", clusterId: "colors", name: "Green", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["yellow", "cyan"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "blue", clusterId: "colors", name: "Blue", description: "increases canvas sell price", numericEffect: "130%", parentIds: ["cyan", "magenta"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [20], unlocks: [] },
  { id: "purple", clusterId: "colors", name: "Purple", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["blue", "red"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "brown", clusterId: "colors", name: "Brown", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["green", "blue"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "orange", clusterId: "colors", name: "Orange", description: "increases canvas sell price", numericEffect: "200%", parentIds: ["red", "green"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "rainbow", clusterId: "colors", name: "Rainbow", description: "increases canvas sell price", numericEffect: "500%", parentIds: ["orange", "brown", "purple"], stacking: "multiplicative", kind: "major", maxLevel: 1, costs: [150], unlocks: [] },
  { id: "poke_tree", clusterId: "inspiration", name: "Poke the Tree", description: "Get 100 inspiration every 10 secondes.\nEach level doubles it", numericEffect: "100", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "basic_technique", clusterId: "workshop", name: "Basic Technique", description: "Each level makes canvas painting 10% faster.", numericEffect: "10%", parentIds: [], stacking: "additive", kind: "minor", maxLevel: 5, costs: [1, 2, 3, 4, 5], unlocks: [] },
  { id: "muscle_memory", clusterId: "workshop", name: "Muscle Memory", description: "Each level makes canvas painting 10% faster.", numericEffect: "10%", parentIds: ["basic_technique"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "gear_up", clusterId: "workshop", name: "Gear Up", description: "Unlocks a second equipment slot for palette items.", numericEffect: "+1 palette slot", parentIds: ["muscle_memory"], stacking: "additive", kind: "major", maxLevel: 1, costs: [15], unlocks: [] },
  { id: "Bargain", clusterId: "inspiration", name: "Bargain", description: "Each level decreases inspiration tree upgrade cost by 5%", numericEffect: "5%", parentIds: ["get_inspired"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [3, 5, 8, 12, 20], unlocks: [] },
  { id: "craftsmanship", clusterId: "workshop", name: "Craftsmanship", description: "Each level add %5 to min and max item rollable affix magnitude.", numericEffect: "5%", parentIds: ["gear_up"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20, 35, 60, 100, 160], unlocks: [] },
  { id: "wooden_chest", clusterId: "workshop", name: "Wooden Chest", description: "adds 2 item storage slots", numericEffect: "2", parentIds: ["craftsmanship"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "shredder", clusterId: "workshop", name: "shredder", description: "you can craft when inventory is full, it will destroy the oldest crafted item inside.", numericEffect: "1", parentIds: ["craftsmanship"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [50], unlocks: [] },
  { id: "taylorsim", clusterId: "workshop", name: "Taylorism", description: "Autocraft a free Item every 10s.", numericEffect: "1", parentIds: ["shredder"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [120], unlocks: [] },
  { id: "steel_chest", clusterId: "workshop", name: "Steel Chest", description: "adds 2 item storage slots", numericEffect: "2", parentIds: ["wooden_chest"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [120], unlocks: [] },
  { id: "forget_pain", clusterId: "workshop", name: "Forget your back pain", description: "Unlock Easel item slot", numericEffect: "1", parentIds: ["steel_chest", "taylorsim"], stacking: "additive", kind: "major", maxLevel: 1, costs: [300], unlocks: [] },
  { id: "painters_hat", clusterId: "workshop", name: "Enjoyable Shade", description: "Unlock the Hat equipment slot.", numericEffect: "+1 hat slot", parentIds: ["painters_apron"], stacking: "additive", kind: "major", maxLevel: 1, costs: [10000], unlocks: [] },
  { id: "painters_apron", clusterId: "workshop", name: "No More Stains", description: "Unlock the Apron equipment slot.", numericEffect: "+1 apron slot", parentIds: ["socks", "better_scaling"], stacking: "additive", kind: "major", maxLevel: 1, costs: [6000], unlocks: [] },
  { id: "monk_internship", clusterId: "workshop", name: "Monk Internship", description: "increases #% min/max affixes magnitude", numericEffect: "10", parentIds: ["forget_pain"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [700], unlocks: [] },
  { id: "entrepreneur", clusterId: "office", name: "Entrepreneur", description: "unlocks the Worker Office tab ", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [700], unlocks: ["roster_slot"] },
  { id: "genius_episode", clusterId: "crit", name: "Genius Episode", description: "unlocks Critical upgrade for your canvas (and associated affixes)", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [10], unlocks: ["canvas_crit"] },
  { id: "consistency", clusterId: "crit", name: "Consistency", description: "increases crit chance by 1%", numericEffect: "1", parentIds: ["genius_episode"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20, 35, 60, 100, 160], unlocks: ["crit_chance"] },
  { id: "fast_learner", clusterId: "crit", name: "Fast Learner", description: "each canvas upgrade is 2% more effective", numericEffect: "2", parentIds: ["consistency"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [50, 100, 200, 350, 600], unlocks: [] },
  { id: "unrelentless", clusterId: "combo", name: "unrelentless", description: "unlocks Combo upgrade for your canvas (and associated affixes)", numericEffect: "1", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [150], unlocks: ["canvas_combo"] },
  { id: "hire_manager", clusterId: "office", name: "Hire Manager", description: "Each level adds +1 roster slot for hired workers.", numericEffect: "+1", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [4500, 6000, 8000, 10000], unlocks: ["roster_slot"] },
  { id: "accelerator", clusterId: "office", name: "Accelerator Program", description: "Each level boosts the worker ascend-XP pool by +10%.", numericEffect: "10%", parentIds: ["entrepreneur"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [4500, 6000, 7500, 9000, 10000], unlocks: ["worker_xp_mult"] },
  { id: "afterburner", clusterId: "combo", name: "Afterburner", description: "Each level reduces combo decay by 1 percentage point per chain link.", numericEffect: "-1pp", parentIds: ["unrelentless"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [300, 500, 800, 1200], unlocks: ["combo_decay_reduction"] },
  { id: "enlightenment", clusterId: "inspiration", name: "Enlightenment", description: "Each level reduces the inspiration needed to ascend by 5%.", numericEffect: "-5%", parentIds: ["Bargain"], stacking: "additive", kind: "minor", maxLevel: 4, costs: [8, 15, 25, 40], unlocks: ["ascend_threshold_reduction"] },
  { id: "patron", clusterId: "inspiration", name: "Patron", description: "Each level boosts inspiration gain by +10% (stacks with Get Inspired).", numericEffect: "10%", parentIds: ["poke_tree"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [8, 15, 25, 40, 60], unlocks: ["inspi_mult_bonus"] },
  { id: "third_hand", clusterId: "workshop", name: "Third Hand", description: "reduces the time for autocraft by #% ", numericEffect: "10", parentIds: ["forget_pain"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [600, 900, 1400, 2000, 3000], unlocks: [] },
  { id: "painters_boots", clusterId: "workshop", name: "Warm Feet", description: "unlocks the boot Item slot", numericEffect: "+1 boots slot", parentIds: ["monk_internship", "third_hand"], stacking: "additive", kind: "major", maxLevel: 1, costs: [1500], unlocks: [] },
  { id: "better_scaling", clusterId: "workshop", name: "Better Scaling", description: "for each workshop level, give +# to min and max item affix magnitude ", numericEffect: "1", parentIds: ["painters_boots"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3500], unlocks: [] },
  { id: "socks", clusterId: "workshop", name: "Socks", description: "equiped boots get +#% efficency.", numericEffect: "50", parentIds: ["painters_boots"], stacking: "additive", kind: "minor", maxLevel: 1, costs: [3500], unlocks: [] },
  { id: "unlock_school", clusterId: "school", name: "Painting School", description: "Unlocks the Painting School — research permanent bonuses one at a time.", numericEffect: "", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [25000], unlocks: ["school_access"] },
  { id: "ma_specialist", clusterId: "workshop", name: "M&A specialist", description: "You can now merge epic and legendary items with other items of the same tier even if they don't share the same affixes type. Affixes outcome will be randomized.", numericEffect: "", parentIds: ["better_scaling"], stacking: "additive", kind: "major", maxLevel: 1, costs: [10000], unlocks: ["cross_affix_fusion"] },
  { id: "quantitative_easing", clusterId: "workshop", name: "Quantitative easing", description: "Each level halves the price of merging items.", numericEffect: "×0.5", parentIds: ["ma_specialist"], stacking: "multiplicative", kind: "minor", maxLevel: 5, costs: [15000, 20000, 25000, 30000, 35000], unlocks: ["fuse_cost_halving"] },
  { id: "expert_manufacture", clusterId: "workshop", name: "Expert manufacture", description: "Each level increases the min and max item affix magnitude by 25%.", numericEffect: "25%", parentIds: ["ma_specialist"], stacking: "additive", kind: "minor", maxLevel: 5, costs: [20000, 20000, 20000, 20000, 20000], unlocks: ["affix_magnitude_pct"] },
];
```

- [ ] **Step 3d: Update `src/config/skillTreeDesign.json`** — for every node object add `"clusterId": "<id>"` (use the same mapping as the table above), and remove the cross-cluster parent from these five nodes so their `parentIds` become `[]`:
  - `black_white`: `"parentIds": []`
  - `genius_episode`: `"parentIds": []`
  - `unrelentless`: `"parentIds": []`
  - `entrepreneur`: `"parentIds": []`
  - `unlock_school`: `"parentIds": []`

  Leave every other node's `parentIds` unchanged. (The JSON is the edge-render source; it must match `skillTreeNodes.ts`.)

- [ ] **Step 4: Run the invariant tests + typecheck**

Run: `npx vitest run tests/config/skillClusters.test.ts`
Expected: PASS (all invariants).
Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "skillTreeNodes|skillClusters"`
Expected: no output (no type errors in these files). *(Pre-existing unrelated tsc errors in office/catchup test files are known — ignore those.)*

- [ ] **Step 5: Add a guard test that JSON and TS agree on parents/clusters** (append to `tests/config/skillClusters.test.ts`)

```ts
import design from "@/config/skillTreeDesign.json";

describe("design JSON ↔ runtime table agreement", () => {
  it("parentIds and clusterId match between JSON and SKILL_NODES", () => {
    const byId = new Map(SKILL_NODES.map((n) => [n.id, n]));
    for (const dn of design.nodes as ReadonlyArray<{ id: string; parentIds: string[]; clusterId?: string }>) {
      const rt = byId.get(dn.id);
      expect(rt, `runtime node ${dn.id}`).toBeDefined();
      expect([...rt!.parentIds].sort()).toEqual([...dn.parentIds].sort());
      expect(dn.clusterId).toBe(rt!.clusterId);
    }
  });
});
```

- [ ] **Step 6: Run + commit**

Run: `npx vitest run tests/config/skillClusters.test.ts`
Expected: PASS.

```bash
git add src/config/skillTreeNodes.ts src/config/skillTreeDesign.json src/config/skillClusters.ts tests/config/skillClusters.test.ts
git commit -m "config(constellation): assign clusterId to all nodes + cut five cross-cluster links"
```

---

### Task 3: Fix the prereq tests broken by the link cuts

Cutting parents changes purchase behavior (e.g. `black_white` is now buyable with no prerequisite). Update `tests/store/skillTreeSlice.test.ts` accordingly.

**Files:**
- Modify: `tests/store/skillTreeSlice.test.ts`

- [ ] **Step 1: Run the existing suite to see what breaks**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts`
Expected: Some FAILs around `black_white`/`genius_episode`/`unrelentless`/`entrepreneur`/`unlock_school` requiring an old parent.

- [ ] **Step 2: Update the failing cases**

For every assertion that depended on a now-cut prerequisite (e.g. "cannot buy `black_white` until `basic_technique` owned"), change it to reflect the new reality: these five nodes are roots and buyable immediately given enough fame. If a test seeds `purchasedNodes` with an old parent solely to unlock one of these five, drop that seed. Keep cost/level/maxLevel assertions intact.

Add one positive test confirming a cut root is now purchasable from scratch:

```ts
it("cut roots are purchasable without their former parent", () => {
  const store = freshStore(); // however the suite builds a store
  store.getState().grant?.("fame", 1000); // adapt to the suite's fame-granting helper
  expect(store.getState().buyNode("genius_episode")).toBe(true);
  expect(store.getState().purchasedNodes["genius_episode"]).toBe(1);
});
```

(Adapt `freshStore`/fame-granting to the helpers already used in this file.)

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/store/skillTreeSlice.test.ts
git commit -m "test(constellation): update prereq tests for cut cluster roots"
```

---

## Phase B — Completion system

### Task 4: `clusterComplete` selector

**Files:**
- Modify: `src/store/skillTreeSlice.ts` (add selector near the other selectors)
- Test: `tests/store/skillTreeSlice.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/store/skillTreeSlice.test.ts`)

```ts
import { clusterComplete } from "@/store/skillTreeSlice";
import { getClusterNodes } from "@/config/skillClusters";

describe("clusterComplete", () => {
  it("is false when a member node is below maxLevel", () => {
    const state = { purchasedNodes: { unlock_school: 0 } };
    expect(clusterComplete(state, "school")).toBe(false);
  });

  it("is true when every member node is at maxLevel", () => {
    // build a purchasedNodes map maxing every node in the cluster
    const maxed: Record<string, number> = {};
    for (const n of getClusterNodes("crit")) maxed[n.id] = n.maxLevel;
    expect(clusterComplete({ purchasedNodes: maxed }, "crit")).toBe(true);
  });

  it("is false for an unknown cluster id", () => {
    expect(clusterComplete({ purchasedNodes: {} }, "nope")).toBe(false);
  });

  it("is false for a cluster with one maxed and one unmaxed node", () => {
    const maxed: Record<string, number> = {};
    const nodes = getClusterNodes("combo");
    nodes.forEach((n, i) => { maxed[n.id] = i === 0 ? n.maxLevel : 0; });
    expect(clusterComplete({ purchasedNodes: maxed }, "combo")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t clusterComplete`
Expected: FAIL — `clusterComplete` not exported.

- [ ] **Step 3: Implement the selector** in `src/store/skillTreeSlice.ts`

Add imports at the top (the file already imports from `@/config/skillTreeNodes`):

```ts
import { getClusterConfig, getClusterNodes } from "@/config/skillClusters";
import type { SkillClusterId } from "@/config/skillClusters";
```

Add near the other selectors (after `getNodeLevel`):

```ts
/**
 * True iff every node in the cluster is at its maxLevel. Derived purely from
 * purchasedNodes — completion is recomputed each render, never stored, so no
 * save migration is involved. Unknown cluster id → false.
 */
export const clusterComplete = (
  state: Pick<GameStore, "purchasedNodes">,
  clusterId: SkillClusterId,
): boolean => {
  if (getClusterConfig(clusterId) === null) return false;
  const nodes = getClusterNodes(clusterId);
  if (nodes.length === 0) return false;
  return nodes.every((n) => getNodeLevel(state, n.id) >= n.maxLevel);
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t clusterComplete`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/skillTreeSlice.ts tests/store/skillTreeSlice.test.ts
git commit -m "store(constellation): derive clusterComplete from purchasedNodes"
```

---

### Task 5: Route completion-bonus tags through `hasCapability`

When a cluster is complete, its `completionBonus` tag should read as an active capability — so future multipliers consume it via the same path as node `unlocks` tags. Placeholder: no consumer yet, so behavior is inert beyond the tag resolving.

**Files:**
- Modify: `src/store/skillTreeSlice.ts` (extend `hasCapability`)
- Test: `tests/store/skillTreeSlice.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/store/skillTreeSlice.test.ts`)

```ts
import { hasCapability } from "@/store/skillTreeSlice";
import { getClusterNodes, getClusterConfig } from "@/config/skillClusters";

describe("hasCapability honors completed-cluster bonus tags", () => {
  it("resolves a cluster's completionBonus tag once the cluster is complete", () => {
    const tag = getClusterConfig("crit")!.completionBonus;
    const maxed: Record<string, number> = {};
    for (const n of getClusterNodes("crit")) maxed[n.id] = n.maxLevel;
    expect(hasCapability({ purchasedNodes: maxed }, tag)).toBe(true);
  });

  it("does NOT resolve the bonus tag while the cluster is incomplete", () => {
    const tag = getClusterConfig("crit")!.completionBonus;
    expect(hasCapability({ purchasedNodes: {} }, tag)).toBe(false);
  });

  it("still resolves ordinary node unlock tags", () => {
    expect(hasCapability({ purchasedNodes: { genius_episode: 1 } }, "canvas_crit")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "completed-cluster"`
Expected: FAIL — the completion tag does not resolve.

- [ ] **Step 3: Extend `hasCapability`** in `src/store/skillTreeSlice.ts`

Add `SKILL_CLUSTERS` to the cluster import:

```ts
import { SKILL_CLUSTERS, getClusterConfig, getClusterNodes } from "@/config/skillClusters";
```

Replace the body of `hasCapability` with:

```ts
export const hasCapability = (state: Pick<GameStore, "purchasedNodes">, capability: string): boolean => {
  for (const [nodeId, level] of Object.entries(state.purchasedNodes)) {
    if ((level ?? 0) < 1) continue;
    const config = getSkillNodeConfig(nodeId);
    if (config && config.unlocks.includes(capability)) return true;
  }
  // Completed clusters grant their completionBonus tag as an active capability.
  for (const cluster of SKILL_CLUSTERS) {
    if (cluster.completionBonus === capability && clusterComplete(state, cluster.id)) {
      return true;
    }
  }
  return false;
};
```

(`clusterComplete` is defined in the same module — make sure it is declared above `hasCapability`, or rely on function hoisting; since both are `const` arrow functions, place `clusterComplete` ABOVE `hasCapability` in the file.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "completed-cluster"`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full slice suite to catch regressions**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/skillTreeSlice.ts tests/store/skillTreeSlice.test.ts
git commit -m "store(constellation): completed clusters grant their bonus capability tag"
```

---

## Phase C — Layout (retire the FAME hub)

### Task 6: Pure per-cluster regional layout

A new pure module that lays out each cluster's DAG inside its region (root near region center, children fanned outward by radial BFS — the same wedge idea as the old `computeAutoLayout`, but per cluster and hubless). Honors a non-null authored `position` override.

**Files:**
- Create: `src/core/clusterLayout.ts`
- Test: `tests/core/clusterLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/clusterLayout.test.ts
import { describe, it, expect } from "vitest";
import { computeClusterLayout } from "@/core/clusterLayout";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { SKILL_CLUSTERS, getClusterConfig } from "@/config/skillClusters";

describe("computeClusterLayout", () => {
  const layout = computeClusterLayout(SKILL_NODES, SKILL_CLUSTERS);

  it("places every node", () => {
    for (const n of SKILL_NODES) {
      expect(layout[n.id], `position for ${n.id}`).toBeDefined();
    }
  });

  it("places each node inside (or near) its cluster region", () => {
    for (const n of SKILL_NODES) {
      const region = getClusterConfig(n.clusterId)!.region;
      const p = layout[n.id]!;
      // within region expanded by a generous margin
      const m = 200;
      expect(p.x).toBeGreaterThanOrEqual(region.x - m);
      expect(p.x).toBeLessThanOrEqual(region.x + region.w + m);
      expect(p.y).toBeGreaterThanOrEqual(region.y - m);
      expect(p.y).toBeLessThanOrEqual(region.y + region.h + m);
    }
  });

  it("honors a non-null authored position override", () => {
    const overridden = SKILL_NODES.map((n) =>
      n.id === "get_inspired" ? { ...n, position: { x: 42, y: 99 } } : n,
    );
    const l = computeClusterLayout(overridden, SKILL_CLUSTERS);
    expect(l["get_inspired"]).toEqual({ x: 42, y: 99 });
  });
});
```

> Note: `SkillNodeConfig` has no `position` field; the override path reads an OPTIONAL `position` if present. The function accepts nodes typed as `SkillNodeConfig & { position?: {x,y}|null }`. Runtime callers (Task 7) pass JSON nodes that DO carry `position`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/clusterLayout.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/core/clusterLayout.ts`**

```ts
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
 * Lay out every node inside its cluster's region. Each cluster is an independent
 * radial-BFS tree rooted at its single root node, centered on the region center.
 * Hubless — there is no FAME node. Non-null authored positions override.
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
    const cx = cluster.region.x + cluster.region.w / 2;
    const cy = cluster.region.y + cluster.region.h / 2;

    // children index within this cluster
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

    // Root(s): if one root, place it AT the region center; if more, ring them.
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/clusterLayout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/clusterLayout.ts tests/core/clusterLayout.test.ts
git commit -m "core(constellation): pure per-cluster regional layout (hubless)"
```

---

### Task 7: Rewrite `nodeLayout.ts` — hubless, cluster-based

**Files:**
- Modify: `src/components/constellation/nodeLayout.ts` (full rewrite)
- Test: `tests/components/constellation/nodeLayout.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/constellation/nodeLayout.test.ts
import { describe, it, expect } from "vitest";
import { NODE_POSITIONS, EDGES, VIEWBOX, CLUSTER_REGIONS } from "@/components/constellation/nodeLayout";
import { SKILL_NODES } from "@/config/skillTreeNodes";

describe("nodeLayout (hubless)", () => {
  it("has a position for every node", () => {
    for (const n of SKILL_NODES) {
      expect(NODE_POSITIONS[n.id]).toBeDefined();
    }
  });

  it("emits no fame edges — every edge is parent→child between real nodes", () => {
    const ids = new Set(SKILL_NODES.map((n) => n.id));
    for (const e of EDGES) {
      expect(e.from).not.toBe("fame");
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it("exposes one region per cluster for background art", () => {
    expect(CLUSTER_REGIONS.length).toBe(7);
    for (const r of CLUSTER_REGIONS) {
      expect(r.completionArtPath).toBeNull();
      expect(r.region.w).toBeGreaterThan(0);
    }
  });

  it("VIEWBOX covers all node positions", () => {
    for (const n of SKILL_NODES) {
      const p = NODE_POSITIONS[n.id]!;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(VIEWBOX.width);
      expect(p.y).toBeLessThanOrEqual(VIEWBOX.height);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/constellation/nodeLayout.test.ts`
Expected: FAIL — `CLUSTER_REGIONS` not exported / `from` may still allow `"fame"`.

- [ ] **Step 3: Rewrite `src/components/constellation/nodeLayout.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/components/constellation/nodeLayout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/constellation/nodeLayout.ts tests/components/constellation/nodeLayout.test.ts
git commit -m "ui(constellation): hubless cluster-based node layout + regions"
```

---

## Phase D — Runtime UI

### Task 8: StarCanvas — remove FAME hub, render completion art

**Files:**
- Modify: `src/components/constellation/StarCanvas.tsx`
- Delete: `tests/components/constellation/StarCanvas.fameHub.hover.test.tsx`
- Modify: `tests/components/constellation/StarCanvas.test.tsx`

- [ ] **Step 1: Write/adjust the failing test** in `tests/components/constellation/StarCanvas.test.tsx`

Add:

```ts
it("renders no fame hub", () => {
  // render StarCanvas with the suite's existing harness/props
  const { queryByTestId } = renderStarCanvas(); // adapt to existing helper
  expect(queryByTestId("fame-hub")).toBeNull();
});

it("renders a completion-art layer slot per cluster (hidden until complete)", () => {
  const { container } = renderStarCanvas();
  // art layers exist in the DOM but are not rendered while incomplete/null asset
  expect(container.querySelectorAll('[data-testid^="cluster-art-"]').length).toBe(0);
});
```

Delete `tests/components/constellation/StarCanvas.fameHub.hover.test.tsx` (the hub it tests no longer exists):

```bash
git rm tests/components/constellation/StarCanvas.fameHub.hover.test.tsx
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/constellation/StarCanvas.test.tsx`
Expected: FAIL — `fame-hub` still present.

- [ ] **Step 3: Edit `src/components/constellation/StarCanvas.tsx`**

3a. Update the import from `./nodeLayout` (remove `FAME_HUB`, add `CLUSTER_REGIONS`):

```ts
import { EDGES, NODE_POSITIONS, VIEWBOX, CLUSTER_REGIONS, type EdgeFrom } from "./nodeLayout";
```

3b. Delete the `fameHubBody()` helper function (lines defining it) and the entire `<g data-testid="fame-hub">…</g>` block.

3c. Simplify `pointFor` (no fame branch):

```ts
function pointFor(id: EdgeFrom): { x: number; y: number } {
  return NODE_POSITIONS[id] ?? { x: 0, y: 0 };
}
```

3d. In the `EDGES.map(...)` block, replace the `fromOwned` line (it special-cased `"fame"`):

```ts
const fromOwned = (nodeStates[from]?.level ?? 0) > 0;
```

3e. Add a completion-art layer. Accept a new prop on `Props`:

```ts
interface Props {
  selectedId: SkillNodeId | null;
  onSelect: (id: SkillNodeId) => void;
  nodeStates: Record<SkillNodeId, NodeState>;
  viewport: ViewportState;
  onViewportChange: (v: ViewportState) => void;
  /** cluster ids that are fully complete (drives background art). */
  completedClusterIds: ReadonlySet<string>;
}
```

Destructure `completedClusterIds` in the component signature. Then, immediately AFTER the three background `<rect>`s and BEFORE the `<g>` of TWINKLES, insert the art layer:

```tsx
<g aria-hidden="true">
  {CLUSTER_REGIONS.map((c) =>
    c.completionArtPath && completedClusterIds.has(c.id) ? (
      <image
        key={c.id}
        data-testid={`cluster-art-${c.id}`}
        href={c.completionArtPath}
        x={c.region.x}
        y={c.region.y}
        width={c.region.w}
        height={c.region.h}
        opacity={0.85}
        preserveAspectRatio="xMidYMid meet"
      />
    ) : null,
  )}
</g>
```

(Because `completionArtPath` is `null` for all clusters now, this renders nothing yet — exactly the placeholder behavior. The slot is wired for when assets land.)

- [ ] **Step 4: Update the caller (ConstellationRoute) to pass `completedClusterIds`**

In `src/routes/ConstellationRoute.tsx`, compute and pass the set:

```tsx
import { SKILL_CLUSTERS } from "@/config/skillClusters";
import { clusterComplete } from "@/store/skillTreeSlice";
// ...
const completedClusterIds = new Set(
  SKILL_CLUSTERS.filter((c) => clusterComplete({ purchasedNodes }, c.id)).map((c) => c.id),
);
// ...
<StarCanvas
  selectedId={selectedId}
  onSelect={setSelectedId}
  nodeStates={nodeStates}
  viewport={viewport}
  onViewportChange={setViewport}
  completedClusterIds={completedClusterIds}
/>
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/components/constellation/StarCanvas.test.tsx tests/routes/ConstellationRoute.test.tsx`
Expected: PASS (update any ConstellationRoute assertions that referenced the fame hub; remove them).

- [ ] **Step 6: Commit**

```bash
git add src/components/constellation/StarCanvas.tsx src/routes/ConstellationRoute.tsx tests/components/constellation/StarCanvas.test.tsx
git commit -m "ui(constellation): remove FAME hub from StarCanvas; add per-cluster completion-art layer"
```

---

### Task 9: MiniMap — remove FAME hub dot

**Files:**
- Modify: `src/components/constellation/MiniMap.tsx`
- Modify: `tests/components/constellation/` MiniMap test if one asserts the hub (search first)

- [ ] **Step 1: Adjust/add test**

Search for MiniMap fame assertions:

Run: `npx vitest run tests/components/constellation 2>&1 | head -40` (observe failures after edit) — or grep:
Run: `grep -rn "FAME_HUB\|fame" tests/components/constellation/MiniMap*` (if file exists).

If a MiniMap test references the hub, update it to assert no hub circle. Otherwise add a minimal render test asserting the component still mounts and shows the owned count.

- [ ] **Step 2: Edit `src/components/constellation/MiniMap.tsx`**

2a. Update the import (remove `FAME_HUB`):

```ts
import { NODE_POSITIONS, VIEWBOX } from "./nodeLayout";
```

2b. Delete the line:

```tsx
<circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="8" fill="var(--fame)" opacity="0.8" />
```

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run tests/components/constellation/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/constellation/MiniMap.tsx tests/components/constellation/
git commit -m "ui(constellation): drop FAME hub dot from minimap"
```

---

### Task 10: ClusterList — per-cluster progress + completion marker

**Files:**
- Modify: `src/components/constellation/ClusterList.tsx`
- Modify: `src/routes/ConstellationRoute.tsx` (compute + pass per-cluster rows)
- Test: `tests/components/constellation/ClusterList.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/constellation/ClusterList.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ClusterList } from "@/components/constellation/ClusterList";

describe("ClusterList", () => {
  const rows = [
    { id: "colors", name: "Colors", owned: 11, total: 11, complete: true },
    { id: "school", name: "School", owned: 0, total: 1, complete: false },
  ];

  it("renders a row per cluster with owned/total", () => {
    const { getByText } = render(<ClusterList rows={rows} />);
    expect(getByText("Colors")).toBeTruthy();
    expect(getByText("11 / 11")).toBeTruthy();
    expect(getByText("0 / 1")).toBeTruthy();
  });

  it("marks completed clusters", () => {
    const { getByTestId } = render(<ClusterList rows={rows} />);
    expect(getByTestId("cluster-row-colors").getAttribute("data-complete")).toBe("true");
    expect(getByTestId("cluster-row-school").getAttribute("data-complete")).toBe("false");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/constellation/ClusterList.test.tsx`
Expected: FAIL — `ClusterList` still takes `ownedCount`/`totalCount`.

- [ ] **Step 3: Rewrite `src/components/constellation/ClusterList.tsx`**

```tsx
import type { JSX } from "react";
import styles from "./ClusterList.module.css";

export interface ClusterRow {
  id: string;
  name: string;
  owned: number;
  total: number;
  complete: boolean;
}

interface Props {
  rows: ReadonlyArray<ClusterRow>;
}

export function ClusterList({ rows }: Props): JSX.Element {
  return (
    <section className={styles.panel} aria-label="Clusters">
      <div className={styles.subhead}>Constellations</div>
      <ul className={styles.list}>
        {rows.map((r) => (
          <li
            key={r.id}
            className={styles.row}
            data-testid={`cluster-row-${r.id}`}
            data-complete={r.complete ? "true" : "false"}
          >
            <span className={styles.name}>
              {r.name}
              {r.complete ? " ★" : ""}
            </span>
            <span className={styles.count}>
              {r.owned} / {r.total}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Update `src/routes/ConstellationRoute.tsx` to build rows**

Replace the `<ClusterList ownedCount={ownedCount} totalCount={SKILL_NODES.length} />` usage with:

```tsx
import { SKILL_CLUSTERS, getClusterNodes } from "@/config/skillClusters";
// ...
const clusterRows = SKILL_CLUSTERS.map((c) => {
  const members = getClusterNodes(c.id);
  const owned = members.filter((n) => (purchasedNodes[n.id] ?? 0) > 0).length;
  return {
    id: c.id,
    name: c.name,
    owned,
    total: members.length,
    complete: completedClusterIds.has(c.id),
  };
});
// ...
<ClusterList rows={clusterRows} />
```

(Remove the now-unused `ownedCount` computation if nothing else uses it. `ownedById` is still used by MiniMap — keep it.)

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/components/constellation/ClusterList.test.tsx tests/routes/ConstellationRoute.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/constellation/ClusterList.tsx src/routes/ConstellationRoute.tsx tests/components/constellation/ClusterList.test.tsx
git commit -m "ui(constellation): per-cluster progress list with completion marker"
```

---

## Phase E — Designer (keep it working + cluster field)

### Task 11: DesignNode gains `clusterId`; NodeForm cluster picker; round-trip

**Files:**
- Modify: `src/dev/skill-designer/types.ts`
- Modify: `src/dev/skill-designer/useDesignerState.ts`
- Modify: `src/dev/skill-designer/NodeForm.tsx`
- Test: `tests/dev/skill-designer/` (extend existing or add NodeForm test)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/dev/skill-designer/NodeForm.cluster.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { NodeForm } from "@/dev/skill-designer/NodeForm";
import type { DesignNode } from "@/dev/skill-designer/types";

const node: DesignNode = {
  id: "x", name: "X", description: "", numericEffect: "",
  parentIds: [], stacking: "additive", kind: "minor",
  maxLevel: 1, costs: [0], unlocks: [], position: null, clusterId: "colors",
};

describe("NodeForm cluster picker", () => {
  it("shows the current clusterId and emits a patch on change", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <NodeForm node={node} allNodes={[node]} onChange={onChange} onDelete={() => {}} />,
    );
    const select = getByLabelText(/cluster/i) as HTMLSelectElement;
    expect(select.value).toBe("colors");
    fireEvent.change(select, { target: { value: "workshop" } });
    expect(onChange).toHaveBeenCalledWith("x", { clusterId: "workshop" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/NodeForm.cluster.test.tsx`
Expected: FAIL — `clusterId` not on `DesignNode` / no cluster control.

- [ ] **Step 3a: Add `clusterId` to `DesignNode`** in `src/dev/skill-designer/types.ts`

```ts
export interface DesignNode {
  id: string;
  name: string;
  description: string;
  numericEffect: string;
  parentIds: ReadonlyArray<string>;
  stacking: StackingMode;
  kind: NodeKind;
  maxLevel: number;
  costs: ReadonlyArray<number>;
  unlocks: ReadonlyArray<string>;
  position: { x: number; y: number } | null;
  /** Which constellation cluster this node belongs to. */
  clusterId: string;
}
```

- [ ] **Step 3b: Round-trip `clusterId`** in `src/dev/skill-designer/useDesignerState.ts`

In `loadFileBaseline()`'s node map, add:

```ts
      position: n.position,
      clusterId: ((n as { clusterId?: string }).clusterId ?? "inspiration") as string,
```

In `addNode()`'s `newNode`, add `clusterId`:

```ts
        position: null,
        clusterId: "inspiration",
```

- [ ] **Step 3c: Add the cluster picker** in `src/dev/skill-designer/NodeForm.tsx`

Add the import at the top:

```ts
import { SKILL_CLUSTERS } from "@/config/skillClusters";
```

Insert this field right after the ID field (`<label>` for "ID (slug)"):

```tsx
      <label className={styles.field}>
        <span className={styles.label}>Cluster</span>
        <select
          className={styles.input}
          aria-label="Cluster"
          value={node.clusterId}
          onChange={(e) => patch({ clusterId: e.target.value })}
        >
          {SKILL_CLUSTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
```

Also update the roots hint text (FAME no longer exists):

```tsx
        {node.parentIds.length === 0 && (
          <span className={styles.subLabel}>No parents — this node is its cluster's root.</span>
        )}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/dev/skill-designer/NodeForm.cluster.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/types.ts src/dev/skill-designer/useDesignerState.ts src/dev/skill-designer/NodeForm.tsx tests/dev/skill-designer/NodeForm.cluster.test.tsx
git commit -m "dev(skill-designer): clusterId field + cluster picker, round-tripped"
```

---

### Task 12: DesignerCanvas — remove FAME hub + fame edges

**Files:**
- Modify: `src/dev/skill-designer/DesignerCanvas.tsx`
- Modify: `tests/dev/skill-designer/DesignerCanvas.test.tsx`
- Check: `tests/dev/skill-designer/autoLayout.test.ts` (only edit if it asserts `"fame"` edges/hub for the canvas — the dev `autoLayout` itself stays)

- [ ] **Step 1: Adjust the failing test** in `tests/dev/skill-designer/DesignerCanvas.test.tsx`

Replace any assertion expecting `fame-hub` or `designer-edge-fame-*` with:

```ts
it("renders no fame hub and no fame-sourced edges", () => {
  const { queryByTestId, container } = renderDesignerCanvas(); // adapt to existing helper
  expect(queryByTestId("fame-hub")).toBeNull();
  expect(container.querySelector('[data-testid^="designer-edge-fame-"]')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/DesignerCanvas.test.tsx`
Expected: FAIL — hub + fame edges still rendered.

- [ ] **Step 3: Edit `src/dev/skill-designer/DesignerCanvas.tsx`**

3a. Update the import (drop `FAME_HUB_X`, `FAME_HUB_Y`):

```ts
import {
  computeAutoLayout,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "./autoLayout";
```

3b. Simplify `pointFor` to not special-case fame:

```ts
function pointFor(id: string): { x: number; y: number } {
  return positions[id] ?? { x: 0, y: 0 };
}
```

3c. In the edges `<g>`, replace the `parentKeys`/`fromKey` logic so root nodes simply draw no incoming edge:

```tsx
        <g>
          {nodes.flatMap((node) => {
            const b = pointFor(node.id);
            return node.parentIds.map((fromKey) => {
              const a = pointFor(fromKey);
              return (
                <line
                  key={`${fromKey}-${node.id}`}
                  data-testid={`designer-edge-${fromKey}-${node.id}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--ink-line)"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              );
            });
          })}
        </g>
```

3d. Delete the entire `<g data-testid="fame-hub">…</g>` block (the FAME circle + label).

> The dev-side `computeAutoLayout` (in `autoLayout.ts`) still references `FAME_HUB_X/Y` internally as a layout origin — that's fine and stays; it is no longer the runtime layout. Do NOT delete `autoLayout.ts`. Root nodes will cluster near that origin in the designer; precise cluster regions are the follow-up spec's job.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/dev/skill-designer/DesignerCanvas.test.tsx tests/dev/skill-designer/autoLayout.test.ts`
Expected: PASS. (If `autoLayout.test.ts` only tests the pure layout function, it should be unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/DesignerCanvas.tsx tests/dev/skill-designer/DesignerCanvas.test.tsx
git commit -m "dev(skill-designer): remove FAME hub + fame edges from canvas"
```

---

## Phase F — Full verification

### Task 13: Whole-suite green + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All green. If failures remain, they are likely stragglers still referencing the FAME hub or an old prereq — fix in place, re-run.

- [ ] **Step 2: Typecheck your touched files**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -vE "tests/(store/persistence-integration|.*office|.*catchup)"`
Expected: no errors attributable to this work. *(The known pre-existing red tsc test files — office/catchup — are not in scope; verify your files aren't the source.)*

- [ ] **Step 3: Manual smoke (dev server)**

Run the app, open the Constellation route. Confirm:
- No FAME hub anywhere; seven separated constellations visible by panning/zooming.
- Each cluster's root is buyable with enough fame (toggle [DEV] Free nodes to verify all become purchasable independently).
- ClusterList shows seven rows with per-cluster owned/total; maxing a small cluster (e.g. School: buy `unlock_school`) flips its row to complete (★).
- Open `/dev/skill-designer`: it loads, the cluster picker works, dragging a star still moves it, no FAME hub.

- [ ] **Step 4: Final commit (if any smoke fixes)**

```bash
git add -A
git commit -m "fix(constellation): post-smoke cleanups"
```

---

## Self-review notes (for the executor)

- **No save migration:** node IDs are unchanged; only parent arrays shrank and a `clusterId` was added. Existing `purchasedNodes` saves keep working. Do not add migration code.
- **Two sources of truth:** every parent-link or cluster change must land in BOTH `skillTreeNodes.ts` and `skillTreeDesign.json`. Task 2 Step 5 guards this with a test — keep it green.
- **Placeholder bonuses are intentional:** `completionBonus` tags resolve through `hasCapability` but no multiplier consumes them yet. Do not invent bonus numbers — that is a later pass.
- **Layout is computed, not hand-authored:** real pencil/palette shapes + background-art placement are the follow-up designer spec. `completionArtPath` is `null` everywhere now, so the art `<image>` layer renders nothing yet — that is correct.
