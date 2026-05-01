# Artdle Web — Handover

**Date:** 2026-05-01 (post Phase 0+1 execution)
**Status:** Phase 0 + Phase 1 plan executed. 84/84 tests green. tsc clean. lint clean (1 unrelated warning). Save persists across reload.

---

## Where we are

The repo at `~/Documents/artdle-web/` is scaffolded and the foundation is laid. The plan at `docs/superpowers/plans/2026-05-01-artdle-web-phase0-1.md` is fully executed.

**What's green:**

- Vite + React 19 + TS 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`)
- Tailwind 4 CSS-first `@theme` palette
- ESLint 10 flat config + Prettier
- Vitest 4 (jsdom + fake-indexeddb)
- `src/core/`: bigNumber wrapper, formatter (K/M/B/T/Q), v1 balance formulas, mulberry32 RNG, playerId UUID, tickLoop (RAF + visibilitychange, no offline catch-up)
- `src/systems/persistence.ts`: idb-keyval-backed `SaveAdapter`
- `src/store/`: combined Zustand store with three slices (meta, currency, hoverInfo) wrapped in `persist` (idb, version 1, migrate stub, recursive Big serializer in `partialize`, hoverInfo partialized OUT)
- `src/main.tsx`: rehydration-gated Bootstrap renders `<LoadingScreen>` until `useGameStore.persist.hasHydrated()`, then `<App>`
- `src/App.tsx`: stub showing the persisted playerId — refresh-stable proof the persistence loop closes

**Test count breakdown:** bigNumber 9, formatter 11, balance 17, rng 8, playerId 5, tickLoop 6, persistence 5, metaSlice 5, currencySlice 8, hoverInfoSlice 5, persistence-integration 5 = **84 tests across 11 files**.

---

## What's next

Phase 2 needs a fresh brainstorm → spec → plan → execute cycle:

- Tree slice (3 stages, parts, accrual rate per part * level)
- Canvas slice (single slot, fixed paint-time, auto-sell)
- Tree config (`src/config/treeStages.ts`)
- Wire `tickLoop` → tree.tick (accrue inspiration) + canvas.tick (advance painting + auto-sell on completion)
- Still no UI — verifies the gameplay loop end-to-end via tests

Subsequent plans (one per phase, each written after the previous executes):
- Phase 3: Workshop click-to-craft, Ascend, Skill Tree (5 nodes)
- Phase 4: UI shell + 4 view stubs
- Phase 5: Hover-info wiring + Workshop popup
- Phase 6: Polish (Motion) + balance pass + ship v1.0

Wave roadmap (`PORT_PLAN.md` §2.1) takes over post-v1.0.

---

## Lessons from the Phase 0+1 execution

Three plan-level bugs surfaced during execution. Watch for these patterns when writing Phase 2's plan:

1. **`break_eternity.js` `Big.pow(integer)` is not bit-exact.** It uses log-domain math; `2^5` returns `32000.000000000007`, not `32000`. Tests comparing Big-derived values must use `toBeCloseTo`, not `toBe`. The plan's tree-cost test (`Math.pow(1.15, 10)` precision) had this right; the palier test missed it.

2. **`JSON.stringify` calls `Decimal.toJSON()` BEFORE the replacer runs.** A replacer-based Big serializer is unreachable for actual `Decimal` instances — they arrive as bare strings. The fix used in `src/store/index.ts`: a recursive `serializeBigs` walker invoked inside `partialize`, which transforms Bigs into `{__big: "..."}` markers BEFORE `JSON.stringify` ever runs. Reviver-side stays simple. Future slices that introduce more Bigs need no plumbing changes (the walker is recursive).

3. **Test name vs. test contract drift.** Phase 0+1 had a test named `"returns 0 when inspi is below 10"` whose formula returned `9` at `n=9`, not `0`. The describe text was reading `Math.max(1, n)` as a threshold-at-10 when it's actually a floor-at-1 to keep `log10(0)` from blowing up. Plan reviewer should sanity-check that each test's name actually matches the formula it tests.

Two TS-version pinning notes:
- TS 6.0.3 deprecates `baseUrl`. We needed `"ignoreDeprecations": "6.0"` in `tsconfig.app.json`. When upgrading to TS 7, drop `baseUrl` (paths still work under `Bundler` resolution).
- Vite 8 + Vitest 4 + TS strict requires `import { defineConfig } from "vitest/config"` (not from `"vite"`) for the `test` block to type-check.

---

## Repo state at handover

- Branch: `master` (no remote configured; never pushed during Phase 0+1)
- Commits since scaffold: 27 total (2 pre-Phase-0 setup + 12 Phase 0 + 11 Phase 1 + 2 plan-bug fixes)
- Most recent: `config(eslint): also ignore underscore-prefixed locals (^_ varsIgnorePattern)` (`45c9873`)
- Working tree: clean apart from `.claude/` (untracked, harness-local — do not commit)

Versions captured in `VERSIONS.md`. Notable: TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5.

---

## Known low-priority issues (for later cleanup, not blockers)

- `src/main.tsx` triggers an `eslint-plugin-react-refresh/only-export-components` warning because `Bootstrap` is a component declared inline beside the `createRoot` mount. Splitting it out for HMR cleanliness is fine polish for a future UI-touching phase, but irrelevant until then.
- `public/assets/artdle/` contains the Godot-side `.png.import` sidecar files. Web build doesn't use them. A one-shot prune is reasonable polish during Phase 6 (or earlier if a Phase 2 task touches assets).
- React Compiler (Vite scaffold's babel plugin chain) was dropped during Task 6 in favour of plain `@vitejs/plugin-react`. Re-introducing it during Phase 6 polish is an option if perf shows up as an issue.

---

## How to start Phase 2

In a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 2. Use the brainstorming skill to scope the Tree + Canvas slices, then writing-plans to produce the next plan in `docs/superpowers/plans/`, then executing it via subagent-driven-development.

The Phase 2 plan should specifically design around the three lessons above so similar bugs don't repeat.
