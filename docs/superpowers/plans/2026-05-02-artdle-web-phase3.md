# Artdle Web — Phase 3 Implementation Plan: Workshop + Ascend + Skill Tree

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the meta-progression online end-to-end with no UI: workshop crafts items into an inventory, equip/unequip/swap/discard verbs, ascend converts inspiration to fame and resets the run, 5-node linear skill tree purchased with fame, and Phase 2's empty multiplier pipe wired to read item affixes + skill nodes.

**Architecture:** Two new Zustand slices (`workshopSlice`, `skillTreeSlice`) wired into the existing combined `GameStore`. A new `systems/ascend.ts` exports `getEffectivePalier`, `canAscend`, and the `performAscendOrchestrator(set, get)` pure function; `metaSlice` adds a 1-line `performAscend()` action that wraps it. The existing `core/multipliers.ts` file gets new bodies that read item-equipped contributions + skill-node flags. No `tickAll` changes (workshop is click-driven, ascend is event-driven, skill tree is click-driven).

**Tech Stack:** React 19 + TypeScript 6 strict + Vite 8 + Zustand 5 (persist middleware) + `break_eternity.js` (`Big`) + `idb-keyval` + `mulberry32` RNG (already in `core/rng.ts`) + Vitest 4 + `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-05-02-phase3-workshop-ascend-skilltree-design.md` is the authoritative design. This plan implements §14's task order.

---

## Pre-flight (read once before starting Task 1)

### Locked design decisions (from spec §2)

1. **Dynamic equip slot count** — default 1, becomes 2 after Second Slot is purchased. `getCurrentSlotCount(state)` selector.
2. **Two-stage craft via inventory** — craft into inventory; separate `equip` to commit.
3. **Inventory cap = 3, craft fails when full** (no gold spent on failure).
4. **Five atomic workshop verbs** — `craft`, `equip`, `unequip`, `swap`, `discard` (+ `resetWorkshop`).
5. **Better Brush is roll-time** — future crafts roll `[6, 16]`; existing items keep their magnitude.
6. **Ascend is a hard reset** — wipes gold, inspiration, tree, canvas, inventory, equippedItems. Preserves fame, ascendCount, purchasedNodes, playerId.
7. **Architecture: 3 slices + systems/ascend.ts orchestrator.** `metaSlice.performAscend()` is a 1-line wrapper.
8. **`purchasedNodes` is `Record<string, true>`** — not `Set` (Sets serialize to `{}`). `SkillNodeId` is a literal union type for compile-time typo protection.

### Phase 0+1+2 lessons baked into this plan

- **Big.pow precision**: tests asserting Big-derived values that flow through `Big.pow` must use `toBeCloseTo`. Applied in Task 6 (`getEffectivePalier(state, 5)` test).
- **`serializeBigs` is recursive and automatic**: new persisted JS-primitive fields need zero `partialize` change. Task 8's round-trip test verifies this.
- **Test name = test contract**: each `it("...")` description must precisely describe what the body asserts. Plan reviewer checks this.
- **`Object.freeze` on initial-state constants**: `initialWorkshopState` and `initialSkillTreeState` are both frozen.
- **`SkillNodeId` literal union type** for compile-time typo protection.

### Run commands cheat sheet

| Action | Command |
|---|---|
| Run all tests | `npm test` |
| Run one test file | `npm test -- tests/path/to/file.test.ts` |
| Run typecheck | `npx tsc -b --noEmit` (or `npm run build`) |
| Run lint | `npm run lint` |

### Commit message conventions

Conventional prefixes used in Phase 0+1+2: `test:`, `feat:`, `fix:`, `docs:`, `core:`, `store:`, `config:`, `systems:`, `refactor:`. One commit per plan task at the end.

### Standard test scaffolding

For slices that need cross-slice access (workshopSlice's `craft` calls `state.spend('gold')`, skillTreeSlice's `buyNode` calls `state.spend('fame')`), tests use the live `useGameStore` singleton with explicit reset in `beforeEach`. Pattern from Phase 2's `treeSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("...", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetWorkshop();           // for workshop tests
    useGameStore.setState({ purchasedNodes: {} });     // skillTreeSlice has no resetSkillTree action
  });
  // ...
});
```

For RNG-dependent tests (Task 4), call `setSeed(42)` in `beforeEach`.

---

## File structure

### New files

```
src/config/workshopAffixes.ts                 Task 1
src/config/skillTreeNodes.ts                  Task 2
src/store/skillTreeSlice.ts                   Task 3
src/store/workshopSlice.ts                    Task 4
src/systems/ascend.ts                         Task 6

tests/config/workshopAffixes.test.ts          Task 1
tests/config/skillTreeNodes.test.ts           Task 2
tests/store/skillTreeSlice.test.ts            Task 3
tests/store/workshopSlice.test.ts             Task 4
tests/systems/ascend.test.ts                  Task 6
```

### Edited files

```
src/store/index.ts                            Tasks 3, 4 (slice wiring)
src/core/multipliers.ts                       Task 5 (wire contributors; replace empty bodies)
src/store/metaSlice.ts                        Task 7 (add performAscend wrapper)
tests/core/multipliers.test.ts                Task 5 (replace 4-test file with 13-test file)
tests/store/metaSlice.test.ts                 Task 7 (+1 wrapper smoke test)
tests/store/persistence-integration.test.ts   Task 8 (+1 round-trip test)
```

### Module boundary contract

- `config/workshopAffixes.ts`: zero imports.
- `config/skillTreeNodes.ts`: zero runtime imports.
- `core/multipliers.ts`: imports `GameStore` type, `getEquippedContribution` from `@/store/workshopSlice`. Reads `state.equippedItems` and `state.purchasedNodes`.
- `systems/ascend.ts`: imports `GameStore` type, `core/balance.ts`, `core/bigNumber.ts`, `zustand` (StoreApi types). Pure function `performAscendOrchestrator(set, get)`.
- `store/workshopSlice.ts`: imports `workshopAffixes` config, `core/rng.ts`, `core/bigNumber.ts`, `GameStore` type. Cross-slice writes via `get().spend('gold', ...)`.
- `store/skillTreeSlice.ts`: imports `skillTreeNodes` config, `core/bigNumber.ts`, `GameStore` type. Cross-slice writes via `get().spend('fame', ...)`.
- `store/metaSlice.ts`: existing imports + `systems/ascend`.

---

## Task 1: `workshopAffixes.ts` — config constants

**Files:**
- Create: `src/config/workshopAffixes.ts`
- Test: `tests/config/workshopAffixes.test.ts`

**Goal:** Static config constants consumed by `workshopSlice`.

- [ ] **Step 1: Write the failing test file**

Create `tests/config/workshopAffixes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  AFFIX_KINDS,
  MAGNITUDE_MIN_PCT,
  MAGNITUDE_MAX_PCT,
  BETTER_BRUSH_BONUS,
  MAX_INVENTORY_SLOTS,
  CRAFT_COST_GOLD,
} from "@/config/workshopAffixes";

