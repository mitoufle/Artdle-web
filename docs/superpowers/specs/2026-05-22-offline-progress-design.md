# Offline progress — catch-up simulation (2026-05-22)

## Goal

Make the game persistent across page reloads: when the player closes the tab and comes back later, the elapsed time is simulated tick-by-tick and the player receives all gold, inspiration, canvas sales, workshop crafts and worker production they would have gained while playing.

The current build pauses on `visibilitychange → hidden` and resumes with `delta=0` on show — this design replaces the reload half of that behavior with a real catch-up. Tab-hide behavior is intentionally unchanged (see §13).

## Scope summary

| Setting | Value |
|---|---|
| Trigger | Page reload only (not tab visibility) |
| Subsystems simulated | All six ticks (`treeTick`, `canvasTick`, `skillTreeTick`, `workshopTick`, `tickOffice`, `schoolTick`) |
| Cap on elapsed time | None |
| Simulation fidelity | Full replay against a cloned state with adaptive delta |
| UX < 5s elapsed | Silent (no UI) |
| UX 5s – 2h | Silent simulation → toast on resume |
| UX > 2h | Dedicated full-screen loading scene with progress bar → modal recap |
| Achievement evaluation | One pass after simulation completes, toasts shown sequentially |

---

## 1. Architecture

```
Bootstrap (existing rehydration gate)
  ├─ rehydrate IDB → store
  ├─ NEW: read meta.lastSeen
  ├─ NEW: elapsed = max(0, Date.now() - meta.lastSeen)
  ├─ NEW: branch on elapsed:
  │    ≤ 5s     → mount Game directly
  │    5s – 2h  → runCatchupSimulation() silently → mount Game + toast
  │    > 2h     → mount CatchupLoadingScene → runCatchupSimulation() with progress
  │              → CatchupRecapModal → mount Game on Continue
  ├─ on fail (sim throws): log via reportError, mount Game without catch-up (fail-open)
  └─ startTickLoop(tickAll)
```

The simulation runs **before** `<Game />` mounts. The store is in its rehydrated state during the sim; UI surfaces are loading/toast/modal components that do not subscribe to game slices.

### New files

- `src/systems/catchup.ts` — simulation engine + `runCatchupSimulation`
- `src/systems/catchupClone.ts` — state clone helpers
- `src/components/catchup/CatchupLoadingScene.tsx` + `.module.css`
- `src/components/catchup/CatchupRecapModal.tsx` + `.module.css`
- `src/components/catchup/CatchupToast.tsx` + `.module.css`

### Modified files

- `src/main.tsx` (Bootstrap): branch on elapsed, mount catch-up screens
- `src/systems/lifecycle.ts`: update `lastSeen` in `onHide` and `onUnload`
- `src/store/metaSlice.ts`: new `lastSeen: number` field
- `src/store/index.ts`: SAVE_VERSION 19 → 20, migration, `lastSeen` heartbeat in `tickAll`
- The six tick slices (`treeSlice`, `canvasSlice`, `skillTreeSlice`, `workshopSlice`, `officeSlice`, `schoolSlice`): extract pure tick functions

---

## 2. `lastSeen` — timestamp source of truth

New field on `metaSlice`:

```ts
interface MetaState {
  // ... existing
  lastSeen: number  // epoch ms
}
```

**Update points:**

1. **On lifecycle `onHide` and `onUnload`** — `lastSeen = Date.now()` set immediately before `persistedAdapter.flush()`. Guarantees zero loss on graceful tab close.
2. **Heartbeat inside `tickAll`** — accumulator on the game loop bumps `lastSeen` every 10 simulated seconds of play. Bounds the loss on browser crash / power loss to 10s.
3. **Migration** — v19 → v20 seeds `lastSeen = Date.now()` so existing saves start their first post-update load with `elapsed = 0`.

**On load:** `elapsed = max(0, Date.now() - state.lastSeen)`. Negative deltas (clock skew) clamp to 0.

---

## 3. Pure tick refactor

### Current shape (Zustand closure)

```ts
canvasTick: (delta) => set((state) => {
  // 80 lines of logic, may call s.addGold(), s.incrementStat(), etc.
  return next
})
```

### Target shape (pure mutation on a draft)

```ts
export function canvasTickPure(draft: Mutable<GameStore>, delta: number): void {
  // same 80 lines, mutating draft directly. All cross-slice writes
  // (addGold, incrementStat, addInspiration, etc.) become direct field writes.
}

canvasTick: (delta) => set((state) => {
  const draft = { ...state }
  canvasTickPure(draft, delta)
  return draft
})
```

### Phase 0 audit (mandatory before implementation)

Before refactoring, read every body of the six tick functions and enumerate:

- Every `get().X()` call (cross-slice reads via action methods)
- Every `s.X()` action call inside the tick (cross-slice writes)
- Every closure that captures `set` from another slice

For each call site, the pure version replaces it with a direct draft mutation. Document the inventory in the implementation plan before touching code. Without this audit, the scope of the refactor is unknown.

### Multi-completion-per-delta correctness

Each tick must handle deltas larger than its natural step size (a 60s delta against a 5s canvas paint time should produce 12 sales, not 1). Implementation pattern:

```ts
state.canvasProgress += delta / effectivePaintTime
while (state.canvasProgress >= 1) {
  state.canvasProgress -= 1
  // sale logic, increments, gold add
}
```

This is also more correct for the live game when a RAF frame happens to be longer than the canvas paint time at high speed levels.

---

## 4. Simulation engine

**File:** `src/systems/catchup.ts`

```ts
export interface CatchupResult {
  elapsedSeconds: number
  goldGained: Big
  inspiGained: Big
  canvasesSold: number
  itemsCrafted: number
  paintMasteryGained: Big
  achievementsUnlocked: AchievementId[]
}

export async function runCatchupSimulation(
  elapsedSeconds: number,
  onProgress: (pct: number) => void,
): Promise<CatchupResult>
```

### Adaptive delta

| Elapsed | Delta |
|---|---|
| < 30 min | 0.1s |
| < 1 hour | 1s |
| < 1 day | 10s |
| ≥ 1 day | 60s |

### Algorithm

```ts
async function runCatchupSimulation(elapsedSeconds, onProgress) {
  const baseline = useGameStore.getState()
  const draft = cloneGameState(baseline)   // see §5
  const delta = chooseDelta(elapsedSeconds)
  const totalIters = Math.ceil(elapsedSeconds / delta)
  let simulated = 0
  let iters = 0
  const BATCH_SIZE = 200

  while (simulated < elapsedSeconds) {
    const stepDelta = Math.min(delta, elapsedSeconds - simulated)
    for (let i = 0; i < BATCH_SIZE && simulated < elapsedSeconds; i++) {
      treeTickPure(draft, stepDelta)
      canvasTickPure(draft, stepDelta)
      skillTreeTickPure(draft, stepDelta)
      workshopTickPure(draft, stepDelta)
      tickOfficePure(draft, stepDelta)
      schoolTickPure(draft, stepDelta)
      simulated += stepDelta
      iters++
    }
    onProgress(simulated / elapsedSeconds)
    await yieldToBrowser()
  }

  // One pass on achievements at the end, mutating draft.completedAchievements
  // and accumulating a list for the recap. Notifications are NOT fired here;
  // they fire in the consumer (toast/modal) so they show after the sim UI closes.
  const newlyUnlocked = evaluateAchievementsPure(draft)

  // Single setState for the whole simulation
  useGameStore.setState(draft)

  return diffSnapshots(baseline, draft, elapsedSeconds, newlyUnlocked)
}
```

### Performance envelope

| Elapsed | Iterations | Estimated time |
|---|---|---|
| 1 hour | 3 600 (1s delta) | ~30 ms |
| 1 day | 8 640 (10s delta) | ~80 ms |
| 1 week | 10 080 (60s delta) | ~100 ms |
| 1 month | 43 200 | ~400 ms |
| 1 year | 525 600 | ~3 s |

The `yieldToBrowser()` keeps the progress bar updating on the > 2h path.

### Error handling

If `runCatchupSimulation` throws, the consumer (Bootstrap) catches, calls `reportError(err, "catchup.simulation")`, and mounts the game directly with the rehydrated state (fail-open). No state is half-applied because the simulation only writes via the final `setState`.

---

## 5. State clone strategy

The simulation must not mutate the live store state. `structuredClone` does not work because of `Big` (break_eternity) instances and `Map` wrappers in some slices.

**Concrete cloning rules per field type:**

