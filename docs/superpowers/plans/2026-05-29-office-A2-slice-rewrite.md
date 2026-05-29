# Office Redesign — Phase A2: Office-Slice Rewrite + Remove Old Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old hire/queue/Office-Level worker subsystem with the redesigned autonomous-painter `Worker` data model (5-stat sheet from Phase A1), spawned to fill fame-tree roster slots, and rip out every old additive worker contribution. End state: **workers exist as persistent data but contribute NOTHING to the canvas yet** (Phase B wires them into the tick).

**Architecture:** The office becomes a pure `{ roster: Worker[] }` slice. A `Worker` is `{ id, classId, level, xp, stats: WorkerStats, mastery, strokesThisRun }`. Slots are unlocked by the existing `roster_slot` fame capability; a `reconcileRoster()` action spawns fresh level-1 workers up to `getRosterCap(state)` (spawn-only, never despawn). Spawning is triggered from exactly two call sites — the Bootstrap rehydration gate and after a successful `buyNode` — so there is one source of truth. The old queue/trickle, hire cost, Office Level, candidate roll, class config, and every additive worker affix contribution are deleted.

**Tech Stack:** TypeScript (strict), Zustand 5 (slice + persist), `break_eternity.js` (`Big`), `uuid` (worker IDs — already a dep, see `src/core/playerId.ts`), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md` (§2.1 stats, §5 acquisition, §7 persistence, §10 engine surface, §11 save migration).

**Builds on Phase A1:** `src/core/workerModel.ts` (`WorkerStats`, `createBaseStats`, `applyStatLevelUp`) and `src/core/balance.ts` worker constants already exist. This phase consumes `createBaseStats()`; it does NOT touch the roll engine.

---

## Green bar (the target for every task)

The pass criteria are **`npx vitest run` fully green** and **`npx vite build` clean** (esbuild resolves all imports). They are NOT `tsc` clean: per `docs/HANDOVER.md` the branch carries ~22 pre-existing baseline `tsc` errors (officeSlice, statsSlice, StatsRoom cast, etc.). Do not chase those baseline errors, but do not ADD any import-resolution breakage (a dangling import fails `vite build`).

**Scope guard — what this phase does NOT do (later phases):**
- Phase B: multi-painter canvas tick, `workerGoldFactor`, per-worker crit/combo, `strokesThisRun` accumulation. (A2 adds the `strokesThisRun` *field*, initialized to 0, but nothing increments it.)
- Phase C: ascend-XP pool, level-up pass, `resetOffice()` → run-contribution rename in `ascend.ts`, skill-node migration/refund (`queue_slot`/`hire_cost_reduction`/`class_*`), and deleting the now-dead balance functions + multiplier helpers.
- Phase D: real office UI (roll screen, on-canvas avatars, roster management). A2 ships only a **minimal read-only roster panel** so the office tab does not crash.

**Deliberate partial-pull-forward (note for the Phase C author):** A2 repurposes `resetOffice()` to reset only `strokesThisRun` and KEEP the roster (workers persist across ascend). This is a sliver of Phase C's persistence work pulled forward because the old `resetOffice` body referenced fields being deleted here. Phase C should NOT re-implement worker persistence; it only renames the ascend call site and adds the XP pass.

**Dead-but-kept (do NOT delete in A2 — Phase C owns them with the node migration):**
- `getWorkerXpMultiplier`, `getHireCostMultiplier` in `multipliers.ts`.
- `hireCost`, `trickleSeconds`, `computeOfficeTierProbabilities`, `officeXpToNext`, `OFFICE_TIER_UNLOCK_LEVEL`, `OFFICE_TIER_AFFIX_COUNT`, `ALL_WORKER_TIERS`, `WorkerTier`, `XP_GOLD_FRACTION` in `balance.ts` (and their `balance.test.ts` cases stay green — the functions still exist).
- The `officeWorkersHired` lifetime stat (nothing increments it after the hire action is gone; the achievement just won't fire — Phase C/D repurposes it).

---

## File structure

**Rewrite:**
- `src/store/officeSlice.ts` — new `Worker` + `OfficeState { roster }`; actions `reconcileRoster`, `resetOffice`; factory `createWorker`; selector `getRosterCap` kept. Everything else deleted.
- `src/components/painting/OfficeRoom.tsx` — minimal read-only roster panel (self-contained; imports none of the old office UI).

**Edit (remove old worker wiring):**
- `src/core/multipliers.ts` — delete `getOfficeContribution`; remove worker branch from `getCritChunks`; remove office contributions from gold/speed/combo; remove `roster` from `CanvasMultiplierInputs`.
- `src/components/painting/StatsRoom.tsx` — delete `critChunksFromWorkers`, the two "Workers" breakdown lines, and the `roster` selector/helper-state field.
- `src/routes/PaintingRoute.tsx` — drop `roster` from the `helperState`.
- `src/core/pureMutations.ts` — delete `awardOfficeXpPure` + its now-dead imports.
- `src/core/canvasTickPure.ts` — drop the `awardOfficeXpPure` import + call.
- `src/store/canvasSlice.ts` — drop `roster`/`officeXp`/`officeLevel` from the `canvasTick` set().
- `src/systems/catchup.ts` — drop the `officeTickPure` import + call.
- `src/systems/catchupClone.ts` — drop `queue`; deep-copy `roster` with the new shape.
- `src/store/index.ts` — remove `s.tickOffice(...)` from `tickAll`; add migration `v26 → v27`; bump `SAVE_VERSION` to `27`.
- `src/store/skillTreeSlice.ts` — call `get().reconcileRoster()` after a successful `buyNode`.
- `src/main.tsx` — call `reconcileRoster()` once post-hydration in the Bootstrap gate.

**Delete:**
- `src/core/officeTickPure.ts` + `tests/core/officeTickPure.test.ts`
- `src/core/officeRoll.ts` + `tests/core/officeRoll.test.ts`
- `src/config/officeClasses.ts` + `tests/config/officeClasses.test.ts`
- `src/components/painting/QueueCard.tsx`, `FireConfirmModal.tsx`, `OfficeLevelHeader.tsx`, `WorkerCard.tsx` (+ any co-located `.module.css`)
- `tests/store/officeSlice.xp.test.ts`

**Test work:**
- Rewrite `tests/store/officeSlice.test.ts`.
- Adapt `tests/core/multipliers.test.ts`, `tests/core/canvasTickPure.test.ts`, `tests/store/persistence-integration.test.ts`, `tests/store/persistence.test.ts`, `tests/dev/bot-simulation.test.ts`.

---

## Task 1: Worker model + officeSlice rewrite + engine rewiring (atomic core)

This is one coordinated task because the worker schema change and the export deletions break every consumer the instant they land — they cannot be green in smaller independent pieces. Do all steps, then verify the full suite once at the end.

**Files:**
- Rewrite: `src/store/officeSlice.ts`
- Rewrite: `src/components/painting/OfficeRoom.tsx`
- Edit: `src/core/multipliers.ts`, `src/components/painting/StatsRoom.tsx`, `src/routes/PaintingRoute.tsx`, `src/core/pureMutations.ts`, `src/core/canvasTickPure.ts`, `src/store/canvasSlice.ts`, `src/systems/catchup.ts`, `src/systems/catchupClone.ts`, `src/store/index.ts`
- Delete: `src/core/officeTickPure.ts`
- Tests: rewrite `tests/store/officeSlice.test.ts`; delete `tests/core/officeTickPure.test.ts`, `tests/store/officeSlice.xp.test.ts`; adapt `tests/core/multipliers.test.ts`, `tests/core/canvasTickPure.test.ts`, `tests/store/persistence-integration.test.ts`, `tests/store/persistence.test.ts`, `tests/dev/bot-simulation.test.ts`

---

- [ ] **Step 1: Rewrite the officeSlice test to the new model (red)**

Replace the entire contents of `tests/store/officeSlice.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import {
  initialOfficeState,
  getRosterCap,
  createWorker,
  type Worker,
} from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

