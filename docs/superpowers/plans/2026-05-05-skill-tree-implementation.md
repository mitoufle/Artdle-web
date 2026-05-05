# Skill Tree Implementation Plan (from designer JSON)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1.1 5-node skill tree with the user's designed tree (17 nodes from `src/config/skillTreeDesign.json`). Adds multi-level purchases, multi-parent prereqs (DAG), and three new effect systems (canvas speed, periodic inspiration grant, tree-cost discount). Save schema bump v7 → v8 wipes existing `purchasedNodes` (game unreleased per user, no migration needed).

**Architecture:** `skillTreeNodes.ts` becomes a thin transformer reading `skillTreeDesign.json` at module load. `purchasedNodes` changes shape to `Partial<Record<string, number>>` (level count, 0/undefined = not owned). Selectors gain a multi-level API (`getNodeLevel`, `getNextCost`) while keeping `hasNode`/`canBuyNode` API names. `nodeLayout.ts` derived from design positions via the existing `computeAutoLayout`. New effects implemented in `core/multipliers.ts` plus a `skillTreeTick` for Poke the Tree.

**Tech Stack:** React 19 + TypeScript strict + Vite + Zustand 5 + Vitest + RTL.

---

## File structure

### Modified files

| File | Change |
|---|---|
| `src/config/skillTreeNodes.ts` | Full rewrite. `SkillNodeConfig` gains `parentIds`, `costs[]`, `maxLevel`, `numericEffect`, `stacking`. `SKILL_NODES` derived from `skillTreeDesign.json` import. `SkillNodeId = string`. |
| `src/store/skillTreeSlice.ts` | `purchasedNodes` becomes level-count map. `buyNode` spends `costs[currentLevel]` and increments. New selectors `getNodeLevel`, `getNextCost`. New `pokeTreeTimer` field + `skillTreeTick`. New `resetSkillTree`. |
| `src/store/index.ts` | `SAVE_VERSION` 7 → 8. New v7→v8 migration block: `purchasedNodes = {}`, `pokeTreeTimer = 0`. `tickAll` now also calls `skillTreeTick`. |
| `src/core/multipliers.ts` | Rewire `getInspiMultiplier` to read `get_inspired` level. Rewire `getCanvasGoldMultiplier` to read 10 color levels + rainbow. Add `getCanvasSpeedMultiplier`, `getTreeUpgradeCostMultiplier`. |
| `src/store/canvasSlice.ts` | `canvasTick` divides paint time by `getCanvasSpeedMultiplier(state)` in addition to existing `getPaintTimeMultiplier`. |
| `src/store/treeSlice.ts` | `buyPartLevel` multiplies cost by `getTreeUpgradeCostMultiplier(state)`. |
| `src/store/workshopSlice.ts` | Replace `purchasedNodes.second_slot` with `getNodeLevel(state, "gear_up") > 0`. Drop `BETTER_BRUSH_BONUS_PCT` reference (set to 0 — node no longer exists). |
| `src/systems/ascend.ts` | Drop `faster_strokes` palier reduction (no equivalent in new tree). |
| `src/components/constellation/nodeLayout.ts` | Derived from `skillTreeDesign.json` via `computeAutoLayout`. `NODE_POSITIONS` keyed by `string`. `EDGES` derived from `parentIds`. |
| `src/components/constellation/StarCanvas.tsx` | `nodeStates` map shape: `{ owned, available, affordable, level, maxLevel }`. Edge keys handle multi-parent. |
| `src/components/constellation/NodeCard.tsx` | New props: `currentLevel`, `maxLevel`, `nextCost`. Button label: "Upgrade · N fame" / "Maxed" / "Acquire · N fame". |
| `src/components/constellation/MiniMap.tsx` | Edges from each parent. `ownedById` reads `level > 0`. |
| `src/routes/ConstellationRoute.tsx` | Computes `nodeStates` with level info. `EFFECT_DESCRIPTIONS` becomes data-driven (read from `node.description` directly). |

### Tests touched

All tests using v1.1 node ids (`goldsmith`, `patient_eye`, `second_slot`, `faster_strokes`, `better_brush`) need updating: `tests/store/skillTreeSlice.test.ts`, `tests/core/multipliers.test.ts`, `tests/store/workshopSlice.test.ts`, `tests/systems/ascend.test.ts`, `tests/store/persistence-integration.test.ts`, `tests/store/metaSlice.test.ts`, `tests/routes/AscensionRoute.test.tsx`, `tests/routes/ConstellationRoute.test.tsx`, `tests/components/constellation/NodeCard.test.tsx`, `tests/components/constellation/StarCanvas.test.tsx`, `tests/components/constellation/MiniMap.test.tsx`.

### No new files

This implementation reuses existing modules. The skill-designer's `computeAutoLayout` is imported into `nodeLayout.ts`.

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Schema rewrite (config + types) | 1 |
| **B** | Multi-level skillTreeSlice + migration | 2, 3 |
| **C** | Effect rewiring (existing + new) | 4, 5, 6, 7 |
| **D** | Constellation UI (multi-level + DAG) | 8, 9, 10 |
| **E** | Verify | 11 |

Each task: TDD where applicable. Tests-first for new logic; existing-test updates run before the impl change to confirm they break, then go green after.

---

## Pre-flight checks

- [ ] Working tree clean. On `main`. HEAD recent.
- [ ] Baseline tests pass: `npm test` reports 536/536.
- [ ] `npx tsc -b --noEmit` clean.

---

# Phase A — Schema rewrite

---

### Task 1: Rewrite `skillTreeNodes.ts` to be data-driven from design JSON

**Files:**
- Modify (full rewrite): `src/config/skillTreeNodes.ts`

This task changes the type surface. Subsequent tasks update consumers.

- [ ] **Step 1: Replace `src/config/skillTreeNodes.ts`** with:

```ts
import designJson from "./skillTreeDesign.json";

/** Node identifier. String — typo protection is sacrificed for data-driven config. */
export type SkillNodeId = string;

export type StackingMode = "additive" | "multiplicative";

export interface SkillNodeConfig {
  readonly id: SkillNodeId;
  readonly name: string;
  readonly description: string;
  /** Free-form effect text, e.g. "+10% gold per level". Player-facing. */
  readonly numericEffect: string;
  /** Parent node IDs. Empty array = root (child of FAME hub). */
  readonly parentIds: ReadonlyArray<SkillNodeId>;
  /** Per-level costs in fame. `costs.length === maxLevel`. */
  readonly costs: ReadonlyArray<number>;
  readonly maxLevel: number;
  readonly stacking: StackingMode;
}

/**
 * Designed tree, derived from `skillTreeDesign.json` at module load.
 * Re-imported as plain JSON; Vite handles JSON imports natively.
 *
 * To redesign: edit the JSON via the /dev/skill-designer route, then
 * restart the dev server (Vite caches JSON imports).
 */
export const SKILL_NODES: ReadonlyArray<SkillNodeConfig> = designJson.nodes.map(
  (n: {
    id: string;
    name: string;
    description: string;
    numericEffect: string;
    parentIds: ReadonlyArray<string>;
    costs: ReadonlyArray<number>;
    maxLevel: number;
    stacking: "additive" | "multiplicative";
  }) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    numericEffect: n.numericEffect,
    parentIds: n.parentIds,
    costs: n.costs,
    maxLevel: n.maxLevel,
    stacking: n.stacking,
  }),
);

/** Lookup helper. Returns null if id unknown. */
export function getSkillNodeConfig(id: SkillNodeId): SkillNodeConfig | null {
  return SKILL_NODES.find((n) => n.id === id) ?? null;
}
```

- [ ] **Step 2: Verify import works**

Run: `npx tsc -b --noEmit 2>&1 | head -50`

Expected: many errors elsewhere (consumers breaking). That's fine — we'll fix in T2+.

- [ ] **Step 3: Commit**

