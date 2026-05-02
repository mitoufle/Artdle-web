# Artdle Web — Phase 3 Design Spec: Workshop + Ascend + Skill Tree

**Date:** 2026-05-02
**Phase:** 3 (Workshop + Ascend + Skill Tree, no UI)
**Predecessor:** `2026-05-01-phase2-tree-canvas-design.md` (executed; 132 tests green)
**Successor:** Phase 4 plan (UI shell + 4 view stubs) — written after Phase 3 executes.

This spec is the brainstormed-and-approved design for Phase 3 of the Artdle web port. It is the input to the writing-plans phase, not an implementation plan itself.

---

## 1. Scope and goals

Phase 3 brings the meta-progression online end-to-end **with no UI yet**:

- A workshop that crafts random items from a 3-affix pool, holds them in a small inventory, and supports equip/unequip/swap/discard verbs.
- An ascend mechanism that converts inspiration into permanent fame and resets the run.
- A 5-node linear skill tree purchased with fame.
- Wiring of item affixes + skill-tree nodes into the existing empty multiplier pipe (`core/multipliers.ts`).

**Verification = green Vitest suite.** No `npm run dev` smoke required this phase since there's still no UI; the test suite covers all logic.

**Out of scope for Phase 3:**
- Any React UI (Phase 4).
- Hover-info wiring (Phase 5).
- Motion / polish / balance pass (Phase 6).
- Workshop persistence vault, conveyor, paid actions (deferred to v1.5-v1.7 waves).
- Skill tree branching / extra nodes (deferred to canvas/workshop waves).

---

## 2. Locked design decisions

Settled in the brainstorming session and non-negotiable inputs to the implementation plan:

| # | Decision |
|---|---|
| **D1 — Dynamic equip slot count** | Default 1 equip slot; jumps to 2 when "Second Slot" skill node is purchased. `workshopSlice` exposes `getCurrentSlotCount(state)` selector. `equippedItems` is an array, not a single nullable field. |
| **D2 — Two-stage craft via inventory** | Crafting rolls into inventory (max 3 slots). A separate `equip(invIdx)` action moves items from inventory to equipped. Player has agency to reject bad rolls before committing. |
| **D3 — Inventory cap = 3, craft fails when full** | `MAX_INVENTORY_SLOTS = 3`. If inventory is full at craft time, the action returns `false` and **no gold is spent**. Player must `discard(invIdx)` first to make room. |
| **D4 — Five atomic workshop verbs** | `craft()`, `equip(invIdx)`, `unequip(equipIdx)`, `swap(invIdx, equipIdx)`, `discard(invIdx)`. Each is single-purpose, atomic, returns `boolean`. `swap` is independent of fullness (net counts unchanged); `equip` and `unequip` block when their target is full. |
| **D5 — Better Brush is roll-time** | When the "Better Brush" node is purchased, future crafts roll magnitudes in `[6, 16]` instead of `[5, 15]`. Existing items keep their original magnitudes. The player must recraft to benefit. |
| **D6 — Ascend is a hard reset** | `performAscend` wipes gold, inspiration, tree, canvas, AND inventory + equippedItems. Preserves: fame (and adds `fameOnAscend(inspiration)`), ascendCount (incremented), purchasedNodes, playerId, save schema version. |
| **D7 — Architecture: three slices + one system file** | `workshopSlice.ts`, `skillTreeSlice.ts`, `systems/ascend.ts` (orchestrator). `metaSlice.performAscend()` is a 1-line wrapper that calls the orchestrator. `canAscend(state)` and `getEffectivePalier(state, count)` are pure selectors in `systems/ascend.ts`. |
| **D8 — `purchasedNodes` is `Record<string, true>`** | Not a `Set` (Sets serialize to `{}`). The record shape gives O(1) `hasNode` lookup AND clean JSON serialization through the existing `serializeBigs` walker. `SkillNodeId` is a literal union type for compile-time typo protection. |

---

## 3. File layout

### New files

