# v2.0 Round 2 — Painting Route Visual Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `PaintingRoute` with the handoff's visual language: vignetted canvas stage with gilded frame + paint-fill animation, always-visible canvas upgrades strip (1 tile = TierCard), 4-tab room rail (Workshop active, Office/School/Lab disabled), restyled Workshop room as side panel. No game-mechanics changes — every existing v1.1 painting/canvas/workshop behavior preserved. Retire the legacy `WorkshopPopup` (replaced by panel), `TierUpgradeButton` (replaced by `TierCard`), and `uiSlice.workshopPopupOpen` (no popup state).

**Architecture:** New components in `src/components/painting/` (`CanvasStage`, `TierCard`, `CanvasUpgradesStrip`, `RoomRail`, `WorkshopRoom`). `PaintingRoute.tsx` becomes a layout coordinator: CSS Grid `1fr 340px 64px` / `1fr auto` with grid-template-areas. Room rail tabs use `lucide-react` icons. Workshop is always the active room in v2.0; Office/School/Lab tabs are visible-but-disabled with "Coming soon" hints.

**Tech Stack:** React 19 + TypeScript strict + Vite + Vitest + RTL. CSS Modules + tokens.css. `lucide-react` for room rail icons. Inline SVG for canvas frame + landscape.

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Canvas content components | 1, 2, 3 |
| **B** | Room rail + workshop panel | 4, 5 |
| **C** | Wire PaintingRoute + retire legacy | 6 |
| **D** | Verify + tag | 7 |

Each task: TDD cycle (test → fail → impl → pass → commit).

---

## Pre-flight checks (do once before Task 1)

- [ ] On `feat/v2-redesign`, working tree clean.
- [ ] HEAD at `99e267a` (v2.0-round-1 tag).
- [ ] Baseline tests pass: `npm test` reports 399/399.
- [ ] Existing `PaintingRoute.tsx` is the post-Round-0 stripped version (Tailwind-free, functional).
- [ ] Existing `WorkshopPopup.tsx`, `TierUpgradeButton.tsx`, and `uiSlice.ts` still in place.

---

## Existing data shape (do not change)

`canvasSlice` from v1.1:
- `canvasProgress: number` — seconds painted on current canvas
- `canvasTier: number` — 1..10 (default 1)
- `lastSale: { id, amount } | null` — transient animation trigger
- `canvasTick(deltaSeconds)`, `upgradeTier()`, `resetCanvas()`, `clearLastSale()`

`workshopSlice` from v1.1:
- `inventory: ReadonlyArray<Item>` (max 3 per `MAX_INVENTORY_SLOTS`)
- `equippedItems: ReadonlyArray<Item>` (1 or 2 per `getCurrentSlotCount(state)`)
- `craft()`, `equip(invIdx)`, `unequip(equipIdx)`, `swap(invIdx, equipIdx)`, `discard(invIdx)`, `resetWorkshop()`

`balance.ts` formulas:
- `canvasGold(tier, multiplier): Big`
- `canvasTime(tier): number` (seconds)
- `tierUpgradeCost(currentTier): Big`
- `MAX_TIER = 10`

---

## Notes on visual deviations from handoff

The handoff's mock shows a **5-cell canvas upgrades strip** (Tier card + Strokes/Pigments/Auto-Sell/2nd Easel) and a **fully populated workshop room with rare/magic/epic/legendary item tiers**. Per the v2.0 spec's "pure adapt, no new content" rule:

- **Canvas upgrades strip ships with 1 tile** (Tier card only; the other 4 cells are empty layout slots — no fake placeholder upgrades).
- **Office, School, Lab tabs visible-but-disabled** in the room rail with "Coming soon" hover. Only Workshop has content.
- **Workshop room shows existing v1.1 craft + inventory + equip + discard logic** restyled to the handoff's aesthetic. No tier-specific item rarity styling beyond what v1.1 already produces (the existing v1.1 doesn't tag items with rarity tiers — that's a future wave).

These are documented in §4 of the v2.0 spec.

---

# Phase A — Canvas content components

---

### Task 1: `<CanvasStage>` — vignetted canvas frame + paint-fill + sale info

The big top-left area: vignetted dark room with a gilded picture frame, pixel landscape inside, animated paint-fill overlay (driven by existing `canvasProgress`), title row, bottom info row, and a trapezoidal easel cap peeking up from below.

**Files:**
- Create: `src/components/painting/CanvasStage.tsx`
- Create: `src/components/painting/CanvasStage.module.css`
- Create: `tests/components/painting/CanvasStage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/painting/CanvasStage.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasStage } from "@/components/painting/CanvasStage";

describe("<CanvasStage />", () => {
  it("renders the canvas SVG inside the frame", () => {
    const { container } = render(
      <CanvasStage
        tier={1}
        progressPct={0}
        timeRemaining="2.0"
        timeTotal="2.0"
        nextSaleGold="10"
      />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("displays the tier in the title row", () => {
    render(
      <CanvasStage
        tier={5}
        progressPct={0.6}
        timeRemaining="4.0"
        timeTotal="10.0"
        nextSaleGold="250"
      />,
    );
    expect(screen.getByText(/Tier 5/i)).toBeInTheDocument();
  });

  it("displays painting time as 'remaining / total'", () => {
    render(
      <CanvasStage
        tier={5}
        progressPct={0.6}
        timeRemaining="4.0"
        timeTotal="10.0"
        nextSaleGold="250"
      />,
    );
    expect(screen.getByText(/4\.0.*10\.0/)).toBeInTheDocument();
  });

  it("displays next sale gold preview", () => {
    render(
      <CanvasStage
        tier={1}
        progressPct={0}
        timeRemaining="2.0"
        timeTotal="2.0"
        nextSaleGold="184"
      />,
    );
    expect(screen.getByText(/\+184g/i)).toBeInTheDocument();
  });

  it("paint-fill overlay reflects progressPct via inline height style", () => {
    const { container } = render(
      <CanvasStage
        tier={1}
        progressPct={0.4}
        timeRemaining="1.2"
        timeTotal="2.0"
        nextSaleGold="10"
      />,
    );
    const fill = container.querySelector('[data-testid="canvas-fill"]') as HTMLElement;
    expect(fill).toBeInTheDocument();
    expect(fill?.style.height).toBe("40%");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/painting/CanvasStage"`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/painting/CanvasStage.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./CanvasStage.module.css";