```bash
git add src/config/skillTreeNodes.ts
git commit -m "skill-tree(config): rewrite SKILL_NODES as data-driven from designer JSON"
```

---

# Phase B — Multi-level skillTreeSlice + migration

---

### Task 2: Multi-level `skillTreeSlice` + selectors + Poke-the-Tree timer

**Files:**
- Modify (full rewrite): `src/store/skillTreeSlice.ts`
- Modify: `tests/store/skillTreeSlice.test.ts`

The slice owns level state, multi-parent prereq logic, AND the Poke-the-Tree tick. Putting the timer here keeps node-effect state co-located with node ownership.

- [ ] **Step 1: Replace `tests/store/skillTreeSlice.test.ts`** with:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { hasNode, canBuyNode, getNodeLevel, getNextCost } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import type { SkillNodeId } from "@/config/skillTreeNodes";

describe("skillTreeSlice (multi-level + DAG)", () => {
  beforeEach(() => {
    useGameStore.setState({ purchasedNodes: {}, pokeTreeTimer: 0, fame: big(0) });
  });

  it("initializes with empty purchasedNodes", () => {
    expect(useGameStore.getState().purchasedNodes).toEqual({});
  });

  it("getNodeLevel returns 0 for never-bought node", () => {
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(0);
  });

  it("buyNode('get_inspired') with 1 fame: succeeds, level=1, fame=0", () => {
    useGameStore.setState({ fame: big(1) });
    expect(useGameStore.getState().buyNode("get_inspired")).toBe(true);
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(1);
    expect(useGameStore.getState().fame.eq(0)).toBe(true);
  });

  it("buyNode('get_inspired') 5 times spends [1,5,10,15,20] = 51 total fame", () => {
    useGameStore.setState({ fame: big(51) });
    for (let i = 0; i < 5; i++) {
      expect(useGameStore.getState().buyNode("get_inspired")).toBe(true);
    }
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(5);
    expect(useGameStore.getState().fame.eq(0)).toBe(true);
  });

  it("buyNode at maxLevel returns false", () => {
    useGameStore.setState({ fame: big(1000) });
    for (let i = 0; i < 5; i++) useGameStore.getState().buyNode("get_inspired");
    expect(useGameStore.getState().buyNode("get_inspired")).toBe(false);
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(5);
  });

  it("buyNode without fame returns false", () => {
    expect(useGameStore.getState().buyNode("get_inspired")).toBe(false);
  });

  it("buyNode without all parents owned returns false", () => {
    // 'red' has parents [magenta, yellow]. Owning only one is not enough.
    useGameStore.setState({ fame: big(1000), purchasedNodes: { magenta: 1 } });
    expect(useGameStore.getState().buyNode("red")).toBe(false);
    useGameStore.setState({ purchasedNodes: { magenta: 1, yellow: 1 } });
    expect(useGameStore.getState().buyNode("red")).toBe(true);
  });

  it("hasNode returns true iff level > 0", () => {
    expect(hasNode(useGameStore.getState(), "get_inspired")).toBe(false);
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(hasNode(useGameStore.getState(), "get_inspired")).toBe(true);
  });

  it("canBuyNode false when prereq not met", () => {
    useGameStore.setState({ fame: big(1000) });
    expect(canBuyNode(useGameStore.getState(), "red")).toBe(false);
  });

  it("getNextCost returns the next-level cost; null if maxed", () => {
    expect(getNextCost(useGameStore.getState(), "get_inspired")).toBe(1);
    useGameStore.setState({ purchasedNodes: { get_inspired: 2 } });
    expect(getNextCost(useGameStore.getState(), "get_inspired")).toBe(10);
    useGameStore.setState({ purchasedNodes: { get_inspired: 5 } });
    expect(getNextCost(useGameStore.getState(), "get_inspired")).toBe(null);
  });

  it("getNextCost returns null for unknown id", () => {
    expect(getNextCost(useGameStore.getState(), "ghost" as SkillNodeId)).toBe(null);
  });

  it("skillTreeTick: poke_tree level 0 → no inspi, timer stays 0", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: {} });
    useGameStore.getState().skillTreeTick(15);
    expect(useGameStore.getState().inspiration.eq(0)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBe(0);
  });

  it("skillTreeTick: poke_tree level 1, 5s tick → 0 inspi, timer 5", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: { poke_tree: 1 }, pokeTreeTimer: 0 });
    useGameStore.getState().skillTreeTick(5);
    expect(useGameStore.getState().inspiration.eq(0)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBeCloseTo(5, 5);
  });

  it("skillTreeTick: poke_tree level 1, 10s tick → +100 inspi, timer 0", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: { poke_tree: 1 }, pokeTreeTimer: 0 });
    useGameStore.getState().skillTreeTick(10);
    expect(useGameStore.getState().inspiration.eq(100)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBeCloseTo(0, 5);
  });

  it("skillTreeTick: poke_tree level 3, 25s tick → +600 inspi (2 grants × 100×3), timer 5", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: { poke_tree: 3 }, pokeTreeTimer: 0 });
    useGameStore.getState().skillTreeTick(25);
    expect(useGameStore.getState().inspiration.eq(600)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBeCloseTo(5, 5);
  });

  it("resetSkillTree clears purchasedNodes and pokeTreeTimer", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 3 }, pokeTreeTimer: 7 });
    useGameStore.getState().resetSkillTree();
    expect(useGameStore.getState().purchasedNodes).toEqual({});
    expect(useGameStore.getState().pokeTreeTimer).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "skillTreeSlice"`

Expected: FAIL (selectors don't exist with new signatures yet, no `pokeTreeTimer` field, etc.).

- [ ] **Step 3: Replace `src/store/skillTreeSlice.ts`** with:

```ts
import type { StateCreator } from "zustand";
import { SKILL_NODES, getSkillNodeConfig, type SkillNodeId } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

const POKE_TREE_INTERVAL_S = 10;
const POKE_TREE_BASE_INSPI = 100;

export interface SkillTreeState {
  /**
   * Per-node purchased level. `undefined` or `0` = not owned. Numbers store
   * the current level (1..maxLevel). Multi-level nodes increment with each
   * `buyNode` call until maxed.
   */
  purchasedNodes: Partial<Record<SkillNodeId, number>>;
  /**
   * Seconds since the last Poke-the-Tree inspiration grant. Wraps every
   * POKE_TREE_INTERVAL_S seconds while `level(poke_tree) > 0`.
   */
  pokeTreeTimer: number;
}

export const initialSkillTreeState: SkillTreeState = Object.freeze({
  purchasedNodes: Object.freeze({}) as Partial<Record<SkillNodeId, number>>,
  pokeTreeTimer: 0,
}) as SkillTreeState;

export interface SkillTreeSlice extends SkillTreeState {
  /**
   * Spend the cost at the CURRENT level (i.e., next-level cost) and
   * increment that node's level by 1. Returns false if:
   *   - unknown id
   *   - already at maxLevel
   *   - any parent has level 0
   *   - insufficient fame
   */
  buyNode: (id: SkillNodeId) => boolean;
  /**
   * Per-frame Poke-the-Tree timer + grant. No-op on idle frames.
   */
  skillTreeTick: (deltaSeconds: number) => void;
  /** For ascend orchestrator. Note: skill tree progress is permanent across
   *  v1.1+ ascends, but resetting is supported for test cleanup and future
   *  tree-wipe mechanics. */
  resetSkillTree: () => void;
}