```
src/
├── core/
│   └── multipliers.ts                  [EDIT]   wire item-affix + skill-node contributors
├── config/
│   ├── workshopAffixes.ts              [NEW]    affix kinds + magnitude range constants
│   └── skillTreeNodes.ts               [NEW]    5 nodes: id, cost, prereq, name
├── systems/
│   └── ascend.ts                       [NEW]    getEffectivePalier + canAscend + performAscendOrchestrator
├── store/
│   ├── workshopSlice.ts                [NEW]    inventory + equippedItems + 6 actions + selectors
│   ├── skillTreeSlice.ts               [NEW]    purchasedNodes + buyNode + canBuyNode + hasNode
│   ├── metaSlice.ts                    [EDIT]   add performAscend() wrapper action
│   └── index.ts                        [EDIT]   wire workshopSlice + skillTreeSlice into GameStore

tests/
├── core/
│   └── multipliers.test.ts             [EDIT]   replace tautological doc-test with item + node contribution coverage
├── config/
│   ├── workshopAffixes.test.ts         [NEW]    structural: 3 kinds, magnitude bounds positive
│   └── skillTreeNodes.test.ts          [NEW]    structural: 5 nodes, costs ascending, linear chain valid
├── systems/
│   └── ascend.test.ts                  [NEW]    canAscend, getEffectivePalier, performAscend orchestration
├── store/
│   ├── workshopSlice.test.ts           [NEW]    full slice coverage (state, 5 actions, currentSlotCount, RNG determinism)
│   ├── skillTreeSlice.test.ts          [NEW]    state, buyNode (linear chain enforcement, fame spend, atomicity)
│   ├── metaSlice.test.ts               [EDIT]   add performAscend wrapper smoke test
│   └── persistence-integration.test.ts [EDIT]   round-trip extension for inventory + equippedItems + purchasedNodes
```

### No new top-level dependencies

Everything Phase 3 needs is already in `package.json`.

### Module-boundary contract

- `config/workshopAffixes.ts`: zero imports. Exports `AFFIX_KINDS`, `MAGNITUDE_MIN_PCT`, `MAGNITUDE_MAX_PCT`, `BETTER_BRUSH_BONUS`, `MAX_INVENTORY_SLOTS`, `CRAFT_COST_GOLD`.
- `config/skillTreeNodes.ts`: zero runtime imports. Exports `SKILL_NODES` (readonly array of `SkillNodeConfig`), `SkillNodeId` literal union type.
- `core/multipliers.ts`: imports `GameStore` type, `getEquippedContribution` from workshopSlice. Reads `state.equippedItems` and `state.purchasedNodes`. Tick-time multipliers only — `getEffectivePalier` lives in `systems/ascend.ts`.
- `systems/ascend.ts`: imports `GameStore` type, `core/balance.ts` (`palierAscend`, `fameOnAscend`), `core/bigNumber.ts` (`big`). Exports `getEffectivePalier`, `canAscend`, `performAscendOrchestrator`. No React, no slice-creator imports.
- `store/workshopSlice.ts`: imports `workshopAffixes` config, `core/rng.ts` (mulberry32), `core/bigNumber.ts`, `GameStore` type. Cross-slice writes via `get().spend('gold', ...)` and reads via `state.purchasedNodes` (for Better Brush + Second Slot).
- `store/skillTreeSlice.ts`: imports `skillTreeNodes` config, `core/bigNumber.ts`, `GameStore` type. Cross-slice writes via `get().spend('fame', ...)`.
- `store/metaSlice.ts`: existing imports + `systems/ascend` (for `performAscendOrchestrator`).

---

## 4. `src/config/workshopAffixes.ts`

```ts
export type AffixKind = "+canvas_gold%" | "-paint_time%" | "+inspiration_rate%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+canvas_gold%",
  "-paint_time%",
  "+inspiration_rate%",
];

export const MAGNITUDE_MIN_PCT = 5;
export const MAGNITUDE_MAX_PCT = 15;
export const BETTER_BRUSH_BONUS = 1;
export const MAX_INVENTORY_SLOTS = 3;
export const CRAFT_COST_GOLD = 100;
```

### Tests (`tests/config/workshopAffixes.test.ts`)

1. `AFFIX_KINDS` has exactly 3 entries.
2. The 3 kinds are unique.
3. `MAGNITUDE_MIN_PCT < MAGNITUDE_MAX_PCT`.
4. All numeric constants are positive.
5. `MAX_INVENTORY_SLOTS === 3` (pin the v1 contract).

---

## 5. `src/store/workshopSlice.ts`

### State

```ts
export interface Item {
  readonly kind: AffixKind;
  readonly magnitude: number;   // integer percent, e.g., 12 means +12% / -12%
}

export interface WorkshopState {
  inventory: ReadonlyArray<Item>;        // bounded by MAX_INVENTORY_SLOTS
  equippedItems: ReadonlyArray<Item>;    // bounded by getCurrentSlotCount(state)
}

export const initialWorkshopState: WorkshopState = Object.freeze({
  inventory: [],
  equippedItems: [],
});
```