interface Props {
  tier: number;
  progressPct: number;       // 0..1, drives the paint-fill overlay height
  timeRemaining: string;     // formatted seconds, e.g., "3.7"
  timeTotal: string;         // formatted seconds, e.g., "6.0"
  nextSaleGold: string;      // formatted gold preview, e.g., "184" or "1.2K"
}

const STAGE_NAMES: Record<number, string> = {
  1: "Apprentice",
  2: "Journeyman",
  3: "Adept",
  4: "Skilled",
  5: "Masterpiece",
  6: "Virtuoso",
  7: "Master",
  8: "Grandmaster",
  9: "Legendary",
  10: "Mythic",
};

/**
 * The vignetted canvas stage: dark room + gilded picture frame + pixel landscape
 * + animated paint-fill overlay (driven by progressPct) + easel cap.
 *
 * Title row top-center: "— Tier {N} · {Name} —" (Cinzel).
 * Below: thin gold progress bar.
 * Bottom row: "Painting · {remaining}s / {total}s" (left), "+{gold}g on next sale"
 * (gold-glowing center), tier label (right, decorative — actual upgrade UI is
 * the TierCard in the upgrades strip below).
 */
export function CanvasStage({
  tier,
  progressPct,
  timeRemaining,
  timeTotal,
  nextSaleGold,
}: Props): JSX.Element {
  const stageName = STAGE_NAMES[tier] ?? `Tier ${tier}`;
  const fillHeight = `${Math.max(0, Math.min(100, progressPct * 100))}%`;
  const barWidth = `${Math.max(0, Math.min(100, progressPct * 100))}%`;

  return (
    <section className={styles.stage} aria-label="Canvas stage">
      <div className={styles.title}>
        — Tier {tier} · {stageName} —
      </div>
      <div className={styles.frame}>
        {/* Pixel landscape inside the frame */}
        <svg
          viewBox="0 0 200 140"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          className={styles.canvasArt}
          aria-label={`Tier ${tier} pixel landscape`}
        >
          <defs>
            <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5a4a82" />
              <stop offset="1" stopColor="#a89cd6" />
            </linearGradient>
          </defs>
          <rect width="200" height="100" fill="url(#cs-sky)" />
          <polygon points="0,90 60,60 100,80 160,55 200,75 200,100 0,100" fill="#3a2e5a" />
          <rect width="200" height="40" y="100" fill="#2e4a3a" />
          <rect x="80" y="70" width="6" height="30" fill="#5a3a22" />
          <ellipse cx="83" cy="68" rx="14" ry="10" fill="#3a6a3a" />
          <ellipse cx="83" cy="65" rx="9" ry="6" fill="#5a8a4a" />
        </svg>

        {/* Paint-fill overlay — height controlled by progressPct */}
        <div
          className={styles.fill}
          data-testid="canvas-fill"
          style={{ height: fillHeight }}
          aria-hidden="true"
        />

        {/* Frame edges (decorative; CSS box-shadow + border on .frame does the gilded look) */}

        {/* Easel cap peeking from below (decorative trapezoid) */}
        <div className={styles.easel} aria-hidden="true" />
      </div>

      {/* Thin gold progress bar */}
      <div
        className={styles.progress}
        role="progressbar"
        aria-valuenow={Math.round(progressPct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.progressFill} style={{ width: barWidth }} />
      </div>

      {/* Bottom info row */}
      <div className={styles.bottomRow}>
        <span className={styles.painting}>
          Painting · {timeRemaining}s / {timeTotal}s
        </span>
        <span className={styles.goldPreview}>+{nextSaleGold}g on next sale</span>
        <span className={styles.tierBadge}>Tier {tier}</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/painting/CanvasStage.module.css`:

```css
.stage {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  height: 100%;
  position: relative;
  background: radial-gradient(circle at center, var(--bg-stone) 0%, var(--bg-stone-d) 100%);
  border-radius: var(--r-md);
  overflow: hidden;
}

.title {
  text-align: center;
  font-family: var(--serif);
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--ink-1);
}

.frame {
  position: relative;
  flex: 1;
  margin: 0 auto;
  width: min(360px, 80%);
  aspect-ratio: 4 / 3;
  border: 4px solid;
  border-image: linear-gradient(135deg, var(--gold), var(--gold-d)) 1;
  box-shadow:
    0 0 24px rgba(0, 0, 0, 0.6),
    inset 0 0 0 1px rgba(0, 0, 0, 0.4);
  background: var(--bg-stone-d);
  overflow: hidden;
}

.canvasArt {
  width: 100%;
  height: 100%;
  display: block;
}

.fill {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(0deg, rgba(155, 108, 214, 0.4), rgba(155, 108, 214, 0.1));
  pointer-events: none;
  transition: height 200ms linear;
}

.easel {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 50%;
  height: 16px;
  background: linear-gradient(180deg, var(--gold-d), var(--bg-stone-d));
  clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);
}

.progress {
  height: 3px;
  background: var(--bg-stone-d);
  border-radius: 2px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--gold);
  box-shadow: var(--gold-glow);
  transition: width 100ms linear;
}

.bottomRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-2);
}

.painting {
  font-family: var(--mono);
  color: var(--ink-2);
}

.goldPreview {
  font-family: var(--mono);
  color: var(--gold);
  text-shadow: var(--gold-glow);
  font-weight: 600;
}