beforeEach(() => {
  useGameStore.setState({
    roster: [],
    purchasedNodes: {},
  });
});

describe("initialOfficeState", () => {
  it("starts with an empty roster and no legacy office fields", () => {
    expect(initialOfficeState.roster).toEqual([]);
    expect((initialOfficeState as Record<string, unknown>).officeLevel).toBeUndefined();
    expect((initialOfficeState as Record<string, unknown>).queue).toBeUndefined();
    expect((initialOfficeState as Record<string, unknown>).trickleTimer).toBeUndefined();
  });
});

describe("createWorker", () => {
  it("spawns a fresh level-1 worker with base stats and zeroed run/meta fields", () => {
    const w = createWorker();
    expect(w.level).toBe(1);
    expect(w.classId).toBe("base");
    expect(w.xp.eq(big(0))).toBe(true);
    expect(w.mastery).toBe(0);
    expect(w.strokesThisRun).toBe(0);
    expect(w.stats).toEqual(createBaseStats());
    expect(typeof w.id).toBe("string");
    expect(w.id.length).toBeGreaterThan(0);
  });

  it("gives every worker a distinct id", () => {
    const a = createWorker();
    const b = createWorker();
    expect(a.id).not.toBe(b.id);
  });
});

describe("getRosterCap", () => {
  it("returns 0 when no roster_slot nodes are purchased", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getRosterCap(state)).toBe(0);
  });
});

