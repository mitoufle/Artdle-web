# Artdle Web — Handover

**Date:** 2026-05-02 (post Phase 0+1+2+3 execution)
**Status:** Phase 0+1+2+3 plans executed. **204/204 tests green** across 21 files. tsc clean. lint clean (1 pre-existing warning). `npm run build` produces a clean `dist/`.

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

- `src/config/workshopAffixes.ts`: 3 affix kinds (`+canvas_gold%`, `-paint_time%`, `+inspiration_rate%`), magnitude range constants `[5, 15]` (+1 with Better Brush via `BETTER_BRUSH_BONUS_PCT`), `MAX_INVENTORY_SLOTS = 3`, `CRAFT_COST_GOLD = 100`. AffixKind has save-format JSDoc.
- `src/config/skillTreeNodes.ts`: 5 nodes in strict-linear chain (`goldsmith → patient_eye → second_slot → faster_strokes → better_brush`), costs `1/3/10/30/100` fame. SkillNodeId literal union with save-format JSDoc.
- `src/store/skillTreeSlice.ts`: `purchasedNodes: Partial<Record<SkillNodeId, true>>` (deviation from plan's `Record<string, true>` — preserves typo protection at consumer sites). `buyNode(id)` action with linear-chain enforcement. `hasNode` and `canBuyNode` selectors. No `resetSkillTree` action (purchasedNodes survives ascend).
- `src/store/workshopSlice.ts`: `Item { kind, magnitude }`. `inventory: ReadonlyArray<Item>` (max 3). `equippedItems: ReadonlyArray<Item>` (1 or 2 based on Second Slot). 5 atomic verbs (`craft`, `equip`, `unequip`, `swap`, `discard`) + `resetWorkshop`. Selectors `getCurrentSlotCount` and `getEquippedContribution`. RNG via `rngPick` + `rngInt` from `core/rng.ts`.
- `src/store/index.ts`: combined `useGameStore` now has 7 slices + GameTick.
- `src/store/metaSlice.ts`: extended with 1-line `performAscend()` wrapper around `systems/ascend`'s orchestrator. StateCreator generic widened to `GameStore`.
- `src/systems/ascend.ts`: pure orchestrator (`performAscendOrchestrator`) + `canAscend` + `getEffectivePalier` (Faster Strokes' 10% palier reduction). All cross-slice writes flow through existing slice actions (no direct `set`).
- `src/core/multipliers.ts`: empty Phase 2 bodies replaced — now reads item-equipped contributions + skill-node flags. **Phase 2's forward-compat seam delivered exactly as predicted: zero call-site changes in `treeSlice.treeTick` or `canvasSlice.canvasTick`.**

**Plus a Phase 3 final-review fix (commit `1fd57b6`):**
- `tsconfig.app.json` gained `"noEmit": true` (Vite handles bundling; tsc is type-only). Without this, IDE-driven tsc was emitting `.js` files into `src/` and `tests/`. The "stale .js files" issue that surfaced during Task 3 execution was this same root cause.
- `.gitignore` extended with `src/**/*.js` and `tests/**/*.js` belt-and-braces patterns.
- New paint-time integration test: equips a `-paint_time%` 10 item, asserts `canvasTick(9.0)` crosses the (now 9s) threshold — without the multiplier wired through, the same call would NOT cross the base 10s threshold. Closes the defect-detection gap where a refactor could silently drop `getPaintTimeMultiplier(state)` from `canvasTick`.

**Test count breakdown (21 files, 204 tests):**

Existing from Phase 0+1+2: 132. Phase 3 net additions:
- workshopAffixes 5, skillTreeNodes 6, skillTreeSlice 12, workshopSlice 19, ascend 17, metaSlice +2, persistence-integration +1 = 62 new in new/extended files
- multipliers replaced 4 → 14 (was 13 after main implementation, +1 from final-review fix) = +10 net
- Total Phase 3: 72 new; 132 + 72 = 204 total

---

## What's next

**Phase 4 — UI shell + 4 view stubs.** Per `PORT_PLAN.md` §7.

Specifically:
- `App.tsx`: TopBar / `<main>` / `<InfoPanel>` / `<BottomBar>` layout.
- View switcher (zustand `currentView` flag; no router).
- Views: `HomeView` (tree + part upgrades), `PaintingView` (canvas slot + Workshop button), `AscensionView` (palier + fame preview + ascend button), `SkillTreeView` (5 nodes with linear-chain gating).
- Widgets: `BottomBar` (3 currency displays), `CurrencyDisplay`, `InfoPanel`, `Hoverable`.

Phase 4 needs a fresh brainstorm → spec → plan → execute cycle.

Notable Phase 4 hooks already laid:
- All slice actions (`buyPartLevel`, `craft`, `equip`, `unequip`, `swap`, `discard`, `growSapling`, `buyNode`, `performAscend`, etc.) return `boolean` — UI components observe success/failure for instant gating.
- All "is this allowed?" selectors are pure functions over `GameStore`: `canBuyNode`, `canAscend`, `canGrowSapling`, `getCurrentSlotCount`, `getEquippedContribution`, `hasNode`. UI components consume them via Zustand selectors.
- The dev-only `window.useGameStore` exposure (`src/main.tsx:11-17`) lets DevTools-driven smoke tests verify any UI integration without changing `main.tsx` wiring.
- The `purchasedNodes` typing is strict enough that a TSX `s.purchasedNodes.goldmith` (typo) would fail to compile.
- `tickAll` order contract (tree-first, canvas-second) is pinned by `tests/store/tickAll.test.ts` for any Phase 4 view that depends on tree-credit-then-canvas-consume semantics.

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

1. **Literal-union keys over `Record<string, …>`.** D8's `Partial<Record<SkillNodeId, true>>` (deviation from the plan's `Record<string, true>`) made every `purchasedNodes.goldmith` typo a compile error. Cost: zero. Pay-off: every consumer in `workshopSlice`, `multipliers`, `ascend`, and tests gets free typo protection. **Apply to Phase 4's view-id and route-id types.**

2. **Atomic guard order is "validate → spend → mutate", in that order.** Both `craft()` and `buyNode()` follow this; neither has ever needed a rollback path. The pattern: read state, run all validation cheaply, attempt the spend (atomic via `currencySlice.spend`), only mutate further state if spend returned true. Inherited from `treeSlice.buyPartLevel` (Phase 2) and the Phase 0+1 `currencySlice.spend` contract.

3. **System-file orchestrators talk to slices through actions, not `set` directly.** `performAscendOrchestrator` calls `state.resetTree()`, `state.resetCanvas()`, etc. — never `set({ partLevels: ... })`. Honors slice encapsulation; isolates each slice's reset contract for independent testing. Mirrors Phase 2's `tickAll` pattern.

4. **`tsconfig.app.json` MUST set `"noEmit": true` in a Vite project.** Vite bundles via esbuild; tsc is type-only here. Without `noEmit`, any IDE-driven `tsc -p tsconfig.app.json` invocation pollutes the source tree with `.js` siblings. Caught in Phase 3's final review (and was the root cause of Task 3's transient "stale .js files" issue). `.gitignore` now has belt-and-braces `src/**/*.js` and `tests/**/*.js` patterns.

