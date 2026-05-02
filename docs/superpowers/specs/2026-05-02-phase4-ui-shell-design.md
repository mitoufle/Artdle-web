# Artdle Web — Phase 4 Design Spec: UI Shell + 4 View Stubs

**Date:** 2026-05-02
**Phase:** 4 (UI shell + 4 fully-functional view stubs)
**Predecessor:** `2026-05-02-phase3-workshop-ascend-skilltree-design.md` (executed; 204 tests green)
**Successor:** Phase 5 plan (hover-info content wiring + Workshop popup) — written after Phase 4 executes.

This spec is the brainstormed-and-approved design for Phase 4 of the Artdle web port. It is the input to the writing-plans phase, not an implementation plan itself.

---

## 1. Scope and goals

Phase 4 brings the v1 gameplay loop into the browser as a clickable UI:

- App layout shell: `TopBar` / `<main>` / `<InfoPanel>` / `<BottomBar>` vertical column.
- A `viewSlice` with a literal-union `ViewId` and `setView` action.
- Four widgets: `TopBar`, `BottomBar`, `CurrencyDisplay`, `InfoPanel`, `Hoverable` wrapper.
- Four fully-functional views consuming existing slice actions/selectors:
  `HomeView`, `PaintingView`, `AscensionView`, `SkillTreeView`.

**End state:** open `npm run dev` and play the v1 loop end-to-end — grow tree parts, watch the canvas auto-paint, ascend at palier, buy skill nodes after ascending, craft and equip items via the (still functional) Workshop slice actions exposed through DevTools or wired buttons. Only **hover-info content** and the **Workshop crafting popup** remain for Phase 5.

**Verification = `npm run dev` smoke + `npm test` green + `npm run build` clean.**

**Out of scope for Phase 4:**
- Hover content authoring on every interactive element (Phase 5 — `<Hoverable>` is built but not applied).
- Workshop crafting popup (Phase 5 — the button renders disabled in `PaintingView`).
- Motion / animations / balance pass (Phase 6).
- New gameplay logic. All slice actions and selectors used by views are already implemented in Phases 0–3.

---

## 2. Locked design decisions

Settled in the brainstorming session and non-negotiable inputs to the implementation plan:

| # | Decision |
|---|---|
| **D1 — Single Phase 4 plan, not split** | The four views, four widgets, layout shell, and `viewSlice` ship in one plan. Each view is small (one slice + a handful of buttons) so per-task commits stay bite-sized; splitting into 4a/4b adds review overhead with no scope-control benefit. |
| **D2 — Views are fully functional, not bare placeholders** | At end of Phase 4 the v1 gameplay loop is end-to-end clickable in the browser. Each view consumes its slice's existing actions (`buyPartLevel`, `growSapling`, `performAscend`, `buyNode`) and `can*` selectors. Bare placeholders would block end-to-end smoke testing of Phases 0–3. |
| **D3 — `ViewId` is a literal union, persisted** | `currentView: "home" \| "painting" \| "ascension" \| "skills"` for compile-time typo protection (Phase 3 lesson — same pattern as `SkillNodeId`, `AffixKind`). Persisted via the existing `partialize` (no exclusion). Refresh preserves the player's view. |
| **D4 — TopBar holds the view nav** | Per PORT_PLAN §7 wording (`TopBar / <main> / InfoPanel / BottomBar`). Four buttons in the TopBar; active button gets `bg-app-panel`. No router. |
| **D5 — InfoPanel renders empty in Phase 4 with reserved height** | Reads `hoverTitle` / `hoverBody` / `hoverFooter` from `hoverInfoSlice`. Renders nothing if all three are empty, but the strip's vertical height is fixed (e.g. `min-h-16`) so Phase 5 only fills it without changing layout. |
| **D6 — `<Hoverable>` is built but not applied in Phase 4** | The wrapper component exists with its push/clear contract tested. No view template in Phase 4 wraps any element with it. Phase 5 does the application work. |
| **D7 — Workshop button is a disabled stub** | Renders in `PaintingView`, `disabled`, with the same position and label that Phase 5 will reuse for the popup trigger. Stabilizes the layout for Phase 5 and tells the player the feature exists. |
| **D8 — Test scope: PORT_PLAN's "sparse" + 2 additions** | Per PORT_PLAN §7: `BottomBar` renders 3 currencies; `AscensionView` gates ascend below palier. Plus: `viewSlice.setView` round-trip, `<Hoverable>` push/clear (since the wrapper is built and Phase 5 will reuse without re-testing). 4 new test files, 6–8 tests. |
| **D9 — Visual style: theme-token-aligned, no animation** | Use `bg-app-bg`, `bg-app-panel`, `text-app-text`, `text-gold` / `text-inspiration` / `text-fame` from `index.css`. No motion library use, no fancy transitions — Phase 6 polish. |
| **D10 — Selectors only; never whole-store subscription** | Every view subscribes via `useGameStore((s) => s.field)`. No view ever calls `useGameStore()`. Same discipline as the existing slices. Buttons gate via `disabled={!canX(state)}`. |