export const createSkillTreeSlice: StateCreator<GameStore, [], [], SkillTreeSlice> = (set, get) => ({
  ...initialSkillTreeState,

  buyNode: (id) => {
    const node = getSkillNodeConfig(id);
    if (!node) return false;
    const state = get();
    const currentLevel = state.purchasedNodes[id] ?? 0;
    if (currentLevel >= node.maxLevel) return false;
    for (const parentId of node.parentIds) {
      if ((state.purchasedNodes[parentId] ?? 0) === 0) return false;
    }
    const cost = node.costs[currentLevel];
    if (cost === undefined) return false;
    if (!state.spend("fame", big(cost))) return false;
    set((s) => ({
      purchasedNodes: { ...s.purchasedNodes, [id]: currentLevel + 1 },
    }));
    return true;
  },

  skillTreeTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const state = get();
    const pokeLevel = state.purchasedNodes.poke_tree ?? 0;
    if (pokeLevel === 0) return;

    const next = state.pokeTreeTimer + deltaSeconds;
    const grants = Math.floor(next / POKE_TREE_INTERVAL_S);
    if (grants > 0) {
      const inspiGain = big(POKE_TREE_BASE_INSPI * pokeLevel * grants);
      state.add("inspiration", inspiGain);
    }
    set({ pokeTreeTimer: next - grants * POKE_TREE_INTERVAL_S });
  },

  resetSkillTree: () => set(initialSkillTreeState),
});

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** Current level (0..maxLevel). Returns 0 for unknown id or unbought node. */
export const getNodeLevel = (state: GameStore, id: SkillNodeId): number =>
  state.purchasedNodes[id] ?? 0;

/** True iff the player has purchased this node at least once. */
export const hasNode = (state: GameStore, id: SkillNodeId): boolean =>
  getNodeLevel(state, id) > 0;

/**
 * Cost of buying the NEXT level. Returns null if maxed, unknown, or
 * cost array is malformed.
 */
export const getNextCost = (state: GameStore, id: SkillNodeId): number | null => {
  const node = getSkillNodeConfig(id);
  if (!node) return null;
  const level = getNodeLevel(state, id);
  if (level >= node.maxLevel) return null;
  return node.costs[level] ?? null;
};

/**
 * True iff buyNode(id) would succeed RIGHT NOW: not yet maxed, all parents
 * owned at level≥1, fame ≥ next-level cost.
 */
export const canBuyNode = (state: GameStore, id: SkillNodeId): boolean => {
  const node = getSkillNodeConfig(id);
  if (!node) return false;
  const level = getNodeLevel(state, id);
  if (level >= node.maxLevel) return false;
  for (const parentId of node.parentIds) {
    if (getNodeLevel(state, parentId) === 0) return false;
  }
  const cost = node.costs[level];
  if (cost === undefined) return false;
  return state.fame.gte(big(cost));
};

/** Sum of additive contributions from a list of node ids, multiplied by their levels. */
export const sumLevels = (
  state: GameStore,
  ids: ReadonlyArray<SkillNodeId>,
): number => ids.reduce((acc, id) => acc + getNodeLevel(state, id), 0);
```

- [ ] **Step 4: Run tests; expect 17 passing**

Run: `npm test -- "skillTreeSlice"`

Expected: 17 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/store/skillTreeSlice.ts tests/store/skillTreeSlice.test.ts
git commit -m "skill-tree(slice): multi-level + DAG prereqs + Poke-the-Tree timer"
```

---

### Task 3: Save migration v7 → v8 + tickAll wiring

**Files:**
- Modify: `src/store/index.ts`
- Modify: `tests/store/persistence-integration.test.ts`

- [ ] **Step 1: Edit `src/store/index.ts`** — bump SAVE_VERSION + add migration block + wire `skillTreeTick` into `tickAll`.

Replace the `const SAVE_VERSION = 7;` line with:

```ts
const SAVE_VERSION = 8;
```

In the `migrate` function's chain of `if (fromVersion < N)` blocks, add at the bottom (after the v6→v7 block):

```ts
  if (fromVersion < 8) {
    // v7 → v8 (2026-05-05): full skill-tree rewrite from `skillTreeDesign.json`.
    // The v1.1 node IDs (goldsmith, patient_eye, second_slot, faster_strokes,
    // better_brush) no longer exist in the new tree. Wipe purchasedNodes;
    // existing fame is preserved so players can re-spend on the new tree.
    state = {
      ...state,
      purchasedNodes: {},
      pokeTreeTimer: 0,
    };
  }
```

In the JSDoc above `migrate`, add the new entry to the chain documentation:

```
 * v7 → v8 (2026-05-05): skill-tree rewrite. Wipe purchasedNodes; reset
 * pokeTreeTimer.
```

In the `tickAll` function (in the same file), update to call `skillTreeTick` AFTER `canvasTick`:

```ts
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
        s.skillTreeTick(deltaSeconds);
      },
```

- [ ] **Step 2: Update `tests/store/persistence-integration.test.ts`** — find the test that uses `purchasedNodes: { goldsmith: true, patient_eye: true }` and update it to use the new shape.

Run: `npm test -- "persistence-integration"` and inspect failures. The fix is mechanical: `{ goldsmith: true }` → `{ get_inspired: 1 }` (use new node IDs and number levels).

The test asserts purchased nodes round-trip through save. Concrete edit (around line 152-157 and 167, 233-239):

Find:
```ts
      purchasedNodes: { goldsmith: true, patient_eye: true },
```
Replace with:
```ts
      purchasedNodes: { get_inspired: 3, black_white: 1 },
```

Find:
```ts
      purchasedNodes: { better_brush: true },
```
Replace with:
```ts
      purchasedNodes: { rainbow: 2 },
```

Find:
```ts
      purchasedNodes: { goldsmith: true },
```
(in the migration test)
Replace with:
```ts
      purchasedNodes: { get_inspired: 1 },
```
And update the corresponding `expect(result.purchasedNodes).toEqual(...)` to match.

- [ ] **Step 3: Run persistence tests**

Run: `npm test -- "persistence-integration"`

Expected: passing.

- [ ] **Step 4: Run full suite to find remaining v1.1-id callers**

Run: `npm test 2>&1 | tail -80`

Expected: many failures from tests still referencing `goldsmith`/`patient_eye`/etc. These get fixed in tasks 4-7.

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "skill-tree(save): SAVE_VERSION 7→8 wipes purchasedNodes; tickAll runs skillTreeTick"
```

---

# Phase C — Effect rewiring

---

### Task 4: Rewire `core/multipliers.ts` for new node ids + new effects

**Files:**
- Modify (full rewrite): `src/core/multipliers.ts`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Replace `src/core/multipliers.ts`** with:

```ts
import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel, sumLevels } from "@/store/skillTreeSlice";
import { pmMult } from "./balance";

/**
 * 10 color nodes whose levels each contribute +10% additive to canvas gold.
 * Order: black_white (root) + 3 primaries + 3 secondaries + 3 tertiaries.
 */
const COLOR_NODES = [
  "black_white",
  "magenta",
  "cyan",
  "yellow",
  "red",
  "green",
  "blue",
  "purple",
  "brown",
  "orange",
] as const;

const COLOR_PER_LEVEL = 0.10;
const RAINBOW_PER_LEVEL = 0.20;
const GET_INSPIRED_PER_LEVEL = 0.05;
const BASIC_TECHNIQUE_PER_LEVEL = 0.01;
const MUSCLE_MEMORY_PER_LEVEL = 0.01;
const BARGAIN_PER_LEVEL = 0.01;
const BARGAIN_DISCOUNT_FLOOR = 0.5; // never reduce tree costs below 50% of base

/**
 * Aggregate multiplier on inspiration accrual rate.
 *
 * Wiring:
 *   - get_inspired: +5% per level (additive). 5 levels = +25%.
 *   - workshop items: do NOT contribute (painting-only by design).
 */
export const getInspiMultiplier = (state: GameStore): number => {
  const bonus = getNodeLevel(state, "get_inspired") * GET_INSPIRED_PER_LEVEL;
  return 1 + bonus;
};

/**
 * Aggregate multiplier on gold credited per canvas sale.
 *
 * Wiring:
 *   - 10 color nodes (each level): +10% additive. All 10 = +100%.
 *   - rainbow (per level): +20% additive (per design file's `stacking: additive`).
 *     If the user later flips Rainbow's stacking to "multiplicative" in the
 *     designer JSON, this function will need a second pass; for now treat as
 *     additive per the file.
 *   - Equipped items: existing `+canvas_gold%` contribution.
 */