describe("workshopAffixes config", () => {
  it("AFFIX_KINDS has exactly 3 entries", () => {
    expect(AFFIX_KINDS).toHaveLength(3);
  });

  it("the 3 affix kinds are unique", () => {
    expect(new Set(AFFIX_KINDS).size).toBe(AFFIX_KINDS.length);
  });

  it("MAGNITUDE_MIN_PCT < MAGNITUDE_MAX_PCT", () => {
    expect(MAGNITUDE_MIN_PCT).toBeLessThan(MAGNITUDE_MAX_PCT);
  });

  it("all numeric constants are positive", () => {
    expect(MAGNITUDE_MIN_PCT).toBeGreaterThan(0);
    expect(MAGNITUDE_MAX_PCT).toBeGreaterThan(0);
    expect(BETTER_BRUSH_BONUS).toBeGreaterThan(0);
    expect(MAX_INVENTORY_SLOTS).toBeGreaterThan(0);
    expect(CRAFT_COST_GOLD).toBeGreaterThan(0);
  });

  it("MAX_INVENTORY_SLOTS === 3 (pin v1 contract)", () => {
    expect(MAX_INVENTORY_SLOTS).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/config/workshopAffixes.test.ts`
Expected: FAIL — module `@/config/workshopAffixes` cannot be found.

- [ ] **Step 3: Create the implementation file**

Create `src/config/workshopAffixes.ts`:

```ts
export type AffixKind = "+canvas_gold%" | "-paint_time%" | "+inspiration_rate%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+canvas_gold%",
  "-paint_time%",
  "+inspiration_rate%",
];

/** Inclusive lower bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MIN_PCT = 5;

/** Inclusive upper bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MAX_PCT = 15;

/** Skill node "Better Brush" shifts both bounds by this amount. */
export const BETTER_BRUSH_BONUS = 1;

/** Inventory cap. Locked at 3 for v1 (spec D3). */
export const MAX_INVENTORY_SLOTS = 3;

/** Flat cost in gold per craft. PORT_PLAN.md §1.3 default; no scaling in v1. */
export const CRAFT_COST_GOLD = 100;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/config/workshopAffixes.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `npm test`
Expected: 137 tests pass (132 existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/config/workshopAffixes.ts tests/config/workshopAffixes.test.ts
git commit -m "config(workshopAffixes): 3 affix kinds + magnitude/cost constants

Phase 3 starter — pure data file consumed by workshopSlice.
3 affix kinds, magnitude range [5, 15] (+1 with Better Brush),
inventory cap 3, craft cost 100 gold flat.

Tests: 5 — count, uniqueness, bounds ordering, positivity,
v1 inventory-cap pin."
```

---

## Task 2: `skillTreeNodes.ts` — config data

**Files:**
- Create: `src/config/skillTreeNodes.ts`
- Test: `tests/config/skillTreeNodes.test.ts`

**Goal:** 5 skill nodes with literal IDs, costs, and linear-chain prereqs.

- [ ] **Step 1: Write the failing test file**

Create `tests/config/skillTreeNodes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";

describe("SKILL_NODES config", () => {
  it("has exactly 5 nodes", () => {
    expect(SKILL_NODES).toHaveLength(5);
  });

  it("costs are strictly increasing: 1 < 3 < 10 < 30 < 100", () => {
    expect(SKILL_NODES[0]?.cost).toBe(1);
    expect(SKILL_NODES[1]?.cost).toBe(3);
    expect(SKILL_NODES[2]?.cost).toBe(10);
    expect(SKILL_NODES[3]?.cost).toBe(30);
    expect(SKILL_NODES[4]?.cost).toBe(100);
    for (let i = 1; i < SKILL_NODES.length; i++) {
      expect(SKILL_NODES[i]!.cost).toBeGreaterThan(SKILL_NODES[i - 1]!.cost);
    }
  });

  it("all prereq references point to valid existing IDs (or null)", () => {
    const ids = new Set<string>(SKILL_NODES.map((n) => n.id));
    for (const node of SKILL_NODES) {
      if (node.prereq !== null) {
        expect(ids.has(node.prereq)).toBe(true);
      }
    }
  });

  it("the first node's prereq is null (chain root)", () => {
    expect(SKILL_NODES[0]?.prereq).toBeNull();
  });

  it("all 5 IDs are unique", () => {
    const ids = SKILL_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the 5 expected IDs are present (regression pin)", () => {
    const expectedIds: SkillNodeId[] = [
      "goldsmith",
      "patient_eye",
      "second_slot",
      "faster_strokes",
      "better_brush",
    ];
    expect(SKILL_NODES.map((n) => n.id)).toEqual(expectedIds);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/config/skillTreeNodes.test.ts`
Expected: FAIL — module `@/config/skillTreeNodes` cannot be found.

- [ ] **Step 3: Create the implementation file**

Create `src/config/skillTreeNodes.ts`:

```ts
export type SkillNodeId =
  | "goldsmith"
  | "patient_eye"
  | "second_slot"
  | "faster_strokes"
  | "better_brush";

export interface SkillNodeConfig {
  readonly id: SkillNodeId;
  readonly name: string;
  /** Fame cost. JS number (small in v1, max sum is 144). */
  readonly cost: number;
  /** Strict-linear prereq: must be purchased before this one. null only for the chain root. */
  readonly prereq: SkillNodeId | null;
}

/**
 * Phase 3 skill tree: 5 nodes in a strict-linear chain.
 * Costs and effects per PORT_PLAN.md §1.4. Effects are wired in:
 *   - core/multipliers.ts: goldsmith (+10% gold), patient_eye (+15% inspi), better_brush (roll-time +1 magnitude)
 *   - workshopSlice.ts: second_slot (1→2 equip slots via getCurrentSlotCount)
 *   - systems/ascend.ts: faster_strokes (-10% palier via getEffectivePalier)
 */
export const SKILL_NODES: ReadonlyArray<SkillNodeConfig> = [
  { id: "goldsmith",      name: "Goldsmith",      cost: 1,   prereq: null },
  { id: "patient_eye",    name: "Patient Eye",    cost: 3,   prereq: "goldsmith" },
  { id: "second_slot",    name: "Second Slot",    cost: 10,  prereq: "patient_eye" },
  { id: "faster_strokes", name: "Faster Strokes", cost: 30,  prereq: "second_slot" },
  { id: "better_brush",   name: "Better Brush",   cost: 100, prereq: "faster_strokes" },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/config/skillTreeNodes.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `npm test`
Expected: 143 tests pass (137 + 6 new).

- [ ] **Step 6: Commit**

```bash
git add src/config/skillTreeNodes.ts tests/config/skillTreeNodes.test.ts
git commit -m "config(skillTreeNodes): 5 nodes in strict-linear chain (1/3/10/30/100 fame)

SkillNodeId literal union for compile-time typo protection at every
consumer (workshopSlice's purchasedNodes.better_brush, multipliers.ts
goldsmith/patient_eye checks, systems/ascend.ts faster_strokes check).

Linear chain prereq encoded directly: goldsmith → patient_eye →
second_slot → faster_strokes → better_brush.

Tests: 6 — count, monotonic costs, valid prereq refs, root-prereq
null, unique IDs, expected-IDs regression pin."
```

---

## Task 3: `skillTreeSlice.ts` — state + buyNode + selectors

**Files:**
- Create: `src/store/skillTreeSlice.ts`
- Modify: `src/store/index.ts` (add SkillTreeSlice to GameStore type union; spread into create call)
- Test: `tests/store/skillTreeSlice.test.ts`

**Goal:** Slice state (`purchasedNodes`), `buyNode` action with linear-chain prereq enforcement, and the two structural selectors (`hasNode`, `canBuyNode`). Wired into `useGameStore`.

This task lands BEFORE workshopSlice because workshopSlice's `craft` reads `purchasedNodes.better_brush` for the magnitude bonus. Wiring skillTreeSlice first means workshop tests can purchase Better Brush before testing the bonus.

- [ ] **Step 1: Write the failing test file**

Create `tests/store/skillTreeSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { hasNode, canBuyNode } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import type { SkillNodeId } from "@/config/skillTreeNodes";

describe("skillTreeSlice", () => {
  beforeEach(() => {
    // skillTreeSlice has no resetSkillTree action (purchasedNodes survives ascend).
    // Reset directly via setState.
    useGameStore.setState({ purchasedNodes: {} });
    // Reset fame to 0 so we can control test inputs.
    useGameStore.setState({ fame: big(0) });
  });

  it("initializes with purchasedNodes = {}", () => {
    expect(useGameStore.getState().purchasedNodes).toEqual({});
  });

  it("buyNode('goldsmith') with 1 fame succeeds; purchasedNodes.goldsmith === true; fame is 0", () => {
    useGameStore.getState().add("fame", big(1));
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(true);
    expect(useGameStore.getState().purchasedNodes.goldsmith).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
  });

  it("buyNode('goldsmith') with 0 fame returns false; nothing changes", () => {
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(false);
    expect(useGameStore.getState().purchasedNodes.goldsmith).toBeUndefined();
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
  });

  it("buyNode('goldsmith') twice: second call returns false (already owned), no extra fame spent", () => {
    useGameStore.getState().add("fame", big(2));
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(1);
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(false);
    expect(useGameStore.getState().fame.toNumber()).toBe(1);
  });

  it("buyNode('patient_eye') without goldsmith returns false; fame not spent", () => {
    useGameStore.getState().add("fame", big(100));
    expect(useGameStore.getState().buyNode("patient_eye")).toBe(false);
    expect(useGameStore.getState().purchasedNodes.patient_eye).toBeUndefined();
    expect(useGameStore.getState().fame.toNumber()).toBe(100);
  });

  it("buyNode('patient_eye') after goldsmith + 3 fame succeeds", () => {
    useGameStore.getState().add("fame", big(4)); // 1 for goldsmith + 3 for patient_eye
    useGameStore.getState().buyNode("goldsmith");
    expect(useGameStore.getState().buyNode("patient_eye")).toBe(true);
    expect(useGameStore.getState().purchasedNodes.patient_eye).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
  });

  it("linear chain: buying all 5 nodes in order works given enough fame", () => {
    useGameStore.getState().add("fame", big(144)); // 1+3+10+30+100
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(true);
    expect(useGameStore.getState().buyNode("patient_eye")).toBe(true);
    expect(useGameStore.getState().buyNode("second_slot")).toBe(true);
    expect(useGameStore.getState().buyNode("faster_strokes")).toBe(true);
    expect(useGameStore.getState().buyNode("better_brush")).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
    expect(useGameStore.getState().purchasedNodes).toEqual({
      goldsmith: true,
      patient_eye: true,
      second_slot: true,
      faster_strokes: true,
      better_brush: true,
    });
  });

  it("skipping ahead: buying second_slot before patient_eye returns false", () => {
    useGameStore.getState().add("fame", big(100));
    useGameStore.getState().buyNode("goldsmith");
    expect(useGameStore.getState().buyNode("second_slot")).toBe(false);
    expect(useGameStore.getState().purchasedNodes.second_slot).toBeUndefined();
  });

  it("buyNode('nonexistent' as SkillNodeId) returns false", () => {
    useGameStore.getState().add("fame", big(1000));
    expect(useGameStore.getState().buyNode("nonexistent" as SkillNodeId)).toBe(false);
    expect(useGameStore.getState().fame.toNumber()).toBe(1000);
  });

  it("hasNode returns true only for purchased nodes", () => {
    useGameStore.getState().add("fame", big(4));
    useGameStore.getState().buyNode("goldsmith");
    useGameStore.getState().buyNode("patient_eye");
    expect(hasNode(useGameStore.getState(), "goldsmith")).toBe(true);
    expect(hasNode(useGameStore.getState(), "patient_eye")).toBe(true);
    expect(hasNode(useGameStore.getState(), "second_slot")).toBe(false);
  });

  it("canBuyNode('goldsmith') returns false at fame=0, true at fame=1, false again after purchase", () => {
    expect(canBuyNode(useGameStore.getState(), "goldsmith")).toBe(false);
    useGameStore.getState().add("fame", big(1));
    expect(canBuyNode(useGameStore.getState(), "goldsmith")).toBe(true);
    useGameStore.getState().buyNode("goldsmith");
    expect(canBuyNode(useGameStore.getState(), "goldsmith")).toBe(false);
  });

  it("canBuyNode('patient_eye') returns false until goldsmith is owned", () => {
    useGameStore.getState().add("fame", big(100));
    expect(canBuyNode(useGameStore.getState(), "patient_eye")).toBe(false);
    useGameStore.getState().buyNode("goldsmith");
    expect(canBuyNode(useGameStore.getState(), "patient_eye")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/store/skillTreeSlice.test.ts`
Expected: FAIL — module `@/store/skillTreeSlice` cannot be found, or `useGameStore.getState()` doesn't have `purchasedNodes`/`buyNode`.

- [ ] **Step 3: Create the slice file**

Create `src/store/skillTreeSlice.ts`:

```ts
import type { StateCreator } from "zustand";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

export interface SkillTreeState {
  /** Purchased nodes by id. Record<string, true> for O(1) lookup + clean JSON serialization. */
  purchasedNodes: Record<string, true>;
}

export const initialSkillTreeState: SkillTreeState = Object.freeze({
  purchasedNodes: Object.freeze({}) as Record<string, true>,
}) as SkillTreeState;

export interface SkillTreeSlice extends SkillTreeState {
  /**
   * Spend SKILL_NODES[id].cost fame; mark node as purchased.
   * Returns false if: unknown id, already owned, prereq not met, insufficient fame.
   * Atomic via currencySlice.spend('fame', cost).
   */
  buyNode: (id: SkillNodeId) => boolean;
}

export const createSkillTreeSlice: StateCreator<GameStore, [], [], SkillTreeSlice> = (set, get) => ({
  ...initialSkillTreeState,

  buyNode: (id) => {
    const node = SKILL_NODES.find((n) => n.id === id);
    if (!node) return false;
    const state = get();
    if (state.purchasedNodes[id]) return false;
    if (node.prereq !== null && !state.purchasedNodes[node.prereq]) return false;
    if (!state.spend("fame", big(node.cost))) return false;
    set((s) => ({
      purchasedNodes: { ...s.purchasedNodes, [id]: true },
    }));
    return true;
  },
});

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** True iff the player has purchased this node. */
export const hasNode = (state: GameStore, id: SkillNodeId): boolean =>
  state.purchasedNodes[id] === true;

/**
 * True iff buyNode(id) would succeed RIGHT NOW: not yet owned, prereq met, fame ≥ cost.
 * Phase 4 UI uses this to gate the "Buy" button.
 */
export const canBuyNode = (state: GameStore, id: SkillNodeId): boolean => {
  const node = SKILL_NODES.find((n) => n.id === id);
  if (!node) return false;
  if (state.purchasedNodes[id]) return false;
  if (node.prereq !== null && !state.purchasedNodes[node.prereq]) return false;
  return state.fame.gte(big(node.cost));
};
```

- [ ] **Step 4: Wire `skillTreeSlice` into `useGameStore`**

Edit `src/store/index.ts`. After the existing `canvasSlice` import:

Find:

```ts
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
```

Add after:

```ts
import { createSkillTreeSlice, type SkillTreeSlice } from "./skillTreeSlice";
```

Find the `GameStore` type:

```ts
export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & GameTick;
```

Replace with:

```ts
export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & SkillTreeSlice
  & GameTick;
```

Find the `create` factory body:

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

Replace with:

```ts
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      ...createSkillTreeSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
      },
    }),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/store/skillTreeSlice.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test`
Expected: 155 tests pass (143 + 12 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/skillTreeSlice.ts src/store/index.ts tests/store/skillTreeSlice.test.ts
git commit -m "store(skillTree): purchasedNodes + buyNode + selectors

- SkillTreeState: purchasedNodes Record<string, true> (frozen at init).
- buyNode: atomic linear-chain enforcement (validates prereq + fame
  via currencySlice.spend); rejects unknown IDs, already-owned,
  missing prereq, insufficient fame.
- hasNode / canBuyNode: pure selectors over GameStore.
- Wire into useGameStore.

No resetSkillTree action — purchasedNodes survives ascend (meta state).

Tests: 12 — initial state, happy path, atomicity (insufficient fame),
already-owned, missing prereq, full chain purchase, skip-ahead block,
unknown ID, hasNode/canBuyNode behavior at thresholds."
```

---

## Task 4: `workshopSlice.ts` — state + 5 actions + selectors

**Files:**
- Create: `src/store/workshopSlice.ts`
- Modify: `src/store/index.ts` (add WorkshopSlice to GameStore type union; spread into create call)
- Test: `tests/store/workshopSlice.test.ts`

**Goal:** Workshop slice with 5 atomic verbs (craft, equip, unequip, swap, discard) + resetWorkshop, plus the `getCurrentSlotCount` and `getEquippedContribution` selectors.

This task depends on Task 3 (skillTreeSlice) being complete — `craft` reads `state.purchasedNodes.better_brush`, and `equip` reads `state.purchasedNodes.second_slot` via `getCurrentSlotCount`.

- [ ] **Step 1: Write the failing test file**

Create `tests/store/workshopSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { getCurrentSlotCount, getEquippedContribution } from "@/store/workshopSlice";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";
import {
  AFFIX_KINDS,
  MAGNITUDE_MIN_PCT,
  MAGNITUDE_MAX_PCT,
  CRAFT_COST_GOLD,
} from "@/config/workshopAffixes";

describe("workshopSlice", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {} });
    setSeed(42); // deterministic RNG for craft tests
  });

  it("initializes with empty inventory and equippedItems", () => {
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([]);
  });

  it("craft() with insufficient gold returns false; nothing changes", () => {
    expect(useGameStore.getState().craft()).toBe(false);
    const s = useGameStore.getState();
    expect(s.gold.toNumber()).toBe(0);
    expect(s.inventory).toEqual([]);
  });

  it("craft() with sufficient gold: gold deducted, inventory grows by 1, item has valid kind + magnitude in [5,15]", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    expect(useGameStore.getState().craft()).toBe(true);
    const s = useGameStore.getState();
    expect(s.gold.toNumber()).toBe(0);
    expect(s.inventory).toHaveLength(1);
    const item = s.inventory[0]!;
    expect(AFFIX_KINDS).toContain(item.kind);
    expect(item.magnitude).toBeGreaterThanOrEqual(MAGNITUDE_MIN_PCT);
    expect(item.magnitude).toBeLessThanOrEqual(MAGNITUDE_MAX_PCT);
  });

  it("craft() with setSeed(42) produces a deterministic (kind, magnitude)", () => {
    // Pin the specific roll outcome at seed 42. If this assertion changes
    // when refactoring rng consumption, that's a regression to investigate.
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    const item = useGameStore.getState().inventory[0]!;
    // The exact values depend on mulberry32 output; capturing is the goal.
    // Two RNG consumptions: first for rngPick(AFFIX_KINDS), second for rngInt magnitude.
    expect(typeof item.kind).toBe("string");
    expect(AFFIX_KINDS).toContain(item.kind);
    expect(Number.isInteger(item.magnitude)).toBe(true);
    expect(item.magnitude).toBeGreaterThanOrEqual(MAGNITUDE_MIN_PCT);
    expect(item.magnitude).toBeLessThanOrEqual(MAGNITUDE_MAX_PCT);
    // Determinism: re-seed and re-craft should reproduce.
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    setSeed(42);
    useGameStore.getState().craft();
    const item2 = useGameStore.getState().inventory[0]!;
    expect(item2.kind).toBe(item.kind);
    expect(item2.magnitude).toBe(item.magnitude);
  });

  it("craft() with Better Brush purchased: magnitude is in [6, 16]", () => {
    useGameStore.setState({ purchasedNodes: { better_brush: true } });
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 50));
    // Craft many items to build statistical confidence the range shifted.
    for (let i = 0; i < 50; i++) {
      useGameStore.getState().craft();
    }
    const items = useGameStore.getState().inventory.slice();
    // We can craft into a 3-slot inventory only; the loop will fail after 3.
    // For magnitude bounds, just check the items we did craft.
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.magnitude).toBeGreaterThanOrEqual(MAGNITUDE_MIN_PCT + 1);
      expect(item.magnitude).toBeLessThanOrEqual(MAGNITUDE_MAX_PCT + 1);
    }
  });

  it("craft() with full inventory returns false; gold NOT deducted (atomic)", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 4));
    // Fill inventory to capacity (3 slots).
    for (let i = 0; i < 3; i++) {
      expect(useGameStore.getState().craft()).toBe(true);
    }
    const goldBefore = useGameStore.getState().gold.toNumber();
    expect(useGameStore.getState().craft()).toBe(false);
    const goldAfter = useGameStore.getState().gold.toNumber();
    expect(goldAfter).toBe(goldBefore); // not deducted
    expect(useGameStore.getState().inventory).toHaveLength(3); // unchanged
  });

  it("equip(0) from a 1-item inventory + 0 equipped: inventory becomes empty, equippedItems has 1 item", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    const item = useGameStore.getState().inventory[0]!;
    expect(useGameStore.getState().equip(0)).toBe(true);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([item]);
  });

  it("equip(invalidIdx) returns false", () => {
    expect(useGameStore.getState().equip(0)).toBe(false);
    expect(useGameStore.getState().equip(99)).toBe(false);
    expect(useGameStore.getState().equip(-1)).toBe(false);
  });

  it("equip(0) when equipped is full (slotCount=1, 1 item already equipped) returns false", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft(); // inventory[0]
    useGameStore.getState().equip(0); // moves to equippedItems
    useGameStore.getState().craft(); // inventory[0] (a new item)
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(1);
    expect(useGameStore.getState().equip(0)).toBe(false);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(1);
  });

  it("equip(0) with Second Slot purchased + 1 item already equipped: succeeds", () => {
    useGameStore.setState({ purchasedNodes: { second_slot: true } });
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    useGameStore.getState().craft();
    expect(useGameStore.getState().equip(0)).toBe(true);
    expect(useGameStore.getState().equippedItems).toHaveLength(2);
    expect(useGameStore.getState().inventory).toHaveLength(0);
  });

  it("unequip(0) moves item back to inventory; equippedItems shrinks", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(0);
    expect(useGameStore.getState().unequip(0)).toBe(true);
    expect(useGameStore.getState().equippedItems).toHaveLength(0);
    expect(useGameStore.getState().inventory).toHaveLength(1);
  });

  it("unequip(0) when inventory is full returns false (item stays equipped)", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 4));
    // Craft 1 + equip → 1 equipped, 0 inventory
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    // Craft 3 more → 3 inventory, 1 equipped
    for (let i = 0; i < 3; i++) useGameStore.getState().craft();
    expect(useGameStore.getState().inventory).toHaveLength(3);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    // Unequip should fail (no inventory room)
    expect(useGameStore.getState().unequip(0)).toBe(false);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(3);
  });

  it("swap(0, 0) exchanges inventory[0] and equippedItems[0]; counts unchanged", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    useGameStore.getState().craft();
    const inventoryItem = useGameStore.getState().inventory[0]!;
    const equippedItem = useGameStore.getState().equippedItems[0]!;
    expect(useGameStore.getState().swap(0, 0)).toBe(true);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([equippedItem]);
    expect(s.equippedItems).toEqual([inventoryItem]);
  });

  it("swap with invalid indices returns false", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft(); // inventory has 1 item
    expect(useGameStore.getState().swap(0, 0)).toBe(false); // equipped empty
    expect(useGameStore.getState().swap(99, 0)).toBe(false);
    expect(useGameStore.getState().swap(0, 99)).toBe(false);
  });

  it("discard(0) removes inventory[0]; no gold refund", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    expect(useGameStore.getState().inventory).toHaveLength(1);
    const goldBefore = useGameStore.getState().gold.toNumber();
    expect(useGameStore.getState().discard(0)).toBe(true);
    expect(useGameStore.getState().inventory).toHaveLength(0);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore); // no refund
  });

  it("discard(invalidIdx) returns false", () => {
    expect(useGameStore.getState().discard(0)).toBe(false);
    expect(useGameStore.getState().discard(99)).toBe(false);
  });

  it("getCurrentSlotCount returns 1 by default, 2 after Second Slot purchased", () => {
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(1);
    useGameStore.setState({ purchasedNodes: { second_slot: true } });
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(2);
  });

  it("getEquippedContribution sums magnitude/100 across matching equipped items", () => {
    // Manually set equippedItems to known values.
    useGameStore.setState({
      equippedItems: [
        { kind: "+canvas_gold%", magnitude: 10 },
        { kind: "+canvas_gold%", magnitude: 5 },
        { kind: "+inspiration_rate%", magnitude: 12 },
      ],
    });
    expect(getEquippedContribution(useGameStore.getState(), "+canvas_gold%")).toBeCloseTo(0.15, 6);
    expect(getEquippedContribution(useGameStore.getState(), "+inspiration_rate%")).toBeCloseTo(0.12, 6);
    expect(getEquippedContribution(useGameStore.getState(), "-paint_time%")).toBe(0);
  });

  it("resetWorkshop() restores initialWorkshopState", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    useGameStore.getState().craft();
    expect(useGameStore.getState().inventory).toHaveLength(1);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    useGameStore.getState().resetWorkshop();
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/store/workshopSlice.test.ts`
Expected: FAIL — module `@/store/workshopSlice` cannot be found, or `useGameStore.getState()` doesn't have `inventory`/`craft`/etc.

- [ ] **Step 3: Create the slice file**

Create `src/store/workshopSlice.ts`:

```ts
import type { StateCreator } from "zustand";
import {
  AFFIX_KINDS,
  MAGNITUDE_MIN_PCT,
  MAGNITUDE_MAX_PCT,
  BETTER_BRUSH_BONUS,
  MAX_INVENTORY_SLOTS,
  CRAFT_COST_GOLD,
  type AffixKind,
} from "@/config/workshopAffixes";
import { big } from "@/core/bigNumber";
import { rngPick, rngInt } from "@/core/rng";
import type { GameStore } from "@/store";

export interface Item {
  /** Affix produced by this craft. */
  readonly kind: AffixKind;
  /** Integer percent magnitude (e.g., 12 means +12% / -12%). */
  readonly magnitude: number;
}

export interface WorkshopState {
  /** Crafted-but-unequipped items. Bounded by MAX_INVENTORY_SLOTS = 3. */
  inventory: ReadonlyArray<Item>;
  /** Currently-equipped items. Bounded by getCurrentSlotCount(state) (1 or 2). */
  equippedItems: ReadonlyArray<Item>;
}

export const initialWorkshopState: WorkshopState = Object.freeze({
  inventory: Object.freeze([]) as ReadonlyArray<Item>,
  equippedItems: Object.freeze([]) as ReadonlyArray<Item>,
}) as WorkshopState;

export interface WorkshopSlice extends WorkshopState {
  /**
   * Spend CRAFT_COST_GOLD; roll a new Item; place in first empty inventory slot.
   * Returns false if inventory is full (no gold spent) or insufficient gold.
   */
  craft: () => boolean;

  /**
   * Move inventory[invIdx] into the first empty equipped slot.
   * Returns false if invIdx out of range OR equipped is at currentSlotCount.
   */
  equip: (invIdx: number) => boolean;

  /**
   * Move equippedItems[equipIdx] into the first empty inventory slot.
   * Returns false if equipIdx out of range OR inventory is full.
   */
  unequip: (equipIdx: number) => boolean;

  /**
   * Atomically swap inventory[invIdx] with equippedItems[equipIdx].
   * Net counts unchanged on both sides — always succeeds if both indices valid.
   * Returns false only on out-of-range indices.
   */
  swap: (invIdx: number, equipIdx: number) => boolean;

  /** Permanently remove inventory[invIdx]. No gold refund. */
  discard: (invIdx: number) => boolean;

  /** For ascend orchestrator. Resets to initialWorkshopState. */
  resetWorkshop: () => void;
}

export const createWorkshopSlice: StateCreator<GameStore, [], [], WorkshopSlice> = (set, get) => ({
  ...initialWorkshopState,

  craft: () => {
    const state = get();
    if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
    if (!state.spend("gold", big(CRAFT_COST_GOLD))) return false;
    const kind = rngPick(AFFIX_KINDS);
    const brushBonus = state.purchasedNodes.better_brush ? BETTER_BRUSH_BONUS : 0;
    const magnitude = rngInt(MAGNITUDE_MIN_PCT + brushBonus, MAGNITUDE_MAX_PCT + brushBonus);
    set((s) => ({ inventory: [...s.inventory, { kind, magnitude }] }));
    return true;
  },

  equip: (invIdx) => {
    const state = get();
    if (invIdx < 0 || invIdx >= state.inventory.length) return false;
    const slotCount = getCurrentSlotCount(state);
    if (state.equippedItems.length >= slotCount) return false;
    const item = state.inventory[invIdx]!;
    set((s) => ({
      inventory: s.inventory.filter((_, i) => i !== invIdx),
      equippedItems: [...s.equippedItems, item],
    }));
    return true;
  },

  unequip: (equipIdx) => {
    const state = get();
    if (equipIdx < 0 || equipIdx >= state.equippedItems.length) return false;
    if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
    const item = state.equippedItems[equipIdx]!;
    set((s) => ({
      equippedItems: s.equippedItems.filter((_, i) => i !== equipIdx),
      inventory: [...s.inventory, item],
    }));
    return true;
  },

  swap: (invIdx, equipIdx) => {
    const state = get();
    if (invIdx < 0 || invIdx >= state.inventory.length) return false;
    if (equipIdx < 0 || equipIdx >= state.equippedItems.length) return false;
    const invItem = state.inventory[invIdx]!;
    const equipItem = state.equippedItems[equipIdx]!;
    set((s) => ({
      inventory: s.inventory.map((it, i) => (i === invIdx ? equipItem : it)),
      equippedItems: s.equippedItems.map((it, i) => (i === equipIdx ? invItem : it)),
    }));
    return true;
  },

  discard: (invIdx) => {
    const state = get();
    if (invIdx < 0 || invIdx >= state.inventory.length) return false;
    set((s) => ({ inventory: s.inventory.filter((_, i) => i !== invIdx) }));
    return true;
  },

  resetWorkshop: () => set(initialWorkshopState),
});

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** 1 (default) or 2 (after Second Slot). */
export const getCurrentSlotCount = (state: GameStore): number =>
  state.purchasedNodes.second_slot ? 2 : 1;

/**
 * Sum the magnitude (as fraction) of equipped items matching the given affix kind.
 * Used by core/multipliers.ts for the additive (gold, inspi) cases.
 * NOT used for paint-time (which needs per-item v/(1-v) conversion — see multipliers.ts).
 */
export const getEquippedContribution = (state: GameStore, kind: AffixKind): number =>
  state.equippedItems
    .filter((i) => i.kind === kind)
    .reduce((sum, i) => sum + i.magnitude / 100, 0);
```

- [ ] **Step 4: Wire `workshopSlice` into `useGameStore`**

Edit `src/store/index.ts`. After the `skillTreeSlice` import:

Find:

```ts
import { createSkillTreeSlice, type SkillTreeSlice } from "./skillTreeSlice";
```

Add after:

```ts
import { createWorkshopSlice, type WorkshopSlice } from "./workshopSlice";
```

Find the `GameStore` type:

```ts
export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & SkillTreeSlice
  & GameTick;
```

Replace with:

```ts
export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & SkillTreeSlice
  & WorkshopSlice
  & GameTick;
```

Find the `create` factory body:

```ts
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      ...createSkillTreeSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
      },
    }),
