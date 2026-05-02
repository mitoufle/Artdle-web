# Artdle Web — Handover

**Date:** 2026-05-02 (post Phase 0+1+2+3+4 execution + Phase 5 opening carry-overs)
**Status:** Phases 0+1+2+3+4 plans executed. Phase 4 cross-cutting review carry-overs (I-1, M-1, M-2) addressed. **220/220 tests green** across 25 files. tsc clean. lint clean (1 pre-existing warning). `npm run build` produces a clean `dist/` (81.00 KB gzipped).

---

## Where we are

The repo at `~/Documents/artdle-web/` has the full v1 gameplay loop **clickable in the browser** end-to-end:
- Tree (HomeView): part Buy buttons gold-gated, Grow button appears at threshold, inspi/sec readout live.
- Canvas (PaintingView): auto-paint state + progress + equipped-items list + disabled Workshop stub (placeholder for Phase 5).
- Ascend (AscensionView): palier preview + inspiration + fame-gain preview + Ascend button gated by `canAscend`.
- Skill tree (SkillTreeView): 5 nodes with inline linear-chain gating (Locked / Available / Purchased) + Buy button.
- TopBar nav switches `currentView` (persisted via viewSlice — refresh preserves the active view).
- BottomBar shows 3 currencies via `<CurrencyDisplay>` leaf widget; colors via theme tokens.
- InfoPanel strip is mounted with reserved height; reads `hoverInfoSlice` (Phase 5 fills it).
- `<Hoverable>` wrapper exists and is unit-tested but **not yet applied anywhere** — that's Phase 5's job.

Phase 4 plan at `docs/superpowers/plans/2026-05-02-artdle-web-phase4.md` is fully executed.

**What's new in Phase 4:**