export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+canvas_gold%");
  bonus += sumLevels(state, COLOR_NODES) * COLOR_PER_LEVEL;
  bonus += getNodeLevel(state, "rainbow") * RAINBOW_PER_LEVEL;
  return 1 + bonus;
};

/**
 * Aggregate multiplier on canvas SPEED. Higher = faster.
 *
 * Wiring:
 *   - basic_technique (per level): +1% additive
 *   - muscle_memory (per level): +1% additive
 *
 * Composes multiplicatively at the call site with `getPaintTimeMultiplier`
 * (the item-driven speed multiplier).
 */
export const getCanvasSpeedMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getNodeLevel(state, "basic_technique") * BASIC_TECHNIQUE_PER_LEVEL;
  bonus += getNodeLevel(state, "muscle_memory") * MUSCLE_MEMORY_PER_LEVEL;
  return 1 + bonus;
};

/**
 * Multiplier on tree-part upgrade costs (spark/bud/leaf/branch). 1.0 = no
 * discount; <1.0 = discounted. Floored at BARGAIN_DISCOUNT_FLOOR.
 *
 * Wiring:
 *   - Bargain (per level): -1% additive.
 */
export const getTreeUpgradeCostMultiplier = (state: GameStore): number => {
  const reduction = getNodeLevel(state, "Bargain") * BARGAIN_PER_LEVEL;
  return Math.max(BARGAIN_DISCOUNT_FLOOR, 1 - reduction);
};

/**
 * Paint-speed multiplier from items only — `effectivePaintTime = canvasTime / multiplier`.
 * Skill-tree speed contributions live in `getCanvasSpeedMultiplier`.
 */
export const getPaintTimeMultiplier = (state: GameStore): number => {
  let bonus = 0;
  for (const item of state.equippedItems) {
    if (item.kind === "-paint_time%") {
      const v = item.magnitude / 100;
      bonus += v / (1 - v);
    }
  }
  return 1 + bonus;
};

/** Paint Mastery multiplier on canvas gold output. */
export const getPmMultiplier = (state: GameStore): number =>
  pmMult(state.paintMastery);
```

- [ ] **Step 2: Replace `tests/core/multipliers.test.ts`** with the updated version. The whole file changes — replace contents with:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getTreeUpgradeCostMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("core/multipliers — skill-tree v3 (designer-driven)", () => {
  beforeEach(() => {
    useGameStore.setState({
      purchasedNodes: {},
      equippedItems: [],
      paintMastery: big(0),
    });
  });

  it("getInspiMultiplier returns 1 with no nodes", () => {
    expect(getInspiMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getInspiMultiplier returns 1.05 with get_inspired level 1", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.05, 5);
  });

  it("getInspiMultiplier returns 1.25 with get_inspired level 5", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 5 } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.25, 5);
  });

  it("getCanvasGoldMultiplier returns 1.0 with no nodes and no items", () => {
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1.10 with black_white level 1", () => {
    useGameStore.setState({ purchasedNodes: { black_white: 1 } });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.10, 5);
  });

  it("getCanvasGoldMultiplier returns 2.00 with all 10 color nodes at level 1", () => {
    useGameStore.setState({
      purchasedNodes: {
        black_white: 1, magenta: 1, cyan: 1, yellow: 1,
        red: 1, green: 1, blue: 1,
        purple: 1, brown: 1, orange: 1,
      },
    });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(2.00, 5);
  });

  it("getCanvasGoldMultiplier adds 0.20 per rainbow level (additive per current design)", () => {
    useGameStore.setState({ purchasedNodes: { rainbow: 3 } });
    // 1 + 0.20 * 3 = 1.60
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.60, 5);
  });

  it("getCanvasGoldMultiplier sums equipped +canvas_gold% items + colors", () => {
    useGameStore.setState({
      purchasedNodes: { black_white: 1 },
      equippedItems: [{ id: "x", kind: "+canvas_gold%", magnitude: 5 }],
    });
    // 1 + 0.10 (black_white) + 0.05 (item) = 1.15
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.15, 5);
  });

  it("getCanvasSpeedMultiplier returns 1 with no nodes", () => {
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasSpeedMultiplier sums basic_technique + muscle_memory at 1% each per level", () => {
    useGameStore.setState({ purchasedNodes: { basic_technique: 5, muscle_memory: 5 } });
    // 1 + 0.01*5 + 0.01*5 = 1.10
    expect(getCanvasSpeedMultiplier(useGameStore.getState())).toBeCloseTo(1.10, 5);
  });

  it("getTreeUpgradeCostMultiplier returns 1 with no Bargain", () => {
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getTreeUpgradeCostMultiplier discounts 1% per Bargain level", () => {
    useGameStore.setState({ purchasedNodes: { Bargain: 5 } });
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBeCloseTo(0.95, 5);
  });

  it("getTreeUpgradeCostMultiplier floors at 0.5 (50% off)", () => {
    // Even with 100 levels (impossible, max is 5), floor still applies.
    useGameStore.setState({ purchasedNodes: { Bargain: 100 } });
    expect(getTreeUpgradeCostMultiplier(useGameStore.getState())).toBe(0.5);
  });

  it("getPaintTimeMultiplier returns 1 with no items", () => {
    expect(getPaintTimeMultiplier(useGameStore.getState())).toBe(1);
  });
});
```

- [ ] **Step 3: Run multiplier tests**

Run: `npm test -- "core/multipliers"`

Expected: 13 passing.

- [ ] **Step 4: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "skill-tree(effects): wire multipliers to new node ids + add speed/discount"
```

---

### Task 5: Wire canvas-speed multiplier into canvasTick + Bargain into treeSlice

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `src/store/treeSlice.ts`

- [ ] **Step 1: Edit `src/store/canvasSlice.ts`** — import + apply `getCanvasSpeedMultiplier`.

Update the imports block to include `getCanvasSpeedMultiplier`:

```ts
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getPaintTimeMultiplier,
  getPmMultiplier,
} from "@/core/multipliers";
```

Update `canvasTick` body — replace this line:

```ts
    const paintTime = canvasTime(state.canvasTier) / getPaintTimeMultiplier(state);
```

with:

```ts
    const paintTime = canvasTime(state.canvasTier) / (getPaintTimeMultiplier(state) * getCanvasSpeedMultiplier(state));
```

- [ ] **Step 2: Edit `src/store/treeSlice.ts`** — apply Bargain discount in `buyPartLevel`.

Add to imports:

```ts
import { getInspiMultiplier, getTreeUpgradeCostMultiplier } from "@/core/multipliers";
```

Update the `buyPartLevel` body — find:

```ts
    const cost = treePartCost(currentLevel, part.baseCost);
    if (!state.spend("gold", cost)) return false;
```

Replace with:

```ts
    const baseCost = treePartCost(currentLevel, part.baseCost);
    const discount = getTreeUpgradeCostMultiplier(state);
    const cost = baseCost.mul(big(discount));
    if (!state.spend("gold", cost)) return false;
```

You'll also need `big` imported (check the existing imports); add if missing:

```ts
import { big } from "@/core/bigNumber";
```

- [ ] **Step 3: Run full suite — should still pass (existing tests don't exercise these paths)**

Run: `npm test`

Expected: same pass/fail count as before T5; this just plumbs the multipliers in. Will be tested implicitly via integration in T11.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --noEmit`

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/store/canvasSlice.ts src/store/treeSlice.ts
git commit -m "skill-tree(effects): apply canvas speed mult + Bargain tree-cost discount"
```

---

### Task 6: Update `workshopSlice` (gear_up replaces second_slot, drop better_brush)

**Files:**
- Modify: `src/store/workshopSlice.ts`
- Modify: `tests/store/workshopSlice.test.ts`

- [ ] **Step 1: Edit `src/store/workshopSlice.ts`** — replace v1.1 node references.

Add import:

```ts
import { getNodeLevel } from "@/store/skillTreeSlice";
```

Find:

```ts
  state.purchasedNodes.second_slot ? 2 : 1;