.tierBadge {
  font-family: var(--serif);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/painting/CanvasStage"`
Expected: 5 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 399 + 5 = 404 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/painting/CanvasStage.tsx src/components/painting/CanvasStage.module.css tests/components/painting/CanvasStage.test.tsx
git commit -m "v2(painting): add <CanvasStage> vignetted canvas frame

Vignetted dark room (radial gradient bg) + gilded picture frame
(border-image gold→bronze) + pixel landscape SVG inside + paint-fill
overlay (height = progressPct * 100%) + easel cap (clip-path trapezoid)
+ thin gold progress bar + bottom info row (painting time / gold
preview / tier). 5 RTL tests cover SVG presence, tier in title,
time formatting, gold preview, paint-fill height."
```

---

### Task 2: `<TierCard>` — gold-glow upgrade card

The primary tile in the canvas upgrades strip. Big serif "current → next" tier display, full-width Upgrade button with cost, gold-glowing border. Wired to existing `canvasTier` + `upgradeTier`.

**Files:**
- Create: `src/components/painting/TierCard.tsx`
- Create: `src/components/painting/TierCard.module.css`
- Create: `tests/components/painting/TierCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/painting/TierCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierCard } from "@/components/painting/TierCard";

describe("<TierCard />", () => {
  it("renders 'Canvas Tier' label", () => {
    render(
      <TierCard tier={1} cost="100" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByText(/Canvas Tier/i)).toBeInTheDocument();
  });

  it("renders current → next tier as roman numerals", () => {
    render(
      <TierCard tier={2} cost="278" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByText(/II.*III/)).toBeInTheDocument();
  });

  it("renders 'Upgrade · {cost}g' button label", () => {
    render(
      <TierCard tier={1} cost="100" canAfford={true} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByRole("button")).toHaveTextContent(/Upgrade.*100/);
  });

  it("button is disabled when canAfford=false", () => {
    render(
      <TierCard tier={1} cost="100" canAfford={false} isMax={false} onUpgrade={() => {}} />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onUpgrade when button clicked and affordable", () => {
    const onUpgrade = vi.fn();
    render(
      <TierCard tier={1} cost="100" canAfford={true} isMax={false} onUpgrade={onUpgrade} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it("at MAX tier, shows 'Tier MAX' label and button is disabled", () => {
    render(
      <TierCard tier={10} cost="0" canAfford={false} isMax={true} onUpgrade={() => {}} />,
    );
    expect(screen.getByText(/Tier MAX/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/painting/TierCard"`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`src/components/painting/TierCard.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./TierCard.module.css";

interface Props {
  tier: number;
  cost: string;       // formatted gold cost, e.g., "100" or "1.2K"
  canAfford: boolean;
  isMax: boolean;     // tier === MAX_TIER
  onUpgrade: () => void;
}

const ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
  6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
};

/**
 * Primary tile in the canvas upgrades strip. Gold border + gold glow.
 * Layout: small "Canvas Tier" label + big serif current → next tier
 * (roman numerals) + full-width Upgrade button.
 *
 * isMax → label becomes "Tier MAX"; button is disabled and shows no cost.
 */
export function TierCard({ tier, cost, canAfford, isMax, onUpgrade }: Props): JSX.Element {
  const currentRoman = ROMAN[tier] ?? String(tier);
  const nextRoman = ROMAN[tier + 1] ?? "?";
  const disabled = isMax || !canAfford;
  const buttonLabel = isMax ? "Tier MAX" : `Upgrade · ${cost}g`;

  return (
    <div className={styles.card}>
      <div className={styles.label}>Canvas Tier</div>
      <div className={styles.numerals}>
        {isMax ? (
          <span>Tier MAX</span>
        ) : (
          <>
            <span>{currentRoman}</span>
            <span className={styles.arrow} aria-hidden="true">→</span>
            <span>{nextRoman}</span>
          </>
        )}
      </div>
      <button
        type="button"
        className={styles.upgradeBtn}
        disabled={disabled}
        onClick={!disabled ? onUpgrade : undefined}
        data-testid="tier-card-upgrade"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/painting/TierCard.module.css`:

```css
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3);
  border: 2px solid var(--gold);
  border-radius: var(--r-md);
  background: var(--bg-1);
  box-shadow: var(--gold-glow), inset 0 0 0 1px var(--gold-d);
}

.label {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}

.numerals {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-family: var(--serif);
  font-size: 28px;
  font-weight: 700;
  color: var(--gold);
  text-shadow: var(--gold-glow);
}

.arrow {
  font-size: 18px;
  color: var(--ink-2);
  text-shadow: none;
}

.upgradeBtn {
  width: 100%;
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--bg-0);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--gold-d);
  border-radius: var(--r-sm);
  background: var(--gold);
  transition: background-color 120ms ease, opacity 120ms ease;
}

.upgradeBtn:hover:not(:disabled) {
  background: var(--gold-d);
  color: var(--ink-0);
}

.upgradeBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--bg-2);
  color: var(--ink-3);
  border-color: var(--ink-line);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/painting/TierCard"`
Expected: 6 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 404 + 6 = 410 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/painting/TierCard.tsx src/components/painting/TierCard.module.css tests/components/painting/TierCard.test.tsx
git commit -m "v2(painting): add <TierCard> primary upgrade tile

Gold border + gold glow + 'Canvas Tier' label + big serif Roman
numerals (current → next) + full-width Upgrade button. At max tier,
shows 'Tier MAX' and disables. 6 RTL tests cover content render,
afford gating, click handler, max-tier path."
```

---

### Task 3: `<CanvasUpgradesStrip>` — 5-cell strip container

The always-visible horizontal strip beneath the canvas. v2.0 ships with **1 tile** (TierCard) — the other 4 cells are empty layout slots reserved for future upgrades (Strokes / Pigments / Auto-Sell / 2nd Easel land in later waves). No fake placeholders.

**Files:**
- Create: `src/components/painting/CanvasUpgradesStrip.tsx`
- Create: `src/components/painting/CanvasUpgradesStrip.module.css`
- Create: `tests/components/painting/CanvasUpgradesStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/painting/CanvasUpgradesStrip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";

describe("<CanvasUpgradesStrip />", () => {
  it("renders the strip container with role 'group'", () => {
    render(
      <CanvasUpgradesStrip>
        <div data-testid="child">child</div>
      </CanvasUpgradesStrip>,
    );
    expect(screen.getByRole("group", { name: /canvas upgrades/i })).toBeInTheDocument();
  });

  it("renders children inside the strip", () => {
    render(
      <CanvasUpgradesStrip>
        <div data-testid="tier-tile">Tile</div>
      </CanvasUpgradesStrip>,
    );
    expect(screen.getByTestId("tier-tile")).toBeInTheDocument();
  });

  it("uses a 5-column grid layout (CSS), confirmed via class on container", () => {
    const { container } = render(<CanvasUpgradesStrip />);
    const strip = container.firstChild as HTMLElement;
    expect(strip).toHaveAttribute("data-cells", "5");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/painting/CanvasUpgradesStrip"`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`src/components/painting/CanvasUpgradesStrip.tsx`:

```tsx
import type { JSX, ReactNode } from "react";
import styles from "./CanvasUpgradesStrip.module.css";

interface Props {
  children?: ReactNode;
}

/**
 * Always-visible horizontal strip beneath the canvas.
 * 5-column CSS grid. v2.0 ships with 1 cell occupied (TierCard) +
 * 4 empty layout slots reserved for future upgrades (no fake
 * placeholders per the v2.0 "pure adapt" rule).
 *
 * Children are placed in the first cells in document order; remaining
 * cells stay empty.
 */
export function CanvasUpgradesStrip({ children }: Props): JSX.Element {
  return (
    <section
      className={styles.strip}
      role="group"
      aria-label="Canvas upgrades"
      data-cells="5"
    >
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/painting/CanvasUpgradesStrip.module.css`:

```css
.strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--s-3);
  padding: var(--s-3);
  background: var(--bg-1);
  border: var(--border-subtle);
  border-radius: var(--r-md);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/painting/CanvasUpgradesStrip"`
Expected: 3 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 410 + 3 = 413 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/painting/CanvasUpgradesStrip.tsx src/components/painting/CanvasUpgradesStrip.module.css tests/components/painting/CanvasUpgradesStrip.test.tsx
git commit -m "v2(painting): add <CanvasUpgradesStrip> 5-cell layout container

5-column CSS grid container for canvas upgrade tiles. v2.0 fills 1 cell
(TierCard); other 4 are empty layout slots reserved for future upgrades.
3 RTL tests cover role / label / children passthrough / data-cells attr."
```

---

# Phase B — Room rail + workshop panel

---

### Task 4: `<RoomRail>` — vertical 4-tab room nav

64px-wide vertical rail with 4 tabs: Workshop (active, functional), Office, School, Lab (visible-but-disabled with "Coming soon" hover). Uses `lucide-react` icons.

**Files:**
- Create: `src/components/painting/RoomRail.tsx`
- Create: `src/components/painting/RoomRail.module.css`
- Create: `tests/components/painting/RoomRail.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/painting/RoomRail.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomRail } from "@/components/painting/RoomRail";

describe("<RoomRail />", () => {
  it("renders 4 room tabs", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /workshop/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /office/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /school/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /lab/i })).toBeInTheDocument();
  });

  it("Workshop tab is marked active (aria-selected='true')", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /workshop/i })).toHaveAttribute("aria-selected", "true");
  });

  it("Office, School, Lab tabs are NOT active", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /office/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /school/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /lab/i })).toHaveAttribute("aria-selected", "false");
  });

  it("Office, School, Lab tabs are disabled", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /office/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /school/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /lab/i })).toBeDisabled();
  });

  it("Workshop tab is enabled", () => {
    render(<RoomRail />);
    expect(screen.getByRole("tab", { name: /workshop/i })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/painting/RoomRail"`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`src/components/painting/RoomRail.tsx`:

```tsx
import type { JSX } from "react";
import { Hammer, User, GraduationCap, FlaskConical } from "lucide-react";
import styles from "./RoomRail.module.css";

interface RoomDef {
  id: "workshop" | "office" | "school" | "lab";
  label: string;
  Icon: typeof Hammer;
  active: boolean;
  enabled: boolean;
}

const ROOMS: ReadonlyArray<RoomDef> = [
  { id: "workshop", label: "Workshop", Icon: Hammer,        active: true,  enabled: true  },
  { id: "office",   label: "Office",   Icon: User,          active: false, enabled: false },
  { id: "school",   label: "School",   Icon: GraduationCap, active: false, enabled: false },
  { id: "lab",      label: "Lab",      Icon: FlaskConical,  active: false, enabled: false },
];

/**
 * 64px-wide vertical room rail. Workshop is the only active and enabled
 * room in v2.0; Office/School/Lab tabs are visible-but-disabled with
 * "Coming soon" title attribute.
 *
 * Future waves will: (a) take an `activeRoom` prop + `onSelect` callback,
 * (b) enable Office/School/Lab one wave at a time as their content ships.
 */
export function RoomRail(): JSX.Element {
  return (
    <nav className={styles.rail} role="tablist" aria-label="Rooms" aria-orientation="vertical">
      {ROOMS.map(({ id, label, Icon, active, enabled }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active ? "true" : "false"}
          aria-label={label}
          disabled={!enabled}
          title={enabled ? label : `${label} — coming soon`}
          className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          data-room={id}
        >
          <Icon size={20} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/painting/RoomRail.module.css`:

```css
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-2);
  border-left: var(--border-subtle);
  background: var(--bg-1);
  width: 64px;
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--s-2) 0;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-2);
  font-family: var(--mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.tab:hover:not(:disabled) {
  color: var(--ink-0);
  border-color: var(--inspi-d);
}

.tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tabActive {
  background: linear-gradient(135deg, var(--inspi-d), var(--inspi));
  color: var(--ink-0);
  border-color: var(--inspi);
  box-shadow: inset 0 0 12px rgba(155, 108, 214, 0.4);
}

.label {
  margin-top: 2px;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/painting/RoomRail"`
Expected: 5 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 413 + 5 = 418 passing.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/painting/RoomRail.tsx src/components/painting/RoomRail.module.css tests/components/painting/RoomRail.test.tsx
git commit -m "v2(painting): add <RoomRail> vertical 4-tab room nav

64px-wide vertical rail with 4 tabs (Workshop active, Office/School/Lab
disabled with 'Coming soon' titles). lucide-react icons (Hammer / User /
GraduationCap / FlaskConical). Workshop tab gets inspi-purple gradient
bg with inset glow when active. 5 RTL tests cover all 4 tabs render,
Workshop active, others not active + disabled."
```

---

### Task 5: `<WorkshopRoom>` — restyled workshop side panel

The 340px right panel showing existing v1.1 workshop content (craft / inventory / equipped) restyled to the handoff aesthetic. Replaces the legacy `WorkshopPopup` modal.

**Files:**
- Create: `src/components/painting/WorkshopRoom.tsx`
- Create: `src/components/painting/WorkshopRoom.module.css`
- Create: `tests/components/painting/WorkshopRoom.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/painting/WorkshopRoom.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("<WorkshopRoom />", () => {
  beforeEach(() => {
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
  });

  it("renders the room header 'Workshop'", () => {
    render(<WorkshopRoom />);
    expect(screen.getByRole("heading", { name: /workshop/i })).toBeInTheDocument();
  });

  it("renders Craft button (disabled when player has no gold)", () => {
    render(<WorkshopRoom />);
    expect(screen.getByRole("button", { name: /craft/i })).toBeDisabled();
  });

  it("Craft button is enabled when gold ≥ craft cost", () => {
    useGameStore.setState({ gold: big(10000) });
    render(<WorkshopRoom />);
    expect(screen.getByRole("button", { name: /craft/i })).not.toBeDisabled();
  });

  it("clicking Craft adds an item to inventory", () => {
    useGameStore.setState({ gold: big(10000) });
    render(<WorkshopRoom />);
    fireEvent.click(screen.getByRole("button", { name: /craft/i }));
    expect(useGameStore.getState().inventory.length).toBe(1);
  });

  it("renders 'Inventory' and 'Equipped' section headings", () => {
    render(<WorkshopRoom />);
    expect(screen.getByText(/inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/equipped/i)).toBeInTheDocument();
  });

  it("displays an inventory item that can be equipped via click", () => {
    useGameStore.setState({ gold: big(10000) });
    useGameStore.getState().craft();
    render(<WorkshopRoom />);
    const item = useGameStore.getState().inventory[0]!;
    const equipButton = screen.getByRole("button", { name: new RegExp(`${item.kind}.*${item.magnitude}`) });
    fireEvent.click(equipButton);
    expect(useGameStore.getState().equippedItems.length).toBe(1);
  });

  it("equipped items can be unequipped via click", () => {
    useGameStore.setState({ gold: big(10000) });
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    render(<WorkshopRoom />);
    const equipped = useGameStore.getState().equippedItems[0]!;
    const buttons = screen.getAllByRole("button", {
      name: new RegExp(`${equipped.kind}.*${equipped.magnitude}`),
    });
    // The equipped button (in the equipped section) — click whichever is enabled
    const target = buttons.find((b) => !b.hasAttribute("disabled")) ?? buttons[0]!;
    fireEvent.click(target);
    expect(useGameStore.getState().inventory.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/painting/WorkshopRoom"`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`src/components/painting/WorkshopRoom.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { CRAFT_COST_GOLD, MAX_INVENTORY_SLOTS } from "@/config/workshopAffixes";
import { getCurrentSlotCount } from "@/store/workshopSlice";
import styles from "./WorkshopRoom.module.css";

/**
 * 340px right panel — Workshop room content. Replaces the legacy WorkshopPopup
 * modal: same craft / equip / unequip / discard logic, restyled per handoff
 * aesthetic. Always visible alongside CanvasStage on the painting route in v2.0
 * (no popup state, no auto-close).
 */
export function WorkshopRoom(): JSX.Element {
  const inventory = useGameStore((s) => s.inventory);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const gold = useGameStore((s) => s.gold);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const craft = useGameStore((s) => s.craft);
  const equip = useGameStore((s) => s.equip);
  const unequip = useGameStore((s) => s.unequip);
  const discard = useGameStore((s) => s.discard);

  const helperState = { purchasedNodes } as unknown as GameStore;
  const slotCount = getCurrentSlotCount(helperState);
  const canCraft = gold.gte(big(CRAFT_COST_GOLD)) && inventory.length < MAX_INVENTORY_SLOTS;
  const canEquipMore = equippedItems.length < slotCount;
  const canUnequip = inventory.length < MAX_INVENTORY_SLOTS;

  return (
    <section className={styles.room} aria-label="Workshop room">
      <header className={styles.header}>
        <h2 className={styles.title}>Workshop</h2>
        <span className={styles.crumb}>Craft · Equip</span>
      </header>

      <section className={styles.craftStation}>
        <div className={styles.subhead}>Craft station</div>
        <div className={styles.craftMeta}>
          Roll an item · Random affix · 5–15% magnitude
        </div>
        <button
          type="button"
          className={styles.craftBtn}
          disabled={!canCraft}
          onClick={() => craft()}
          data-testid="craft-button"
        >
          Craft · {CRAFT_COST_GOLD}g
        </button>
        <div className={styles.craftStatus}>
          Inventory: {inventory.length}/{MAX_INVENTORY_SLOTS}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Equipped <span className={styles.count}>{equippedItems.length}/{slotCount}</span>
        </div>
        {equippedItems.length === 0 ? (
          <div className={styles.empty}>No items equipped.</div>
        ) : (
          <ul className={styles.list}>
            {equippedItems.map((item, idx) => (
              <li key={idx} className={styles.row}>
                <button
                  type="button"
                  className={styles.itemBtn}
                  disabled={!canUnequip}
                  onClick={() => unequip(idx)}
                  data-testid={`equipped-item-${idx}`}
                >
                  {item.kind} {item.magnitude}%
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Inventory <span className={styles.count}>{inventory.length}/{MAX_INVENTORY_SLOTS}</span>
        </div>
        {inventory.length === 0 ? (
          <div className={styles.empty}>Empty — click Craft to roll an item.</div>
        ) : (
          <ul className={styles.list}>
            {inventory.map((item, idx) => (
              <li key={idx} className={styles.row}>
                <button
                  type="button"
                  className={styles.itemBtn}
                  disabled={!canEquipMore}
                  onClick={() => equip(idx)}
                  data-testid={`inventory-item-${idx}`}
                >
                  {item.kind} {item.magnitude}%
                </button>
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => discard(idx)}
                  aria-label={`Discard ${item.kind} ${item.magnitude}%`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/painting/WorkshopRoom.module.css`:

```css
.room {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-4);
  border: var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--bg-1);
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: var(--border-subtle);
  padding-bottom: var(--s-2);
}

.title {
  margin: 0;
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-0);
}

.crumb {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}

.section, .craftStation {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.subhead {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.count {
  margin-left: var(--s-2);
  color: var(--ink-2);
}

.craftMeta {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}

.craftBtn {
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink-0);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--gold-d);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  transition: background-color 120ms ease;
}

.craftBtn:hover:not(:disabled) {
  background: var(--gold-d);
}

.craftBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.craftStatus {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}

.empty {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
  font-style: italic;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.itemBtn {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-0);
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  text-align: left;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.itemBtn:hover:not(:disabled) {
  border-color: var(--inspi);
  background: var(--bg-3);
}

.itemBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.discardBtn {
  font-family: var(--mono);
  font-size: 12px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-3);
  transition: color 120ms ease, border-color 120ms ease;
}

.discardBtn:hover {
  color: var(--tier-legendary);
  border-color: var(--tier-legendary);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/painting/WorkshopRoom"`
Expected: 7 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 418 + 7 = 425 passing.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/painting/WorkshopRoom.tsx src/components/painting/WorkshopRoom.module.css tests/components/painting/WorkshopRoom.test.tsx
git commit -m "v2(painting): add <WorkshopRoom> side panel (replaces popup)

340px right panel with header (Workshop · Craft / Equip) + craft station
+ Equipped section + Inventory section. Restyled per handoff aesthetic.
Same v1.1 logic (craft / equip / unequip / discard) — no behavior change.
Replaces legacy WorkshopPopup modal in T6. 7 RTL tests cover header,
craft gating + click, equip/unequip flow, section headings."
```

---

# Phase C — Wire PaintingRoute + retire legacy

---

### Task 6: Replace PaintingRoute with new layout + delete legacy widgets

Rewrite `PaintingRoute.tsx` with the handoff's CSS Grid layout. Mount all 5 new components. Delete legacy widgets (`TierUpgradeButton`, `WorkshopPopup`) and the now-unused `uiSlice` fields/actions. Remove `<WorkshopPopup />` mount from `App.tsx`.

**Files:**
- Modify: `src/routes/PaintingRoute.tsx` (full rewrite)
- Create: `src/routes/PaintingRoute.module.css`
- Create: `tests/routes/PaintingRoute.test.tsx`
- Modify: `src/App.tsx` (remove WorkshopPopup import + mount)
- Modify: `src/store/uiSlice.ts` (drop workshopPopupOpen + actions; if file becomes empty, delete it)
- Modify: `src/store/index.ts` (if uiSlice deleted: remove from union + creator)
- Modify: `src/store/index.ts` (partialize: remove `workshopPopupOpen` exclude)
- Delete: `src/ui/widgets/TierUpgradeButton.tsx`
- Delete: `src/ui/popups/WorkshopPopup.tsx`
- Delete: `tests/ui/widgets/TierUpgradeButton.test.tsx`
- Delete: `tests/ui/popups/WorkshopPopup.test.tsx`

- [ ] **Step 1: Confirm legacy widgets are no longer needed**

```bash
grep -r "from \"@/ui/widgets/TierUpgradeButton\"" src/ tests/ 2>/dev/null
grep -r "from \"@/ui/popups/WorkshopPopup\"" src/ tests/ 2>/dev/null
```

Expected (before changes): only the imports inside `src/routes/PaintingRoute.tsx` and `src/App.tsx`. Both are about to be replaced.

- [ ] **Step 2: Write the failing test**

```tsx
// tests/routes/PaintingRoute.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderPaintingRoute() {
  return render(
    <MemoryRouter>
      <PaintingRoute />
    </MemoryRouter>,
  );
}

describe("PaintingRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
  });

  it("renders the canvas SVG", () => {
    const { container } = renderPaintingRoute();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the TierCard", () => {
    renderPaintingRoute();
    expect(screen.getByTestId("tier-card-upgrade")).toBeInTheDocument();
  });

  it("renders the room rail with 4 tabs", () => {
    renderPaintingRoute();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("renders the WorkshopRoom (Craft button visible)", () => {
    renderPaintingRoute();
    expect(screen.getByTestId("craft-button")).toBeInTheDocument();
  });

  it("tier upgrade button works (clicking spends gold + bumps tier)", () => {
    useGameStore.setState({ gold: big(1000), canvasTier: 1 });
    renderPaintingRoute();
    const before = useGameStore.getState().canvasTier;
    screen.getByTestId("tier-card-upgrade").click();
    expect(useGameStore.getState().canvasTier).toBe(before + 1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- "routes/PaintingRoute"`
Expected: FAIL — PaintingRoute still has the old layout, no `tier-card-upgrade` testid.

- [ ] **Step 4: Replace `src/routes/PaintingRoute.tsx`**

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canvasGold, canvasTime, tierUpgradeCost, MAX_TIER } from "@/core/balance";
import { getCanvasGoldMultiplier, getPaintTimeMultiplier, getPmMultiplier } from "@/core/multipliers";
import { formatBig } from "@/core/formatter";
import { CanvasStage } from "@/components/painting/CanvasStage";
import { TierCard } from "@/components/painting/TierCard";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";
import { RoomRail } from "@/components/painting/RoomRail";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import styles from "./PaintingRoute.module.css";

export function PaintingRoute(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const canvasTier = useGameStore((s) => s.canvasTier);
  const gold = useGameStore((s) => s.gold);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const paintMastery = useGameStore((s) => s.paintMastery);
  const upgradeTier = useGameStore((s) => s.upgradeTier);
  const lastSale = useGameStore((s) => s.lastSale);
  const clearLastSale = useGameStore((s) => s.clearLastSale);

  const helperState = {
    equippedItems,
    purchasedNodes,
    paintMastery,
  } as unknown as GameStore;

  const baseTime = canvasTime(canvasTier);
  const paintTimeSec = baseTime / getPaintTimeMultiplier(helperState);
  const progressPct = paintTimeSec > 0 ? canvasProgress / paintTimeSec : 0;
  const goldMult = getCanvasGoldMultiplier(helperState) * getPmMultiplier(helperState);
  const nextSaleGold = canvasGold(canvasTier, goldMult);

  const isMax = canvasTier >= MAX_TIER;
  const upgradeCost = isMax ? big(0) : tierUpgradeCost(canvasTier);
  const canAffordUpgrade = !isMax && gold.gte(upgradeCost);

  return (
    <div className={styles.layout}>
      <div className={styles.stageArea}>
        <CanvasStage
          tier={canvasTier}
          progressPct={progressPct}
          timeRemaining={(paintTimeSec - canvasProgress).toFixed(1)}
          timeTotal={paintTimeSec.toFixed(1)}
          nextSaleGold={formatBig(nextSaleGold)}
        />
        {lastSale && (
          <FloatingGoldText
            key={lastSale.id}
            amount={lastSale.amount}
            onComplete={clearLastSale}
          />
        )}
      </div>

      <div className={styles.upgradesArea}>
        <CanvasUpgradesStrip>
          <TierCard
            tier={canvasTier}
            cost={formatBig(upgradeCost)}
            canAfford={canAffordUpgrade}
            isMax={isMax}
            onUpgrade={upgradeTier}
          />
        </CanvasUpgradesStrip>
      </div>

      <aside className={styles.roomArea}>
        <WorkshopRoom />
      </aside>

      <aside className={styles.railArea}>
        <RoomRail />
      </aside>
    </div>
  );
}

// Big import just for upgradeCost default at MAX_TIER. Re-export keeps the
// fall-through `tierUpgradeCost(MAX_TIER)` call out of the render path.
import { big } from "@/core/bigNumber";
```

Wait — JSX is not valid below an `import`. Move the `import { big }` to the top of the file with the others. Final shape:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canvasGold, canvasTime, tierUpgradeCost, MAX_TIER } from "@/core/balance";
import { getCanvasGoldMultiplier, getPaintTimeMultiplier, getPmMultiplier } from "@/core/multipliers";
import { formatBig } from "@/core/formatter";
import { big } from "@/core/bigNumber";
import { CanvasStage } from "@/components/painting/CanvasStage";
import { TierCard } from "@/components/painting/TierCard";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";
import { RoomRail } from "@/components/painting/RoomRail";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import styles from "./PaintingRoute.module.css";

export function PaintingRoute(): JSX.Element {
  // ... (body as above, no trailing import)
}
```

- [ ] **Step 5: Create `src/routes/PaintingRoute.module.css`**

```css
.layout {
  display: grid;
  grid-template-columns: 1fr 340px 64px;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    "stage room rail"
    "upgrades room rail";
  gap: var(--s-4);
  height: 100%;
  padding: var(--s-4);
}

.stageArea {
  grid-area: stage;
  position: relative;
  min-height: 320px;
}

.upgradesArea {
  grid-area: upgrades;
}

.roomArea {
  grid-area: room;
  height: 100%;
  overflow: hidden;
}

.railArea {
  grid-area: rail;
}
```

- [ ] **Step 6: Update `src/App.tsx` — remove WorkshopPopup**

Read the existing `src/App.tsx`. Remove the `import { WorkshopPopup } from "@/ui/popups/WorkshopPopup";` line and the `<WorkshopPopup />` mount inside `<main>`. The Routes / shell chrome / 4 routes remain unchanged.

- [ ] **Step 7: Delete legacy files**

```bash
rm src/ui/widgets/TierUpgradeButton.tsx
rm src/ui/popups/WorkshopPopup.tsx
rm tests/ui/widgets/TierUpgradeButton.test.tsx
rm tests/ui/popups/WorkshopPopup.test.tsx
```

If `src/ui/popups/` is empty after, also remove it:
```bash
rmdir src/ui/popups/ 2>/dev/null || true
rmdir tests/ui/popups/ 2>/dev/null || true
```

- [ ] **Step 8: Update `src/store/uiSlice.ts` — drop popup state**

Read the file. Remove `workshopPopupOpen` from state, remove `openWorkshopPopup` and `closeWorkshopPopup` actions. If the slice is now empty, delete the file entirely.

```bash
# Inspect first
cat src/store/uiSlice.ts
```

If the file is now empty (only `workshopPopupOpen` was there), delete it:

```bash
rm src/store/uiSlice.ts
rm tests/store/uiSlice.test.ts 2>/dev/null || true
```

- [ ] **Step 9: Update `src/store/index.ts`**

Read the file. If `uiSlice` is deleted:
1. Remove `import { createUiSlice, type UiSlice } from "./uiSlice";`.
2. Remove `& UiSlice` from the GameStore union.
3. Remove `...createUiSlice(set, get, store),` from the persist creator.
4. Remove `workshopPopupOpen: _w,` from the partialize destructure (it's no longer a field on the store).

If `uiSlice` is kept (had other fields), only do step 4 (remove the partialize exclude).

- [ ] **Step 10: Run all tests**

Run: `npm test`
Expected: 425 passing minus any that test the deleted legacy files. Note exact count.

If a test file still imports a deleted module, delete it. If a test references `uiSlice.workshopPopupOpen` or related actions, delete those tests.

- [ ] **Step 11: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean (or pre-existing main.tsx warning).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "v2(painting): rebuild PaintingRoute with new layout + retire legacy

CSS Grid 'stage room rail / upgrades room rail' (1fr 340px 64px columns,
1fr auto rows). Mounts: CanvasStage + TierCard inside CanvasUpgradesStrip
+ WorkshopRoom + RoomRail. FloatingGoldText preserved (canvas sale anim).

Retires:
- src/ui/widgets/TierUpgradeButton.tsx (replaced by TierCard)
- src/ui/popups/WorkshopPopup.tsx (replaced by WorkshopRoom side panel)
- src/store/uiSlice.ts (workshopPopupOpen no longer needed)
- App.tsx no longer mounts WorkshopPopup

5 RTL tests cover canvas SVG, TierCard, room rail tabs, Workshop room,
tier-upgrade click behavior."
```

---

# Phase D — Verify + tag

---

### Task 7: Final verify + smoke + HANDOVER + checkpoint tag

This task does NOT make code changes (except HANDOVER). Verification gate before declaring Round 2 complete.

**IMPORTANT:** Do NOT push, do NOT merge. Local-only branch + tag.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Capture exact pass count. Expected: ~410-420 (from Round 1's 399 + new tests minus deletes).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Capture gzipped sizes (HTML / CSS / JS / total). Expected: still under 250 KB.

- [ ] **Step 4: Smoke check via curl**

```bash
npm run preview &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/ 2>&1 | tail -1
kill %1 2>/dev/null || true
```

Expected: HTTP 200. The user does the manual browser playthrough separately.

- [ ] **Step 5: Update `docs/HANDOVER.md`**

Open `docs/HANDOVER.md`. Find the v2.0 Round 1 section. Add a NEW sub-section ABOVE it:

```markdown
## v2.0 Round 2 — Painting route (in progress on `feat/v2-redesign`)

**Status:** Round 2 complete. Round 3 (Ascension) pending.

### What landed

- New `src/components/painting/` directory:
  - `<CanvasStage>` — vignetted canvas frame + gilded picture frame + pixel landscape SVG inside + animated paint-fill overlay (height = progressPct%) + easel cap + thin gold progress bar + bottom info row.
  - `<TierCard>` — primary tile in the canvas upgrades strip. Gold border + gold glow + Roman numerals current → next + Upgrade button.
  - `<CanvasUpgradesStrip>` — 5-cell layout container. v2.0 fills 1 cell (TierCard); 4 are empty layout slots reserved for future upgrades.
  - `<RoomRail>` — 64px vertical nav with 4 tabs (Workshop active; Office/School/Lab disabled with "Coming soon"). lucide-react icons.
  - `<WorkshopRoom>` — 340px right panel replacing legacy WorkshopPopup. Same v1.1 craft/equip/unequip/discard logic, restyled.
- `src/routes/PaintingRoute.tsx` rebuilt: CSS Grid `1fr 340px 64px / 1fr auto` with named areas (stage / upgrades / room / rail).

### Retired

- `src/ui/widgets/TierUpgradeButton.tsx` (replaced by TierCard).
- `src/ui/popups/WorkshopPopup.tsx` (replaced by WorkshopRoom panel; popup state removed).
- `src/store/uiSlice.ts` (workshopPopupOpen field + open/close actions no longer needed).
- `<WorkshopPopup />` mount in `App.tsx`.

### Visual state

- Painting route: matches handoff aesthetic (vignetted canvas + gilded frame + tier card + room rail with workshop side panel).
- Tree: complete (Round 1).
- Ascension / Constellation: still degraded; Rounds 3-4 rebuild.

### Tests + build

- {NN} tests passing.
- tsc clean. Lint clean.
- Bundle: {NN} KB gzipped JS / {NN} KB gzipped CSS / ~{NN} KB total.

### Next

Round 3: Ascension route. Per spec §8 Round 3.
```

(Replace `{NN}` with actual values.)

- [ ] **Step 6: Commit + tag checkpoint**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): v2.0 Round 2 (Painting) complete on branch"
git tag -a v2.0-round-2 -m "v2.0 Round 2 — Painting route complete"
```

DO NOT push.

- [ ] **Step 7: Report**

- Status: DONE
- Test count
- Bundle size
- HEAD SHA + tag SHA
- Smoke curl result

## Spec coverage check (self-review of this plan)

| Spec section (v2.0 design) | Task |
|---|---|
| §8 Round 2 — CanvasStage (easel + frame + paint-fill anim) | Task 1 |
| §8 Round 2 — TierCard wired to existing canvasTier + upgradeTier | Task 2 |
| §8 Round 2 — CanvasUpgradesStrip with 1 tile (no fake placeholders) | Task 3 |
| §8 Round 2 — RoomRail with Workshop active + others disabled | Task 4 |
| §8 Round 2 — WorkshopRoom restyled (existing v1.1 logic) | Task 5 |
| §8 Round 2 — FloatingGoldText preserved | Task 6 (kept in PaintingRoute import) |
| §4 deviation #4 — strip ships with 1 tile only | Task 3 + 6 |
| §4 deviation — Office/School/Lab tabs visible-but-disabled | Task 4 |
| Cleanup — retire WorkshopPopup, TierUpgradeButton, uiSlice.workshopPopupOpen | Task 6 |

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders.
- ✅ Test code given for every TDD step; impl code given for every implementation step.
- ✅ Type signatures consistent: `<TierCard>` props (tier/cost/canAfford/isMax/onUpgrade) defined in T2, used in T6; `<CanvasStage>` props in T1, used in T6.
- ✅ Test count math: 399 baseline + 5 (T1) + 6 (T2) + 3 (T3) + 5 (T4) + 7 (T5) + 5 (T6) = +31; minus deleted legacy tests (TierUpgradeButton ~5, WorkshopPopup ~10-15) = net ~+11 to +16. End count ~410-415.
- ✅ Each task is bite-sized.

---

**End of plan.**