`Object.freeze` follows the Phase 2 lesson — prevents shared-reference mutation across `resetWorkshop()` calls.

### Actions

```ts
export interface WorkshopSlice extends WorkshopState {
  craft: () => boolean;
  equip: (invIdx: number) => boolean;
  unequip: (equipIdx: number) => boolean;
  swap: (invIdx: number, equipIdx: number) => boolean;
  discard: (invIdx: number) => boolean;
  resetWorkshop: () => void;
}
```

#### `craft()` — atomic

1. If `state.inventory.length >= MAX_INVENTORY_SLOTS` → return `false` (NO gold spent).
2. Else if `!state.spend('gold', big(CRAFT_COST_GOLD))` → return `false` (insufficient).
3. Roll kind via `rand()` (mulberry32, indexes `AFFIX_KINDS`).
4. Compute `min = MAGNITUDE_MIN_PCT + brushBonus`, `max = MAGNITUDE_MAX_PCT + brushBonus` where `brushBonus = state.purchasedNodes.better_brush ? BETTER_BRUSH_BONUS : 0`.
5. Roll magnitude: `min + Math.floor(rand() * (max - min + 1))` (inclusive bounds).
6. `set((s) => ({ inventory: [...s.inventory, { kind, magnitude }] }))` → return `true`.

#### `equip(invIdx)`

1. Bounds check: `invIdx < 0 || invIdx >= state.inventory.length` → return `false`.
2. `getCurrentSlotCount(state)` → if `state.equippedItems.length >= currentSlotCount` → return `false`.
3. Move atomically: pop from inventory at `invIdx`, push to `equippedItems`.

#### `unequip(equipIdx)`

1. Bounds check: `equipIdx < 0 || equipIdx >= state.equippedItems.length` → return `false`.
2. If `state.inventory.length >= MAX_INVENTORY_SLOTS` → return `false` (no room).
3. Move atomically: pop from `equippedItems` at `equipIdx`, push to `inventory`.

#### `swap(invIdx, equipIdx)`

1. Bounds check both indices → return `false` if either invalid.
2. Atomically exchange: `inventory[invIdx]` ↔ `equippedItems[equipIdx]`.
3. Net counts unchanged on both sides — fullness is irrelevant.

#### `discard(invIdx)`

1. Bounds check: `invIdx` valid → otherwise return `false`.
2. Remove `inventory[invIdx]`. No gold refund.

#### `resetWorkshop()`

`set(initialWorkshopState)`. Used by ascend orchestrator.

### Selectors (pure, exported)

```ts
export const getCurrentSlotCount = (state: GameStore): number =>
  state.purchasedNodes.second_slot ? 2 : 1;

export const getEquippedContribution = (state: GameStore, kind: AffixKind): number =>
  state.equippedItems
    .filter((i) => i.kind === kind)
    .reduce((sum, i) => sum + i.magnitude / 100, 0);
```

### Tests (`tests/store/workshopSlice.test.ts`, ~19 tests)

1. Initial state: `inventory` and `equippedItems` both empty.
2. `craft()` with insufficient gold returns `false`; nothing changes.
3. `craft()` with sufficient gold: gold deducted, inventory grows by 1, item has valid `kind` and `magnitude` in `[5, 15]`.
4. `craft()` with `setSeed(42)` produces a deterministic `(kind, magnitude)` (pin specific values).
5. `craft()` with Better Brush purchased: magnitude is in `[6, 16]`.
6. `craft()` with full inventory returns `false`; gold NOT deducted (atomic).
7. `equip(0)` from a 1-item inventory + 0 equipped: inventory becomes empty, equippedItems has 1 item.
8. `equip(invalidIdx)` returns `false`.
9. `equip(0)` when equipped is full (slotCount=1, 1 item already equipped): returns `false`.
10. `equip(0)` with Second Slot purchased + 1 item already equipped: succeeds (slotCount=2, room exists).
11. `unequip(0)` moves item back to inventory; equippedItems shrinks.
12. `unequip(0)` when inventory is full returns `false` (item stays equipped).
13. `swap(0, 0)` exchanges `inventory[0]` and `equippedItems[0]`; counts unchanged.
14. `swap` with invalid indices returns `false`.
15. `discard(0)` removes `inventory[0]`; no gold refund.
16. `discard(invalidIdx)` returns `false`.
17. `getCurrentSlotCount` returns 1 by default, 2 after Second Slot purchased.
18. `getEquippedContribution(state, "+canvas_gold%")` sums `magnitude/100` across matching equipped items.
19. `resetWorkshop()` restores `initialWorkshopState`.