describe("reconcileRoster", () => {
  it("spawns level-1 workers up to the roster cap", () => {
    // hire_manager carries the roster_slot capability (1 slot per level).
    useGameStore.setState({ purchasedNodes: { hire_manager: 2 } });
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(2);
    for (const w of useGameStore.getState().roster) {
      expect(w.level).toBe(1);
      expect(w.stats).toEqual(createBaseStats());
    }
  });

  it("is idempotent — calling twice does not over-spawn", () => {
    useGameStore.setState({ purchasedNodes: { hire_manager: 2 } });
    useGameStore.getState().reconcileRoster();
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(2);
  });

  it("never despawns when the roster already exceeds the cap", () => {
    const existing: Worker[] = [createWorker(), createWorker(), createWorker()];
    useGameStore.setState({ roster: existing, purchasedNodes: { hire_manager: 1 } });
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(3);
  });

  it("does nothing when the cap is 0", () => {
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(0);
  });
});

describe("resetOffice (ascend) — workers persist, run contribution resets", () => {
  it("keeps the roster and its levels/xp but zeroes strokesThisRun", () => {
    const w: Worker = { ...createWorker(), level: 4, xp: big(99), strokesThisRun: 1234 };
    useGameStore.setState({ roster: [w] });
    useGameStore.getState().resetOffice();
    const after = useGameStore.getState().roster;
    expect(after.length).toBe(1);
    expect(after[0]!.level).toBe(4);
    expect(after[0]!.xp.eq(big(99))).toBe(true);
    expect(after[0]!.strokesThisRun).toBe(0);
  });
});
```

> **Note on the `hire_manager` node:** the test relies on the existing `hire_manager` skill node carrying the `roster_slot` capability (confirmed in `tests/dev/bot-simulation.test.ts:95` "hire_manager — +roster slots"). If the executing engineer finds the capability lives on a different node id, use that id — the contract under test is "node with `roster_slot` capability → that many slots".

- [ ] **Step 2: Run the test, verify it FAILS**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: FAIL (`createWorker`/`reconcileRoster` not exported; old fields still present).

- [ ] **Step 3: Rewrite `src/store/officeSlice.ts`**

Replace the entire file with:

```ts
import type { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import { countCapability } from "@/store/skillTreeSlice";
import { createBaseStats, type WorkerStats } from "@/core/workerModel";

/**
 * A redesigned autonomous-painter worker. See
 * docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md §2.1.
 *
 * Workers are persistent data: spawned at level 1 to fill unlocked roster
 * slots, they level up only at ascend (Phase C) and paint the shared canvas
 * (Phase B). In Phase A2 they exist but contribute nothing.
 */
export interface Worker {
  readonly id: string;
  /** Class = stat-roll bias profile (content deferred). "base" = neutral. */
  readonly classId: string;
  readonly level: number;
  /** Accumulated ascend-XP toward the next level (Big — pool scales with run gold). */
  readonly xp: Big;
  /** The five-stat sheet (gold%, speed, crit chance, strokes-per-crit, combo chance). */
  readonly stats: WorkerStats;
  /** Levels gained while assigned to the current class (forward hook; 0 in A2). */
  readonly mastery: number;
  /** Strokes this worker has landed in the current run (Phase B fills this; ascend resets it). */
  readonly strokesThisRun: number;
}

export interface OfficeState {
  readonly roster: ReadonlyArray<Worker>;
}

export const initialOfficeState: OfficeState = Object.freeze({
  roster: Object.freeze([]) as ReadonlyArray<Worker>,
}) as OfficeState;

export interface OfficeSlice extends OfficeState {
  /**
   * Spawn fresh level-1 workers until the roster fills every unlocked slot.
   * Spawn-only (never despawns — caps only grow). Idempotent. Call after a
   * roster_slot purchase and once post-rehydration.
   */
  reconcileRoster: () => void;
  /**
   * Ascend hook. Workers PERSIST across ascend; this resets only per-run
   * contribution (strokesThisRun → 0). Phase C renames this at the ascend
   * call site and adds the XP/level-up pass.
   */
  resetOffice: () => void;
}

/** Max number of workers — sum of fame-node levels carrying the `roster_slot` tag. */
export const getRosterCap = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "roster_slot");

/** Factory: a fresh level-1 worker of the given class (default neutral "base"). */
export const createWorker = (classId = "base"): Worker => ({
  id: uuidv4(),
  classId,
  level: 1,
  xp: big(0),
  stats: createBaseStats(),
  mastery: 0,
  strokesThisRun: 0,
});