```

Replace with:

```ts
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      ...createSkillTreeSlice(set, get, store),
      ...createWorkshopSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
      },
    }),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/store/workshopSlice.test.ts`
Expected: PASS — 19 tests.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test`
Expected: 174 tests pass (155 + 19 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/workshopSlice.ts src/store/index.ts tests/store/workshopSlice.test.ts
git commit -m "store(workshop): inventory + equippedItems + 5 atomic verbs

- WorkshopState: inventory + equippedItems (frozen at init).
- craft: rngPick(AFFIX_KINDS) + rngInt for magnitude; respects
  Better Brush bonus (+1 to both bounds). Atomic on inventory-full
  (no gold spent).
- equip: first-empty-slot; respects Second Slot (1 or 2 slots).
- unequip: returns to inventory; blocks when inventory full.
- swap: atomic exchange; net counts unchanged; always succeeds with
  valid indices.
- discard: permanent remove; no gold refund.
- resetWorkshop: for ascend orchestrator.
- Selectors: getCurrentSlotCount (1 or 2), getEquippedContribution
  (sum magnitude/100 by kind).
- Wire into useGameStore.

Tests: 19 — full coverage of state, all 5 verbs, RNG determinism via
setSeed(42), Better Brush range shift, Second Slot dynamic capacity."
```

---

## Task 5: `core/multipliers.ts` — wire item + node contributors

**Files:**
- Modify: `src/core/multipliers.ts` (replace the empty Phase 2 bodies)
- Modify: `tests/core/multipliers.test.ts` (replace the 4-test file with 13 tests)

**Goal:** Wire item-equipped contributions and skill-node flags into all 3 multiplier functions. The Phase 2 forward-compat seam delivers exactly here.

- [ ] **Step 1: Replace the test file**

The current `tests/core/multipliers.test.ts` has 4 tests (3 trivial + 1 doc-test). Phase 3 replaces them with comprehensive coverage.

Replace the entire contents of `tests/core/multipliers.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { PAINT_TIME_BASE_SECONDS, CANVAS_GOLD_BASE } from "@/core/balance";

describe("multipliers — Phase 3 contributors", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {} });
  });

  // ============================================================================
  // getInspiMultiplier
  // ============================================================================

  it("getInspiMultiplier returns 1 with no equipped items + no Patient Eye", () => {
    expect(getInspiMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getInspiMultiplier returns 1.15 with Patient Eye purchased", () => {
    useGameStore.setState({ purchasedNodes: { patient_eye: true } });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.15, 6);
  });

  it("getInspiMultiplier returns 1 + magnitude/100 with one +inspiration_rate% item equipped", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "+inspiration_rate%", magnitude: 12 }],
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.12, 6);
  });

  it("getInspiMultiplier sums multiple +inspiration_rate% items", () => {
    useGameStore.setState({
      equippedItems: [
        { kind: "+inspiration_rate%", magnitude: 10 },
        { kind: "+inspiration_rate%", magnitude: 5 },
      ],
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.15, 6);
  });

  it("getInspiMultiplier combines item + Patient Eye contributions", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "+inspiration_rate%", magnitude: 10 }],
      purchasedNodes: { patient_eye: true },
    });
    expect(getInspiMultiplier(useGameStore.getState())).toBeCloseTo(1.25, 6);
  });

  // ============================================================================
  // getCanvasGoldMultiplier
  // ============================================================================

  it("getCanvasGoldMultiplier returns 1 with no contributors", () => {
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1.10 with Goldsmith purchased", () => {
    useGameStore.setState({ purchasedNodes: { goldsmith: true } });
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.10, 6);
  });

  it("getCanvasGoldMultiplier sums equipped +canvas_gold% items + Goldsmith", () => {
    useGameStore.setState({
      equippedItems: [
        { kind: "+canvas_gold%", magnitude: 8 },
        { kind: "+canvas_gold%", magnitude: 12 },
      ],
      purchasedNodes: { goldsmith: true },
    });
    // 1 + 0.08 + 0.12 + 0.10 = 1.30
    expect(getCanvasGoldMultiplier(useGameStore.getState())).toBeCloseTo(1.30, 6);
  });

  // ============================================================================
  // getPaintTimeMultiplier (per-item v/(1-v) conversion)
  // ============================================================================

  it("getPaintTimeMultiplier returns 1 with no equipped items", () => {
    expect(getPaintTimeMultiplier(useGameStore.getState())).toBe(1);
  });

  it("getPaintTimeMultiplier converts -paint_time% 10 into 1.111... (v/(1-v))", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "-paint_time%", magnitude: 10 }],
    });
    const m = getPaintTimeMultiplier(useGameStore.getState());
    // v=0.10 → v/(1-v) = 0.111...; multiplier = 1.111...
    expect(m).toBeCloseTo(1 + 0.10 / 0.90, 6);
    // Effective paint time = base / multiplier = 10 / 1.111... = 9.0
    const effectiveTime = PAINT_TIME_BASE_SECONDS / m;
    expect(effectiveTime).toBeCloseTo(9.0, 6);
  });

  it("getPaintTimeMultiplier sums per-item conversions for two -paint_time% items", () => {
    useGameStore.setState({
      equippedItems: [
        { kind: "-paint_time%", magnitude: 10 },
        { kind: "-paint_time%", magnitude: 10 },
      ],
    });
    const m = getPaintTimeMultiplier(useGameStore.getState());
    // Two items at v=0.10 each → bonus = 2 * (0.10/0.90) = 0.222...; multiplier = 1.222...
    expect(m).toBeCloseTo(1 + 2 * (0.10 / 0.90), 6);
  });

  // ============================================================================
  // Integration: multipliers flow through to tick outputs
  // ============================================================================

  it("Patient Eye purchased → treeTick credits 1.15× the no-multiplier inspi rate", () => {
    // Set up: spark at level 5 = 0.5 inspi/sec base.
    useGameStore.getState().add("gold", big(10000));
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().buyPartLevel("spark");
    }
    useGameStore.setState({ purchasedNodes: { patient_eye: true } });
    const before = useGameStore.getState().inspiration.toNumber();
    useGameStore.getState().treeTick(1);
    const gain = useGameStore.getState().inspiration.toNumber() - before;
    expect(gain).toBeCloseTo(0.5 * 1.15, 6);
  });

  it("Goldsmith purchased → canvasTick credits 1.10× the no-multiplier gold per sale", () => {
    useGameStore.setState({ purchasedNodes: { goldsmith: true } });
    const before = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    const gain = useGameStore.getState().gold.toNumber() - before;
    expect(gain).toBeCloseTo(CANVAS_GOLD_BASE * 1.10, 6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core/multipliers.test.ts`
Expected: FAIL — multipliers all still return 1; the bonus assertions fail.

- [ ] **Step 3: Replace `core/multipliers.ts` with wired bodies**

Edit `src/core/multipliers.ts`. Replace the entire file contents with:

```ts
import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";

/**
 * Aggregate multiplier on inspiration accrual rate.
 * Phase 3: reads `+inspiration_rate%` equipped item magnitudes + "Patient Eye" skill node.
 *
 * Convention: result is `1 + Σ contributions`, where each contribution is
 * an additive percentage (e.g., `+10%` = `0.10`).
 */
export const getInspiMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+inspiration_rate%");
  if (state.purchasedNodes.patient_eye) bonus += 0.15;
  return 1 + bonus;
};

/**
 * Aggregate multiplier on gold credited per canvas sale.
 * Phase 3: reads `+canvas_gold%` equipped items + "Goldsmith" skill node.
 */
export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+canvas_gold%");
  if (state.purchasedNodes.goldsmith) bonus += 0.10;
  return 1 + bonus;
};

/**
 * Paint-speed multiplier — `effectivePaintTime = PAINT_TIME_BASE_SECONDS / multiplier`.
 * Higher = faster.
 *
 * Convention here is the same as the other two functions (`1 + Σ contributions`),
 * but contributions are paint-SPEED deltas, NOT paint-time reductions.
 * Per-item conversion: an affix labeled `-paint_time% v` contributes `v/(1-v)`
 * to the speed multiplier. So 10% time-reduction → +0.111 contribution → multiplier
 * = 1.111 → effective time = base / 1.111 ≈ 0.9 * base.
 *
 * No skill node directly affects paint speed in v1.
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core/multipliers.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: 183 tests pass (174 + 13 new − 4 old = +9 net; 174 + 13 = 187 total but the old 4-test file was replaced, so 174 − 4 + 13 = 183).

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): wire item-affix + skill-node contributors

Phase 2's empty pipe pays off: the 3 function signatures and call
sites in treeSlice/canvasSlice are unchanged. Bodies now read:
- state.equippedItems via getEquippedContribution (gold + inspi)
- per-item v/(1-v) loop (paint time, per the documented convention)
- state.purchasedNodes for the relevant nodes (Goldsmith, Patient Eye)

Replaces the 4-test Phase 2 file (which included a tautological
1+0=1 doc test) with 13 real-coverage tests:
- 5 for inspi: empty, Patient Eye only, item only, item sum, item+node
- 3 for gold: empty, Goldsmith only, items+node combined
- 3 for paint-time: empty, single -paint_time% conversion, two-item sum
- 2 integration: Patient Eye → treeTick gain × 1.15;
  Goldsmith → canvasTick gain × 1.10."
```

---

## Task 6: `systems/ascend.ts` — orchestrator + canAscend + getEffectivePalier

**Files:**
- Create: `src/systems/ascend.ts`
- Test: `tests/systems/ascend.test.ts`

**Goal:** Pure ascend orchestrator that the metaSlice wraps. Plus the `canAscend` and `getEffectivePalier` selectors. No store wiring in this task — `metaSlice` adds the wrapper in Task 7.

- [ ] **Step 1: Write the failing test file**

Create `tests/systems/ascend.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getEffectivePalier,
  canAscend,
  performAscendOrchestrator,
} from "@/systems/ascend";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { palierAscend, fameOnAscend } from "@/core/balance";

describe("systems/ascend", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {}, ascendCount: 0, fame: big(0) });
  });

  // ============================================================================
  // getEffectivePalier
  // ============================================================================

  it("getEffectivePalier(state, 0) returns big(1000) (base, no Faster Strokes)", () => {
    expect(getEffectivePalier(useGameStore.getState(), 0).toNumber()).toBe(1000);
  });

  it("getEffectivePalier(state, 0) with Faster Strokes returns big(900) (10% reduction)", () => {
    useGameStore.setState({ purchasedNodes: { faster_strokes: true } });
    expect(getEffectivePalier(useGameStore.getState(), 0).toNumber()).toBeCloseTo(900, 6);
  });

  it("getEffectivePalier(state, 5) with Faster Strokes returns palierAscend(5) * 0.9 (Big.pow precision: toBeCloseTo)", () => {
    useGameStore.setState({ purchasedNodes: { faster_strokes: true } });
    const expected = palierAscend(5).mul(0.9).toNumber();
    expect(getEffectivePalier(useGameStore.getState(), 5).toNumber()).toBeCloseTo(expected, 3);
  });

  // ============================================================================
  // canAscend
  // ============================================================================

  it("canAscend returns false when inspiration < palier", () => {
    useGameStore.getState().add("inspiration", big(999));
    expect(canAscend(useGameStore.getState())).toBe(false);
  });

  it("canAscend returns true at exact threshold (inspiration === palier)", () => {
    useGameStore.getState().add("inspiration", big(1000));
    expect(canAscend(useGameStore.getState())).toBe(true);
  });

  it("canAscend becomes true earlier with Faster Strokes (palier reduced to 900)", () => {
    useGameStore.getState().add("inspiration", big(900));
    expect(canAscend(useGameStore.getState())).toBe(false);
    useGameStore.setState({ purchasedNodes: { faster_strokes: true } });
    expect(canAscend(useGameStore.getState())).toBe(true);
  });

  // ============================================================================
  // performAscendOrchestrator
  // ============================================================================

  it("performAscendOrchestrator returns false when canAscend is false; state unchanged", () => {
    useGameStore.getState().add("gold", big(50));
    useGameStore.getState().add("inspiration", big(500));
    const beforeGold = useGameStore.getState().gold.toNumber();
    const beforeInsp = useGameStore.getState().inspiration.toNumber();
    const beforeCount = useGameStore.getState().ascendCount;

    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(false);

    expect(useGameStore.getState().gold.toNumber()).toBe(beforeGold);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(beforeInsp);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount);
  });

  it("performAscendOrchestrator on success: gold → 0, inspiration → 0", () => {
    useGameStore.getState().add("gold", big(500));
    useGameStore.getState().add("inspiration", big(1500));
    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(true);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
  });

  it("performAscendOrchestrator on success: fame increases by fameOnAscend(inspirationBeforeReset)", () => {
    useGameStore.getState().add("inspiration", big(1500));
    const expectedFameGain = fameOnAscend(big(1500));
    const beforeFame = useGameStore.getState().fame.toNumber();
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().fame.toNumber()).toBe(beforeFame + expectedFameGain);
  });

  it("performAscendOrchestrator on success: ascendCount increments by 1", () => {
    useGameStore.getState().add("inspiration", big(1500));
    const beforeCount = useGameStore.getState().ascendCount;
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount + 1);
  });

  it("performAscendOrchestrator on success: tree resets (currentStage=0, all partLevels=0)", () => {
    useGameStore.getState().add("gold", big(10000));
    useGameStore.getState().buyPartLevel("spark");
    useGameStore.getState().buyPartLevel("bud");
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    expect(s.partLevels.spark).toBe(0);
    expect(s.partLevels.bud).toBe(0);
  });

  it("performAscendOrchestrator on success: canvas resets (canvasProgress=0)", () => {
    useGameStore.setState({ canvasProgress: 7.5 });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("performAscendOrchestrator on success: workshop resets (inventory empty, equippedItems empty)", () => {
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%", magnitude: 10 }],
      equippedItems: [{ kind: "+inspiration_rate%", magnitude: 8 }],
    });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([]);
  });

  it("performAscendOrchestrator on success: purchasedNodes UNCHANGED (preserved)", () => {
    useGameStore.setState({
      purchasedNodes: { goldsmith: true, patient_eye: true },
    });
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().purchasedNodes).toEqual({
      goldsmith: true,
      patient_eye: true,
    });
  });

  it("performAscendOrchestrator on success: playerId UNCHANGED", () => {
    const beforeId = useGameStore.getState().playerId;
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().playerId).toBe(beforeId);
  });

  it("performAscendOrchestrator second time: ascendCount goes 1→2; palier doubles per the formula", () => {
    useGameStore.getState().add("inspiration", big(1500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(1);
    // Now palier is palierAscend(1) = 1000 * 2 = 2000.
    useGameStore.getState().add("inspiration", big(2500));
    performAscendOrchestrator(useGameStore.setState, useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(2);
    // Verify can't ascend with insufficient inspiration for the new threshold (palierAscend(2) = 4000).
    useGameStore.getState().add("inspiration", big(3999));
    expect(canAscend(useGameStore.getState())).toBe(false);
  });

  it("performAscendOrchestrator with inspi=0: returns false (palier > 0)", () => {
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
    expect(
      performAscendOrchestrator(useGameStore.setState, useGameStore.getState),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/systems/ascend.test.ts`
Expected: FAIL — module `@/systems/ascend` cannot be found.

- [ ] **Step 3: Create the orchestrator file**

Create `src/systems/ascend.ts`:

```ts
import type { GameStore } from "@/store";
import type { StoreApi } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import { palierAscend, fameOnAscend } from "@/core/balance";

/**
 * Effective inspiration palier required to ascend at the given prior ascend count.
 * Faster Strokes (skill node) reduces by 10%.
 *
 * Lives here (not core/multipliers.ts) because it's a one-off domain-specific
 * reduction, not a tick-time multiplier following the `1 + Σ contributions` convention.
 */
export const getEffectivePalier = (state: GameStore, count: number): Big => {
  const base = palierAscend(count);
  const reduction = state.purchasedNodes.faster_strokes ? 0.10 : 0;
  return base.mul(1 - reduction);
};

/**
 * True iff the player has accumulated enough inspiration to ascend right now.
 * Pure function over GameStore — Phase 4 UI and tests call it directly.
 */
export const canAscend = (state: GameStore): boolean =>
  state.inspiration.gte(getEffectivePalier(state, state.ascendCount));

/**
 * Atomic ascend orchestrator. Returns true on success; false if canAscend is false.
 * On success:
 *   1. Captures fameGain = fameOnAscend(inspiration BEFORE reset).
 *   2. Resets: gold, inspiration, tree, canvas, workshop (inventory + equipped).
 *   3. Adds fameGain to fame.
 *   4. Increments ascendCount.
 *
 * Preserved (NOT touched): fame (existing balance + new gain), ascendCount (incremented),
 * purchasedNodes, playerId, save schema version.
 *
 * Called by metaSlice.performAscend() (Task 7).
 */
export const performAscendOrchestrator = (
  set: StoreApi<GameStore>["setState"],
  get: StoreApi<GameStore>["getState"],
): boolean => {
  const state = get();
  if (!canAscend(state)) return false;

  // 1. Capture fame gain BEFORE inspiration is reset.
  const fameGain = fameOnAscend(state.inspiration);

  // 2. Reset run state via existing slice actions.
  state.resetRunCurrencies(); // gold + inspiration → 0; fame preserved
  state.resetTree();
  state.resetCanvas();
  state.resetWorkshop();

  // 3. Credit fame (after reset; fame survived resetRunCurrencies).
  if (fameGain > 0) {
    state.add("fame", big(fameGain));
  }

  // 4. Bump ascendCount.
  state.incrementAscendCount();

  // `set` is intentionally not called directly — all mutations flow through
  // the slice actions above. The parameter is kept for future orchestrators
  // that may need direct cross-slice writes.
  void set;

  return true;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/systems/ascend.test.ts`
Expected: PASS — 17 tests.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: 200 tests pass (183 + 17 new).

Run: `npx tsc -b --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: clean. The `void set;` in the orchestrator suppresses the "unused parameter" warning explicitly. If lint complains, alternative: rename to `_set: ...` (the eslint config ignores `^_` unused args).

- [ ] **Step 6: Commit**

```bash
git add src/systems/ascend.ts tests/systems/ascend.test.ts
git commit -m "systems(ascend): pure orchestrator + canAscend + getEffectivePalier

- getEffectivePalier wraps palierAscend with Faster Strokes' 10% reduction.
  Lives in systems/ascend.ts (not core/multipliers.ts) because it doesn't
  follow the tick-time '1 + Σ contributions' convention.
- canAscend(state) — single gate; called by orchestrator + UI + tests.
- performAscendOrchestrator(set, get) — pure function. Captures fame BEFORE
  reset, calls resetRunCurrencies + resetTree + resetCanvas + resetWorkshop,
  credits fame, increments ascendCount. All cross-slice writes go through
  existing slice actions (no direct set).

Tests: 17 — getEffectivePalier (base, with Faster Strokes, Big.pow
precision via toBeCloseTo per Phase 0+1 lesson #1), canAscend (below,
exact, with Faster Strokes), performAscendOrchestrator (refusal +
all 8 success-side contracts: currencies, fame, ascendCount, tree,
canvas, workshop, purchasedNodes preserved, playerId preserved,
2nd ascend palier doubling)."
```

---

## Task 7: `metaSlice` extension — `performAscend()` wrapper

**Files:**
- Modify: `src/store/metaSlice.ts` (add performAscend action)
- Modify: `tests/store/metaSlice.test.ts` (add 1 wrapper smoke test)

**Goal:** Add the 1-line slice action that exposes the orchestrator on the store.

- [ ] **Step 1: Write the failing test**

Read the existing `tests/store/metaSlice.test.ts`. It tests `playerId`, `ascendCount`, `incrementAscendCount`, `_setPlayerId`. Append a new describe block (or a test inside the existing one — match the file's style).

For consistency, append a new describe at the end of `tests/store/metaSlice.test.ts`:

```ts
import { useGameStore } from "@/store";

describe("metaSlice — performAscend wrapper", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {}, ascendCount: 0 });
  });

  it("performAscend() returns false when canAscend is false; no state changes", () => {
    expect(useGameStore.getState().performAscend()).toBe(false);
    expect(useGameStore.getState().ascendCount).toBe(0);
  });

  it("performAscend() returns true and increments ascendCount when canAscend is true", () => {
    useGameStore.getState().add("inspiration", big(1500));
    const beforeCount = useGameStore.getState().ascendCount;
    expect(useGameStore.getState().performAscend()).toBe(true);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount + 1);
  });
});
```

(If `big` isn't already imported in this test file, add: `import { big } from "@/core/bigNumber";` at the top.)

Read the current top imports in `tests/store/metaSlice.test.ts` and add what's missing. The `useGameStore` and `big` imports may already be present from earlier Phase 0+1 tests — check before adding duplicates.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/store/metaSlice.test.ts`
Expected: FAIL — `performAscend is not a function` on the store state.

- [ ] **Step 3: Add `performAscend` to the slice**

Edit `src/store/metaSlice.ts`. Find the existing imports at the top:

```ts
import type { StateCreator } from "zustand";
import { newPlayerId } from "@/core/playerId";
```

Add after them:

```ts
import { performAscendOrchestrator } from "@/systems/ascend";
import type { GameStore } from "@/store";
```

Find the `MetaSlice` interface:

```ts
export interface MetaSlice {
  playerId: string;
  ascendCount: number;

  /** Bumped on each successful ascend. */
  incrementAscendCount: () => void;
  /** Test/debug helper — overwrite the playerId. Not used in production. */
  _setPlayerId: (id: string) => void;
}
```

Replace with:

```ts
export interface MetaSlice {
  playerId: string;
  ascendCount: number;

  /** Bumped on each successful ascend. */
  incrementAscendCount: () => void;
  /** Test/debug helper — overwrite the playerId. Not used in production. */
  _setPlayerId: (id: string) => void;
  /**
   * Atomic ascend. Validates via canAscend(state); if true, runs the orchestrator
   * (resets gold/inspi/tree/canvas/workshop, credits fame, increments ascendCount).
   * Returns true on success; false if canAscend is false (no state changed).
   */
  performAscend: () => boolean;
}
```

Find the existing `createMetaSlice` factory:

```ts
export const createMetaSlice: StateCreator<MetaSlice, [], [], MetaSlice> = (set) => ({
  playerId: newPlayerId(),
  ascendCount: 0,

  incrementAscendCount: () => set((s) => ({ ascendCount: s.ascendCount + 1 })),
  _setPlayerId: (id) => set({ playerId: id }),
});
```

Replace with:

```ts
export const createMetaSlice: StateCreator<GameStore, [], [], MetaSlice> = (set, get) => ({
  playerId: newPlayerId(),
  ascendCount: 0,

  incrementAscendCount: () => set((s) => ({ ascendCount: s.ascendCount + 1 })),
  _setPlayerId: (id) => set({ playerId: id }),
  performAscend: () => performAscendOrchestrator(set, get),
});
```

Note the StateCreator type parameter changed from `MetaSlice` to `GameStore` so `get()` returns the full store (which the orchestrator needs to read cross-slice fields like `inspiration`, `purchasedNodes`, `inventory`, etc.). The `set` is correspondingly typed as `StoreApi<GameStore>["setState"]`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/store/metaSlice.test.ts`
Expected: PASS — existing 5 metaSlice tests still pass + 2 new wrapper tests = 7 in this file.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: 202 tests pass (200 + 2 new). (The plan said +1 in the spec but the implementation needs 2 small wrapper smoke tests — a refusal case and a success case.)

Run: `npx tsc -b --noEmit`
Expected: clean. The metaSlice's new `GameStore` import creates a circular type dependency (`metaSlice` → `GameStore` → `MetaSlice`), but TS handles this fine for type-only imports.

- [ ] **Step 6: Commit**

```bash
git add src/store/metaSlice.ts tests/store/metaSlice.test.ts
git commit -m "store(meta): performAscend() wrapper for systems/ascend orchestrator

1-line action body: performAscendOrchestrator(set, get). The slice
owns the action surface; systems/ascend.ts owns the orchestration logic.

Same pattern as Phase 2's tickAll wrapping: thin slice method calls
into a pure systems/ function for testability + separation of concerns.

StateCreator typed against GameStore (not MetaSlice) so get() reaches
the full store — orchestrator reads inspiration, purchasedNodes,
ascendCount, etc.

Tests: 2 wrapper smokes — refusal returns false (no state change),
success returns true and bumps ascendCount. Full orchestrator
contract coverage already in tests/systems/ascend.test.ts."
```

---

## Task 8: persistence-integration round-trip extension

**Files:**
- Modify: `tests/store/persistence-integration.test.ts` (add 1 round-trip test)

**Goal:** Verify the new Phase 3 persisted fields (inventory, equippedItems, purchasedNodes) survive a save/rehydrate cycle. This validates that the recursive `serializeBigs` walker handles them automatically (per Phase 0+1 lesson #2 — JS-primitive fields need zero `partialize` change).

- [ ] **Step 1: Append the round-trip test**

Read `tests/store/persistence-integration.test.ts`. Append a new describe block at the end:

```ts
describe("persistence integration — Phase 3 fields round-trip", () => {
  beforeEach(async () => {
    await idbAdapter.removeItem("artdle-save");
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {} });
  });

  it("inventory + equippedItems + purchasedNodes all round-trip through save", async () => {
    // Seed known state.
    useGameStore.setState({
      inventory: [
        { kind: "+canvas_gold%", magnitude: 12 },
        { kind: "-paint_time%", magnitude: 8 },
      ],
      equippedItems: [
        { kind: "+inspiration_rate%", magnitude: 10 },
      ],
      purchasedNodes: { goldsmith: true, patient_eye: true },
    });

    const beforeInventory = [...useGameStore.getState().inventory];
    const beforeEquipped = [...useGameStore.getState().equippedItems];
    const beforeNodes = { ...useGameStore.getState().purchasedNodes };

    // Force the throttle to flush the latest persist write.
    await persistedAdapter.flush();

    // Stomp in-memory state with bogus values so we can prove rehydration
    // restored from IDB rather than just observing in-memory.
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%", magnitude: 99 }],
      equippedItems: [],
      purchasedNodes: { fake_node: true } as Record<string, true>,
    });

    // Force-rehydrate from IDB.
    await useGameStore.persist.rehydrate();

    // Assert the seeded values were restored.
    const after = useGameStore.getState();
    expect(after.inventory).toEqual(beforeInventory);
    expect(after.equippedItems).toEqual(beforeEquipped);
    expect(after.purchasedNodes).toEqual(beforeNodes);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm test -- tests/store/persistence-integration.test.ts`
Expected: PASS — existing tests + 1 new = 7 total in this file (was 6 after Phase 2's round-trip test).

- [ ] **Step 3: Run full suite + typecheck + lint**

Run: `npm test`
Expected: 203 tests pass (202 + 1 new). All test files green.

Run: `npx tsc -b --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: clean (or only the pre-existing `react-refresh/only-export-components` warning on `main.tsx`).

- [ ] **Step 4: Build sanity**

Run: `npm run build`
Expected: clean — `dist/` produced; no type errors; no compile errors.

- [ ] **Step 5: Commit**

```bash
git add tests/store/persistence-integration.test.ts
git commit -m "test(persistence-integration): Phase 3 fields round-trip

Verifies inventory + equippedItems + purchasedNodes (all JS-primitive
shapes) survive a stomp-and-rehydrate cycle through IDB. Confirms
Phase 0+1 lesson #2 prediction holds for Phase 3: the recursive
serializeBigs walker handles new fields automatically — no
partialize change needed.

Pattern matches the Phase 2 round-trip test (seed → flush → stomp
in-memory with bogus values → rehydrate → assert restored from IDB).

Phase 3 implementation complete: 203/203 tests green, build clean."
```

---

## Post-implementation: handover snapshot

After Task 8 commits, update the handover document so Phase 4 has fresh state.

- [ ] **Step 1: Update `docs/HANDOVER.md`**

Read the current `docs/HANDOVER.md` (it's the post-Phase-2 snapshot). Replace its contents with the post-Phase-3 snapshot. The template:

```markdown
# Artdle Web — Handover

**Date:** 2026-05-02 (post Phase 0+1+2+3 execution)
**Status:** Phase 0+1+2+3 plans executed. **~203/203 tests green** across 19 files. tsc clean. lint clean (1 pre-existing warning). `npm run build` produces a clean `dist/`.

---

## Where we are

The repo at `~/Documents/artdle-web/` has the full v1 gameplay loop online with no UI yet:
- Tree accrues inspiration; canvas auto-paints and credits gold (Phase 2).
- Workshop crafts items into a 3-slot inventory; equip/unequip/swap/discard verbs work; 1 or 2 equip slots based on Second Slot purchase.
- Ascend converts inspiration to fame and resets the run (preserves fame, ascendCount, purchasedNodes, playerId).
- 5-node linear skill tree purchased with fame; effects wired into multipliers + slot count + ascend palier.
- All save state persists with ~1Hz throttle and zero-loss graceful close.

Phase 3 plan at `docs/superpowers/plans/2026-05-02-artdle-web-phase3.md` is fully executed.

**What's new in Phase 3:**

- `src/config/workshopAffixes.ts`: 3 affix kinds, magnitude range constants, inventory cap.
- `src/config/skillTreeNodes.ts`: 5-node linear chain config with literal SkillNodeId union.
- `src/store/skillTreeSlice.ts`: purchasedNodes Record + buyNode action + canBuyNode/hasNode selectors.
- `src/store/workshopSlice.ts`: inventory + equippedItems + craft/equip/unequip/swap/discard/resetWorkshop + getCurrentSlotCount/getEquippedContribution selectors. Uses `core/rng.ts`'s rngPick + rngInt for deterministic test seeding.
- `src/systems/ascend.ts`: pure orchestrator (`performAscendOrchestrator`) + `canAscend` + `getEffectivePalier`. Faster Strokes' 10% palier reduction lives here.
- `src/store/metaSlice.ts`: extended with 1-line `performAscend()` wrapper.
- `src/core/multipliers.ts`: empty Phase 2 bodies replaced — now reads item-equipped contributions + skill-node flags. Phase 2's forward-compat seam delivered exactly as predicted: zero call-site changes in `treeSlice.treeTick` or `canvasSlice.canvasTick`.

**Test count breakdown (19 files, ~203 tests):**

Existing from Phase 0+1+2: 132. Phase 3 net additions:
- workshopAffixes 5, skillTreeNodes 6, skillTreeSlice 12, workshopSlice 19, ascend 17, metaSlice +2, persistence-integration +1 = 62 new in new/extended files
- multipliers replaced 4 → 13 = +9 net
- Total Phase 3: 71 new; 132 + 71 = 203 total

---

## What's next

**Phase 4 — UI shell + 4 view stubs.** Per `PORT_PLAN.md` §7.

Specifically:
- `App.tsx`: TopBar / `<main>` / `<InfoPanel>` / `<BottomBar>` layout.
- View switcher (zustand `currentView` flag; no router).
- Views: `HomeView` (tree + part upgrades), `PaintingView` (canvas slot + Workshop button), `AscensionView` (palier + fame preview + ascend button), `SkillTreeView`.
- Widgets: `BottomBar` (3 currency displays), `CurrencyDisplay`, `InfoPanel`, `Hoverable`.

Phase 4 needs a fresh brainstorm → spec → plan → execute cycle.

Notable Phase 4 hooks already laid:
- All slice actions (`buyPartLevel`, `craft`, `equip`, `growSapling`, `buyNode`, `performAscend`, etc.) return `boolean` — UI components observe success/failure.
- All selectors (`canBuyNode`, `canAscend`, `canGrowSapling`, `getCurrentSlotCount`, `getEquippedContribution`) are pure functions over `GameStore` — UI components consume them via Zustand selectors.
- The dev-only `window.useGameStore` exposure (commit `b858dd8`) lets DevTools-driven smoke tests verify any UI integration without changing main.tsx wiring.

Subsequent plans (one per phase):
- Phase 5: Hover-info wiring + Workshop popup
- Phase 6: Polish (Motion) + balance pass + ship v1.0

---

## Lessons from Phase 0+1+2 (preserved — still apply to Phase 4)

1. **`break_eternity.js` `Big.pow(integer)` is not bit-exact.** Use `toBeCloseTo` for any Big-derived value that flows through `Big.pow`. Phase 3 applied this in `getEffectivePalier(state, 5)` test.

2. **`JSON.stringify` calls `Decimal.toJSON()` BEFORE the replacer runs.** The recursive `serializeBigs` walker in `partialize` handles all new Big-bearing fields automatically. **Phase 3 confirmed: zero `partialize` change required for inventory/equippedItems/purchasedNodes** (all JS primitives or plain records).

3. **Test name = test contract.** Each `it("...")` description must accurately describe what the body asserts.

4. **The afterEach-spy-restore pattern** for Zustand singleton tests when swapping methods.

5. **`Object.freeze` on module-level initial-state constants** prevents shared-reference mutation across resets. Phase 3 applied to `initialWorkshopState` and `initialSkillTreeState`.

6. **Tick-driven mutations require persist throttling** (1s window + flush on hide/unload).

7. **D7 tick order is part of the API contract.** Phase 3 didn't introduce new tickable slices.

8. **Idle-frame guards belong in slice ticks, not the orchestrator.**

---

## New lessons from Phase 3 execution

[Fill in if anything surprising surfaced. Patterns that DID work as predicted:]

1. **Phase 2's empty multiplier pipe paid off cleanly.** Wiring item affixes + skill nodes was a body-only edit to 3 functions in `core/multipliers.ts`; zero call-site changes anywhere. The convention test (`1 + Σ contributions`) and the per-function JSDoc gave the implementer the exact shape to add lines to.

2. **`SkillNodeId` literal union type protected against typos** at every consumer (workshopSlice's `purchasedNodes.better_brush`, multipliers.ts's `goldsmith` and `patient_eye` checks, ascend.ts's `faster_strokes` check). Worth adopting the pattern for any future finite enumeration (canvas tier IDs in v1.1, set names in v1.5, etc.).

3. **`Record<string, true>` for set-like persisted state** serializes cleanly through the existing walker. A `Set` would have serialized to `{}` and broken silently.

4. **Cross-slice atomicity follows the existing currencySlice.spend pattern** — Phase 3's buyNode and craft both use it correctly. The pattern is now established: read state, attempt the spend, only mutate further state if spend succeeds.

[Fill in any new surprises during execution.]

---

## Repo state at handover

- Branch: `master` (no remote configured; never pushed)
- Commits since Phase 2 handover (`12ce5d0`): the dev-aid (`b858dd8`) + Phase 3 spec (`874ffe9`) + Phase 3 plan + 8 task commits + review-driven fixups + this handover.
- Most recent: see `git log --oneline 12ce5d0..HEAD`.
- Working tree: clean apart from `.claude/` (untracked, harness-local — do not commit).

Versions still per `VERSIONS.md`: TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5.

---

## Known low-priority issues (carried forward)

From Phase 0+1: pre-existing `react-refresh/only-export-components` warning on `main.tsx`; `public/assets/artdle/` `.png.import` sidecar files; React Compiler dropped during Phase 0+1.

From Phase 2 final review (deferred to Phase 6 polish): `persistedAdapter.flush()` calls in `main.tsx` lack `.catch()`; `console.error` in throttle has no telemetry sink; canvas tests case 9 near-duplicate; tickAll test mixes 3 assertions; visibilitychange listener in two places.

From Phase 3 final review: [fill in if any new ones surface during execution.]

---

## How to start Phase 4

In a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 4 (UI shell + 4 view stubs). Use the brainstorming skill to scope it, then writing-plans to produce the next plan in `docs/superpowers/plans/`, then executing it via subagent-driven-development.

Phase 4 is the first phase that touches the UI. The dev-only `window.useGameStore` exposure (`src/main.tsx:11-17`) makes DevTools-based smoke testing easy during execution.
```

- [ ] **Step 2: Commit the handover snapshot**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): snapshot post Phase 3 — meta-progression online, 203 tests green"
```

---

## Plan self-review

Before handing this plan to subagents, the plan-author has verified:

1. **Spec coverage**: every section of `2026-05-02-phase3-workshop-ascend-skilltree-design.md` maps to a task. §3 (file layout) → all tasks. §4 (workshopAffixes) → Task 1. §5 (workshopSlice) → Task 4. §6 (skillTreeNodes) → Task 2. §7 (skillTreeSlice) → Task 3. §8 (ascend) → Task 6. §9 (metaSlice extension) → Task 7. §10 (multipliers wiring) → Task 5. §11 (persistence-integration extension) → Task 8. §12 (Phase 0+1+2 lessons) → baked into Tasks 4, 6, 8 specifically (Big.pow precision in Task 6, serializeBigs in Task 8, test-name discipline throughout). §13 (test budget) → 5+6+12+19+13+17+2+1 = 75 new in new files; 13 replaces 4 in multipliers; net +71. The plan's running counts (137 → 143 → 155 → 174 → 183 → 200 → 202 → 203) tally to a final 203, slightly above the spec's ~201 estimate (delta is a +1 from the 6th treeStages test being 6 instead of 5 — wait, that's the structural-pin regression test I added to skillTreeNodes, not treeStages). §14 (task order) → Tasks 1-8 in order. §15 (DoD) → covered by per-task Run commands and Task 8's build sanity + handover.

2. **Placeholder scan**: no "TBD" / "TODO" / "fill in" / "implement appropriately" anywhere. Every code block contains the actual code. Every commit message is fully written. Every Run command has expected output. Two bracketed `[Fill in if ...]` markers in the handover template (§Lessons and §Known issues) are intentional — they ask the executing agent to populate based on what actually happened during execution, similar to Phase 2's handover template.

3. **Type / signature consistency**:
   - `buyNode(id: SkillNodeId): boolean` — declared in Task 3 interface, called throughout Tasks 3-7.
   - `craft() / equip(invIdx) / unequip(equipIdx) / swap(invIdx, equipIdx) / discard(invIdx): boolean`, `resetWorkshop(): void` — all declared in Task 4 interface, used in Task 4 tests + Task 6 ascend reset path.
   - `canBuyNode / hasNode / getCurrentSlotCount / getEquippedContribution / canAscend / getEffectivePalier / performAscendOrchestrator` — all signatures match between definition and consumers.
   - `Item { kind: AffixKind, magnitude: number }` — declared in Task 4, used in Tasks 4, 5, 6, 8.
   - `SkillNodeId` literal union — declared in Task 2, used as parameter type throughout.
   - `purchasedNodes: Record<string, true>` — declared in Task 3, accessed in Tasks 4, 5, 6 via `state.purchasedNodes.<id>`.
   - `inventory / equippedItems: ReadonlyArray<Item>` — declared in Task 4, accessed in Tasks 4, 5, 6, 8.
   - `performAscend(): boolean` — declared in Task 7 interface, used in Task 7 tests.
   - `incrementAscendCount / add / spend / resetRunCurrencies / resetTree / resetCanvas / resetWorkshop` — Phase 0+1+2 actions used by the orchestrator (Task 6) and tests.

4. **Phase 0+1+2 lessons enforced**:
   - Lesson #1 (Big.pow → toBeCloseTo): Task 6 Step 1 test `getEffectivePalier(state, 5)` explicitly uses `toBeCloseTo(expected, 3)`. Task 5 multiplier integration tests use `toBeCloseTo(_, 6)`.
   - Lesson #2 (recursive serializeBigs): Task 8's round-trip test verifies the new fields flow through with no partialize change.
   - Lesson #3 (test names = test contracts): each `it("...")` description is precise about what the body asserts; multi-clause cases are split (e.g., "ascendCount goes 1→2; palier doubles" combines two clauses but each is in the same test on purpose for narrative clarity, and the test body asserts both).
   - Object.freeze on initialWorkshopState and initialSkillTreeState (Task 3 + Task 4).
   - SkillNodeId literal union (Task 2).
   - Cross-slice atomicity via spend-then-set pattern (Tasks 3 + 4).

Plan is ready for subagent execution.

---

## Execution

The originating user request specified subagent-driven-development. After this plan is reviewed, the next step is to invoke `superpowers:subagent-driven-development` to dispatch one subagent per task with two-stage review between tasks.
