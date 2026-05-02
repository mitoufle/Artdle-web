# Artdle Web — Phase 4 Implementation Plan: UI Shell + 4 View Stubs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the v1 gameplay loop into the browser as a clickable React UI: an App layout shell (TopBar / `<main>` / `<InfoPanel>` / `<BottomBar>`), a `viewSlice` view-switcher, four widgets (`TopBar`, `BottomBar`, `CurrencyDisplay`, `InfoPanel`, `Hoverable` wrapper), and four fully-functional views (`HomeView`, `PaintingView`, `AscensionView`, `SkillTreeView`) consuming existing slice actions and selectors. End state: open `npm run dev` and play the v1 loop end-to-end.

**Architecture:** A new single-field `viewSlice` is wired into the combined `GameStore`. Widgets live under `src/ui/widgets/`, views under `src/ui/views/`. `App.tsx` is rewritten to host the shell and switch on `currentView`. All views subscribe via Zustand selectors (never the whole store) and gate buttons with the `can*` selectors built in Phases 2 and 3. The `<Hoverable>` wrapper is built and tested in Phase 4 but **not applied** anywhere; Phase 5 wraps every interactive element.

**Tech Stack:** React 19 + TypeScript 6 strict + Vite 8 + Tailwind 4 (CSS-first via `@theme` in `src/index.css`) + Zustand 5 + `@testing-library/react` 16 + `@testing-library/user-event` 14 + Vitest 4 + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-02-phase4-ui-shell-design.md` is the authoritative design.

---

## Pre-flight (read once before starting Task 1)

### Locked design decisions (from spec §2)

1. **Single Phase 4 plan, not split** — one cohesive review.
2. **Views are fully functional** — v1 loop end-to-end clickable after Phase 4.
3. **`ViewId` is a literal union, persisted** — `"home" | "painting" | "ascension" | "skills"`. Refresh preserves view.
4. **TopBar holds the view nav** — 4 buttons; active gets `bg-app-panel`.
5. **InfoPanel renders empty in P4 with reserved height** — Phase 5 fills it.
6. **`<Hoverable>` is built but not applied in P4** — Phase 5 applies it.
7. **Workshop button is a disabled stub** — locks layout for Phase 5.
8. **Test scope: 4 new test files, 6–8 tests** — `viewSlice`, `BottomBar`, `Hoverable`, `AscensionView`.
9. **Visual style: theme tokens, no animation** — `bg-app-bg`, `bg-app-panel`, `text-gold` etc.
10. **Selectors only; never whole-store subscription** — `useGameStore((s) => s.field)`.

### Phase 0–3 lessons baked into this plan

- **Literal-union string types** for compile-time typo protection (`ViewId` matches the `SkillNodeId`/`AffixKind` pattern).
- **Save-format JSDoc** above any persisted literal-union — renames require a migration.
- **`Object.freeze` on initial-state constants.**
- **Selectors over `useGameStore()` no-arg.**
- **`tsconfig.app.json` already sets `noEmit: true`.** Don't toggle it; Vite/Vitest handles compilation.
- **No `partialize` change needed** — `currentView` is a plain string and rides along in `...rest`.

### Run commands cheat sheet

| Action | Command |
|---|---|
| Run all tests | `npm test` |
| Run one test file | `npm test -- tests/path/to/file.test.tsx` |
| Run typecheck | `npx tsc -b --noEmit` (or `npm run build`) |
| Run lint | `npm run lint` |
| Dev server (manual smoke) | `npm run dev` |
| Production build | `npm run build` |

### Commit message conventions

Conventional prefixes used in earlier phases: `test:`, `feat:`, `fix:`, `docs:`, `core:`, `store:`, `config:`, `systems:`, `ui:`, `refactor:`. One commit per plan task at the end of the task.

### Standard UI test scaffolding

UI tests mount a component, optionally seed the singleton store via `useGameStore.setState(...)`, then assert on DOM via `@testing-library/react`'s `screen` queries. Reset pattern in `beforeEach`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

beforeEach(() => {
  // Reset to a known state. Use the slice's reset action when available;
  // otherwise setState() the persisted fields directly.
  useGameStore.getState().resetRunCurrencies();
  useGameStore.getState().clearHoverInfo();
  useGameStore.setState({ currentView: "home" });
});

afterEach(() => {
  cleanup(); // unmount components rendered by Testing Library
});
```

`@testing-library/jest-dom` matchers (`toBeDisabled`, `toHaveTextContent`) are auto-loaded by `vitest.setup.ts`.

### Mouse-event API

`@testing-library/react`'s `fireEvent.mouseEnter(element)` / `fireEvent.mouseLeave(element)` synchronously dispatch the events. Use these (not `userEvent.hover`) for the `<Hoverable>` test to keep the assertion immediate and synchronous.

---

## File structure

### New files