```

Replace with:

```ts
  getNodeLevel(state, "gear_up") > 0 ? 2 : 1;
```

Find:

```ts
    const brushBonus = state.purchasedNodes.better_brush ? BETTER_BRUSH_BONUS_PCT : 0;
```

Replace with:

```ts
    // better_brush no longer exists in v3 skill tree (no replacement effect).
    const brushBonus = 0;
```

(Leave the `BETTER_BRUSH_BONUS_PCT` constant in place — it may be referenced in tests; setting bonus to 0 makes it inert without removing the constant.)

- [ ] **Step 2: Edit `tests/store/workshopSlice.test.ts`** — find tests that set `purchasedNodes: { second_slot: true }` or `purchasedNodes: { better_brush: true }` and update them.

Run: `npm test -- "workshopSlice" 2>&1 | tail -40` to identify failures.

For tests asserting Second Slot enables a second equip slot, change:

```ts
useGameStore.setState({ purchasedNodes: { second_slot: true } });
```

to:

```ts
useGameStore.setState({ purchasedNodes: { gear_up: 1 } });
```

For tests asserting better_brush adds to magnitude — these tests are now incorrect (better_brush is dropped). DELETE those test cases. Search for `better_brush` in the file and remove the test blocks that exercise it.

- [ ] **Step 3: Run workshop tests**

Run: `npm test -- "workshopSlice"`

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src/store/workshopSlice.ts tests/store/workshopSlice.test.ts
git commit -m "skill-tree(workshop): gear_up replaces second_slot; better_brush dropped"
```

---

### Task 7: Update `systems/ascend.ts` (drop faster_strokes palier reduction)

**Files:**
- Modify: `src/systems/ascend.ts`
- Modify: `tests/systems/ascend.test.ts`

- [ ] **Step 1: Edit `src/systems/ascend.ts`** — drop the faster_strokes palier reduction.

Find:

```ts
  const reduction = state.purchasedNodes.faster_strokes ? 0.10 : 0;
```

Replace with:

```ts
  // faster_strokes node no longer exists in v3 skill tree.
  const reduction = 0;
```

- [ ] **Step 2: Edit `tests/systems/ascend.test.ts`** — remove tests that assert faster_strokes affects the palier.

Run: `npm test -- "ascend" 2>&1 | tail -40` to identify failures.

For each test setting `purchasedNodes: { faster_strokes: true }`, decide:
- If the test is asserting "palier reduces by 10%" — DELETE the test (effect dropped).
- If the test is asserting "purchasedNodes survives ascend" using `faster_strokes` as the example — replace `{ faster_strokes: true }` with `{ get_inspired: 1 }` and update assertion accordingly.

Concrete edit (around line 137 of `tests/systems/ascend.test.ts`, the test asserting purchasedNodes preserved):

Replace:
```ts
      purchasedNodes: { goldsmith: true, patient_eye: true },
```
with:
```ts
      purchasedNodes: { get_inspired: 2, black_white: 1 },
```

And update the matching `expect(...).toEqual(...)` to:
```ts
    expect(useGameStore.getState().purchasedNodes).toEqual({
      get_inspired: 2,
      black_white: 1,
    });
```

DELETE any test that solely exercises `faster_strokes` as a palier modifier.

- [ ] **Step 3: Run ascend tests**

Run: `npm test -- "ascend"`

Expected: all passing (with possibly fewer total tests if some were deleted).

- [ ] **Step 4: Commit**

```bash
git add src/systems/ascend.ts tests/systems/ascend.test.ts
git commit -m "skill-tree(ascend): drop faster_strokes palier reduction (no replacement)"
```

---

# Phase D — Constellation UI

---

### Task 8: Auto-generate `nodeLayout.ts` from designer JSON

**Files:**
- Modify (full rewrite): `src/components/constellation/nodeLayout.ts`
- Modify: existing `nodeLayout` consumers if they import constants we change

- [ ] **Step 1: Replace `src/components/constellation/nodeLayout.ts`** with:

```ts
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
export const NODE_POSITIONS: Record<string, Point> = computeAutoLayout(design.nodes);

/**
 * Edges to render. Each child contributes one edge per parent (or one edge
 * from FAME if it has no parents). DAG-ready.
 */
export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> = design.nodes.flatMap(
  (node) => {
    if (node.parentIds.length === 0) {
      return [{ from: "fame" as EdgeFrom, to: node.id }];
    }
    return node.parentIds.map((parentId) => ({ from: parentId as EdgeFrom, to: node.id }));
  },
);
```

- [ ] **Step 2: Run `npx tsc -b --noEmit`**

Expected: type errors in StarCanvas + MiniMap because they previously imported `FAME_HUB`, `NODE_POSITIONS`, `VIEWBOX`, `EDGES` from this same module — those still exist with the same shapes, so compilation should pass. If errors emerge, address them in T9.

- [ ] **Step 3: Commit**

```bash
git add src/components/constellation/nodeLayout.ts
git commit -m "constellation(layout): derive NODE_POSITIONS + EDGES from designer JSON"
```

---

### Task 9: Update `<StarCanvas>` and `<NodeCard>` for multi-level + DAG

**Files:**
- Modify (full rewrite): `src/components/constellation/StarCanvas.tsx`
- Modify (full rewrite): `src/components/constellation/NodeCard.tsx`
- Modify: `tests/components/constellation/StarCanvas.test.tsx`
- Modify: `tests/components/constellation/NodeCard.test.tsx`

- [ ] **Step 1: Replace `src/components/constellation/StarCanvas.tsx`** with:

```tsx
import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { EDGES, FAME_HUB, NODE_POSITIONS, VIEWBOX, type EdgeFrom } from "./nodeLayout";
import styles from "./StarCanvas.module.css";

export interface NodeState {
  level: number;
  maxLevel: number;
  /** True iff every parent has level >= 1 (or this node is a root). */
  available: boolean;
  /** True iff player can afford the next-level cost. */
  affordable: boolean;
}

interface Props {
  selectedId: SkillNodeId | null;
  onSelect: (id: SkillNodeId) => void;
  nodeStates: Record<SkillNodeId, NodeState>;
}

const TWINKLES: ReadonlyArray<{ x: number; y: number; r: number; dur: string }> = [
  { x: 80,  y: 100, r: 1.5, dur: "2.5s" },
  { x: 540, y: 80,  r: 2,   dur: "3s"   },
  { x: 120, y: 240, r: 1,   dur: "3.5s" },
  { x: 460, y: 360, r: 1.5, dur: "2.8s" },
  { x: 520, y: 480, r: 2,   dur: "4s"   },
  { x: 80,  y: 470, r: 1,   dur: "3.2s" },
  { x: 280, y: 30,  r: 1.5, dur: "3.7s" },
];

function nodeStateName(state: NodeState): "owned" | "maxed" | "available" | "locked" {
  if (state.level >= state.maxLevel && state.maxLevel > 0) return "maxed";
  if (state.level > 0) return "owned";
  if (state.available) return "available";
  return "locked";
}

function pointFor(id: EdgeFrom): { x: number; y: number } {
  if (id === "fame") return FAME_HUB;
  return NODE_POSITIONS[id] ?? FAME_HUB;
}

export function StarCanvas({ selectedId, onSelect, nodeStates }: Props): JSX.Element {
  return (
    <div className={styles.canvas}>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="Constellation skill tree"
      >
        <defs>
          <pattern id="cs-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          <radialGradient id="cs-warm" cx="0.5" cy="1" r="0.6">
            <stop offset="0"   stopColor="rgba(255,216,106,0.06)" />
            <stop offset="0.4" stopColor="rgba(255,216,106,0.02)" />
            <stop offset="1"   stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="var(--bg-0)" />
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#cs-warm)" />
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#cs-grid)" />

        <g>
          {TWINKLES.map((t, idx) => (
            <circle key={idx} cx={t.x} cy={t.y} r={t.r} fill="#9b6cd6">
              <animate
                attributeName="opacity"
                values="0.2;0.9;0.2"
                dur={t.dur}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        <g>
          {EDGES.map(({ from, to }) => {
            const a = pointFor(from);
            const b = pointFor(to);
            const fromOwned = from === "fame" ? true : (nodeStates[from]?.level ?? 0) > 0;
            return (
              <line
                key={`${from}-${to}`}
                data-testid={`edge-${from}-${to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={fromOwned ? "var(--gold)" : "var(--ink-line)"}
                strokeWidth={fromOwned ? 2 : 1.5}
                strokeDasharray={fromOwned ? undefined : "6 4"}
                opacity={fromOwned ? 0.85 : 0.55}
              />
            );
          })}
        </g>

        <g data-testid="fame-hub">
          <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="32" fill="rgba(255,216,106,0.12)" />
          <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="20" fill="var(--fame)" />
          <text
            x={FAME_HUB.x}
            y={FAME_HUB.y + 50}
            textAnchor="middle"
            fontFamily="serif"
            fontSize="14"
            fontWeight="700"
            letterSpacing="0.18em"
            fill="var(--fame)"
            style={{ filter: "drop-shadow(0 0 6px rgba(255,216,106,0.6))" }}
          >
            FAME
          </text>
        </g>

        <g>
          {(Object.keys(NODE_POSITIONS) as SkillNodeId[]).map((id) => {
            const pos = NODE_POSITIONS[id];
            if (!pos) return null;
            const state = nodeStates[id];
            if (!state) return null;
            const stateName = nodeStateName(state);
            const isSelected = selectedId === id;
            const r = isSelected ? 14 : 11;

            return (
              <g
                key={id}
                data-testid={`node-${id}`}
                data-state={stateName}
                data-selected={isSelected ? "true" : undefined}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(id)}
              >
                {(stateName === "owned" || stateName === "maxed" || isSelected) && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 8}
                    fill={isSelected ? "rgba(155,108,214,0.25)" : "rgba(255,216,106,0.18)"}
                  />
                )}
                {stateName === "maxed" ? (
                  <circle cx={pos.x} cy={pos.y} r={r} fill="var(--gold)" stroke="var(--gold-d)" strokeWidth="2" />
                ) : stateName === "owned" ? (
                  <circle cx={pos.x} cy={pos.y} r={r} fill="var(--gold)" stroke="var(--gold-d)" strokeWidth="1.5" />
                ) : stateName === "available" ? (
                  <>
                    <circle cx={pos.x} cy={pos.y} r={r} fill="var(--bg-1)" stroke="var(--gold)" strokeWidth="2" />
                    {isSelected && (
                      <circle cx={pos.x} cy={pos.y} r={r * 0.45} fill="var(--inspi)" />
                    )}
                  </>
                ) : (
                  <circle cx={pos.x} cy={pos.y} r={r * 0.7} fill="var(--bg-2)" stroke="var(--ink-line)" strokeWidth="1" />
                )}
                {state.maxLevel > 1 && state.level > 0 && (
                  <text
                    x={pos.x}
                    y={pos.y - r - 6}
                    textAnchor="middle"
                    fontFamily="var(--mono)"
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--gold)"
                  >
                    {state.level}/{state.maxLevel}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Replace `tests/components/constellation/StarCanvas.test.tsx`** with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";

function makeStates(overrides: Record<string, Partial<NodeState>> = {}): Record<string, NodeState> {
  // Build empty states for all designer-driven nodes.
  // Test reads positions from production NODE_POSITIONS via StarCanvas.
  const ids = ["get_inspired", "black_white", "magenta", "cyan", "yellow", "red", "green", "blue", "purple", "brown", "orange", "rainbow", "poke_tree", "basic_technique", "muscle_memory", "gear_up", "Bargain"];
  const out: Record<string, NodeState> = {};
  for (const id of ids) {
    out[id] = {
      level: 0,
      maxLevel: 1,
      available: false,
      affordable: false,
      ...(overrides[id] ?? {}),
    };
  }
  return out;
}

describe("<StarCanvas /> (designer-driven)", () => {
  it("renders an SVG", () => {
    const { container } = render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
    expect(screen.getByText("FAME")).toBeInTheDocument();
  });

  it("renders nodes from the designer JSON (e.g. get_inspired, rainbow)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("node-get_inspired")).toBeInTheDocument();
    expect(screen.getByTestId("node-rainbow")).toBeInTheDocument();
  });

  it("renders an edge from FAME to root nodes (e.g. get_inspired)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("edge-fame-get_inspired")).toBeInTheDocument();
  });

  it("renders a multi-parent node's edges from each parent (red has parents magenta, yellow)", () => {
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={makeStates()} />);
    expect(screen.getByTestId("edge-magenta-red")).toBeInTheDocument();
    expect(screen.getByTestId("edge-yellow-red")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with that id", () => {
    const onSelect = vi.fn();
    render(<StarCanvas selectedId={null} onSelect={onSelect} nodeStates={makeStates()} />);
    fireEvent.click(screen.getByTestId("node-get_inspired"));
    expect(onSelect).toHaveBeenCalledWith("get_inspired");
  });

  it("data-state reflects level: owned (1<level<max), maxed (level=max), locked, available", () => {
    const states = makeStates({
      get_inspired: { level: 0, maxLevel: 5, available: true, affordable: true },
      poke_tree: { level: 3, maxLevel: 5, available: true, affordable: true },
      gear_up: { level: 1, maxLevel: 1, available: true, affordable: false },
    });
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} />);
    expect(screen.getByTestId("node-get_inspired")).toHaveAttribute("data-state", "available");
    expect(screen.getByTestId("node-poke_tree")).toHaveAttribute("data-state", "owned");
    expect(screen.getByTestId("node-gear_up")).toHaveAttribute("data-state", "maxed");
  });

  it("multi-level nodes show a level badge when level > 0", () => {
    const states = makeStates({
      poke_tree: { level: 3, maxLevel: 5, available: true, affordable: true },
    });
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} />);
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Replace `src/components/constellation/NodeCard.tsx`** with:

