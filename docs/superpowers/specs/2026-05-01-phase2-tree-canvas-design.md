# Artdle Web — Phase 2 Design Spec: Tree + Canvas Slices

**Date:** 2026-05-01
**Phase:** 2 (Tree + Canvas, no UI)
**Predecessor:** `2026-05-01-artdle-web-phase0-1.md` (executed; 84 tests green)
**Successor:** Phase 3 plan (Workshop + Ascend + Skill Tree) — written after Phase 2 executes.

This spec is the brainstormed-and-approved design for Phase 2 of the Artdle web port. It is the input to the writing-plans phase, not an implementation plan itself.

---

## 1. Scope and goals

Phase 2 brings the gameplay loop online end-to-end **with no UI yet**:

- A passive tree that accrues inspiration over time.
- A canvas that paints continuously, auto-sells on completion, credits gold.
- A `tickAll(delta)` orchestrator wired to the existing RAF tickLoop.
- A multipliers aggregation pipe (empty in Phase 2, contributors arrive in Phase 3).
- A throttled IDB persistence adapter so tick-driven mutations don't hammer the disk.

**Verification = green Vitest suite + `npm run dev` smoke** (gold and inspiration tick up; refresh preserves all state).

**Out of scope for Phase 2:**
- Workshop, Ascend, Skill Tree (Phase 3).
- Any React UI beyond the existing `main.tsx` Bootstrap (Phase 4).
- Hover-info wiring (Phase 5).
- Motion / polish (Phase 6).

---

## 2. Locked design decisions

These were settled in the brainstorming session and are non-negotiable inputs to the implementation plan:

| # | Decision |
|---|---|
| **D1 — Canvas always paints** | Auto-restart from v1.0. No "Paint" button. The canvas perpetually advances; on threshold-cross it auto-sells and resets. |
| **D2 — One sale per tick** | A `canvasTick(delta)` with `delta ≥ paintTime` credits exactly one sale, never multiple. Leftover progress is carried forward when small (`< paintTime`); dropped to 0 when synthetic deltas push leftover ≥ paintTime. |
| **D3 — Tree stage advancement is gated and free** | A free `growSapling()` action increments `currentStage` by 1 if the gate is open. Gate: total levels in the current stage's parts ≥ next stage's `unlockThreshold`. |
| **D4 — Stage unlock thresholds** | Geometric ×10. Stage 0 = 0 (auto-unlocked), stage 1 = 10, stage 2 = 100. Phase 2 uses these two transitions; future-wave stages would extend the curve. |
| **D5 — Prior-stage parts persist** | After advancing, prior-stage parts keep their levels, keep contributing to `inspiPerSec`, and remain upgradable. The tree only grows. |
| **D6 — Multipliers pipe built empty** | `src/core/multipliers.ts` exports three pure functions over `GameStore`. All return 1 in Phase 2. Phase 3 teaches them to read item affixes and skill-tree nodes without changing call sites. |
| **D7 — Per-slice tick + top-level `tickAll`** | Each slice owns its tick action (`treeTick`, `canvasTick`). A top-level `tickAll(delta)` in `store/index.ts` orchestrates them in fixed order: tree first, canvas second. |
| **D8 — Throttled persistence adapter** | Wrap `idbAdapter.setItem` with a ~1s debounce + `flush()` for `visibilitychange`/`beforeunload`. Bounds save loss at ~1s on hard crash; zero loss on graceful tab close. |

---

## 3. File layout

### New files

```
src/
├── core/
│   └── multipliers.ts                       [NEW]
├── config/
│   └── treeStages.ts                         [NEW]
├── store/
│   ├── treeSlice.ts                          [NEW]
│   └── canvasSlice.ts                        [NEW]

tests/
├── core/
│   └── multipliers.test.ts                   [NEW]
├── config/
│   └── treeStages.test.ts                    [NEW]
└── store/
    ├── treeSlice.test.ts                     [NEW]
    ├── canvasSlice.test.ts                   [NEW]
    └── tickAll.test.ts                       [NEW]
```

### Edited files