---

## 3. File layout

### New files

```
src/
├── store/
│   └── viewSlice.ts                       [NEW]    currentView + setView
├── ui/
│   ├── views/
│   │   ├── HomeView.tsx                   [NEW]    tree + part upgrades + grow button
│   │   ├── PaintingView.tsx               [NEW]    canvas slot + workshop button (stub)
│   │   ├── AscensionView.tsx              [NEW]    palier + fame preview + ascend button
│   │   └── SkillTreeView.tsx              [NEW]    5 nodes, linear chain
│   └── widgets/
│       ├── TopBar.tsx                     [NEW]    title + 4 nav buttons
│       ├── BottomBar.tsx                  [NEW]    3 currency displays
│       ├── CurrencyDisplay.tsx            [NEW]    icon + label + formatted value
│       ├── InfoPanel.tsx                  [NEW]    reads hoverInfoSlice; empty in P4
│       └── Hoverable.tsx                  [NEW]    mouseenter/leave wrapper

tests/
├── store/
│   └── viewSlice.test.ts                  [NEW]    setView round-trip
└── ui/
    ├── widgets/
    │   ├── BottomBar.test.tsx             [NEW]    renders 3 currencies (formatted)
    │   └── Hoverable.test.tsx             [NEW]    push on enter, clear on leave
    └── views/
        └── AscensionView.test.tsx         [NEW]    ascend button gating below/above palier
```

### Modified files

```
src/
├── App.tsx                                [REWRITE] full body — replaces v0.1 scaffold
└── store/
    └── index.ts                           [EDIT]    wire createViewSlice into combined store
```

`src/main.tsx`, `src/ui/widgets/LoadingScreen.tsx`, `src/index.css`, and `tsconfig*.json` are **not** touched.

---

## 4. `viewSlice` contract

```ts
// src/store/viewSlice.ts

export type ViewId = "home" | "painting" | "ascension" | "skills";

export interface ViewSlice {
  /** Persisted last-active view. Default "home" on first launch. */
  currentView: ViewId;
  /** Sets the active view. No validation needed — TS literal union enforces. */
  setView: (v: ViewId) => void;
}
```

- Default initial state: `currentView: "home"`.
- Persisted (no `partialize` change required — `currentView` is a primitive string).
- No reset action: ascend does **not** reset the view (UX choice — the player stays where they were).
- One test file: `tests/store/viewSlice.test.ts` asserts `setView` round-trips through all four ids.

---

## 5. Component contracts

### `<App>` (rewritten)

```tsx
<div className="flex h-screen w-screen flex-col bg-app-bg text-app-text">
  <TopBar />
  <main className="flex-1 overflow-auto">{viewBody}</main>
  <InfoPanel />
  <BottomBar />
</div>
```

`viewBody` is a switch on `currentView` rendering one of four `<View>` components. No router, no lazy-loading.

### `<TopBar>`

- Reads `currentView`, calls `setView`.
- Renders the title `Artdle` and four buttons: `Home`, `Painting`, `Ascension`, `Skills`.
- Active button: `bg-app-panel`. Inactive: muted (e.g. `opacity-60`).
- Each button is a `<button>` with `aria-pressed={currentView === id}` for accessibility.

### `<BottomBar>`

- Wraps three `<CurrencyDisplay>` instances horizontally:
  - `<CurrencyDisplay kind="gold" />`
  - `<CurrencyDisplay kind="inspiration" />`
  - `<CurrencyDisplay kind="fame" />`

### `<CurrencyDisplay kind>`

```ts
interface Props {
  kind: "gold" | "inspiration" | "fame";
}
```

- Reads the named field from currency slice (`useGameStore((s) => s[kind])`).
- Renders a colored label (`text-gold` / `text-inspiration` / `text-fame`) + `format(value)` from `core/formatter.ts`.
- No icons in Phase 4 (text-only — Phase 6 polish).

### `<InfoPanel>`