5. **Per-task reviews are narrow by design — final cross-cutting review catches what they can't.** Three of Phase 3's review findings (paint-time integration test gap, tsc emit pollution, unused-param across two files) were invisible at per-commit level. Bake the final-phase review into the workflow standard.

6. **AffixKind / SkillNodeId strings are persisted; renames require save migration.** Both types now carry an explicit JSDoc `Persisted X identifier. Renames require a save migration.` warning. The convention should apply to any future literal-union type that flows into persisted state.

7. **Save-format-binding JSDoc adds zero runtime cost and infinite future safety.** A 1-line comment above a literal union prevents a contributor from naively renaming a string and silently corrupting saves.

---

## Repo state at handover

- Branch: `master` (no remote configured; never pushed)
- Commits since Phase 2 handover (`12ce5d0`): the dev-aid (`b858dd8`) + Phase 3 spec (`874ffe9`) + Phase 3 plan (`a13531c`) + 8 Phase 3 task commits + 2 review-driven fixups + 1 final-review fix (`1fd57b6`) + this handover.
- Most recent: see `git log --oneline 12ce5d0..HEAD`.
- Working tree: clean apart from `.claude/` (untracked, harness-local — do not commit).

Versions still per `VERSIONS.md`: TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5.

---

## Known low-priority issues (carried forward)