```
src/
├── store/index.ts                            [EDIT] add tree+canvas slices to GameStore; add tickAll; swap idbAdapter → persistedAdapter
├── systems/persistence.ts                    [EDIT] add throttledAdapter + flush wiring; export persistedAdapter
└── main.tsx                                  [EDIT] start tickLoop after hydration; flush adapter on visibilitychange/beforeunload

tests/
├── systems/persistence.test.ts               [EDIT] +6 throttle tests
└── store/persistence-integration.test.ts     [EDIT] +1 round-trip test for tree+canvas state
```

### No new top-level dependencies

Everything Phase 2 needs is already in `package.json`.

### Module-boundary contract

- `core/multipliers.ts` is pure. Imports `GameStore` type only. No imports from `store/`.
- `config/treeStages.ts` exports `readonly` typed config. No imports from `store/` or `core/balance.ts`.
- `treeSlice.ts` imports `treeStages.ts` config + `balance.ts` formulas + `multipliers.ts` selectors. Calls `get().add('inspiration', ...)` for cross-slice writes.
- `canvasSlice.ts` mirrors: imports `balance.ts` (`PAINT_TIME_BASE_SECONDS`, `canvasGold`) + `multipliers.ts`. Calls `get().add('gold', ...)`.

---

## 4. `src/config/treeStages.ts`

### Shape

```ts
export interface TreePartConfig {
  readonly id: string;          // stable; used as key in slice state
  readonly name: string;        // display name (Phase 4)
  readonly baseCost: number;    // gold cost at level 0 → 1
  readonly rate: number;        // inspi/sec contribution per level (level * rate)
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

export const TREE_STAGES: ReadonlyArray<TreeStageConfig> = [
  {
    id: "seed",
    name: "Seed",
    unlockThreshold: 0,
    parts: [
      { id: "spark", name: "Spark", baseCost: 10,  rate: 0.1 },
      { id: "bud",   name: "Bud",   baseCost: 50,  rate: 0.5 },
    ],
  },
  {
    id: "sapling",
    name: "Sapling",
    unlockThreshold: 10,
    parts: [
      { id: "leaf",   name: "Leaf",   baseCost: 100, rate: 5  },
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

### Decisions

- **2 parts per stage.** Lower bound of PORT_PLAN.md's "2-3 parts/stage". Six total IDs: `spark`, `bud`, `leaf`, `branch`, `bough`, `crown`.
- **`unlockThreshold` semantics**: total levels needed in the prior stage's parts to grow into this stage.
- **Numbers are placeholder Phase-6-tunable defaults.** Costs and rates form a plausible curve (×10 between stages); tuning belongs in Phase 6.
- **`rate` is a JS number, not a Big.** v1 inspi/sec stays well under `Number.MAX_SAFE_INTEGER`. The Big arithmetic happens inside `inspiPerSec`.

### Tests (`tests/config/treeStages.test.ts`)

1. Exactly 3 stages, ordered seed → sapling → tree.
2. `unlockThreshold` strictly increasing across stages (0, 10, 100).
3. All part IDs unique across all stages.
4. Every part has `baseCost > 0` and `rate > 0`.
5. Stage 0 is the only stage with `unlockThreshold === 0`.

---

## 5. `src/core/multipliers.ts`

### Shape

```ts
import type { GameStore } from "@/store";

/**
 * Aggregate multiplier on inspiration accrual rate.
 * Phase 2: returns 1 (no contributors).
 * Phase 3 reads equipped-item affix `+inspiration_rate%` and skill node "Patient Eye".
 */
export const getInspiMultiplier = (_state: GameStore): number => 1;

/**
 * Aggregate multiplier on gold credited per canvas sale.
 * Phase 2: returns 1.
 * Phase 3 reads `+canvas_gold%` affix and skill node "Goldsmith".
 */
export const getCanvasGoldMultiplier = (_state: GameStore): number => 1;

/**
 * Paint-speed multiplier (effectivePaintTime = PAINT_TIME_BASE_SECONDS / multiplier).
 * Higher = faster. Phase 2: returns 1.
 * Phase 3 reads `-paint_time%` affix.
 */