- Reads `hoverTitle`, `hoverBody`, `hoverFooter` from `hoverInfoSlice`.
- Renders a fixed-height strip (`min-h-16` or similar) with `bg-app-panel`. Always renders all three fields; when they hold empty strings (default after `clearHoverInfo`) the strip looks empty but its height is reserved.
- Body and footer are `ReactNode`, so `{hoverBody}` and `{hoverFooter}` render JSX directly when Phase 5 starts pushing live-value callbacks.
- No animation, no transition — straightforward DOM render.
- No props.

### `<Hoverable>`

```tsx
interface Props {
  title: string;
  body: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

// On mouse enter: pushHoverInfo(title, body, footer ?? "")
// On mouse leave: clearHoverInfo()
```

- Matches the existing `hoverInfoSlice` contract: `pushHoverInfo(title, body, footer)` (positional, all required at the slice level — wrapper supplies `""` when callers omit `footer`). Body and footer accept any `ReactNode`, not just strings, so Phase 5 can pass JSX (live-updating values).
- Wraps `children` in a `<span>` so it doesn't break inline layouts. Use `display: contents` if the wrapper would interfere with grid/flex children — decide during implementation if the issue arises.
- Built and tested in Phase 4. **Not applied to anything in Phase 4 templates.** Phase 5 wraps every interactive element.

### `<HomeView>`