### Decisions baked in

- Item is plain `{kind, magnitude}` — no UUID. Position in inventory/equipped IS the identity.
- Flat 100 gold craft cost (PORT_PLAN.md §1.3 default; no scaling in v1).
- `craft` checks inventory fullness BEFORE spending gold (keeps the action atomic on failure).
- Two RNG calls per craft (kind, magnitude). Deterministic via `setSeed(42)` in tests.
- `equip` picks the first empty equipped slot (no slot-choice UX in Phase 3).

---

## 6. `src/config/skillTreeNodes.ts`

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
  readonly cost: number;          // fame cost
  readonly prereq: SkillNodeId | null;
}

export const SKILL_NODES: ReadonlyArray<SkillNodeConfig> = [
  { id: "goldsmith",      name: "Goldsmith",      cost: 1,   prereq: null },
  { id: "patient_eye",    name: "Patient Eye",    cost: 3,   prereq: "goldsmith" },
  { id: "second_slot",    name: "Second Slot",    cost: 10,  prereq: "patient_eye" },
  { id: "faster_strokes", name: "Faster Strokes", cost: 30,  prereq: "second_slot" },
  { id: "better_brush",   name: "Better Brush",   cost: 100, prereq: "faster_strokes" },
];
```

### Tests (`tests/config/skillTreeNodes.test.ts`, 5 tests)

1. Exactly 5 nodes.
2. Costs strictly increasing: `1 < 3 < 10 < 30 < 100`.
3. All prereq references point to valid existing IDs (or `null`).
4. The first node's prereq is `null` (chain root).
5. The 5 IDs are unique.

---

## 7. `src/store/skillTreeSlice.ts`

### State

```ts
export interface SkillTreeState {
  purchasedNodes: Record<string, true>;
}

export const initialSkillTreeState: SkillTreeState = Object.freeze({
  purchasedNodes: {},
});
```

### Action

```ts
export interface SkillTreeSlice extends SkillTreeState {
  buyNode: (id: SkillNodeId) => boolean;
}
```

#### `buyNode(id)` — atomic

1. Look up `SKILL_NODES.find((n) => n.id === id)` → return `false` if unknown.
2. If `state.purchasedNodes[id]` → return `false` (already owned).
3. If `node.prereq !== null && !state.purchasedNodes[node.prereq]` → return `false` (prereq missing).
4. `if (!state.spend("fame", big(node.cost))) return false` (insufficient).
5. `set((s) => ({ purchasedNodes: { ...s.purchasedNodes, [id]: true } }))` → return `true`.

### Selectors (pure, exported)

```ts
export const hasNode = (state: GameStore, id: SkillNodeId): boolean =>
  state.purchasedNodes[id] === true;

export const canBuyNode = (state: GameStore, id: SkillNodeId): boolean => {
  const node = SKILL_NODES.find((n) => n.id === id);
  if (!node) return false;
  if (state.purchasedNodes[id]) return false;
  if (node.prereq !== null && !state.purchasedNodes[node.prereq]) return false;
  return state.fame.gte(big(node.cost));
};
```

### Tests (`tests/store/skillTreeSlice.test.ts`, ~12 tests)

1. Initial state: `purchasedNodes = {}`.
2. `buyNode("goldsmith")` with 1 fame succeeds; `purchasedNodes.goldsmith === true`; fame is 0.
3. `buyNode("goldsmith")` with 0 fame returns `false`; nothing changes.
4. `buyNode("goldsmith")` twice: second call returns `false` (already owned), no extra fame spent.
5. `buyNode("patient_eye")` without goldsmith returns `false`; fame not spent.
6. `buyNode("patient_eye")` after goldsmith + 3 fame succeeds.
7. Linear chain: buy goldsmith → patient_eye → second_slot → faster_strokes → better_brush in order works given enough fame.
8. Skipping ahead: buy second_slot before patient_eye returns `false`.
9. `buyNode("nonexistent" as SkillNodeId)` returns `false`.
10. `hasNode` returns `true` only for purchased nodes.
11. `canBuyNode("goldsmith")` returns false at fame=0, true at fame=1, false again after purchase.
12. `canBuyNode("patient_eye")` returns false until goldsmith is owned.

### Decisions baked in

- `SkillNodeId` is a literal union type — compile-time typo protection at every consumer.
- `cost` is JS `number`, not `Big`. Wrapped via `big(node.cost)` only at the spend site.
- No `resetSkillTree` action — purchasedNodes survives ascend. Tests reset via `useGameStore.setState({ purchasedNodes: {} })`.

---

## 8. `src/systems/ascend.ts`

### Pure orchestrator

```ts
import type { GameStore } from "@/store";
import type { StoreApi } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import { palierAscend, fameOnAscend } from "@/core/balance";

