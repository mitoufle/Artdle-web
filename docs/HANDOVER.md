# Artdle Web — Handover

**Date:** 2026-05-01 (post Phase 0+1+2 execution)
**Status:** Phase 0 + Phase 1 + Phase 2 plans executed. **132/132 tests green** across 16 files. tsc clean. lint clean (1 pre-existing warning). `npm run build` produces a clean `dist/`. Save persists across reload, including new tree/canvas state.

---

## Where we are

The repo at `~/Documents/artdle-web/` has the gameplay loop online end-to-end with no UI yet. The Phase 2 plan at `docs/superpowers/plans/2026-05-01-artdle-web-phase2.md` is fully executed (final code review passed: "Ready to merge").

**What's green from Phase 0+1 (carried forward):**

- Vite + React 19 + TS 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`)
- Tailwind 4 CSS-first `@theme` palette
- ESLint 10 flat config + Prettier (eslint config ignores `^_` prefixed unused vars per commit `45c9873`)
- Vitest 4 (jsdom + fake-indexeddb)
- `src/core/`: bigNumber wrapper, formatter (K/M/B/T/Q), v1 balance formulas, mulberry32 RNG, playerId UUID, tickLoop (RAF + visibilitychange, no offline catch-up)
- `src/systems/persistence.ts`: idb-keyval-backed `SaveAdapter` (now wrapped by throttle — see Phase 2)
- `src/store/`: combined Zustand store (now 5 slices) wrapped in `persist` (idb, version 1, migrate stub, recursive Big serializer in `partialize`, hoverInfo partialized OUT)
- `src/main.tsx`: rehydration-gated Bootstrap
- `src/App.tsx`: stub showing the persisted playerId

**What's new in Phase 2:**

- `src/core/multipliers.ts`: three pure aggregator functions (`getInspiMultiplier`, `getCanvasGoldMultiplier`, `getPaintTimeMultiplier`) all returning 1. Forward-compat pipe — Phase 3 contributors slot in by adding lines to each function body without changing call sites in the slices.
- `src/config/treeStages.ts`: 3 stages (Seed/Sapling/Tree) × 2 parts each. Unlock thresholds 0/10/100 (geometric ×10). Numbers are placeholder Phase-6-tunable defaults.
- `src/store/treeSlice.ts`: `TreeState` (currentStage + frozen-init partLevels). Actions: `buyPartLevel` (atomic spend via currencySlice), `growSapling` (free, threshold-gated), `treeTick` (per-frame inspiration accrual via `state.add('inspiration', ...)`), `resetTree`. Selectors: `getTotalLevelsInStage`, `canGrowSapling`, `getProducingParts`. Idle-frame guard at top of `treeTick`.
- `src/store/canvasSlice.ts`: `canvasProgress` (number). `canvasTick` implements the locked one-sale-per-tick rule + carry-leftover-when-small math. Always-painting auto-restart (D1 from spec). `resetCanvas`. Idle-frame guard at top.
- `src/store/index.ts`: `GameTick` interface with `tickAll(delta)` orchestrator. Order pinned: tree first, canvas second (D7). Wires all 5 slices into `useGameStore`. Storage adapter swapped from `idbAdapter` → `persistedAdapter`.
- `src/systems/persistence.ts`: `ThrottledSaveAdapter` interface and `throttledAdapter(base, intervalMs)` factory. Coalesces rapid `setItem` calls into one base write per window (latest-wins). Exposes `flush()` for graceful close. Background save failures are caught + logged. Exported `persistedAdapter = throttledAdapter(idbAdapter, 1000)`.
- `src/main.tsx`: Bootstrap gains two new useEffect blocks: tickLoop start/stop after hydration, and `visibilitychange`+`beforeunload` listeners that call `persistedAdapter.flush()`. Each effect is StrictMode-safe.

**Test count breakdown (16 files, 132 tests):**

Existing from Phase 0+1: bigNumber 9, formatter 11, balance 17, rng 8, playerId 5, tickLoop 6, persistence 5, metaSlice 5, currencySlice 8, hoverInfoSlice 5, persistence-integration 5 = 84.

Phase 2 additions: multipliers 4, treeStages 6, treeSlice 19 (8+6+5), canvasSlice 9, tickAll 3, persistence (throttle) +6, persistence-integration +1 = 48 net (the persistence-integration grew from 5 → 6).

---

## What's next

**Phase 3 — Workshop + Ascend + Skill Tree.** Per `PORT_PLAN.md` §7. Specifically:
- `src/store/workshopSlice.ts`: click-to-craft action (validates gold, rolls 1 affix), equipped-item state.
- `src/config/workshopAffixes.ts`: 3-affix pool with magnitude ranges.
- `src/systems/ascend.ts`: orchestrated reset (calls `resetTree`, `resetCanvas`, `resetRunCurrencies`, credits fame, increments ascendCount).
- `src/store/ascendSlice.ts`: `canAscend()` selector, `performAscend()` action.
- `src/store/skillTreeSlice.ts`: 5-node purchase actions, fame spend.
- `src/config/skillTreeNodes.ts`: 5 nodes with linear prereq chain.
- Wire item affixes + skill nodes into `core/multipliers.ts` (the Phase 2 pipe is empty-but-shaped exactly for this).

Phase 3 needs a fresh brainstorm → spec → plan → execute cycle. The Phase 2 spec at `docs/superpowers/specs/2026-05-01-phase2-tree-canvas-design.md` is a good template.

Subsequent plans (one per phase):
- Phase 4: UI shell + 4 view stubs
- Phase 5: Hover-info wiring + Workshop popup
- Phase 6: Polish (Motion) + balance pass + ship v1.0

Wave roadmap (`PORT_PLAN.md` §2.1) takes over post-v1.0.

---

## Lessons from Phase 0+1 (preserved — still apply to Phase 3)

1. **`break_eternity.js` `Big.pow(integer)` is not bit-exact.** It uses log-domain math; `2^5` returns `32000.000000000007`, not `32000`. Tests comparing Big-derived values must use `toBeCloseTo`, not `toBe`. Phase 2 applied this correctly in `treeSlice.test.ts` cost-scaling test (10 * 1.15^10 ≈ 40.46 with 3-decimal precision).

2. **`JSON.stringify` calls `Decimal.toJSON()` BEFORE the replacer runs.** A replacer-based Big serializer is unreachable for actual `Decimal` instances. The fix in `src/store/index.ts` uses a recursive `serializeBigs` walker invoked inside `partialize`. **Phase 2 confirmed: zero `partialize` change required for the new JS-primitive fields** (`currentStage`, `partLevels`, `canvasProgress`). The walker is recursive and field-agnostic. Phase 3 slices that introduce more Bigs will need no plumbing changes either.

3. **Test name vs. test contract drift.** Each `it("...")` description must accurately describe what the test body asserts. Phase 2 was clean on this — the plan baked in the discipline.

TS-version pinning notes (still apply):
- TS 6.0.3 deprecates `baseUrl`; we have `"ignoreDeprecations": "6.0"` in `tsconfig.app.json`. When upgrading to TS 7, drop `baseUrl` (paths still work under `Bundler` resolution).
- Vite 8 + Vitest 4 + TS strict requires `import { defineConfig } from "vitest/config"` for the `test` block to type-check.

---

## New lessons from Phase 2 execution

1. **The afterEach-spy-restore pattern is the right shape for Zustand singleton tests.** When a test swaps slice methods on `useGameStore` (e.g., to record call order), capture originals at `describe` scope and restore via `afterEach` rather than at the end of the test body. If the assertion throws, the test-body restore never runs and swapped methods leak to subsequent tests. Idempotent for non-spy tests (re-assigning current methods is a no-op). See `tests/store/tickAll.test.ts`.

2. **`Object.freeze` on module-level initial-state constants prevents shared-reference mutation across resets.** `initialPartLevels` is a module singleton; `resetTree()` calls `set(initialTreeState)`, which means post-reset the live state's `partLevels` IS the module object until a spread detaches it. Today's writes all spread, but a future Immer-style or in-place mutation would silently poison the constant. Freezing makes the bug class fail loudly at dev time. Apply this pattern to any future slice that uses `set(initialState)` for reset.

3. **Tick-driven mutations require persist throttling.** With ticks at 60Hz and ≥2 `set()` calls per tick, raw `persist` would write to IDB ~120×/sec — burning ~30-60ms/sec on JSON.stringify alone and producing ~1-2 GB of disk writes per playthrough. The 1s `throttledAdapter` bounds this to ~1 write/sec. Graceful close (visibilitychange + beforeunload) calls `flush()` for zero-loss save; hard crash worst case is ~1s of work. The throttle's single-key design (one `pending` slot) is documented in code with a multi-key migration path.

4. **D7 tick order is part of the API contract.** `tickAll` calls `treeTick(delta)` then `canvasTick(delta)`. Pinned by a spy test in `tests/store/tickAll.test.ts`. Phase 3 must respect this: append new tickable slices in dependency order. The `GameTick` interface JSDoc documents the rationale.

5. **Idle-frame guards (`if (deltaSeconds <= 0) return;`) belong in slice ticks, not the orchestrator.** Both `treeTick` and `canvasTick` have the guard at the top. `tickAll` does not — its JSDoc explains that children handle it. The convention prevents spurious `set()` calls (which trigger persist) on idle frames where `tickLoop` may pass `delta = 0` after a frame skip.

6. **Plan test counts drift during execution.** The spec budgeted "~44 tests"; the plan budgeted "~131 total". Actual: 132 total (84 baseline + 48 Phase 2). Drift happens because review-driven fixes can add tests (Task 2's stage-ID-uniqueness test pushed treeStages from 5 → 6). Document drift in commits; don't fight it.

---

## Repo state at handover

- Branch: `master` (no remote configured; never pushed)
- Commits since Phase 0+1 handover snapshot (`70168a8`): 18 total
  - 2 spec/plan commits (`d90f90d`, `0ad9bcd`)
  - 16 Phase 2 commits (9 task commits + 7 review-driven fixups). See `git log --oneline 0ad9bcd..HEAD`.
- Most recent: `bootstrap: start tickLoop after hydration + flush adapter on hide/unload` (`97436d6`)
- Working tree: clean apart from `.claude/` (untracked, harness-local — do not commit)

Versions still per `VERSIONS.md`: TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5.

---

## Known low-priority issues (for later cleanup, not blockers)

Carried forward from Phase 0+1:

- `src/main.tsx` triggers `react-refresh/only-export-components` warning because `Bootstrap` is declared inline beside `createRoot`. Splitting it out is fine polish for a future UI-touching phase. (Phase 2 didn't introduce a new warning here — the existing one applies to the same Bootstrap.)
- `public/assets/artdle/` `.png.import` sidecar files. Prune in Phase 6.
- React Compiler dropped during Phase 0+1 Task 6. Re-introduce in Phase 6 if perf shows up.

New from Phase 2 final review (all Minor, all defer-able):

- `persistedAdapter.flush()` calls in `main.tsx:35` (visibilitychange/beforeunload) lack a `.catch()` — if IDB rejects on graceful close, it becomes an UnhandledPromiseRejection. The timer-fired path inside `throttledAdapter` already has `.catch()`. Symmetric hardening would be ~3 lines. Phase 6 polish.
- `console.error` in the timer-fired catch is dev-only visibility; no telemetry sink. Consider adding an `onError` callback parameter to `throttledAdapter(base, intervalMs, opts?)` when telemetry lands.
- `tests/core/multipliers.test.ts` case 4 ("convention: 1 + Σ contributions") is currently tautological (`1 + 0 === 1`). Phase 3 should replace with a real "with X items equipped, multiplier is 1.X" assertion.
- `tests/store/canvasSlice.test.ts` case 9 ("with multipliers returning 1") is a near-duplicate of case 4 ("exact threshold"). Phase 3 should differentiate by stubbing `getCanvasGoldMultiplier` to a non-1 value to make the contract explicit.
- `tests/store/tickAll.test.ts` case 1 mixes 3 assertions (inspiration credit, gold credit, progress carry). Splitting "carry" into its own test would make failure logs more diagnostic.
- The `visibilitychange` listener is registered in two places (`tickLoop.ts` and `main.tsx`). Both run synchronously on the same event in registration order. No bug today, but a future third listener could create an ordering hazard. Phase 3+ may benefit from a single `visibilitychange` orchestrator module.

---

## Forward-compat seams baked in for Phase 3

- **Multipliers**: Phase 3 wires item affixes and skill nodes by adding lines to each `getXMultiplier(state)` body. Zero call-site change in slices. The `1 + Σ contributions` convention is documented in `core/multipliers.ts` JSDoc; the `getPaintTimeMultiplier` JSDoc walks the affix-conversion math (`v / (1 - v)`) so a Phase 3 implementer reading `-paint_time%: 10%` knows to contribute `+0.111`, not `-0.10`.
- **`tickAll` extension**: Adding `workshopTick(delta)` (if needed) is one line. Order is the only contract.
- **Ascend orchestrator landing zone**: `resetTree`, `resetCanvas`, `resetRunCurrencies` are all in place and tested. `systems/ascend.ts` will be ~5 lines: call the three resets, credit fame, increment `ascendCount`.
- **Recursive `serializeBigs` walker** handles new persisted fields automatically. New slices need no `partialize` change unless they introduce non-serializable values.

---

## How to start Phase 3

In a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 3 (Workshop + Ascend + Skill Tree). Use the brainstorming skill to scope it, then writing-plans to produce the next plan in `docs/superpowers/plans/`, then executing it via subagent-driven-development.

The Phase 3 plan should specifically design around the lessons above (especially the multiplier-pipe + tickAll-order + freeze-initials + afterEach-spy patterns) so similar issues don't recur.

---

## Manual smoke verification (recommended before Phase 3)

The 132-test suite covers all logic and `npm run build` is clean, but the wiring in `main.tsx` is not unit-tested. A 5-minute manual smoke before Phase 3:

1. `npm run dev` and open the printed URL.
2. After the LoadingScreen flashes, the App stub renders the playerId.
3. Wait ~10 seconds — gold ticks up by 10 each canvas sale (no UI; verify in DevTools console: `useGameStore.getState().gold.toString()`).
4. In console: `useGameStore.getState().buyPartLevel("spark")` → returns `true` (after gold accumulates). Watch inspiration tick up.
5. Refresh the page. After hydration, all values persist (gold, inspiration, partLevels, currentStage, canvasProgress mid-paint).
6. DevTools → Application → IndexedDB → `keyval-store`: observe `artdle-save` updates at most ~once per second, not 60×/sec.

If anything fails, file a Phase 2 fixup before kicking off Phase 3.