export const getPaintTimeMultiplier = (_state: GameStore): number => 1;
```

### Composition convention (forward-look, NOT Phase 2 work)

All three functions follow `1 + Σ contributions`. Each contribution is an additive percentage. Phase 3 lines like:

```ts
let bonus = 0;
if (state.equippedItem?.affix.kind === "+canvas_gold%") bonus += state.equippedItem.affix.value;
if (state.purchasedNodes.has("goldsmith")) bonus += 0.10;
return 1 + bonus;
```

Phase 2 just locks in the function shape; the body stays at `1`.

### Tests (`tests/core/multipliers.test.ts`)

1. `getInspiMultiplier(stubState)` returns 1.
2. `getCanvasGoldMultiplier(stubState)` returns 1.
3. `getPaintTimeMultiplier(stubState)` returns 1.
4. (Documentation test) Comment in test body asserts the `1 + Σ contributions` convention so Phase 3 sees the contract.

### Why `core/` not `store/`

Pure functions of state. No Zustand-specific dependencies. Mirrors `balance.ts`.

---

## 6. `src/store/treeSlice.ts`

### State

```ts
export interface TreeState {
  currentStage: number;                 // 0..TREE_STAGES.length-1; highest stage grown into
  partLevels: Record<string, number>;   // partId -> level; pre-seeded with every part at 0
}

const initialPartLevels: Record<string, number> = Object.fromEntries(
  TREE_STAGES.flatMap((s) => s.parts.map((p) => [p.id, 0])),
);

export const initialTreeState: TreeState = {
  currentStage: 0,
  partLevels: initialPartLevels,
};
```

`partLevels` is pre-seeded. `noUncheckedIndexedAccess` still requires `?? 0` at read sites (TS doesn't know the seeding is exhaustive); at runtime no key is ever missing.

### Actions

```ts
export interface TreeSlice extends TreeState {
  buyPartLevel: (partId: string) => boolean;
  growSapling: () => boolean;
  treeTick: (deltaSeconds: number) => void;
  resetTree: () => void;
}
```

#### `buyPartLevel(partId)` — atomic

1. Look up part config in `TREE_STAGES`. Return `false` if unknown ID.
2. Find part's stage index. Return `false` if `stageIdx > state.currentStage` (locked stage).
3. Compute `treePartCost(currentLevel, baseCost)`. Call `state.spend('gold', cost)` (atomic via existing currencySlice contract).
4. Return `false` if `spend` returned `false`.
5. On success: `set({ partLevels: { ...s.partLevels, [partId]: currentLevel + 1 } })`. Return `true`.

#### `growSapling()` — free, gated

1. If `canGrowSapling(state)` is false → return `false`.
2. `set({ currentStage: state.currentStage + 1 })` → return `true`.

#### `treeTick(deltaSeconds)` — per-frame, no-op when idle

1. Build the producing-parts list: parts where `stageIdx ≤ currentStage` AND `level > 0`.
2. If list is empty → no-op (avoids 60Hz persist writes during the no-levels-yet bootstrap window).
3. Compute `inspiPerSec(parts, getInspiMultiplier(state))` → multiply by `deltaSeconds` → `state.add('inspiration', gain)`.

#### `resetTree()` — for ascend (Phase 3)

`set(initialTreeState)`. Phase 3's `systems/ascend.ts` orchestrator calls this; Phase 2 ships it for symmetry with `currencySlice.resetRunCurrencies` and to make the round-trip / reset tests cohesive.

### Selectors (pure, exported alongside the slice)

```ts
export const getTotalLevelsInStage = (state: GameStore, stageIdx: number): number => {
  const stage = TREE_STAGES[stageIdx];
  if (!stage) return 0;
  return stage.parts.reduce((sum, p) => sum + (state.partLevels[p.id] ?? 0), 0);
};

export const canGrowSapling = (state: GameStore): boolean => {
  const next = state.currentStage + 1;
  if (next >= TREE_STAGES.length) return false;
  return getTotalLevelsInStage(state, state.currentStage) >= TREE_STAGES[next]!.unlockThreshold;
};