```tsx
import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import styles from "./NodeCard.module.css";

interface Props {
  nodeId: SkillNodeId;
  name: string;
  description: string;
  numericEffect: string;
  currentLevel: number;
  maxLevel: number;
  /** Cost of buying the next level. null when maxed. */
  nextCost: number | null;
  prereqMet: boolean;
  affordable: boolean;
  onAcquire: () => void;
}

export function NodeCard({
  nodeId,
  name,
  description,
  numericEffect,
  currentLevel,
  maxLevel,
  nextCost,
  prereqMet,
  affordable,
  onAcquire,
}: Props): JSX.Element {
  const owned = currentLevel > 0;
  const maxed = currentLevel >= maxLevel;
  const canAcquire = !maxed && prereqMet && affordable;

  const levelLabel = maxLevel > 1 ? `Level ${currentLevel} / ${maxLevel}` : (owned ? "Owned" : "Not owned");

  let prereqText: string;
  if (maxed) prereqText = "maxed ✓";
  else if (!prereqMet) prereqText = "prereq locked";
  else if (!affordable) prereqText = "insufficient fame";
  else prereqText = "ready";

  let buttonLabel: string;
  if (maxed) buttonLabel = "✦ Maxed";
  else if (currentLevel === 0) buttonLabel = `✦ Acquire · ${nextCost ?? "?"} fame`;
  else buttonLabel = `✦ Upgrade · ${nextCost ?? "?"} fame`;

  return (
    <aside className={styles.card} aria-label={`Node detail · ${name}`} data-node-id={nodeId}>
      <h3 className={styles.title}>{name}</h3>
      <div className={styles.meta}>
        {levelLabel} · {prereqText}
      </div>
      <p className={styles.effect}>{numericEffect}</p>
      <p className={styles.description}>{description}</p>
      <button
        type="button"
        className={styles.acquireBtn}
        disabled={!canAcquire}
        onClick={canAcquire ? onAcquire : undefined}
        data-testid={`node-acquire-${nodeId}`}
      >
        {buttonLabel}
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Add new CSS class** to `src/components/constellation/NodeCard.module.css`. Append at the end:

```css
.effect {
  margin: 0;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--gold);
}
```

- [ ] **Step 5: Replace `tests/components/constellation/NodeCard.test.tsx`** with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeCard } from "@/components/constellation/NodeCard";

function defaultProps(overrides: Partial<Parameters<typeof NodeCard>[0]> = {}) {
  return {
    nodeId: "get_inspired",
    name: "Get Inspired",
    description: "each level increase inspiration gain by 5%",
    numericEffect: "5%",
    currentLevel: 0,
    maxLevel: 5,
    nextCost: 1,
    prereqMet: true,
    affordable: true,
    onAcquire: () => {},
    ...overrides,
  };
}

describe("<NodeCard /> (multi-level)", () => {
  it("renders node name as title", () => {
    render(<NodeCard {...defaultProps()} />);
    expect(screen.getByRole("heading", { name: /Get Inspired/i })).toBeInTheDocument();
  });

  it("renders the description body", () => {
    render(<NodeCard {...defaultProps()} />);
    expect(screen.getByText(/each level increase/i)).toBeInTheDocument();
  });

  it("renders the numericEffect line", () => {
    render(<NodeCard {...defaultProps({ numericEffect: "+10%/lvl" })} />);
    expect(screen.getByText(/\+10%\/lvl/)).toBeInTheDocument();
  });

  it("button reads 'Acquire · N fame' when level=0", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 0, nextCost: 5 })} />);
    expect(screen.getByRole("button", { name: /acquire.*5/i })).toBeInTheDocument();
  });

  it("button reads 'Upgrade · N fame' when 0 < level < max", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 2, nextCost: 10 })} />);
    expect(screen.getByRole("button", { name: /upgrade.*10/i })).toBeInTheDocument();
  });

  it("button reads 'Maxed' and is disabled when level == max", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 5, nextCost: null })} />);
    expect(screen.getByRole("button", { name: /maxed/i })).toBeDisabled();
  });

  it("button is disabled when affordable=false", () => {
    render(<NodeCard {...defaultProps({ affordable: false })} />);
    expect(screen.getByRole("button", { name: /acquire/i })).toBeDisabled();
  });

  it("button is disabled when prereqMet=false", () => {
    render(<NodeCard {...defaultProps({ prereqMet: false })} />);
    expect(screen.getByRole("button", { name: /acquire/i })).toBeDisabled();
  });

  it("clicking the button calls onAcquire", () => {
    const onAcquire = vi.fn();
    render(<NodeCard {...defaultProps({ onAcquire })} />);
    fireEvent.click(screen.getByRole("button", { name: /acquire/i }));
    expect(onAcquire).toHaveBeenCalledOnce();
  });

  it("multi-level: shows 'Level 2 / 5' meta when level=2 maxLevel=5", () => {
    render(<NodeCard {...defaultProps({ currentLevel: 2, maxLevel: 5 })} />);
    expect(screen.getByText(/Level 2 \/ 5/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run StarCanvas + NodeCard tests**

Run: `npm test -- "components/constellation/(StarCanvas|NodeCard)"`

Expected: passing.

- [ ] **Step 7: Commit**

```bash
git add src/components/constellation/StarCanvas.tsx src/components/constellation/NodeCard.tsx src/components/constellation/NodeCard.module.css tests/components/constellation/StarCanvas.test.tsx tests/components/constellation/NodeCard.test.tsx
git commit -m "constellation(ui): multi-level + DAG support for StarCanvas + NodeCard"
```

---

### Task 10: Update `<MiniMap>` and `ConstellationRoute`

**Files:**
- Modify (full rewrite): `src/components/constellation/MiniMap.tsx`
- Modify (full rewrite): `src/routes/ConstellationRoute.tsx`
- Modify: `tests/components/constellation/MiniMap.test.tsx`
- Modify: `tests/routes/ConstellationRoute.test.tsx`

- [ ] **Step 1: Replace `src/components/constellation/MiniMap.tsx`** with:

```tsx
import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { FAME_HUB, NODE_POSITIONS, VIEWBOX } from "./nodeLayout";
import styles from "./MiniMap.module.css";

interface Props {
  ownedById: Record<SkillNodeId, boolean>;
  selectedId: SkillNodeId | null;
}

export function MiniMap({ ownedById, selectedId }: Props): JSX.Element {
  const ownedCount = Object.values(ownedById).filter(Boolean).length;
  const totalCount = SKILL_NODES.length;

  return (
    <section className={styles.panel} aria-label="Constellation mini-map">
      <div className={styles.subhead}>Mini-map</div>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="Constellation overview"
      >
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="var(--bg-stone-d)" />
        <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="8" fill="var(--fame)" opacity="0.8" />
        {(Object.keys(NODE_POSITIONS) as SkillNodeId[]).map((id) => {
          const pos = NODE_POSITIONS[id];
          if (!pos) return null;
          const owned = ownedById[id];
          const isSelected = selectedId === id;
          const fill = owned ? "var(--gold)" : "var(--inspi-d)";
          return (
            <g
              key={id}
              data-testid={`mini-node-${id}`}
              data-state={owned ? "owned" : "locked"}
              data-selected={isSelected ? "true" : undefined}
            >
              {isSelected && <circle cx={pos.x} cy={pos.y} r="14" fill="rgba(155,108,214,0.4)" />}
              <circle cx={pos.x} cy={pos.y} r={isSelected ? 8 : 6} fill={fill} opacity={owned ? 1 : 0.55} />
            </g>
          );
        })}
      </svg>
      <div className={styles.caption}>
        {ownedCount} / {totalCount} owned · zoom out for more
      </div>
    </section>
  );
}
```

(No structural change — already DAG-compatible since it doesn't draw edges. Updated to skip nodes lacking a `pos` defensively.)

- [ ] **Step 2: Replace `src/routes/ConstellationRoute.tsx`** with:

```tsx
import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { canBuyNode, getNodeLevel, getNextCost } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";
import { NodeCard } from "@/components/constellation/NodeCard";
import { MiniMap } from "@/components/constellation/MiniMap";
import { ClusterList } from "@/components/constellation/ClusterList";
import styles from "./ConstellationRoute.module.css";

