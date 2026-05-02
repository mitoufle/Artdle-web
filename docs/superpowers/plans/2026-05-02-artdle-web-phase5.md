# Artdle Web — Phase 5 Implementation Plan: Hoverable Wiring + Workshop Popup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `<Hoverable>` content on every interactive element of the v1 UI (per the info-panel-design §6 rules) and ship a click-to-craft / equip / unequip / discard `WorkshopPopup` so the v1 gameplay loop is fully playable in the browser without DevTools.

**Architecture:** A new transient `uiSlice` (single boolean `workshopPopupOpen` + open/close actions, stripped from `partialize`) backs popup-open state. `<Hoverable>`'s prop signature becomes a strict superset (`string | (() => string)` for title; `ReactNode | (() => ReactNode)` for body/footer) so live values author cleanly without forcing the host view to subscribe to every hover-only field. `<WorkshopPopup>` renders inside `<main>` as a `position: absolute inset-0` overlay with semi-transparent backdrop; Esc and backdrop-click dismiss; auto-closes on `currentView` change away from `"painting"`. Each view is edited to wrap its in-scope interactive elements with `<Hoverable>`; bodies are factory callbacks that resolve at hover time via `useGameStore.getState()` (event-handler context — satisfies the I-1 view-subscription rule from `docs/agent_docs/ui-patterns.md`).

**Tech Stack:** React 19 + TypeScript 6 strict + Vite 8 + Tailwind 4 (CSS-first via `@theme` in `src/index.css`) + Zustand 5 + `@testing-library/react` 16 + `@testing-library/user-event` 14 + Vitest 4 + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-02-phase5-hoverable-workshop-design.md` is the authoritative design.

---

## Pre-flight (read once before starting Task 1)

### Locked design decisions (from spec §2)

1. **WorkshopPopup is a modal overlay over `<main>` only** — TopBar/InfoPanel/BottomBar stay visible; Esc + backdrop-click dismiss; `position: absolute inset-0`; `<main>` gains `relative`.
2. **Hoverable signature extended to factory callbacks** — `string | (() => string)` and `ReactNode | (() => ReactNode)`. Strict superset; existing static-string usage continues to type-check.
3. **`uiSlice` for transient popup state** — single boolean `workshopPopupOpen` + open/close. Stripped from `partialize` (refresh closes the popup).
4. **Hoverable scope: PORT_PLAN list + popup-internal items + 2 HomeView concept entries** — see spec §5 table for the exact 13 application sites.
5. **Workshop verbs in popup: craft, equip, unequip, discard** — skip swap (deferred unless playtest flags pain).
6. **17 new tests across 3 new files + 2 extensions** — uiSlice (3) + Hoverable (3 new) + WorkshopPopup (10) + persistence-integration (1).

### Phase 0–4 lessons baked into this plan

- **Literal-union types** for compile-time typo protection (no new ones in Phase 5).
- **Save-format JSDoc** above any persisted literal-union (no new persisted types in Phase 5; `workshopPopupOpen` is intentionally NOT persisted).
- **`Object.freeze` on initial-state constants** (apply to `initialUiState`).
- **Selectors only; never `useGameStore()` no-arg** in components.
- **`useGameStore.getState()` in render is forbidden** (I-1 carry-over rule per `docs/agent_docs/ui-patterns.md`). Acceptable in event handlers (mouseEnter, onClick) and inside Hoverable factory bodies (factories run at hover time, which is event-handler context).
- **No `partialize` change needed** for persisted fields ride along in `...rest`. Phase 5 ADDS one field (`workshopPopupOpen`) to the strip list — see Task 1.
- **`tsconfig.app.json` already wires `@testing-library/jest-dom/vitest`** in `types`. Don't touch.
- **RTL 16 + Vitest globals auto-cleanup** between tests. Do NOT add `afterEach(cleanup)` blocks to new test files (M-1 carry-over).
- **Helpers like `getCurrentSlotCount(state)` take `GameStore`** — view/popup callers construct narrow helper-state via `as unknown as GameStore` cast (I-1 / `docs/agent_docs/ui-patterns.md`).

### Run commands cheat sheet

| Action | Command |
|---|---|
| Run all tests | `npm test` |
| Run one test file | `npm test -- tests/path/to/file.test.tsx` |
| Run typecheck | `npx tsc -b --noEmit` |
| Run lint | `npm run lint` |
| Dev server (manual smoke) | `npm run dev` |
| Production build | `npm run build` |

### Commit message conventions

`store:`, `ui:`, `test:`, `fix:`, `docs:`, `core:`, `config:`, `feat:`, `refactor:` per Phase 4 plan. One commit per task at the end. Conventional prefixes only.

### Standard UI test scaffolding

UI tests mount a component, optionally seed the singleton store via `useGameStore.setState(...)`, then assert on DOM via `@testing-library/react`'s `screen` queries. Reset pattern in `beforeEach`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

beforeEach(() => {
  // Reset to a known state. Use slice resets when available;
  // otherwise setState() the persisted fields directly.
  useGameStore.getState().resetWorkshop();
  useGameStore.getState().clearHoverInfo();
  useGameStore.setState({ currentView: "home", workshopPopupOpen: false });
});
```

**Do NOT add `afterEach(cleanup)`** — RTL 16 + Vitest globals auto-cleanup. Do NOT import `cleanup`.

`@testing-library/jest-dom` matchers (`toBeDisabled`, `toHaveTextContent`, `toBeInTheDocument`) are auto-loaded by `vitest.setup.ts`.

### Mouse-event API

`fireEvent.mouseEnter(element)` / `fireEvent.mouseLeave(element)` synchronously dispatch the events. `fireEvent.keyDown(window, { key: "Escape" })` for Esc handler tests. `fireEvent.click(element)` for click tests.

### RNG seeding

`tests/ui/popups/WorkshopPopup.test.tsx` seeds RNG via `setSeed(42)` in `beforeEach` before the popup test that exercises `craft()` (which uses `rngPick` + `rngInt`). Without a seed, the rolled affix is non-deterministic.

---

## File structure

### New files

```
src/store/uiSlice.ts                          Task 1
src/ui/popups/WorkshopPopup.tsx               Task 3

tests/store/uiSlice.test.ts                   Task 1
tests/ui/popups/WorkshopPopup.test.tsx        Task 3
```

### Edited files

```
src/store/index.ts                            Task 1   (wire createUiSlice into combined store + add workshopPopupOpen to partialize strip)
tests/store/persistence-integration.test.ts   Task 1   (add 1 case asserting workshopPopupOpen is stripped)
src/ui/widgets/Hoverable.tsx                  Task 2   (Props union + resolve helper inside handler)
tests/ui/widgets/Hoverable.test.tsx           Task 2   (3 new it() blocks for callback variants)
src/App.tsx                                   Task 4   (mount <WorkshopPopup /> in <main>, add `relative`)
src/ui/views/PaintingView.tsx                 Task 4   (un-disable Workshop button, wire onClick, wrap with Hoverable)
src/ui/views/HomeView.tsx                     Task 5   (4 Hoverables: parts, Grow, stage header, inspi/sec)
src/ui/views/AscensionView.tsx                Task 6   (1 Hoverable: Ascend button)
src/ui/views/SkillTreeView.tsx                Task 7   (1 Hoverable per node Buy button = 5 sites)
src/ui/widgets/CurrencyDisplay.tsx            Task 8   (1 Hoverable per currency = 3 sites)
```

### Module boundary contract