/**
 * Effective inspiration palier. Faster Strokes reduces by 10%.
 *
 * Lives here (not core/multipliers.ts) because it's a one-off domain-specific
 * reduction, not a tick-time multiplier following the `1 + Σ contributions`
 * convention.
 */
export const getEffectivePalier = (state: GameStore, count: number): Big => {
  const base = palierAscend(count);
  const reduction = state.purchasedNodes.faster_strokes ? 0.10 : 0;
  return base.mul(1 - reduction);
};

export const canAscend = (state: GameStore): boolean =>
  state.inspiration.gte(getEffectivePalier(state, state.ascendCount));

export const performAscendOrchestrator = (
  set: StoreApi<GameStore>["setState"],
  get: StoreApi<GameStore>["getState"],
): boolean => {
  const state = get();
  if (!canAscend(state)) return false;

  const fameGain = fameOnAscend(state.inspiration);

  state.resetRunCurrencies();
  state.resetTree();
  state.resetCanvas();
  state.resetWorkshop();

  if (fameGain > 0) {
    state.add("fame", big(fameGain));
  }

  state.incrementAscendCount();

  return true;
};
```

### Order of operations

1. Capture `fameGain = fameOnAscend(state.inspiration)` BEFORE inspiration is reset.
2. Reset run state via existing slice actions: `resetRunCurrencies` (gold + inspi → 0), `resetTree`, `resetCanvas`, `resetWorkshop`.
3. Credit fame (after reset; fame survived `resetRunCurrencies` because it only touches gold + inspi).
4. Bump `ascendCount` via `incrementAscendCount`.
5. Return `true`.

### Tests (`tests/systems/ascend.test.ts`, ~17 tests)

1. `getEffectivePalier(state, 0)` returns `big(1000)` (base, no Faster Strokes).
2. `getEffectivePalier(state, 0)` with Faster Strokes returns `big(900)` (10% reduction).
3. `getEffectivePalier(state, 5)` returns `palierAscend(5).mul(0.9)` with Faster Strokes — use `toBeCloseTo` per Phase 0+1 lesson #1.
4. `canAscend` returns `false` when inspiration < palier.
5. `canAscend` returns `true` at exact threshold.
6. `canAscend` becomes true earlier with Faster Strokes.
7. `performAscendOrchestrator` returns `false` when `canAscend` is false; state unchanged.
8. `performAscendOrchestrator` on success: gold → 0, inspiration → 0.
9. `performAscendOrchestrator` on success: fame increases by `fameOnAscend(inspirationBeforeReset)`.
10. `performAscendOrchestrator` on success: ascendCount increments by 1.
11. `performAscendOrchestrator` on success: tree resets (currentStage=0, all partLevels=0).
12. `performAscendOrchestrator` on success: canvas resets (canvasProgress=0).
13. `performAscendOrchestrator` on success: workshop resets (inventory empty, equippedItems empty).
14. `performAscendOrchestrator` on success: `purchasedNodes` UNCHANGED.
15. `performAscendOrchestrator` on success: `playerId` UNCHANGED.
16. `performAscendOrchestrator` second time: ascendCount goes 1→2; palier is `palierAscend(1) = 2000`.
17. `performAscendOrchestrator` with inspi=0: returns false (palier > 0).

### Decisions baked in

- Capture fame BEFORE resets, then reset, then credit fame, then increment ascendCount. Predictable, reproducible.
- `fameGain > 0` guard avoids a no-op `add('fame', big(0))` call when inspiration was below 10 (the floor for `fameOnAscend`).
- Faster Strokes is a flat 10% reduction; no stacking with other reductions in v1.
- `canAscend` is the single gate. `performAscendOrchestrator` calls it; UI calls it; tests call it.
- Cross-slice writes via slice actions only (`resetTree`, `resetCanvas`, etc.). Honors slice encapsulation.

---

## 9. `src/store/metaSlice.ts` extension

Add `performAscend` action that wraps the orchestrator:

```ts
import { performAscendOrchestrator } from "@/systems/ascend";

export interface MetaSlice {
  playerId: string;
  ascendCount: number;
  incrementAscendCount: () => void;
  _setPlayerId: (id: string) => void;
  /**
   * Atomic ascend. Validates via canAscend(state); if true, runs the orchestrator
   * (resets gold/inspi/tree/canvas/workshop, credits fame, increments ascendCount).
   * Returns true on success; false if canAscend is false (no state changed).
   */
  performAscend: () => boolean;
}