export const createOfficeSlice: StateCreator<GameStore, [], [], OfficeSlice> = (set, get) => ({
  ...initialOfficeState,

  reconcileRoster: () => {
    const state = get();
    const cap = getRosterCap(state);
    const missing = cap - state.roster.length;
    if (missing <= 0) return;
    const spawned: Worker[] = [];
    for (let i = 0; i < missing; i++) spawned.push(createWorker());
    set({ roster: [...state.roster, ...spawned] });
  },

  resetOffice: () => {
    set((s) => ({
      roster: s.roster.map((w) => ({ ...w, strokesThisRun: 0 })),
    }));
  },
});
```

- [ ] **Step 4: Delete `src/core/officeTickPure.ts` and its test**

```bash
git rm src/core/officeTickPure.ts tests/core/officeTickPure.test.ts
```

- [ ] **Step 5: Remove the office trickle tick from `catchup.ts`**

In `src/systems/catchup.ts`:
- Delete the import line `import { officeTickPure } from "@/core/officeTickPure";`.
- Delete the line `officeTickPure(draft, step);` inside the batch loop.

- [ ] **Step 6: Remove `awardOfficeXpPure` from `pureMutations.ts`**

In `src/core/pureMutations.ts`:
- Delete the entire `awardOfficeXpPure` function (the last function in the file).
- Delete its now-dead imports at the top:
  - `import { XP_GOLD_FRACTION } from "@/core/balance";`
  - `import { getWorkerXpMultiplier } from "@/core/multipliers";`
  - `import { applyWorkerLevelUps, applyOfficeLevelUps, type Worker } from "@/store/officeSlice";`
- Keep `import { big, type Big } from "@/core/bigNumber";` (still used by `addCurrency`/`spendCurrency`).

- [ ] **Step 7: Drop the `awardOfficeXpPure` call from `canvasTickPure.ts`**

In `src/core/canvasTickPure.ts`:
- In the import block from `@/core/pureMutations`, remove `awardOfficeXpPure,` (keep `addCurrency, trackSaleGoldPure, incrementStatPure, patchRunStatsPure, type DraftState`).
- In `onChunkComplete`, delete the line `awardOfficeXpPure(draft, gain);`.

- [ ] **Step 8: Drop office fields from the `canvasTick` set() in `canvasSlice.ts`**

In `src/store/canvasSlice.ts`, inside `canvasTick`'s returned object, remove these three lines:
```ts
        roster: draft.roster,
        officeXp: draft.officeXp,
        officeLevel: draft.officeLevel,
```

- [ ] **Step 9: Fix the catchup clone for the new shape**

In `src/systems/catchupClone.ts`, replace the two office lines:
```ts
    queue: state.queue.map((c) => ({ ...c, affixes: c.affixes.map((a) => ({ ...a })) })),
    roster: state.roster.map((w) => ({ ...w })),
```
with (drop `queue` entirely — the field no longer exists; deep-copy the worker `stats` object since it's mutable):
```ts
    roster: state.roster.map((w) => ({ ...w, stats: { ...w.stats } })),
```

- [ ] **Step 10: Remove worker contributions from `multipliers.ts`**

In `src/core/multipliers.ts`:

(a) Delete the entire `getOfficeContribution` function (and its doc comment).

(b) In `CanvasMultiplierInputs`, remove the `| "roster"` line from the `Pick<...>`. This makes "workers contribute nothing to canvas math" a structural guarantee — the type can no longer carry the roster into a multiplier.

(c) In `getCanvasGoldMultiplier`, delete:
```ts
  bonus += getOfficeContribution(state, "+sell_price%").toNumber();
```

(d) In `getCanvasSpeedMultiplier`, delete:
```ts
  bonus += getOfficeContribution(state, "+speed%").toNumber();
```

(e) In `getComboBaseChance`, delete:
```ts
  chance += getOfficeContribution(state, "+combo_chance%").toNumber();
```

(f) In `getCritChunks`, delete the worker branch (the `for (const worker of state.roster) { ... }` loop and its preceding `// Worker branch unchanged ...` comment), leaving only the items contribution and the final `return Math.max(0, Math.floor(chunks));`.

(g) Remove the now-unused `levelScale` and `AffixKind` from the imports if nothing else in the file uses them. (Check first: `grep` the file for `levelScale` / `AffixKind` after the edits. `SlotKind` is still used by `getCritChunks`; keep it.)

(h) Update the file's top-of-file doc comment block (lines 1-9) that describes `getOfficeContribution` saturation — it's no longer accurate. Replace it with a one-line note:
```ts
/**
 * Canvas multipliers return JS `number`. Workers no longer feed these
 * (the redesigned Office contributes via the canvas tick in Phase B), so the
 * roster is intentionally absent from CanvasMultiplierInputs.
 */
```

- [ ] **Step 11: Remove worker lines from `StatsRoom.tsx`**

