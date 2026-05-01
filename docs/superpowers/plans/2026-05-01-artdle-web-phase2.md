# Artdle Web — Phase 2 Implementation Plan: Tree + Canvas Slices

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the gameplay loop online end-to-end with no UI: tree accrues inspiration, canvas auto-paints and credits gold, RAF tickLoop fans out via `tickAll`, and IDB persist is throttled to ~1Hz.

**Architecture:** Two new Zustand slices (`treeSlice`, `canvasSlice`) wired into the existing combined `GameStore`. A new `tickAll(deltaSeconds)` orchestrator on the combined store calls slice ticks in fixed order (tree first, canvas second). A new `core/multipliers.ts` module exposes empty pure-function aggregators for Phase 3 contributors. A new `throttledAdapter` wraps `idbAdapter` to coalesce per-frame writes; `main.tsx` flushes it on visibilitychange/beforeunload. No UI changes beyond the Bootstrap effect.

**Tech Stack:** React 19 + TypeScript 6 strict + Vite 8 + Zustand 5 (persist middleware) + `break_eternity.js` (`Big`) + `idb-keyval` + Vitest 4 + `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-05-01-phase2-tree-canvas-design.md` is the authoritative design. This plan implements §14's task order.

---

## Pre-flight (read once before starting Task 1)

### Locked design decisions (from spec §2)

1. **Canvas auto-restarts.** No `startPainting()` action. The canvas perpetually advances; on threshold-cross it auto-sells and resets.
2. **One sale per `canvasTick(delta)`.** Even with `delta = 5 * paintTime`, exactly one sale fires; leftover is carried only when `< paintTime` (otherwise clamped to 0).
3. **Tree stage advancement is gated and free.** A free `growSapling()` action increments `currentStage` if `getTotalLevelsInStage(currentStage) >= TREE_STAGES[next].unlockThreshold`.
4. **Stage thresholds**: 0, 10, 100 (geometric ×10).
5. **Prior-stage parts persist** after advance — keep contributing, remain upgradable.
6. **Multipliers pipe is built empty.** All three functions return `1`.
7. **Tick order is part of the API contract**: tree first, canvas second. Pinned by a spy test.
8. **Throttle is ~1s** with `flush()` on hide/unload.

### Phase 0+1 lessons baked into this plan

- **Big.pow precision**: tests asserting Big-derived values that flow through `Big.pow` must use `toBeCloseTo`, not `toBe`. (See Task 3, Step 18 — the cost-scaling assertion uses `toBeCloseTo`.)
- **`serializeBigs` is recursive and automatic**: new persisted JS-primitive fields need zero `partialize` changes. Task 9's round-trip test verifies this.
- **Test name = test contract**: each `it("...")` description must accurately describe what the test body asserts. The plan writes them precisely; do not paraphrase when implementing.

### Run commands cheat sheet

| Action | Command |
|---|---|
| Run all tests | `npm test` |
| Run one test file | `npm test -- tests/path/to/file.test.ts` |
| Run one test by name | `npm test -- -t "test name substring"` |
| Run typecheck | `npm run build` (runs `tsc -b && vite build`; for typecheck-only use `npx tsc -b --noEmit` if available, else accept the full build) |
| Run lint | `npm run lint` |
| Dev server smoke | `npm run dev` |

### Commit message conventions (from CLAUDE.md and recent log)

Conventional prefixes: `test:`, `feat:`, `fix:`, `docs:`, `core:`, `store:`, `config:`, `refactor:`, `bootstrap:`. One commit per task at the end. Include a body for non-trivial commits.

### Standard test scaffolding

Tests for **isolated slices** (no cross-slice writes) follow this shape (copied from `tests/store/currencySlice.test.ts`):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createXSlice, type XSlice } from "@/store/xSlice";

const useTestStore = () => create<XSlice>()((...a) => createXSlice(...a));

describe("xSlice", () => {
  let store: ReturnType<typeof useTestStore>;
  beforeEach(() => {
    store = useTestStore();
  });
  // ...
});
```

Tests for **slices that need cross-slice access** (treeSlice's `treeTick` calls `state.add('inspiration', ...)`, canvasSlice's `canvasTick` calls `state.add('gold', ...)`) use a combined mini-store. Pattern shown in Task 3, Step 1.

Tests against the **full GameStore** (`useGameStore`) follow `tests/store/persistence-integration.test.ts`.

---

## File structure

### New files

```
src/core/multipliers.ts                       Task 1
src/config/treeStages.ts                      Task 2
src/store/treeSlice.ts                        Tasks 3, 4, 5 (created in 3, extended in 4-5)
src/store/canvasSlice.ts                      Task 6

tests/core/multipliers.test.ts                Task 1
tests/config/treeStages.test.ts               Task 2
tests/store/treeSlice.test.ts                 Tasks 3, 4, 5 (created in 3, extended in 4-5)
tests/store/canvasSlice.test.ts               Task 6
tests/store/tickAll.test.ts                   Task 7
```

### Edited files

```
src/store/index.ts                            Tasks 3, 6, 7, 8 (slice wiring + tickAll + persistedAdapter)
src/systems/persistence.ts                    Task 8 (throttledAdapter + persistedAdapter)
src/main.tsx                                  Task 9 (start tickLoop + flush listeners)
tests/systems/persistence.test.ts             Task 8 (+6 throttle tests)
tests/store/persistence-integration.test.ts   Task 9 (+1 round-trip)
```

### Module boundary contract

- `core/multipliers.ts` is pure. Imports only the `GameStore` type. No imports from `store/*.ts` runtime code.
- `config/treeStages.ts` exports `readonly` typed config. No imports from `store/` or `core/`.
- `treeSlice.ts` imports `treeStages.ts` config + `balance.ts` (`treePartCost`, `inspiPerSec`) + `multipliers.ts` (`getInspiMultiplier`) + `bigNumber.ts` (`big`). Cross-slice writes via `get().add('inspiration', ...)`.
- `canvasSlice.ts` imports `balance.ts` (`PAINT_TIME_BASE_SECONDS`, `canvasGold`) + `multipliers.ts` (`getCanvasGoldMultiplier`, `getPaintTimeMultiplier`). Cross-slice writes via `get().add('gold', ...)`.

---

## Task 1: `multipliers.ts` — empty aggregators

**Files:**
- Create: `src/core/multipliers.ts`
- Test: `tests/core/multipliers.test.ts`

**Goal:** Three pure functions returning `1`, set up so Phase 3 can extend without changing call sites.

- [ ] **Step 1: Write the failing test file**

Create `tests/core/multipliers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import type { GameStore } from "@/store";

// A minimal GameStore-shaped stub. Only the type signature matters; the
// Phase-2 functions don't read any fields.
const stubState = {} as GameStore;

describe("multipliers (Phase 2 — empty aggregators)", () => {
  it("getInspiMultiplier returns 1 with no contributors", () => {
    expect(getInspiMultiplier(stubState)).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1 with no contributors", () => {
    expect(getCanvasGoldMultiplier(stubState)).toBe(1);
  });

  it("getPaintTimeMultiplier returns 1 with no contributors", () => {
    expect(getPaintTimeMultiplier(stubState)).toBe(1);
  });

  it("convention: each multiplier follows 1 + sum(contributions); Phase 2 has 0 contributors so all return 1", () => {
    // Documentation test. Phase 3 will read item affixes and skill-tree nodes,
    // adding `bonus += affix.value` lines, then `return 1 + bonus`.
    // This test pins the formula intent so Phase 3 starts from the right shape.
    const contributions = 0;
    const expected = 1 + contributions;
    expect(getInspiMultiplier(stubState)).toBe(expected);
    expect(getCanvasGoldMultiplier(stubState)).toBe(expected);
    expect(getPaintTimeMultiplier(stubState)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core/multipliers.test.ts`
Expected: FAIL — module `@/core/multipliers` cannot be found.

- [ ] **Step 3: Create the implementation file**

Create `src/core/multipliers.ts`:

```ts
import type { GameStore } from "@/store";

/**
 * Aggregate multiplier on inspiration accrual rate.
 * Phase 2: returns 1 (no contributors).
 * Phase 3 will read equipped-item affix `+inspiration_rate%` and skill node "Patient Eye".
 *
 * Convention: result is `1 + Σ contributions`, where each contribution is
 * an additive percentage (e.g., `+10%` = `0.10`).
 */
export const getInspiMultiplier = (_state: GameStore): number => 1;