| Field type | Clone strategy |
|---|---|
| Primitives (number, string, bool) | Copy by value |
| `Big` (break_eternity) | `new Big(x)` (uses break_eternity's copy constructor) |
| `Date` / timestamp numbers | Copy by value |
| Plain object `{ ... }` | Shallow spread `{ ...obj }`, then recurse for known nested mutated fields |
| Array of items (inventory) | `arr.map(item => ({ ...item, affixes: [...item.affixes] }))` |
| `Map` | `new Map(oldMap)` (Map constructor copies entries) |
| `Record<string, T>` (completedAchievements, etc.) | `{ ...rec }` |
| Config / static IDs / icons | Shared reference (immutable) |

The clone helper lives in `src/systems/catchupClone.ts` and exports `cloneGameState(state: GameStore): GameStore`. Tests in `tests/systems/catchupClone.test.ts` verify (a) mutations on the clone do not leak to source for every field type, (b) Big arithmetic on clone produces a new Big without affecting source.

---

## 6. UX states

### State A — Silent (≤ 5s elapsed)

No UI. Game mounts directly. This threshold catches the common case of a quick browser-tab swap that briefly hits `beforeunload`-like behavior. It's a balance constant (`CATCHUP_SILENT_THRESHOLD_SECONDS = 5`) — tunable.

### State B — Toast (5s – 2h elapsed)

Simulation runs silently while the Bootstrap loading indicator (already present) holds. After completion, the `<Game />` mounts and a toast slides in from the top-right corner.

**Toast contents (CatchupToast.tsx):**

```
⏱  Welcome back
Away 12 min · +1.23K gold · +450 inspi · 14 canvases
```

- Uses the same animation pattern as `AchievementToast` (slide-in spring → 6s hold → collapse to corner).
- If achievements unlocked during sim: toast shows for catch-up summary first, then achievement toasts queue up after.
- Honors `prefers-reduced-motion` (instant in/out).

### State C — Dedicated loading scene (> 2h elapsed)

Full-screen scene mounted in place of `<Game />`.

**CatchupLoadingScene.tsx:**

```
┌─────────────────────────────────────────┐
│                                          │
│       Catching up on 4h 23min away…      │
│                                          │
│       ████████████████░░░░░░░░  68%      │
│                                          │
└─────────────────────────────────────────┘
```

- Progress bar wired to the `onProgress` callback.
- Background visual: simple dark gradient using existing tokens (`var(--bg-stone-d)`). Optional v1.1: reuse the cavern video.
- `prefers-reduced-motion`: static "Catching up…" label without progress animation.

After simulation completes, transition to the recap modal.

**CatchupRecapModal.tsx:**

```
┌─ You were away for 4h 23min ────────────┐
│                                          │
│   Gold earned        +12.4K              │
│   Inspiration        +8.1K               │
│   Canvases sold      287                 │
│   Items crafted      3                   │
│   Paint mastery      +24                 │
│                                          │
│   Achievements unlocked:                 │
│     ✦ Millionaire                        │
│     ✦ T3 — Sapling Mastery               │
│                                          │
│              [  Continue  ]              │
└──────────────────────────────────────────┘
```

- Continue closes modal and mounts `<Game />`.
- Achievement section absent if no achievements unlocked.
- Numbers formatted via existing `formatBig`.

---

## 7. Achievement handling

**Decision:** Evaluate achievements once at the end of simulation. The multipliers from achievements unlocked mid-absence do not retroactively benefit earlier simulated time. This is a known underpayment; chosen for implementation simplicity.

**Notification flow:**

1. Catch-up sim runs. `completedAchievements` updates from a single end-of-sim `evaluateAchievementsPure(draft)` call.
2. The unlocked IDs are returned in `CatchupResult.achievementsUnlocked`.
3. After the catch-up toast/modal dismisses, the achievement notifications are enqueued sequentially via the existing `pushNotification` action — one after the other, ~6s each (standard timing).
4. The recap modal also lists them in a dedicated section for visibility.

This preserves the normal achievement-unlock feel (toasts appear) without spamming the player with 10 simultaneous toasts during the sim.

---

## 8. Save migration

```ts
// SAVE_VERSION 19 → 20
if (fromVersion < 20) {
  state.lastSeen = Date.now()
}
```

Effect: all existing saves get `lastSeen = now` on their first load post-deploy, so `elapsed = 0` and no catch-up fires (avoids a "you were away for years" false positive against the deploy timestamp).

---

## 9. Tests

### Unit tests

**`tests/core/tickPure.test.ts`** — parity between Zustand and pure variants
- For each of the 6 ticks: feed the same initial state + delta to both, assert equal final state
- `canvasTickPure(state, delta=60)` with paintTime=5 produces 12 sales (multi-completion correctness)
- `tick*Pure(state, delta=0)` is a no-op

**`tests/systems/catchup.test.ts`** — simulation engine
- `elapsedSeconds = 0` → no-op, baseline state unchanged
- `elapsedSeconds = -100` → clamped to 0, no-op
- Adaptive delta selection per range boundary
- `onProgress` called with monotonically increasing pcts in `[0, 1]`
- Mutations on the simulation draft do not appear on the live store mid-sim
- `BATCH_SIZE` yields exercised via fake timers

**`tests/systems/catchupClone.test.ts`** — clone correctness
- For each field type in the clone rules table: mutate the clone, assert source unchanged
- Big arithmetic on clone produces new Big, source unaffected
- Inventory item affix mutation on clone does not leak

**`tests/store/metaSlice.test.ts`** — `lastSeen`
- Heartbeat updates `lastSeen` every 10 simulated seconds in `tickAll`
- Migration v19 → v20 seeds `lastSeen = Date.now()`

**`tests/systems/lifecycle.test.ts`** (existing, extend)
- `onHide` writes `lastSeen` before flush
- `onUnload` writes `lastSeen` before flush

### Integration test

**`tests/integration/catchup.test.tsx`** — Bootstrap branching
- Save with `lastSeen = now - 1h` → toast appears with correct figures
- Save with `lastSeen = now - 3h` → loading scene mounts, then modal, then game
- Sim throws → game mounts, no catch-up UI, `reportError` called

### Convergence test (extends existing bot)

**`tests/integration/bot-simulation.test.ts`** — already runs a live tick simulation for a fixed wall-clock period.
- Add a variant: run the bot live for 1h, snapshot state. Then run a separate test that starts from the same baseline and calls `runCatchupSimulation(3600)`. Final states must converge within tolerance (gold ±0.1%, inspi ±0.1%, integer counters exact).

---

## 10. Implementation plan structure (preview)

A separate implementation plan will detail the execution. Expected phases:

- **Phase 0** — Audit the 6 tick bodies, enumerate cross-slice calls, write inventory doc.
- **Phase 1** — Refactor ticks one slice at a time. Each phase: extract pure function + parity test. Six commits.
- **Phase 2** — `metaSlice.lastSeen` + migration v20 + lifecycle hook updates. One commit.
- **Phase 3** — `catchupClone.ts` + tests. One commit.
- **Phase 4** — `catchup.ts` simulation engine + tests. One commit.
- **Phase 5** — UI components (toast, loading scene, modal). One commit per component or one combined.
- **Phase 6** — Bootstrap branching + Game-mount gate. One commit.
- **Phase 7** — Bot convergence test. One commit.
- **Phase 8** — Manual playtest with browser DevTools clock-skew (`Date.now = ...`).

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Pure tick refactor scope explodes if ticks deeply intertwine with other slice actions | Phase 0 audit gates implementation. If audit reveals heavy coupling, design returns to brainstorm with the inventory in hand. |
| Achievement underpayment perceived as unfair by players | Documented trade-off. If complaints arise, revisit to evaluate after each batch. |
| Multi-completion bug in canvasTick / treeTick on large deltas | Parity tests with delta=60s + paintTime=5s catch regressions. |
| `Big` clone semantics surprise (break_eternity reference vs copy) | `catchupClone.test.ts` asserts clone independence for Big arithmetic. |
| Sim throws mid-loop and partial UI state stuck | All catch-up UI is mounted before sim; on throw, Bootstrap unmounts catch-up screens and mounts Game. No half-applied state because the single `setState` is the final step. |
| Tab background-vs-reload asymmetry surprises players | Documented as v1 design (§13). Watch playtest feedback; if it's a real friction, the visibility-change hook can be wired to the same catch-up path. |
| `lastSeen` set incorrectly on tab close in some browsers (Safari onhidden quirks) | Use both `visibilitychange` and `beforeunload` listeners (both already present). Heartbeat in tick bounds the worst case to 10s. |

---

## 12. Out of scope

- **Offline progress while tab is hidden but not unloaded.** Tab-hide still pauses the live tick. See §13.
- **Per-subsystem opt-out controls** (e.g., "only catch up canvases, not workshop"). Not requested; YAGNI.
- **Cap on elapsed time.** User explicitly requested no cap. The adaptive delta keeps performance bounded.
- **Skip button on the loading scene.** Sim is short enough (worst case ~3s for 1 year of absence) that a skip control isn't needed. Will be reconsidered if reports come in.
- **Reward multipliers / "offline boost" rates.** Catch-up gives the literal amount that would have been earned, no boost or penalty.
- **Visual themed loading scene (cavern video, animated easel, etc.).** v1 ships a simple gradient + progress bar. Polish pass deferred.

---

## 13. Tab-visibility vs reload — known asymmetry

The current `onHide` behavior pauses the tick loop without resuming elapsed time on `onShow` — this stays unchanged. After this design ships:

| Scenario | Behavior |
|---|---|
| Tab open, focused | Live ticking, normal play |
| Tab open, background (hidden) | Paused. On show, resumes from now with delta=0. No catch-up. |
| Tab closed and reopened later | Catch-up simulation per this spec. |
| Browser crash / power loss | Catch-up runs from the heartbeat-saved `lastSeen` (up to 10s lost) |

The asymmetry between hidden-tab and closed-tab is a deliberate v1 choice (less code, simpler UX, no surprise modals when tabbing back). If background-tab idling becomes a common pattern players complain about, the visibility hook can be re-wired to the same catch-up path with no further refactoring.
