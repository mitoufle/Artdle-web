# Artdle Web — Handover

**Date:** 2026-05-03 (post Phase 0+1+2+3+4+5 execution + Phase 6 opening carry-overs)
**Status:** Phases 0+1+2+3+4+5 plans executed. Phase 5 cross-cutting review carry-overs (C-1, C-2) addressed at Phase 6 opening. **239/239 tests green** across 27 files. tsc clean. lint clean (1 pre-existing warning). `npm run build` produces a clean `dist/` (82.77 KB gzipped).

---

## Where we are

The repo at `~/Documents/artdle-web/` has the full v1 gameplay loop **clickable in the browser** end-to-end with hover-info wired on every interactive element and the Workshop popup operational:
- Tree (HomeView): part Buy buttons gold-gated with Hoverable cards (live cost / production), Grow button appears at threshold with Hoverable, inspi/sec readout live with Hoverable on the rate display.
- Canvas (PaintingView): auto-paint state + progress + equipped-items list + active Workshop button that opens `<WorkshopPopup>` (no longer a stub).
- Ascend (AscensionView): palier preview + inspiration + fame-gain preview + Ascend button gated by `canAscend`, wrapped in Hoverable explaining the conversion.
- Skill tree (SkillTreeView): 5 nodes with inline linear-chain gating + Hoverable per Buy button (effect description + cost in footer).
- TopBar nav switches `currentView` (persisted via viewSlice — refresh preserves the active view).
- BottomBar shows 3 currencies via `<CurrencyDisplay>` each wrapped in Hoverable (live amount in body, currency concept in footer).
- InfoPanel strip is mounted, reserves height, and now consistently displays content as the user hovers any wired element.
- **Workshop popup** mounts above PaintingView (positioned absolute inside `<main>`'s relative container), backdrop click / Esc / view-change all close it, with full Craft → Inventory → Equipped UX wired through `workshopSlice` actions.

Phase 5 plan at `docs/superpowers/plans/2026-05-02-artdle-web-phase5.md` is fully executed.

**What's new in Phase 5:**

- `src/store/uiSlice.ts`: new transient slice. Single field `workshopPopupOpen: boolean`. Stripped from `partialize` (refresh closes the popup, by design). Two actions: `openWorkshopPopup`, `closeWorkshopPopup`. JSDoc on the field marks it as transient.
- `src/store/index.ts`: `GameStore` now unions `UiSlice` (9 slices + GameTick); `partialize` strips `workshopPopupOpen` alongside the other transient fields.
- `src/ui/widgets/Hoverable.tsx`: extended `Props` to accept `string | (() => string)` for `title` and `ReactNode | (() => ReactNode)` for `body` / `footer`. Factory callbacks resolve at hover time (event-handler context, satisfies the I-1 view-subscription rule). Static usage unchanged — `string` is assignable to `string | (() => string)`. Phase 5 follow-up added the `as?: "span" | "div"` prop so callers wrapping block-level children opt into a `<div>` wrapper without `validateDOMNesting` warnings.
- `src/ui/popups/WorkshopPopup.tsx`: new component. Renders nothing when closed. When open: backdrop (`role="dialog"`, `aria-modal="true"`), inner card (`data-testid="workshop-popup-card"`), header with close button (`aria-label="Close workshop"`), Craft button (gold-gated `100g`, inventory-cap-gated), Inventory section (each item is a Hoverable around an Equip button + a Discard ✕ button), Equipped section (each item is a Hoverable around an Unequip button). Esc dismiss + backdrop click + auto-close on `currentView !== "painting"` (latter has a JSDoc `@invariant` block above the function — see Phase 6-opening C-2 fix).
- `src/ui/views/PaintingView.tsx`: Workshop button un-disabled, `onClick={openWorkshopPopup}`, removed the placeholder `title` attribute.
- `src/App.tsx`: imports + mounts `<WorkshopPopup />` inside `<main>` (which now has `relative` so the popup's `absolute inset-0` constrains to the view area).
- Hoverable applied across HomeView (4 sites: stage card, parts list, inspi/sec readout, Grow button), PaintingView (Workshop button + canvas state — see plan), AscensionView (Ascend button), SkillTreeView (5 node Buy buttons), BottomBar (3 currency displays).

**Plus Phase 6 opening carry-overs (commits TBD this session):**
- **C-1 fix** — `tests/ui/popups/WorkshopPopup.test.tsx`'s "backdrop click closes" case previously selected the inner card via `dialog.firstChild`, which would break the moment Phase 6 wraps the popup in `<motion.div>`. Added `data-testid="workshop-popup-card"` to the inner card div in `src/ui/popups/WorkshopPopup.tsx` and switched the test selector to `screen.getByTestId("workshop-popup-card")`. All 10 WorkshopPopup tests still pass.
- **C-2 fix** — Promoted the inline 3-line comment on `WorkshopPopup`'s auto-close `useEffect` to a JSDoc `@invariant` block on the `WorkshopPopup` function itself. The block names the contract: popup is reachable only from PaintingView and self-closes on `currentView !== "painting"`; if a future entry point opens it from elsewhere, the predicate must be relaxed (e.g., capture view-at-open in a ref) before that entry point is added. Inline comment trimmed to a 1-line cross-reference.

**Test count breakdown (27 files, 239 tests):**

Phase 4 ended at 25 files, 220 tests. Phase 5 net additions:
- `uiSlice` 4 tests, `Hoverable` factory-callback tests +3 (extended existing file), `WorkshopPopup` 10 tests in 1 new file = 17 new tests, 2 new files net.
- (Hoverable application sites added zero tests — the application is mechanical and the slice's push/clear behavior is already proven by `Hoverable.test.tsx`.)
- Phase 6 carry-overs added zero tests (C-1 was a selector swap; existing test now passes against the testid).
- 220 + 17 + 2 (Hoverable extensions counted within the existing file count) = 239. (Effective file delta from 25 → 27 = uiSlice + WorkshopPopup new test files.)

---

## What's next

**Phase 6 — Motion polish + balance pass + ship v1.0.** Per `PORT_PLAN.md` §7 Phase 6.

Specifically:
- **Motion polish.** Motion is already installed (per `package.json`). Targets per PORT_PLAN §5.13: floating gold-text on canvas finish (`<motion.div>` y / opacity transition), tree stage-transition fade via `AnimatePresence`, fame-increment pulse on ascend. Optional: popup mount/unmount fade (will exercise the C-1 fix in production). Per spec §5.13, do NOT animate the canvas progress bar with Motion — keep it CSS `width: ${pct}%`.
- **Balance pass.** Tune the constants in `src/core/balance.ts` and `src/config/treeStages.ts`. Goal per PORT_PLAN §7 Phase 6: a fresh-save player reaches first ascend in 5–15 min; second is faster; by ascend 5–10 the skill tree investment feels meaningful. The 3-year long-term target is roadmap-level — v1 tunes for 1–3 hours of play.
- **Tuning question (PORT_PLAN §1.3 flag).** Does the 3-affix workshop pool feel thin in playtest? If yes, expand to 4–5 affixes (PORT_PLAN suggests `+ascend_palier_reduction%`, `+tree_part_cost_reduction%`) before declaring v1 balanced. Decide during the brainstorm based on playtest findings.
- **README write-up** + first deploy-ready production build (verify `npm run build` produces a working `dist/` and `npm run preview` serves it). PORT_PLAN §8 DoD #12 budget is <250 KB gzipped (currently 82.77 KB — plenty of headroom).
- **Tag v1.0** at the end.

Phase 6 needs a fresh brainstorm → spec → plan → execute cycle. Brainstorming session is the next step in this conversation.

Notable Phase 6 hooks already laid:
- **Motion is installed** (`motion` in `package.json`). No new dependency needed.
- **InfoPanel and BottomBar reserve their heights** — Motion wraps inside the canvas / tree / ascend regions won't trigger layout shift outside.
- **WorkshopPopup is structured for Motion wrapping**: outer backdrop + inner card with `data-testid`. Wrapping the inner card in `<motion.div>` (with `AnimatePresence` controlled by `open`) won't break the C-1 fix.
- **`equippedItems` and `inventory` use index keys today** — fine for current UX (no reorder), but if Phase 6 adds Motion to those lists with `layout` animations, switch to stable item identities first (item objects are immutable, so object identity works as a key).
- **`workshopSlice` actions return boolean** — popup buttons consume via `disabled={!canX(state)}`; Motion enter/exit hooks can trigger off these state transitions if needed.
- **balance.ts formulas are unit-tested** — every numeric tuning knob has a Vitest test in `tests/core/balance.test.ts`. Phase 6 balance changes update both the constant and the test value in tandem.

---

## Lessons preserved (still apply)

From Phase 0+1+2:

1. **`break_eternity.js` `Big.pow(integer)` is not bit-exact.** Use `toBeCloseTo` for any Big-derived value flowing through `Big.pow`.
2. **`JSON.stringify` calls `Decimal.toJSON()` BEFORE the replacer runs.** Recursive `serializeBigs` walker handles all new Big-bearing fields automatically — Phase 5 confirmed: zero `partialize` change for `workshopPopupOpen` (a boolean transient, stripped explicitly from `partialize`).
3. **Test name = test contract.** Each `it("…")` description must accurately describe what the body asserts.
4. **The afterEach-spy-restore pattern** for Zustand singleton tests when swapping methods.
5. **`Object.freeze` on module-level initial-state constants** — Phase 5 applied to `initialUiState`.
6. **Tick-driven mutations require persist throttling** (1s window + flush on hide/unload).
7. **D7 tick order is part of the API contract.** Phase 5 didn't add tickable slices.
8. **Idle-frame guards belong in slice ticks, not the orchestrator.**

From Phase 3:

9. **Literal-union keys over `Record<string, …>`.** v1 still has no string-keyed open-ended dictionaries.
10. **Atomic guard order is "validate → spend → mutate"** for any new player verb.
11. **System-file orchestrators talk to slices through actions, not `set` directly.**
12. **`tsconfig.app.json` MUST set `"noEmit": true` in a Vite project** to prevent IDE-driven `tsc` from emitting `.js` siblings.
13. **Per-task reviews are narrow by design — final cross-cutting review catches what they can't.** Phase 5's final review caught C-1 (test brittleness latent until Motion lands) and C-2 (popup invariant deserves promotion to JSDoc).
14. **AffixKind / SkillNodeId / ViewId strings are persisted** — renames require save migration. JSDoc above each warns.
15. **Save-format-binding JSDoc adds zero runtime cost and infinite future safety.**

From Phase 4:

16. **Selectors-only is structural, not stylistic.** `useGameStore.getState()` in render is forbidden under cross-mounted-component models. WorkshopPopup mounts alongside PaintingView and follows the rule via per-field `useGameStore` selectors. The one allowed exception is inside Hoverable factory callbacks, which run at hover time (event-handler context). Codified in `docs/agent_docs/ui-patterns.md`.
17. **Helper signatures over `GameStore` create cast-debt at call sites.** `getCurrentSlotCount(helperState)` in WorkshopPopup builds `{ purchasedNodes } as unknown as GameStore`. Still deferred — small refactor whenever a phase next touches `multipliers.ts` / `treeSlice.ts` / `workshopSlice.ts` / `ascend.ts` together.
18. **Tailwind 4 JIT picked up runtime-concatenated class strings without a safelist.** Continues to work in Phase 5 — no new safelist directives needed.
19. **`@testing-library/jest-dom` matchers under `verbatimModuleSyntax` need their types in `tsconfig.app.json`'s `types` array.** Already wired; Phase 5 inherited.
20. **RTL 16 + Vitest globals auto-cleanup between tests.** Phase 5 followed; no `afterEach(cleanup)` blocks added.
21. **Exhaustive `switch (currentView)` over a `ViewId` literal union** continues to give compile-time view coverage in `App.tsx`.
22. **`InfoPanel`'s `min-h-16` reserves height for empty-state strips.** Phase 5 confirmed: layout doesn't shift as content arrives via Hoverable.
23. **`data-testid` survives Tailwind class churn.** Phase 5 widgets follow this; the C-1 fix added `data-testid="workshop-popup-card"` precisely because relying on DOM order is fragile under Motion wrapping.

---

## New lessons from Phase 5 + carry-over execution

1. **Hoverable factory callbacks are the I-1-compliant escape hatch for live values.** Static `body="…"` is fine for concept text; for live numbers (gold cost, current inspi/sec, palier preview), use `body={() => <…/>}`. The factory runs at hover time — event-handler context — so it's allowed to call `useGameStore.getState()` inside the callback body. Without this, every Hoverable with live values would have to subscribe in its parent and pass values down, defeating Hoverable's drop-in nature.

2. **Block-level children inside Hoverable need `as="div"`.** React's `validateDOMNesting` warns when a `<span>` wraps `<h2>` / `<p>` / `<section>`. Phase 5 followed-up adding `as?: "span" | "div"` so a single prop gates the choice — defaults to `span` for the common inline-button case, callers opt into `div` when wrapping headings or sections.

3. **Transient UI state is a separate slice.** `workshopPopupOpen` belongs in `uiSlice`, not in `workshopSlice` (which is gameplay state). The split keeps `partialize` strip surgical — strip the entire `uiSlice` on persist, never wonder which workshopSlice fields are transient. Pattern scales: a future `popupId` enum or `Set<PopupId>` lives here too.

4. **Popup mount goes inside `<main>` (relative parent), not at the root.** WorkshopPopup uses `absolute inset-0` to fill the view area. Mounting at App root would either cover the TopBar/BottomBar (wrong) or require a custom z-index ladder. Mounting inside `<main className="relative …">` constrains the backdrop to the gameplay region — TopBar/BottomBar stay interactive even when the popup is open.

5. **Auto-close-on-view-change is a load-bearing invariant, not a convenience.** The popup's only entry point is the PaintingView Workshop button. If a future flow (e.g., a TopBar shortcut, a tutorial step, a tip-link) opens it from a non-painting view, the auto-close `useEffect` will close it on mount. C-2 hoisted this contract from an inline comment to a JSDoc `@invariant` block on the `WorkshopPopup` function itself, naming the predicate-relaxation (capture view-at-open in a ref, compare against that) so a future contributor doesn't have to re-derive it.

6. **`data-testid` is the test selector of choice for popup internals.** Selecting via `dialog.firstChild` couples the test to DOM order; the moment Motion wraps the inner card in `<motion.div>`, `firstChild` would point at the motion wrapper, not the original card. C-1 added `data-testid="workshop-popup-card"` specifically to insulate the test from this Phase 6 work. Pattern: any element a test selects via `firstChild` / `nth-child` deserves a testid.

7. **A Hoverable applied at every interactive site is a ~10-call-sites refactor, not a ~50.** The Phase 5 plan correctly scoped the application sites: 4 in HomeView, 1 in PaintingView (Workshop trigger), 1 in AscensionView, 5 in SkillTreeView, 3 in BottomBar = 14 application sites + factory-bodies for the live-value ones. Plan estimate matched execution.

---

## Repo state at handover

- Branch: `main` (tracks `origin/main` at `https://github.com/mitoufle/Artdle-web.git`). Local is **24 commits ahead of origin/main** as of this handover (15 from prior + 9 Phase 5 + this session's Phase 6-opening commits to come); nothing has been pushed yet.
- Most recent commits: see `git log --oneline 12e749b..HEAD` — 9 Phase 5 commits + this session's C-1/C-2 + HANDOVER commits.
- Working tree: clean apart from `.claude/` (untracked, harness-local — do not commit) and `.temp-test.tsx` (do not commit; should be cleaned up before Phase 6 brainstorm wraps).
- Bundle: `dist/index.html` 0.29 KB gzipped, CSS 3.75 KB gzipped, JS 82.77 KB gzipped — total **~86.8 KB gzipped**. Well under the 250 KB DoD budget.

Versions still per `VERSIONS.md`. No new dependencies added in Phase 5.

---

## Known low-priority issues (carried forward)

From Phase 0+1: pre-existing `react-refresh/only-export-components` warning on `main.tsx`; `public/assets/artdle/` `.png.import` sidecar files; React Compiler dropped during Phase 0+1.

From Phase 2 final review (deferred to Phase 6 polish): `persistedAdapter.flush()` calls in `main.tsx` lack `.catch()`; `console.error` in throttle has no telemetry sink; canvas tests case 9 near-duplicate; tickAll test mixes 3 assertions; visibilitychange listener in two places. **Phase 6 is the right window to address the polish cluster — bundle them with the Motion / balance work.**

From Phase 3 final review (still deferred — Minor): `void set;` YAGNI in `performAscendOrchestrator`; `workshopSlice.test.ts` determinism test doesn't pin a concrete `(kind, magnitude)` tuple; Better Brush range test doesn't actively prove the ceiling moved; `metaSlice.test.ts` has a "DO NOT call performAscend in this describe" risk for future contributors.

From Phase 4 + carry-over execution (still deferred — Minor):
- **Helper-signature narrow refactor** — `getInspiMultiplier`, `getCanvasGoldMultiplier`, `getPaintTimeMultiplier`, `getEquippedContribution`, `getCurrentSlotCount`, `getProducingParts`, `canGrowSapling`, `getTotalLevelsInStage`, `canAscend`, `getEffectivePalier` could each take `Pick<GameStore, K>` of their actual reads instead of the full `GameStore`. Touch when next visiting `multipliers.ts` / `treeSlice.ts` / `workshopSlice.ts` / `ascend.ts` for unrelated reasons.
- **`HomeView`'s `flatMap` over stages** rebuilds the part list on every render. Memoize via `useMemo` keyed on `(currentStage, partLevels)` if Phase 1.x expands the stage count.
- **`PaintingView`'s `equippedItems.map((item, idx) => <li key={idx}>…)`** uses index keys. Safe today; if Phase 5+ introduces drag-to-reorder in equipped slots, switch to stable item identity.

From Phase 5 final cross-cutting review (deferred to **future** phases — not Phase 6):
- **`uiSlice` → `Set<PopupId>` migration** when v2.0+ adds a 2nd popup. Today the boolean field works because there's exactly one popup. The moment a 2nd popup ships (e.g., Painter's Office details, Workshop tutorial, settings modal), refactor to a popup-id-set so multiple popups can coexist or a single-active-popup invariant can be enforced centrally.
- **Stable-identity keys for inventory / equipped maps** before v1.5 drag-to-reorder. WorkshopPopup currently uses `key={idx}` for `inventory.map` and `equippedItems.map`. v1.5+ drag-to-reorder will require switching to a stable item identity (item objects are immutable — object identity is fine, or add an explicit `id: string` field to Item).

---

## Forward-compat seams baked in for Phase 6

- **Motion is installed** — `package.json` already lists it. Phase 6 imports from `motion/react`.
- **WorkshopPopup's inner card has `data-testid`** — Motion wrapping won't break the existing test.
- **`InfoPanel` + `BottomBar` reserve heights** — Motion inside the gameplay views can mount/unmount without shifting the chrome.
- **All `workshopSlice` / tree / ascend verbs return boolean** — Motion exit/enter hooks can drive off these state transitions cleanly (`AnimatePresence` keys on the count of items added, e.g.).
- **`canvas` progress is plain CSS `width: ${pct}%`** — per spec §5.13 do NOT swap this for Motion. Keep the existing implementation.
- **`balance.ts` formulas are 100% Vitest-covered** — Phase 6 balance constants change in tandem with their tests; no formula change can land silently.
- **README is the only un-shipped artifact** — write-up + production-build verification + `v1.0` tag are the closing rituals.

---

## How to start Phase 6

In a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 6 (Motion polish + balance pass + ship v1.0). Use the brainstorming skill to scope it (Motion targets, balance tuning, the 3-affix expansion question, README, v1.0 tag), then writing-plans to produce the next plan in `docs/superpowers/plans/`, then executing it via subagent-driven-development.

Phase 6 is the v1.0 ship phase: Motion polish targeted (per PORT_PLAN §5.13), balance tuning to hit the 5–15 min first-ascend target, optional 3→5 affix expansion based on playtest, README, production build verification, and the `v1.0` tag.

The view-subscription rule (`docs/agent_docs/ui-patterns.md`) continues to apply to any new components introduced in Phase 6 (likely none — Phase 6 is mostly polish on existing components).