export const getProducingParts = (state: GameStore): ReadonlyArray<{ level: number; rate: number }> => {
  // Flat list across all stages where stageIdx ≤ currentStage AND level > 0.
};
```

Selectors are pure functions over `GameStore`, callable from anywhere. Not slice methods — keeps tests simple.

### Tests (`tests/store/treeSlice.test.ts`)

1. Initial state: `currentStage = 0`, every configured part at `level = 0`.
2. `buyPartLevel("spark")` with `gold = 10` succeeds; level becomes 1, gold becomes 0.
3. `buyPartLevel("spark")` with `gold = 9` fails; nothing changes (atomic).
4. `buyPartLevel("leaf")` with `currentStage = 0` returns `false` (stage 1 part is locked).
5. `buyPartLevel("nonexistent")` returns `false`.
6. After 10 successful `buyPartLevel("spark")`, `getTotalLevelsInStage(state, 0) === 10`.
7. Cost scaling: 11th buy attempt costs `10 * 1.15^10 ≈ 40.46` — use `toBeCloseTo` (Phase 0+1 lesson #1).
8. `canGrowSapling` returns `false` at total stage-0 levels = 9, `true` at 10.
9. `growSapling()` with `canGrowSapling = false` returns `false`; `currentStage` unchanged.
10. `growSapling()` with threshold met: `currentStage` becomes 1; stage-1 parts now buyable.
11. After advancing to stage 1, stage-0 parts still buyable (D5).
12. `growSapling()` at `currentStage = TREE_STAGES.length - 1` returns `false` (already at top).
13. `treeTick(1)` with no levels → inspiration unchanged (no-op path).
14. `treeTick(1)` with `spark` at level 5 → inspiration credited `0.5` (`5 * 0.1 * 1`).
15. `treeTick(1)` with `currentStage = 2` and levels in all 6 parts → inspiration credited from all of them, asserting cross-stage cumulative accrual.
16. `resetTree()` returns state to `initialTreeState`.

### Decisions

- **No "buy 10 levels at once" action.** Single-level only; bulk buys are a Phase 4+ UI sugar concern and can layer over `buyPartLevel`.
- **`buyPartLevel` returns `boolean`** matching `currencySlice.spend`'s contract.
- **`treeTick` no-ops when rate is zero.**
- **Selectors live in `treeSlice.ts`** for now. Move to `treeSelectors.ts` only if Phase 4 grows the surface meaningfully.

---

## 7. `src/store/canvasSlice.ts`

### State

```ts
export interface CanvasState {
  canvasProgress: number;   // seconds painted; 0 ≤ value < effectivePaintTime
}

