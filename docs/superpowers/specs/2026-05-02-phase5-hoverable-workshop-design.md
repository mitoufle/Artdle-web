# Artdle Web — Phase 5 Design Spec: Hoverable Wiring + Workshop Popup

**Date:** 2026-05-02
**Phase:** 5 (Hover-info wiring on every interactive element + WorkshopPopup)
**Predecessor:** `2026-05-02-phase4-ui-shell-design.md` (executed; 220 tests green; carry-overs I-1/M-1/M-2 addressed before this phase)
**Successor:** Phase 6 plan (Motion polish + balance pass + ship v1.0)

This spec is the brainstormed-and-approved design for Phase 5 of the Artdle web port. It is the input to the writing-plans phase, not an implementation plan itself.

---

## 1. Scope and goals

Phase 5 turns the Phase 4 shell into a **fully informative** v1 UI by wiring hover content on every interactive element via the existing `<Hoverable>` wrapper, and lights up the **Workshop crafting popup** so the player can craft, equip, unequip, and discard items end-to-end inside the browser without DevTools.

- **Hoverable signature extended** to support callback factories (`string | (() => string)`, `ReactNode | (() => ReactNode)`) so live values can be authored inline without forcing the host view to subscribe to every hover-only field.
- **`<Hoverable>` applied** to: HomeView part Buy buttons, Grow button, stage-name header, inspi/sec readout; AscensionView Ascend button; SkillTreeView each node Buy button; BottomBar each currency display; PaintingView Workshop button; WorkshopPopup Craft button + each inventory card + each equipped card.
- **Hover content authored** per `docs/specs/2026-04-25-info-panel-design.md` §6 rules: numbers always, costs always, state always, concept entries explain what-it-IS + what-it-gives. English only (project D6).
- **`uiSlice`** introduced: transient slice for popup-open state. Single field `workshopPopupOpen: boolean` + `openWorkshopPopup` / `closeWorkshopPopup` actions. Excluded from `partialize` — refresh closes the popup.
- **`WorkshopPopup`** new component at `src/ui/popups/WorkshopPopup.tsx`: modal overlay over `<main>` (TopBar / InfoPanel / BottomBar remain visible). Two-column layout (Inventory left, Equipped right) under a header with Craft + cost. Esc and backdrop-click dismiss. PaintingView's Workshop stub button un-disabled to call `openWorkshopPopup()`.
- **Tests:** uiSlice unit (3 cases), Hoverable callback variants (3 new cases extending the existing test), WorkshopPopup integration (10 cases — see §6.3 for the full list), persistence-integration extension (1 case asserting `workshopPopupOpen` is stripped). **Net new 17 tests; total post-Phase-5 = 237.**

**End state:** open `npm run dev`, hover any interactive element to see explanatory info in the InfoPanel strip, click the Workshop button on PaintingView to open the popup, craft / equip / unequip / discard items, close the popup via Esc or backdrop. Equipped items continue to apply their multipliers to canvas/tree (already wired in Phase 3). Refresh closes the popup; everything else persists.

**Verification = `npm test` green + `npx tsc -b --noEmit` clean + `npm run lint` clean (1 pre-existing warning) + `npm run build` clean (target <100 KB gzipped JS) + manual `npm run dev` smoke per §8.**