From Phase 0+1: pre-existing `react-refresh/only-export-components` warning on `main.tsx`; `public/assets/artdle/` `.png.import` sidecar files; React Compiler dropped during Phase 0+1.

From Phase 2 final review (deferred to Phase 6 polish): `persistedAdapter.flush()` calls in `main.tsx` lack `.catch()`; `console.error` in throttle has no telemetry sink; canvas tests case 9 near-duplicate; tickAll test mixes 3 assertions; visibilitychange listener in two places.

From Phase 3 final review (deferred — Minor, not blocking):

- **`void set;` in `performAscendOrchestrator`** is YAGNI — the parameter is unused but kept "for future orchestrators." Forces `metaSlice.performAscend` to redundantly thread `setState`. Drop when a real consumer is needed; document the "all mutations through slice actions" rule instead.
- **`workshopSlice.test.ts` determinism test** verifies reseed-and-compare but doesn't pin a specific `(kind, magnitude)`. A refactor swapping `rngPick` and `rngInt` order would pass silently. Pin one concrete tuple as regression anchor when next touched.
- **`workshopSlice.test.ts` Better Brush range test** asserts `magnitude ∈ [6, 16]` but doesn't actively prove the ceiling moved. Strengthen with `Math.max(magnitudes) > 15` over the batch.
- **`metaSlice.test.ts` cast tripwire**: a future contributor adding a 6th isolated test could call `performAscend()` from the cast factory and crash at runtime (orchestrator dereferences `resetTree` etc. that don't exist on the isolated MetaSlice store). Comment should be promoted to a "DO NOT call performAscend in this describe" rule.

---

## Forward-compat seams baked in for Phase 4

- **Slice actions return `boolean` for instant UI gating**: every player verb (`buyPartLevel`, `craft`, `equip`, `unequip`, `swap`, `discard`, `growSapling`, `buyNode`, `performAscend`) returns true on success, false on failure. Phase 4 buttons consume via `disabled={!canX(state)}` + on-click handler.
- **Pure selectors over `GameStore`**: `canBuyNode(state, id)`, `canAscend(state)`, `canGrowSapling(state)`, `getCurrentSlotCount(state)`, `getEquippedContribution(state, kind)`, `getEffectivePalier(state, count)`, `hasNode(state, id)`. All callable from React components via Zustand selectors.
- **Literal-union typo protection**: `SkillNodeId` and `AffixKind` are unions, not strings. UI code referencing `"goldmith"` (typo) fails to compile.
- **Multiplier conventions documented in JSDoc**: `1 + Σ contributions` for additive; `v/(1-v)` per-item for paint-time. Phase 4 UI showing "×1.25" computes from these; balance-pass changes to `0.10` / `0.15` constants live in the relevant slice/multiplier file (a future Phase 6 concern, but documented now).
- **All slices wired into `useGameStore`**: Phase 4 just reads, never has to wire new slices itself (until Phase 5+ adds a `viewSlice` for the view-switcher state — that's a single-field slice).

---

## How to start Phase 4

In a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 4 (UI shell + 4 view stubs). Use the brainstorming skill to scope it, then writing-plans to produce the next plan in `docs/superpowers/plans/`, then executing it via subagent-driven-development.

Phase 4 is the first phase that touches the UI. The dev-only `window.useGameStore` exposure (`src/main.tsx:11-17`) makes DevTools-based smoke testing easy during execution.

Phase 4 will likely be the largest phase by line count (UI + components + view-switcher + InfoPanel + Hoverable wrapper + BottomBar widget + 4 view stubs). Consider splitting into sub-phases (e.g., Phase 4a: layout shell + view switcher; Phase 4b: 4 view stubs; Phase 4c: hover-info wiring) during brainstorming if scope feels too big for a single plan.