export const initialCanvasState: CanvasState = { canvasProgress: 0 };
```

No state machine. The canvas is always painting; the only state is "how far along."

### Actions

```ts
export interface CanvasSlice extends CanvasState {
  canvasTick: (deltaSeconds: number) => void;
  resetCanvas: () => void;
}
```

#### `canvasTick(deltaSeconds)` — the math

```ts
canvasTick: (delta) => {
  const state = get();
  const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(state); // 10s in Phase 2
  const newProgress = state.canvasProgress + delta;

  if (newProgress < paintTime) {
    set({ canvasProgress: newProgress });
    return;
  }

  // Threshold crossed — exactly one sale per tick.
  const gain = canvasGold(getCanvasGoldMultiplier(state));
  state.add('gold', gain);
  const leftover = newProgress - paintTime;
  set({ canvasProgress: leftover < paintTime ? leftover : 0 });
}
```

**Why "carry leftover when small, drop when synthetic-huge":**
- `tickLoop.ts:8` caps `delta` at 1.0s (`MAX_FRAME_DELTA_SECONDS`). With `paintTime = 10s`, leftover is always `< 1s ≪ paintTime` in normal play; carry is harmless.
- Carrying recovers partial-frame loss that strict reset would accumulate (~30-60s lost per hour at 60Hz).
- The `leftover < paintTime ? leftover : 0` clause is the §14 safety net: a synthetic test with `delta = 5 * paintTime` triggers exactly one sale and clamps progress to 0.

#### `resetCanvas()` — for ascend (Phase 3)

`set(initialCanvasState)`. Same pattern as `resetTree`.

### Persistence behavior

`canvasProgress` is a JS number — flows through `serializeBigs` (no-op for primitives). On reload, the player resumes mid-paint. Aligns with PORT_PLAN.md §5.8's "no offline catch-up" rule (the *progress* is preserved but no extra time is credited for the gap).

### Tests (`tests/store/canvasSlice.test.ts`)

1. Initial state: `canvasProgress = 0`.
2. `canvasTick(5)` → progress = 5, gold unchanged.
3. `canvasTick(5)` then `canvasTick(5)` → first leaves progress=5, second crosses: gold +10, progress = 0.
4. `canvasTick(10)` (exact threshold) → gold +10, progress = 0.
5. `canvasTick(10.5)` (slight over) → gold +10, progress = 0.5 (carry verified).
6. `canvasTick(50)` (5× threshold, synthetic) → gold +10 (exactly one sale), progress = 0 (huge-leftover safety clamp).
7. `canvasTick(0)` → no sale, no progress change, no gold.
8. `resetCanvas()` → progress = 0.
9. With `getCanvasGoldMultiplier` returning 1 in Phase 2, sale credits exactly `CANVAS_GOLD_BASE = 10`.

### Decisions

- **No `startPainting()` action.** Auto-restart from v1.0 means the canvas never sits idle.
- **No `state` enum.** A single number is the simplest representation; UI in Phase 4 reads `canvasProgress / paintTime` for the progress bar.
- **`canvasProgress` is JS `number`, not `Big`.** Bounded by `paintTime`.
- **`resetCanvas` ships in Phase 2** for symmetry with `resetTree`/`resetRunCurrencies`.

---

## 8. `tickAll` orchestration in `src/store/index.ts`

### Inline definition

```ts
import { createTreeSlice, type TreeSlice } from "./treeSlice";
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";

export interface GameTick {
  tickAll: (deltaSeconds: number) => void;
}

export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & GameTick;

export const useGameStore = create<GameStore>()(
  persist(
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
    { /* unchanged persist config except: storage uses persistedAdapter (see §10) */ }
  )
);
```

### Decisions

- **`tickAll` is inlined in the store factory.** No `gameTickSlice.ts` file.
- **Tick order is part of the API contract.** Tree first, canvas second. Pinned by a test using spies (Phase 2 tests on tickAll, case 2). In Phase 2 the order is academic (tree → inspiration, canvas → gold; disjoint effects). Phase 3 forward-compat: a future "tick consumes inspiration" mechanic depends on tree having already credited it.
- **No `pause()`/`resume()` actions on the store.** Visibility-driven pause is owned by `tickLoop.ts` and stays there.

### Tests (`tests/store/tickAll.test.ts`)

1. `tickAll(1)` with seeded tree levels and zero gold → inspiration credited (treeTick fired) AND gold credited if `paintTime` was crossed (canvasTick fired). Both halves observed in one call.
2. **Order test using spies**: stub the slice methods on the live store, call `tickAll(1)`, assert `treeTick` was called before `canvasTick`. Pin order for Phase 3 forward-compat.
3. `tickAll(0)` is valid (idle frame); both inspiration and gold unchanged.

---

## 9. `src/main.tsx` wiring

### Bootstrap effect for tickLoop

```tsx
import { startTickLoop, stopTickLoop } from "@/core/tickLoop";