In `src/components/painting/StatsRoom.tsx`:
- Remove `getOfficeContribution,` from the `@/core/multipliers` import.
- Remove `levelScale,` from the `@/core/balance` import.
- Delete the entire `critChunksFromWorkers` function (lines ~88-98).
- In `statBlocks`, delete `const chunksWorkers = critChunksFromWorkers(state);` and change `chunksTotal` to drop `chunksWorkers`:
```ts
  const chunksTotal = TRIGGER_CHUNK + BASE_CRIT_CHUNKS + chunksItems;
```
- In the "Sell Price (gold)" block `lines`, delete `{ source: "Workers", value: getOfficeContribution(state, "+sell_price%").toNumber() },`.
- In the "Speed" block `lines`, delete `{ source: "Workers", value: getOfficeContribution(state, "+speed%").toNumber() },`.
- In the "Combo chance" block `lines`, delete `{ source: "Workers", value: getOfficeContribution(state, "+combo_chance%").toNumber() },`.
- In the "Strokes per crit" block `lines`, delete `{ source: "Workers", value: chunksWorkers },`.
- Delete the `const roster = useGameStore((s) => s.roster);` selector.
- In the `helperState` object inside `useMemo`, remove `roster,`.
- Remove `roster` from that `useMemo` dependency array.

- [ ] **Step 12: Remove `roster` from `PaintingRoute.tsx` helper state**

In `src/routes/PaintingRoute.tsx`:
- Delete the `const roster = useGameStore((s) => s.roster);` selector (line ~40).
- In the `helperState` object, remove `roster,` from the line `equipped, purchasedNodes, roster, canvasTier,`.

- [ ] **Step 13: Minimal read-only OfficeRoom**

Replace the entire contents of `src/components/painting/OfficeRoom.tsx` with a self-contained read-only panel (imports none of the old office UI — those files get deleted in Task 2):

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getRosterCap } from "@/store/officeSlice";
import styles from "./OfficeRoom.module.css";

/**
 * Minimal Phase-A2 office panel: a read-only roster list. The full office UI
 * (post-ascend roll screen, on-canvas avatars, class management) lands in
 * Phase D. Workers contribute nothing to the canvas yet (Phase B).
 */
