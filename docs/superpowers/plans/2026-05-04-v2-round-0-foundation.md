# v2.0 Round 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundation for the v2.0 visual redesign — branch off main, swap Tailwind 4 for `tokens.css` + CSS Modules, add `react-router-dom` + `lucide-react`, build the new persistent shell (TopBar / BottomBar / InfoPanel / MetaChip / 4 currency chips with dim-when-irrelevant), wire up router with placeholder routes that render existing v1.1 view content, retire `viewSlice`, migrate save schema v5 → v6.

**Architecture:** 5 phases. Phase A sets up tokens/fonts/deps. Phase B builds the new shell components in isolation (no router yet, tested with mock state). Phase C wires router + shell + moves existing views to `src/routes/`. Phase D drops Tailwind, strips utility classes from existing widgets. Phase E retires `viewSlice` + adds save migration. Each phase is independently committable; subsequent phases depend on prior ones.

**Tech Stack:** React 19 + TypeScript strict + Vite + Vitest + Zustand 5 (existing). Drops Tailwind 4. Adds react-router-dom 7.x + lucide-react. Replaces utility classes with CSS Modules + `tokens.css` design tokens. Persistence stays on IndexedDB via `idb-keyval`. Big numbers via `break_eternity.js`.

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Setup: branch, tokens, fonts, deps | 1, 2 |
| **B** | New shell components (built in isolation) | 3, 4, 5, 6 |
| **C** | Router + view moves | 7, 8 |
| **D** | Drop Tailwind + strip remaining widgets | 9, 10 |
| **E** | Retire viewSlice + migration v5→v6 + final verify | 11, 12, 13 |

Each task: TDD cycle (test → fail → impl → pass → commit). Subagents execute one per dispatch with two-stage review between.

---

## Pre-flight checks (do once before Task 1)

- [ ] On `main`, working tree clean (only `.claude/` untracked).
- [ ] HEAD is at `a0bb088` or descendant (post-handoff commit).
- [ ] Baseline tests pass: `npm test` reports 362/362.
- [ ] Typecheck clean: `npx tsc -b --noEmit`.

---

# Phase A — Setup

---

### Task 1: Branch + add design tokens + fonts

Establish the branch and bring the handoff's design tokens + Google Fonts into the project. Tokens are loaded but Tailwind is still active in this task — full removal happens in Phase D.

**Files:**
- Create: `src/styles/tokens.css` (copy from `design_handoff_artdle/tokens.css` + add PM token block)
- Create: `src/styles/globals.css` (font loading via `@import` + base reset + body defaults)
- Modify: `index.html` (add Google Fonts `<link>`)
- Modify: `src/main.tsx` (import `globals.css` first, before existing `index.css`)

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/v2-redesign
git status
```

Expected: on branch `feat/v2-redesign`, working tree clean.

- [ ] **Step 2: Copy tokens.css and add PM tokens**

Create `src/styles/tokens.css` by copying `design_handoff_artdle/tokens.css` verbatim, then append the PM block before the closing `}` of `:root`:

```css
  /* ---------- PM (Paint Mastery) — v2.0 addition ---------- */
  --pm:        #7adcd6;
  --pm-d:      #4ca8a3;
  --pm-glow:   0 0 14px rgba(122,220,214,0.55);
```

Place the additions logically alongside the other currency tokens (`--gold`, `--inspi`, `--fame`).

- [ ] **Step 3: Create globals.css**

Create `src/styles/globals.css`:

```css
@import "./tokens.css";

* {
  box-sizing: border-box;
}

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
}