function Bootstrap(): JSX.Element {
  const [hydrated, setHydrated] = useState<boolean>(useGameStore.persist.hasHydrated());

  // Existing hydration effect
  useEffect(() => {
    if (hydrated) return;
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  // NEW: start tick loop after hydration
  useEffect(() => {
    if (!hydrated) return;
    startTickLoop((delta) => useGameStore.getState().tickAll(delta));
    return () => stopTickLoop();
  }, [hydrated]);

  if (!hydrated) return <LoadingScreen />;
  return <App />;
}
```

### Flush adapter on hide/unload (see §10)

A second new effect attaches `visibilitychange`/`beforeunload` listeners that call `persistedAdapter.flush()`. Defined in §10 alongside the throttle wrapper.

### Decisions

- **Separate effects for hydration and tickLoop** (rather than one fused effect). Each effect has one purpose; greppable.
- **StrictMode double-mount safe.** `tickLoop.ts:27` already guards with `if (_running) return;`. The cleanup between mount calls cancels the RAF. Net: one loop running in dev (StrictMode) and prod.
- **Bootstrap starts loop only after hydration**, so first tick sees persisted state, not the in-memory defaults flash.

### Verification

`main.tsx` is **not unit-tested**. Phase 2 verification = `npm run dev` smoke:
- gold and inspiration displays update over time
- refreshing the page preserves all state (including `canvasProgress` mid-paint)
- closing and reopening the tab resumes cleanly

---

## 10. Throttled persistence (`src/systems/persistence.ts` + wiring)

### The problem

Zustand `persist` writes to storage on every `set()`. Phase 2 introduces tick-driven `set()` calls:
- `treeTick` does 1 `set` (via `add('inspiration', ...)`).
- `canvasTick` does 1 `set` always (`canvasProgress` updates every frame), plus 1 more on sale frames.

At 60Hz that's ~120 `set()` calls/sec, each triggering `partialize` + `JSON.stringify` + IDB transaction. CPU cost ~30-60ms/sec on serialize alone (~3-6% of one core); IDB cost ~120 transactions/sec; ~1-2 GB written per hour over a 1-3 hour playthrough.

### The wrapper

```ts
// src/systems/persistence.ts (additions)
export function throttledAdapter(
  base: SaveAdapter,
  intervalMs: number,
): SaveAdapter & { flush: () => Promise<void> } {
  let pending: { key: string; value: string } | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (!pending) return;
    const p = pending; pending = null;
    await base.setItem(p.key, p.value);
  };

  return {
    getItem: base.getItem,
    removeItem: base.removeItem,
    setItem: async (key, value) => {
      pending = { key, value };
      if (!timerId) timerId = setTimeout(() => { void flush(); }, intervalMs);
    },
    flush,
  };
}

export const persistedAdapter = throttledAdapter(idbAdapter, 1000);
```

### Wiring

- `store/index.ts` swaps `idbAdapter` → `persistedAdapter` in the `createJSONStorage(() => persistedAdapter, ...)` call.
- `main.tsx` adds a third effect:
  ```tsx
  useEffect(() => {
    if (!hydrated) return;
    const onHide = () => { void persistedAdapter.flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [hydrated]);
  ```

### Caveat (acknowledged in spec, not addressed in Phase 2)

The throttle bounds **IDB writes**, not the per-`set()` `partialize` + `JSON.stringify` work. Zustand `persist` doesn't expose a hook to skip those. CPU cost ~30-60ms/sec on serialize remains. If profiling in Phase 6 shows this is meaningful, the fix is a custom `subscribe`-based persist replacement — much larger scope, outside Phase 2.

### Tests (`tests/systems/persistence.test.ts`, +6 cases)

1. `throttledAdapter` with 100ms window: 5 rapid `setItem` calls within 50ms result in **1** call to base after window elapses.
2. The flushed value is the **latest** of the 5 (latest-wins).
3. `flush()` writes pending immediately and clears the pending state.
4. `flush()` with no pending is a no-op (no error).
5. Re-arming: after flush, a new `setItem` starts a fresh window.
6. `getItem`/`removeItem` are pass-through (not throttled).

---

## 11. Persistence integration test extension

### File

`tests/store/persistence-integration.test.ts` (extends existing).

### New case (1 test)

**Round-trip: tree + canvas state survives reload.**

1. Seed a fresh store: `partLevels = { spark: 5, bud: 3, leaf: 2 }`, `currentStage = 1`, `canvasProgress = 5.5`, plus existing currency state.
2. Trigger persist (call `flush()` on the throttled adapter).
3. Create a fresh store instance reading from the same IDB key.
4. Wait for hydration.
5. Assert: `partLevels`, `currentStage`, `canvasProgress` all match the seeded values.

This validates that the new fields flow through the existing `serializeBigs` walker correctly (they're plain JS values, so the walker is a no-op — but the test guards against future regressions).

---

## 12. Phase 0+1 lessons baked into the spec

The plan reviewer must enforce these against the writing-plans output:

### Lesson #1 — `Big.pow` is not bit-exact

`break_eternity.js`'s `Big.pow(integer)` uses log-domain math; results are close-but-not-equal to the integer-arithmetic answer. Tests asserting Big-derived values must use `toBeCloseTo`, not `toBe`.

**Phase 2 application**: Test #7 in `treeSlice.test.ts` (cost at level 10) and any test asserting `inspiPerSec` results that flow through `Big.pow` paths.

### Lesson #2 — `serializeBigs` walker is recursive and automatic

The Phase 0+1 fix wrapped `partialize` to pre-serialize Bigs as `{ __big: "..." }` markers BEFORE `JSON.stringify` runs. The walker is recursive: it handles primitives, arrays, and plain objects.

**Phase 2 application**: New persisted fields are JS primitives, so the walker is a no-op for them. **No partialize change is required.** The persistence-integration test verifies this stays true.

### Lesson #3 — Test name must equal test contract

A test named `"returns 0 when X"` must actually return 0. Phase 0+1 had a test named `"returns 0 when inspi is below 10"` whose formula returned 9 at n=9 — a name/body mismatch that the plan reviewer missed.

**Phase 2 application**: The plan must include a self-review step: each `it("...")` description must accurately describe what the test body asserts. Examples to watch:
- `it("returns 0 inspi/sec when no parts have levels")` — must actually short-circuit and return 0; assert `inspiration` is unchanged.
- `it("credits exactly one sale when delta is 5x paint time")` — must NOT also assert progress=0 in the same test (that's a separate clause; separate test).
- `it("canGrowSapling returns true at exact threshold (totalLevels === 10)")` — assert at exactly 10, not at 11; that's a separate test.

---

## 13. Test budget summary

| File | New/Extend | Tests | Ref |
|---|---|---|---|
| `tests/core/multipliers.test.ts` | new | 4 | §5 |
| `tests/config/treeStages.test.ts` | new | 5 | §4 |
| `tests/store/treeSlice.test.ts` | new | 16 | §6 |
| `tests/store/canvasSlice.test.ts` | new | 9 | §7 |
| `tests/store/tickAll.test.ts` | new | 3 | §8 |
| `tests/systems/persistence.test.ts` | extend | +6 | §10 |
| `tests/store/persistence-integration.test.ts` | extend | +1 | §11 |
| **Phase 2 total** | | **~44** | |

Existing test count post-Phase-0+1: 84. Post-Phase-2: ~128.

PORT_PLAN.md §6 budgeted Phase 2 at ~30 tests. Over-budget because:
- The throttle wrapper (D8 / §10) is a Phase 2 addition not in the original §6 tally.
- treeSlice has more cases than anticipated due to stage advancement branching.

The grand v1.0 total still tracks PORT_PLAN.md §6's ballpark.

---

## 14. Implementation task order (input to writing-plans)

The writing-plans phase will decompose this spec into per-task TDD steps. The expected order:

1. **`multipliers.ts`** — 4 tests + impl. First because it's the simplest unblocker.
2. **`treeStages.ts`** — 5 tests + data. Pure data, no logic.
3. **`treeSlice.ts`** — TDD per action: `buyPartLevel` → `growSapling` → `treeTick` → `resetTree`. Selectors as helpers. ~16 tests across the steps.
4. **`canvasSlice.ts`** — TDD: `canvasTick` (with carry math + safety clamp) → `resetCanvas`. ~9 tests.
5. **`tickAll`** in `store/index.ts` — wire tree+canvas slices into GameStore, add inline `tickAll`, 3 tests including order spy.
6. **`throttledAdapter`** in `systems/persistence.ts` — 6 tests + impl + `persistedAdapter` export. Swap into `store/index.ts`.
7. **`main.tsx` wiring** — start/stop tickLoop after hydration; flush adapter on hide/unload. No unit test; manual smoke.
8. **`persistence-integration.test.ts` extension** — 1 round-trip test for tree+canvas state. Validates the whole loop end-to-end.

Each step is one Plan-driven commit (`test:` first, then `feat:`/`store:`/`config:`/`refactor:` per CLAUDE.md commit conventions).

---

## 15. Definition of done — Phase 2

1. All test files in §13 implemented; full Vitest suite green (~128 tests).
2. `tsc --noEmit` clean.
3. ESLint clean (the existing `react-refresh/only-export-components` warning on `main.tsx:9` is acceptable per HANDOVER.md known-low-priority issues).
4. `npm run dev` smoke: gold ticks up over time; inspiration ticks up after buying a tree level; refreshing preserves all state including `canvasProgress` mid-paint.
5. The throttledAdapter + flush pipeline verified manually: open DevTools → Application → IndexedDB → observe writes are throttled (not 60Hz).
6. A new HANDOVER.md snapshot for Phase 3 to start from.

---

## 16. Out of scope (explicit reminders)

- **No UI**. The visible app remains the same as Phase 0+1's playerId stub.
- **No Workshop, Ascend, Skill Tree** — Phase 3.
- **No hover-info wiring** — Phase 5.
- **No motion / polish** — Phase 6.
- **No balance pass** — Phase 6. The numbers in `treeStages.ts` are placeholder defaults.
- **No save corruption recovery** — Phase 6 polish per PORT_PLAN.md §5.5.
- **No bulk-buy or "max level" tree actions** — Phase 4+ UI sugar.
- **No audio, achievements, or any deferred wave-roadmap features** — see PORT_PLAN.md §13.

---

## 17. Risks / things to watch

- **Throttle flush on `beforeunload` is async** — browsers don't wait for async handlers reliably. The `visibilitychange` listener (which fires *before* `beforeunload` in modern browsers) is the primary save-on-close mechanism; `beforeunload` is the belt-and-braces fallback. Verified by tests #1-3 in the throttle suite.
- **Tick order coupling** — Phase 2 tests pin tree-before-canvas. If a future phase needs canvas-before-tree (none anticipated), it'll need to update both the orchestrator and the order test in lockstep.
- **`canvasProgress` in IDB** — persisted as a plain number. If a player time-travels their system clock or the OS sleeps for hours, the persisted progress is fine because v1 has no offline catch-up: the next tick after wake credits at most 1s of progress (the `MAX_FRAME_DELTA_SECONDS` cap).
- **`partLevels` shape evolution** — If a future wave renames a part (e.g., `spark` → `seedling`), the migrate chain must handle it; otherwise level data is silently lost. Phase 2 doesn't introduce this risk (no renames), but the spec flags it for future-wave plans.
- **Test flakiness on timer-based throttle tests** — use Vitest fake timers (`vi.useFakeTimers()`) for the throttle tests rather than real `setTimeout`, to avoid CI flake.

---

## 18. References

- `docs/PORT_PLAN.md` — overall v1.0 spec, especially §1 (v1 systems), §5.8 (tickLoop), §5.12 (formulas), §6 (testing), §7 (Phase 2).
- `docs/HANDOVER.md` — Phase 0+1 lessons (1, 2, 3) — incorporated into §12.
- `docs/superpowers/plans/2026-05-01-artdle-web-phase0-1.md` — predecessor plan (executed).
- `src/core/balance.ts` — existing formulas (`treePartCost`, `canvasGold`, `inspiPerSec`, `PAINT_TIME_BASE_SECONDS`).
- `src/core/tickLoop.ts` — existing RAF loop (no changes in Phase 2).
- `src/store/index.ts` — existing combined store + recursive `serializeBigs` walker.

---

This spec supersedes nothing; it extends Phase 0+1's foundation. The writing-plans phase will produce `docs/superpowers/plans/2026-05-01-artdle-web-phase2.md` with per-task TDD decomposition.