- `src/store/uiSlice.ts`: imports nothing from other slices. Exports `UiState`, `UiSlice`, `initialUiState`, `createUiSlice`.
- `src/ui/popups/WorkshopPopup.tsx`: imports `useGameStore`, `GameStore`, `formatBig`, `Hoverable`, `MAX_INVENTORY_SLOTS` + `CRAFT_COST_GOLD` from `workshopAffixes`, `getCurrentSlotCount` from `workshopSlice`, `big` from `bigNumber`, `useEffect` from `react`. Reads: `inventory`, `equippedItems`, `gold`, `purchasedNodes`, `currentView`, `workshopPopupOpen`. Writes via subscribed action refs: `craft`, `equip`, `unequip`, `discard`, `closeWorkshopPopup`.
- `src/ui/widgets/Hoverable.tsx`: imports `useGameStore` only. Adds a local `resolve<T>(v)` helper. No new external imports.
- `src/App.tsx`: existing imports + `WorkshopPopup`. Adds `relative` to `<main>`'s className.
- `src/ui/views/PaintingView.tsx`: existing imports + `Hoverable` + `MAX_INVENTORY_SLOTS` from `workshopAffixes`. Subscribes to `openWorkshopPopup` + `inventory.length` (already had).
- `src/ui/views/HomeView.tsx`: existing imports + `Hoverable`. Bodies use `useGameStore.getState()` inside factories.
- `src/ui/views/AscensionView.tsx`: existing imports + `Hoverable`. Body factory reads palier/fame via the existing helper-state cast pattern.
- `src/ui/views/SkillTreeView.tsx`: existing imports + `Hoverable` + a local `EFFECT_DESCRIPTIONS: Record<SkillNodeId, string>` table.
- `src/ui/widgets/CurrencyDisplay.tsx`: existing imports + `Hoverable` + a local `HOVER_BODY` map per currency kind.

---

## Task 1: `uiSlice` + persistence strip extension