body {
  background: var(--bg-0);
  color: var(--ink-0);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button {
  font-family: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
}
```

- [ ] **Step 4: Add Google Fonts to index.html**

In `index.html`, inside `<head>`, add the font link **before** any existing stylesheet links:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&family=JetBrains+Mono:wght@400;600&family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 5: Wire globals.css into main.tsx**

Update `src/main.tsx`. Find the existing `import "./index.css";` line and add `import "./styles/globals.css";` BEFORE it (so globals load first, Tailwind layers on top, doesn't override globals during this transitional period).

- [ ] **Step 6: Verify build still works**

Run: `npm run dev` (briefly — kill once it serves) OR `npm run build`.
Expected: build succeeds. App still loads identically to v1.1 (Tailwind classes still active; tokens loaded but not yet used).

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: 362/362 passing (no test changes yet).

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/styles/tokens.css src/styles/globals.css index.html src/main.tsx
git commit -m "v2(setup): add tokens.css + globals.css + Google Fonts

Branch foundation. Brings the handoff's design tokens (CSS custom
properties) into src/styles/ + adds Google Fonts <link> for Cinzel,
JetBrains Mono, Inter, Press Start 2P, VT323. Adds PM teal token
(#7adcd6) alongside gold/inspi/fame. Tailwind still active —
full removal in Phase D."
```

---

### Task 2: Install react-router-dom and lucide-react

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install react-router-dom@7 lucide-react
```

Expected: both add to `dependencies` in `package.json`.

- [ ] **Step 2: Verify versions installed**

```bash
npm list react-router-dom lucide-react --depth=0
```

Expected: both shown with installed versions (e.g., `react-router-dom@7.x.x`, `lucide-react@0.4xx.x`).

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 362/362 still passing (no behavior change).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "v2(setup): add react-router-dom@7 + lucide-react

Round 0 brings router-based navigation per the v2.0 IA (4 routes)
and a tree-shakeable icon library to replace the mock's emoji
placeholders."
```

---

# Phase B — New shell components (built in isolation)

Build each shell component standalone with its own CSS module + tests. They aren't wired into the live app yet — that happens in Phase C. This lets each component land in a clean commit with focused tests.

---

### Task 3: `<CurrencyChip>` — the BottomBar building block

A single currency chip: icon + label + value + per-second rate (gold/inspi only). Supports a `dimmed: boolean` prop for the dim-when-irrelevant state (28% opacity + 0.4 saturation per handoff §IA).

**Files:**
- Create: `src/components/shell/CurrencyChip.tsx`
- Create: `src/components/shell/CurrencyChip.module.css`
- Create: `tests/components/shell/CurrencyChip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/shell/CurrencyChip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyChip } from "@/components/shell/CurrencyChip";

describe("<CurrencyChip />", () => {
  it("renders label and value", () => {
    render(<CurrencyChip kind="gold" label="Gold" value="1.23K" />);
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("1.23K")).toBeInTheDocument();
  });

  it("renders per-second rate when provided", () => {
    render(<CurrencyChip kind="inspi" label="Inspi" value="847" rate="+3.2/s" />);
    expect(screen.getByText("+3.2/s")).toBeInTheDocument();
  });

  it("does not render rate when omitted (e.g., fame, PM)", () => {
    render(<CurrencyChip kind="fame" label="Fame" value="12" />);
    expect(screen.queryByText(/\/s$/)).not.toBeInTheDocument();
  });

  it("applies dimmed attribute when dimmed=true", () => {
    render(<CurrencyChip kind="gold" label="Gold" value="0" dimmed />);
    expect(screen.getByTestId("currency-chip-gold")).toHaveAttribute("data-dimmed", "true");
  });

  it("does NOT apply dimmed attribute when dimmed=false", () => {
    render(<CurrencyChip kind="gold" label="Gold" value="0" />);
    expect(screen.getByTestId("currency-chip-gold")).not.toHaveAttribute("data-dimmed", "true");
  });

  it("supports the four currencies (gold, inspi, fame, pm) without crashing", () => {
    const kinds = ["gold", "inspi", "fame", "pm"] as const;
    for (const kind of kinds) {
      const { unmount } = render(<CurrencyChip kind={kind} label="X" value="0" />);
      expect(screen.getByTestId(`currency-chip-${kind}`)).toBeInTheDocument();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- CurrencyChip`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/shell/CurrencyChip.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./CurrencyChip.module.css";

export type CurrencyKind = "gold" | "inspi" | "fame" | "pm";

interface Props {
  kind: CurrencyKind;
  label: string;
  value: string;
  rate?: string;
  dimmed?: boolean;
}

/**
 * Single currency chip: pixel icon + Cinzel label + mono value (+ optional rate).
 *
 * The `dimmed` prop signals "irrelevant for current route" — chip stays visible
 * but at 28% opacity + 0.4 saturation per handoff §IA. Container components
 * (e.g., BottomBar) compute dimmed-ness from the active route.
 */
export function CurrencyChip({ kind, label, value, rate, dimmed }: Props): JSX.Element {
  return (
    <div
      className={styles.chip}
      data-testid={`currency-chip-${kind}`}
      data-kind={kind}
      data-dimmed={dimmed ? "true" : undefined}
    >
      <span className={styles.icon} data-icon={kind} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {rate && <span className={styles.rate}>{rate}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/shell/CurrencyChip.module.css`:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-2) var(--s-3);
  border: var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--bg-1);
  transition: opacity 200ms ease, filter 200ms ease;
}

.chip[data-dimmed="true"] {
  opacity: 0.28;
  filter: saturate(0.4);
}

.icon {
  width: 14px;
  height: 14px;
  flex: none;
  display: inline-block;
}

.icon[data-icon="gold"] {
  background: var(--gold);
  border-radius: 50%;
  box-shadow: var(--gold-glow), inset 0 -2px 0 var(--gold-d);
}

.icon[data-icon="inspi"] {
  background: var(--inspi);
  clip-path: polygon(50% 0%, 60% 35%, 100% 50%, 60% 65%, 50% 100%, 40% 65%, 0% 50%, 40% 35%);
  box-shadow: var(--inspi-glow);
}

.icon[data-icon="fame"] {
  background: var(--fame);
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  box-shadow: var(--fame-glow);
}

.icon[data-icon="pm"] {
  background: var(--pm);
  border-radius: 2px;
  box-shadow: var(--pm-glow);
  /* Placeholder pixel-paintbrush look; real sprite in a polish round. */
}

.label {
  font-family: var(--serif);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.value {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-0);
}

.rate {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}

/* Per-currency value tints */
.chip[data-kind="gold"] .value { color: var(--gold); }
.chip[data-kind="inspi"] .value { color: var(--inspi); }
.chip[data-kind="fame"] .value { color: var(--fame); }
.chip[data-kind="pm"] .value { color: var(--pm); }
```

- [ ] **Step 5: Run tests**

Run: `npm test -- CurrencyChip`
Expected: 6 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 362 + 6 = 368 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/CurrencyChip.tsx src/components/shell/CurrencyChip.module.css tests/components/shell/CurrencyChip.test.tsx
git commit -m "v2(shell): add <CurrencyChip> component

The atom of the new BottomBar. Renders icon (CSS pixel-art per kind) +
Cinzel uppercase label + mono value + optional per-second rate. Supports
dim-when-irrelevant via 'dimmed' prop. 6 RTL tests."
```

---

### Task 4: `<BottomBar>` — uses CurrencyChip + dim-from-route logic

The new BottomBar renders 4 chips with route-based dim logic. Pulls live currency values from the store. The InfoPanel slot is wired via a children prop (InfoPanel itself comes in Task 6).

**Files:**
- Create: `src/components/shell/BottomBar.tsx`
- Create: `src/components/shell/BottomBar.module.css`
- Create: `tests/components/shell/BottomBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/shell/BottomBar.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomBar } from "@/components/shell/BottomBar";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomBar />
    </MemoryRouter>,
  );
}

describe("<BottomBar /> — currency rendering", () => {
  beforeEach(() => {
    useGameStore.setState({
      gold: big(1234),
      inspiration: big(56),
      fame: big(7),
    });
    useGameStore.getState()._setPaintMastery(big(42));
  });

  it("renders all 4 currency chips", () => {
    renderAt("/tree");
    expect(screen.getByTestId("currency-chip-gold")).toBeInTheDocument();
    expect(screen.getByTestId("currency-chip-inspi")).toBeInTheDocument();
    expect(screen.getByTestId("currency-chip-fame")).toBeInTheDocument();
    expect(screen.getByTestId("currency-chip-pm")).toBeInTheDocument();
  });

  it("formats gold via formatBig (1234 -> '1.23K')", () => {
    renderAt("/tree");
    expect(screen.getByTestId("currency-chip-gold")).toHaveTextContent("1.23K");
  });
});

describe("<BottomBar /> — dim-when-irrelevant per route", () => {
  beforeEach(() => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(0) });
    useGameStore.getState()._setPaintMastery(big(0));
  });

  it("on /tree: gold + inspi prominent; fame + pm dim", () => {
    renderAt("/tree");
    expect(screen.getByTestId("currency-chip-gold")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-inspi")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-fame")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).toHaveAttribute("data-dimmed", "true");
  });

  it("on /painting: gold + pm prominent; inspi + fame dim", () => {
    renderAt("/painting");
    expect(screen.getByTestId("currency-chip-gold")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-inspi")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-fame")).toHaveAttribute("data-dimmed", "true");
  });

  it("on /ascension: inspi + fame prominent; gold + pm dim", () => {
    renderAt("/ascension");
    expect(screen.getByTestId("currency-chip-inspi")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-fame")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-gold")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).toHaveAttribute("data-dimmed", "true");
  });

  it("on /constellation: fame prominent; others dim", () => {
    renderAt("/constellation");
    expect(screen.getByTestId("currency-chip-fame")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-gold")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-inspi")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("currency-chip-pm")).toHaveAttribute("data-dimmed", "true");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/shell/BottomBar"`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/shell/BottomBar.tsx`:

```tsx
import type { JSX } from "react";
import { useLocation } from "react-router-dom";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";
import { CurrencyChip, type CurrencyKind } from "./CurrencyChip";
import styles from "./BottomBar.module.css";

/**
 * Per-route prominence map.
 * - /tree: gold + inspi (the gold→tree→inspi loop)
 * - /painting: gold + PM (the canvas earns gold and PM)
 * - /ascension: inspi + fame (inspi converts to fame at the threshold)
 * - /constellation: fame (the only spend currency on this route)
 *
 * Currencies not in the prominent set dim per handoff §IA: 28% opacity,
 * 0.4 saturation. Dim transitions take 200ms ease.
 */
const ROUTE_PROMINENCE: Record<string, ReadonlySet<CurrencyKind>> = {
  "/tree":          new Set(["gold", "inspi"]),
  "/painting":      new Set(["gold", "pm"]),
  "/ascension":     new Set(["inspi", "fame"]),
  "/constellation": new Set(["fame"]),
};

const DEFAULT_PROMINENT: ReadonlySet<CurrencyKind> = new Set(["gold", "inspi"]);

function isProminent(kind: CurrencyKind, pathname: string): boolean {
  const set = ROUTE_PROMINENCE[pathname] ?? DEFAULT_PROMINENT;
  return set.has(kind);
}

export function BottomBar(): JSX.Element {
  const gold = useGameStore((s) => s.gold);
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const paintMastery = useGameStore((s) => s.paintMastery);
  const { pathname } = useLocation();

  return (
    <footer className={styles.bar}>
      <div className={styles.chips}>
        <CurrencyChip
          kind="gold"
          label="Gold"
          value={formatBig(gold)}
          dimmed={!isProminent("gold", pathname)}
        />
        <CurrencyChip
          kind="inspi"
          label="Inspi"
          value={formatBig(inspiration)}
          dimmed={!isProminent("inspi", pathname)}
        />
        <CurrencyChip
          kind="fame"
          label="Fame"
          value={formatBig(fame)}
          dimmed={!isProminent("fame", pathname)}
        />
        <CurrencyChip
          kind="pm"
          label="PM"
          value={formatBig(paintMastery)}
          dimmed={!isProminent("pm", pathname)}
        />
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/shell/BottomBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--s-5);
  padding: var(--s-3) var(--s-5);
  border-top: var(--border-subtle);
  background: var(--bg-1);
  box-shadow: var(--shadow-card);
}

.chips {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/shell/BottomBar"`
Expected: 6 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 368 + 6 = 374 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/BottomBar.tsx src/components/shell/BottomBar.module.css tests/components/shell/BottomBar.test.tsx
git commit -m "v2(shell): add new <BottomBar> with 4 chips + route dim logic

Renders gold/inspi/fame/PM chips. Dim-when-irrelevant logic derived
from useLocation() per the prominence table from handoff §IA. Lives
alongside the legacy ui/widgets/BottomBar.tsx for now; the swap
happens in Phase C when we wire the new shell into App."
```

---

### Task 5: `<TopBar>` — brand + nav + meta info

Brand wordmark on the left ("ARTDLE", Cinzel 700 22px, leading "A" tinted fame-gold), nav items in the middle (4 routes, Cinzel uppercase 13px), meta autosave + settings on the right.

**Files:**
- Create: `src/components/shell/TopBar.tsx`
- Create: `src/components/shell/TopBar.module.css`
- Create: `tests/components/shell/TopBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/shell/TopBar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopBar } from "@/components/shell/TopBar";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar />
    </MemoryRouter>,
  );
}