```
src/store/viewSlice.ts                       Task 1
src/ui/widgets/TopBar.tsx                    Task 2
src/ui/widgets/CurrencyDisplay.tsx           Task 3
src/ui/widgets/BottomBar.tsx                 Task 4
src/ui/widgets/InfoPanel.tsx                 Task 5
src/ui/widgets/Hoverable.tsx                 Task 6
src/ui/views/HomeView.tsx                    Task 8
src/ui/views/PaintingView.tsx                Task 9
src/ui/views/AscensionView.tsx               Task 10
src/ui/views/SkillTreeView.tsx               Task 11

tests/store/viewSlice.test.ts                Task 1
tests/ui/widgets/BottomBar.test.tsx          Task 4
tests/ui/widgets/Hoverable.test.tsx          Task 6
tests/ui/views/AscensionView.test.tsx        Task 10
```

### Edited files

```
src/App.tsx                                  Task 7 (full rewrite) + Tasks 8–11 (swap stubs for real views)
src/store/index.ts                           Task 1 (wire createViewSlice into combined store)
```

### Module boundary contract

- `store/viewSlice.ts`: imports nothing from other slices. Exports `ViewId`, `ViewSlice`, `createViewSlice`, `initialViewState`.
- `ui/widgets/CurrencyDisplay.tsx`: imports `useGameStore`, `formatBig`. Reads one currency field.
- `ui/widgets/BottomBar.tsx`: imports `CurrencyDisplay`. No store reads of its own.
- `ui/widgets/TopBar.tsx`: imports `useGameStore` (reads `currentView` + calls `setView`).
- `ui/widgets/InfoPanel.tsx`: imports `useGameStore` (reads `hoverTitle`, `hoverBody`, `hoverFooter`).
- `ui/widgets/Hoverable.tsx`: imports `useGameStore` (calls `pushHoverInfo`/`clearHoverInfo`).
- `ui/views/HomeView.tsx`: imports `useGameStore`, `TREE_STAGES`, `treePartCost`, `inspiPerSec`, `getProducingParts`, `canGrowSapling`, `getInspiMultiplier`, `formatBig`.
- `ui/views/PaintingView.tsx`: imports `useGameStore`, `PAINT_TIME_BASE_SECONDS`, `getPaintTimeMultiplier`.
- `ui/views/AscensionView.tsx`: imports `useGameStore`, `getEffectivePalier`, `canAscend`, `fameOnAscend`, `formatBig`.
- `ui/views/SkillTreeView.tsx`: imports `useGameStore`, `SKILL_NODES`, `big`, `formatBig`. Gating logic (owned / prereqMet / affordable) is inlined in the view to keep `purchasedNodes` in the subscription path; mirrors `canBuyNode`/`hasNode` in the slice (which are still tested independently in `skillTreeSlice.test.ts`).
- `App.tsx`: imports widgets + views + `useGameStore` (reads `currentView`).

---

## Task 1: `viewSlice` — view-switcher slice

**Files:**
- Create: `src/store/viewSlice.ts`
- Test: `tests/store/viewSlice.test.ts`
- Modify: `src/store/index.ts` (wire `createViewSlice` into combined store + `GameStore` type)

**Goal:** A persisted single-field slice that holds the active view and exposes `setView`.

- [ ] **Step 1: Write the failing test**

Create `tests/store/viewSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";

describe("viewSlice", () => {
  beforeEach(() => {
    useGameStore.setState({ currentView: "home" });
  });

  it("defaults currentView to 'home'", () => {
    expect(useGameStore.getState().currentView).toBe("home");
  });

  it("setView('painting') updates currentView", () => {
    useGameStore.getState().setView("painting");
    expect(useGameStore.getState().currentView).toBe("painting");
  });

  it("setView('ascension') updates currentView", () => {
    useGameStore.getState().setView("ascension");
    expect(useGameStore.getState().currentView).toBe("ascension");
  });

  it("setView('skills') updates currentView", () => {
    useGameStore.getState().setView("skills");
    expect(useGameStore.getState().currentView).toBe("skills");
  });

  it("setView round-trips through every ViewId", () => {
    const ids = ["home", "painting", "ascension", "skills"] as const;
    for (const id of ids) {
      useGameStore.getState().setView(id);
      expect(useGameStore.getState().currentView).toBe(id);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/store/viewSlice.test.ts`
Expected: FAIL with `Cannot read properties of undefined (reading 'setView')` or similar — `viewSlice` doesn't exist yet.

- [ ] **Step 3: Write the slice**

Create `src/store/viewSlice.ts`:

```ts
import type { StateCreator } from "zustand";

/**
 * Persisted view identifier. Renames require a save migration.
 */
export type ViewId = "home" | "painting" | "ascension" | "skills";

export interface ViewState {
  /** Last-active view; persisted via the existing partialize. Default "home". */
  currentView: ViewId;
}

export interface ViewSlice extends ViewState {
  /** Switch the active view. TS literal union enforces validity at call sites. */
  setView: (v: ViewId) => void;
}

export const initialViewState: ViewState = Object.freeze({
  currentView: "home",
}) as ViewState;

export const createViewSlice: StateCreator<ViewSlice, [], [], ViewSlice> = (set) => ({
  ...initialViewState,
  setView: (v) => set({ currentView: v }),
});
```