// In createMetaSlice:
performAscend: () => performAscendOrchestrator(set, get),
```

### Tests (extension to `tests/store/metaSlice.test.ts`, +1 test)

1. `performAscend()` action calls into the orchestrator and returns its result. Smoke that the wrapper passes through (full orchestrator coverage lives in `tests/systems/ascend.test.ts`).

---

## 10. `src/core/multipliers.ts` wiring

### Updated bodies (replaces Phase 2's empty implementations)

```ts
import type { GameStore } from "@/store";
import { getEquippedContribution } from "@/store/workshopSlice";

export const getInspiMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+inspiration_rate%");
  if (state.purchasedNodes.patient_eye) bonus += 0.15;
  return 1 + bonus;
};

export const getCanvasGoldMultiplier = (state: GameStore): number => {
  let bonus = 0;
  bonus += getEquippedContribution(state, "+canvas_gold%");
  if (state.purchasedNodes.goldsmith) bonus += 0.10;
  return 1 + bonus;
};

export const getPaintTimeMultiplier = (state: GameStore): number => {
  let bonus = 0;
  for (const item of state.equippedItems) {
    if (item.kind === "-paint_time%") {
      const v = item.magnitude / 100;
      bonus += v / (1 - v);   // per-item conversion (Phase 2 JSDoc convention)
    }
  }
  return 1 + bonus;
};
```

### Test extensions (`tests/core/multipliers.test.ts`)

Replace the 4-test Phase 2 file. New test count: ~13.

- `getInspiMultiplier` returns 1 with no equipped items + no Patient Eye.
- `getInspiMultiplier` returns 1.15 with Patient Eye purchased.
- `getInspiMultiplier` returns `1 + magnitude/100` with one `+inspiration_rate%` item equipped.
- `getInspiMultiplier` sums multiple `+inspiration_rate%` items.
- `getInspiMultiplier` combines item + Patient Eye contributions.
- `getCanvasGoldMultiplier` returns 1 with no contributors.
- `getCanvasGoldMultiplier` returns 1.10 with Goldsmith purchased.
- `getCanvasGoldMultiplier` sums equipped + Goldsmith.
- `getPaintTimeMultiplier` returns 1 with no equipped items.
- `getPaintTimeMultiplier` converts `-paint_time% 10` into `+0.111` bonus → multiplier ≈ 1.111. Verify effective time = `PAINT_TIME_BASE_SECONDS / 1.111 ≈ 9.0`.
- `getPaintTimeMultiplier` sums per-item conversions for two `-paint_time%` items.
- Integration: Patient Eye purchased → `treeTick` credits 1.15× the no-multiplier inspi rate. Use `toBeCloseTo`.
- Integration: Goldsmith purchased → `canvasTick` credits 1.10× the no-multiplier gold per sale.

### Decisions baked in

- No additional file — `core/multipliers.ts` stays the single home for tick-time multipliers.
- Paint-time conversion is per-item (`v/(1-v)` happens inside the loop). Two equipped `-paint_time%` items don't sum magnitudes first.
- No "diminishing returns" logic in v1.

---

## 11. Persistence integration extension

`tests/store/persistence-integration.test.ts` (extend with 1 new test):

**Round-trip: `inventory` + `equippedItems` + `purchasedNodes` survive save/rehydrate.**

1. Seed: craft 2 items, equip 1, purchase goldsmith.
2. Capture before-state values.
3. `await persistedAdapter.flush()`.
4. Stomp in-memory with bogus values (set `inventory: [bogusItem]`, `equippedItems: []`, `purchasedNodes: { fake_node: true }`).
5. `await useGameStore.persist.rehydrate()`.
6. Assert before-state values restored (inventory, equippedItems, purchasedNodes, the 2 crafted item kinds + magnitudes).

This validates that the recursive `serializeBigs` walker handles the new persisted fields automatically (per Phase 0+1 lesson #2).

---

## 12. Phase 0+1+2 lessons baked into the spec

The plan reviewer must enforce these against the writing-plans output:

### Lesson #1 — `Big.pow` is not bit-exact

`break_eternity.js`'s `Big.pow(integer)` uses log-domain math. Tests asserting Big-derived values must use `toBeCloseTo`, not `toBe`.

**Phase 3 application**: `getEffectivePalier(state, 5)` test (uses `palierAscend(5).mul(0.9)` which involves `Big.pow(5)`). Multiplier integration tests that involve `inspiPerSec` × `multiplier` via `Big.mul`.

### Lesson #2 — `serializeBigs` walker is recursive and automatic

Phase 3 adds `inventory: Item[]`, `equippedItems: Item[]`, `purchasedNodes: Record<string, true>` to persisted state. All are JS primitives or plain records — the walker is a no-op for them. **No `partialize` change required.** The persistence-integration round-trip test verifies this.

### Lesson #3 — Test name = test contract

Each `it("...")` description must accurately describe what the test body asserts. Examples to watch:
- `it("buyNode('patient_eye') without goldsmith returns false; fame not spent")` — must assert BOTH `return === false` AND `fame === before`.
- `it("craft() with full inventory returns false; gold NOT deducted (atomic)")` — must assert both halves.
- `it("getEffectivePalier returns big(900) with Faster Strokes")` — must compute against the expected value, not just "less than base".

### Phase 2 lessons (carried forward)

- **The afterEach-spy-restore pattern** is the right shape for Zustand singleton tests. Phase 3 doesn't introduce new spy tests by default but if needed, follow the `tickAll.test.ts:7-21` pattern (originals captured at suite scope, restored via afterEach).
- **`Object.freeze`** on `initialWorkshopState` and `initialSkillTreeState` (and any other module-level initial-state constants) — prevents shared-reference mutation across resets.
- **D7 tick order is part of the API contract.** Phase 3 doesn't introduce new tickable slices (workshop is click-driven, ascend is event-driven, skill tree is click-driven), but the `tickAll` pattern stays as Phase 2 left it.
- **Idle-frame guards in tick actions** — Phase 3 doesn't add new tick actions, so this is informational.

### New Phase 3 discipline

- **`SkillNodeId` literal union type** is the right shape for finite enumerable IDs. If Phase 4+ introduces other finite-ID enums (canvas tier IDs, set names, etc.), use the same pattern.
- **Cross-slice atomicity follows the existing `currencySlice.spend` pattern**: read state, attempt the spend, only mutate further state if spend succeeds. Don't write partial state then unwind on failure.
- **`Record<string, true>` for set-like persisted state.** Sets serialize to `{}`. Use `Record<string, true>` for O(1) lookup and clean JSON.

---

## 13. Test budget summary

| File | New/Extend | Tests | Ref |
|---|---|---|---|
| `tests/config/workshopAffixes.test.ts` | new | 5 | §4 |
| `tests/config/skillTreeNodes.test.ts` | new | 5 | §6 |
| `tests/store/workshopSlice.test.ts` | new | 19 | §5 |
| `tests/store/skillTreeSlice.test.ts` | new | 12 | §7 |
| `tests/systems/ascend.test.ts` | new | 17 | §8 |
| `tests/store/metaSlice.test.ts` | extend | +1 | §9 |
| `tests/core/multipliers.test.ts` | replace 4-test file with full coverage | 13 (replacing 4) | §10 |
| `tests/store/persistence-integration.test.ts` | extend | +1 | §11 |
| **Phase 3 net new** | | **~69** | |

Existing test count post-Phase-2: 132. Phase 3 net delta:
- Adds 5 + 5 + 19 + 12 + 17 + 1 + 1 = 60 new tests in new/extended files.
- Replaces the 4-test multipliers file with 13 tests (net +9).
- Total post-Phase-3: 132 + 69 = ~201.

PORT_PLAN.md §6 budgeted Phase 3 at ~40 tests. We're over because:
- Workshop has more verbs (5) than the original spec's "click-to-craft + 1 affix" framing suggested (the inventory + swap design adds surface).
- Multipliers wiring tests cover the real Phase 3 expansion.
- Each formula's wiring deserves its own test for diagnostic clarity.

The grand v1.0 total (~250 tests by v1.0) still tracks PORT_PLAN.md's ballpark.

---

## 14. Implementation task order

The writing-plans phase will decompose this spec into per-task TDD steps. The expected order:

1. **`workshopAffixes.ts`** — config + 5 tests. Foundation for workshopSlice.
2. **`skillTreeNodes.ts`** — config + 5 tests. Foundation for skillTreeSlice.
3. **`skillTreeSlice.ts`** — state, `buyNode`, selectors. Wire into `useGameStore`. ~12 tests. (Done before workshopSlice because workshopSlice's `craft` reads `purchasedNodes.better_brush`; getting skillTreeSlice in first means workshop tests can purchase Better Brush before testing the magnitude bonus.)
4. **`workshopSlice.ts`** — state + 5 actions + selectors. Wire into `useGameStore`. ~19 tests. Includes RNG-determinism test using `setSeed(42)`.
5. **`core/multipliers.ts`** — wire item + node contributors into all 3 functions. Replace the Phase 2 doc-test with ~13 tests.
6. **`systems/ascend.ts`** — `getEffectivePalier`, `canAscend`, `performAscendOrchestrator`. ~17 tests.
7. **`metaSlice.ts`** — add `performAscend()` wrapper + 1 smoke test.
8. **`persistence-integration` extension** — 1 round-trip test for inventory + equippedItems + purchasedNodes.

Each step is one Plan-driven commit (`test:` first, then `feat:`/`config:`/`store:`/`core:`/`systems:`/`refactor:`).

---

## 15. Definition of done — Phase 3

1. All test files in §13 implemented; full Vitest suite green (~201 tests).
2. `tsc --noEmit` (or `npm run build`) clean.
3. ESLint clean (the existing `react-refresh/only-export-components` warning on `main.tsx:9` is acceptable per HANDOVER.md known-low-priority issues).
4. **No `npm run dev` smoke required** — Phase 3 ships no UI. The test suite is the only verification.
5. A new HANDOVER.md snapshot for Phase 4 to start from.

---

## 16. Out of scope (explicit reminders)

- **No UI**. Phase 4.
- **No hover-info wiring** — Phase 5.
- **No motion / polish** — Phase 6.
- **No balance pass** — Phase 6. The numbers in `workshopAffixes.ts` (5-15% magnitude, 100 gold craft) and `skillTreeNodes.ts` (1/3/10/30/100 fame costs) are placeholder Phase-6-tunable defaults.
- **No workshop persistence vault, conveyor, paid actions** — v1.5-v1.7.
- **No skill tree branching** — Phase 5+ canvas/workshop wave skill trees.
- **No save schema migration** — stays at version 1 per Phase 0+1 lesson #2.

---

## 17. Risks / things to watch

- **RNG determinism in tests** — `setSeed(42)` must be called in `beforeEach` of any test that asserts specific roll outcomes. Without it, the global RNG state leaks between tests.
- **`canBuyNode` could drift from `buyNode`** if the validation logic is duplicated. Tests assert symmetry: `canBuyNode(state, id) === true` ↔ `buyNode(id)` succeeds. Refactor to a shared helper if drift becomes a concern.
- **`performAscend` re-entrancy** — if a UI button calls `performAscend()` twice in rapid succession (double-click), the second call will return `false` (canAscend is now false because inspiration was reset). Phase 4 UI should disable the button while the ascend animation runs (Phase 6 polish), but the slice contract is already safe.
- **`equip` "first empty slot" semantics** — when Second Slot is purchased, the player has no UX control over which slot gets a new equip. v1.8 (UI rebuild) introduces drag-drop slot choice; v1.0-v1.7 doesn't.
- **Item `magnitude / 100` precision** — JS `number` has 15-17 significant digits; magnitudes 5-16 divided by 100 stay well within precision. Multiplying by `Big` (`getEquippedContribution`'s sum is plain number, multiplied by Big in `inspiPerSec`) is the precision boundary. Phase 0+1 lesson #1 applies — use `toBeCloseTo`.
- **Better Brush is roll-time** — players who buy Better Brush late (after equipping their best items) won't see immediate benefit. Phase 4 UI should make this clear in the node's hover info to prevent confusion.

---

## 18. References

- `docs/PORT_PLAN.md` §1.3 (Workshop), §1.4 (Skill tree), §1.5 (Ascend), §7 Phase 3.
- `docs/HANDOVER.md` — Phase 0+1+2 lessons (incorporated into §12).
- `docs/superpowers/specs/2026-05-01-phase2-tree-canvas-design.md` — predecessor spec (the multiplier convention, the `serializeBigs` walker, the `Object.freeze` pattern).
- `docs/superpowers/plans/2026-05-01-artdle-web-phase2.md` — predecessor plan (executed).
- `src/core/balance.ts` — existing `palierAscend(count)` and `fameOnAscend(inspi)` formulas.
- `src/core/rng.ts` — existing `mulberry32` + `setSeed`.
- `src/core/multipliers.ts` — Phase 2's empty pipe; Phase 3 fills it in.
- `src/systems/persistence.ts` — `persistedAdapter` (1s throttle + flush), used by tests.

---

This spec extends Phase 0+1+2's foundation. The writing-plans phase will produce `docs/superpowers/plans/2026-05-02-artdle-web-phase3.md` with per-task TDD decomposition.