/**
 * Aggregate multiplier on gold credited per canvas sale.
 * Phase 2: returns 1.
 * Phase 3 reads `+canvas_gold%` affix and skill node "Goldsmith".
 */
export const getCanvasGoldMultiplier = (_state: GameStore): number => 1;

/**
 * Paint-speed multiplier — divides PAINT_TIME_BASE_SECONDS to compute effective time.
 * Higher = faster. Phase 2: returns 1.
 * Phase 3 reads `-paint_time%` affix.
 */
export const getPaintTimeMultiplier = (_state: GameStore): number => 1;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core/multipliers.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run full suite + lint to confirm no regressions**

Run: `npm test`
Expected: 88 tests pass (84 existing + 4 new).

Run: `npm run lint`
Expected: clean (or only the existing `react-refresh/only-export-components` warning on `main.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): empty aggregators for inspi/gold/paint-time

Phase 2 introduces a forward-compatible aggregation pipe. All three
functions return 1 (no contributors yet). Phase 3 will read equipped
item affixes and skill-tree nodes without changing call sites in
treeSlice/canvasSlice.

Convention pinned: result = 1 + Σ additive percentage contributions."
```

---

## Task 2: `treeStages.ts` — config data

**Files:**
- Create: `src/config/treeStages.ts`
- Test: `tests/config/treeStages.test.ts`

**Goal:** Static config defining 3 stages with 2 parts each, unlock thresholds 0/10/100.

- [ ] **Step 1: Write the failing test file**

Create `tests/config/treeStages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TREE_STAGES } from "@/config/treeStages";

describe("TREE_STAGES config", () => {
  it("has exactly 3 stages, ordered seed → sapling → tree", () => {
    expect(TREE_STAGES).toHaveLength(3);
    expect(TREE_STAGES[0]?.id).toBe("seed");
    expect(TREE_STAGES[1]?.id).toBe("sapling");
    expect(TREE_STAGES[2]?.id).toBe("tree");
  });

  it("unlockThreshold is strictly increasing across stages", () => {
    expect(TREE_STAGES[0]?.unlockThreshold).toBe(0);
    expect(TREE_STAGES[1]?.unlockThreshold).toBe(10);
    expect(TREE_STAGES[2]?.unlockThreshold).toBe(100);
    // Pin the strict-increase invariant for future-wave additions.
    for (let i = 1; i < TREE_STAGES.length; i++) {
      expect(TREE_STAGES[i]!.unlockThreshold).toBeGreaterThan(
        TREE_STAGES[i - 1]!.unlockThreshold,
      );
    }
  });

  it("all part IDs are unique across all stages", () => {
    const allIds = TREE_STAGES.flatMap((s) => s.parts.map((p) => p.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("every part has positive baseCost and rate", () => {
    for (const stage of TREE_STAGES) {
      for (const part of stage.parts) {
        expect(part.baseCost).toBeGreaterThan(0);
        expect(part.rate).toBeGreaterThan(0);
      }
    }
  });

  it("stage 0 is the only stage with unlockThreshold 0", () => {
    const zeros = TREE_STAGES.filter((s) => s.unlockThreshold === 0);
    expect(zeros).toHaveLength(1);
    expect(zeros[0]?.id).toBe("seed");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/config/treeStages.test.ts`
Expected: FAIL — module `@/config/treeStages` cannot be found.

- [ ] **Step 3: Create the implementation file**

Create `src/config/treeStages.ts`:

```ts
export interface TreePartConfig {
  /** Stable identifier; used as a key in the slice's `partLevels` record. */
  readonly id: string;
  /** Display name (Phase 4 UI). */
  readonly name: string;
  /** Gold cost at level 0 → 1. Subsequent levels scale by `treePartCost(level, baseCost)`. */
  readonly baseCost: number;
  /** Inspi/sec contribution per level (final = level * rate * multiplier). */
  readonly rate: number;
}

export interface TreeStageConfig {
  readonly id: string;
  readonly name: string;
  /**
   * Total levels required in the PRIOR stage's parts to grow into this stage.
   * Stage 0 has unlockThreshold 0 (always available).
   */
  readonly unlockThreshold: number;
  readonly parts: ReadonlyArray<TreePartConfig>;
}

/**
 * Phase 2 tree config: 3 stages × 2 parts. Numbers are placeholder
 * Phase-6-tunable defaults; the curve (×10 between stages) matches
 * the locked unlockThreshold progression.
 */
export const TREE_STAGES: ReadonlyArray<TreeStageConfig> = [
  {
    id: "seed",
    name: "Seed",
    unlockThreshold: 0,
    parts: [
      { id: "spark", name: "Spark", baseCost: 10, rate: 0.1 },
      { id: "bud", name: "Bud", baseCost: 50, rate: 0.5 },
    ],
  },
  {
    id: "sapling",
    name: "Sapling",
    unlockThreshold: 10,
    parts: [
      { id: "leaf", name: "Leaf", baseCost: 100, rate: 5 },
      { id: "branch", name: "Branch", baseCost: 500, rate: 25 },
    ],
  },
  {
    id: "tree",
    name: "Tree",
    unlockThreshold: 100,
    parts: [
      { id: "bough", name: "Bough", baseCost: 1000, rate: 100 },
      { id: "crown", name: "Crown", baseCost: 5000, rate: 500 },
    ],
  },
] as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/config/treeStages.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `npm test`
Expected: 93 tests pass (88 + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/config/treeStages.ts tests/config/treeStages.test.ts
git commit -m "config(treeStages): 3 stages × 2 parts with thresholds 0/10/100

Static config consumed by treeSlice. Numbers are placeholder Phase-6
tunable defaults; the curve (×10 between stages) matches the locked
unlockThreshold progression. Stage 0 (Seed) is auto-unlocked."
```

---

## Task 3: `treeSlice` — state init + `buyPartLevel` + selectors

**Files:**
- Create: `src/store/treeSlice.ts`
- Modify: `src/store/index.ts` (add TreeSlice to GameStore type union; spread into create call)
- Test: `tests/store/treeSlice.test.ts`

**Goal:** Slice state, the `buyPartLevel` action, and the two structural selectors (`getTotalLevelsInStage`, `getProducingParts`). Wired into `useGameStore`.

The cross-slice `state.spend('gold', ...)` call requires `treeSlice` to live in the combined store before tests can run. Tests use `useGameStore` directly, with a `beforeEach` that resets state via `resetTree()` (created in this task) + `resetRunCurrencies()`.

- [ ] **Step 1: Write the failing test file**

Create `tests/store/treeSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { getTotalLevelsInStage, getProducingParts } from "@/store/treeSlice";
import { big } from "@/core/bigNumber";
import { TREE_STAGES } from "@/config/treeStages";

describe("treeSlice — state + buyPartLevel + selectors", () => {
  beforeEach(() => {
    // Reset run currencies and tree state. fame is preserved (cross-run);
    // we don't touch it here.
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("initializes with currentStage 0 and every configured part at level 0", () => {
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    for (const stage of TREE_STAGES) {
      for (const part of stage.parts) {
        expect(s.partLevels[part.id]).toBe(0);
      }
    }
  });

  it("buyPartLevel('spark') with gold ≥ baseCost succeeds: level → 1, gold deducted", () => {
    useGameStore.getState().add("gold", big(10));
    expect(useGameStore.getState().buyPartLevel("spark")).toBe(true);
    const s = useGameStore.getState();
    expect(s.partLevels.spark).toBe(1);
    expect(s.gold.toNumber()).toBe(0);
  });

  it("buyPartLevel('spark') with insufficient gold returns false; state unchanged (atomic)", () => {
    useGameStore.getState().add("gold", big(9));
    expect(useGameStore.getState().buyPartLevel("spark")).toBe(false);
    const s = useGameStore.getState();
    expect(s.partLevels.spark).toBe(0);
    expect(s.gold.toNumber()).toBe(9);
  });

  it("buyPartLevel('leaf') with currentStage = 0 returns false (locked stage)", () => {
    useGameStore.getState().add("gold", big(10000));
    expect(useGameStore.getState().buyPartLevel("leaf")).toBe(false);
    const s = useGameStore.getState();
    expect(s.partLevels.leaf).toBe(0);
    expect(s.gold.toNumber()).toBe(10000); // not deducted
  });

  it("buyPartLevel('nonexistent') returns false without touching gold", () => {
    useGameStore.getState().add("gold", big(100));
    expect(useGameStore.getState().buyPartLevel("nonexistent")).toBe(false);
    expect(useGameStore.getState().gold.toNumber()).toBe(100);
  });

  it("buying spark 10 times brings getTotalLevelsInStage(state, 0) to 10", () => {
    // Cumulative cost of 10 levels: sum_{i=0..9} 10 * 1.15^i ≈ 203.04
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      expect(useGameStore.getState().buyPartLevel("spark")).toBe(true);
    }
    expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(10);
  });

  it("the 11th spark purchase costs ≈ 10 * 1.15^10 (Big.pow precision: toBeCloseTo)", () => {
    // Phase 0+1 lesson #1: Big.pow uses log-domain math; tests must use toBeCloseTo.
    // Buy 10 levels first, then check cost of the 11th attempt.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    const goldBefore = useGameStore.getState().gold;
    expect(useGameStore.getState().buyPartLevel("spark")).toBe(true);
    const goldAfter = useGameStore.getState().gold;
    const spent = goldBefore.sub(goldAfter).toNumber();
    expect(spent).toBeCloseTo(10 * Math.pow(1.15, 10), 3);
  });

  it("getProducingParts returns only parts with level > 0 from unlocked stages", () => {
    useGameStore.getState().add("gold", big(1000));
    useGameStore.getState().buyPartLevel("spark"); // stage 0, level 1
    // 'bud' stays at level 0
    const producing = getProducingParts(useGameStore.getState());
    expect(producing).toHaveLength(1);
    expect(producing[0]?.level).toBe(1);
    expect(producing[0]?.rate).toBe(0.1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/store/treeSlice.test.ts`
Expected: FAIL — module `@/store/treeSlice` cannot be found, or `useGameStore.getState()` doesn't have `currentStage`/`partLevels`/`buyPartLevel`/`resetTree`.

- [ ] **Step 3: Create the slice file**

Create `src/store/treeSlice.ts`:

```ts
import type { StateCreator } from "zustand";
import { TREE_STAGES, type TreePartConfig } from "@/config/treeStages";
import { treePartCost } from "@/core/balance";
import type { GameStore } from "@/store";

export interface TreeState {
  /** Highest stage grown into. 0 = Seed (initial), 1 = Sapling, 2 = Tree. */
  currentStage: number;
  /** Per-part level. Seeded with every configured part ID at 0. */
  partLevels: Record<string, number>;
}

const initialPartLevels: Record<string, number> = Object.fromEntries(
  TREE_STAGES.flatMap((s) => s.parts.map((p) => [p.id, 0])),
);

export const initialTreeState: TreeState = {
  currentStage: 0,
  partLevels: initialPartLevels,
};

export interface TreeSlice extends TreeState {
  /**
   * Spend `treePartCost(level, baseCost)` gold; +1 level on the named part.
   * Atomic: validates funds via `currencySlice.spend` before incrementing.
   * Returns false if: unknown ID, locked stage, or insufficient gold.
   */
  buyPartLevel: (partId: string) => boolean;
  /** For ascend orchestrator (Phase 3). Resets state to `initialTreeState`. */
  resetTree: () => void;
}

/** Helper: locate a part's config + the stage index that owns it. */
function findPart(partId: string): { part: TreePartConfig; stageIdx: number } | null {
  for (let i = 0; i < TREE_STAGES.length; i++) {
    const stage = TREE_STAGES[i]!;
    const part = stage.parts.find((p) => p.id === partId);
    if (part) return { part, stageIdx: i };
  }
  return null;
}

export const createTreeSlice: StateCreator<GameStore, [], [], TreeSlice> = (set, get) => ({
  ...initialTreeState,

  buyPartLevel: (partId) => {
    const found = findPart(partId);
    if (!found) return false;
    const { part, stageIdx } = found;
    const state = get();
    if (stageIdx > state.currentStage) return false;
    const currentLevel = state.partLevels[partId] ?? 0;
    const cost = treePartCost(currentLevel, part.baseCost);
    if (!state.spend("gold", cost)) return false;
    set((s) => ({
      partLevels: { ...s.partLevels, [partId]: (s.partLevels[partId] ?? 0) + 1 },
    }));
    return true;
  },

  resetTree: () => set(initialTreeState),
});

// ============================================================================
// Selectors — pure functions over GameStore. Callable from anywhere.
// ============================================================================

/** Total levels across the parts of `stageIdx`. Returns 0 for invalid index. */
export const getTotalLevelsInStage = (state: GameStore, stageIdx: number): number => {
  const stage = TREE_STAGES[stageIdx];
  if (!stage) return 0;
  return stage.parts.reduce((sum, p) => sum + (state.partLevels[p.id] ?? 0), 0);
};

/**
 * Flat list of parts that contribute to inspi/sec right now:
 * stageIdx ≤ currentStage AND level > 0.
 */
export const getProducingParts = (
  state: GameStore,
): ReadonlyArray<{ level: number; rate: number }> => {
  const out: Array<{ level: number; rate: number }> = [];
  for (let i = 0; i <= state.currentStage && i < TREE_STAGES.length; i++) {
    const stage = TREE_STAGES[i]!;
    for (const part of stage.parts) {
      const level = state.partLevels[part.id] ?? 0;
      if (level > 0) out.push({ level, rate: part.rate });
    }
  }
  return out;
};
```

- [ ] **Step 4: Wire `treeSlice` into `useGameStore`**

Edit `src/store/index.ts`. Add the import and extend the type union + create call.

Find the existing imports at the top:

```ts
import { createMetaSlice, type MetaSlice } from "./metaSlice";
import { createCurrencySlice, type CurrencySlice } from "./currencySlice";
import { createHoverInfoSlice, type HoverInfoSlice } from "./hoverInfoSlice";
```

Add after them:

```ts
import { createTreeSlice, type TreeSlice } from "./treeSlice";
```

Find the `GameStore` type definition:

```ts
export type GameStore = MetaSlice & CurrencySlice & HoverInfoSlice;
```

Replace with:

```ts
export type GameStore = MetaSlice & CurrencySlice & HoverInfoSlice & TreeSlice;
```

Find the `create` call body:

```ts
    (...a) => ({
      ...createMetaSlice(...a),
      ...createCurrencySlice(...a),
      ...createHoverInfoSlice(...a),
    }),
```

Replace with:

```ts
    (...a) => ({
      ...createMetaSlice(...a),
      ...createCurrencySlice(...a),
      ...createHoverInfoSlice(...a),
      ...createTreeSlice(...a),
    }),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/store/treeSlice.test.ts`
Expected: PASS — 8 tests.

If a test fails because the singleton `useGameStore` carries leftover state from another test file (gold balance polluted), confirm `beforeEach` calls `resetRunCurrencies()` AND `resetTree()` (it does in the test file as written). If still failing, the test order is causing rehydration; rerun isolated with `npm test -- tests/store/treeSlice.test.ts`.

- [ ] **Step 6: Run full suite to confirm no regressions**

Run: `npm test`
Expected: 101 tests pass (93 + 8 new).

- [ ] **Step 7: Run typecheck**

Run: `npx tsc -b --noEmit` (or `npm run build` if `--noEmit` is unavailable; the build step itself catches type errors).
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/store/treeSlice.ts src/store/index.ts tests/store/treeSlice.test.ts
git commit -m "store(tree): state init + buyPartLevel + selectors

- TreeState: currentStage + partLevels record (every configured part seeded at 0).
- buyPartLevel: atomic spend-then-increment via currencySlice.spend; rejects
  unknown IDs, locked stages, insufficient funds.
- resetTree: for ascend (Phase 3) and test reset.
- getTotalLevelsInStage / getProducingParts: pure selectors over GameStore.
- Wire treeSlice into useGameStore.

Tests: 8 — initial state, happy path, atomicity, locked stage,
unknown ID, cumulative levels, Big.pow cost scaling (toBeCloseTo per
Phase 0+1 lesson #1), getProducingParts filtering."
```

---

## Task 4: `treeSlice` — `growSapling` + `canGrowSapling` selector

**Files:**
- Modify: `src/store/treeSlice.ts` (extend)
- Modify: `tests/store/treeSlice.test.ts` (extend)

**Goal:** Add the free, threshold-gated stage advancement action and its selector.

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/treeSlice.test.ts` (inside the same `describe` or as a new sibling describe — choose new sibling for clarity):

```ts
import { canGrowSapling } from "@/store/treeSlice";

describe("treeSlice — growSapling + canGrowSapling", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("canGrowSapling returns false at total stage-0 levels = 9", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 9; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(9);
    expect(canGrowSapling(useGameStore.getState())).toBe(false);
  });

  it("canGrowSapling returns true at exact threshold (totalLevels === 10)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(10);
    expect(canGrowSapling(useGameStore.getState())).toBe(true);
  });

  it("growSapling returns false when canGrowSapling is false; currentStage unchanged", () => {
    expect(useGameStore.getState().growSapling()).toBe(false);
    expect(useGameStore.getState().currentStage).toBe(0);
  });

  it("growSapling returns true when threshold is met; currentStage becomes 1", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    expect(useGameStore.getState().growSapling()).toBe(true);
    expect(useGameStore.getState().currentStage).toBe(1);
  });

  it("after growSapling to stage 1, stage-0 parts remain buyable (D5)", () => {
    useGameStore.getState().add("gold", big(100000));
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    useGameStore.getState().growSapling();
    expect(useGameStore.getState().currentStage).toBe(1);
    // stage-0 part still buyable
    expect(useGameStore.getState().buyPartLevel("bud")).toBe(true);
    expect(useGameStore.getState().partLevels.bud).toBe(1);
    // stage-1 part now also buyable
    expect(useGameStore.getState().buyPartLevel("leaf")).toBe(true);
    expect(useGameStore.getState().partLevels.leaf).toBe(1);
  });

  it("growSapling returns false at currentStage === TREE_STAGES.length - 1 (already at top)", () => {
    // Force-advance to the last stage by direct setState (test-only shortcut).
    useGameStore.setState({ currentStage: TREE_STAGES.length - 1 });
    expect(useGameStore.getState().growSapling()).toBe(false);
    expect(useGameStore.getState().currentStage).toBe(TREE_STAGES.length - 1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/store/treeSlice.test.ts`
Expected: FAIL — `canGrowSapling` not exported, `growSapling` is not a function on the store.

- [ ] **Step 3: Implement `growSapling` and `canGrowSapling`**

Edit `src/store/treeSlice.ts`:

In the `TreeSlice` interface (currently has `buyPartLevel` and `resetTree`), add `growSapling`:

```ts
export interface TreeSlice extends TreeState {
  buyPartLevel: (partId: string) => boolean;
  /**
   * If `canGrowSapling(state)`: increments `currentStage` by 1. Free.
   * Returns false otherwise (threshold not met, or already at top stage).
   */
  growSapling: () => boolean;
  resetTree: () => void;
}
```

In the `createTreeSlice` factory body, add the action between `buyPartLevel` and `resetTree`:

```ts
  growSapling: () => {
    const state = get();
    if (!canGrowSapling(state)) return false;
    set({ currentStage: state.currentStage + 1 });
    return true;
  },
```

Append a new selector at the bottom of the file (after `getProducingParts`):

```ts
/**
 * True iff the player can grow into the next stage:
 * - `currentStage + 1` exists in TREE_STAGES, AND
 * - total levels across the CURRENT stage's parts ≥ the next stage's `unlockThreshold`.
 */
export const canGrowSapling = (state: GameStore): boolean => {
  const next = state.currentStage + 1;
  if (next >= TREE_STAGES.length) return false;
  const required = TREE_STAGES[next]!.unlockThreshold;
  return getTotalLevelsInStage(state, state.currentStage) >= required;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/store/treeSlice.test.ts`
Expected: PASS — 14 tests total (8 from Task 3 + 6 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: 107 tests pass (101 + 6 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/treeSlice.ts tests/store/treeSlice.test.ts
git commit -m "store(tree): growSapling action + canGrowSapling selector

Free, threshold-gated stage advancement. Gate: total levels across
current stage's parts ≥ next stage's unlockThreshold (10 then 100,
per spec D4). After advance, prior-stage parts persist + remain
buyable (D5).

Tests: 6 — gate at 9 (false), at 10 (true), advance from 0 → 1,
prior-stage parts still buyable, top-stage cap returns false."
```

---

## Task 5: `treeSlice` — `treeTick`

**Files:**
- Modify: `src/store/treeSlice.ts` (extend)
- Modify: `tests/store/treeSlice.test.ts` (extend)

**Goal:** Per-frame inspiration accrual via cross-slice `state.add('inspiration', ...)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/treeSlice.test.ts`:

```ts
describe("treeSlice — treeTick", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("treeTick(1) with no levels: inspiration unchanged (no-op short-circuit)", () => {
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(before);
  });

  it("treeTick(1) with spark at level 5: credits 0.5 inspi (5 * 0.1 * 1)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(0.5, 6);
  });

  it("treeTick respects deltaSeconds linearly: tick(2) credits 2× tick(1)", () => {
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(2);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(1.0, 6); // 5 * 0.1 * 2 = 1.0
  });

  it("treeTick credits cumulatively across stages (D5: prior-stage parts still produce)", () => {
    // Set up: spark@1 (stage 0), leaf@1 (stage 1). Force currentStage = 1.
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("spark"); // 1 * 0.1 = 0.1
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().buyPartLevel("leaf"); // 1 * 5 = 5
    // Total expected rate: 0.1 + 5 = 5.1 inspi/sec
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const after = useGameStore.getState().inspiration.toNumber();
    expect(after - before).toBeCloseTo(5.1, 6);
  });
});

describe("treeSlice — resetTree", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
  });

  it("resetTree restores currentStage = 0 and zeroes all part levels", () => {
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("spark");
    useGameStore.getState().buyPartLevel("bud");
    useGameStore.setState({ currentStage: 2 });
    useGameStore.getState().resetTree();
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    for (const stage of TREE_STAGES) {
      for (const part of stage.parts) {
        expect(s.partLevels[part.id]).toBe(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/store/treeSlice.test.ts`
Expected: FAIL — `treeTick is not a function`.

- [ ] **Step 3: Implement `treeTick`**

Edit `src/store/treeSlice.ts`.

Add imports at the top (the existing imports include `treePartCost`; add `inspiPerSec` and the multipliers helper):

Replace:
```ts
import { treePartCost } from "@/core/balance";
```
With:
```ts
import { treePartCost, inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
```

In the `TreeSlice` interface, add `treeTick` between `growSapling` and `resetTree`:

```ts
export interface TreeSlice extends TreeState {
  buyPartLevel: (partId: string) => boolean;
  growSapling: () => boolean;
  /**
   * Per-frame: credit inspiration via currencySlice.
   * No-op when no parts are producing (avoids 60Hz persist writes during bootstrap).
   */
  treeTick: (deltaSeconds: number) => void;
  resetTree: () => void;
}
```

In the `createTreeSlice` factory body, add the action between `growSapling` and `resetTree`:

```ts
  treeTick: (deltaSeconds) => {
    const state = get();
    const producing = getProducingParts(state);
    if (producing.length === 0) return;
    const multiplier = getInspiMultiplier(state);
    const rate = inspiPerSec(producing, multiplier);
    if (rate.lte(0)) return;
    const gain = rate.mul(deltaSeconds);
    state.add("inspiration", gain);
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/store/treeSlice.test.ts`
Expected: PASS — 19 tests total (14 + 5 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: 112 tests pass (107 + 5 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/treeSlice.ts tests/store/treeSlice.test.ts
git commit -m "store(tree): treeTick — per-frame inspiration accrual + reset test

treeTick uses inspiPerSec(producingParts, getInspiMultiplier(state)) * delta,
credits via state.add('inspiration', gain). No-op when no parts produce
(avoids 60Hz persist churn during bootstrap).

resetTree test pins the reset contract for the Phase-3 ascend orchestrator.

Tests: 5 — no-level no-op, single-stage rate, linear delta scaling,
cross-stage cumulative accrual (D5), resetTree restores defaults."
```

---

## Task 6: `canvasSlice` — `canvasTick` + `resetCanvas`

**Files:**
- Create: `src/store/canvasSlice.ts`
- Modify: `src/store/index.ts` (add CanvasSlice to GameStore type union; spread into create call)
- Test: `tests/store/canvasSlice.test.ts`

**Goal:** Auto-painting canvas with one-sale-per-tick + carry-when-small math, plus reset for ascend.

- [ ] **Step 1: Write the failing test file**

Create `tests/store/canvasSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { PAINT_TIME_BASE_SECONDS, CANVAS_GOLD_BASE } from "@/core/balance";

describe("canvasSlice — canvasTick", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
  });

  it("initializes with canvasProgress 0", () => {
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(5) advances progress to 5; gold unchanged", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5);
    expect(useGameStore.getState().canvasProgress).toBe(5);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("two canvasTick(5) calls cross threshold: gold += CANVAS_GOLD_BASE, progress = 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5);
    useGameStore.getState().canvasTick(5);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(PAINT_TIME_BASE_SECONDS) at exact threshold: one sale, progress = 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(paintTime + 0.5) carries 0.5s leftover", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS + 0.5);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    // Floating point: leftover is 0.5 give or take rounding.
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(0.5, 9);
  });

  it("canvasTick(5 * paintTime) — synthetic huge delta — credits exactly one sale; progress clamped to 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5 * PAINT_TIME_BASE_SECONDS);
    // Exactly one sale, never more (D2 / spec §7).
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    // Leftover would have been 4 * paintTime ≥ paintTime → clamp to 0.
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(0) is a no-op: no sale, no progress change, no gold change", () => {
    useGameStore.setState({ canvasProgress: 3 });
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().canvasProgress).toBe(3);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("with multipliers returning 1 (Phase 2), one sale credits exactly CANVAS_GOLD_BASE", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
  });
});

describe("canvasSlice — resetCanvas", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
  });

  it("resetCanvas sets canvasProgress to 0", () => {
    useGameStore.setState({ canvasProgress: 7.3 });
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/store/canvasSlice.test.ts`
Expected: FAIL — `canvasProgress`/`canvasTick`/`resetCanvas` not on the store.

- [ ] **Step 3: Create the slice file**

Create `src/store/canvasSlice.ts`:

```ts
import type { StateCreator } from "zustand";
import { PAINT_TIME_BASE_SECONDS, canvasGold } from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import type { GameStore } from "@/store";

export interface CanvasState {
  /**
   * Seconds painted on the current canvas.
   * Invariant: 0 ≤ canvasProgress < effectivePaintTime.
   * On threshold-cross, a sale fires and progress resets (with optional carry).
   */
  canvasProgress: number;
}

export const initialCanvasState: CanvasState = { canvasProgress: 0 };

export interface CanvasSlice extends CanvasState {
  /**
   * Per-frame canvas advance.
   * One-sale-per-tick rule: even if `delta ≥ paintTime`, exactly one sale fires.
   * Leftover is carried forward only when `< paintTime`; otherwise clamped to 0.
   */
  canvasTick: (deltaSeconds: number) => void;
  /** For ascend orchestrator (Phase 3). */
  resetCanvas: () => void;
}

export const createCanvasSlice: StateCreator<GameStore, [], [], CanvasSlice> = (set, get) => ({
  ...initialCanvasState,

  canvasTick: (deltaSeconds) => {
    const state = get();
    const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(state);
    const newProgress = state.canvasProgress + deltaSeconds;

    if (newProgress < paintTime) {
      set({ canvasProgress: newProgress });
      return;
    }

    // Threshold crossed — exactly one sale per tick.
    const gain = canvasGold(getCanvasGoldMultiplier(state));
    state.add("gold", gain);
    const leftover = newProgress - paintTime;
    // If leftover would itself trigger another sale, drop to 0 (one-sale-per-tick).
    set({ canvasProgress: leftover < paintTime ? leftover : 0 });
  },

  resetCanvas: () => set(initialCanvasState),
});
```

- [ ] **Step 4: Wire `canvasSlice` into `useGameStore`**

Edit `src/store/index.ts`. Add the import and extend the type union + create call.

After the `treeSlice` import:

```ts
import { createTreeSlice, type TreeSlice } from "./treeSlice";
```

Add:

```ts
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
```

Replace:

```ts
export type GameStore = MetaSlice & CurrencySlice & HoverInfoSlice & TreeSlice;
```

With:

```ts
export type GameStore = MetaSlice & CurrencySlice & HoverInfoSlice & TreeSlice & CanvasSlice;
```

Replace:

```ts
    (...a) => ({
      ...createMetaSlice(...a),
      ...createCurrencySlice(...a),
      ...createHoverInfoSlice(...a),
      ...createTreeSlice(...a),
    }),
```

With:

```ts
    (...a) => ({
      ...createMetaSlice(...a),
      ...createCurrencySlice(...a),
      ...createHoverInfoSlice(...a),
      ...createTreeSlice(...a),
      ...createCanvasSlice(...a),
    }),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/store/canvasSlice.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test`
Expected: 121 tests pass (112 + 9 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/canvasSlice.ts src/store/index.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): canvasTick with one-sale-per-tick + resetCanvas

canvasTick advances progress by delta; on threshold cross, credits
canvasGold(multiplier) and resets. Leftover carries forward when
< paintTime; otherwise clamped to 0 (D2 safety against synthetic
huge deltas — production tickLoop caps at 1s anyway).

resetCanvas for ascend orchestrator (Phase 3).

Tests: 9 — initial state, sub-threshold advance, two-tick sale,
exact-threshold sale, sub-second carry, 5x-paintTime synthetic
clamp, zero-delta no-op, exact CANVAS_GOLD_BASE credit, reset."
```

---

## Task 7: `tickAll` orchestrator

**Files:**
- Modify: `src/store/index.ts` (add GameTick interface; inline `tickAll` action)
- Test: `tests/store/tickAll.test.ts`

**Goal:** Top-level `tickAll(delta)` that calls `treeTick` then `canvasTick`. Order pinned by spy test.

- [ ] **Step 1: Write the failing test file**

Create `tests/store/tickAll.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";

describe("tickAll orchestrator", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
  });

  it("tickAll(1) credits inspiration AND advances canvas in one call", () => {
    // Set up: spark@5 produces 0.5 inspi/sec; canvas starts mid-paint.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    useGameStore.setState({ canvasProgress: PAINT_TIME_BASE_SECONDS - 0.5 });
    const inspBefore = useGameStore.getState().inspiration.toNumber();
    const goldBefore = useGameStore.getState().gold.toNumber();

    useGameStore.getState().tickAll(1);

    // Tree credit: 5 * 0.1 * 1 = 0.5
    expect(useGameStore.getState().inspiration.toNumber() - inspBefore).toBeCloseTo(0.5, 6);
    // Canvas: 9.5 + 1 = 10.5 ≥ 10, so one sale fires; gold += CANVAS_GOLD_BASE.
    expect(useGameStore.getState().gold.toNumber() - goldBefore).toBe(10);
    // Progress carries 0.5s leftover.
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(0.5, 9);
  });

  it("tickAll calls treeTick BEFORE canvasTick (order pinned for Phase 3 forward-compat)", () => {
    // Spy on the slice methods via the live store. We replace them with
    // recording wrappers that capture invocation order.
    const calls: Array<"tree" | "canvas"> = [];
    const original = {
      treeTick: useGameStore.getState().treeTick,
      canvasTick: useGameStore.getState().canvasTick,
    };
    useGameStore.setState({
      treeTick: (delta: number) => {
        calls.push("tree");
        original.treeTick(delta);
      },
      canvasTick: (delta: number) => {
        calls.push("canvas");
        original.canvasTick(delta);
      },
    });

    useGameStore.getState().tickAll(0.1);

    expect(calls).toEqual(["tree", "canvas"]);

    // Restore originals so other tests aren't polluted.
    useGameStore.setState({ treeTick: original.treeTick, canvasTick: original.canvasTick });
  });

  it("tickAll(0) is a valid idle frame: no inspiration change, no gold change", () => {
    const inspBefore = useGameStore.getState().inspiration.toNumber();
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progBefore = useGameStore.getState().canvasProgress;

    useGameStore.getState().tickAll(0);

    expect(useGameStore.getState().inspiration.toNumber()).toBe(inspBefore);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progBefore);
  });
});
```

Note: the spy test (case 2) uses `useGameStore.setState` to replace methods in-place. It restores them at the end so subsequent tests in this file (or other files run later) aren't affected. The unused `vi` import is harmless and may be removed if the linter complains; the import is kept to signal that vitest's `vi` API is what would be used for fancier spies.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/store/tickAll.test.ts`
Expected: FAIL — `tickAll is not a function`.

- [ ] **Step 3: Add `GameTick` interface and `tickAll` to the combined store**

Edit `src/store/index.ts`.

Below the existing imports (after the canvasSlice import added in Task 6), add the interface near the `GameStore` type:

Find:

```ts
export type GameStore = MetaSlice & CurrencySlice & HoverInfoSlice & TreeSlice & CanvasSlice;
```

Replace with:

```ts
export interface GameTick {
  /**
   * Per-frame orchestrator. Calls `treeTick(delta)` first, then `canvasTick(delta)`.
   * Order is part of the API contract and pinned by tests; future phases that
   * depend on freshly-credited inspiration (none in Phase 2) require tree-first.
   */
  tickAll: (deltaSeconds: number) => void;
}

export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & GameTick;
```

In the `create` call, replace:

```ts
    (...a) => ({
      ...createMetaSlice(...a),
      ...createCurrencySlice(...a),
      ...createHoverInfoSlice(...a),
      ...createTreeSlice(...a),
      ...createCanvasSlice(...a),
    }),
```

With:

```ts
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
      },
    }),
```

(The spread-args change from `(...a)` to `(set, get, store)` is so `get` can be referenced inside `tickAll`. The `createXSlice(set, get, store)` calls remain equivalent.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/store/tickAll.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: 124 tests pass (121 + 3 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts tests/store/tickAll.test.ts
git commit -m "store: tickAll orchestrator — tree first, canvas second

Inline GameTick interface adds tickAll(delta) to the combined store.
Order pinned by spy test for Phase 3 forward-compat (a future
mechanic that consumes freshly-credited inspiration on the same tick
relies on tree-first).

Tests: 3 — full integration (inspiration + gold both move),
spy-verified order, idle-frame no-op."
```

---

## Task 8: `throttledAdapter` + `persistedAdapter` swap

**Files:**
- Modify: `src/systems/persistence.ts` (add `throttledAdapter`, export `persistedAdapter`)
- Modify: `src/store/index.ts` (swap `idbAdapter` → `persistedAdapter` in `createJSONStorage`)
- Test: `tests/systems/persistence.test.ts` (extend with 6 throttle cases)

**Goal:** Coalesce 60Hz `setItem` calls into ~1 IDB write/sec via debounce. Provide `flush()` for graceful save on hide/unload.

- [ ] **Step 1: Write the failing throttle tests**

Append to `tests/systems/persistence.test.ts` (new describe block at the end of the file):

```ts
import { afterEach, vi } from "vitest";
import { throttledAdapter, persistedAdapter } from "@/systems/persistence";

describe("throttledAdapter", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await idbAdapter.removeItem("throttle-test");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces N rapid setItem calls within the window into ONE base write", async () => {
    const throttled = throttledAdapter(idbAdapter, 100);

    await throttled.setItem("throttle-test", "v1");
    await throttled.setItem("throttle-test", "v2");
    await throttled.setItem("throttle-test", "v3");

    // Before the timer fires, IDB hasn't been written.
    expect(await idbAdapter.getItem("throttle-test")).toBeNull();

    // Advance time past the window. advanceTimersByTimeAsync also flushes the
    // resulting microtask (the awaited base.setItem inside the timer callback).
    await vi.advanceTimersByTimeAsync(100);

    expect(await idbAdapter.getItem("throttle-test")).toBe("v3");
  });

  it("the flushed value is the LATEST of the queued calls (latest-wins)", async () => {
    const throttled = throttledAdapter(idbAdapter, 100);
    await throttled.setItem("throttle-test", "first");
    await throttled.setItem("throttle-test", "middle");
    await throttled.setItem("throttle-test", "latest");
    await vi.advanceTimersByTimeAsync(100);
    expect(await idbAdapter.getItem("throttle-test")).toBe("latest");
  });

  it("flush() writes pending immediately and clears pending state", async () => {
    const throttled = throttledAdapter(idbAdapter, 1000);
    await throttled.setItem("throttle-test", "now");
    expect(await idbAdapter.getItem("throttle-test")).toBeNull();

    await throttled.flush();

    expect(await idbAdapter.getItem("throttle-test")).toBe("now");

    // Advancing past the original window must not write again.
    await vi.advanceTimersByTimeAsync(1000);
    // (Still "now"; if the timer had re-fired, it would still be "now" because
    // pending was cleared. To prove non-re-fire, write a different value via
    // base directly and confirm it isn't overwritten by a stale flush.)
    await idbAdapter.setItem("throttle-test", "external");
    await vi.advanceTimersByTimeAsync(2000);
    expect(await idbAdapter.getItem("throttle-test")).toBe("external");
  });

  it("flush() with no pending is a no-op (does not throw, does not write)", async () => {
    const throttled = throttledAdapter(idbAdapter, 1000);
    await throttled.flush(); // no pending
    expect(await idbAdapter.getItem("throttle-test")).toBeNull();
  });

  it("re-arming: after flush, a new setItem starts a fresh window", async () => {
    const throttled = throttledAdapter(idbAdapter, 100);
    await throttled.setItem("throttle-test", "first");
    await throttled.flush();
    expect(await idbAdapter.getItem("throttle-test")).toBe("first");

    await throttled.setItem("throttle-test", "second");
    expect(await idbAdapter.getItem("throttle-test")).toBe("first"); // not yet
    await vi.advanceTimersByTimeAsync(100);
    expect(await idbAdapter.getItem("throttle-test")).toBe("second");
  });

  it("getItem and removeItem are pass-through (not throttled)", async () => {
    const throttled = throttledAdapter(idbAdapter, 1000);
    await idbAdapter.setItem("throttle-test", "direct");
    expect(await throttled.getItem("throttle-test")).toBe("direct");
    await throttled.removeItem("throttle-test");
    expect(await idbAdapter.getItem("throttle-test")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/systems/persistence.test.ts`
Expected: FAIL — `throttledAdapter` and `persistedAdapter` not exported.

- [ ] **Step 3: Implement `throttledAdapter` and export `persistedAdapter`**

Edit `src/systems/persistence.ts`. After the `idbAdapter` export, append:

```ts
/**
 * Wraps a SaveAdapter so that rapid `setItem` calls are coalesced into one
 * base write per `intervalMs` window. Exposes a `flush()` method for graceful
 * save-on-close (visibilitychange / beforeunload).
 *
 * Latest-wins: only the most recently passed value is written.
 *
 * `getItem` and `removeItem` are pass-through (not throttled).
 */
export interface ThrottledSaveAdapter extends SaveAdapter {
  flush: () => Promise<void>;
}

export function throttledAdapter(
  base: SaveAdapter,
  intervalMs: number,
): ThrottledSaveAdapter {
  let pending: { name: string; value: string } | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (pending === null) return;
    const p = pending;
    pending = null;
    await base.setItem(p.name, p.value);
  };

  return {
    getItem: base.getItem.bind(base),
    removeItem: base.removeItem.bind(base),
    setItem: async (name, value) => {
      pending = { name, value };
      if (timerId === null) {
        timerId = setTimeout(() => {
          // Fire-and-forget; consumers should call flush() to await completion.
          void flush();
        }, intervalMs);
      }
    },
    flush,
  };
}

/**
 * The production storage adapter used by the Zustand persist middleware.
 * Throttled to ~1Hz to bound IDB write rate during tick-driven mutations
 * (Phase 2: ~60Hz state changes from canvas/tree ticks).
 *
 * Save loss bound on hard crash: ≤ 1 second of work. Graceful tab close
 * triggers `flush()` via main.tsx listeners → zero loss.
 */
export const persistedAdapter: ThrottledSaveAdapter = throttledAdapter(idbAdapter, 1000);
```

- [ ] **Step 4: Swap `idbAdapter` → `persistedAdapter` in the store**

Edit `src/store/index.ts`.

Find:

```ts
import { idbAdapter } from "@/systems/persistence";
```

Replace with:

```ts
import { idbAdapter, persistedAdapter } from "@/systems/persistence";
```

(`idbAdapter` import retained for the existing `migrate`/test imports — it isn't strictly needed in this file, but leaving the import-pair is harmless and keeps the diff tight. If TS reports the import as unused, drop the bare `idbAdapter` and keep only `persistedAdapter`.)

Find:

```ts
      storage: createJSONStorage(() => idbAdapter, { reviver }),
```

Replace with:

```ts
      storage: createJSONStorage(() => persistedAdapter, { reviver }),
```

If after the edit `idbAdapter` is unused in `src/store/index.ts`, remove it from the import:

```ts
import { persistedAdapter } from "@/systems/persistence";
```

- [ ] **Step 5: Run the throttle tests to verify they pass**

Run: `npm test -- tests/systems/persistence.test.ts`
Expected: PASS — 11 tests total (5 existing + 6 new).

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test`
Expected: 130 tests pass (124 + 6 new).

NOTE: existing `persistence-integration.test.ts` writes via the persist middleware (now throttled) and reads back via `idbAdapter.getItem` directly. With the 1s throttle, `await new Promise((r) => setTimeout(r, 50))` is no longer enough to capture the write — the throttle hasn't fired yet. **Some existing tests may now fail.** This is a known-and-expected fallout that Task 9 fixes by calling `persistedAdapter.flush()` between mutation and read in the integration tests.

If existing `persistence-integration` tests fail at this point, that's the expected state — proceed to Step 7. The fix lands in Task 9 alongside the new round-trip test (which uses the same `flush()` pattern).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit (with the integration-test-failure note in the body)**

```bash
git add src/systems/persistence.ts src/store/index.ts tests/systems/persistence.test.ts
git commit -m "persistence: throttledAdapter — coalesce tick-driven writes to ~1Hz

Wraps idbAdapter to debounce setItem calls within a configurable
window. Exports persistedAdapter (1s window) and swaps it into
store/index.ts. flush() method exposed for save-on-hide wiring
(landing in main.tsx in Task 9).

Bounds save loss to ≤ 1s on hard crash; graceful tab close (flush
listeners in next task) yields zero loss.

Tests: 6 — coalesce, latest-wins, flush-and-clear, no-pending no-op,
re-arm after flush, getItem/removeItem pass-through.

Known fallout: persistence-integration.test.ts cases that wait 50ms
before reading raw IDB will fail because the throttle hasn't fired.
Task 9 fixes them by calling persistedAdapter.flush() between
mutate and read."
```

---

## Task 9: `main.tsx` wiring + persistence-integration round-trip

**Files:**
- Modify: `src/main.tsx` (start tickLoop after hydration; flush adapter on visibilitychange/beforeunload)
- Modify: `tests/store/persistence-integration.test.ts` (fix existing tests for throttle; add 1 round-trip)

**Goal:** Wire RAF tickLoop to `tickAll` after hydration; ensure save flushes on tab close. Verify the full Phase-2 round-trip.

- [ ] **Step 1: Update `main.tsx` — start tickLoop + flush listeners**

Edit `src/main.tsx`. The current file is:

```tsx
import { StrictMode, useEffect, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { useGameStore } from "@/store";
import { LoadingScreen } from "@/ui/widgets/LoadingScreen";
import { App } from "@/App";
import "./index.css";

function Bootstrap(): JSX.Element {
  const [hydrated, setHydrated] = useState<boolean>(useGameStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  if (!hydrated) return <LoadingScreen />;
  return <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found in index.html");

createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
```

Replace with:

```tsx
import { StrictMode, useEffect, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { useGameStore } from "@/store";
import { LoadingScreen } from "@/ui/widgets/LoadingScreen";
import { App } from "@/App";
import { startTickLoop, stopTickLoop } from "@/core/tickLoop";
import { persistedAdapter } from "@/systems/persistence";
import "./index.css";

function Bootstrap(): JSX.Element {
  const [hydrated, setHydrated] = useState<boolean>(useGameStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  // Start the RAF tick loop after hydration. tickLoop.startTickLoop guards
  // against double-start (StrictMode dev mounts effects twice).
  useEffect(() => {
    if (!hydrated) return;
    startTickLoop((delta) => useGameStore.getState().tickAll(delta));
    return () => stopTickLoop();
  }, [hydrated]);

  // Flush throttled persist on tab hide / unload. visibilitychange fires
  // before beforeunload in modern browsers; beforeunload is the belt-and-
  // braces fallback. Both call paths converge on persistedAdapter.flush().
  useEffect(() => {
    if (!hydrated) return;
    const onHide = (): void => {
      void persistedAdapter.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [hydrated]);

  if (!hydrated) return <LoadingScreen />;
  return <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found in index.html");

createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
```

- [ ] **Step 2: Fix existing `persistence-integration.test.ts` cases for the throttle**

Edit `tests/store/persistence-integration.test.ts`. The existing tests currently write via the persist middleware then wait 50ms and read raw IDB. With the 1s throttle, the write hasn't fired in 50ms.

Replace the import line:

```ts
import { idbAdapter } from "@/systems/persistence";
```

With:

```ts
import { idbAdapter, persistedAdapter } from "@/systems/persistence";
```

Find each occurrence of:

```ts
    await new Promise((r) => setTimeout(r, 50));
```

(There are several — one in each test that mutates state and reads raw IDB.) Replace each with:

```ts
    await persistedAdapter.flush();
```

For the `"rehydration reconstructs Bigs from {__big} markers"` test (last one in the file), the same edit applies: replace the `setTimeout` wait with `persistedAdapter.flush()`. The subsequent `useGameStore.persist.rehydrate()` call still works correctly because rehydrate reads through `persistedAdapter.getItem` (which is pass-through, not throttled).

- [ ] **Step 3: Add the round-trip test**

Append to `tests/store/persistence-integration.test.ts`:

```ts
import { TREE_STAGES } from "@/config/treeStages";

describe("persistence integration — Phase 2 fields round-trip", () => {
  beforeEach(async () => {
    await idbAdapter.removeItem("artdle-save");
    // Reset in-memory state to defaults so the test starts from a clean slate.
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
  });

  it("partLevels + currentStage + canvasProgress all round-trip through save", async () => {
    // Seed known state.
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("spark"); // partLevels.spark → 1
    useGameStore.getState().buyPartLevel("spark"); // → 2
    useGameStore.getState().buyPartLevel("bud"); // partLevels.bud → 1
    useGameStore.setState({ currentStage: 1, canvasProgress: 5.5 });

    const beforeStage = useGameStore.getState().currentStage;
    const beforeProgress = useGameStore.getState().canvasProgress;
    const beforeLevels = { ...useGameStore.getState().partLevels };

    // Force the throttle to flush the latest persist write.
    await persistedAdapter.flush();

    // Stomp in-memory state with bogus values so we can prove rehydration
    // restored from IDB rather than just observing in-memory.
    useGameStore.setState({
      currentStage: 99,
      canvasProgress: 999,
      partLevels: Object.fromEntries(
        TREE_STAGES.flatMap((s) => s.parts.map((p) => [p.id, 99])),
      ),
    });

    // Force-rehydrate from IDB.
    await useGameStore.persist.rehydrate();

    // Assert the seeded values were restored.
    const after = useGameStore.getState();
    expect(after.currentStage).toBe(beforeStage);
    expect(after.canvasProgress).toBe(beforeProgress);
    expect(after.partLevels).toEqual(beforeLevels);
  });
});
```

- [ ] **Step 4: Run the integration tests to verify they pass**

Run: `npm test -- tests/store/persistence-integration.test.ts`
Expected: PASS — 6 tests total (5 existing fixed + 1 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: 131 tests pass (130 + 1 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: clean (or only the existing `react-refresh/only-export-components` warning on `main.tsx`, now applied to the same `Bootstrap` component declaration; the warning was already present before Phase 2 and is documented in HANDOVER.md as known low-priority).

- [ ] **Step 6: Manual smoke test**

This is the only verification not covered by automated tests. Run:

```bash
npm run dev
```

Open the dev URL (Vite prints it; usually `http://localhost:5173`).

Expected behaviors:
1. Page loads. After hydration, the existing `App` stub renders showing the playerId.
2. **No tree levels yet → no inspiration accrual** (the no-op short-circuit in `treeTick`). Verified by opening DevTools → React DevTools or Console: `useGameStore.getState().inspiration.toString()` stays at `"0"`.
3. **Canvas DOES advance** (it has no gating). After ~10 seconds: `useGameStore.getState().gold.toString()` should have increased by `"10"` per sale.
4. In DevTools console, `useGameStore.getState().add("gold", new (await import("break_eternity.js")).default(100))` (or just use the existing testing UI when Phase 4 lands). Then `useGameStore.getState().buyPartLevel("spark")` → returns `true`. Watch inspiration tick up over the next few seconds.
5. **Refresh the page.** The values for `gold`, `inspiration`, `canvasProgress`, `partLevels` should persist (after the brief LoadingScreen flash).
6. **Open DevTools → Application → IndexedDB → keyval-store**. Observe writes are throttled — the `artdle-save` value should update at most ~once per second, not 60×/sec.

If any of these steps fail, troubleshoot before committing.

Stop the dev server with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx tests/store/persistence-integration.test.ts
git commit -m "bootstrap: start tickLoop after hydration + flush adapter on hide/unload

main.tsx gains two effects (each scoped to post-hydration):
1. startTickLoop → useGameStore.getState().tickAll(delta); cleaned up on unmount.
2. visibilitychange + beforeunload → persistedAdapter.flush() so graceful
   tab close yields zero save loss.

Existing persistence-integration tests updated to call flush() between
mutate and read (the 50ms setTimeout wait is no longer enough now that
the adapter throttles to 1s).

New test: full Phase 2 round-trip — partLevels + currentStage +
canvasProgress all survive a stomp-and-rehydrate cycle, proving the
serializeBigs walker's no-op behavior on JS-primitive fields.

Manual smoke verified: gold ticks up, levels persist, IDB writes
throttled to ~1Hz."
```

---

## Post-implementation: handover snapshot

After Task 9 commits, update the handover document so the next phase has fresh state.

- [ ] **Step 1: Update `docs/HANDOVER.md`**

Replace the file contents with a Phase-2-completion snapshot. Use this template; fill in test-count specifics by running `npm test -- --reporter=verbose 2>&1 | grep -E "(Tests|Test Files)"` and the like:

```markdown
# Artdle Web — Handover

**Date:** 2026-05-01 (post Phase 0+1+2 execution)
**Status:** Phase 0+1+2 plans executed. ~131/131 tests green. tsc clean. lint clean (1 unrelated warning).

---

## Where we are

The repo at `~/Documents/artdle-web/` has the gameplay loop online end-to-end with no UI. The plan at `docs/superpowers/plans/2026-05-01-artdle-web-phase2.md` is fully executed.

**What's green from Phase 2:**

- `src/core/multipliers.ts`: empty pure aggregators (Phase 3 wires contributors).
- `src/config/treeStages.ts`: 3 stages × 2 parts, thresholds 0/10/100.
- `src/store/treeSlice.ts`: state, `buyPartLevel`, `growSapling`, `treeTick`, `resetTree`, plus `getTotalLevelsInStage` / `canGrowSapling` / `getProducingParts` selectors.
- `src/store/canvasSlice.ts`: `canvasTick` (one-sale-per-tick + carry-when-small), `resetCanvas`.
- `src/store/index.ts`: combined `GameStore` includes 5 slices + `tickAll(delta)` orchestrator (tree-first, canvas-second order pinned).
- `src/systems/persistence.ts`: `throttledAdapter` wrapper + `persistedAdapter` (1s window). `flush()` exposed.
- `src/main.tsx`: starts tickLoop + flushes adapter on visibilitychange/beforeunload (both post-hydration).

**Test count breakdown:** [run the suite verbose and fill in].

---

## What's next

Phase 3 — Workshop click-to-craft, Ascend, Skill Tree (5 nodes). See `docs/PORT_PLAN.md` §7 Phase 3 for scope.

The Phase 3 plan needs a fresh brainstorm → spec → plan → execute cycle.

Notable Phase 3 hooks already laid:
- `core/multipliers.ts` is the place where Phase 3 wires `+canvas_gold%`, `+inspiration_rate%`, `-paint_time%` contributors. No changes to `treeTick` / `canvasTick` call sites needed.
- `resetTree()` / `resetCanvas()` already ship; the Phase 3 ascend orchestrator just calls them alongside `resetRunCurrencies()`.
- `tickAll` order is pinned tree-first; if a Phase 3 mechanic needs to consume freshly-credited inspiration, that ordering is guaranteed.

---

## Lessons from Phase 2 execution

[Fill in if anything surprising happened during execution. Phase 0+1's lessons #1, #2, #3 should NOT have caused new pain because the plan baked them in (toBeCloseTo for cost-scaling, no partialize change needed for new JS-primitive fields, test names = test contracts). If any did surface, document the new lesson here.]

---

## Repo state at handover

- Branch: `master` (no remote configured).
- Most recent: see `git log --oneline -10`.
- Working tree: clean apart from `.claude/` (untracked, harness-local — do not commit).

---

## Known low-priority issues (carried forward)

- `src/main.tsx` triggers `react-refresh/only-export-components` warning (pre-existing).
- `public/assets/artdle/` `.png.import` sidecar files (pre-existing).
- React Compiler dropped during Phase 0+1 Task 6 (pre-existing).

---

## How to start Phase 3

In a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 3 (Workshop + Ascend + Skill Tree). Use the brainstorming skill to scope it, then writing-plans to produce the next plan in `docs/superpowers/plans/`, then executing it via subagent-driven-development.
```

- [ ] **Step 2: Commit the handover snapshot**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): snapshot post Phase 2 — gameplay loop online, ~131 tests green"
```

---

## Plan self-review

Before handing this plan to subagents, the plan-author has verified:

1. **Spec coverage**: every section of `2026-05-01-phase2-tree-canvas-design.md` maps to a task. §3 (file layout) → all tasks. §4 (treeStages) → Task 2. §5 (multipliers) → Task 1. §6 (treeSlice) → Tasks 3-5. §7 (canvasSlice) → Task 6. §8 (tickAll) → Task 7. §9 (main.tsx) → Task 9. §10 (throttle) → Task 8. §11 (persistence-integration extension) → Task 9. §12 (Phase 0+1 lessons) → baked into Task 3 (Big.pow), Task 9 (serializeBigs), and the precise test-name discipline throughout. §13 (test budget) → 4+5+8+6+5+9+3+6+1 = 47 new tests (slightly over the 44 estimate; the +3 comes from splitting treeSlice into 8+6+5 across three tasks for tighter TDD cycles, with a couple of bonus assertions for the linear-delta-scaling case). §14 (task order) → Tasks 1-9 in order. §15 (DoD) → covered by per-task Run commands and Task 9's manual smoke + Post-implementation handover.

2. **Placeholder scan**: no "TBD" / "TODO" / "fill in" / "implement appropriately" anywhere. Every code block contains the actual code. Every commit message is fully written. Every Run command has expected output. The handover template (Post-implementation Step 1) has one bracketed `[fill in]` for test-count specifics that the executing agent will populate by running the suite — this is not a plan placeholder but a runtime measurement that must wait until the suite has actually run.

3. **Type / signature consistency**:
   - `buyPartLevel(partId: string): boolean` — declared in Task 3 interface, called in Tasks 3-5 tests, never renamed.
   - `growSapling(): boolean` — declared in Task 4, used in Tasks 4-5.
   - `treeTick(deltaSeconds: number): void` — declared in Task 5, called by `tickAll` in Task 7.
   - `canvasTick(deltaSeconds: number): void` — declared in Task 6, called by `tickAll` in Task 7.
   - `resetTree() / resetCanvas()` — declared in Tasks 3 and 6, used in test setup (`beforeEach`) throughout, plus the round-trip test in Task 9.
   - `getTotalLevelsInStage`, `canGrowSapling`, `getProducingParts` — selectors declared in Tasks 3-4, imported and used consistently.
   - `getInspiMultiplier`, `getCanvasGoldMultiplier`, `getPaintTimeMultiplier` — declared in Task 1, used in Task 5 (treeTick) and Task 6 (canvasTick).
   - `throttledAdapter`, `persistedAdapter`, `ThrottledSaveAdapter` — declared in Task 8, used in Task 9.
   - `tickAll(deltaSeconds: number): void` — declared in Task 7, used in Task 9 main.tsx.
   - `TREE_STAGES`, `TreeStageConfig`, `TreePartConfig` — declared in Task 2, used throughout Tasks 3-5 + Task 9 round-trip test.

4. **Phase 0+1 lessons enforced**:
   - Lesson #1 (Big.pow → toBeCloseTo): Task 3 Step 1 test #7 explicitly uses `toBeCloseTo(10 * Math.pow(1.15, 10), 3)`. Task 5 tests use `toBeCloseTo` for inspi accruals.
   - Lesson #2 (recursive serializeBigs): Task 9's round-trip test verifies the new JS-primitive fields flow through with no `partialize` change.
   - Lesson #3 (test names = test contracts): each `it("...")` description is precise; bullets like "returns false at total stage-0 levels = 9" assert at exactly 9, with the threshold-met case in a separate test.

Plan is ready for subagent execution.

---

## Execution

The originating user request specified subagent-driven-development. After the plan is reviewed, the next step is to invoke `superpowers:subagent-driven-development` to dispatch one subagent per task with two-stage review between tasks.