**Out of scope for Phase 5:**
- Motion / animations (Phase 6).
- Balance pass — affix magnitudes, costs, palier scaling stay at Phase 3 values (Phase 6).
- Icons in hover content. The Godot info-panel spec §3.3 has an `Icons` registry that emits BBCode `[img]` strings; the web port has no icon registry yet. Hover content uses text labels (`"gold"`, `"inspi"`, `"fame"`) instead. An icon registry is a Phase 6 nice-to-have or deferred to a wave.
- Hoverable on TopBar nav buttons, AscensionView read-only sections, Canvas slot in PaintingView, PaintingView's mirrored Equipped list. (Either redundant with another hover, or label-self-explanatory — see §2 D4.)
- Focus trap inside the popup. v1 ships without a focus-trap library; popup is keyboard-dismissible via Esc and that's enough for v1. Add focus-trap if accessibility QA flags it during Phase 6.
- Drag-and-drop inventory ↔ equipped. v1 uses click-to-equip / click-to-unequip. `@dnd-kit` arrives in v1.5 per PORT_PLAN §3.1.
- The `swap` workshop verb (Phase 3 backend has it; Phase 5 popup doesn't expose it — niche convenience for the 2-equipped-slot endgame, deferred unless playtest flags it).

---

## 2. Locked design decisions

Settled during the brainstorming session. Non-negotiable inputs to the implementation plan.

| # | Decision |
|---|---|
| **D1 — WorkshopPopup is a modal overlay over `<main>` only** | TopBar, InfoPanel, and BottomBar stay visible while the popup is open. Semi-transparent backdrop covers the view area only. Esc and backdrop-click dismiss. Preserves the InfoPanel as the global hover surface (the entire point of Phase 5 wiring) and matches the v1 spec's "popup" mental model. Sets the pattern for any future popup. |
| **D2 — Hoverable signature extended to support factory callbacks** | `title: string \| (() => string)`, `body: ReactNode \| (() => ReactNode)`, `footer?: ReactNode \| (() => ReactNode)`. Factories resolve inside `onMouseEnter` via `useGameStore.getState()` — event-handler context, satisfies the I-1 view-subscription rule. Existing static-string usage continues to type-check (strict superset). Decouples hover content from host-view subscription set: views don't have to subscribe to `ascendCount` or `palier` just to display them in a hover. |
| **D3 — Popup-open state lives in a new `uiSlice`** | Mirrors `hoverInfoSlice`'s shape: transient slice, fields stripped from `partialize`. Single boolean field `workshopPopupOpen` for v1; future popups (v2.0+) extend with their own flags or a `Set<PopupId>` if the count grows. Avoids stretching `viewSlice`'s "what view is mounted" concept and avoids prop-drilling between PaintingView (sets the flag) and App.tsx (reads the flag). |
| **D4 — Hoverable scope is the PORT_PLAN list + popup-internal items + 2 HomeView concept entries** | **In:** HomeView part Buy buttons, Grow button, stage-name header, inspi/sec readout; AscensionView Ascend button; SkillTreeView each node Buy button; BottomBar each currency display; PaintingView Workshop button; WorkshopPopup Craft button + each inventory card + each equipped card. **Out:** TopBar nav buttons (labels self-explanatory; Godot §10 also excludes), AscensionView Palier/Inspiration/FameGain readout sections (Ascend-button hover already covers the palier/fame concepts), Canvas slot in PaintingView (passive, no interactive value), PaintingView's mirrored Equipped list (popup version is the canonical hover surface). |
| **D5 — Workshop popup exposes 4 verbs: craft, equip, unequip, discard** | Phase 3 backend has 5 verbs (also `swap`). Popup skips `swap` for v1 because (a) it's a 2-equip-slot convenience and most v1 players play with 1 slot, (b) the same effect is reachable via unequip-then-equip with 1 click of overhead. Adding `swap` is a 1-line UI addition if playtest flags the pain. |
| **D6 — Test scope: 17 new tests across 3 new files + 2 extensions** | uiSlice unit (3 cases — defaults, open, close); Hoverable callback variants (3 new it() blocks extending `tests/ui/widgets/Hoverable.test.tsx`); WorkshopPopup integration (10 cases — see §6.3); persistence-integration extension (1 case — `workshopPopupOpen` is stripped from save). Net new 17; total post-Phase-5 = 237. |

---

## 3. File layout

### New files

```
src/
├── store/
│   └── uiSlice.ts                          [NEW]    workshopPopupOpen + open/close
├── ui/
│   └── popups/
│       └── WorkshopPopup.tsx               [NEW]    modal: craft + inventory + equipped

tests/
├── store/
│   └── uiSlice.test.ts                     [NEW]    open/close + default
└── ui/
    └── popups/
        └── WorkshopPopup.test.tsx          [NEW]    craft / equip / unequip / discard / dismiss
```

### Edited files

```
src/store/index.ts                          edit  wire createUiSlice + add workshopPopupOpen to partialize strip
src/ui/widgets/Hoverable.tsx                edit  Props union (string | (() => string)) etc. + resolve in handler
src/App.tsx                                 edit  conditionally render <WorkshopPopup /> over <main>
src/ui/views/HomeView.tsx                   edit  wrap part Buy buttons, Grow button, stage header, inspi/sec readout
src/ui/views/PaintingView.tsx               edit  un-disable Workshop button + onClick + wrap with Hoverable
src/ui/views/AscensionView.tsx              edit  wrap Ascend button
src/ui/views/SkillTreeView.tsx              edit  wrap each node Buy button
src/ui/widgets/CurrencyDisplay.tsx          edit  wrap with Hoverable (per-currency hover content)

tests/ui/widgets/Hoverable.test.tsx         edit  add 3 cases for callback variants
tests/store/persistence-integration.test.ts edit  add 1 case for workshopPopupOpen strip
```

### Module boundary contract

- `store/uiSlice.ts`: imports nothing from other slices. Exports `UiSlice`, `createUiSlice`, `initialUiState`.
- `ui/popups/WorkshopPopup.tsx`: imports `useGameStore`, `formatBig`, `Hoverable`, `CRAFT_COST_GOLD` + `MAX_INVENTORY_SLOTS` from `workshopAffixes`, and `getCurrentSlotCount` selector. Reads: `inventory`, `equippedItems`, `gold`, `purchasedNodes` (via `getCurrentSlotCount`), `workshopPopupOpen`. Writes via actions: `craft`, `equip`, `unequip`, `discard`, `closeWorkshopPopup`.
- `ui/widgets/Hoverable.tsx`: imports `useGameStore` only (calls `pushHoverInfo` / `clearHoverInfo`). Props union; no other API change.
- `App.tsx`: existing imports + `WorkshopPopup`. Subscribes to `workshopPopupOpen`. Renders `<WorkshopPopup />` as a sibling of `<main>` only when open.
- All view edits: existing imports + `Hoverable`. Each Hoverable application is local to the wrapped element; no new cross-slice imports.

---

## 4. Component contracts

### 4.1 `uiSlice`

```ts
export interface UiState {
  /** Transient — stripped from partialize. Refresh closes the popup. */
  workshopPopupOpen: boolean;
}

export interface UiSlice extends UiState {
  openWorkshopPopup: () => void;
  closeWorkshopPopup: () => void;
}

export const initialUiState: UiState = Object.freeze({
  workshopPopupOpen: false,
}) as UiState;

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  ...initialUiState,
  openWorkshopPopup: () => set({ workshopPopupOpen: true }),
  closeWorkshopPopup: () => set({ workshopPopupOpen: false }),
});
```

Wired into `GameStore` union after `ViewSlice`. `partialize` extends its strip list:

```ts
const { hoverTitle: _t, hoverBody: _b, hoverFooter: _f, workshopPopupOpen: _w, ...rest } = s;
```

### 4.2 `Hoverable` (modified)

```tsx
interface Props {
  title: string | (() => string);
  body: ReactNode | (() => ReactNode);
  footer?: ReactNode | (() => ReactNode);
  children: ReactNode;
}

const resolve = <T,>(v: T | (() => T)): T =>
  typeof v === "function" ? (v as () => T)() : v;

export function Hoverable({ title, body, footer, children }: Props): JSX.Element {
  const pushHoverInfo = useGameStore((s) => s.pushHoverInfo);
  const clearHoverInfo = useGameStore((s) => s.clearHoverInfo);
  return (
    <span
      onMouseEnter={() =>
        pushHoverInfo(resolve(title), resolve(body), resolve(footer ?? ""))
      }
      onMouseLeave={() => clearHoverInfo()}
    >
      {children}
    </span>
  );
}
```

Strict-superset change. Existing call sites with `title="Ascend"` / `body="…"` continue to type-check (string is assignable to `string | (() => string)`). Factory callsites use `body={() => <span>{formatBig(useGameStore.getState().gold)}</span>}`.

### 4.3 `WorkshopPopup`

Top-level structure (Tailwind 4 utility classes; `bg-app-panel`, `bg-app-bg`, theme tokens per Phase 4 D9):

```tsx
export function WorkshopPopup(): JSX.Element | null {
  const open = useGameStore((s) => s.workshopPopupOpen);
  const close = useGameStore((s) => s.closeWorkshopPopup);
  // Subscribe to every field the popup reads — I-1 rule.
  const inventory = useGameStore((s) => s.inventory);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const gold = useGameStore((s) => s.gold);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const craft = useGameStore((s) => s.craft);
  const equip = useGameStore((s) => s.equip);
  const unequip = useGameStore((s) => s.unequip);
  const discard = useGameStore((s) => s.discard);

  // Esc handler — only mounted while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Auto-close when the user navigates away from PaintingView via TopBar.
  // Popup's open trigger is the PaintingView Workshop button, so on first
  // mount currentView === "painting" and this is a no-op. Switching views
  // afterwards clears the popup so it doesn't hover over an unrelated view.
  const currentView = useGameStore((s) => s.currentView);
  useEffect(() => {
    if (open && currentView !== "painting") close();
  }, [open, currentView, close]);

  if (!open) return null;

  const slotCount = getCurrentSlotCount({ purchasedNodes } as unknown as GameStore);
  const canCraft = gold.gte(big(CRAFT_COST_GOLD)) && inventory.length < MAX_INVENTORY_SLOTS;
  const canEquipMore = equippedItems.length < slotCount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workshop-popup-title"
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/60"
      onClick={close}
    >
      <div
        className="w-[min(720px,90%)] max-h-[90%] overflow-auto rounded-lg bg-app-bg border border-app-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-app-panel px-4 py-2">
          <h2 id="workshop-popup-title" className="text-lg font-semibold">Workshop</h2>
          <button type="button" onClick={close} aria-label="Close workshop"
            className="rounded px-2 py-1 text-sm hover:bg-app-panel">✕</button>
        </header>

        {/* Action strip */}
        <div className="flex items-center gap-3 border-b border-app-panel px-4 py-2">
          <Hoverable title="Craft" body="Spend gold to roll one item with one random affix (5–15% magnitude, +1 with Better Brush)." footer={() => `Cost: ${CRAFT_COST_GOLD} gold · Inventory: ${useGameStore.getState().inventory.length}/${MAX_INVENTORY_SLOTS}`}>
            <button type="button" disabled={!canCraft} onClick={() => craft()}
              className="rounded bg-gold/20 px-3 py-1 text-sm disabled:opacity-40">
              Craft
            </button>
          </Hoverable>
          <span className="text-sm opacity-70">{CRAFT_COST_GOLD} gold</span>
          <span className="text-sm opacity-70">Inventory: {inventory.length}/{MAX_INVENTORY_SLOTS}</span>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-4 p-4">
          <section>
            <h3 className="mb-2 text-sm opacity-70">Inventory</h3>
            {inventory.length === 0 && (
              <div className="text-sm opacity-60">Empty — click Craft to roll an item.</div>
            )}
            <ul className="flex flex-col gap-2">
              {inventory.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <Hoverable
                    title={`${item.kind} ${item.magnitude}%`}
                    body={canEquipMore ? "Click to equip." : "Equipped slots full."}
                  >
                    <button type="button" disabled={!canEquipMore}
                      onClick={() => equip(idx)}
                      className="flex-1 rounded bg-app-panel px-3 py-2 text-left text-sm disabled:opacity-40">
                      {item.kind} {item.magnitude}%
                    </button>
                  </Hoverable>
                  <Hoverable title="Discard" body="Remove this item from inventory.">
                    <button type="button" onClick={() => discard(idx)}
                      aria-label={`Discard ${item.kind} ${item.magnitude}%`}
                      className="rounded bg-app-panel px-2 py-2 text-sm hover:bg-red-900/40">
                      ✕
                    </button>
                  </Hoverable>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm opacity-70">Equipped {equippedItems.length}/{slotCount}</h3>
            {equippedItems.length === 0 && (
              <div className="text-sm opacity-60">No items equipped.</div>
            )}
            <ul className="flex flex-col gap-2">
              {equippedItems.map((item, idx) => (
                <li key={idx}>
                  <Hoverable
                    title={`${item.kind} ${item.magnitude}%`}
                    body="Currently equipped. Click to unequip (returns to inventory)."
                  >
                    <button type="button"
                      disabled={inventory.length >= MAX_INVENTORY_SLOTS}
                      onClick={() => unequip(idx)}
                      className="w-full rounded bg-app-panel px-3 py-2 text-left text-sm disabled:opacity-40">
                      {item.kind} {item.magnitude}%
                    </button>
                  </Hoverable>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
```

Notes:
- The popup root has `position: absolute inset-0`. App.tsx's `<main>` MUST get `relative` for absolute positioning to work. Add `relative` to `<main>`'s className during App.tsx edit.
- `z-10` on the popup keeps it above the view content but below any future toast/snackbar layer.
- Backdrop click: `onClick` on the outer div closes; the inner card calls `e.stopPropagation()` to prevent clicks inside the dialog from bubbling.
- All slice actions are called via subscribed action references (not `useGameStore.getState()` in render) — same pattern as Phase 4 views.
- The popup subscribes to `purchasedNodes` only to feed `getCurrentSlotCount`; helper-state cast follows the I-1 pattern (`docs/agent_docs/ui-patterns.md`).

### 4.4 App.tsx mount point

```tsx
return (
  <div className="flex h-screen w-screen flex-col bg-app-bg text-app-text">
    <TopBar />
    <main className="relative flex-1 overflow-auto">
      {body}
      <WorkshopPopup />
    </main>
    <InfoPanel />
    <BottomBar />
  </div>
);
```

`<WorkshopPopup />` always renders; it returns `null` when closed. The `relative` on `<main>` is the new requirement.

### 4.5 PaintingView Workshop button

Replace the `disabled` stub with a live button wrapped in Hoverable:

```tsx
const openWorkshopPopup = useGameStore((s) => s.openWorkshopPopup);
// …
<Hoverable
  title="Workshop"
  body="Craft items with random affixes. Equip them to boost canvas/tree."
  footer={() => `Inventory: ${useGameStore.getState().inventory.length}/${MAX_INVENTORY_SLOTS}`}
>
  <button
    type="button"
    onClick={() => openWorkshopPopup()}
    className="self-start rounded bg-app-panel px-4 py-2 text-sm hover:bg-app-panel/80"
  >
    Workshop
  </button>
</Hoverable>
```

PaintingView gains a subscription to `openWorkshopPopup`. No other changes.

---

## 5. Hover content authoring

Per `docs/specs/2026-04-25-info-panel-design.md` §6:

1. **Numbers always.** Body includes magnitude and current value.
2. **Costs always.** In `footer` with text label (no icon registry yet — see §1 out-of-scope).
3. **State always.** Current level / count / status / fraction.
4. **Concept entries** explain what-it-IS *and* what-it-gives.
5. **`title`** = label, **`body`** = effect with numbers inline, **`footer`** = cost/state.
6. **Use callbacks** for live values; static strings only for pure concepts.
7. Use `formatBig` for currency-scale values; integer `%` for percentages.

### Per-element content (English; bodies are factories where any value is live)

| Site | title | body (factory if live) | footer |
|---|---|---|---|
| HomeView part Buy button | `() => "<part.name> (Lv N)"` (live N) | `() => "Adds <part.rate> inspi/sec per level (currently +<rate*N> inspi/sec)."` | `() => "Cost: <treePartCost(N, baseCost)> gold"` |
| HomeView Grow button | `"Grow next stage"` | `() => "Levels in current stage: <total>/<threshold>. Click to advance."` | — |
| HomeView stage header | `() => "<TREE_STAGES[currentStage].name>"` | `"Current tree stage. Each part on this stage produces inspiration."` | — |
| HomeView inspi/sec readout | `"Inspiration / sec"` | `() => "Sum of all part levels × rate, then × multipliers (currently ×<getInspiMultiplier(state)>)."` | — |
| AscensionView Ascend button | `"Ascend"` | `() => "Reset the run for permanent fame. Currently gain +<fameOnAscend(state.inspiration)> fame."` | `() => "Palier: <state.inspiration> / <getEffectivePalier(state, state.ascendCount)> inspi"` |
| SkillTreeView each node Buy | `node.name` (static per node) | `() => "<node.effect description>. Status: <Locked|Available|Purchased>."` (status is live) | `"Cost: <node.cost> fame"` (static per node) |
| BottomBar `gold` | `"Gold"` | `() => "Earned by selling paintings. Current: <formatBig(state.gold)>."` | — |
| BottomBar `inspiration` | `"Inspiration"` | `() => "Generated by tree parts. Current: <formatBig(state.inspiration)>. Reset on ascend."` | — |
| BottomBar `fame` | `"Fame"` | `() => "Earned on ascend, spent in skill tree. Current: <formatBig(state.fame)>. Permanent."` | — |
| PaintingView Workshop button | `"Workshop"` | `"Craft items with random affixes. Equip them to boost canvas/tree."` | `() => "Inventory: <state.inventory.length>/3"` |
| WorkshopPopup Craft button | `"Craft"` | `"Spend gold to roll one item with one random affix (5–15% magnitude, +1 with Better Brush)."` | `() => "Cost: 100 gold · Inventory: <state.inventory.length>/3"` |
| Inventory item card | `() => "<item.kind> <item.magnitude>%"` | `() => canEquipMore ? "Click to equip." : "Equipped slots full."` | — |
| Inventory discard `✕` button | `"Discard"` | `"Remove this item from inventory."` | — |
| Equipped item card | `() => "<item.kind> <item.magnitude>%"` | `"Currently equipped. Click to unequip (returns to inventory)."` | — |

**Effect-description strings for each skill node** (used in SkillTreeView body factory):

| Node id | Effect string |
|---|---|
| `goldsmith` | `"+10% gold from canvas sales."` |
| `patient_eye` | `"+15% inspiration generation rate."` |
| `second_slot` | `"Workshop equipment slots: 1 → 2."` |
| `faster_strokes` | `"Ascend palier reduced 10%."` |
| `better_brush` | `"+1 magnitude on workshop item affixes (e.g., 5–15% → 6–16%)."` |

These match the constants in `core/multipliers.ts` and `systems/ascend.ts` (Phase 3). They're authored as a flat `Record<SkillNodeId, string>` in `SkillTreeView.tsx` (or co-located with `SKILL_NODES` in `config/skillTreeNodes.ts` if it keeps the view file leaner — implementation-time choice).

**`getInspiMultiplier(state)` inside HomeView's inspi/sec readout body** uses the helper-state cast pattern from `docs/agent_docs/ui-patterns.md` (HomeView already constructs `helperState` for `getInspiMultiplier`; the hover body factory uses `useGameStore.getState()` to get a fresh snapshot at hover time).

---

## 6. Test scope

### 6.1 New: `tests/store/uiSlice.test.ts`

```ts
describe("uiSlice", () => {
  beforeEach(() => useGameStore.setState({ workshopPopupOpen: false }));
  it("defaults workshopPopupOpen to false", …);
  it("openWorkshopPopup() flips workshopPopupOpen to true", …);
  it("closeWorkshopPopup() flips workshopPopupOpen to false", …);
});
```

3 cases.

### 6.2 Extend: `tests/ui/widgets/Hoverable.test.tsx`

Add 3 new it() blocks (existing 3 cases unchanged):

```ts
it("resolves callback title at hover time", () => {
  // Render <Hoverable title={() => "Live"} body="B">…</Hoverable>;
  // mouseEnter; assert hoverTitle === "Live".
});
it("resolves callback body at hover time using getState()", () => {
  // Render <Hoverable title="T" body={() => "Gold: " + useGameStore.getState().gold.toString()}>…</Hoverable>;
  // setState({ gold: big(42) }); mouseEnter; assert hoverBody === "Gold: 42".
});
it("re-resolves callback on each mouseEnter (post-state-change)", () => {
  // mouseEnter once with gold=10; mouseLeave; setState gold=99; mouseEnter; assert hoverBody === "Gold: 99".
});
```

3 new cases. Total Hoverable test cases: 6.

### 6.3 New: `tests/ui/popups/WorkshopPopup.test.tsx`

```ts
describe("<WorkshopPopup />", () => {
  beforeEach(() => {
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({
      workshopPopupOpen: true,
      gold: big(1000),
      purchasedNodes: {},
    });
    setSeed(42); // determinism for craft RNG
  });

  it("renders nothing when workshopPopupOpen=false", …);
  it("renders Craft, Inventory, Equipped sections when open", …);
  it("disables Craft when gold < 100", …);
  it("Craft click adds an item to inventory", …);
  it("Inventory card click equips the item (moves to equippedItems)", …);
  it("Equipped card click unequips (moves back to inventory)", …);
  it("Discard ✕ removes item from inventory without affecting equipped", …);
  it("Esc keydown closes the popup", …);
  it("Backdrop click closes the popup; clicking the inner card does not", …);
  it("auto-closes when currentView changes away from 'painting'", …);
});
```

10 cases.

### 6.4 Extend: `tests/store/persistence-integration.test.ts`

Add 1 new it() block to the existing "Phase 4 fields round-trip" describe (or a new "Phase 5 fields" describe — implementation choice):

```ts
it("workshopPopupOpen=true is stripped from the persisted save", async () => {
  useGameStore.setState({ workshopPopupOpen: true });
  // serialize via the existing partialize round-trip helper;
  // assert the persisted shape lacks workshopPopupOpen (or has it as undefined).
});
```

1 case.

### 6.5 Total Phase 5 net new tests

- uiSlice 3
- Hoverable extension 3
- WorkshopPopup 10
- persistence-integration extension 1
- **Total: 17 new it() blocks across 3 new files + 2 extensions.**
- Post-Phase-5 target: 220 + 17 = **237 tests**.

---

## 7. Forward-compat seams

For Phase 6 polish:

- **Motion entry/exit on the popup:** the popup's outer overlay is a `<div>`; replace with `<motion.div>` + `AnimatePresence` for fade-in/out. Backdrop opacity transition + card scale transition. No structural change.
- **Toast / snackbar layer:** the popup uses `z-10`; toasts can claim `z-20`. Pre-reserved.
- **Icon registry:** when an `Icons` registry is added, hover content footers gain `<img>` icons inline. The `(value, "gold")` text labels in this phase become `(value, <CoinIcon />)` patterns. No breaking change to the Hoverable API.
- **Workshop drag-and-drop (v1.5):** the popup's inventory and equipped sections are vertical `<ul>`s — replacing `<li>` rendering with `@dnd-kit/core`'s `<DndContext>` is a swap, not a rewrite.
- **Popup stack:** `uiSlice` field can grow from a single boolean to `Set<PopupId>` when v2.0+ adds Painter's Office popup, etc. App.tsx's render block iterates the set.

For wave roadmap:

- **`swap` verb exposure:** if 2-equip-slot endgame play feels janky, add a `<button>Swap to slot N</button>` row on equipped cards. 1-line UI addition; backend already supports.
- **Workshop UI rebuild (v1.8):** Phase 5's two-column popup is replaced by the spec's 3-column drag-drop UI. The `WorkshopPopup` file is deleted, `getEquippedContribution` and slice actions stay.
- **Affix pool expansion:** Phase 6 balance pass may add affixes (per PORT_PLAN §1.3 tuning note). Hover bodies on inventory/equipped cards format `${item.kind} ${item.magnitude}%` — no change needed for new affix kinds beyond extending the `AffixKind` literal union.

---

## 8. Definition of done

Phase 5 is done when all of these hold:

1. **`uiSlice` wired into the combined store.** `workshopPopupOpen` field, `openWorkshopPopup` / `closeWorkshopPopup` actions. Field is in `partialize`'s strip list.
2. **`Hoverable` accepts callback factories.** Existing static-string usage continues to type-check. Callback variant test cases pass.
3. **`<Hoverable>` applied to all in-scope sites** per §2 D4 / §5. Each hover, when fired, produces InfoPanel content matching the §5 table.
4. **`WorkshopPopup` mounts on demand.** Click PaintingView Workshop button → popup opens. Esc closes. Backdrop-click closes. Inner-card click does not close.
5. **Workshop popup verbs work end-to-end.** Craft (with gold gating), equip (with slot-count gating), unequip (with inventory-capacity gating), discard. Equipped affixes apply to canvas/tree multipliers (already wired Phase 3; verify by manual smoke).
6. **All slice actions and state reads inside views and the popup follow the I-1 view-subscription rule.** Every field read during render is also subscribed via a selector. No `useGameStore.getState()` in any render body.
7. **Refresh closes the popup.** Open popup, refresh page, popup is closed (`workshopPopupOpen` stripped from save).
8. **`npm test`** — 220 prior + 17 new = **237 tests, 0 failing**.
9. **`npx tsc -b --noEmit`** — clean.
10. **`npm run lint`** — same warning count as pre-Phase-5 (1 pre-existing warning on `main.tsx`).
11. **`npm run build`** — `dist/` produced; bundle JS size <100 KB gzipped (target headroom; Phase 4 was 81 KB, Phase 5 adds ~5–10 KB).
12. **Manual `npm run dev` smoke** — fresh save (delete IDB):
    - Hover every wrapped element on every view; InfoPanel content matches §5.
    - On PaintingView, click Workshop; popup opens.
    - With `gold ≥ 100`, click Craft; item appears in inventory.
    - Click an inventory card; item moves to Equipped section.
    - Verify the equipped affix multiplier shows up: open HomeView's inspi/sec hover (if `+inspiration_rate%` was rolled) and confirm the multiplier > 1.
    - Click an equipped card; item returns to inventory.
    - Click an inventory card's `✕`; item is removed.
    - Press Esc; popup closes. Re-open. Click outside the card; popup closes.
    - Refresh page; popup is closed; inventory/equipped persisted.

---

## 9. Risks / things to watch

- **Hoverable's `() =>` factory returning JSX with hooks inside is a footgun.** Hooks can only be called from React components, not arbitrary functions. Authoring guideline: factories return either (a) a string, (b) plain JSX with values pulled via `useGameStore.getState()` — NOT via hooks. For "live during the entire hover" content, return `<MySubscribingComponent />` and put the hooks inside that component. Phase 5 doesn't need this — all factories use `getState()` and produce a snapshot fresh-at-hover.
- **`<main>` getting `relative`.** Required for absolute-positioned popup. If a future view depends on `<main>` being non-positioned, that breaks. Document in commit + spec.
- **Backdrop click vs popup card click.** `e.stopPropagation()` on the inner card prevents the outer-div onClick from firing. Forgetting this means clicking *any*where in the popup closes it. Cover with the WorkshopPopup test case "Backdrop click closes; inner card click does not".
- **Esc handler scope.** `useEffect`'s cleanup must remove the listener; otherwise multiple opens stack listeners. Test verifies single-fire behavior implicitly (3 opens + 1 Esc → 1 close).
- **Popup auto-close on view change.** Popup subscribes to `currentView`; a useEffect closes the popup when `currentView !== "painting"`. On first mount (open while currentView === "painting") the effect is a no-op. Without this, switching tabs while the popup is open leaves a Workshop popup hovering over HomeView/AscensionView/SkillTreeView, which is functionally OK but visually wrong. Tested by case (10) in §6.3.
- **Hover content content drift.** As the §5 table is implemented, the actual numeric values must match what the slice/helper currently computes. If a balance constant changes (Phase 6), update the hover content too. The §5 table is the authoritative source for content; the implementation must match.
- **`getInspiMultiplier(state)` callable inside hover factory** — the factory runs at hover time and uses `useGameStore.getState()` to construct a fresh `helperState` for the helper. The helper signature still takes `GameStore`, so the factory uses the same `as unknown as GameStore` cast pattern as the views (per `docs/agent_docs/ui-patterns.md`).
- **Bundle size pressure.** Each Hoverable adds ~50 bytes of JSX; ~15 application sites = ~1 KB. WorkshopPopup adds ~3–5 KB. Total Phase 5 increase ~5–7 KB gzipped. Well under the 250 KB v1 budget but noted for trend tracking.
- **Tailwind 4 JIT and runtime-concatenated class strings.** Same caveat as Phase 4 (`COLOR_CLASS[kind]`): if any new class string is built at runtime (template literal, `${state}` interpolation), the JIT scanner may not pick it up. Avoid for hover content; all classes are static literals in this spec.
- **The `inventory` and `equippedItems` lists use index keys (`key={idx}`) for `<li>` rendering.** Safe under v1 because items don't reorder mid-render. If v1.5 adds drag-to-reorder, switch to a stable identity (item object identity is fine since items are immutable readonly objects). Not blocking.

---

## 10. Out of scope (this phase)

- Motion / animations (Phase 6).
- Balance pass (Phase 6).
- Icons in hover content (deferred — text labels for v1).
- Hoverable on TopBar nav, AscensionView read-only sections, Canvas slot, PaintingView equipped mirror (per D4).
- Focus trap inside popup (deferred to accessibility QA in Phase 6 if flagged).
- Drag-and-drop equip (v1.5 per PORT_PLAN §3.1).
- The `swap` workshop verb (deferred unless playtest flags it).
- Audio cue on craft (Howler — deferred to v2.x).
- Animation on craft success (Phase 6 polish — Motion floating-text on the new item card).

---

## 11. References

- `docs/PORT_PLAN.md` §7 Phase 5 — scope.
- `docs/specs/2026-04-25-info-panel-design.md` §6 — content authoring rules (mandatory).
- `docs/agent_docs/ui-patterns.md` — view subscription rule (I-1 from Phase 5 opening carry-overs).
- `docs/agent_docs/conventions.md` — TypeScript strictness, slice anatomy, test discipline.
- `docs/HANDOVER.md` — current state of the project (Phase 4 + carry-overs done; 220 tests).
- Phase 3 spec for workshopSlice / skillTreeSlice contract:
  `docs/superpowers/specs/2026-05-02-phase3-workshop-ascend-skilltree-design.md`.
- Phase 4 spec for shell / view patterns and viewSlice precedent for transient-stripping:
  `docs/superpowers/specs/2026-05-02-phase4-ui-shell-design.md`.