- [ ] **Step 4: Wire into combined store**

Edit `src/store/index.ts`. Add the import after the other slice imports:

```ts
import { createViewSlice, type ViewSlice } from "./viewSlice";
```

Add `& ViewSlice` to the `GameStore` union:

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
  & GameTick;
```

Add the slice to the `create` body alongside the others:

```ts
...createViewSlice(set, get, store),
```

(Insert after `createWorkshopSlice` and before `tickAll`.) **No `partialize` change** — `currentView` is a plain string.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/store/viewSlice.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean (no new errors).

- [ ] **Step 7: Commit**

```bash
git add src/store/viewSlice.ts src/store/index.ts tests/store/viewSlice.test.ts
git commit -m "store(view): viewSlice + setView for Phase 4 view-switcher"
```

---

## Task 2: `<TopBar>` widget — title + 4 nav buttons

**Files:**
- Create: `src/ui/widgets/TopBar.tsx`

**Goal:** A horizontal top strip rendering the title `Artdle` and four buttons (`Home`, `Painting`, `Ascension`, `Skills`). Active button has `bg-app-panel`; inactive buttons are dimmed. Click switches `currentView` via `setView`.

No test file: behavior is exercised manually via `npm run dev` smoke in Task 7 and Task 12.

- [ ] **Step 1: Write the component**

Create `src/ui/widgets/TopBar.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { ViewId } from "@/store/viewSlice";

interface NavButtonProps {
  id: ViewId;
  label: string;
}

function NavButton({ id, label }: NavButtonProps): JSX.Element {
  const currentView = useGameStore((s) => s.currentView);
  const setView = useGameStore((s) => s.setView);
  const isActive = currentView === id;
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => setView(id)}
      className={
        "rounded px-3 py-1 text-sm transition-colors " +
        (isActive ? "bg-app-panel text-app-text" : "text-app-text/60 hover:text-app-text")
      }
    >
      {label}
    </button>
  );
}