export function OfficeRoom(): JSX.Element {
  const roster = useGameStore((s) => s.roster);
  const rosterCap = useGameStore(getRosterCap);

  return (
    <section className={styles.room} aria-label="Painter's Office">
      <section className={styles.section}>
        <div className={styles.subhead}>
          Roster <span className={styles.count}>{roster.length} / {rosterCap}</span>
        </div>
        {roster.length === 0 ? (
          <div className={styles.empty}>No painters yet — unlock a roster slot in the skill tree.</div>
        ) : (
          <ul className={styles.cardList}>
            {roster.map((w) => (
              <li key={w.id} className={styles.empty}>
                Painter · Level {w.level} · {w.classId}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
```

> The class names (`room`, `section`, `subhead`, `count`, `empty`, `cardList`) already exist in `OfficeRoom.module.css` — reuse them; do not delete the CSS module.

- [ ] **Step 14: Remove `tickOffice` from the orchestrator and add the v27 migration**

In `src/store/index.ts`:

(a) In `tickAll`, delete the line `s.tickOffice(deltaSeconds);`.

(b) Bump the version constant: `const SAVE_VERSION = 27;`

(c) Add a new migration block immediately before `return state as unknown as GameStore;` (after the `fromVersion < 26` block):
```ts
  if (fromVersion < 27) {
    // v26 → v27 (2026-05-29): Painter's Office autonomous-painter redesign (A2).
    // The old worker schema (class/tier/affixes) + Office Level/queue/trickle are
    // gone. Drop every old office field and reset the roster to empty;
    // reconcileRoster() (run post-hydration and after buyNode) spawns fresh
    // level-1 workers for each currently-unlocked roster_slot. Worker XP/level
    // and skill-node refunds are handled in Phase C.
    const {
      officeLevel: _ol, officeXp: _ox, queue: _q, trickleTimer: _tt, ...rest
    } = state;
    void _ol; void _ox; void _q; void _tt;
    state = { ...rest, roster: [] };
  }
```

(d) Update the migration-chain doc comment near the top (the `v12 → v13` paragraph already documents the office launch; append a `v26 → v27` note in the same block of paragraphs for future readers):
```
 * v26 → v27 (2026-05-29): Painter's Office autonomous-painter redesign.
 * Drop officeLevel/officeXp/queue/trickleTimer and reset roster to []; the
 * new roster is repopulated by reconcileRoster() at runtime.
```

- [ ] **Step 15: Adapt the engine tests that referenced the old shape**

(a) Delete the obsolete XP test:
```bash
git rm tests/store/officeSlice.xp.test.ts
```

(b) `tests/core/canvasTickPure.test.ts` — the shared draft helper sets old office fields. Remove `officeXp: big(0), officeLevel: 1,` and change `roster: [] as DraftState["roster"],` to keep an empty roster (the new `DraftState["roster"]` is `Worker[]`, so `[]` is still valid — no other change needed). Remove any assertion that office XP/level changed on sale (there are none expected; if present, delete them).

(c) `tests/core/multipliers.test.ts` — delete every test that imports or exercises `getOfficeContribution`, and any case asserting a worker's affixes contribute to gold/speed/combo/crit-chunks. Delete `roster` from any `CanvasMultiplierInputs`-shaped fixture (the field is no longer in the type). Keep the items/skill-tree/school/achievement cases.

(d) `tests/store/persistence.test.ts` — delete the test `"strips +size% from worker affixes in roster"` (lines ~84-100): workers no longer have affixes, and v27 wipes the roster, so the assertion is obsolete. Leave the equipped/inventory `+size%` strip tests and the idempotent-empty-save test untouched.

(e) `tests/store/persistence-integration.test.ts` — find the fixture setting `officeLevel: 0, officeXp: big(0), queue: [], roster: [], trickleTimer: 0,` (around line 600) and replace it with just `roster: [],`. If any assertion checks post-migration `officeLevel`/`queue`/`trickleTimer`, replace it with an assertion that those fields are absent and `roster` is `[]` after migrating an old save through v27.

(f) `tests/dev/bot-simulation.test.ts` — remove the `getHireCost` import and the entire hire block (the `if (state.roster.length >= cap) return; ... hireFromQueue(...)` logic around lines 255-265). The bot no longer hires; if the bot needs workers present, call `useGameStore.getState().reconcileRoster()` once after purchasing roster_slot nodes instead. Keep `getRosterCap` if still used; drop it if not. (It also calls `resetOffice()` at ~line 278 and `performAscend()` at ~331 — both still valid; `resetOffice` now keeps the roster, which is correct for a bot that paints across ascends.)

(g) **CRITICAL — fix direction on any ascend assertion.** `resetOffice()` now KEEPS the roster by design (workers persist; only `strokesThisRun` resets). The only test that asserted "ascend wipes the roster" is the old `tests/store/officeSlice.test.ts` block, which Step 1 already fully replaced with the inverted contract (roster persists, `strokesThisRun → 0`). `tests/systems/ascend.test.ts` does NOT assert anything about the roster (verified: it checks gold/inspiration/fame/tree/canvas/workshop/purchasedNodes/playerId only) — leave it alone. **If Step 16 surfaces any stale "roster empty after ascend" assertion, invert it to "roster persists" — do NOT re-add roster-clearing to `resetOffice` to make a stale test pass. That would silently kill the worker persistence that is the entire point of A2.**

(h) `tests/components/painting/BoundCanvasStage.test.tsx` — verified inert: it only calls `useGameStore.getState().resetOffice()` (still a valid action) and builds no `CanvasMultiplierInputs` literal carrying `roster`. No edit expected; if Step 16 shows a failure here, it means a roster fixture slipped in — drop the `roster` field.

- [ ] **Step 16: Run the full suite, verify green**

Run: `npx vitest run`
Expected: PASS (0 failures). Fix any remaining office-shape fallout the same way (drop old fields / drop `.affixes` reads / use `createWorker`).

- [ ] **Step 17: Verify the build resolves**

Run: `npx vite build`
Expected: clean build (no unresolved imports).

- [ ] **Step 18: Commit**

```bash
git add -A
git commit -m "core(office): rewrite officeSlice to autonomous-painter model; remove old worker wiring"
```

---

## Task 2: Delete orphaned office code (roll, classes, old UI)

After Task 1, the candidate-roll engine, the class config, and the old office UI components are imported by nothing in the reachable module graph (the new `OfficeRoom` is self-contained). This task removes them and their tests. Pure deletion — no behavior change.

**Files:**
- Delete: `src/core/officeRoll.ts`, `src/config/officeClasses.ts`, `src/components/painting/QueueCard.tsx`, `src/components/painting/FireConfirmModal.tsx`, `src/components/painting/OfficeLevelHeader.tsx`, `src/components/painting/WorkerCard.tsx` (+ any co-located `.module.css` for these four)
- Delete: `tests/core/officeRoll.test.ts`, `tests/config/officeClasses.test.ts`

---

- [ ] **Step 1: Confirm there are no remaining importers**

Run a search for each symbol/file before deleting. None of these should return a hit in `src/` outside the files being deleted:

Run: `npx vitest run` is not the check here — use Grep/ripgrep:
```
rg -n "officeRoll|officeClasses|QueueCard|FireConfirmModal|OfficeLevelHeader|WorkerCard" src
```
Expected: hits ONLY inside the files listed for deletion (and the dev skill-designer's free-text capability list in `src/dev/skill-designer/NodeForm.tsx`, which lists `"class_goldsmith"`/`"class_speedrunner"`/`"queue_slot"` as authoring strings — those are plain string literals, not imports, and stay for now; Phase C handles the node migration).

If any real importer remains, stop and fix it (it means a Task 1 edit was incomplete).

- [ ] **Step 2: Delete the files**

```bash
git rm src/core/officeRoll.ts tests/core/officeRoll.test.ts
git rm src/config/officeClasses.ts tests/config/officeClasses.test.ts
git rm src/components/painting/QueueCard.tsx src/components/painting/FireConfirmModal.tsx src/components/painting/OfficeLevelHeader.tsx src/components/painting/WorkerCard.tsx
```
Then delete any co-located CSS modules that existed only for those four components:
```
rg --files src/components/painting | rg "QueueCard|FireConfirmModal|OfficeLevelHeader|WorkerCard"
```
`git rm` any `*.module.css` that match (but NOT `OfficeRoom.module.css` — the new OfficeRoom still uses it).

- [ ] **Step 3: Run the full suite, verify green**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Verify the build resolves**

Run: `npx vite build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(office): delete orphaned roll/class config + old office UI"
```

---

## Task 3: Spawn wiring (buyNode + Bootstrap) + integration coverage

Wire `reconcileRoster()` into its two trigger points so unlocked slots actually materialize workers, and add integration coverage for the load→spawn and ascend→persist flows.

**Files:**
- Edit: `src/store/skillTreeSlice.ts`, `src/main.tsx`
- Test: `tests/store/officeSlice.test.ts` (append integration cases)

---

- [ ] **Step 1: Add the buyNode-spawn integration test (red)**

Append to `tests/store/officeSlice.test.ts`:

```ts
describe("buying a roster_slot node spawns a worker", () => {
  it("reconciles the roster after a successful purchase", () => {
    // Give enough fame and the prerequisite tree so hire_manager is buyable.
    // (Use devFreeNodes to bypass cost/prereq plumbing for this unit check.)
    useGameStore.setState({ roster: [], purchasedNodes: {}, devFreeNodes: true });
    const ok = useGameStore.getState().buyNode("hire_manager");
    expect(ok).toBe(true);
    expect(useGameStore.getState().roster.length).toBe(getRosterCap(useGameStore.getState()));
    expect(useGameStore.getState().roster.length).toBeGreaterThan(0);
    useGameStore.setState({ devFreeNodes: false });
  });
});
```

> If `hire_manager` has unmet parents that block purchase even with `devFreeNodes`, the executing engineer should set `purchasedNodes` to include the parent chain first (read `src/config/skillTreeNodes` / the design JSON for `hire_manager`'s `parentIds`), or pick whichever node actually carries the `roster_slot` capability. The contract: after buying a `roster_slot` node, `roster.length === getRosterCap(state)`.

- [ ] **Step 2: Run, verify it FAILS**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: FAIL (roster stays empty — buyNode doesn't reconcile yet).

- [ ] **Step 3: Wire reconcileRoster into buyNode**

In `src/store/skillTreeSlice.ts`, inside `buyNode`, after the successful `set(...)` that increments the node level and before `return true;`, add:
```ts
    // A purchased node may have unlocked a roster slot — spawn to fill it.
    // reconcileRoster is a no-op for non-roster nodes (cap unchanged).
    get().reconcileRoster();
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire reconcileRoster into the Bootstrap rehydration gate**

In `src/main.tsx`, inside the `silent_sim` decision effect, reconcile once right after reading the post-hydration state — before the catch-up branch. At the top of the async IIFE in that effect (the one that begins `const lastSeen = useGameStore.getState().lastSeen;`), add as the first line:
```ts
      // Populate the roster for any slots unlocked in a save that predates the
      // redesign (migration leaves roster empty; this fills it to cap).
      useGameStore.getState().reconcileRoster();
```

> Placement rationale: this runs once per boot after `onFinishHydration`, against the live store, before the catch-up sim. Workers contribute nothing in A2, so ordering vs. the sim is functionally irrelevant; doing it first keeps the live store correct for the very first render of the office tab.

- [ ] **Step 6: Add the migrate→reconcile + persist round-trip integration test**

Append to `tests/store/officeSlice.test.ts` (the store-level equivalent of the Bootstrap path — exercise migrate dropping fields, then reconcile filling the roster):

```ts
import { migrate } from "@/store";

describe("v26 save → migrate drops legacy fields; reconcile fills roster", () => {
  it("migrate strips officeLevel/officeXp/queue/trickleTimer and empties roster", () => {
    const old = {
      officeLevel: 5,
      officeXp: big(123),
      queue: [{ id: "c1" }],
      trickleTimer: 9,
      roster: [{ id: "legacy", class: "generalist", tier: "common", level: 3, xp: big(50), affixes: [] }],
      purchasedNodes: { hire_manager: 2 },
    };
    const migrated = migrate(old, 26) as Record<string, unknown>;
    expect(migrated.officeLevel).toBeUndefined();
    expect(migrated.officeXp).toBeUndefined();
    expect(migrated.queue).toBeUndefined();
    expect(migrated.trickleTimer).toBeUndefined();
    expect(migrated.roster).toEqual([]);
  });

  it("after migrate, reconcileRoster spawns level-1 workers for unlocked slots", () => {
    useGameStore.setState({ roster: [], purchasedNodes: { hire_manager: 2 } });
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(2);
    expect(useGameStore.getState().roster.every((w) => w.level === 1)).toBe(true);
  });
});
```

> If `migrate` is not already exported from `src/store/index.ts`, it is (confirmed: `export const migrate = ...`). Import it from `@/store`.

- [ ] **Step 7: Run the full suite, verify green**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Verify the build resolves**

Run: `npx vite build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "store(office): spawn workers on slot unlock + post-hydration reconcile"
```

---

## Self-Review

**Spec coverage (this phase's slice of the spec):**
- §2.1 five-stat sheet on a persistent worker → `Worker` interface wraps `WorkerStats` from A1 (Task 1). ✅
- §5 acquisition: slots via `roster_slot` fame capability, spawn fresh level-1, small cap, no hire/queue → `getRosterCap` + `reconcileRoster` + `createWorker`; hire/queue deleted (Tasks 1-3). ✅
- §7 persistence: workers survive ascend, only run-contribution resets → `resetOffice` keeps roster, zeroes `strokesThisRun` (Task 1). ✅ (Ascend call-site rename + XP pass are Phase C, flagged.)
- §10 engine surface: `officeSlice` reduced to roster + spawn/reconcile/reset; `multipliers.getOfficeContribution` removed; canvas-math no longer sees the roster (Task 1). ✅ (Canvas-tick wiring of `workerGoldFactor` is Phase B.)
- §11 save migration: bump version, drop old office fields, roster repopulated at runtime (Tasks 1, 3). ✅
- §6 old class system deleted: `officeClasses.ts` removed; `Worker.classId` is a forward hook defaulting to "base" (Tasks 1-2). ✅
- "Workers contribute nothing yet" → enforced structurally by removing `roster` from `CanvasMultiplierInputs` (Task 1). ✅

**Out-of-scope items explicitly deferred (no task, by design):** Phase B canvas tick + `workerGoldFactor` + `strokesThisRun` accumulation; Phase C ascend XP + skill-node migration/refund + dead-balance-function deletion; Phase D full office UI. The dead-but-kept list (balance funcs, `getWorkerXpMultiplier`/`getHireCostMultiplier`, `officeWorkersHired`) is intentionally not deleted here.

**Placeholder scan:** All code steps contain full file bodies or exact old→new edits. The only conditionals are verification fallbacks (which node carries `roster_slot`; whether a CSS module exists) — these are "confirm the actual name" instructions with a stated contract, not unwritten code.

**Type consistency:** `Worker` (Task 1) is used identically by `createWorker`, `reconcileRoster`, `resetOffice`, the rewritten `officeSlice.test.ts`, and the catchup clone. `getRosterCap` keeps its `countCapability(state, "roster_slot")` definition. `reconcileRoster`/`resetOffice` names match between the slice interface, the implementation, the buyNode/Bootstrap call sites, and the tests. `CanvasMultiplierInputs` loses `roster` in Task 1 and every builder (`StatsRoom`, `PaintingRoute`, test fixtures) is updated in the same task.

**Green-bar honesty:** Each task ends with `npx vitest run` + `npx vite build`. `tsc` is intentionally not a gate (pre-existing baseline errors, per HANDOVER). No task adds a new dangling import.

---

## Phase B handoff (next plan, separate session)

Rewrite `src/core/canvasTickPure.ts` from the single-painter time-budget loop to a discrete-event scheduler over `player + roster`; wire `workerGoldFactor = Π(1 + worker.stats.goldPct)`; per-worker crit/strokes-per-crit/combo on each painter's strokes; accumulate `strokesThisRun`. **Call the advisor before committing to the scheduler design** (per HANDOVER). The `Worker` model and `WorkerStats` are now in place and contribute nothing — Phase B is purely additive wiring.