describe("<TopBar />", () => {
  it("renders the ARTDLE brand wordmark", () => {
    renderAt("/tree");
    expect(screen.getByText(/ARTDLE/i)).toBeInTheDocument();
  });

  it("renders all 4 nav items", () => {
    renderAt("/tree");
    expect(screen.getByRole("link", { name: /tree/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /painting/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ascension/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /constellation/i })).toBeInTheDocument();
  });

  it("marks the active nav item per current route (aria-current)", () => {
    renderAt("/painting");
    expect(screen.getByRole("link", { name: /painting/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /tree/i })).not.toHaveAttribute("aria-current", "page");
  });

  it("active route has a flourish marker (✦) visually", () => {
    renderAt("/ascension");
    const activeLink = screen.getByRole("link", { name: /ascension/i });
    // Flourishes rendered as decorative spans; assert via data attribute on parent.
    expect(activeLink).toHaveAttribute("data-active", "true");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/shell/TopBar"`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`src/components/shell/TopBar.tsx`:

```tsx
import type { JSX } from "react";
import { NavLink } from "react-router-dom";
import styles from "./TopBar.module.css";

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/tree",          label: "Tree" },
  { to: "/painting",      label: "Painting" },
  { to: "/ascension",     label: "Ascension" },
  { to: "/constellation", label: "Constellation" },
];

export function TopBar(): JSX.Element {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.brandA}>A</span>
        <span>RTDLE</span>
      </div>
      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
            }
            data-active={({ isActive }: { isActive: boolean }) => (isActive ? "true" : undefined)}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className={styles.flourish} aria-hidden="true">✦</span>}
                <span>{label}</span>
                {isActive && <span className={styles.flourish} aria-hidden="true">✦</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className={styles.meta} aria-label="Autosave status">
        <span>Saved</span>
      </div>
    </header>
  );
}
```

Wait — `NavLink`'s `className` prop accepts a function but `data-active` doesn't. Refine:

```tsx
import type { JSX } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "./TopBar.module.css";

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/tree",          label: "Tree" },
  { to: "/painting",      label: "Painting" },
  { to: "/ascension",     label: "Ascension" },
  { to: "/constellation", label: "Constellation" },
];

export function TopBar(): JSX.Element {
  const { pathname } = useLocation();
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.brandA}>A</span>
        <span>RTDLE</span>
      </div>
      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map(({ to, label }) => {
          const isActive = pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              end
              className={isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
              data-active={isActive ? "true" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && <span className={styles.flourish} aria-hidden="true">✦</span>}
              <span>{label}</span>
              {isActive && <span className={styles.flourish} aria-hidden="true">✦</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className={styles.meta} aria-label="Autosave status">
        <span>Saved</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/shell/TopBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-5);
  padding: var(--s-3) var(--s-6);
  border-bottom: var(--border-subtle);
  background: var(--bg-1);
  height: 52px;
}

.brand {
  font-family: var(--serif);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 0.04em;
  color: var(--ink-0);
  user-select: none;
}

.brandA {
  color: var(--fame);
  text-shadow: var(--fame-glow);
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--s-6);
}

.navItem {
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--ink-2);
  text-decoration: none;
  padding: var(--s-2) var(--s-3);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  transition: color 140ms ease, border-color 140ms ease;
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
}

.navItem:hover {
  color: var(--ink-0);
}

.navItemActive {
  color: var(--fame);
  border-color: var(--fame-d);
}

.flourish {
  color: var(--fame);
  text-shadow: var(--fame-glow);
  font-size: 11px;
}

.meta {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/shell/TopBar"`
Expected: 4 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 374 + 4 = 378 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/TopBar.tsx src/components/shell/TopBar.module.css tests/components/shell/TopBar.test.tsx
git commit -m "v2(shell): add new <TopBar> with brand + nav + meta

Brand wordmark with fame-tinted leading 'A'. Four NavLinks (Tree,
Painting, Ascension, Constellation) wired to react-router. Active
item gets fame border + ✦ flourish flanks. Lives alongside legacy
ui/widgets/TopBar.tsx for now; swap in Phase C."
```

---

### Task 6: `<InfoPanel>` (new) + `<MetaChip>`

The new InfoPanel reads from `hoverInfoSlice` (existing — no changes there) and renders `Title` (Cinzel) + `Body` (mono) + optional `Footer` (mono) per handoff §IA. The MetaChip shows the version label.

**Files:**
- Create: `src/components/shell/InfoPanel.tsx`
- Create: `src/components/shell/InfoPanel.module.css`
- Create: `src/components/shell/MetaChip.tsx`
- Create: `src/components/shell/MetaChip.module.css`
- Create: `tests/components/shell/InfoPanel.test.tsx`
- Create: `tests/components/shell/MetaChip.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/shell/InfoPanel.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoPanel } from "@/components/shell/InfoPanel";
import { useGameStore } from "@/store";

describe("<InfoPanel /> (new shell)", () => {
  beforeEach(() => {
    useGameStore.getState().clearHoverInfo();
  });

  it("renders nothing visible when no hover state", () => {
    render(<InfoPanel />);
    // Empty placeholder div; no title or body.
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders title + body when hover is pushed", () => {
    useGameStore.getState().pushHoverInfo("Roots", "Lv 4 · +0.6 inspi/s", "Cost 480g");
    render(<InfoPanel />);
    expect(screen.getByText("Roots")).toBeInTheDocument();
    expect(screen.getByText("Lv 4 · +0.6 inspi/s")).toBeInTheDocument();
    expect(screen.getByText("Cost 480g")).toBeInTheDocument();
  });

  it("clears when clearHoverInfo is called", () => {
    useGameStore.getState().pushHoverInfo("Foo", "Bar");
    const { rerender } = render(<InfoPanel />);
    expect(screen.getByText("Foo")).toBeInTheDocument();
    useGameStore.getState().clearHoverInfo();
    rerender(<InfoPanel />);
    expect(screen.queryByText("Foo")).not.toBeInTheDocument();
  });
});
```

```tsx
// tests/components/shell/MetaChip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetaChip } from "@/components/shell/MetaChip";

describe("<MetaChip />", () => {
  it("renders a version label", () => {
    render(<MetaChip />);
    expect(screen.getByText(/v2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/shell/(InfoPanel|MetaChip)"`
Expected: FAIL.

- [ ] **Step 3: Create InfoPanel**

`src/components/shell/InfoPanel.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import styles from "./InfoPanel.module.css";

/**
 * Info strip rendered between PaintingView/etc. and the BottomBar.
 * Pulls live hover-info state from `hoverInfoSlice` (existing). Title in
 * Cinzel, body and footer in mono. When no hover is active, renders a
 * placeholder div so layout doesn't shift (handoff §IA: fixed-height strip).
 */
export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);

  // Body and footer can be functions for live values (Phase 5 lesson).
  const bodyText = typeof body === "function" ? body() : body;
  const footerText = typeof footer === "function" ? footer() : footer;

  return (
    <aside className={styles.panel} role="complementary">
      {title && <div className={styles.title}>{title}</div>}
      {bodyText && <div className={styles.body}>{bodyText}</div>}
      {footerText && <div className={styles.footer}>{footerText}</div>}
    </aside>
  );
}
```

`src/components/shell/InfoPanel.module.css`:

```css
.panel {
  height: 64px;
  padding: var(--s-2) var(--s-5);
  border-top: var(--border-subtle);
  background: var(--bg-2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--s-1);
}

.title {
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink-0);
}

.body {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-2);
  white-space: pre-line;
}

.footer {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}
```

- [ ] **Step 4: Create MetaChip**

`src/components/shell/MetaChip.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./MetaChip.module.css";

const VERSION = "v2.0-dev";

export function MetaChip(): JSX.Element {
  return (
    <div className={styles.chip} aria-label="App version">
      <span>{VERSION}</span>
    </div>
  );
}
```

`src/components/shell/MetaChip.module.css`:

```css
.chip {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
  padding: var(--s-1) var(--s-2);
  border: var(--border-subtle);
  border-radius: var(--r-sm);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/shell/(InfoPanel|MetaChip)"`
Expected: 4 passing (3 InfoPanel + 1 MetaChip).

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 378 + 4 = 382 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/InfoPanel.tsx src/components/shell/InfoPanel.module.css src/components/shell/MetaChip.tsx src/components/shell/MetaChip.module.css tests/components/shell/InfoPanel.test.tsx tests/components/shell/MetaChip.test.tsx
git commit -m "v2(shell): add new <InfoPanel> + <MetaChip>

InfoPanel reads from hoverInfoSlice (unchanged). Renders title (Cinzel) +
body + optional footer (mono). Fixed 64px height per handoff §IA.
MetaChip shows version label. Both live alongside legacy widgets for now."
```

---

# Phase C — Router + view moves

---

### Task 7: Wire React Router into main.tsx + App.tsx with placeholder routes

Set up `<BrowserRouter>` in `main.tsx`. Replace `App.tsx`'s `currentView` switcher with `<Routes>` + `<Route>` per path. Each route's component is a thin placeholder that renders the legacy view (HomeView, PaintingView, etc.) — full move happens in Task 8.

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/routes/TreeRoute.tsx`
- Create: `src/routes/PaintingRoute.tsx`
- Create: `src/routes/AscensionRoute.tsx`
- Create: `src/routes/ConstellationRoute.tsx`
- Create: `tests/App.test.tsx` (router smoke tests)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/App.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { TreeRoute } from "@/routes/TreeRoute";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { ConstellationRoute } from "@/routes/ConstellationRoute";

function renderRoutesAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tree" element={<TreeRoute />} />
        <Route path="/painting" element={<PaintingRoute />} />
        <Route path="/ascension" element={<AscensionRoute />} />
        <Route path="/constellation" element={<ConstellationRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Routes (smoke tests)", () => {
  it("/tree renders without crashing", () => {
    expect(() => renderRoutesAt("/tree")).not.toThrow();
  });

  it("/painting renders without crashing", () => {
    expect(() => renderRoutesAt("/painting")).not.toThrow();
  });

  it("/ascension renders without crashing", () => {
    expect(() => renderRoutesAt("/ascension")).not.toThrow();
  });

  it("/constellation renders without crashing", () => {
    expect(() => renderRoutesAt("/constellation")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- App`
Expected: FAIL — route modules don't exist.

- [ ] **Step 3: Create the placeholder route components**

`src/routes/TreeRoute.tsx`:

```tsx
import type { JSX } from "react";
import { HomeView } from "@/ui/views/HomeView";

export function TreeRoute(): JSX.Element {
  return <HomeView />;
}
```

`src/routes/PaintingRoute.tsx`:

```tsx
import type { JSX } from "react";
import { PaintingView } from "@/ui/views/PaintingView";

export function PaintingRoute(): JSX.Element {
  return <PaintingView />;
}
```

`src/routes/AscensionRoute.tsx`:

```tsx
import type { JSX } from "react";
import { AscensionView } from "@/ui/views/AscensionView";

export function AscensionRoute(): JSX.Element {
  return <AscensionView />;
}
```

`src/routes/ConstellationRoute.tsx`:

```tsx
import type { JSX } from "react";
import { SkillTreeView } from "@/ui/views/SkillTreeView";

export function ConstellationRoute(): JSX.Element {
  return <SkillTreeView />;
}
```

- [ ] **Step 4: Update App.tsx to use the new shell + Routes**

Replace `src/App.tsx` entirely:

```tsx
import type { JSX } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { TopBar } from "@/components/shell/TopBar";
import { BottomBar } from "@/components/shell/BottomBar";
import { InfoPanel } from "@/components/shell/InfoPanel";
import { TreeRoute } from "@/routes/TreeRoute";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { ConstellationRoute } from "@/routes/ConstellationRoute";
import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";
import styles from "./App.module.css";

export function App(): JSX.Element {
  return (
    <div className={styles.app}>
      <TopBar />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/tree" replace />} />
          <Route path="/tree" element={<TreeRoute />} />
          <Route path="/painting" element={<PaintingRoute />} />
          <Route path="/ascension" element={<AscensionRoute />} />
          <Route path="/constellation" element={<ConstellationRoute />} />
          <Route path="*" element={<Navigate to="/tree" replace />} />
        </Routes>
        <WorkshopPopup />
      </main>
      <InfoPanel />
      <BottomBar />
    </div>
  );
}
```

- [ ] **Step 5: Create App.module.css**

`src/App.module.css`:

```css
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-0);
  color: var(--ink-0);
}

.main {
  position: relative;
  flex: 1;
  overflow: auto;
}
```

- [ ] **Step 6: Wrap App in BrowserRouter in main.tsx**

In `src/main.tsx`, find the existing `<App />` render and wrap with `<BrowserRouter>`. Add the import:

```tsx
import { BrowserRouter } from "react-router-dom";
```

Update the JSX (the existing render block) to:

```tsx
<BrowserRouter>
  <App />
</BrowserRouter>
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: 382 + 4 = 386 passing. Some legacy tests for the OLD `<App />` (if any reference `useGameStore.getState().setView()`) will break — fix or remove. The `currentView`-based tests in `viewSlice.test.ts` will still pass (slice still exists, just unused by App).

If any test fails because it relied on view-switcher behavior now replaced by routing, update it to use `MemoryRouter` from react-router-dom OR remove the test if it's fully redundant with new route smoke tests.

- [ ] **Step 8: Smoke check via dev server**

```bash
npm run dev
```

Open http://localhost:5173 and verify:
- Browser redirects to `/tree` (default route)
- TopBar shows brand + 4 nav links
- Clicking each nav link changes URL + view
- BottomBar shows 4 chips with route-based dimming
- InfoPanel renders empty (until you hover something)

Stop the dev server.

- [ ] **Step 9: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/main.tsx src/App.tsx src/App.module.css src/routes/ tests/App.test.tsx
git commit -m "v2(router): wire React Router + new shell into App

main.tsx wraps in <BrowserRouter>. App.tsx replaces currentView switcher
with <Routes> mounting 4 placeholder route components that delegate to
the legacy ui/views/* components for now. Full visual rebuild of each
route happens in subsequent rounds (1: Tree, 2: Painting, 3: Ascension,
4: Constellation). Default redirect / → /tree."
```

---

### Task 8: Move existing views to `src/routes/` (and inline their content)

The placeholder route wrappers from Task 7 are stub indirection. Move the existing view content into the route files so each route owns its content directly.

**Files:**
- Modify: `src/routes/TreeRoute.tsx` (inline HomeView's content)
- Modify: `src/routes/PaintingRoute.tsx` (inline PaintingView's content)
- Modify: `src/routes/AscensionRoute.tsx` (inline AscensionView's content)
- Modify: `src/routes/ConstellationRoute.tsx` (inline SkillTreeView's content)
- Delete: `src/ui/views/HomeView.tsx`
- Delete: `src/ui/views/PaintingView.tsx`
- Delete: `src/ui/views/AscensionView.tsx`
- Delete: `src/ui/views/SkillTreeView.tsx`
- Modify: any tests that imported the deleted view modules

- [ ] **Step 1: Move HomeView content into TreeRoute**

Open `src/ui/views/HomeView.tsx`. Copy the entire body of `function HomeView(): JSX.Element { ... }`. Open `src/routes/TreeRoute.tsx`. Replace the placeholder content with the full HomeView body (preserving all imports — adjust paths if needed since we're at a different folder depth).

The result:

```tsx
// src/routes/TreeRoute.tsx — content from old HomeView
import type { JSX } from "react";
// ... all the imports from HomeView, paths adjusted from "@/" still work

export function TreeRoute(): JSX.Element {
  // ...exactly what HomeView returned
}
```

Do not change behavior — Tailwind classes on internal divs are preserved (they get stripped in Phase D).

- [ ] **Step 2: Repeat for PaintingView → PaintingRoute**

Same procedure. Note: `PaintingView.tsx` references `<TierUpgradeButton>` and `<FloatingGoldText>` from `@/ui/widgets/`. Those imports are preserved.

- [ ] **Step 3: Repeat for AscensionView → AscensionRoute**

Same procedure.

- [ ] **Step 4: Repeat for SkillTreeView → ConstellationRoute**

Same procedure.

- [ ] **Step 5: Delete the old view files**

```bash
rm src/ui/views/HomeView.tsx
rm src/ui/views/PaintingView.tsx
rm src/ui/views/AscensionView.tsx
rm src/ui/views/SkillTreeView.tsx
```

If `src/ui/views/` becomes empty, also remove the directory:

```bash
rmdir src/ui/views/
```

- [ ] **Step 6: Update test files that imported the old views**

Run `grep -r "ui/views" tests/` to find any test imports. Likely candidate: `tests/ui/views/AscensionView.test.tsx`. Update its import path:

```tsx
import { AscensionRoute } from "@/routes/AscensionRoute";
```

If the test asserts behavior of `AscensionView`, the assertions should still hold for `AscensionRoute` (same content). Rename the test file's describe block from "AscensionView" to "AscensionRoute" for clarity.

For `tests/ui/views/AscensionView.test.tsx` specifically:

```bash
git mv tests/ui/views/AscensionView.test.tsx tests/routes/AscensionRoute.test.tsx
```

Then update its imports + describe block.

If `tests/ui/views/` is now empty, remove it.

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: 386 still passing (4 deleted view files have their content + tests under new names; net no change).

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/routes/ tests/
git rm -r src/ui/views/ tests/ui/views/ 2>/dev/null || true
git commit -m "v2(router): move legacy views to src/routes/

HomeView → TreeRoute, PaintingView → PaintingRoute, AscensionView →
AscensionRoute, SkillTreeView → ConstellationRoute. Content preserved
verbatim (Tailwind classes still in place — stripped in Phase D).
Tests moved to tests/routes/ with rename."
```

---

# Phase D — Drop Tailwind + strip remaining widgets

---

### Task 9: Uninstall Tailwind + remove from build config

Once Tailwind is gone, classes like `flex`, `bg-app-panel`, `text-fame` resolve to nothing. The app will look broken until classes are stripped. We do uninstall + immediate strip-all in this single task to keep working state coherent.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Modify: every .tsx file in `src/components/`, `src/routes/`, `src/ui/widgets/`, `src/ui/popups/` that uses Tailwind classes

- [ ] **Step 1: Uninstall Tailwind packages**

```bash
npm uninstall tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Update vite.config.ts**

Remove the tailwind import + plugin:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 3: Replace src/index.css**

Replace the entire content of `src/index.css` with the keyframe animations only (the `@theme` block is replaced by `tokens.css` already loaded via `globals.css`):

```css
@keyframes fame-pulse {
  0%   { transform: scale(1);    color: var(--fame); }
  40%  { transform: scale(1.15); color: var(--gold); }
  100% { transform: scale(1);    color: var(--fame); }
}

.fame-pulse-anim {
  animation: fame-pulse 500ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .fame-pulse-anim {
    animation: none;
  }
}
```

(The `--color-app-bg` etc. tokens were used by Tailwind's `@theme`; the new tokens use `--bg-0` etc. from `tokens.css`. Old token names are dead.)

- [ ] **Step 4: Strip Tailwind classes from every existing .tsx file**

Run a search for files using Tailwind:

```bash
grep -rl "className=\"" src/ui/widgets/ src/ui/popups/ src/routes/ 2>/dev/null
```

For each file in the output, open it and:
1. **Remove** all Tailwind utility classes from `className` strings (e.g., `flex`, `flex-col`, `gap-4`, `p-4`, `rounded`, `bg-app-panel`, `text-sm`, `font-semibold`, `text-fame`, etc.).
2. **Preserve** `data-testid` and any non-Tailwind classnames (e.g., the `fame-pulse-anim` keyframe class).
3. For layout-essential cases (`flex flex-col gap-4 p-4` on a wrapping div), replace with **inline `style={{ ... }}`** to keep functional layout. Example:
   - Before: `<div className="flex flex-col gap-4 p-4">`
   - After: `<div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>`
4. Color/typography utilities (`text-fame`, `bg-app-panel`, `text-sm`, `font-semibold`) — drop entirely. Visual will degrade; full restyling happens in Round 1+.

This is mechanical. Walk every file once. Files known to need attention:
- `src/ui/widgets/FloatingGoldText.tsx`
- `src/ui/widgets/Hoverable.tsx`
- `src/ui/widgets/LoadingScreen.tsx`
- `src/ui/widgets/TierUpgradeButton.tsx`
- `src/ui/popups/WorkshopPopup.tsx`
- `src/routes/TreeRoute.tsx`
- `src/routes/PaintingRoute.tsx`
- `src/routes/AscensionRoute.tsx`
- `src/routes/ConstellationRoute.tsx`

The legacy `src/ui/widgets/BottomBar.tsx`, `TopBar.tsx`, `InfoPanel.tsx`, `CurrencyDisplay.tsx` are NOT used by App.tsx anymore (replaced by new shell). They will be deleted in Task 10. For now, leave their Tailwind classes intact (cosmetic — they're orphaned).

- [ ] **Step 5: Verify build still works**

Run: `npm run build`
Expected: succeeds (no Tailwind plugin, no tailwindcss import → no errors).

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: 386 passing. Tests don't assert on classnames, so stripping Tailwind shouldn't break them.

- [ ] **Step 7: Smoke check**

```bash
npm run dev
```

Open http://localhost:5173. Verify:
- App loads
- Routes still navigate
- TopBar / BottomBar / InfoPanel render with new visual (these use the new shell, fully styled)
- Route content (Tree, Painting, Ascension, Constellation) renders functional but visually degraded (no Tailwind = no colors/spacing on internal elements). This is EXPECTED — Round 1+ fix each route's visuals.
- All buttons clickable; tier upgrade still works on PaintingRoute; ascend works; skill tree purchases work.

Stop dev server.

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "v2(stack): drop Tailwind 4 — strip utility classes from all components

Uninstalls tailwindcss + @tailwindcss/vite. Vite config no longer loads
the tailwind plugin. src/index.css keeps only the fame-pulse keyframe
+ reduced-motion fallback (the @theme tokens are replaced by tokens.css).
Tailwind utility classes stripped from every active component; layout-
essential cases (flex/grid/padding) preserved via inline style. Routes
look visually degraded — full restyling per route happens in Round 1+.
New shell components (TopBar, BottomBar, InfoPanel, MetaChip) already
use CSS Modules and look correct."
```

---

### Task 10: Delete legacy shell widgets

The legacy `TopBar.tsx`, `BottomBar.tsx`, `InfoPanel.tsx`, `CurrencyDisplay.tsx` are unused (replaced by new shell). Delete them and their tests.

**Files:**
- Delete: `src/ui/widgets/TopBar.tsx`
- Delete: `src/ui/widgets/BottomBar.tsx`
- Delete: `src/ui/widgets/InfoPanel.tsx`
- Delete: `src/ui/widgets/CurrencyDisplay.tsx`
- Delete (or empty/repurpose): `tests/ui/widgets/BottomBar.test.tsx`
- Update any other test that imports the deleted modules

- [ ] **Step 1: Confirm legacy widgets are unused**

```bash
grep -r "from \"@/ui/widgets/BottomBar\"" src/ tests/ 2>/dev/null
grep -r "from \"@/ui/widgets/TopBar\"" src/ tests/ 2>/dev/null
grep -r "from \"@/ui/widgets/InfoPanel\"" src/ tests/ 2>/dev/null
grep -r "from \"@/ui/widgets/CurrencyDisplay\"" src/ tests/ 2>/dev/null
```

Expected: only matches inside `tests/ui/widgets/` (the tests of those very files). If anything else references them, update to use the new shell components first.

- [ ] **Step 2: Delete the files**

```bash
rm src/ui/widgets/TopBar.tsx
rm src/ui/widgets/BottomBar.tsx
rm src/ui/widgets/InfoPanel.tsx
rm src/ui/widgets/CurrencyDisplay.tsx
rm tests/ui/widgets/BottomBar.test.tsx
```

(`TopBar.tsx`, `InfoPanel.tsx`, `CurrencyDisplay.tsx` may not have dedicated test files; check before deleting.)

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 386 minus deleted tests (~13 tests deleted with `BottomBar.test.tsx`) = ~373 passing.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "v2(cleanup): remove legacy shell widgets

The new shell (src/components/shell/{TopBar,BottomBar,InfoPanel,MetaChip,
CurrencyChip}) replaced these. Old widgets and their tests deleted."
```

---

# Phase E — Retire viewSlice + migration v5→v6 + final verify

---

### Task 11: Retire viewSlice

`react-router-dom` owns navigation now. The `viewSlice.currentView` field becomes dead state in the persisted save; we drop it via migration v5→v6.

**Files:**
- Delete: `src/store/viewSlice.ts`
- Delete: `tests/store/viewSlice.test.ts`
- Modify: `src/store/index.ts` (remove ViewSlice from union, remove `createViewSlice` from creator, bump SAVE_VERSION 5→6, add migration v5→v6)

- [ ] **Step 1: Write failing test for migration v5→v6**

Add to `tests/store/persistence-integration.test.ts` at the end of the file:

```ts
describe("save migration v5 → v6 (drop currentView)", () => {
  it("drops currentView field from v5 save", () => {
    const v5State = {
      gold: { __big: "0" },
      inspiration: { __big: "0" },
      fame: { __big: "0" },
      ascendCount: 0,
      playerId: "test-id",
      canvasTier: 1,
      paintMastery: { __big: "0" },
      lifetimeGold: { __big: "0" },
      currentView: "painting",
    };
    const migrated = migrate(v5State, 5) as unknown as Record<string, unknown>;
    expect("currentView" in migrated).toBe(false);
  });

  it("v1 → v6 chain preserves all earlier-migration data + drops currentView", () => {
    const v1State = {
      gold: { __big: "100" },
      inventory: [
        { kind: "+inspiration_rate%", magnitude: 10 },
        { kind: "+canvas_gold%", magnitude: 5 },
      ],
      equippedItems: [],
      playerId: "test-id-v1",
      currentView: "home",
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect((migrated.inventory as Array<{ kind: string }>).length).toBe(1);
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((migrated.lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
    expect("currentView" in migrated).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- persistence-integration`
Expected: FAIL — currentView remains in migrated state because no v5→v6 migration exists.

- [ ] **Step 3: Update store/index.ts**

Open `src/store/index.ts`:

1. Remove the `ViewSlice` import line.
2. Remove `& ViewSlice` from the `GameStore` type union.
3. Remove `...createViewSlice(set, get, store),` from the persist creator.
4. Bump `SAVE_VERSION` from 5 to 6.
5. Add the new migration block in the `migrate` function, after the existing `if (fromVersion < 5)` block (or whichever the last block is — there should be v1→v2, v2→v3, v3→v4, v4→v5, and now v5→v6):

```ts
  if (fromVersion < 6) {
    // v5 → v6 (2026-05-04): viewSlice retired in favor of react-router-dom.
    // Drop the persisted currentView field so future loads don't carry it.
    const { currentView: _cv, ...rest } = state;
    state = rest;
    void _cv;
  }
```

6. Update the JSDoc above `migrate` to mention the new step.

- [ ] **Step 4: Delete viewSlice files**

```bash
rm src/store/viewSlice.ts
rm tests/store/viewSlice.test.ts
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: ~373 - 5 (viewSlice tests) + 2 (new migration tests) = ~370 passing.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git rm src/store/viewSlice.ts tests/store/viewSlice.test.ts
git commit -m "v2(store): retire viewSlice; migration v5→v6 drops currentView

react-router-dom owns navigation in v2.0. The persisted currentView
field is dead state; v5→v6 migration drops it. SAVE_VERSION 5→6.
viewSlice + its tests deleted. 2 new migration tests."
```

---

### Task 12: Final verification + smoke + branch state report

This task does NOT make code changes. It's a verification gate before finalizing Round 0.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Capture and report the exact pass count. Expected: ~370 (some flux from deleted shell tests + new shell tests).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: zero new warnings beyond the pre-existing main.tsx warning.

- [ ] **Step 4: Production build**

Run: `npm run build`
Capture gzipped sizes. Expected: bundle still under 250 KB. Note: react-router-dom adds ~10 KB gzip; lucide-react tree-shakes; net change should be modest.

- [ ] **Step 5: Smoke playthrough**

Run: `npm run preview` (in background) and open the URL it prints.

Manual checklist (all in incognito for clean IDB):
1. Browser redirects to `/tree` from `/`.
2. TopBar: brand "ARTDLE" with fame-tinted "A". 4 nav links visible.
3. BottomBar: 4 currency chips. On `/tree`, gold + inspi prominent; fame + PM dimmed.
4. Click "Painting": URL changes; PaintingView content renders (degraded styling — that's expected).
5. Tier upgrade button still works (gold spent, tier increments).
6. Click "Ascension": URL changes; ascend works at threshold.
7. Click "Constellation": URL changes; skill nodes purchasable.
8. Refresh page on any route: lands back at the same route (router preserves URL); state persisted (gold/inspi/PM all rehydrate).
9. BottomBar dimming switches correctly per route.

Stop preview server.

- [ ] **Step 6: Update HANDOVER.md**

Open `docs/HANDOVER.md`. Add a new top section documenting Round 0 completion:

```markdown
## v2.0 Round 0 — Foundation (in progress on `feat/v2-redesign`)

**Status:** Round 0 complete on branch. Round 1+ pending.

### What landed

- `feat/v2-redesign` branch off `main` at `a0bb088`.
- Design tokens: `src/styles/tokens.css` (copied from `design_handoff_artdle/tokens.css` + new `--pm` teal block).
- Globals + base reset: `src/styles/globals.css`. Google Fonts (Cinzel, JetBrains Mono, Inter, Press Start 2P, VT323) loaded via `index.html`.
- Tailwind 4 fully removed (uninstalled, vite plugin dropped, `@theme` block in `src/index.css` deleted).
- New deps: `react-router-dom@7`, `lucide-react`.
- New shell components in `src/components/shell/`: `<TopBar>`, `<BottomBar>`, `<CurrencyChip>`, `<InfoPanel>`, `<MetaChip>`. All CSS Modules-styled per handoff aesthetic.
- React Router wired: 4 routes (`/tree`, `/painting`, `/ascension`, `/constellation`) + redirect from `/` and catch-all to `/tree`.
- Legacy views moved to `src/routes/` (`HomeView` → `TreeRoute`, `PaintingView` → `PaintingRoute`, `AscensionView` → `AscensionRoute`, `SkillTreeView` → `ConstellationRoute`). Tailwind classes stripped from each; layout preserved via inline style for essentials.
- Legacy shell widgets (`ui/widgets/{TopBar, BottomBar, InfoPanel, CurrencyDisplay}`) deleted.
- `viewSlice` retired. Migration v5 → v6 drops the `currentView` field from persisted saves.

### Visual state

- TopBar / BottomBar / InfoPanel: fully redesigned per handoff.
- Route content (Tree / Painting / Ascension / Constellation): functionally working, visually degraded (no Tailwind = unstyled internal elements). Per-route visual rebuild lands in Round 1-4.

### Tests + build

- ~370/370 tests passing.
- tsc clean. Lint clean (pre-existing main.tsx warning unchanged).
- Bundle: <NN> KB gzipped JS (capture from `npm run build` output).

### Next

Round 1: Tree route. Per spec §8 Round 1.
```

(Replace `<NN>` with actual gzipped JS size from the build.)

- [ ] **Step 7: Commit + report**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): v2.0 Round 0 (foundation) complete on branch"
```

Report to user:
- Status: DONE
- Final test count
- Bundle size
- HEAD SHA
- Branch state
- Smoke checklist results

DO NOT push, DO NOT tag, DO NOT merge to main. Round 1-5 + final tag come later.

---

### Task 13: (Optional) Tag a checkpoint `v2.0-round-0`

If the user wants a recoverable checkpoint between rounds:

- [ ] **Step 1: Tag**

```bash
git tag -a v2.0-round-0 -m "v2.0 Round 0 — foundation complete"
git rev-parse v2.0-round-0^{}
```

This is an annotated lightweight checkpoint. Not pushed unless user requests.

---

## Spec coverage check (self-review of this plan)

After writing this plan, I checked it against the spec (`docs/superpowers/specs/2026-05-04-v2-redesign-design.md`):

| Spec section | Task(s) |
|---|---|
| §3.2 Drop Tailwind | Task 9 |
| §3.3 Add react-router-dom + lucide-react | Task 2 |
| §5 PM tokens (`--pm` teal) | Task 1 (in tokens.css) |
| §6.1 TopBar | Task 5 |
| §6.2 BottomBar with 4 chips + dim logic | Tasks 3 + 4 |
| §6.3 Currency icons (CSS pixel-art) | Task 3 (CurrencyChip module CSS) |
| §7 Folder structure | Tasks 1, 3, 4, 5, 6, 7, 8 |
| §8 Round 0 — all 9 sub-bullets | Tasks 1–13 |
| §10 DoD items 1, 2, 3, 8 (router + 4 routes navigable, Tailwind gone, shell persistent, save survives refresh) | Verified in Task 12 smoke |

Out of scope for Round 0 (deferred to Round 1+):
- §8 Round 1-5 (per-route visual rebuilds)
- §9 PastRunsLedger (`pastRuns` state addition lands in Round 3)
- §10 DoD items 4-7 (per-route visual matching), 9 (test count target), 10 (bundle), 11 (README screenshots), 12 (`v2.0` tag)

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders. Every step has actual code.
- ✅ Each test step contains the test code; each impl step contains the implementation code or exact edit instructions.
- ✅ Type signatures consistent: `CurrencyKind = "gold" | "inspi" | "fame" | "pm"` defined in Task 3, used in Task 4.
- ✅ Test count math: 362 baseline + 6 (T3) + 6 (T4) + 4 (T5) + 4 (T6) + 4 (T7) + 0 (T8 net) - 13 (T10 deletes) - 5 (T11 deletes) + 2 (T11 adds) = ~370.
- ✅ Each task is bite-sized (15-45 min for an experienced dev).

---

**End of plan.**
