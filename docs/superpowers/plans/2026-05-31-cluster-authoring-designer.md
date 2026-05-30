# Cluster Authoring in the Skill Designer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user create and edit constellation clusters (each with one validated root) inside `/dev/skill-designer`, persisted into `skillTreeDesign.json` as a spec the agent later wires into the runtime.

**Architecture:** `DesignFile` gains a `clusters` array (the 7 existing clusters are seeded into the JSON). The designer reads/edits clusters from that file: a cluster list + cluster form for CRUD, the node form's picker lists the file's clusters, the canvas lays out from them, and validation enforces exactly one root per cluster. The game keeps reading the hand-coded `SKILL_CLUSTERS`; the agent reconciles TS ⇄ JSON on save (guard test). Author-as-spec — saving never touches the player's game save.

**Tech Stack:** React 19 + TypeScript strict, Vite, Vitest, `@testing-library/react`. `@/` aliases `src/`. **Real typecheck is `npx tsc -b`** (root `tsconfig.json` is a references stub — `tsc -p tsconfig.json` checks nothing). Tests: `npx vitest run <path>`.

---

## File structure

**New files:**
- `src/dev/skill-designer/clusterRegion.ts` — pure `nextClusterRegion` auto-placement helper.
- `src/dev/skill-designer/ClusterListRail.tsx` — cluster list + "Add Cluster" (rail section).
- `src/dev/skill-designer/ClusterForm.tsx` — edit a selected cluster (name, theme, root picker, delete).
- `tests/dev/skill-designer/clusterRegion.test.ts`, `ClusterForm.test.tsx`, `ClusterListRail.test.tsx`, `clusterCrud.test.ts`, `clusterValidation.test.ts`, `clusterPersistence.test.ts`, `clusterGuard.test.ts`.

**Modified files:**
- `src/dev/skill-designer/types.ts` — `DesignCluster` type; `DesignFile.clusters`; `EMPTY_DESIGN`.
- `src/core/clusterLayout.ts` — loosen cluster param to a minimal `LayoutCluster`.
- `src/config/skillTreeDesign.json` — seed `clusters` (the 7).
- `src/dev/skill-designer/storage.ts` — migrate/default `clusters`.
- `src/dev/skill-designer/useDesignerState.ts` — cluster CRUD + cluster selection; read `clusters` from file.
- `src/dev/skill-designer/validation.ts` — cluster validation rules.
- `src/dev/skill-designer/NodeForm.tsx` — cluster picker reads a `clusters` prop.
- `src/dev/skill-designer/DesignerCanvas.tsx` — lay out from a `clusters` prop.
- `src/dev/skill-designer/SkillDesignerRoute.tsx` — integrate list/form, selection, pass clusters.
- `tests/dev/skill-designer/NodeForm.cluster.test.tsx` — pass the new `clusters` prop.
- `docs/agent_docs/cluster-authoring-handoff.md` — the wiring handoff note.

---

## Phase A — Data model & pure helpers

### Task 1: `DesignCluster` type + loosen the layout signature

**Files:**
- Modify: `src/dev/skill-designer/types.ts`
- Modify: `src/core/clusterLayout.ts`
- Test: `tests/core/clusterLayout.test.ts` (add one case)

- [ ] **Step 1: Write the failing test** — append to `tests/core/clusterLayout.test.ts`

```ts
import { computeClusterLayout as ccl2, constellationViewbox as cv2 } from "@/core/clusterLayout";

describe("layout accepts a minimal {id, region} cluster (LayoutCluster)", () => {
  const minimalClusters = [{ id: "a", region: { x: 0, y: 0, w: 600, h: 600 } }];
  const nodes = [{ id: "n1", clusterId: "a", parentIds: [] as string[] }];
  it("lays out a node from a minimal cluster shape", () => {
    const pos = ccl2(nodes, minimalClusters);
    expect(pos["n1"]).toBeDefined();
  });
  it("constellationViewbox accepts the minimal shape", () => {
    const vb = cv2(ccl2(nodes, minimalClusters), minimalClusters);
    expect(vb.width).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/clusterLayout.test.ts`
Expected: FAIL — TS rejects the minimal cluster (missing `name`/`completionBonus`/etc.) OR a type error surfaces in `tsc -b`. (Vitest strips types, so the test may PASS at runtime even while `tsc -b` is red — in that case treat the `tsc -b` error in Step 4 as the failing signal.)

- [ ] **Step 3a: Loosen `src/core/clusterLayout.ts`**

Add this exported interface near the top (after `Position`):

```ts
/** Minimal cluster shape the layout needs — satisfied by SkillClusterConfig and DesignCluster. */
export interface LayoutCluster {
  readonly id: string;
  readonly region: { x: number; y: number; w: number; h: number };
}
```

Change both function signatures to use it (replace `ReadonlyArray<SkillClusterConfig>` with `ReadonlyArray<LayoutCluster>`):

```ts
export function computeClusterLayout(
  nodes: ReadonlyArray<LayoutNode>,
  clusters: ReadonlyArray<LayoutCluster>,
): Record<string, Position> {
```

```ts
export function constellationViewbox(
  positions: Record<string, Position>,
  clusters: ReadonlyArray<LayoutCluster>,
): { width: number; height: number } {
```