**Files:**
- Create: `src/store/uiSlice.ts`
- Test: `tests/store/uiSlice.test.ts`
- Modify: `src/store/index.ts` (wire `createUiSlice` into combined store + add `workshopPopupOpen` to `partialize`'s destructure)
- Modify: `tests/store/persistence-integration.test.ts` (add 1 case to existing "Phase 4 fields round-trip" describe — or new "Phase 5 fields" describe — asserting the stripped field doesn't survive)

**Goal:** Transient single-field slice for popup-open state. Mirror `hoverInfoSlice`'s shape: stripped from save, no JSDoc warning needed (not persisted).

- [ ] **Step 1: Write the failing slice test**

Create `tests/store/uiSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";

describe("uiSlice", () => {
  beforeEach(() => {
    useGameStore.setState({ workshopPopupOpen: false });
  });

  it("defaults workshopPopupOpen to false", () => {
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });

  it("openWorkshopPopup() flips workshopPopupOpen to true", () => {
    useGameStore.getState().openWorkshopPopup();
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);
  });

  it("closeWorkshopPopup() flips workshopPopupOpen to false", () => {
    useGameStore.setState({ workshopPopupOpen: true });
    useGameStore.getState().closeWorkshopPopup();
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/store/uiSlice.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'openWorkshopPopup')` or `workshopPopupOpen` is undefined.

- [ ] **Step 3: Write the slice**

Create `src/store/uiSlice.ts`:

```ts
import type { StateCreator } from "zustand";

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

- [ ] **Step 4: Wire into combined store**

Edit `src/store/index.ts`. Add the import after the other slice imports (alphabetical / by-feature placement after `viewSlice`):

```ts
import { createUiSlice, type UiSlice } from "./uiSlice";
```

Add `& UiSlice` to the `GameStore` union (after `ViewSlice`, before `GameTick`):

```ts
export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & SkillTreeSlice
  & WorkshopSlice
  & ViewSlice
  & UiSlice
  & GameTick;
```

Add the slice to the `create` body alongside the others (after `createViewSlice(...)`, before `tickAll`):

```ts
...createUiSlice(set, get, store),
```

Update `partialize` to strip `workshopPopupOpen`:

```ts
partialize: (s) => {
  // Exclude transient hover-info + UI state, then pre-wrap Bigs as `{ __big: "..." }` markers.
  const { hoverTitle: _t, hoverBody: _b, hoverFooter: _f, workshopPopupOpen: _w, ...rest } = s;
  return serializeBigs(rest) as unknown as Omit<
    GameStore,
    "hoverTitle" | "hoverBody" | "hoverFooter" | "workshopPopupOpen"
  >;
},
```

- [ ] **Step 5: Run the slice test to verify it passes**

Run: `npm test -- tests/store/uiSlice.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Add persistence-integration test for the strip**

Open `tests/store/persistence-integration.test.ts`. Locate the existing "Phase 4 fields round-trip" describe block (or wherever `currentView` is asserted). Add a new it() block in the same describe (or a sibling "Phase 5 fields" describe — implementer's choice; same file):

```ts
it("workshopPopupOpen is stripped from the persisted save", async () => {
  // Set the transient flag, force-flush the persist write, then verify the
  // raw IDB read does not include workshopPopupOpen.
  useGameStore.setState({ workshopPopupOpen: true });
  await useGameStore.persist.rehydrate();
  // Trigger a save by mutating something persisted, then check the raw IDB.
  // Pattern mirrors the existing currentView round-trip in this file: read
  // the raw value via `idb-keyval`'s get() and assert the parsed payload.
  // Use whatever pattern the existing currentView test uses for the read.

  // Concrete: relies on the existing test helper / pattern in this file.
  // Implementer: follow the existing currentView assertion shape exactly,
  // then assert that `JSON.parse(raw).state.workshopPopupOpen` is undefined
  // (Zustand wraps state under .state inside the persisted payload).
});
```

**Implementation note:** the exact persist-flush + raw-read pattern lives in this file already (Phase 3's currency round-trip + Phase 4's currentView round-trip). Read those two existing describe blocks first; copy the same shape; flip the assertion direction (was: present + equal; now: undefined / not in keys). If the existing tests use an in-memory adapter helper, reuse it; if they call `useGameStore.persist` APIs, do the same.

- [ ] **Step 7: Run the persistence-integration test to verify it passes**

Run: `npm test -- tests/store/persistence-integration.test.ts`
Expected: PASS, all existing cases + 1 new case green.

- [ ] **Step 8: Run all tests to verify no regressions**

Run: `npm test`
Expected: 220 prior + 3 (uiSlice) + 1 (persistence) = 224 tests pass.

- [ ] **Step 9: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean. The `Omit<GameStore, "hoverTitle" | ... | "workshopPopupOpen">` annotation in `partialize` keeps types consistent.

- [ ] **Step 10: Commit**

```bash
git add src/store/uiSlice.ts src/store/index.ts tests/store/uiSlice.test.ts tests/store/persistence-integration.test.ts
git commit -m "store(ui): uiSlice for transient popup-open state + partialize strip

Single boolean workshopPopupOpen + open/close actions. Stripped from
the persisted save so refresh closes the popup. Mirrors the
hoverInfoSlice transient-fields pattern. Wired into GameStore union
between ViewSlice and GameTick.

persistence-integration adds a new case asserting workshopPopupOpen
does not survive a partialize round-trip."
```

---

## Task 2: Extend `<Hoverable>` to support factory callbacks

**Files:**
- Modify: `src/ui/widgets/Hoverable.tsx` (Props union + `resolve` helper)
- Modify: `tests/ui/widgets/Hoverable.test.tsx` (add 3 new it() blocks; existing 3 unchanged)

**Goal:** Strict-superset signature change. Props become `string | (() => string)` for title and `ReactNode | (() => ReactNode)` for body/footer. Factory callbacks resolve inside the existing `onMouseEnter` handler. Existing static-string tests continue to pass.

- [ ] **Step 1: Write the 3 new failing test cases**

Open `tests/ui/widgets/Hoverable.test.tsx`. Append 3 new it() blocks inside the existing `describe("<Hoverable />", …)`:

```tsx
import { big } from "@/core/bigNumber";

// (existing 3 cases unchanged above)

it("resolves callback title at hover time", () => {
  render(
    <Hoverable title={() => "LiveTitle"} body="B">
      <span data-testid="target">X</span>
    </Hoverable>,
  );
  fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
  expect(useGameStore.getState().hoverTitle).toBe("LiveTitle");
});

it("resolves callback body at hover time using getState()", () => {
  useGameStore.setState({ gold: big(42) });
  render(
    <Hoverable
      title="T"
      body={() => `Gold: ${useGameStore.getState().gold.toString()}`}
    >
      <span data-testid="target">X</span>
    </Hoverable>,
  );
  fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
  expect(useGameStore.getState().hoverBody).toBe("Gold: 42");
});

it("re-resolves callback on each mouseEnter so post-state-change reads see new value", () => {
  useGameStore.setState({ gold: big(10) });
  render(
    <Hoverable
      title="T"
      body={() => `Gold: ${useGameStore.getState().gold.toString()}`}
    >
      <span data-testid="target">X</span>
    </Hoverable>,
  );
  const wrapper = screen.getByTestId("target").parentElement!;
  fireEvent.mouseEnter(wrapper);
  expect(useGameStore.getState().hoverBody).toBe("Gold: 10");
  fireEvent.mouseLeave(wrapper);
  useGameStore.setState({ gold: big(99) });
  fireEvent.mouseEnter(wrapper);
  expect(useGameStore.getState().hoverBody).toBe("Gold: 99");
});
```

`big` import goes at the top of the file with the other imports. Existing imports + `big` from `@/core/bigNumber` is the only addition.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/widgets/Hoverable.test.tsx`
Expected: FAIL on the 3 new cases — TypeScript may also complain that `() => "LiveTitle"` is not assignable to `string`. Either compilation error or runtime error (the existing Hoverable would push the function as the title, leading to `hoverTitle` being a function, not "LiveTitle"). Either failure mode is the expected red.

- [ ] **Step 3: Update `Hoverable` to accept callbacks**

Replace `src/ui/widgets/Hoverable.tsx`:

```tsx
import type { JSX, ReactNode } from "react";
import { useGameStore } from "@/store";

interface Props {
  title: string | (() => string);
  body: ReactNode | (() => ReactNode);
  footer?: ReactNode | (() => ReactNode);
  children: ReactNode;
}

const resolve = <T,>(v: T | (() => T)): T =>
  typeof v === "function" ? (v as () => T)() : v;

/**
 * Wrapper that pushes hover content to hoverInfoSlice on mouseEnter and
 * clears it on mouseLeave. Phase 4 built and tested with static-only props.
 * Phase 5 extended Props to support factory callbacks for live values:
 * factories run at hover time inside the event handler (event-handler context
 * satisfies the I-1 view-subscription rule). Static usage continues to work
 * unchanged — string is assignable to `string | (() => string)`.
 */
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/ui/widgets/Hoverable.test.tsx`
Expected: PASS, 6 tests (3 existing + 3 new).

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npm test`
Expected: 224 prior + 3 new = 227 tests pass.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/widgets/Hoverable.tsx tests/ui/widgets/Hoverable.test.tsx
git commit -m "ui(hoverable): accept factory callbacks for live hover content

Strict-superset Props change: title, body, footer accept either
their original static type or a () => T factory. Factories resolve
inside the existing onMouseEnter handler via a small resolve<T>()
helper. Static-string usage continues to type-check unchanged.

Decouples hover content from the host view's subscription set —
views can show live values in hovers (palier, current multiplier,
inventory count) without subscribing to those fields just for the
hover. Factories use useGameStore.getState() since onMouseEnter is
event-handler context (per docs/agent_docs/ui-patterns.md).

3 new test cases cover: callback title, callback body via getState(),
and re-resolution on subsequent mouseEnter after state change."
```

---

## Task 3: `<WorkshopPopup>` component + integration test

**Files:**
- Create: `src/ui/popups/WorkshopPopup.tsx`
- Test: `tests/ui/popups/WorkshopPopup.test.tsx`

**Goal:** Modal overlay with two-column inventory/equipped layout. Craft button (gold-gated). Inventory cards click → equip. Equipped cards click → unequip. Discard `✕` per inventory card. Esc + backdrop dismiss. Auto-close on `currentView !== "painting"`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/popups/WorkshopPopup.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";

describe("<WorkshopPopup />", () => {
  beforeEach(() => {
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({
      workshopPopupOpen: true,
      gold: big(1000),
      purchasedNodes: {},
      currentView: "painting",
    });
    setSeed(42);
  });

  it("renders nothing when workshopPopupOpen=false", () => {
    useGameStore.setState({ workshopPopupOpen: false });
    const { container } = render(<WorkshopPopup />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Craft, Inventory, Equipped sections when open", () => {
    render(<WorkshopPopup />);
    expect(screen.getByRole("button", { name: /^craft$/i })).toBeInTheDocument();
    expect(screen.getByText(/inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/equipped/i)).toBeInTheDocument();
  });

  it("disables Craft when gold < 100", () => {
    useGameStore.setState({ gold: big(99) });
    render(<WorkshopPopup />);
    expect(screen.getByRole("button", { name: /^craft$/i })).toBeDisabled();
  });

  it("Craft click adds an item to inventory", () => {
    render(<WorkshopPopup />);
    expect(useGameStore.getState().inventory.length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /^craft$/i }));
    expect(useGameStore.getState().inventory.length).toBe(1);
  });

  it("Inventory card click equips the item (moves to equippedItems)", () => {
    fireEvent.click(screen.getByRole("button", { name: /^craft$/i })); // before render? — see implementer note
    // Better: seed inventory directly via state, then render.
  });

  it("Equipped card click unequips (moves item back to inventory)", () => {
    // Seed an equipped item, render, click it, assert it moved.
  });

  it("Discard ✕ removes item from inventory without affecting equipped", () => {
    // Seed inventory with one item + equipped with one item; click ✕ on inventory; assert.
  });

  it("Esc keydown closes the popup", () => {
    render(<WorkshopPopup />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });

  it("Backdrop click closes the popup; clicking the inner card does not", () => {
    render(<WorkshopPopup />);
    const dialog = screen.getByRole("dialog");
    // Inner card is the only child div with bg-app-bg.
    const innerCard = dialog.firstChild as HTMLElement;
    fireEvent.click(innerCard);
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);
    fireEvent.click(dialog);
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });

  it("auto-closes when currentView changes away from 'painting'", () => {
    render(<WorkshopPopup />);
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);
    useGameStore.setState({ currentView: "home" });
    // useEffect runs after the next render tick — flush by triggering a re-render.
    // (The popup subscribes to currentView, so setState above triggers a re-render
    //  on its own — the useEffect cleanup + re-run fires synchronously enough for
    //  the assertion to read the post-effect state.)
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });
});
```

**Implementer notes for the cases skipped above:**

- "Inventory card click equips" — instead of crafting first inside the test, seed the inventory directly:

  ```tsx
  it("Inventory card click equips the item (moves to equippedItems)", () => {
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
    });
    render(<WorkshopPopup />);
    fireEvent.click(screen.getByRole("button", { name: /\+canvas_gold% 10/i }));
    expect(useGameStore.getState().inventory.length).toBe(0);
    expect(useGameStore.getState().equippedItems.length).toBe(1);
  });
  ```

- "Equipped card click unequips":

  ```tsx
  it("Equipped card click unequips (moves item back to inventory)", () => {
    useGameStore.setState({
      equippedItems: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
    });
    render(<WorkshopPopup />);
    fireEvent.click(screen.getByRole("button", { name: /\+canvas_gold% 10/i }));
    expect(useGameStore.getState().equippedItems.length).toBe(0);
    expect(useGameStore.getState().inventory.length).toBe(1);
  });
  ```

- "Discard ✕ removes item":

  ```tsx
  it("Discard ✕ removes item from inventory without affecting equipped", () => {
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%" as const, magnitude: 10 }],
      equippedItems: [{ kind: "-paint_time%" as const, magnitude: 8 }],
    });
    render(<WorkshopPopup />);
    fireEvent.click(screen.getByRole("button", { name: /^discard \+canvas_gold% 10%$/i }));
    expect(useGameStore.getState().inventory.length).toBe(0);
    expect(useGameStore.getState().equippedItems.length).toBe(1);
  });
  ```

The `name` regex must match the `aria-label` on the discard button (see Step 3 component code for the exact string). Adjust if you change the label.

Replace the placeholder bodies in the test file with the concrete implementations above. The final test file contains 10 it() blocks total.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/popups/WorkshopPopup.test.tsx`
Expected: FAIL — `WorkshopPopup` module not found.

- [ ] **Step 3: Write the component**

Create `src/ui/popups/WorkshopPopup.tsx`:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { Hoverable } from "@/ui/widgets/Hoverable";
import {
  CRAFT_COST_GOLD,
  MAX_INVENTORY_SLOTS,
} from "@/config/workshopAffixes";
import { getCurrentSlotCount } from "@/store/workshopSlice";

export function WorkshopPopup(): JSX.Element | null {
  const open = useGameStore((s) => s.workshopPopupOpen);
  const close = useGameStore((s) => s.closeWorkshopPopup);
  const inventory = useGameStore((s) => s.inventory);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const gold = useGameStore((s) => s.gold);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const currentView = useGameStore((s) => s.currentView);
  const craft = useGameStore((s) => s.craft);
  const equip = useGameStore((s) => s.equip);
  const unequip = useGameStore((s) => s.unequip);
  const discard = useGameStore((s) => s.discard);

  // Esc dismiss — listener mounts/unmounts with `open`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Auto-close when the user navigates away from PaintingView.
  // On first mount currentView === "painting" (popup's only trigger is the
  // PaintingView Workshop button), so this is a no-op until a switch.
  useEffect(() => {
    if (open && currentView !== "painting") close();
  }, [open, currentView, close]);

  if (!open) return null;

  // Helper expects GameStore; pass the field it actually reads.
  // Cast pattern per docs/agent_docs/ui-patterns.md.
  const helperState = { purchasedNodes } as unknown as GameStore;
  const slotCount = getCurrentSlotCount(helperState);
  const canCraft =
    gold.gte(big(CRAFT_COST_GOLD)) && inventory.length < MAX_INVENTORY_SLOTS;
  const canEquipMore = equippedItems.length < slotCount;
  const canUnequip = inventory.length < MAX_INVENTORY_SLOTS;

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
        <header className="flex items-center justify-between border-b border-app-panel px-4 py-2">
          <h2 id="workshop-popup-title" className="text-lg font-semibold">
            Workshop
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close workshop"
            className="rounded px-2 py-1 text-sm hover:bg-app-panel"
          >
            ✕
          </button>
        </header>

        <div className="flex items-center gap-3 border-b border-app-panel px-4 py-2">
          <Hoverable
            title="Craft"
            body="Spend gold to roll one item with one random affix (5–15% magnitude, +1 with Better Brush)."
            footer={() =>
              `Cost: ${CRAFT_COST_GOLD} gold · Inventory: ${
                useGameStore.getState().inventory.length
              }/${MAX_INVENTORY_SLOTS}`
            }
          >
            <button
              type="button"
              disabled={!canCraft}
              onClick={() => craft()}
              className="rounded bg-gold/20 px-3 py-1 text-sm disabled:opacity-40"
            >
              Craft
            </button>
          </Hoverable>
          <span className="text-sm opacity-70">{CRAFT_COST_GOLD} gold</span>
          <span className="text-sm opacity-70">
            Inventory: {inventory.length}/{MAX_INVENTORY_SLOTS}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4">
          <section>
            <h3 className="mb-2 text-sm opacity-70">Inventory</h3>
            {inventory.length === 0 && (
              <div className="text-sm opacity-60">
                Empty — click Craft to roll an item.
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {inventory.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <Hoverable
                    title={`${item.kind} ${item.magnitude}%`}
                    body={
                      canEquipMore
                        ? "Click to equip."
                        : "Equipped slots full — unequip an item first."
                    }
                  >
                    <button
                      type="button"
                      disabled={!canEquipMore}
                      onClick={() => equip(idx)}
                      className="flex-1 rounded bg-app-panel px-3 py-2 text-left text-sm disabled:opacity-40"
                    >
                      {item.kind} {item.magnitude}%
                    </button>
                  </Hoverable>
                  <Hoverable
                    title="Discard"
                    body="Remove this item from inventory."
                  >
                    <button
                      type="button"
                      onClick={() => discard(idx)}
                      aria-label={`Discard ${item.kind} ${item.magnitude}%`}
                      className="rounded bg-app-panel px-2 py-2 text-sm hover:bg-red-900/40"
                    >
                      ✕
                    </button>
                  </Hoverable>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm opacity-70">
              Equipped {equippedItems.length}/{slotCount}
            </h3>
            {equippedItems.length === 0 && (
              <div className="text-sm opacity-60">No items equipped.</div>
            )}
            <ul className="flex flex-col gap-2">
              {equippedItems.map((item, idx) => (
                <li key={idx}>
                  <Hoverable
                    title={`${item.kind} ${item.magnitude}%`}
                    body={
                      canUnequip
                        ? "Currently equipped. Click to unequip (returns to inventory)."
                        : "Currently equipped. Inventory is full — discard or equip-elsewhere first."
                    }
                  >
                    <button
                      type="button"
                      disabled={!canUnequip}
                      onClick={() => unequip(idx)}
                      className="w-full rounded bg-app-panel px-3 py-2 text-left text-sm disabled:opacity-40"
                    >
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

- [ ] **Step 4: Run the popup test to verify it passes**

Run: `npm test -- tests/ui/popups/WorkshopPopup.test.tsx`
Expected: PASS, 10 tests.

If the auto-close-on-view-change test fails because the useEffect doesn't fire synchronously enough, wrap the assertion in `act()`:

```tsx
import { act } from "@testing-library/react";
// …
act(() => { useGameStore.setState({ currentView: "home" }); });
expect(useGameStore.getState().workshopPopupOpen).toBe(false);
```

If the dialog's `firstChild` selection in the backdrop test doesn't pick the inner card (DOM structure may put a Hoverable's `<span>` first), use `screen.getByRole("dialog").querySelector(".rounded-lg")` or similar concrete selector instead.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npm test`
Expected: 227 prior + 10 = 237 tests pass.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/popups/WorkshopPopup.tsx tests/ui/popups/WorkshopPopup.test.tsx
git commit -m "ui(workshop-popup): WorkshopPopup component + 10 integration tests

Modal overlay rendered as position: absolute inset-0 over <main>
(App.tsx mount + main relative wiring lands in next task). Two-column
layout: Craft button + cost on top, Inventory left + Equipped right.
Cards click to equip/unequip (gated by slot count + inventory capacity).
Discard ✕ per inventory card. Esc keydown and backdrop click both
dismiss; clicking the inner card stops propagation.

Auto-closes when currentView leaves 'painting' (subscribed via
useEffect; no-op on first mount because the popup's only trigger is
PaintingView's Workshop button).

10 integration cases cover the closed-state empty render, open-state
sections, gold gating on Craft, all 4 verbs (craft/equip/unequip/discard),
Esc, backdrop, and view-change auto-close."
```

---

## Task 4: Mount popup in `App.tsx` + activate PaintingView Workshop button

**Files:**
- Modify: `src/App.tsx` (add `relative` to `<main>`, render `<WorkshopPopup />` inside)
- Modify: `src/ui/views/PaintingView.tsx` (un-disable Workshop button, wire `onClick={openWorkshopPopup}`, wrap with `<Hoverable>`)

**Goal:** Make the popup reachable from the live UI. Click the Workshop button in PaintingView → popup opens. Verified via dev smoke (no new automated test in this task — popup tests in Task 3 already cover the popup; this task is wiring).

- [ ] **Step 1: Update `src/App.tsx`**

Add the import (after the other widget imports, before the view imports):

```tsx
import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";
```

Replace `<main>`'s line:

```tsx
<main className="relative flex-1 overflow-auto">
  {body}
  <WorkshopPopup />
</main>
```

Full file body for reference:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { TopBar } from "@/ui/widgets/TopBar";
import { BottomBar } from "@/ui/widgets/BottomBar";
import { InfoPanel } from "@/ui/widgets/InfoPanel";
import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";
import { HomeView } from "@/ui/views/HomeView";
import { PaintingView } from "@/ui/views/PaintingView";
import { AscensionView } from "@/ui/views/AscensionView";
import { SkillTreeView } from "@/ui/views/SkillTreeView";

export function App(): JSX.Element {
  const currentView = useGameStore((s) => s.currentView);
  let body: JSX.Element;
  switch (currentView) {
    case "home":
      body = <HomeView />;
      break;
    case "painting":
      body = <PaintingView />;
      break;
    case "ascension":
      body = <AscensionView />;
      break;
    case "skills":
      body = <SkillTreeView />;
      break;
  }
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
}
```

`WorkshopPopup` returns `null` when closed, so it's free to render unconditionally.

- [ ] **Step 2: Update `src/ui/views/PaintingView.tsx`**

Replace the Workshop stub button section. Add imports for `Hoverable` and `MAX_INVENTORY_SLOTS`. Subscribe to `openWorkshopPopup`. Replace the `<button disabled …>Workshop (coming soon)</button>` with the live wrapped button.

Full updated file:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";
import { getPaintTimeMultiplier } from "@/core/multipliers";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { MAX_INVENTORY_SLOTS } from "@/config/workshopAffixes";

export function PaintingView(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const openWorkshopPopup = useGameStore((s) => s.openWorkshopPopup);

  // Helpers expect a GameStore; pass the field they actually read.
  // Cast is intentional and safe — see docs/agent_docs/ui-patterns.md.
  const helperState = { equippedItems } as unknown as GameStore;
  const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(helperState);
  const stateLabel = canvasProgress > 0 ? "Painting" : "Idle";

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Canvas</div>
        <div className="text-lg font-semibold">{stateLabel}</div>
        <div className="text-sm">
          {canvasProgress.toFixed(1)} / {paintTime.toFixed(1)}s
        </div>
      </section>

      <section className="rounded bg-app-panel p-3">
        <div className="mb-2 text-sm opacity-70">Equipped</div>
        {equippedItems.length === 0 ? (
          <div className="text-sm opacity-60">No item equipped</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {equippedItems.map((item, idx) => (
              <li key={idx} className="text-sm">
                {item.kind} {item.magnitude}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Hoverable
        title="Workshop"
        body="Craft items with random affixes. Equip them to boost canvas/tree."
        footer={() =>
          `Inventory: ${useGameStore.getState().inventory.length}/${MAX_INVENTORY_SLOTS}`
        }
      >
        <button
          type="button"
          onClick={() => openWorkshopPopup()}
          className="self-start rounded bg-app-panel px-4 py-2 text-sm hover:bg-app-panel/80"
        >
          Workshop
        </button>
      </Hoverable>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: 237 tests still pass. PaintingView has no own test file in Phase 4 (PORT_PLAN's "sparse" test budget skipped it); the Workshop button activation is covered by the dev smoke in Step 5 + the WorkshopPopup tests from Task 3.

- [ ] **Step 5: Manual dev smoke**

Run: `npm run dev`. Open the printed URL.

1. Switch to **Painting** tab.
2. Workshop button is enabled (no longer dim/disabled). Hover it — InfoPanel shows `Workshop` title + `Craft items with random affixes…` body + `Inventory: 0/3` footer.
3. Click Workshop. Popup opens with semi-transparent backdrop. TopBar / InfoPanel / BottomBar still visible at edges.
4. In DevTools: `useGameStore.getState().add("gold", big(500))`. Refresh popup view (popup reads gold). Click `Craft`. An item appears in the Inventory column.
5. Click the inventory item. It moves to the Equipped column.
6. Click the equipped item. It moves back to inventory.
7. Click ✕ on the inventory item. It disappears.
8. Press `Esc`. Popup closes.
9. Click the Workshop button again. Popup re-opens.
10. Click outside the popup card (on the backdrop). Popup closes.
11. Open popup. Switch to Home tab. Popup auto-closes.
12. Refresh the page. Popup is closed; inventory/equipped persisted.

Press `Ctrl+C` to stop.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/ui/views/PaintingView.tsx
git commit -m "ui(app,painting): mount WorkshopPopup + activate PaintingView trigger

App.tsx renders <WorkshopPopup /> as a sibling of the view body inside
<main>. <main> gains 'relative' so the popup's absolute positioning
anchors to the view area only (TopBar/InfoPanel/BottomBar unaffected).
Popup component returns null when closed — safe to render unconditionally.

PaintingView's Workshop stub button is replaced with a live button
wired to openWorkshopPopup(). Wrapped with <Hoverable> per the spec
content table (title 'Workshop', static body, live inventory-count
footer)."
```

---

## Task 5: Apply `<Hoverable>` to HomeView (4 sites)

**Files:**
- Modify: `src/ui/views/HomeView.tsx`

**Goal:** Wrap each part Buy button, the Grow button, the stage-name header, and the inspi/sec readout with `<Hoverable>`. Bodies use factory callbacks for live values.

No new test file: hover behavior is covered by `Hoverable.test.tsx` (Task 2). Application is verified by dev smoke at end.

- [ ] **Step 1: Update `src/ui/views/HomeView.tsx`**

Add `Hoverable` import. Wrap the four sites. Bodies use `useGameStore.getState()` inside factories to read fresh values at hover time.

Full updated file:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { TREE_STAGES } from "@/config/treeStages";
import { treePartCost, inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
import {
  getProducingParts,
  canGrowSapling,
  getTotalLevelsInStage,
} from "@/store/treeSlice";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";

export function HomeView(): JSX.Element {
  const currentStage = useGameStore((s) => s.currentStage);
  const partLevels = useGameStore((s) => s.partLevels);
  const gold = useGameStore((s) => s.gold);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyPartLevel = useGameStore((s) => s.buyPartLevel);
  const growSapling = useGameStore((s) => s.growSapling);

  // Helpers expect a GameStore; pass the fields they actually read.
  // Cast is intentional and safe — see docs/agent_docs/ui-patterns.md.
  const helperState = {
    currentStage,
    partLevels,
    equippedItems,
    purchasedNodes,
  } as unknown as GameStore;
  const rate = inspiPerSec(getProducingParts(helperState), getInspiMultiplier(helperState));
  const canGrow = canGrowSapling(helperState);

  const stageName = TREE_STAGES[currentStage]?.name ?? "?";
  const nextStage = TREE_STAGES[currentStage + 1];
  const growThreshold = nextStage?.unlockThreshold ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <Hoverable
          title={() => useGameStore.getState().currentStage in TREE_STAGES
            ? (TREE_STAGES[useGameStore.getState().currentStage]?.name ?? "?")
            : "?"}
          body="Current tree stage. Each part on this stage produces inspiration."
        >
          <h2 className="text-xl font-semibold">{stageName}</h2>
        </Hoverable>
        <Hoverable
          title="Inspiration / sec"
          body={() => {
            const s = useGameStore.getState();
            const hs = {
              currentStage: s.currentStage,
              partLevels: s.partLevels,
              equippedItems: s.equippedItems,
              purchasedNodes: s.purchasedNodes,
            } as unknown as GameStore;
            const mult = getInspiMultiplier(hs);
            return `Sum of all part levels × rate, then × multipliers (currently ×${mult.toFixed(2)}).`;
          }}
        >
          <p className="text-sm opacity-70">{formatBig(rate)} inspi/sec</p>
        </Hoverable>
      </header>

      <ul className="flex flex-col gap-2">
        {TREE_STAGES.slice(0, currentStage + 1).flatMap((stage) =>
          stage.parts.map((part) => {
            const level = partLevels[part.id] ?? 0;
            const cost = treePartCost(level, part.baseCost);
            const canAfford = gold.gte(cost);
            return (
              <li
                key={part.id}
                className="flex items-center justify-between rounded bg-app-panel px-3 py-2"
              >
                <span>
                  <strong>{part.name}</strong>{" "}
                  <span className="opacity-60">Lv {level}</span>
                </span>
                <Hoverable
                  title={() => {
                    const lvl = useGameStore.getState().partLevels[part.id] ?? 0;
                    return `${part.name} (Lv ${lvl})`;
                  }}
                  body={() => {
                    const lvl = useGameStore.getState().partLevels[part.id] ?? 0;
                    const live = part.rate * lvl;
                    return `Adds ${part.rate} inspi/sec per level (currently +${live.toFixed(2)} inspi/sec).`;
                  }}
                  footer={() => {
                    const lvl = useGameStore.getState().partLevels[part.id] ?? 0;
                    const nextCost = treePartCost(lvl, part.baseCost);
                    return `Cost: ${formatBig(nextCost)} gold`;
                  }}
                >
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => buyPartLevel(part.id)}
                    className="rounded bg-gold/20 px-3 py-1 text-sm disabled:opacity-40"
                  >
                    Buy ({formatBig(cost)} gold)
                  </button>
                </Hoverable>
              </li>
            );
          }),
        )}
      </ul>

      {canGrow && (
        <Hoverable
          title="Grow next stage"
          body={() => {
            const s = useGameStore.getState();
            const hs = {
              currentStage: s.currentStage,
              partLevels: s.partLevels,
            } as unknown as GameStore;
            const total = getTotalLevelsInStage(hs, s.currentStage);
            return `Levels in current stage: ${total}/${growThreshold}. Click to advance.`;
          }}
        >
          <button
            type="button"
            onClick={() => growSapling()}
            className="self-start rounded bg-inspiration/20 px-4 py-2 text-sm"
          >
            Grow next stage
          </button>
        </Hoverable>
      )}
    </div>
  );
}
```

**Notes:**
- The stage-header title factory is intentionally a thin wrapper around `useGameStore.getState().currentStage` so it stays correct after a stage advance happens between renders (rare during a hover but consistent with the pattern).
- The Grow button hover only renders when `canGrow` is true. The `growThreshold` is captured at the parent render's `currentStage + 1` lookup; that's fine because if the stage advances, the button disappears entirely (the conditional collapses) before the hover could show stale data.
- `getTotalLevelsInStage` is a Phase 2 selector exported from `@/store/treeSlice`. Add it to the imports if your tsc complains it's missing.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: 237 tests still pass (HomeView has no own test file).

- [ ] **Step 4: Manual dev smoke**

Run: `npm run dev`. On Home tab:

1. Hover the stage header (`Seed`). InfoPanel shows `Seed` + `Current tree stage. …`.
2. Hover the inspi/sec readout. InfoPanel shows `Inspiration / sec` + `Sum of all part levels × rate, then × multipliers (currently ×1.00).`.
3. Hover a part Buy button. InfoPanel shows e.g. `Spark (Lv 0)` + `Adds 0.5 inspi/sec per level (currently +0.00 inspi/sec).` + `Cost: 10 gold`.
4. In DevTools, `useGameStore.getState().add("gold", big(1000))`. Refresh. Buy a part level. Hover again — `Lv 1`, `currently +0.5 inspi/sec`, next cost goes up.
5. Once levels reach the threshold, the Grow button appears. Hover it — InfoPanel shows `Grow next stage` + `Levels in current stage: N/M. Click to advance.`.

Press `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/HomeView.tsx
git commit -m "ui(home): apply Hoverable to 4 HomeView sites

- Stage-name header: concept entry explaining tree stage.
- Inspi/sec readout: live formula readout with current multiplier.
- Each part Buy button: live (Lv N) title, live rate body, live next-cost footer.
- Grow button (when visible): live (total/threshold) progress body.

All bodies are factory callbacks resolving via useGameStore.getState()
at hover time. Per-helper calls construct a narrow helper-state via
the as-unknown-as-GameStore cast pattern (docs/agent_docs/ui-patterns.md)."
```

---

## Task 6: Apply `<Hoverable>` to AscensionView (1 site)

**Files:**
- Modify: `src/ui/views/AscensionView.tsx`

**Goal:** Wrap the Ascend button with `<Hoverable>`. Title `"Ascend"`. Body factory shows live fame gain. Footer factory shows live `palier / inspi`.

- [ ] **Step 1: Update `src/ui/views/AscensionView.tsx`**

Add `Hoverable` import. Wrap the `<button>Ascend</button>` element. The body uses `useGameStore.getState()` to read live `inspiration`/`ascendCount`/`purchasedNodes` and re-uses `getEffectivePalier`/`fameOnAscend`.

Full updated file:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canAscend, getEffectivePalier } from "@/systems/ascend";
import { fameOnAscend } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";

export function AscensionView(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const performAscend = useGameStore((s) => s.performAscend);

  // Helpers expect a GameStore; pass the fields they actually read.
  // Cast is intentional and safe — see docs/agent_docs/ui-patterns.md.
  const helperState = {
    inspiration,
    ascendCount,
    purchasedNodes,
  } as unknown as GameStore;
  const palier = getEffectivePalier(helperState, ascendCount);
  const canDo = canAscend(helperState);
  const fameGain = fameOnAscend(inspiration);

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Palier (threshold)</div>
        <div className="text-lg font-semibold">{formatBig(palier)} inspi</div>
      </section>

      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Current inspiration</div>
        <div className="text-lg">{formatBig(inspiration)}</div>
      </section>

      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">If you ascend now</div>
        <div className="text-lg text-fame">+{fameGain} fame</div>
      </section>

      <section className="rounded bg-app-panel p-3 text-sm opacity-80">
        Ascends so far: {ascendCount} · Total fame: {formatBig(fame)}
      </section>

      <Hoverable
        title="Ascend"
        body={() => {
          const s = useGameStore.getState();
          const liveGain = fameOnAscend(s.inspiration);
          return `Reset the run for permanent fame. Currently gain +${liveGain} fame.`;
        }}
        footer={() => {
          const s = useGameStore.getState();
          const hs = {
            inspiration: s.inspiration,
            ascendCount: s.ascendCount,
            purchasedNodes: s.purchasedNodes,
          } as unknown as GameStore;
          const livePalier = getEffectivePalier(hs, s.ascendCount);
          return `Palier: ${formatBig(s.inspiration)} / ${formatBig(livePalier)} inspi`;
        }}
      >
        <button
          type="button"
          disabled={!canDo}
          onClick={() => performAscend()}
          className="self-start rounded bg-fame/30 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Ascend
        </button>
      </Hoverable>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: 237 still passing. AscensionView's existing 3 tests are unchanged (the Ascend button remains queryable by `name: /ascend/i`; the wrapping `<span>` from Hoverable doesn't intercept).

- [ ] **Step 4: Manual dev smoke**

Run: `npm run dev`. Switch to Ascension. Hover the Ascend button.

InfoPanel shows: `Ascend` / `Reset the run for permanent fame. Currently gain +0 fame.` / `Palier: 0 / 1.00K inspi`.

In DevTools: `useGameStore.setState({ inspiration: big(2000) })`. Refresh hover — `+13 fame`, palier readout updates.

Press `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/AscensionView.tsx
git commit -m "ui(ascension): apply Hoverable to Ascend button

Static title; body factory shows live fame-gain preview via
fameOnAscend(state.inspiration); footer factory shows live
palier readout via getEffectivePalier with the helper-state
cast pattern from ui-patterns.md.

The 4 read-only sections above the button stay un-wrapped
per spec D4 (Ascend hover already covers palier/fame concepts;
mirror sections would be redundant)."
```

---

## Task 7: Apply `<Hoverable>` to SkillTreeView (5 sites)

**Files:**
- Modify: `src/ui/views/SkillTreeView.tsx` (wrap each node row's Buy button + add `EFFECT_DESCRIPTIONS` table)

**Goal:** Each of the 5 skill nodes' Buy button gets a Hoverable. Title is the node name (static). Body is a static effect description (per node) + live status. Footer is the static fame cost.

- [ ] **Step 1: Update `src/ui/views/SkillTreeView.tsx`**

Add `Hoverable` import. Define `EFFECT_DESCRIPTIONS: Record<SkillNodeId, string>`. Wrap each `<button>Buy</button>` with `<Hoverable>`.

Full updated file:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";

type Status = "purchased" | "available" | "locked";

const STATUS_LABEL: Record<Status, string> = {
  purchased: "Purchased",
  available: "Available",
  locked: "Locked",
};

const EFFECT_DESCRIPTIONS: Record<SkillNodeId, string> = {
  goldsmith: "+10% gold from canvas sales.",
  patient_eye: "+15% inspiration generation rate.",
  second_slot: "Workshop equipment slots: 1 → 2.",
  faster_strokes: "Ascend palier reduced 10%.",
  better_brush:
    "+1 magnitude on workshop item affixes (e.g., 5–15% → 6–16%).",
};

/**
 * Gating logic mirrors `canBuyNode` / `hasNode` in `skillTreeSlice.ts`.
 * Inlined here so the view subscribes to `purchasedNodes` (and `fame`) directly
 * via the bindings below — clicking Buy mutates `purchasedNodes`, which must
 * trigger a re-render so the next node flips Locked → Available.
 */
export function SkillTreeView(): JSX.Element {
  const fame = useGameStore((s) => s.fame);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyNode = useGameStore((s) => s.buyNode);

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="text-sm opacity-70">Fame: {formatBig(fame)}</header>
      <ul className="flex flex-col gap-2">
        {SKILL_NODES.map((node) => {
          const owned = purchasedNodes[node.id] === true;
          const prereqMet =
            node.prereq === null || purchasedNodes[node.prereq] === true;
          const affordable = fame.gte(big(node.cost));
          const status: Status = owned
            ? "purchased"
            : prereqMet && affordable
              ? "available"
              : "locked";
          const canBuy = !owned && prereqMet && affordable;
          return (
            <li
              key={node.id}
              className="flex items-center justify-between rounded bg-app-panel px-3 py-2"
            >
              <span>
                <strong>{node.name}</strong>{" "}
                <span className="opacity-60">
                  ({STATUS_LABEL[status]} · {node.cost} fame)
                </span>
              </span>
              <Hoverable
                title={node.name}
                body={() => {
                  const s = useGameStore.getState();
                  const ownedNow = s.purchasedNodes[node.id] === true;
                  const prereqMetNow =
                    node.prereq === null || s.purchasedNodes[node.prereq] === true;
                  const affordableNow = s.fame.gte(big(node.cost));
                  const liveStatus: Status = ownedNow
                    ? "purchased"
                    : prereqMetNow && affordableNow
                      ? "available"
                      : "locked";
                  return `${EFFECT_DESCRIPTIONS[node.id]} Status: ${STATUS_LABEL[liveStatus]}.`;
                }}
                footer={`Cost: ${node.cost} fame`}
              >
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => buyNode(node.id)}
                  className="rounded bg-fame/20 px-3 py-1 text-sm disabled:opacity-40"
                >
                  Buy
                </button>
              </Hoverable>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean. The `Record<SkillNodeId, string>` literal-union typing means a missing or misnamed key is a compile error (same protection as Phase 3's literal-union pattern).

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: 237 tests still pass. SkillTreeView has no own test file.

- [ ] **Step 4: Manual dev smoke**

Run: `npm run dev`. Switch to Skills tab.

1. Hover `Goldsmith` row's Buy button. InfoPanel shows `Goldsmith` / `+10% gold from canvas sales. Status: Locked.` / `Cost: 1 fame`.
2. In DevTools: `useGameStore.setState({ fame: big(50) })`.
3. Hover again — status now reads `Available`.
4. Click Buy. Hover again — `Purchased`.
5. Hover `Patient Eye` — `Available` (now affordable + prereq met).

Press `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/SkillTreeView.tsx
git commit -m "ui(skilltree): apply Hoverable to each node Buy button

EFFECT_DESCRIPTIONS table (Record<SkillNodeId, string>) co-located
in the view file — small, view-only, gives literal-union typo
protection. Body factory recomputes live status (Locked /
Available / Purchased) on each hover so the same node row reflects
post-Buy state immediately.

Title and footer are static per node (name and cost don't change);
body is a factory because status is live."
```

---

## Task 8: Apply `<Hoverable>` to BottomBar currencies (3 sites)

**Files:**
- Modify: `src/ui/widgets/CurrencyDisplay.tsx`

**Goal:** Wrap each `<CurrencyDisplay>` instance (the inner content, since `BottomBar.tsx` itself is just three `<CurrencyDisplay>` calls) with `<Hoverable>`. Per-currency hover content per spec §5 table.

- [ ] **Step 1: Update `src/ui/widgets/CurrencyDisplay.tsx`**

Add `Hoverable` import. Add a per-`CurrencyKind` content map. Wrap the existing rendered `<span>` with `<Hoverable>`.

Full updated file:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";

/**
 * Currency identifier for the BottomBar widget. Deliberately shadows
 * `CurrencyKey` from currencySlice — that one is store-internal; this one
 * is the UI layer's own naming. Decoupling lets either side rename without
 * forcing the other.
 */
export type CurrencyKind = "gold" | "inspiration" | "fame";

const LABELS: Record<CurrencyKind, string> = {
  gold: "Gold",
  inspiration: "Inspi",
  fame: "Fame",
};

const COLOR_CLASS: Record<CurrencyKind, string> = {
  gold: "text-gold",
  inspiration: "text-inspiration",
  fame: "text-fame",
};

const HOVER_TITLE: Record<CurrencyKind, string> = {
  gold: "Gold",
  inspiration: "Inspiration",
  fame: "Fame",
};

const HOVER_BODY_TEMPLATE: Record<CurrencyKind, (formatted: string) => string> = {
  gold: (v) => `Earned by selling paintings. Current: ${v}.`,
  inspiration: (v) =>
    `Generated by tree parts. Current: ${v}. Reset on ascend.`,
  fame: (v) =>
    `Earned on ascend, spent in skill tree. Current: ${v}. Permanent.`,
};

interface Props {
  kind: CurrencyKind;
}

export function CurrencyDisplay({ kind }: Props): JSX.Element {
  const value = useGameStore((s) => s[kind]);
  return (
    <Hoverable
      title={HOVER_TITLE[kind]}
      body={() => {
        const live = useGameStore.getState()[kind];
        return HOVER_BODY_TEMPLATE[kind](formatBig(live));
      }}
    >
      <span className={"flex items-baseline gap-1 text-sm " + COLOR_CLASS[kind]}>
        <span className="font-semibold">{LABELS[kind]}:</span>
        <span data-testid={`currency-${kind}`}>{formatBig(value)}</span>
      </span>
    </Hoverable>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: 237 still passing. The existing `BottomBar.test.tsx` cases query by text and testid; wrapping in `<Hoverable>` (which renders a `<span>`) doesn't change either.

- [ ] **Step 4: Manual dev smoke**

Run: `npm run dev`. Hover each currency in BottomBar:

1. Hover `Gold: 0`. InfoPanel: `Gold` / `Earned by selling paintings. Current: 0.`.
2. Hover `Inspi: 0`. InfoPanel: `Inspiration` / `Generated by tree parts. Current: 0. Reset on ascend.`.
3. Hover `Fame: 0`. InfoPanel: `Fame` / `Earned on ascend, spent in skill tree. Current: 0. Permanent.`.

Switch views and verify hovers still work everywhere (BottomBar is global).

Press `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/widgets/CurrencyDisplay.tsx
git commit -m "ui(currency): apply Hoverable to each BottomBar currency

Per-currency HOVER_TITLE + HOVER_BODY_TEMPLATE maps co-located in
the widget (small, widget-only). Body is a factory that re-reads
the current value via useGameStore.getState() at hover time, so
mid-hover ticks aren't visible but each fresh hover reflects the
latest currency value (which is the spec's content_provider model).

BottomBar.test.tsx cases continue to pass — Hoverable's <span>
wrapper doesn't change text content or data-testid lookups."
```

---

## Task 9: Final QA — done-criteria smoke, lint, build

**Files:** none modified directly; this is a verification gate.

**Goal:** Confirm spec §8 Definition of Done holds: lint clean, build clean, full test suite green, hover content matches the spec table on every wrapped element, popup verbs work end-to-end, refresh closes the popup.

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: **237 passing, 0 failing**. Record the exact count for the Phase 5 handover note.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean. No new errors over the pre-Phase-5 baseline.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: same warning count as before Phase 5 (1 pre-existing `react-refresh/only-export-components` warning on `main.tsx`). No new warnings or errors.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: success — `dist/` produced. Note the bundle size (`dist/assets/index-*.js`'s gzipped size). Target: under 100 KB gzipped (Phase 4 was 81 KB; Phase 5 adds the popup + Hoverable usage ≈ +5–10 KB). Hard ceiling: 250 KB per PORT_PLAN §8 DoD #12.

- [ ] **Step 5: End-to-end gameplay smoke**

Run: `npm run dev`. Open the URL.

Run through this checklist in the browser, fresh save (clear IDB via DevTools → Application → IndexedDB → delete `keyval-store`, then refresh):

1. **HomeView loads.** Hover stage header (`Seed`), inspi/sec readout (`Inspiration / sec` + multiplier), each Buy button (`<part> (Lv 0)` + rate body + cost footer).
2. In DevTools: `useGameStore.getState().add("gold", big(10000))`. Refresh. Click Buy on Spark a few times. Hover again — Lv updates, inspi rate body updates, next cost goes up.
3. Reach the threshold. Grow button appears. Hover it (`Levels in current stage: N/M.`). Click. Stage advances to `Sapling`.
4. Switch to **PaintingView**. Hover the Workshop button (`Inventory: 0/3` footer). Click it. Popup opens with backdrop.
5. Hover the Craft button inside the popup (`Cost: 100 gold · Inventory: 0/3`). Click Craft. Item appears in Inventory column. Hover the new item card (`<kind> <magnitude>%` + `Click to equip.`).
6. Click the inventory card. Item moves to Equipped. Hover the equipped card (`Currently equipped. Click to unequip…`).
7. Click the equipped card. Item returns to Inventory. Click the ✕ on the inventory card. Item disappears.
8. Press `Esc`. Popup closes. Re-open. Click backdrop. Popup closes.
9. Re-open. Switch to **AscensionView** via TopBar. Popup auto-closes.
10. Hover Ascend button. With inspi=0, body shows `+0 fame`, footer shows `0 / 1.00K inspi`. In DevTools: `useGameStore.setState({ inspiration: big(2000) })`. Hover again — `+13 fame`, button enabled. Click Ascend. State resets, fame credited.
11. Switch to **SkillTreeView**. Hover Goldsmith Buy (`+10% gold from canvas sales. Status: Available.` if fame ≥ 1). Click. Status flips to `Purchased`. Hover next node (`Patient Eye`) — `Available`.
12. **BottomBar hovers** during all of the above: hover each currency at least once and verify the body text matches the §5 table.
13. **Refresh the page while popup is closed.** Verify post-refresh state: tree state survives, skill nodes survive, popup is closed.
14. Open popup. Refresh page. Verify popup is closed (workshopPopupOpen stripped).

If any step fails, stop and triage — do not commit a broken DoD.

- [ ] **Step 6: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 7: Final commit (if anything changed during smoke)**

If Steps 1–5 produced no fixes, skip this step. If a smoke failure forced a fix, commit it with a `fix(phase5): …` message that names what broke and what was changed.

- [ ] **Step 8: Phase 5 done — handover snapshot is the next session's work**

Phase 5 complete. Update `docs/HANDOVER.md` (post-Phase-5 snapshot, mirroring the post-Phase-4 structure) is part of the Phase 6 brainstorming session, not Phase 5 itself.

---

## Plan self-review summary

**Spec coverage:** every spec section maps to tasks:

- §1 scope/goals → Tasks 1–8 deliver each component/wiring; Task 9 verifies DoD.
- §2 D1 (popup is overlay over `<main>` only) → Tasks 3 (popup) + 4 (mount + `relative` on `<main>`).
- §2 D2 (Hoverable factory callbacks) → Task 2 (signature + 3 new tests).
- §2 D3 (uiSlice transient + partialize strip) → Task 1 (slice + persistence-integration extension).
- §2 D4 (hover scope) → Tasks 4 (PaintingView Workshop button), 5 (HomeView 4 sites), 6 (AscensionView Ascend), 7 (SkillTreeView 5 nodes), 8 (BottomBar 3 currencies), and 3 (popup-internal: Craft + inventory card + discard + equipped card).
- §2 D5 (workshop verbs in popup) → Task 3 (component exposes craft + equip + unequip + discard; no swap UI).
- §2 D6 (17 new tests) → Task 1 (3 uiSlice + 1 persistence) + Task 2 (3 Hoverable) + Task 3 (10 popup) = 17.
- §3 file layout → matches Tasks 1–8 exactly.
- §4 component contracts → Task 1 (uiSlice), Task 2 (Hoverable signature), Task 3 (WorkshopPopup), Task 4 (App + PaintingView wiring).
- §5 hover content table → Tasks 4 (Workshop button), 5 (HomeView 4 entries), 6 (AscensionView Ascend), 7 (SkillTreeView 5 entries), 8 (BottomBar 3 entries), and 3 (popup-internal: Craft + inventory + discard + equipped).
- §6 test scope → Tasks 1, 2, 3 (and the persistence extension in Task 1).
- §7 forward-compat seams → not directly buildable but not blocking; preserved by following the spec's component contracts.
- §8 Definition of Done → Task 9 walks every numbered criterion.

**Placeholder scan:** no "TBD"/"TODO"/"add appropriate"/"similar to Task N" patterns. The Task 1 persistence-integration step intentionally references the existing test pattern in `tests/store/persistence-integration.test.ts` rather than duplicating its IDB-flush boilerplate; the implementer is told exactly which existing test to mirror (Phase 4's `currentView` round-trip case).

**Type consistency:**
- `ViewSlice` and `UiSlice` both append to the `GameStore` union in Task 1 — order matches Task 1's snippet.
- `WorkshopPopup` (Task 3) imports `getCurrentSlotCount` and `MAX_INVENTORY_SLOTS` and `CRAFT_COST_GOLD` — names match `workshopSlice.ts` exports and `workshopAffixes.ts` exports.
- `Hoverable` (Task 2) signature `string | (() => string)` and `ReactNode | (() => ReactNode)` matches every Hoverable consumer in Tasks 3, 4, 5, 6, 7, 8.
- `EFFECT_DESCRIPTIONS: Record<SkillNodeId, string>` (Task 7) keys match the 5 node ids exported by `skillTreeNodes.ts` (`goldsmith`, `patient_eye`, `second_slot`, `faster_strokes`, `better_brush`).
- `getEffectivePalier(state, count)` and `fameOnAscend(inspi)` signatures (Task 6 hover factory) match `systems/ascend.ts` and `core/balance.ts`.
- `getInspiMultiplier(state)`, `getProducingParts(state)`, `getTotalLevelsInStage(state, idx)`, `canGrowSapling(state)` (Task 5) match `core/multipliers.ts` and `store/treeSlice.ts`.

**Outstanding plan-time risks:**
- Task 3's auto-close-on-view-change test (case 10) depends on React's effect timing in jsdom + Zustand's synchronous setState. If the assertion fires before the useEffect re-runs, the test might see stale `workshopPopupOpen=true`. Step 4 includes the `act()` workaround pattern as the fallback. If neither works, fall back to manual `flushSync` from `react-dom` or restructure the test to subscribe to `workshopPopupOpen` and assert via a `waitFor`.
- Task 3's backdrop-click test selects the inner card via `dialog.firstChild`. If the DOM structure has Hoverable spans interspersed (e.g., the close-X button is wrapped in Hoverable in a future iteration), `firstChild` won't be the card div. Step 4 includes the `querySelector(".rounded-lg")` fallback.
- Task 5's HomeView `useGameStore.getState().currentStage in TREE_STAGES` check is overly defensive — `currentStage` is an integer 0..N, and `TREE_STAGES` is a fixed-size array. Simplify to `TREE_STAGES[useGameStore.getState().currentStage]?.name ?? "?"` if the `in` check trips ESLint or feels redundant. Behaves identically.
- Tailwind 4 JIT: `bg-red-900/40` is used on the discard hover state in Task 3. Tailwind 4 should pick this up from the source string, but if the discard hover doesn't paint red on the dev smoke (Task 9 Step 5.7), add `@source inline("bg-red-900/40")` to `src/index.css` before declaring done.
- The PaintingView Workshop button in Task 4 uses `useGameStore.getState().inventory.length` inside a footer factory. PaintingView already subscribes to `equippedItems` (which can change inventory length implicitly via `unequip` returning items to inventory) but doesn't subscribe to `inventory`. The footer factory works correctly because it uses `getState()` at hover time, but PaintingView's render won't re-trigger on inventory changes alone — the popup updates the visible inventory list inside itself, so PaintingView's "Workshop" button label doesn't need to react. Acceptable.