export function ConstellationRoute(): JSX.Element {
  const fame = useGameStore((s) => s.fame);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyNode = useGameStore((s) => s.buyNode);

  const [selectedId, setSelectedId] = useState<SkillNodeId | null>(null);

  const helperState = { fame, purchasedNodes } as unknown as GameStore;

  const nodeStates = SKILL_NODES.reduce(
    (acc, node) => {
      const level = getNodeLevel(helperState, node.id);
      const prereqMet =
        node.parentIds.length === 0 ||
        node.parentIds.every((p) => getNodeLevel(helperState, p) > 0);
      const nextCost = getNextCost(helperState, node.id);
      const affordable = nextCost === null ? false : fame.gte(big(nextCost));
      acc[node.id] = {
        level,
        maxLevel: node.maxLevel,
        available: prereqMet,
        affordable,
      };
      return acc;
    },
    {} as Record<SkillNodeId, NodeState>,
  );

  const ownedById = SKILL_NODES.reduce(
    (acc, node) => {
      acc[node.id] = nodeStates[node.id]!.level > 0;
      return acc;
    },
    {} as Record<SkillNodeId, boolean>,
  );

  const ownedCount = Object.values(ownedById).filter(Boolean).length;

  const selectedNode = selectedId !== null
    ? SKILL_NODES.find((n) => n.id === selectedId) ?? null
    : null;
  const selectedState = selectedId !== null ? nodeStates[selectedId] : null;
  const selectedNextCost = selectedId !== null ? getNextCost(helperState, selectedId) : null;

  return (
    <div className={styles.layout}>
      <div className={styles.canvasArea}>
        <StarCanvas
          selectedId={selectedId}
          onSelect={setSelectedId}
          nodeStates={nodeStates}
        />
        {selectedNode && selectedState && (
          <div className={styles.cardSlot}>
            <NodeCard
              nodeId={selectedNode.id}
              name={selectedNode.name}
              description={selectedNode.description}
              numericEffect={selectedNode.numericEffect}
              currentLevel={selectedState.level}
              maxLevel={selectedNode.maxLevel}
              nextCost={selectedNextCost}
              prereqMet={selectedState.available}
              affordable={selectedState.affordable}
              onAcquire={() => {
                if (canBuyNode(helperState, selectedNode.id)) {
                  buyNode(selectedNode.id);
                }
              }}
            />
          </div>
        )}
      </div>

      <aside className={styles.rail}>
        <section className={styles.fameDisplay} aria-label="Fame to spend">
          <div className={styles.fameLabel}>Fame to spend</div>
          <div className={styles.fameValue}>{formatBig(fame)}</div>
        </section>
        <MiniMap ownedById={ownedById} selectedId={selectedId} />
        <ClusterList ownedCount={ownedCount} totalCount={SKILL_NODES.length} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Update `tests/components/constellation/MiniMap.test.tsx`** — replace the v1.1 node IDs with new ones. The test file already uses dynamically-named ids, but the explicit ones (`goldsmith`, `patient_eye`, `better_brush`) need updating. Replace with `get_inspired`, `black_white`, `rainbow` etc. as appropriate.

Run: `npm test -- "components/constellation/MiniMap" 2>&1 | tail -30` to identify failures and fix mechanically.

- [ ] **Step 4: Update `tests/routes/ConstellationRoute.test.tsx`** — replace v1.1 ids and the v1.1 cost expectations. Acquire test should now use `black_white` (cost 1, easy to afford) or `get_inspired` (cost 1).

Replace any test setting `fame: big(10)` and clicking `goldsmith` with `fame: big(1)` and clicking `black_white` (or similar minimal-cost test). The aim is "after acquire, the slice records the purchase" — adjust to assert `purchasedNodes.black_white === 1`.

Run: `npm test -- "routes/ConstellationRoute" 2>&1 | tail -30` to identify failures and fix.

- [ ] **Step 5: Run all constellation tests**

Run: `npm test -- "components/constellation" "routes/ConstellationRoute"`

Expected: passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/constellation/MiniMap.tsx src/routes/ConstellationRoute.tsx tests/components/constellation/MiniMap.test.tsx tests/routes/ConstellationRoute.test.tsx
git commit -m "constellation(route): wire multi-level + DAG flows; pass next-cost to NodeCard"
```

---

# Phase E — Verify

---

### Task 11: Final verify + smoke

- [ ] **Step 1: Full test suite**

Run: `npm test`

Expected: all passing. Capture pass count.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`

Expected: clean (only the pre-existing `main.tsx` warning).

- [ ] **Step 3: Production build**

Run: `npm run build`

Expected: success. Capture gzipped sizes.

- [ ] **Step 4: Smoke check via dev server**

```bash
npm run dev &
DEV_PID=$!
sleep 4
curl -s -o /dev/null -w "Constellation: HTTP %{http_code}\n" http://localhost:5173/constellation
curl -s -o /dev/null -w "Designer: HTTP %{http_code}\n" http://localhost:5173/dev/skill-designer
kill $DEV_PID 2>/dev/null || true
```

Expected: both HTTP 200.

- [ ] **Step 5: Update CLAUDE.md** — find the "Phase 3 skill tree" reference and adjust the comment block in `src/config/skillTreeNodes.ts` is already gone (replaced in T1). Look in `CLAUDE.md` for "5-node skill tree" / "Goldsmith → Patient Eye" mentions; update to "17-node DAG, multi-level".

Search:

```bash
grep -nE "5-node|Goldsmith|Patient Eye|Second Slot|Faster Strokes|Better Brush" CLAUDE.md docs/HANDOVER.md docs/PORT_PLAN.md 2>/dev/null
```

For each match in CLAUDE.md or HANDOVER.md (NOT PORT_PLAN.md — that's a frozen v1 spec), update to reflect new tree.

A representative HANDOVER update — add a new top entry:

```markdown
## v3.0 — Skill tree rewrite from designer (on `main`)

**Status:** Shipped. The v1.1 5-node tree replaced by the user's designed
17-node DAG (multi-level, multi-parent). `skillTreeDesign.json` is the
source of truth; `skillTreeNodes.ts` derives `SKILL_NODES` from it at
module load. Save schema bumped v7 → v8 (wipes `purchasedNodes`).

### What landed

- `purchasedNodes: Partial<Record<string, number>>` (level count)
- New selectors: `getNodeLevel`, `getNextCost`. `hasNode`/`canBuyNode` API names preserved.
- Multi-parent prereqs: `node.parentIds` (DAG, not tree).
- New effects: canvas speed (basic_technique + muscle_memory), periodic
  inspi grant (poke_tree, every 10s), tree-cost discount (Bargain).
- Dropped: faster_strokes (-10% palier) and better_brush (+1 magnitude)
  effects (no equivalent in new tree).
- StarCanvas + NodeCard + MiniMap updated for multi-level + DAG.

### Tests + build

- N tests passing.
- Bundle: M KB gzipped.
```

Replace N and M with actual values from steps 1 and 3.

- [ ] **Step 6: Commit HANDOVER + push**

```bash
git add CLAUDE.md docs/HANDOVER.md
git commit -m "docs(handover): v3.0 skill tree shipped from designer JSON"
git push origin main
```

- [ ] **Step 7: Report**

- Status: DONE
- Test count
- Bundle sizes
- HEAD SHA

---

## Spec coverage check (self-review)

| Spec requirement | Task |
|---|---|
| Multi-level node purchases | T2 (slice) + T9 (UI) |
| Multi-parent (DAG) prereqs | T2 (slice) + T9 (StarCanvas edges) |
| Free-form effect text per node | T1 (config) + T9 (NodeCard renders it) |
| `SKILL_NODES` derived from JSON | T1 |
| New effect: get_inspired (+5% inspi/lvl) | T4 |
| New effect: 10 colors (+10%/lvl additive) + rainbow (+20%/lvl additive) | T4 |
| New effect: basic_technique + muscle_memory (canvas speed +1%/lvl additive) | T4 + T5 |
| New effect: poke_tree (auto +100×lvl inspi every 10s) | T2 (timer) + T3 (tickAll) |
| New effect: Bargain (-1%/lvl tree upgrade cost) | T4 + T5 |
| gear_up → workshop slot 1→2 (replaces second_slot) | T6 |
| Drop faster_strokes (palier) | T7 |
| Drop better_brush (magnitude) | T6 |
| Save migration v7 → v8 wipes purchasedNodes | T3 |
| nodeLayout.ts derived from JSON | T8 |
| Constellation visuals support DAG | T8 + T9 + T10 |
| NodeCard shows level + next-cost | T9 |
| All affected tests updated | T2-T10 (each task fixes its own consumers) |

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders.
- ✅ Test code given for every TDD step; impl code given for every implementation step.
- ✅ Type signatures consistent across tasks: `getNodeLevel`, `getNextCost`, `NodeState` (with `level`, `maxLevel`), all defined in T2 and consumed in T9-T10.
- ✅ Each task is bite-sized (one logical chunk per task).
- ✅ The spec's eventual UI changes (level badge, next cost, multi-parent edges) are all covered.

---

**End of plan.**