Remove the now-unused `import type { SkillClusterConfig } from "@/config/skillClusters";` if nothing else in the file uses it. (`paddedRegion` takes a plain region object, so it doesn't need it.)

- [ ] **Step 3b: Add `DesignCluster` to `src/dev/skill-designer/types.ts`**

```ts
export interface DesignCluster {
  id: string;
  name: string;
  theme: string;
  rootNodeId: string;
  region: { x: number; y: number; w: number; h: number };
}
```

Add `clusters` to `DesignFile`:

```ts
export interface DesignFile {
  version: 1;
  title: string;
  designedAt: string;
  nodes: ReadonlyArray<DesignNode>;
  clusters: ReadonlyArray<DesignCluster>;
}
```

Update `EMPTY_DESIGN` to include `clusters: []`:

```ts
export const EMPTY_DESIGN: DesignFile = {
  version: 1,
  title: "Untitled draft",
  designedAt: "",
  nodes: [],
  clusters: [],
};
```

- [ ] **Step 4: Run test + real typecheck**

Run: `npx vitest run tests/core/clusterLayout.test.ts` → PASS.
Run: `npx tsc -b` → may show errors in `useDesignerState.ts`/`storage.ts`/`SkillDesignerRoute.tsx` because `DesignFile` now requires `clusters` (those are fixed in later tasks). Confirm there are NO errors in `clusterLayout.ts` or `types.ts` themselves. If `nodeLayout.ts` errors, it shouldn't — `SkillClusterConfig` still satisfies `LayoutCluster`.

> NOTE: this task intentionally leaves `tsc -b` red on `DesignFile`-consuming files until Task 3/4 set `clusters`. That's expected; do not patch those files here.

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/types.ts src/core/clusterLayout.ts tests/core/clusterLayout.test.ts
git commit -m "types(skill-designer): DesignCluster + DesignFile.clusters; loosen layout to LayoutCluster"
```

---

### Task 2: `nextClusterRegion` auto-placement helper

**Files:**
- Create: `src/dev/skill-designer/clusterRegion.ts`
- Test: `tests/dev/skill-designer/clusterRegion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dev/skill-designer/clusterRegion.test.ts
import { describe, it, expect } from "vitest";
import { nextClusterRegion, CLUSTER_DEFAULT_SIZE } from "@/dev/skill-designer/clusterRegion";

interface C { region: { x: number; y: number; w: number; h: number }; }

function overlaps(a: C["region"], b: C["region"]): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe("nextClusterRegion", () => {
  it("places the first cluster at the origin slot with the default size", () => {
    const r = nextClusterRegion([]);
    expect(r).toEqual({ x: 0, y: 0, w: CLUSTER_DEFAULT_SIZE, h: CLUSTER_DEFAULT_SIZE });
  });

  it("returns a region that overlaps none of the existing ones", () => {
    const existing = [
      { region: { x: 0, y: 0, w: 600, h: 600 } },
      { region: { x: 700, y: 0, w: 760, h: 760 } },
      { region: { x: 1560, y: 0, w: 960, h: 960 } },
    ];
    const r = nextClusterRegion(existing);
    for (const c of existing) expect(overlaps(r, c.region)).toBe(false);
  });

  it("is deterministic", () => {
    const existing = [{ region: { x: 0, y: 0, w: 600, h: 600 } }];
    expect(nextClusterRegion(existing)).toEqual(nextClusterRegion(existing));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/clusterRegion.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/dev/skill-designer/clusterRegion.ts`**

```ts
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CLUSTER_DEFAULT_SIZE = 600;
const GUTTER = 120;
const COLUMNS = 4;

function overlaps(a: Region, b: Region): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Pick a non-overlapping default region for a new cluster. Scans a coarse grid
 * (CLUSTER_DEFAULT_SIZE + GUTTER cells, COLUMNS wide, row by row) and returns the
 * first cell whose default-sized region clears every existing cluster region.
 * Deterministic.
 */
export function nextClusterRegion(
  existing: ReadonlyArray<{ region: Region }>,
): Region {
  const step = CLUSTER_DEFAULT_SIZE + GUTTER;
  for (let row = 0; row < 1000; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const candidate: Region = {
        x: col * step,
        y: row * step,
        w: CLUSTER_DEFAULT_SIZE,
        h: CLUSTER_DEFAULT_SIZE,
      };
      if (existing.every((c) => !overlaps(candidate, c.region))) return candidate;
    }
  }
  // Fallback (unreachable in practice): stack below everything.
  const maxBottom = existing.reduce((m, c) => Math.max(m, c.region.y + c.region.h), 0);
  return { x: 0, y: maxBottom + GUTTER, w: CLUSTER_DEFAULT_SIZE, h: CLUSTER_DEFAULT_SIZE };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/clusterRegion.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/clusterRegion.ts tests/dev/skill-designer/clusterRegion.test.ts
git commit -m "feat(skill-designer): nextClusterRegion auto-placement helper"
```

---

### Task 3: Seed clusters into the JSON + persistence migration

**Files:**
- Modify: `src/config/skillTreeDesign.json`
- Modify: `src/dev/skill-designer/storage.ts`
- Modify: `src/dev/skill-designer/useDesignerState.ts`
- Test: `tests/dev/skill-designer/clusterPersistence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dev/skill-designer/clusterPersistence.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, STORAGE_KEY } from "@/dev/skill-designer/storage";
import design from "@/config/skillTreeDesign.json";
import type { DesignFile } from "@/dev/skill-designer/types";

describe("cluster persistence", () => {
  beforeEach(() => localStorage.clear());

  it("the design file seeds the seven clusters", () => {
    const ids = (design as { clusters: { id: string }[] }).clusters.map((c) => c.id).sort();
    expect(ids).toEqual(["colors", "combo", "crit", "inspiration", "office", "school", "workshop"]);
  });

  it("each seeded cluster's rootNodeId is a node whose clusterId matches and has no parents", () => {
    const d = design as { clusters: { id: string; rootNodeId: string }[]; nodes: { id: string; clusterId: string; parentIds: string[] }[] };
    for (const c of d.clusters) {
      const root = d.nodes.find((n) => n.id === c.rootNodeId);
      expect(root, c.id).toBeDefined();
      expect(root!.clusterId).toBe(c.id);
      expect(root!.parentIds).toEqual([]);
    }
  });

  it("round-trips custom clusters through localStorage", () => {
    const file: DesignFile = {
      version: 1, title: "t", designedAt: "", nodes: [],
      clusters: [{ id: "music", name: "Music", theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 600, h: 600 } }],
    };
    saveDraft(file);
    const back = loadDraft();
    expect(back?.clusters).toEqual(file.clusters);
  });

  it("defaults clusters to the seeded set for a legacy draft missing clusters", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, title: "old", designedAt: "", nodes: [] }));
    const back = loadDraft();
    expect(back?.clusters.map((c) => c.id).sort()).toContain("workshop");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/clusterPersistence.test.ts`
Expected: FAIL — `design.clusters` undefined; `loadDraft` doesn't populate clusters.

- [ ] **Step 3a: Seed `src/config/skillTreeDesign.json`**

Add a top-level `"clusters"` array (sibling of `"nodes"`) with exactly these 7 entries:

```json
"clusters": [
  { "id": "inspiration", "name": "Inspiration", "theme": "Grow and harvest the inspiration tree.", "rootNodeId": "get_inspired", "region": { "x": 0, "y": 0, "w": 600, "h": 600 } },
  { "id": "colors", "name": "Colors", "theme": "Master the color wheel to raise canvas value.", "rootNodeId": "black_white", "region": { "x": 700, "y": 0, "w": 760, "h": 760 } },
  { "id": "workshop", "name": "Workshop", "theme": "Craft, store, and equip items; paint faster.", "rootNodeId": "basic_technique", "region": { "x": 1560, "y": 0, "w": 960, "h": 960 } },
  { "id": "crit", "name": "Crit", "theme": "Land critical strokes on the canvas.", "rootNodeId": "genius_episode", "region": { "x": 0, "y": 700, "w": 520, "h": 520 } },
  { "id": "combo", "name": "Combo", "theme": "Chain strokes into escalating combos.", "rootNodeId": "unrelentless", "region": { "x": 620, "y": 860, "w": 420, "h": 420 } },
  { "id": "office", "name": "Office", "theme": "Hire and grow a studio of workers.", "rootNodeId": "entrepreneur", "region": { "x": 1140, "y": 1060, "w": 520, "h": 420 } },
  { "id": "school", "name": "School", "theme": "Open the Painting School for permanent research.", "rootNodeId": "unlock_school", "region": { "x": 1760, "y": 1060, "w": 420, "h": 420 } }
]
```

(These mirror `SKILL_CLUSTERS` in `src/config/skillClusters.ts` exactly, minus `completionBonus`/`completionArtPath`.)

- [ ] **Step 3b: Migrate clusters in `src/dev/skill-designer/storage.ts`**

Add a seed constant + cluster handling. At the top, import the JSON and the type:

```ts
import type { DesignFile, DesignNode, DesignCluster } from "./types";
import designJson from "@/config/skillTreeDesign.json";

const SEED_CLUSTERS = designJson.clusters as ReadonlyArray<DesignCluster>;
```

In `loadDraft`, after building the migrated nodes, default clusters:

```ts
    if (parsed && parsed.version === 1 && Array.isArray(parsed.nodes)) {
      return {
        ...parsed,
        nodes: parsed.nodes.map(migrateNode),
        clusters: Array.isArray(parsed.clusters) && parsed.clusters.length > 0
          ? (parsed.clusters as ReadonlyArray<DesignCluster>)
          : SEED_CLUSTERS,
      } as DesignFile;
    }
```

(`saveDraft` already `JSON.stringify`s the whole file, so clusters persist with no change.)

- [ ] **Step 3c: Read clusters in `src/dev/skill-designer/useDesignerState.ts`**

In `loadFileBaseline()`, add `clusters` to the returned object:

```ts
    nodes: designJson.nodes.map((n) => ({ /* unchanged */ })),
    clusters: (designJson.clusters ?? []) as ReadonlyArray<DesignCluster>,
  };
```

Add the import: `import type { ..., DesignCluster } from "./types";` (extend the existing type import).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/clusterPersistence.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/skillTreeDesign.json src/dev/skill-designer/storage.ts src/dev/skill-designer/useDesignerState.ts tests/dev/skill-designer/clusterPersistence.test.ts
git commit -m "feat(skill-designer): seed clusters into design file + persist/migrate"
```

---

### Task 4: Cluster CRUD + cluster selection in `useDesignerState`

**Files:**
- Modify: `src/dev/skill-designer/useDesignerState.ts`
- Test: `tests/dev/skill-designer/clusterCrud.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dev/skill-designer/clusterCrud.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDesignerState } from "@/dev/skill-designer/useDesignerState";

beforeEach(() => localStorage.clear());

describe("cluster CRUD", () => {
  it("addCluster creates a unique id, a non-overlapping region, and selects it", () => {
    const { result } = renderHook(() => useDesignerState());
    const before = result.current.design.clusters.length;
    act(() => result.current.actions.addCluster());
    const after = result.current.design.clusters;
    expect(after.length).toBe(before + 1);
    const created = after[after.length - 1]!;
    expect(after.filter((c) => c.id === created.id).length).toBe(1);
    expect(result.current.selectedClusterId).toBe(created.id);
  });

  it("updateCluster patches fields", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addCluster());
    const id = result.current.selectedClusterId!;
    act(() => result.current.actions.updateCluster(id, { name: "Music", rootNodeId: "x" }));
    const c = result.current.design.clusters.find((c) => c.id === id)!;
    expect(c.name).toBe("Music");
    expect(c.rootNodeId).toBe("x");
  });

  it("deleteCluster removes it and reassigns its member nodes to the first remaining cluster", () => {
    const { result } = renderHook(() => useDesignerState());
    // get_inspired belongs to "inspiration"; delete inspiration → it should move to the new first cluster.
    const firstId = result.current.design.clusters[0]!.id;
    const fallbackId = result.current.design.clusters[1]!.id;
    act(() => result.current.actions.deleteCluster(firstId));
    expect(result.current.design.clusters.find((c) => c.id === firstId)).toBeUndefined();
    const moved = result.current.design.nodes.filter((n) => n.clusterId === firstId);
    expect(moved.length).toBe(0);
    const inFallback = result.current.design.nodes.some((n) => n.clusterId === fallbackId);
    expect(inFallback).toBe(true);
  });

  it("selecting a node clears cluster selection and vice versa", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addCluster());
    expect(result.current.selectedClusterId).not.toBeNull();
    act(() => result.current.actions.selectNode("get_inspired"));
    expect(result.current.selectedClusterId).toBeNull();
    expect(result.current.selectedId).toBe("get_inspired");
    act(() => result.current.actions.selectCluster(result.current.design.clusters[0]!.id));
    expect(result.current.selectedId).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/clusterCrud.test.ts`
Expected: FAIL — `addCluster`/`selectedClusterId` etc. not defined.

- [ ] **Step 3: Implement in `src/dev/skill-designer/useDesignerState.ts`**

Add imports: `import { nextClusterRegion } from "./clusterRegion";` and ensure `DesignCluster` is imported from `./types`.

Add to the `DesignerActions` interface:

```ts
  addCluster: () => void;
  updateCluster: (id: string, patch: Partial<DesignCluster>) => void;
  deleteCluster: (id: string) => void;
  selectCluster: (id: string | null) => void;
```

Add to `DesignerState`:

```ts
  selectedClusterId: string | null;
```

Add state in the hook (next to `selectedId`):

```ts
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
```

Add a unique-cluster-id helper (mirror `uniqueId`):

```ts
function uniqueClusterId(existing: ReadonlyArray<DesignCluster>): string {
  let i = existing.length + 1;
  while (existing.some((c) => c.id === `cluster_${i}`)) i += 1;
  return `cluster_${i}`;
}
```

Implement the actions:

```ts
  const addCluster = useCallback(() => {
    setDesign((d) => {
      const id = uniqueClusterId(d.clusters);
      const cluster: DesignCluster = {
        id,
        name: "New Cluster",
        theme: "",
        rootNodeId: "",
        region: nextClusterRegion(d.clusters),
      };
      queueMicrotask(() => { setSelectedClusterId(id); setSelectedId(null); });
      return { ...d, clusters: [...d.clusters, cluster] };
    });
  }, []);

  const updateCluster = useCallback((id: string, patch: Partial<DesignCluster>) => {
    setDesign((d) => ({
      ...d,
      clusters: d.clusters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const deleteCluster = useCallback((id: string) => {
    setDesign((d) => {
      const remaining = d.clusters.filter((c) => c.id !== id);
      const fallback = remaining[0]?.id ?? "inspiration";
      return {
        ...d,
        clusters: remaining,
        nodes: d.nodes.map((n) => (n.clusterId === id ? { ...n, clusterId: fallback } : n)),
      };
    });
    setSelectedClusterId((cur) => (cur === id ? null : cur));
  }, []);

  const selectCluster = useCallback((id: string | null) => {
    setSelectedClusterId(id);
    if (id !== null) setSelectedId(null);
  }, []);
```

Modify `selectNode` to clear cluster selection:

```ts
  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id !== null) setSelectedClusterId(null);
  }, []);
```

> Avoid `queueMicrotask` if the existing file already sets selection synchronously elsewhere — prefer matching the file's style. If `setSelectedClusterId`/`setSelectedId` can be called directly inside the updater is undesirable, set them right after `setDesign` instead:
> ```ts
> const addCluster = useCallback(() => {
>   setDesign((d) => { /* compute + return as above, capturing id via a ref or recompute */ });
> }, []);
> ```
> Simplest robust form: compute the new id from current state via the functional update, and set selection in a follow-up effect keyed on `clusters.length`. If unsure, set selection by computing `uniqueClusterId(design.clusters)` BEFORE `setDesign` and using that same id for both the new cluster and `setSelectedClusterId(id)` synchronously. Use that approach:
> ```ts
> const addCluster = useCallback(() => {
>   const id = uniqueClusterId(design.clusters);
>   const cluster: DesignCluster = { id, name: "New Cluster", theme: "", rootNodeId: "", region: nextClusterRegion(design.clusters) };
>   setDesign((d) => ({ ...d, clusters: [...d.clusters, cluster] }));
>   setSelectedClusterId(id);
>   setSelectedId(null);
> }, [design.clusters]);
> ```

Return `selectedClusterId` and the new actions from the hook:

```ts
  return {
    design,
    selectedId,
    selectedClusterId,
    actions: { addNode, updateNode, deleteNode, selectNode, resetAll, importDesign,
               addCluster, updateCluster, deleteCluster, selectCluster },
  };
```

Also clear `selectedClusterId` in `resetAll` and `importDesign` (`setSelectedClusterId(null)`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/clusterCrud.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/useDesignerState.ts tests/dev/skill-designer/clusterCrud.test.ts
git commit -m "feat(skill-designer): cluster CRUD + cluster selection state"
```

---

## Phase B — Validation

### Task 5: Cluster validation rules

**Files:**
- Modify: `src/dev/skill-designer/validation.ts`
- Test: `tests/dev/skill-designer/clusterValidation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dev/skill-designer/clusterValidation.test.ts
import { describe, it, expect } from "vitest";
import { validateDesign } from "@/dev/skill-designer/validation";
import type { DesignNode, DesignCluster } from "@/dev/skill-designer/types";

function node(p: Partial<DesignNode> & { id: string; clusterId: string }): DesignNode {
  return { name: p.id, description: "", numericEffect: "", parentIds: [], stacking: "additive",
    kind: "minor", maxLevel: 1, costs: [0], unlocks: [], position: null, ...p };
}
function cluster(p: Partial<DesignCluster> & { id: string }): DesignCluster {
  return { name: p.id, theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 600, h: 600 }, ...p };
}

describe("cluster validation", () => {
  it("flags a cluster with no members", () => {
    const issues = validateDesign([], [cluster({ id: "c1", rootNodeId: "x" })]);
    expect(issues.some((i) => i.type === "cluster_empty" && i.nodeId === "c1")).toBe(true);
  });

  it("flags a root that has a parent", () => {
    const nodes = [node({ id: "r", clusterId: "c1" }), node({ id: "k", clusterId: "c1", parentIds: ["r"] })];
    // root chosen = k, but k has a parent
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "k" })]);
    expect(issues.some((i) => i.type === "cluster_root_has_parent" && i.nodeId === "c1")).toBe(true);
  });

  it("flags when the parentless members are not exactly [rootNodeId]", () => {
    const nodes = [node({ id: "a", clusterId: "c1" }), node({ id: "b", clusterId: "c1" })]; // two roots
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "a" })]);
    expect(issues.some((i) => i.type === "cluster_root_count" && i.nodeId === "c1")).toBe(true);
  });

  it("flags a node whose clusterId references an unknown cluster", () => {
    const nodes = [node({ id: "a", clusterId: "ghost" })];
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "" })]);
    expect(issues.some((i) => i.type === "unknown_cluster" && i.nodeId === "a")).toBe(true);
  });

  it("is silent on a well-formed cluster (one root, root parentless, members present)", () => {
    const nodes = [node({ id: "r", clusterId: "c1" }), node({ id: "k", clusterId: "c1", parentIds: ["r"] })];
    const issues = validateDesign(nodes, [cluster({ id: "c1", rootNodeId: "r" })]);
    const clusterIssues = issues.filter((i) => i.type.startsWith("cluster_") || i.type === "unknown_cluster");
    expect(clusterIssues).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/clusterValidation.test.ts`
Expected: FAIL — `validateDesign` takes one arg; new issue types missing.

- [ ] **Step 3: Extend `src/dev/skill-designer/validation.ts`**

Add the new issue types to the union:

```ts
export type ValidationIssueType =
  | "duplicate_id"
  | "missing_parent"
  | "cycle"
  | "orphan"
  | "costs_length_mismatch"
  | "cluster_empty"
  | "cluster_root_has_parent"
  | "cluster_root_count"
  | "unknown_cluster";
```

Add the import: `import type { DesignNode, DesignCluster } from "./types";`

Change the signature to accept clusters (default `[]` so the existing single-arg call site keeps compiling until Task 9):

```ts
export function validateDesign(
  nodes: ReadonlyArray<DesignNode>,
  clusters: ReadonlyArray<DesignCluster> = [],
): ReadonlyArray<ValidationIssue> {
```

At the END of the function (before `return issues;`), add the cluster checks:

```ts
  const clusterIds = new Set(clusters.map((c) => c.id));

  // Unknown cluster reference on a node.
  for (const node of nodes) {
    if (!clusterIds.has(node.clusterId)) {
      issues.push({
        type: "unknown_cluster",
        nodeId: node.id,
        message: `Node "${node.id}" references unknown cluster "${node.clusterId}"`,
      });
    }
  }

  for (const cluster of clusters) {
    const members = nodes.filter((n) => n.clusterId === cluster.id);
    if (members.length === 0) {
      issues.push({ type: "cluster_empty", nodeId: cluster.id, message: `Cluster "${cluster.id}" has no nodes` });
      continue;
    }
    const root = members.find((n) => n.id === cluster.rootNodeId);
    const parentless = members.filter((n) => n.parentIds.length === 0).map((n) => n.id).sort();
    if (root && root.parentIds.length > 0) {
      issues.push({ type: "cluster_root_has_parent", nodeId: cluster.id, message: `Root "${cluster.rootNodeId}" of cluster "${cluster.id}" has a parent` });
    }
    if (parentless.length !== 1 || parentless[0] !== cluster.rootNodeId) {
      issues.push({
        type: "cluster_root_count",
        nodeId: cluster.id,
        message: `Cluster "${cluster.id}" must have exactly one root (its parentless node) equal to "${cluster.rootNodeId}"; found [${parentless.join(", ")}]`,
      });
    }
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/clusterValidation.test.ts` → PASS (5 tests).
Run: `npx vitest run tests/dev/skill-designer/` → existing validation tests still pass (single-arg call defaults clusters to `[]`, so no node gets an `unknown_cluster` issue when clusters is empty — verify the existing `validation.test.ts` still green).

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/validation.ts tests/dev/skill-designer/clusterValidation.test.ts
git commit -m "feat(skill-designer): validate one-root-per-cluster + unknown clusterId"
```

---

## Phase C — UI

### Task 6: NodeForm + DesignerCanvas consume a `clusters` prop

**Files:**
- Modify: `src/dev/skill-designer/NodeForm.tsx`
- Modify: `src/dev/skill-designer/DesignerCanvas.tsx`
- Modify: `src/dev/skill-designer/SkillDesignerRoute.tsx` (pass the prop)
- Modify: `tests/dev/skill-designer/NodeForm.cluster.test.tsx`

- [ ] **Step 1: Update the NodeForm test** in `tests/dev/skill-designer/NodeForm.cluster.test.tsx`

Add a `clusters` prop to the render and assert the options come from it:

```tsx
const clusters = [
  { id: "colors", name: "Colors", theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 1, h: 1 } },
  { id: "workshop", name: "Workshop", theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 1, h: 1 } },
];

it("shows the current clusterId and emits a patch on change", () => {
  const onChange = vi.fn();
  const { getByLabelText } = render(
    <NodeForm node={node} allNodes={[node]} clusters={clusters} onChange={onChange} onDelete={() => {}} />,
  );
  const select = getByLabelText(/cluster/i) as HTMLSelectElement;
  expect(select.value).toBe("colors");
  fireEvent.change(select, { target: { value: "workshop" } });
  expect(onChange).toHaveBeenCalledWith("x", { clusterId: "workshop" });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/NodeForm.cluster.test.tsx`
Expected: FAIL — `NodeForm` doesn't accept `clusters`.

- [ ] **Step 3a: `src/dev/skill-designer/NodeForm.tsx`**

Remove `import { SKILL_CLUSTERS } from "@/config/skillClusters";`. Add `DesignCluster` to the types import and a `clusters` prop:

```ts
import type { DesignNode, DesignCluster, NodeKind, StackingMode } from "./types";

interface Props {
  node: DesignNode | null;
  allNodes: ReadonlyArray<DesignNode>;
  clusters: ReadonlyArray<DesignCluster>;
  onChange: (id: string, patch: Partial<DesignNode>) => void;
  onDelete: (id: string) => void;
}
```

Update the destructure: `export function NodeForm({ node, allNodes, clusters, onChange, onDelete }: Props)`.
In the cluster `<select>`, map `clusters` instead of `SKILL_CLUSTERS`:

```tsx
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
```

- [ ] **Step 3b: `src/dev/skill-designer/DesignerCanvas.tsx`**

Remove `import { SKILL_CLUSTERS } from "@/config/skillClusters";`. Add `DesignCluster` to the types import and a `clusters` prop:

```ts
import type { DesignNode, DesignCluster } from "./types";

interface Props {
  nodes: ReadonlyArray<DesignNode>;
  clusters: ReadonlyArray<DesignCluster>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
}
```

Update the destructure to include `clusters`, and the layout call:

```ts
  const positions = computeClusterLayout(nodes, clusters);
```

(`VIEWBOX` import from nodeLayout stays for the initial frame; that's the game's static extent and is fine as the designer's default frame.)

- [ ] **Step 3c: `src/dev/skill-designer/SkillDesignerRoute.tsx`** — pass `clusters={design.clusters}` to both `<NodeForm>` and `<DesignerCanvas>`:

```tsx
        <DesignerCanvas
          nodes={design.nodes}
          clusters={design.clusters}
          selectedId={selectedId}
          onSelect={actions.selectNode}
          onMove={handleMove}
        />
        <NodeForm
          node={selectedNode}
          allNodes={design.nodes}
          clusters={design.clusters}
          onChange={wrapAction(actions.updateNode)}
          onDelete={wrapAction(actions.deleteNode)}
        />
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run tests/dev/skill-designer/NodeForm.cluster.test.tsx tests/dev/skill-designer/DesignerCanvas.test.tsx` → PASS (update DesignerCanvas test renders to pass `clusters={[...]}` or `clusters={[]}` if they don't already — match the seed used by its existing `n()` helper; a `clusters` array with the clusters those nodes reference makes nodes render).
Run: `npx tsc -b` → no NEW errors in these three files.

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/NodeForm.tsx src/dev/skill-designer/DesignerCanvas.tsx src/dev/skill-designer/SkillDesignerRoute.tsx tests/dev/skill-designer/NodeForm.cluster.test.tsx tests/dev/skill-designer/DesignerCanvas.test.tsx
git commit -m "refactor(skill-designer): NodeForm + canvas take clusters from the design file"
```

---

### Task 7: `ClusterListRail` component

**Files:**
- Create: `src/dev/skill-designer/ClusterListRail.tsx`
- Test: `tests/dev/skill-designer/ClusterListRail.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/dev/skill-designer/ClusterListRail.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ClusterListRail } from "@/dev/skill-designer/ClusterListRail";

const clusters = [
  { id: "inspiration", name: "Inspiration", theme: "", rootNodeId: "get_inspired", region: { x: 0, y: 0, w: 1, h: 1 } },
  { id: "colors", name: "Colors", theme: "", rootNodeId: "black_white", region: { x: 0, y: 0, w: 1, h: 1 } },
];

describe("ClusterListRail", () => {
  it("lists clusters and fires onAdd", () => {
    const onAdd = vi.fn();
    const { getByText, getByTestId } = render(
      <ClusterListRail clusters={clusters} selectedClusterId={null} onSelect={() => {}} onAdd={onAdd} />,
    );
    expect(getByText("Inspiration")).toBeTruthy();
    fireEvent.click(getByTestId("add-cluster"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("fires onSelect with the cluster id", () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <ClusterListRail clusters={clusters} selectedClusterId="colors" onSelect={onSelect} onAdd={() => {}} />,
    );
    fireEvent.click(getByTestId("cluster-list-row-inspiration"));
    expect(onSelect).toHaveBeenCalledWith("inspiration");
    expect(getByTestId("cluster-list-row-colors").getAttribute("data-selected")).toBe("true");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/ClusterListRail.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/dev/skill-designer/ClusterListRail.tsx`** (reuse `NodeListRail.module.css` classes)

```tsx
import type { JSX } from "react";
import type { DesignCluster } from "./types";
import styles from "./NodeListRail.module.css";

interface Props {
  clusters: ReadonlyArray<DesignCluster>;
  selectedClusterId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ClusterListRail({ clusters, selectedClusterId, onSelect, onAdd }: Props): JSX.Element {
  return (
    <aside className={styles.rail} aria-label="Cluster list">
      <button type="button" className={styles.addBtn} data-testid="add-cluster" onClick={onAdd}>
        + Add Cluster
      </button>
      <ul className={styles.list}>
        {clusters.map((c) => (
          <li
            key={c.id}
            className={styles.row}
            data-testid={`cluster-list-row-${c.id}`}
            data-selected={selectedClusterId === c.id ? "true" : undefined}
            onClick={() => onSelect(c.id)}
          >
            <span className={styles.name}>{c.name}</span>
            <span className={styles.pill}>{c.id}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/ClusterListRail.test.tsx` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/ClusterListRail.tsx tests/dev/skill-designer/ClusterListRail.test.tsx
git commit -m "feat(skill-designer): ClusterListRail with add + select"
```

---

### Task 8: `ClusterForm` component

**Files:**
- Create: `src/dev/skill-designer/ClusterForm.tsx`
- Test: `tests/dev/skill-designer/ClusterForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/dev/skill-designer/ClusterForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ClusterForm } from "@/dev/skill-designer/ClusterForm";
import type { DesignCluster, DesignNode } from "@/dev/skill-designer/types";

const cluster: DesignCluster = { id: "c1", name: "C1", theme: "", rootNodeId: "r", region: { x: 0, y: 0, w: 600, h: 600 } };
function node(id: string, parentIds: string[] = []): DesignNode {
  return { id, name: id, description: "", numericEffect: "", parentIds, stacking: "additive", kind: "minor", maxLevel: 1, costs: [0], unlocks: [], position: null, clusterId: "c1" };
}
const members = [node("r"), node("k", ["r"])];

describe("ClusterForm", () => {
  it("edits name and root, emitting patches", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <ClusterForm cluster={cluster} members={members} onChange={onChange} onDelete={() => {}} />,
    );
    fireEvent.change(getByLabelText(/name/i), { target: { value: "Music" } });
    expect(onChange).toHaveBeenCalledWith("c1", { name: "Music" });
    const root = getByLabelText(/cluster root/i) as HTMLSelectElement;
    expect(root.value).toBe("r");
    fireEvent.change(root, { target: { value: "k" } });
    expect(onChange).toHaveBeenCalledWith("c1", { rootNodeId: "k" });
  });

  it("fires onDelete", () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { getByText } = render(
      <ClusterForm cluster={cluster} members={members} onChange={() => {}} onDelete={onDelete} />,
    );
    fireEvent.click(getByText(/delete cluster/i));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("renders placeholder when no cluster is selected", () => {
    const { getByText } = render(
      <ClusterForm cluster={null} members={[]} onChange={() => {}} onDelete={() => {}} />,
    );
    expect(getByText(/select a cluster/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/ClusterForm.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/dev/skill-designer/ClusterForm.tsx`** (reuse `NodeForm.module.css`)

```tsx
import type { JSX } from "react";
import type { DesignCluster, DesignNode } from "./types";
import styles from "./NodeForm.module.css";

interface Props {
  cluster: DesignCluster | null;
  members: ReadonlyArray<DesignNode>;
  onChange: (id: string, patch: Partial<DesignCluster>) => void;
  onDelete: (id: string) => void;
}

export function ClusterForm({ cluster, members, onChange, onDelete }: Props): JSX.Element {
  if (cluster === null) {
    return (
      <aside className={styles.form} aria-label="Cluster form">
        <p className={styles.placeholder}>Select a cluster or click + Add Cluster</p>
      </aside>
    );
  }
  const patch = (p: Partial<DesignCluster>) => onChange(cluster.id, p);

  return (
    <aside className={styles.form} aria-label="Cluster form">
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input className={styles.input} type="text" value={cluster.name}
          onChange={(e) => patch({ name: e.target.value })} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>ID (slug)</span>
        <input className={styles.input} type="text" value={cluster.id} disabled readOnly />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Theme</span>
        <input className={styles.input} type="text" value={cluster.theme}
          onChange={(e) => patch({ theme: e.target.value })} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Cluster root</span>
        <select className={styles.input} aria-label="Cluster root" value={cluster.rootNodeId}
          onChange={(e) => patch({ rootNodeId: e.target.value })}>
          <option value="">— pick a root —</option>
          {members.map((n) => (
            <option key={n.id} value={n.id}>{n.name} ({n.id})</option>
          ))}
        </select>
        <span className={styles.subLabel}>The root must be the cluster's only node with no parents.</span>
      </label>

      <button type="button" className={styles.dangerBtn}
        onClick={() => { if (window.confirm(`Delete cluster "${cluster.name}"? Its nodes move to another cluster.`)) onDelete(cluster.id); }}>
        Delete cluster
      </button>
    </aside>
  );
}
```

(If `styles.placeholder`/`styles.dangerBtn`/`styles.subLabel`/`styles.field`/`styles.label`/`styles.input` don't all exist in `NodeForm.module.css`, read it and reuse the ones that do; these are the classes `NodeForm.tsx` already uses.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/ClusterForm.test.tsx` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/ClusterForm.tsx tests/dev/skill-designer/ClusterForm.test.tsx
git commit -m "feat(skill-designer): ClusterForm (name, theme, root picker, delete)"
```

---

### Task 9: Integrate into `SkillDesignerRoute`

**Files:**
- Modify: `src/dev/skill-designer/SkillDesignerRoute.tsx`
- Modify: `tests/dev/skill-designer/SkillDesignerRoute.test.tsx`

- [ ] **Step 1: Write the failing test** — append to `tests/dev/skill-designer/SkillDesignerRoute.test.tsx`

```tsx
it("adds a cluster and shows the cluster form for it", () => {
  // render the route the same way the existing tests in this file do
  const { getByTestId, getByLabelText } = renderRoute(); // adapt to the file's existing render helper
  fireEvent.click(getByTestId("add-cluster"));
  // cluster form now visible (root picker present)
  expect(getByLabelText(/cluster root/i)).toBeTruthy();
});
```

(Read the file first; match its existing render/import style. If it uses `render(<SkillDesignerRoute />)` directly, do that.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dev/skill-designer/SkillDesignerRoute.test.tsx`
Expected: FAIL — no `add-cluster` button mounted.

- [ ] **Step 3: Wire `src/dev/skill-designer/SkillDesignerRoute.tsx`**

Add imports:

```ts
import { ClusterListRail } from "./ClusterListRail";
import { ClusterForm } from "./ClusterForm";
```

Pull `selectedClusterId` and the cluster actions from the hook:

```ts
  const { design, selectedId, selectedClusterId, actions } = useDesignerState();
```

Compute the selected cluster + its members, and validate with clusters:

```ts
  const issues = validateDesign(design.nodes, design.clusters);
  const selectedCluster =
    selectedClusterId !== null ? design.clusters.find((c) => c.id === selectedClusterId) ?? null : null;
  const clusterMembers = selectedCluster
    ? design.nodes.filter((n) => n.clusterId === selectedCluster.id)
    : [];
```

Mount the cluster rail (left of, or above, the node rail) and swap the right panel based on selection. Replace the `<div className={styles.panes}>` block:

```tsx
      <div className={styles.panes}>
        <div className={styles.rails}>
          <ClusterListRail
            clusters={design.clusters}
            selectedClusterId={selectedClusterId}
            onSelect={actions.selectCluster}
            onAdd={wrapAction(actions.addCluster)}
          />
          <NodeListRail
            nodes={design.nodes}
            selectedId={selectedId}
            onSelect={actions.selectNode}
            onAdd={wrapAction(actions.addNode)}
          />
        </div>
        <DesignerCanvas
          nodes={design.nodes}
          clusters={design.clusters}
          selectedId={selectedId}
          onSelect={actions.selectNode}
          onMove={handleMove}
        />
        {selectedClusterId !== null ? (
          <ClusterForm
            cluster={selectedCluster}
            members={clusterMembers}
            onChange={wrapAction(actions.updateCluster)}
            onDelete={wrapAction(actions.deleteCluster)}
          />
        ) : (
          <NodeForm
            node={selectedNode}
            allNodes={design.nodes}
            clusters={design.clusters}
            onChange={wrapAction(actions.updateNode)}
            onDelete={wrapAction(actions.deleteNode)}
          />
        )}
      </div>
```

Add a `.rails` rule to `SkillDesignerRoute.module.css` so the two rails stack:

```css
.rails {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}
```

(If the existing `.panes` is a horizontal flex with the node rail as the first child, `.rails` becomes that first child holding both rails. Read `SkillDesignerRoute.module.css` and keep the three-column layout: rails | canvas | form.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/SkillDesignerRoute.test.tsx tests/dev/skill-designer/` → all PASS.
Run: `npx tsc -b` → fully clean.

- [ ] **Step 5: Commit**

```bash
git add src/dev/skill-designer/SkillDesignerRoute.tsx src/dev/skill-designer/SkillDesignerRoute.module.css tests/dev/skill-designer/SkillDesignerRoute.test.tsx
git commit -m "feat(skill-designer): mount cluster rail + form; validate with clusters"
```

---

## Phase D — Guard + handoff

### Task 10: TS ⇄ JSON cluster guard test + handoff doc

**Files:**
- Create: `tests/dev/skill-designer/clusterGuard.test.ts`
- Create: `docs/agent_docs/cluster-authoring-handoff.md`

- [ ] **Step 1: Write the guard test**

```ts
// tests/dev/skill-designer/clusterGuard.test.ts
import { describe, it, expect } from "vitest";
import { SKILL_CLUSTERS } from "@/config/skillClusters";
import design from "@/config/skillTreeDesign.json";

describe("design JSON clusters ⇄ runtime SKILL_CLUSTERS", () => {
  const jsonClusters = (design as { clusters: { id: string; name: string; theme: string; rootNodeId: string; region: { x: number; y: number; w: number; h: number } }[] }).clusters;

  it("every runtime cluster has a matching JSON cluster (id, rootNodeId, region)", () => {
    for (const rc of SKILL_CLUSTERS) {
      const jc = jsonClusters.find((c) => c.id === rc.id);
      expect(jc, `JSON cluster ${rc.id}`).toBeDefined();
      expect(jc!.rootNodeId).toBe(rc.rootNodeId);
      expect(jc!.region).toEqual(rc.region);
      expect(jc!.name).toBe(rc.name);
    }
  });

  it("every JSON cluster that the game ships is wired into SKILL_CLUSTERS", () => {
    // Clusters authored but not yet wired are allowed to exist in JSON only;
    // this asserts the seven shipped ids are present in both, catching drift on edits.
    const shipped = ["inspiration", "colors", "workshop", "crit", "combo", "office", "school"];
    for (const id of shipped) {
      expect(SKILL_CLUSTERS.some((c) => c.id === id), `runtime ${id}`).toBe(true);
      expect(jsonClusters.some((c) => c.id === id), `json ${id}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run tests/dev/skill-designer/clusterGuard.test.ts`
Expected: PASS — the JSON seed (Task 3) mirrors `SKILL_CLUSTERS`.

- [ ] **Step 3: Write the handoff doc** `docs/agent_docs/cluster-authoring-handoff.md`

```markdown
# Cluster authoring → runtime wiring handoff

The skill designer (`/dev/skill-designer`) lets the user author clusters into
`src/config/skillTreeDesign.json` (`clusters[]`). These are a SPEC. The game reads
the hand-coded `SKILL_CLUSTERS` in `src/config/skillClusters.ts`. After the user
saves a new/edited cluster, an agent reconciles them:

1. Read `clusters[]` from `skillTreeDesign.json`.
2. For each cluster, add/update the entry in `skillClusters.ts` using the JSON's
   `id`, `name`, `theme`, `rootNodeId`, `region`, plus:
   - `completionBonus: "cluster_<id>_complete"` (a placeholder capability tag),
   - `completionArtPath: null`.
3. Reconcile node `clusterId`s in `skillTreeNodes.ts` to match the JSON.
4. Run `npx vitest run tests/dev/skill-designer/clusterGuard.test.ts` and
   `tests/config/skillClusters.test.ts` — both must pass (id/root/region agree;
   one root per cluster; no cross-cluster edges).

`completionBonus` effects (what the bonus actually does) remain a separate, manual
gameplay task — the tag exists but no multiplier consumes it yet.
```

- [ ] **Step 4: Commit**

```bash
git add tests/dev/skill-designer/clusterGuard.test.ts docs/agent_docs/cluster-authoring-handoff.md
git commit -m "test+docs(skill-designer): cluster TS/JSON guard + wiring handoff note"
```

---

## Phase E — Verification

### Task 11: Full verification + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all green. Fix any straggler (e.g. a designer test that renders `NodeForm`/`DesignerCanvas` without the new `clusters` prop, or `validateDesign` callers) in place.

- [ ] **Step 2: Real typecheck + build**

Run: `npx tsc -b` → fully clean.
Run: `npm run build` → succeeds.

- [ ] **Step 3: Manual smoke (dev server)**

`npx vite`, open `/dev/skill-designer`. Confirm:
- The cluster rail lists the 7 clusters; "+ Add Cluster" creates a new one, auto-placed (its empty region appears to the side), and shows the cluster form.
- Editing name/theme works; the root picker lists the cluster's member nodes.
- Assigning a node (node form's Cluster picker) to the new cluster moves it there in the canvas.
- Until the new cluster has a valid single root, the ⚠ issue count reflects it; it clears once you give it one parentless member set as root.
- Existing clusters still render identically to the game (open `/constellation` after seeding fame to compare).

- [ ] **Step 4: Final commit (if any smoke fixes)**

```bash
git add -A
git commit -m "fix(skill-designer): post-smoke cleanups"
```

---

## Self-review notes (for the executor)

- **Author-as-spec:** nothing here makes user-created clusters appear in the GAME. The game reads `SKILL_CLUSTERS` (TS). New clusters show only in the designer until the agent wires them (Task 10 doc). Do not make `skillClusters.ts` read the JSON.
- **`validateDesign` signature:** clusters param defaults to `[]` (Task 5) so it compiles before the route passes it (Task 9). After Task 9 the route always passes `design.clusters`.
- **`DesignFile.clusters` is required** (Task 1) — every `DesignFile` literal in tests/code must include `clusters` (storage migration + `EMPTY_DESIGN` + `loadFileBaseline` cover the real paths; test fixtures add `clusters: [...]`).
- **Layout coordinate space unchanged:** `computeClusterLayout` still bakes `WORLD_PAD`; loosening its param type to `LayoutCluster` is type-only. Designer and game stay pixel-aligned for the shared 7 clusters.
- **Real typecheck is `npx tsc -b`.** `tsc -p tsconfig.json` is a no-op stub.