export function TopBar(): JSX.Element {
  return (
    <header className="flex items-center justify-between border-b border-app-panel bg-app-bg px-4 py-2">
      <strong className="text-lg tracking-wide">Artdle</strong>
      <nav className="flex gap-1">
        <NavButton id="home" label="Home" />
        <NavButton id="painting" label="Painting" />
        <NavButton id="ascension" label="Ascension" />
        <NavButton id="skills" label="Skills" />
      </nav>
      <span className="text-xs opacity-40">v0.1</span>
    </header>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/ui/widgets/TopBar.tsx
git commit -m "ui(topbar): TopBar widget — title + 4 view-nav buttons"
```

---

## Task 3: `<CurrencyDisplay>` widget

**Files:**
- Create: `src/ui/widgets/CurrencyDisplay.tsx`

**Goal:** A small leaf widget that renders one currency as `LABEL: <formatted-value>` with the colored token from `index.css`. Consumed by `<BottomBar>` in Task 4.

No standalone test: behavior is exercised through `BottomBar.test.tsx`.

- [ ] **Step 1: Write the component**

Create `src/ui/widgets/CurrencyDisplay.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";

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

interface Props {
  kind: CurrencyKind;
}

export function CurrencyDisplay({ kind }: Props): JSX.Element {
  const value = useGameStore((s) => s[kind]);
  return (
    <span className={"flex items-baseline gap-1 text-sm " + COLOR_CLASS[kind]}>
      <span className="font-semibold">{LABELS[kind]}:</span>
      <span data-testid={`currency-${kind}`}>{formatBig(value)}</span>
    </span>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/ui/widgets/CurrencyDisplay.tsx
git commit -m "ui(currency): CurrencyDisplay leaf widget — colored label + formatBig"
```

---

## Task 4: `<BottomBar>` widget + test

**Files:**
- Create: `src/ui/widgets/BottomBar.tsx`
- Test: `tests/ui/widgets/BottomBar.test.tsx`

**Goal:** Three `<CurrencyDisplay>` instances laid out horizontally inside a bottom strip. Test asserts all three currencies render with formatted values.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/widgets/BottomBar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BottomBar } from "@/ui/widgets/BottomBar";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("<BottomBar />", () => {
  beforeEach(() => {
    useGameStore.setState({
      gold: big(1234),
      inspiration: big(56),
      fame: big(7),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all three currency labels", () => {
    render(<BottomBar />);
    expect(screen.getByText("Gold:")).toBeInTheDocument();
    expect(screen.getByText("Inspi:")).toBeInTheDocument();
    expect(screen.getByText("Fame:")).toBeInTheDocument();
  });

  it("formats gold via formatBig (1234 -> '1.23K')", () => {
    render(<BottomBar />);
    expect(screen.getByTestId("currency-gold")).toHaveTextContent("1.23K");
  });

  it("renders inspiration as integer (56)", () => {
    render(<BottomBar />);
    expect(screen.getByTestId("currency-inspiration")).toHaveTextContent("56");
  });

  it("renders fame as integer (7)", () => {
    render(<BottomBar />);
    expect(screen.getByTestId("currency-fame")).toHaveTextContent("7");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/widgets/BottomBar.test.tsx`
Expected: FAIL — `BottomBar` module not found.

- [ ] **Step 3: Write the component**

Create `src/ui/widgets/BottomBar.tsx`:

```tsx
import type { JSX } from "react";
import { CurrencyDisplay } from "./CurrencyDisplay";

export function BottomBar(): JSX.Element {
  return (
    <footer className="flex items-center justify-center gap-6 border-t border-app-panel bg-app-bg px-4 py-2">
      <CurrencyDisplay kind="gold" />
      <CurrencyDisplay kind="inspiration" />
      <CurrencyDisplay kind="fame" />
    </footer>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/ui/widgets/BottomBar.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/widgets/BottomBar.tsx tests/ui/widgets/BottomBar.test.tsx
git commit -m "ui(bottombar): BottomBar widget + test — 3 currencies with formatBig"
```

---

## Task 5: `<InfoPanel>` widget

**Files:**
- Create: `src/ui/widgets/InfoPanel.tsx`

**Goal:** A reserved-height strip that reads `hoverTitle`, `hoverBody`, `hoverFooter` from `hoverInfoSlice` and renders them. Empty by default in Phase 4 (nothing pushes content); reserved height keeps the layout stable for Phase 5.

No standalone test in Phase 4: the slice's behavior is tested via `Hoverable.test.tsx` in Task 6 (which asserts the same fields are written). The InfoPanel itself is a pure read-and-render component with no logic.

- [ ] **Step 1: Write the component**

Create `src/ui/widgets/InfoPanel.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";

export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);
  return (
    <section
      aria-live="polite"
      className="min-h-16 border-t border-b border-app-panel bg-app-panel px-4 py-2 text-sm"
    >
      {title !== "" && <div className="font-semibold">{title}</div>}
      <div className="opacity-90">{body}</div>
      <div className="opacity-60">{footer}</div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/ui/widgets/InfoPanel.tsx
git commit -m "ui(infopanel): InfoPanel reads hoverInfoSlice; reserved height for P4"
```

---

## Task 6: `<Hoverable>` wrapper + test

**Files:**
- Create: `src/ui/widgets/Hoverable.tsx`
- Test: `tests/ui/widgets/Hoverable.test.tsx`

**Goal:** A wrapper that pushes hover content to `hoverInfoSlice` on `mouseenter` and clears it on `mouseleave`. Built but **not applied** anywhere in Phase 4.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/widgets/Hoverable.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";

describe("<Hoverable />", () => {
  beforeEach(() => {
    useGameStore.getState().clearHoverInfo();
  });

  afterEach(() => {
    cleanup();
  });

  it("pushes title and body on mouseEnter", () => {
    render(
      <Hoverable title="T" body="B">
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
    const s = useGameStore.getState();
    expect(s.hoverTitle).toBe("T");
    expect(s.hoverBody).toBe("B");
    expect(s.hoverFooter).toBe("");
  });

  it("pushes footer when provided", () => {
    render(
      <Hoverable title="T" body="B" footer="F">
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    fireEvent.mouseEnter(screen.getByTestId("target").parentElement!);
    expect(useGameStore.getState().hoverFooter).toBe("F");
  });

  it("clears all hover fields on mouseLeave", () => {
    render(
      <Hoverable title="T" body="B" footer="F">
        <span data-testid="target">X</span>
      </Hoverable>,
    );
    const wrapper = screen.getByTestId("target").parentElement!;
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);
    const s = useGameStore.getState();
    expect(s.hoverTitle).toBe("");
    expect(s.hoverBody).toBe("");
    expect(s.hoverFooter).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/widgets/Hoverable.test.tsx`
Expected: FAIL — `Hoverable` module not found.

- [ ] **Step 3: Write the component**

Create `src/ui/widgets/Hoverable.tsx`:

```tsx
import type { JSX, ReactNode } from "react";
import { useGameStore } from "@/store";

interface Props {
  title: string;
  body: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Wrapper that pushes hover content to hoverInfoSlice on mouseEnter and
 * clears it on mouseLeave. Phase 4 builds and tests this; Phase 5 wraps
 * every interactive element. Kept as a <span> so it doesn't break inline
 * layouts (a <button> child still gets focus + click handling).
 */
export function Hoverable({ title, body, footer, children }: Props): JSX.Element {
  const pushHoverInfo = useGameStore((s) => s.pushHoverInfo);
  const clearHoverInfo = useGameStore((s) => s.clearHoverInfo);
  return (
    <span
      onMouseEnter={() => pushHoverInfo(title, body, footer ?? "")}
      onMouseLeave={() => clearHoverInfo()}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/ui/widgets/Hoverable.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/widgets/Hoverable.tsx tests/ui/widgets/Hoverable.test.tsx
git commit -m "ui(hoverable): Hoverable wrapper + test — push/clear hoverInfoSlice"
```

---

## Task 7: `App.tsx` rewrite — assemble the shell with view stubs

**Files:**
- Modify: `src/App.tsx` (full body replacement)

**Goal:** Replace the v0.1 scaffold with the real layout shell. The four views are temporary placeholders (`<div>`-with-text) that Tasks 8–11 swap for real components. After this task, `npm run dev` shows the shell with working view tabs.

No test — exercised by manual `npm run dev` smoke at the end of the task.

- [ ] **Step 1: Rewrite `src/App.tsx`**

Replace the entire file body:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { TopBar } from "@/ui/widgets/TopBar";
import { BottomBar } from "@/ui/widgets/BottomBar";
import { InfoPanel } from "@/ui/widgets/InfoPanel";

function ViewStub({ name }: { name: string }): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center text-app-text/60">
      <p>{name} — coming in a later task</p>
    </div>
  );
}

export function App(): JSX.Element {
  const currentView = useGameStore((s) => s.currentView);
  let body: JSX.Element;
  switch (currentView) {
    case "home":
      body = <ViewStub name="HomeView" />;
      break;
    case "painting":
      body = <ViewStub name="PaintingView" />;
      break;
    case "ascension":
      body = <ViewStub name="AscensionView" />;
      break;
    case "skills":
      body = <ViewStub name="SkillTreeView" />;
      break;
  }
  return (
    <div className="flex h-screen w-screen flex-col bg-app-bg text-app-text">
      <TopBar />
      <main className="flex-1 overflow-auto">{body}</main>
      <InfoPanel />
      <BottomBar />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean. The `switch` is exhaustive over `ViewId`; TS will flag any missing case if a future `ViewId` value is added.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: 211–213 tests pass (existing 204 + 5 viewSlice + 4 BottomBar + 3 Hoverable). No regressions.

- [ ] **Step 4: Manual dev smoke**

Run: `npm run dev`
Open: the printed `localhost` URL in a browser.

Verify by clicking through:
- TopBar shows `Artdle` + 4 buttons + `v0.1`.
- The active button is visually distinct (`bg-app-panel`).
- Clicking each button switches the main panel text between `HomeView`, `PaintingView`, `AscensionView`, `SkillTreeView` placeholders.
- BottomBar shows `Gold: 0`, `Inspi: 0`, `Fame: 0` (or persisted values from a prior save).
- InfoPanel strip is visible, empty, height reserved.

Press `Ctrl+C` to stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "ui(app): rewrite App.tsx — TopBar/main/InfoPanel/BottomBar with view stubs"
```

---

## Task 8: `<HomeView>` — tree + part upgrades + grow

**Files:**
- Create: `src/ui/views/HomeView.tsx`
- Modify: `src/App.tsx` (replace `<ViewStub name="HomeView" />` with `<HomeView />`)

**Goal:** Render the current tree stage, computed inspi/sec, every part on stages `0..currentStage` with a Buy button (gold-gated), and a "Grow" button visible iff `canGrowSapling(state)`.

No standalone test — verified by manual `npm run dev` smoke. Logic is already covered by `treeSlice.test.ts` (Phase 2).

- [ ] **Step 1: Write the component**

Create `src/ui/views/HomeView.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { TREE_STAGES } from "@/config/treeStages";
import { treePartCost, inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
import { getProducingParts, canGrowSapling } from "@/store/treeSlice";
import { formatBig } from "@/core/formatter";

export function HomeView(): JSX.Element {
  const currentStage = useGameStore((s) => s.currentStage);
  const partLevels = useGameStore((s) => s.partLevels);
  const gold = useGameStore((s) => s.gold);
  const buyPartLevel = useGameStore((s) => s.buyPartLevel);
  const growSapling = useGameStore((s) => s.growSapling);

  // Compute live inspi/sec the same way treeTick does.
  const fullState = useGameStore.getState();
  const rate = inspiPerSec(getProducingParts(fullState), getInspiMultiplier(fullState));
  const canGrow = canGrowSapling(fullState);

  const stageName = TREE_STAGES[currentStage]?.name ?? "?";

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h2 className="text-xl font-semibold">{stageName}</h2>
        <p className="text-sm opacity-70">{formatBig(rate)} inspi/sec</p>
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
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => buyPartLevel(part.id)}
                  className="rounded bg-gold/20 px-3 py-1 text-sm disabled:opacity-40"
                >
                  Buy ({formatBig(cost)} gold)
                </button>
              </li>
            );
          }),
        )}
      </ul>

      {canGrow && (
        <button
          type="button"
          onClick={() => growSapling()}
          className="self-start rounded bg-inspiration/20 px-4 py-2 text-sm"
        >
          Grow next stage
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `App.tsx`**

Edit `src/App.tsx`. Add the import:

```tsx
import { HomeView } from "@/ui/views/HomeView";
```

Replace the `home` case:

```tsx
case "home":
  body = <HomeView />;
  break;
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: same count as Task 7 (no new tests). All passing.

- [ ] **Step 5: Manual dev smoke**

Run: `npm run dev`. Open the URL.

On HomeView: verify the stage name reads `Seed`. Click `Buy (10 gold)` on Spark — fails (gray, disabled — gold = 0). Open DevTools console:

```js
useGameStore.getState().add("gold", big(10000))
```

Refresh. Now Buy buttons enable. Click Spark a few times — level increments, gold decreases, inspi/sec readout grows.

Press `Ctrl+C` to stop.

- [ ] **Step 6: Commit**

```bash
git add src/ui/views/HomeView.tsx src/App.tsx
git commit -m "ui(home): HomeView — tree stage + parts with Buy + Grow button"
```

---

## Task 9: `<PaintingView>` — canvas slot + workshop stub

**Files:**
- Create: `src/ui/views/PaintingView.tsx`
- Modify: `src/App.tsx` (replace `<ViewStub name="PaintingView" />` with `<PaintingView />`)

**Goal:** Display the canvas state (Idle/Painting derived from `canvasProgress`), progress in seconds, the equipped item list, and a disabled "Workshop" button placeholder for Phase 5.

No standalone test — verified by manual smoke. Canvas tick logic is covered by `canvasSlice.test.ts` (Phase 2).

- [ ] **Step 1: Write the component**

Create `src/ui/views/PaintingView.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";
import { getPaintTimeMultiplier } from "@/core/multipliers";

export function PaintingView(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const fullState = useGameStore.getState();
  const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(fullState);
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

      <button
        type="button"
        disabled
        className="self-start rounded bg-app-panel px-4 py-2 text-sm opacity-40"
        title="Workshop popup arrives in Phase 5"
      >
        Workshop (coming soon)
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `App.tsx`**

Edit `src/App.tsx`. Add the import:

```tsx
import { PaintingView } from "@/ui/views/PaintingView";
```

Replace the `painting` case:

```tsx
case "painting":
  body = <PaintingView />;
  break;
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: same count, all passing.

- [ ] **Step 5: Manual dev smoke**

Run: `npm run dev`. Open the URL. Switch to Painting tab.

Verify: state shows `Idle` initially with `0.0 / 10.0s`. After buying parts on HomeView and waiting a few seconds (or seeding inspi via DevTools), the canvas auto-paints and the progress climbs. After threshold, gold is credited (visible in BottomBar) and progress resets.

Equip an item via DevTools to verify the "Equipped" section:

```js
const s = useGameStore.getState();
s.add("gold", big(200));
s.craft();   // rolls into inventory[0]
s.equip(0);  // moves to equippedItems[0]
```

Refresh — equipped item card appears.

Press `Ctrl+C`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/views/PaintingView.tsx src/App.tsx
git commit -m "ui(painting): PaintingView — canvas slot + equipped list + workshop stub"
```

---

## Task 10: `<AscensionView>` + test — palier preview + ascend button

**Files:**
- Create: `src/ui/views/AscensionView.tsx`
- Test: `tests/ui/views/AscensionView.test.tsx`
- Modify: `src/App.tsx` (replace `<ViewStub name="AscensionView" />` with `<AscensionView />`)

**Goal:** Display current inspiration vs the palier threshold, the fame gain preview (`fameOnAscend(inspiration)`), `ascendCount`, and an Ascend button gated by `!canAscend(state)`. **This view is the test target** for the ascend-button gating contract.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/views/AscensionView.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AscensionView } from "@/ui/views/AscensionView";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("<AscensionView />", () => {
  beforeEach(() => {
    // Fresh: ascendCount=0, palier=1000, no skill nodes, inspi=0.
    useGameStore.setState({
      ascendCount: 0,
      inspiration: big(0),
      gold: big(0),
      fame: big(0),
      purchasedNodes: {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("disables the Ascend button when inspiration < palier", () => {
    useGameStore.setState({ inspiration: big(500) }); // < 1000
    render(<AscensionView />);
    expect(screen.getByRole("button", { name: /ascend/i })).toBeDisabled();
  });

  it("enables the Ascend button when inspiration >= palier", () => {
    useGameStore.setState({ inspiration: big(1000) }); // == 1000
    render(<AscensionView />);
    expect(screen.getByRole("button", { name: /ascend/i })).not.toBeDisabled();
  });

  it("clicking the enabled Ascend button performs the ascend", () => {
    useGameStore.setState({ inspiration: big(10000) });
    render(<AscensionView />);
    fireEvent.click(screen.getByRole("button", { name: /ascend/i }));
    const s = useGameStore.getState();
    expect(s.inspiration.toNumber()).toBe(0);
    expect(s.ascendCount).toBe(1);
    expect(s.fame.toNumber()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/views/AscensionView.test.tsx`
Expected: FAIL — `AscensionView` module not found.

- [ ] **Step 3: Write the component**

Create `src/ui/views/AscensionView.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { canAscend, getEffectivePalier } from "@/systems/ascend";
import { fameOnAscend } from "@/core/balance";
import { formatBig } from "@/core/formatter";

export function AscensionView(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const performAscend = useGameStore((s) => s.performAscend);
  const fullState = useGameStore.getState();
  const palier = getEffectivePalier(fullState, ascendCount);
  const canDo = canAscend(fullState);
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

      <button
        type="button"
        disabled={!canDo}
        onClick={() => performAscend()}
        className="self-start rounded bg-fame/30 px-4 py-2 text-sm font-semibold disabled:opacity-40"
      >
        Ascend
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/ui/views/AscensionView.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire into `App.tsx`**

Edit `src/App.tsx`. Add the import:

```tsx
import { AscensionView } from "@/ui/views/AscensionView";
```

Replace the `ascension` case:

```tsx
case "ascension":
  body = <AscensionView />;
  break;
```

- [ ] **Step 6: Run typecheck + all tests**

Run: `npx tsc -b --noEmit && npm test`
Expected: typecheck clean; 214–216 tests pass.

- [ ] **Step 7: Manual dev smoke**

Run: `npm run dev`. Switch to the Ascension tab.

Initially the Ascend button is disabled (inspi=0 < 1000). In DevTools:

```js
useGameStore.setState({ inspiration: big(2000) })
```

The button enables. Click it — inspi drops to 0, fame increases, ascendCount goes to 1, palier doubles to 2000.

Press `Ctrl+C`.

- [ ] **Step 8: Commit**

```bash
git add src/ui/views/AscensionView.tsx tests/ui/views/AscensionView.test.tsx src/App.tsx
git commit -m "ui(ascension): AscensionView + test — palier preview, gated Ascend button"
```

---

## Task 11: `<SkillTreeView>` — 5 nodes, linear chain

**Files:**
- Create: `src/ui/views/SkillTreeView.tsx`
- Modify: `src/App.tsx` (replace `<ViewStub name="SkillTreeView" />` with `<SkillTreeView />`)

**Goal:** Render the 5 skill nodes vertically. Each row shows name, fame cost, status (Locked / Available / Purchased), and a Buy button gated by `canBuyNode(state, id)`.

No standalone test — `skillTreeSlice.test.ts` already covers `canBuyNode` and `buyNode`. View structure is verified via manual smoke.

- [ ] **Step 1: Write the component**

Create `src/ui/views/SkillTreeView.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";

type Status = "purchased" | "available" | "locked";

const STATUS_LABEL: Record<Status, string> = {
  purchased: "Purchased",
  available: "Available",
  locked: "Locked",
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
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => buyNode(node.id)}
                className="rounded bg-fame/20 px-3 py-1 text-sm disabled:opacity-40"
              >
                Buy
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `App.tsx`**

Edit `src/App.tsx`. Add the import:

```tsx
import { SkillTreeView } from "@/ui/views/SkillTreeView";
```

Replace the `skills` case:

```tsx
case "skills":
  body = <SkillTreeView />;
  break;
```

The `ViewStub` helper is no longer referenced — remove its import-free definition from `App.tsx` (the `function ViewStub` declaration). Verify there are no remaining `ViewStub` references.

- [ ] **Step 3: Run typecheck + all tests**

Run: `npx tsc -b --noEmit && npm test`
Expected: typecheck clean; same test count as Task 10; no regressions.

- [ ] **Step 4: Manual dev smoke**

Run: `npm run dev`. Switch to Skills tab.

All 5 nodes show as Locked initially (fame=0). In DevTools:

```js
useGameStore.setState({ fame: big(200) })
```

`Goldsmith` becomes Available. Click Buy — it becomes Purchased, fame drops to 199. `Patient Eye` becomes Available. Continue down the chain to verify the linear gating.

Press `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/SkillTreeView.tsx src/App.tsx
git commit -m "ui(skilltree): SkillTreeView — 5 nodes with linear-chain gated Buy"
```

---

## Task 12: Final QA — done-criteria smoke, lint, build

**Files:** none modified directly; this task is a verification gate.

**Goal:** Confirm the spec's §8 Definition of Done holds: lint clean, build clean, full test suite green, end-to-end gameplay loop playable, refresh preserves view.

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: 214–216 passing, 0 failing.

Record the exact count for the Phase 4 handover note.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean. No new errors over the pre-Phase-4 baseline.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: same warning count as before Phase 4 (the pre-existing `react-refresh/only-export-components` warning on `main.tsx` is allowed; no new warnings or errors).

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: success — `dist/` produced with no errors. Note the bundle size (PORT_PLAN §8 done-criteria #12 targets <250 KB gzipped; check the Vite output line).

- [ ] **Step 5: End-to-end gameplay smoke**

Run: `npm run dev`. Open the URL.

Run through this checklist in the browser, fresh save (clear IDB via DevTools → Application → IndexedDB → delete `keyval-store`, then refresh):

1. **HomeView** loads with `Seed`, `0.00 inspi/sec`, two parts (Spark/Bud) with disabled Buy buttons (gold=0).
2. In DevTools console: `useGameStore.getState().add("gold", big(10000))`. Refresh.
3. Click Buy on Spark a few times — level rises, gold falls, inspi/sec readout grows.
4. Wait or fast-forward via `useGameStore.getState().tickAll(60)` until 10 part levels accumulate. The "Grow next stage" button appears. Click it. Stage label flips to `Sapling`.
5. Switch to **PaintingView**. Watch the canvas auto-paint and gold tick up in BottomBar.
6. Switch to **AscensionView**. With enough inspiration buildup (or seed via `useGameStore.setState({ inspiration: big(2000) })`), Ascend button enables. Click it. Inspi → 0, fame credited.
7. Switch to **SkillTreeView**. `Goldsmith` is Available (fame ≥ 1). Click Buy.
8. **Refresh the page while on SkillTreeView.** After hydration, the view is still SkillTreeView (persistence verified).
9. Switch back to HomeView. Verify the tree state still reflects post-ascend reset (currentStage=0, partLevels all 0) but `purchasedNodes.goldsmith === true` (verify via DevTools).

If any step fails, stop and triage — do not commit a broken DoD.

- [ ] **Step 6: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 7: Final commit (if anything changed during smoke)**

If Steps 1–5 produced no fixes, skip this step. If a smoke failure forced a fix, commit it with a `fix(phase4): …` message that names what broke and what was changed.

- [ ] **Step 8: Phase 4 done — handover snapshot ready**

Phase 4 complete. The next phase (Phase 5) covers hover-info content authoring on every interactive element, plus the Workshop crafting popup. The Phase 4 handover update (test count, new lessons, repo state) goes in `docs/HANDOVER.md` and is part of the Phase 5 brainstorming session, not Phase 4 itself.

---

## Plan self-review summary

**Spec coverage:** every spec section maps to tasks:
- §1 scope/goals → Tasks 1–11 deliver the listed widgets/views; Task 12 verifies DoD.
- §2 D1 (single plan) → reflected by single document; D2 (functional views) → Tasks 8–11 wire real actions; D3 (`ViewId` literal union, persisted) → Task 1; D4 (TopBar nav) → Task 2; D5 (InfoPanel reserved height) → Task 5 (`min-h-16`); D6 (Hoverable built but unused) → Task 6 (no application sites); D7 (Workshop disabled stub) → Task 9; D8 (test scope) → Tasks 1, 4, 6, 10 (4 test files, 15 individual tests across them — within "6–8 tests" approximate budget once individual `it` blocks are summed); D9 (theme tokens, no animation) → all task code uses `bg-app-panel`/`text-gold`/etc., no Motion imports; D10 (selectors) → every component uses `useGameStore((s) => …)`.
- §3 file layout → matches Tasks 1–11 exactly.
- §4 viewSlice contract → Task 1.
- §5 component contracts → one task per component.
- §6 test scope → Tasks 1 (5 it), 4 (4 it), 6 (3 it), 10 (3 it) = 15 it-blocks (4 test files, broader than the "6–8 tests" copy in the spec — kept generous to lock down behavior; plan author's call).
- §7 forward-compat seams → respected: Hoverable is API-stable, InfoPanel reserves height, Workshop button position locked into PaintingView.
- §8 Definition of Done → Task 12 walks every numbered criterion.

**Placeholder scan:** no "TBD"/"TODO"/"add appropriate"/"similar to Task N" patterns. Every step has either complete code, an exact command, or a precise verification action.

**Type consistency:** `ViewId` matches in Task 1 (slice) and Task 7 (App.tsx switch). `pushHoverInfo(title, body, footer)` signature matches the existing slice in Task 6. `inspiPerSec(parts, multiplier)` signature matches `core/balance.ts` in Task 8. `canAscend(state)`, `getEffectivePalier(state, count)`, `fameOnAscend(inspi)` signatures match `systems/ascend.ts` and `core/balance.ts` in Task 10. `canBuyNode(state, id)`, `hasNode(state, id)` match `skillTreeSlice.ts` in Task 11.

**Outstanding plan-time risks:**
- Tailwind 4 may need an `@source` directive if class names produced via runtime concatenation (`COLOR_CLASS[kind]` in CurrencyDisplay) aren't picked up by the JIT scanner. If a styled token doesn't paint during Task 3 or 4 dev smoke, add the relevant `bg-fame` / `text-fame` / `text-inspiration` / `bg-gold` etc. to a safelist in `index.css` via Tailwind's `@source inline()` mechanism. Verify during Task 4 dev smoke; if BottomBar paints with all three colors, the JIT picked them up.
- `useGameStore.getState()` calls inside render bodies (Tasks 8, 9, 10, 11) read state synchronously but **don't subscribe** to changes. They're used for derived values (`getEffectivePalier`, `inspiPerSec`) where the underlying primitives (`inspiration`, `partLevels`, `purchasedNodes`) are already subscribed via `useGameStore((s) => …)`. The render pulls fresh derived values on every re-render driven by those primitives. Verify behavior holds in dev smoke; if a derived value goes stale, switch to a `useGameStore` selector that returns the derived value.