- `src/store/viewSlice.ts`: persisted `ViewId` literal union (`"home" | "painting" | "ascension" | "skills"`), `currentView` field default `"home"`, `setView(id)` action. JSDoc on `ViewId` warns renames need a save migration. `currentView` rides `partialize`'s `...rest` — no `partialize` change needed.
- `src/store/index.ts`: `GameStore` now unions `ViewSlice` (8 slices + GameTick).
- `src/ui/widgets/TopBar.tsx`: title + 4 nav buttons + version stub. Active button gets `bg-app-panel`; `aria-pressed` tracks active state.
- `src/ui/widgets/CurrencyDisplay.tsx`: leaf widget with `kind: "gold" | "inspiration" | "fame"`. Has its own `CurrencyKind` type (deliberately decoupled from currencySlice's `CurrencyKey`; documented in JSDoc). `data-testid="currency-{kind}"` for tests.
- `src/ui/widgets/BottomBar.tsx`: 3 `<CurrencyDisplay>` instances; no own state.
- `src/ui/widgets/InfoPanel.tsx`: reads `hoverTitle` (string) + `hoverBody`/`hoverFooter` (ReactNode); `min-h-16` reserves height; title-only render gate (asymmetric vs. body/footer — documented inline).
- `src/ui/widgets/Hoverable.tsx`: `<span>` wrapper with `onMouseEnter` push + `onMouseLeave` clear. Footer optional.
- `src/ui/views/HomeView.tsx`: tree stage name + live inspi/sec rate + part list with gold-gated Buy + conditional Grow button.
- `src/ui/views/PaintingView.tsx`: canvas state label + progress + equipped list + disabled Workshop stub.
- `src/ui/views/AscensionView.tsx`: palier preview + inspi + fame gain + Ascend button.
- `src/ui/views/SkillTreeView.tsx`: 5 nodes with inline gating (mirrors `canBuyNode`/`hasNode` from skillTreeSlice; inlined to keep `purchasedNodes` in the subscription path).
- `src/App.tsx`: rewritten as `TopBar / <main>{view}</main> / InfoPanel / BottomBar` shell with exhaustive `switch` over `ViewId`.
- `tsconfig.app.json`: `types` array gained `@testing-library/jest-dom/vitest` (so jest-dom matchers type-check under `verbatimModuleSyntax`).

**Plus a Phase 4 final-review fix (commit `4173136`):**
- `tests/store/persistence-integration.test.ts`: new "Phase 4 fields round-trip" describe block asserting `currentView` survives save/rehydrate. Locks DoD #8 contractually so future phases can't accidentally add `currentView` to `partialize`'s strip list.
- `InfoPanel.tsx`: 1-line comment above the title-gate explaining the asymmetry.
- `CurrencyDisplay.tsx`: JSDoc on `CurrencyKind` explaining why it shadows `CurrencyKey` (deliberate UI-side decoupling).

**Plus Phase 5 opening carry-overs (commits `680a830`, `6d144b5`, `761ce26`):**
- **I-1 fix** — HomeView, PaintingView, AscensionView no longer call `useGameStore.getState()` during render. Each view now subscribes to every field its helpers read (`equippedItems`, `purchasedNodes` added where missing) and constructs a narrow helper-state object via `as unknown as GameStore` cast. New rule documented in `docs/agent_docs/ui-patterns.md`.
- **M-1 fix** — dropped redundant `afterEach(cleanup)` from BottomBar / Hoverable / AscensionView tests; RTL 16 + Vitest globals auto-cleanup.
- **M-2 fix** — `docs/agent_docs/conventions.md` now notes (a) RTL auto-cleanup convention and (b) jest-dom matcher types must live in `tsconfig.app.json`'s `types` array under `verbatimModuleSyntax`.

**Test count breakdown (25 files, 220 tests):**

Existing from Phase 0+1+2+3: 204. Phase 4 net additions:
- `viewSlice` 5, `BottomBar` 4, `Hoverable` 3, `AscensionView` 3 = 15 new in 4 new test files
- `persistence-integration` +1 (Phase 4 final-review fix) = 16 total Phase 4
- 204 + 16 = 220.
- Phase 5 carry-overs added zero tests (refactors are behavior-preserving and existing tests prove it).

---

## What's next

**Phase 5 — Hover-info wiring + Workshop popup.** Per `PORT_PLAN.md` §7.

Specifically:
- Apply `<Hoverable>` to every interactive element across the 4 views: tree parts, Grow button, currency displays in BottomBar, Ascend button, skill nodes (Buy buttons), Workshop button in PaintingView.
- Authoring rule per `docs/specs/2026-04-25-info-panel-design.md` §6 — bodies use `() => <jsx>` callbacks for live values, costs in footer, numbers via `formatter.ts`, concept entries explain what-it-IS + what-it-gives.
- `src/ui/popups/WorkshopPopup.tsx`: craft button (gold-gated `100g`) + cost display + equipped-item card + inventory list. Click an inventory item to equip; click an equipped item to unequip. Triggered by un-disabling the existing stub button in PaintingView.
- Tests: hoverInfoSlice push/clear unit test (likely already covered by Hoverable.test); one Hoverable-application integration test (mount a wrapped element, fire mouseEnter, assert InfoPanel content); workshop popup integration (craft → item appears in inventory → equip → moves to equippedItems → affix applies to canvas multiplier).

Phase 5 needs a fresh brainstorm → spec → plan → execute cycle. Brainstorming session is the next step in this conversation.

Subsequent plans:
- Phase 6: Polish (Motion floating-text + transitions) + balance pass + ship v1.0.

Notable Phase 5 hooks already laid:
- `<Hoverable>` is API-stable: `{ title, body, footer?, children }`. Wrap any interactive element without changing its layout (it's a `<span>`).
- `hoverInfoSlice` pushes are atomic single-call; `pushHoverInfo(title, body, footer)` + `clearHoverInfo()`.
- The Workshop stub button in PaintingView (`disabled` + `title="Workshop popup arrives in Phase 5"`) is in place — Phase 5 just un-disables, adds `onClick` to open the popup, and (likely) adds a popup root to `App.tsx`.
- All `workshopSlice` actions return boolean for instant UI gating: `craft`, `equip`, `unequip`, `swap`, `discard`. `getCurrentSlotCount` selector tells the popup how many equip slots are usable.
- The view-subscription rule in `docs/agent_docs/ui-patterns.md` is the contract every Phase 5 component must follow — the popup will mount alongside PaintingView, and missing subscriptions in either will produce visible staleness.

---

## Lessons preserved (still apply)

From Phase 0+1+2:

1. **`break_eternity.js` `Big.pow(integer)` is not bit-exact.** Use `toBeCloseTo` for any Big-derived value flowing through `Big.pow`.
2. **`JSON.stringify` calls `Decimal.toJSON()` BEFORE the replacer runs.** Recursive `serializeBigs` walker handles all new Big-bearing fields automatically — Phase 4 confirmed: zero `partialize` change for `currentView` (a string).
3. **Test name = test contract.** Each `it("…")` description must accurately describe what the body asserts.
4. **The afterEach-spy-restore pattern** for Zustand singleton tests when swapping methods.
5. **`Object.freeze` on module-level initial-state constants** — Phase 4 applied to `initialViewState`.
6. **Tick-driven mutations require persist throttling** (1s window + flush on hide/unload).
7. **D7 tick order is part of the API contract.** Phase 4 didn't add tickable slices.
8. **Idle-frame guards belong in slice ticks, not the orchestrator.**

From Phase 3:

9. **Literal-union keys over `Record<string, …>`.** `ViewId` continues this pattern (mirrors `SkillNodeId`, `AffixKind`).
10. **Atomic guard order is "validate → spend → mutate"** for any new player verb.
11. **System-file orchestrators talk to slices through actions, not `set` directly.**
12. **`tsconfig.app.json` MUST set `"noEmit": true` in a Vite project** to prevent IDE-driven `tsc` from emitting `.js` siblings.
13. **Per-task reviews are narrow by design — final cross-cutting review catches what they can't.** Phase 4's final review caught the Phase 5-opening carry-overs (I-1 was Phase-4-functional but Phase-5-broken).
14. **AffixKind / SkillNodeId / ViewId strings are persisted** — renames require save migration. JSDoc above each warns.
15. **Save-format-binding JSDoc adds zero runtime cost and infinite future safety.**

---

## New lessons from Phase 4 + carry-over execution

1. **Selectors-only is structural, not stylistic.** `useGameStore.getState()` in render is functionally equivalent under a single-mounted-view model only because subscribed neighbors trigger re-renders. As soon as a sibling component mounts (Phase 5 popup) or a multi-pane view exists, missing subscriptions produce visible UI staleness on cross-helper field updates. The plan's Task 8/9/10 noted this risk explicitly (line 1394) and deferred to Phase 5 — fix is now in place. Codified in `docs/agent_docs/ui-patterns.md`.

2. **Helper signatures over `GameStore` create cast-debt at view call sites.** Helpers like `getEffectivePalier(state: GameStore, count)` force views to construct fake-`GameStore` objects via `as unknown as GameStore`. The helpers could be narrowed to `Pick<GameStore, K>` of the fields they read (backwards-compatible for slice callers via structural typing). Deferred — small refactor whenever a phase next touches `multipliers.ts`, `treeSlice.ts`, `workshopSlice.ts`, `ascend.ts` together.

3. **Tailwind 4 JIT picked up runtime-concatenated class strings without a safelist.** `COLOR_CLASS[kind]` in `CurrencyDisplay.tsx` resolves to `text-gold` / `text-inspiration` / `text-fame` at runtime; the JIT scanner found them in the source map keys. No `@source inline()` directive needed. Document so future widgets don't preemptively safelist.

4. **`@testing-library/jest-dom` matchers under `verbatimModuleSyntax` need their types in `tsconfig.app.json`'s `types` array.** Without `@testing-library/jest-dom/vitest` in `types`, `toBeInTheDocument`/`toBeDisabled`/`toHaveTextContent` type-check as `any` at best and fail at worst. Wired in commit `2363aa9`. Now documented in `docs/agent_docs/conventions.md`.

5. **RTL 16 + Vitest globals auto-cleanup between tests.** Phase 4 test scaffolding hand-wrote `afterEach(cleanup)` blocks defensively; they were redundant. M-1 dropped them. Pattern: don't add `cleanup` imports/blocks to new UI tests.

6. **An exhaustive `switch (currentView)` over a `ViewId` literal union** gives compile-time coverage of all view stubs. Adding a new ViewId without a corresponding case is a tsc error in `App.tsx`. Phase 4's plan deliberately uses this; future view additions inherit the safety.

7. **`InfoPanel`'s `min-h-16` reserves height for empty-state strips.** Without it, the strip would collapse and the layout would shift when content arrives in Phase 5. Reserve-height-from-day-1 prevents the layout-shift class of bug.

8. **`data-testid` survives Tailwind class churn.** UI tests query by testid, not by `.text-gold` or by visible text alone (which is i18n-fragile). Phase 4 widgets follow this — keep up.

---

## Repo state at handover

- Branch: `main` (tracks `origin/main` at `https://github.com/mitoufle/Artdle-web.git`). Local is **15 commits ahead of origin/main** as of this handover; nothing has been pushed yet.
- Most recent commits: see `git log --oneline 3da2272..HEAD` — 13 Phase 4 task commits + 3 Phase 5-opening carry-over commits + this handover commit.
- Working tree: clean apart from `.claude/` (untracked, harness-local — do not commit).
- Bundle: `dist/index.html` 0.29 KB gzipped, CSS 3.14 KB gzipped, JS 81.00 KB gzipped — total **~84 KB gzipped**. Well under the 250 KB DoD budget.

Versions still per `VERSIONS.md`: TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5. Phase 4 added `@testing-library/react@16.3.0` + `@testing-library/jest-dom@7.0.4` + `@testing-library/user-event@14.6.1` + jsdom (already pinned).

---

## Known low-priority issues (carried forward)

From Phase 0+1: pre-existing `react-refresh/only-export-components` warning on `main.tsx`; `public/assets/artdle/` `.png.import` sidecar files; React Compiler dropped during Phase 0+1.

From Phase 2 final review (deferred to Phase 6 polish): `persistedAdapter.flush()` calls in `main.tsx` lack `.catch()`; `console.error` in throttle has no telemetry sink; canvas tests case 9 near-duplicate; tickAll test mixes 3 assertions; visibilitychange listener in two places.

From Phase 3 final review (deferred — Minor, not blocking): `void set;` YAGNI in `performAscendOrchestrator`; `workshopSlice.test.ts` determinism test doesn't pin a concrete `(kind, magnitude)` tuple; Better Brush range test doesn't actively prove the ceiling moved; `metaSlice.test.ts` has a "DO NOT call performAscend in this describe" risk for future contributors.

From Phase 4 + carry-over execution (deferred — Minor):
- **Helper-signature narrow refactor** — `getInspiMultiplier`, `getCanvasGoldMultiplier`, `getPaintTimeMultiplier`, `getEquippedContribution`, `getCurrentSlotCount`, `getProducingParts`, `canGrowSapling`, `getTotalLevelsInStage`, `canAscend`, `getEffectivePalier` could each take `Pick<GameStore, K>` of their actual reads instead of the full `GameStore`. Would eliminate the `as unknown as GameStore` cast at view call sites. Backwards-compatible (slice callers continue to work via structural typing). Touch when next visiting `multipliers.ts` / `treeSlice.ts` / `workshopSlice.ts` / `ascend.ts` for unrelated reasons.
- **`HomeView`'s `flatMap` over stages** rebuilds the part list on every render. For v1's 3-stage / 6-part tree this is fine; if Phase 1.x expands the stage count, memoize via `useMemo` keyed on `(currentStage, partLevels)`.
- **`PaintingView`'s `equippedItems.map((item, idx) => <li key={idx}>...)`** uses index keys. Safe today (items don't reorder mid-render), but if Phase 5+ introduces drag-to-reorder in equipped slots, switch to a stable item identity (item object identity is fine since items are immutable).

---

## Forward-compat seams baked in for Phase 5

- **`<Hoverable>` is built and tested** — Phase 5 is application sites, not API design. Wrap any interactive element with `<Hoverable title="…" body={() => <…/>} footer="…">child</Hoverable>`.
- **`InfoPanel` reserves height** — content arrives without layout shift.
- **Workshop button stub in `PaintingView`** is positioned and styled; Phase 5 un-disables and adds `onClick` to open the popup. No layout work needed.
- **All workshop verbs return boolean** — `craft()` returns false if inventory full or insufficient gold; `equip(idx)` returns false if slot full or invalid index. Popup buttons consume via `disabled={!canX(state)}`.
- **`getCurrentSlotCount(state)`** tells the popup how many equip slots to render (1 or 2 based on Second Slot purchase).
- **`getEquippedContribution(state, kind)`** + `multipliers.ts` are wired — equipped items already affect canvas/tree without further plumbing. Phase 5 just provides the equip UX.
- **View subscription rule** (`docs/agent_docs/ui-patterns.md`) is the contract for every new Phase 5 component. Cross-mounted components (popup + view) make missed subscriptions visibly bad.

---

## How to start Phase 5

In a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 5 (Hover-info wiring on every interactive element + Workshop popup). Use the brainstorming skill to scope it, then writing-plans to produce the next plan in `docs/superpowers/plans/`, then executing it via subagent-driven-development.

Phase 5 is mostly content authoring (Hoverable application + body authoring per spec) + one new component (WorkshopPopup) + popup-mount plumbing in `App.tsx`. Likely smaller than Phase 4 by line count, but high-touch across all view files.

The view-subscription rule (`docs/agent_docs/ui-patterns.md`) MUST be followed by `WorkshopPopup` and any helper application sites that read derived state. The popup mounts above PaintingView; without explicit subscriptions, equip/unequip clicks won't update the underlying view.