- Reads from tree slice: `currentStage`, `partLevels`. Calls `canGrowSapling(state)` and `getProducingParts(state)` selectors.
- Computes the displayed inspiration-per-second locally via `inspiPerSec(getProducingParts(state), getInspiMultiplier(state))` from `core/balance.ts` + `core/multipliers.ts` (the same call site `treeTick` uses, so the displayed value matches what's actually being credited).
- Renders:
  - Stage name (Seed / Sapling / Tree) — read from `TREE_STAGES[currentStage].name`.
  - Inspiration-per-second readout, `format()`-ed via `core/formatter.ts`.
  - For each stage `0..currentStage` and each part on those stages: name, current level (from `partLevels[id] ?? 0`), next-level cost (`treePartCost(...)` or whatever the slice already exposes — reuse the same call site `buyPartLevel` uses), "Buy" button.
    - Button `disabled` if `gold.lt(cost)`.
    - Button calls `buyPartLevel(partId)`.
  - "Grow" button visible iff `canGrowSapling(state)` returns true. Calls `growSapling()`.

### `<PaintingView>`

- Reads from canvas slice: `canvasState` (`idle | painting | done | autoSale`), `paintProgressSeconds`.
- Reads from workshop slice: `equippedItems`.
- Renders:
  - State badge.
  - Paint-progress display (e.g. `2.4 / 10.0s`). Phase 4 doesn't need a fancy progress bar — text suffices.
  - Equipped items section: list of equipped items (kind + magnitude), or "no item equipped" placeholder.
  - "Workshop" button — `disabled`, with text indicating "(coming soon)" or similar.

### `<AscensionView>`

- Reads `inspiration`, `ascendCount`, `fame`.
- Reads `getEffectivePalier(state, ascendCount)` and `canAscend(state)` from `systems/ascend.ts`.
- Reads `fameOnAscend(state.inspiration)` from `core/balance.ts` for the gain preview.
- Renders:
  - Current palier threshold (`getEffectivePalier`).
  - Current `inspiration` (formatted) vs threshold.
  - Fame gain preview (`fameOnAscend`).
  - `ascendCount` and current `fame`.
  - "Ascend" button — `disabled={!canAscend(state)}`. Calls `performAscend()`.
- This view is the test target for ascend-button gating (`AscensionView.test.tsx`).

### `<SkillTreeView>`

- Reads `purchasedNodes`, `fame`.
- Reads `canBuyNode(state, id)` and `hasNode(state, id)` selectors.
- Renders the 5 nodes in a vertical or horizontal chain (vertical is simpler for v1):
  - For each node: name, fame cost, status badge (Locked / Available / Purchased).
  - "Buy" button: `disabled={!canBuyNode(state, id)}`. Calls `buyNode(id)`.

---

## 6. Test scope

| File | Tests |
|---|---|
| `tests/store/viewSlice.test.ts` | `setView("home")` → `currentView === "home"`. Same for `"painting"`, `"ascension"`, `"skills"`. Default state is `"home"`. |
| `tests/ui/widgets/BottomBar.test.tsx` | Mounts `<BottomBar>` after seeding `useGameStore.setState({ gold: big(1234), inspiration: big(56), fame: big(7) })`. Asserts the rendered text contains formatted "1.23K", "56", and "7". |
| `tests/ui/widgets/Hoverable.test.tsx` | Mounts `<Hoverable title="T" body="B"><span>X</span></Hoverable>`. Fires `mouseenter` → asserts `useGameStore.getState().hoverTitle === "T"` and `hoverBody === "B"`. Fires `mouseleave` → asserts hover fields are cleared (empty strings per `clearHoverInfo` contract). |
| `tests/ui/views/AscensionView.test.tsx` | Two cases: (1) inspiration < palier → button is `disabled`. (2) inspiration >= palier → button is enabled. Optionally a third: clicking the enabled button calls `performAscend` and the inspiration drops to 0. |

**Test budget delta:** existing 204 → ~210–212 after Phase 4. Sparse, per PORT_PLAN §6.

**Setup notes:**
- UI tests use `@testing-library/react` (already installed Phase 0) on `jsdom`.
- Each UI test wraps mount in a `beforeEach` that calls `useGameStore.setState(initialStateForTest)` so the singleton is reset between cases. Use the existing reset pattern in `tests/store/*.test.ts` as reference.
- No mocking of slices — tests interact with the real store, then assert DOM output.

---

## 7. Forward-compat seams (for Phase 5 / Phase 6)

- **`<Hoverable>` wrapper is API-stable.** Phase 5 wraps interactive elements without any wrapper changes.
- **`<InfoPanel>` reserves height when empty.** Phase 5 fills it with hover content; layout doesn't shift.
- **Workshop button position is locked into `<PaintingView>`.** Phase 5 only swaps the disabled stub for a popup-trigger handler.
- **`viewSlice` is a single-field slice.** Future views (e.g. a standalone Workshop view if it ever gets promoted from popup) just extend the `ViewId` literal and add a case to the App's view switch.
- **All slice actions return `boolean` already.** Phase 4 ignores the return values for simplicity; Phase 5+ can use them for instant click feedback (e.g. shake animation on failed buy) without changing slice signatures.

---

## 8. Definition of done

1. `npm run dev` boots the App shell. All four view tabs switch the main panel without page reload.
2. From a fresh save, the player can play the v1 loop end-to-end in the browser:
   - HomeView: buy parts → tree fills → grow Sapling → grow Tree → inspiration accrues.
   - PaintingView: canvas auto-paints, gold credited on auto-sell.
   - AscensionView: at palier, "Ascend" button enables; clicking it performs the ascend (inspiration → 0, fame credited, ascendCount incremented).
   - SkillTreeView: after ascending, fame can be spent on the first available skill node.
   - PaintingView: equipped items (rolled via DevTools `useGameStore.getState().craft()` + `equip(0)`) show in the equipped section.
3. `npm test` green: 210–212 tests passing, of which 6–8 are new in Phase 4.
4. `npm run lint` clean: 0 new warnings (the pre-existing `react-refresh/only-export-components` warning on `main.tsx` may persist).
5. `npm run build` produces a clean `dist/` without errors.
6. `tsc -p tsconfig.app.json` clean (type-only — no emit per Phase 3 fix).
7. Currency values render through `core/formatter.ts` (no raw `1234567` displayed anywhere).
8. Refresh while on `SkillTreeView` returns to `SkillTreeView` after rehydration (persistence verified end-to-end).
9. `playerId` continues to be preserved across the ascend triggered via UI (same as Phase 3's test, but now driven by a real button click).

---

## 9. Risks / things to watch

- **Zustand re-render storm.** Every component must use selectors. A test or scrap component using `useGameStore()` (no selector) re-renders every tick and tanks FPS. Lint can't catch this — review discipline.
- **Persisting `currentView` interacts with the existing `partialize`.** The current `partialize` strips hover-info fields; `currentView` should not be in the strip list. Verify.
- **Test brittleness via DOM string matching.** Asserting "1.23K" appears in the DOM is fine; asserting on full HTML strings is not. Use `screen.getByText` or `toHaveTextContent`.
- **`<Hoverable>` should `<span>` not `<div>`.** A `<div>` wrapper around an inline-level child like `<button>` is fine but a `<span>` plays nicer when wrapping inline text. Pick one and document it.
- **No router means no deep-linkable view.** Acceptable for v1; documented as a v2.x concern.
- **`tickAll` order is unaffected.** No new tickable slice in Phase 4.

---

## 10. References

- `docs/PORT_PLAN.md` §7 (Phase 4 spec) and §4 (project layout under `src/ui/`).
- `docs/HANDOVER.md` (post-Phase-3 state and forward-compat seams baked into Phase 0–3 for Phase 4 to consume).
- Existing slices and selectors: `src/store/treeSlice.ts`, `src/store/canvasSlice.ts`, `src/store/workshopSlice.ts`, `src/store/skillTreeSlice.ts`, `src/systems/ascend.ts`, `src/core/balance.ts`, `src/core/formatter.ts`.
