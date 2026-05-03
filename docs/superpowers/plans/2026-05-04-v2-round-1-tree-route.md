# v2.0 Round 1 — Tree Route Visual Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `TreeRoute` (currently degraded post-Round-0) with the handoff's visual language: pixel-art landscape SVG with a stage-responsive tree, inspi readout overlay, right-rail stage progress panel + upgrade list. No game-mechanics changes — every existing v1.1 tree behavior preserved.

**Architecture:** New components in `src/components/tree/` (`TreeScene`, `StagePanel`, `UpgradeList`, `UpgradeRow`, `InspiReadout`). Each is a focused SVG/JSX file with a CSS Module. `TreeRoute.tsx` becomes a thin layout coordinator: CSS Grid `1fr 340px` (scene + right rail), inspi overlay positioned over the scene. Existing slice actions (`buyPartLevel`, `growSapling`) wired through to upgrade rows + grow CTA.

**Tech Stack:** React 19 + TypeScript strict + Vite + Vitest + RTL. CSS Modules + tokens.css. Inline SVG (no asset fetches). Hoverable for live hover info.

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Pixel scene SVG | 1 |
| **B** | Right rail components | 2, 3 |
| **C** | Inspi overlay | 4 |
| **D** | Wire into TreeRoute | 5 |
| **E** | Verify + commit | 6 |

Each task: TDD cycle (test → fail → impl → pass → commit).

---

## Pre-flight checks (do once before Task 1)

- [ ] On `feat/v2-redesign`, working tree clean.
- [ ] HEAD at `878e23e` (v2.0-round-0 tag).
- [ ] Baseline tests pass: `npm test` reports 373/373.
- [ ] Existing `TreeRoute.tsx` is the post-T9 stripped version (Tailwind-free, functional).

---

## Existing data shape (do not change)

`TREE_STAGES` from `src/config/treeStages.ts` is 3 stages × 2 parts:

| Stage | id | unlockThreshold | Parts |
|---|---|---|---|
| 0 | seed | 0 | spark (10g, 0.1/s), bud (50g, 0.5/s) |
| 1 | sapling | 10 | leaf (100g, 5/s), branch (500g, 25/s) |
| 2 | tree | 100 | bough (1000g, 100/s), crown (5000g, 500/s) |

Existing slice actions (used as-is):
- `buyPartLevel(partId)` — atomic gold spend + level increment
- `growSapling()` — advances `currentStage` if `getTotalLevelsInStage(state) >= nextStage.unlockThreshold`
- `canGrowSapling(state)` selector — returns boolean
- `getProducingParts(state)`, `getTotalLevelsInStage(state, stage)` — selectors

Existing parts visible at any time = parts of all stages 0..currentStage (so 2/4/6 parts visible).

---

## Notes on visual deviations from handoff

The handoff's mock shows **4 stages** (Seed → Sapling → Young → Grand) and **5 fixed upgrades** (Roots / Trunk / Foliage / Branch / Bloom). v1.1 has 3 stages × 2-part progression. Per the v2.0 spec's "pure adapt, no new content" rule:

- The stage chip row shows the **3 v1.1 stages** (Seed → Sapling → Tree), not 4. The "active" pill highlights `currentStage`.
- The upgrade rows show the **v1.1 parts available at the current stage** (2 / 4 / 6 rows depending on `currentStage`), each with the v1.1 part's `name` (e.g., "Spark", "Bud", "Leaf"). Monogram tiles use the first letter (S, B, L, B, B, C — accept the duplicate "B" letter monograms; the row's label disambiguates).
- The Tree SVG renders 3 visual variants (small Seed sprout / mid Sapling / full Tree canopy), not 4.

These are documented in §4 of the v2.0 spec.

---

# Phase A — Pixel scene SVG

---

### Task 1: `<TreeScene>` — pixel landscape + stage-variant tree + motes/fireflies

A single inline SVG component. ~250-400 lines of SVG (sky / moon / stars / mountains / hills / waterfall / ground / pond / grass tufts / tree / motes / fireflies).

**Files:**
- Create: `src/components/tree/TreeScene.tsx`
- Create: `src/components/tree/TreeScene.module.css`
- Create: `tests/components/tree/TreeScene.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/tree/TreeScene.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TreeScene } from "@/components/tree/TreeScene";

describe("<TreeScene />", () => {
  it("renders an SVG", () => {
    const { container } = render(<TreeScene stage={0} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("exposes the current stage via data-stage attribute", () => {
    const { container, rerender } = render(<TreeScene stage={0} />);
    expect(container.firstChild).toHaveAttribute("data-stage", "0");
    rerender(<TreeScene stage={1} />);
    expect(container.firstChild).toHaveAttribute("data-stage", "1");
    rerender(<TreeScene stage={2} />);
    expect(container.firstChild).toHaveAttribute("data-stage", "2");
  });

  it("renders the inspiration motes group", () => {
    const { container } = render(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="motes"]')).toBeInTheDocument();
  });

  it("renders the firefly group", () => {
    const { container } = render(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="fireflies"]')).toBeInTheDocument();
  });

  it("renders the tree group with stage-specific data-tree-stage", () => {
    const { container, rerender } = render(<TreeScene stage={0} />);
    expect(container.querySelector('[data-testid="tree"]')).toHaveAttribute("data-tree-stage", "seed");
    rerender(<TreeScene stage={1} />);
    expect(container.querySelector('[data-testid="tree"]')).toHaveAttribute("data-tree-stage", "sapling");
    rerender(<TreeScene stage={2} />);
    expect(container.querySelector('[data-testid="tree"]')).toHaveAttribute("data-tree-stage", "tree");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/tree/TreeScene"`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/tree/TreeScene.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./TreeScene.module.css";

interface Props {
  stage: number;
}

const STAGE_NAMES = ["seed", "sapling", "tree"] as const;

/**
 * Pixel-art landscape: sky → mountains → hills → pond → ground → tree → motes → fireflies.
 * The tree visual has 3 variants keyed off `stage`. Motes and fireflies animate
 * via SVG `<animate>` (durations from handoff §Animations).
 *
 * Scene colors are inlined per the handoff's pixel-art SVG approach (the colors
 * are scene-specific, not part of the ARTDLE token palette).
 */
export function TreeScene({ stage }: Props): JSX.Element {
  const treeStageName = STAGE_NAMES[Math.max(0, Math.min(2, stage))] ?? "seed";
  return (
    <div className={styles.scene} data-stage={String(stage)}>
      <svg
        viewBox="0 0 480 320"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className={styles.svg}
        aria-label="Pixel-art landscape with a tree"
      >
        {/* Sky gradient */}
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a4f6a" />
            <stop offset="1" stopColor="#7a96b0" />
          </linearGradient>
        </defs>
        <rect width="480" height="200" fill="url(#sky)" />

        {/* Moon top-left */}
        <circle cx="60" cy="50" r="14" fill="#f4efe6" opacity="0.9" />
        <circle cx="65" cy="46" r="10" fill="#3a4f6a" opacity="0.5" />

        {/* Stars (pixel rectangles, scattered) */}
        <g fill="#f4efe6" opacity="0.7">
          <rect x="120" y="30" width="2" height="2" />
          <rect x="180" y="60" width="2" height="2" />
          <rect x="220" y="40" width="2" height="2" />
          <rect x="300" y="20" width="2" height="2" />
          <rect x="360" y="55" width="2" height="2" />
          <rect x="420" y="35" width="2" height="2" />
          <rect x="150" y="100" width="2" height="2" />
        </g>

        {/* Far mountains */}
        <polygon points="0,180 80,120 130,150 200,100 280,140 360,90 440,130 480,120 480,180" fill="#1f2a3a" />

        {/* Mid hills + pine triangles */}
        <polygon points="0,210 100,170 200,200 300,170 400,200 480,180 480,260 0,260" fill="#2e4a3a" />
        <g fill="#1a2e22">
          <polygon points="80,200 90,180 100,200" />
          <polygon points="120,205 130,185 140,205" />
          <polygon points="220,205 230,185 240,205" />
          <polygon points="380,200 390,180 400,200" />
        </g>

        {/* Waterfall (small line) */}
        <rect x="320" y="195" width="2" height="20" fill="#6fb1ff" opacity="0.6" />

        {/* Foreground ground */}
        <rect x="0" y="240" width="480" height="80" fill="#3a5a3a" />
        <rect x="0" y="260" width="480" height="60" fill="#2e4a2e" />

        {/* Grass tufts */}
        <g fill="#5a8a4a">
          <rect x="40" y="248" width="3" height="4" />
          <rect x="100" y="246" width="3" height="6" />
          <rect x="170" y="250" width="3" height="3" />
          <rect x="280" y="246" width="3" height="6" />
          <rect x="380" y="250" width="3" height="4" />
          <rect x="450" y="248" width="3" height="5" />
        </g>

        {/* Pond */}
        <ellipse cx="120" cy="280" rx="48" ry="10" fill="#1f3a4a" />
        <ellipse cx="120" cy="278" rx="40" ry="6" fill="#3a6a8a" />

        {/* Tree — center-right; rendered per stage */}
        <g data-testid="tree" data-tree-stage={treeStageName} transform="translate(320, 0)">
          {/* Root flare (always present) */}
          <rect x="-12" y="232" width="24" height="8" fill="#3a2a18" />
          <rect x="-8" y="240" width="16" height="4" fill="#2e2014" />

          {/* Stage 0: seed sprout — small */}
          {stage === 0 && (
            <>
              <rect x="-2" y="220" width="4" height="20" fill="#5a3a22" />
              <ellipse cx="0" cy="216" rx="10" ry="6" fill="#3a6a3a" />
              <ellipse cx="-2" cy="214" rx="6" ry="4" fill="#5a8a4a" />
            </>
          )}

          {/* Stage 1: sapling — mid */}
          {stage === 1 && (
            <>
              <rect x="-3" y="190" width="6" height="50" fill="#5a3a22" />
              <rect x="-3" y="200" width="6" height="2" fill="#3a2a18" />
              <rect x="-3" y="220" width="6" height="2" fill="#3a2a18" />
              {/* Two side branches */}
              <rect x="-12" y="200" width="9" height="3" fill="#5a3a22" />
              <rect x="3" y="208" width="9" height="3" fill="#5a3a22" />
              {/* 4-layer canopy */}
              <ellipse cx="0" cy="180" rx="30" ry="20" fill="#1a3a1a" />
              <ellipse cx="-2" cy="176" rx="24" ry="16" fill="#3a6a3a" />
              <ellipse cx="-2" cy="172" rx="18" ry="12" fill="#5a8a4a" />
              <ellipse cx="2" cy="170" rx="6" ry="4" fill="#a8d68f" />
              {/* Pixel highlights */}
              <rect x="-12" y="170" width="2" height="2" fill="#a8d68f" />
              <rect x="6" y="174" width="2" height="2" fill="#a8d68f" />
            </>
          )}

          {/* Stage 2: full tree — big */}
          {stage === 2 && (
            <>
              <rect x="-5" y="160" width="10" height="80" fill="#5a3a22" />
              <rect x="-5" y="170" width="10" height="3" fill="#3a2a18" />
              <rect x="-5" y="195" width="10" height="3" fill="#3a2a18" />
              <rect x="-5" y="220" width="10" height="3" fill="#3a2a18" />
              {/* Two side branches */}
              <rect x="-20" y="170" width="15" height="4" fill="#5a3a22" />
              <rect x="5" y="180" width="15" height="4" fill="#5a3a22" />
              {/* 4-layer canopy — bigger */}
              <ellipse cx="0" cy="150" rx="50" ry="35" fill="#1a3a1a" />
              <ellipse cx="-3" cy="144" rx="42" ry="28" fill="#3a6a3a" />
              <ellipse cx="-3" cy="140" rx="32" ry="22" fill="#5a8a4a" />
              <ellipse cx="3" cy="136" rx="12" ry="8" fill="#a8d68f" />
              {/* Pixel highlights */}
              <rect x="-22" y="138" width="2" height="2" fill="#a8d68f" />
              <rect x="14" y="142" width="2" height="2" fill="#a8d68f" />
              <rect x="-2" y="128" width="2" height="2" fill="#ffffff" opacity="0.6" />
            </>
          )}
        </g>

        {/* Inspiration motes around the canopy — 7 small circles, animated opacity */}
        <g data-testid="motes">
          <circle cx="310" cy="160" r="2" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="335" cy="148" r="2" fill="#f4efe6">
            <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="350" cy="170" r="1.5" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="3.1s" repeatCount="indefinite" />
          </circle>
          <circle cx="295" cy="178" r="2" fill="#f4efe6">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="325" cy="155" r="1.5" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.7s" repeatCount="indefinite" />
          </circle>
          <circle cx="345" cy="190" r="2" fill="#9b6cd6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="310" cy="195" r="1.5" fill="#f4efe6">
            <animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.3s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Fireflies rising from the ground — cy and opacity animation */}
        <g data-testid="fireflies">
          <circle cx="180" cy="260" r="1.5" fill="#ffd86a">
            <animate attributeName="cy" values="260;180" dur="6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="6s" repeatCount="indefinite" />
          </circle>
          <circle cx="240" cy="260" r="1.5" fill="#ffd86a">
            <animate attributeName="cy" values="260;200" dur="7.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="7.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="400" cy="260" r="1.5" fill="#ffd86a">
            <animate attributeName="cy" values="260;190" dur="8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="8s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/tree/TreeScene.module.css`:

```css
.scene {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--bg-stone-d);
}

.svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* Reduced motion: pause SVG animations */
@media (prefers-reduced-motion: reduce) {
  .svg :global(animate) {
    animation: none !important;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/tree/TreeScene"`
Expected: 5 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 373 + 5 = 378 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/tree/TreeScene.tsx src/components/tree/TreeScene.module.css tests/components/tree/TreeScene.test.tsx
git commit -m "v2(tree): add <TreeScene> pixel landscape SVG

Inline SVG: sky gradient, moon, pixel stars, mountains, hills, waterfall,
ground, pond, grass tufts, tree (3 stage variants), 7 inspiration motes
(animated opacity), 3 fireflies (rising cy + opacity). Stage prop drives
which tree variant renders. Scene colors inlined (not in tokens.css —
scene-specific palette per handoff).

5 RTL tests verify SVG presence, data-stage attribute, motes/fireflies
groups, and per-stage tree group attributes."
```

---

# Phase B — Right rail components

---

### Task 2: `<UpgradeRow>` — single styled upgrade row

A single row in the upgrade list. Renders monogram tile + name (Cinzel uppercase) + meta line (mono `Lv N · +X.X inspi/s`) + cost pill on the right. Click handler buys the part. Hover wraps in `<Hoverable>`. Disabled when can't afford.

**Files:**
- Create: `src/components/tree/UpgradeRow.tsx`
- Create: `src/components/tree/UpgradeRow.module.css`
- Create: `tests/components/tree/UpgradeRow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/tree/UpgradeRow.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpgradeRow } from "@/components/tree/UpgradeRow";

describe("<UpgradeRow />", () => {
  it("renders monogram, name, level, rate, cost", () => {
    render(
      <UpgradeRow
        partId="spark"
        name="Spark"
        level={3}
        rate={0.1}
        cost="120"
        canAfford={true}
        onBuy={() => {}}
      />,
    );
    expect(screen.getByText("S")).toBeInTheDocument(); // monogram
    expect(screen.getByText("Spark")).toBeInTheDocument();
    expect(screen.getByText(/Lv 3/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.1/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  it("calls onBuy when the button is clicked and affordable", () => {
    const onBuy = vi.fn();
    render(
      <UpgradeRow
        partId="spark"
        name="Spark"
        level={0}
        rate={0.1}
        cost="10"
        canAfford={true}
        onBuy={onBuy}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onBuy).toHaveBeenCalledOnce();
  });

  it("button is disabled when canAfford=false", () => {
    render(
      <UpgradeRow
        partId="spark"
        name="Spark"
        level={0}
        rate={0.1}
        cost="10"
        canAfford={false}
        onBuy={() => {}}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not call onBuy when disabled and clicked", () => {
    const onBuy = vi.fn();
    render(
      <UpgradeRow
        partId="spark"
        name="Spark"
        level={0}
        rate={0.1}
        cost="10"
        canAfford={false}
        onBuy={onBuy}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onBuy).not.toHaveBeenCalled();
  });

  it("monogram is the uppercased first letter of the name", () => {
    render(
      <UpgradeRow
        partId="bough"
        name="Bough"
        level={0}
        rate={100}
        cost="1K"
        canAfford={true}
        onBuy={() => {}}
      />,
    );
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/tree/UpgradeRow"`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/tree/UpgradeRow.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./UpgradeRow.module.css";

interface Props {
  partId: string;
  name: string;
  level: number;
  rate: number;
  cost: string;
  canAfford: boolean;
  onBuy: () => void;
}

/**
 * Stylized upgrade row for the Tree route's right rail.
 * Layout: [28×28 monogram tile] [name + meta] [cost pill button].
 * Disabled state when player can't afford. Hover styling lives in the
 * module.css :hover rules.
 */
export function UpgradeRow({
  partId,
  name,
  level,
  rate,
  cost,
  canAfford,
  onBuy,
}: Props): JSX.Element {
  const monogram = name.charAt(0).toUpperCase();
  return (
    <li className={styles.row} data-part-id={partId}>
      <span className={styles.monogram} aria-hidden="true">
        {monogram}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          Lv {level} · +{rate.toFixed(1)} inspi/s
        </span>
      </span>
      <button
        type="button"
        className={styles.cost}
        disabled={!canAfford}
        onClick={canAfford ? onBuy : undefined}
        data-testid={`upgrade-buy-${partId}`}
      >
        ⬢ {cost}g
      </button>
    </li>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/tree/UpgradeRow.module.css`:

```css
.row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-2) var(--s-3);
  border: var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--bg-1);
  list-style: none;
  transition: transform 140ms ease, border-color 140ms ease;
}

.row:hover {
  border-color: var(--inspi);
  transform: translateX(2px);
}

.monogram {
  width: 28px;
  height: 28px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  font-family: var(--serif);
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-1);
}

.body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.name {
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-0);
}

.meta {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}

.cost {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--gold);
  padding: var(--s-1) var(--s-3);
  border: 1px solid var(--gold-d);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  white-space: nowrap;
  transition: background-color 120ms ease, color 120ms ease;
}

.cost:hover:not(:disabled) {
  background: var(--gold-d);
  color: var(--bg-0);
}

.cost:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/tree/UpgradeRow"`
Expected: 5 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 378 + 5 = 383 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/tree/UpgradeRow.tsx src/components/tree/UpgradeRow.module.css tests/components/tree/UpgradeRow.test.tsx
git commit -m "v2(tree): add <UpgradeRow> styled upgrade row

Layout: 28×28 monogram tile (first letter, Cinzel) + serif name
uppercase + mono meta (Lv N · +X.X inspi/s) + cost pill button (gold,
mono). Hover: border becomes inspi-purple, row translateX 2px. Disabled
when canAfford=false. 5 RTL tests cover content, click, disabled
state, monogram derivation."
```

---

### Task 3: `<StagePanel>` — stage progress + grow CTA

Right rail's top panel. Shows the 3 stage chips (Seed → Sapling → Tree) with current highlighted, a progress bar (current stage's total levels / next stage's unlock threshold), the level count, and a disabled-or-enabled "Grow into…" CTA.

**Files:**
- Create: `src/components/tree/StagePanel.tsx`
- Create: `src/components/tree/StagePanel.module.css`
- Create: `tests/components/tree/StagePanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/tree/StagePanel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagePanel } from "@/components/tree/StagePanel";

describe("<StagePanel />", () => {
  it("renders all 3 stage chips with the current one marked active", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Sapling"
        nextStageName="Tree"
        totalLevelsInStage={5}
        unlockThreshold={10}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    const chips = screen.getAllByTestId(/stage-chip-/);
    expect(chips).toHaveLength(3);
    expect(screen.getByTestId("stage-chip-1")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("stage-chip-0")).not.toHaveAttribute("data-active", "true");
  });

  it("renders the title 'Stage A → Stage B' with current and next", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Sapling"
        nextStageName="Tree"
        totalLevelsInStage={5}
        unlockThreshold={10}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByText(/Sapling.*Tree/i)).toBeInTheDocument();
  });

  it("renders the progress label '{N} / {threshold} levels in stage'", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Sapling"
        nextStageName="Tree"
        totalLevelsInStage={5}
        unlockThreshold={10}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByText(/5 \/ 10 levels in stage/i)).toBeInTheDocument();
  });

  it("grow button is disabled when canGrow=false", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Sapling"
        nextStageName="Tree"
        totalLevelsInStage={5}
        unlockThreshold={10}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Grow/i })).toBeDisabled();
  });

  it("grow button calls onGrow when canGrow=true and clicked", () => {
    const onGrow = vi.fn();
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Sapling"
        nextStageName="Tree"
        totalLevelsInStage={10}
        unlockThreshold={10}
        canGrow={true}
        onGrow={onGrow}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Grow/i }));
    expect(onGrow).toHaveBeenCalledOnce();
  });

  it("renders 'Grow into {next stage}' label", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Sapling"
        nextStageName="Tree"
        totalLevelsInStage={10}
        unlockThreshold={10}
        canGrow={true}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Grow into Tree/i })).toBeInTheDocument();
  });

  it("renders 'Final stage' when nextStageName is undefined", () => {
    render(
      <StagePanel
        currentStageIndex={2}
        currentStageName="Tree"
        nextStageName={undefined}
        totalLevelsInStage={50}
        unlockThreshold={0}
        canGrow={false}
        onGrow={() => {}}
      />,
    );
    expect(screen.getByText(/Final stage/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/tree/StagePanel"`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/tree/StagePanel.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./StagePanel.module.css";

const STAGE_NAMES = ["Seed", "Sapling", "Tree"] as const;

interface Props {
  currentStageIndex: number;
  currentStageName: string;
  nextStageName: string | undefined;
  totalLevelsInStage: number;
  unlockThreshold: number;
  canGrow: boolean;
  onGrow: () => void;
}

/**
 * Top-of-right-rail stage progress panel.
 * Renders: title `Current → Next` (or `Current · Final stage` at top stage),
 * stage chip row (3 chips, current highlighted), progress bar to next-stage
 * unlock, level count, grow CTA.
 */
export function StagePanel({
  currentStageIndex,
  currentStageName,
  nextStageName,
  totalLevelsInStage,
  unlockThreshold,
  canGrow,
  onGrow,
}: Props): JSX.Element {
  const isFinal = nextStageName === undefined;
  const progressPct =
    unlockThreshold > 0 ? Math.min(100, (totalLevelsInStage / unlockThreshold) * 100) : 0;

  return (
    <section className={styles.panel} aria-label="Stage progress">
      <header className={styles.title}>
        {isFinal ? (
          <span>{currentStageName} · Final stage</span>
        ) : (
          <span>
            {currentStageName} → {nextStageName}
          </span>
        )}
      </header>

      <ol className={styles.chips} aria-label="Stage chain">
        {STAGE_NAMES.map((name, idx) => (
          <li
            key={name}
            className={styles.chip}
            data-testid={`stage-chip-${idx}`}
            data-active={idx === currentStageIndex ? "true" : undefined}
          >
            <span>{name}</span>
            {idx < STAGE_NAMES.length - 1 && <span className={styles.arrow} aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>

      {!isFinal && (
        <>
          <div
            className={styles.progress}
            role="progressbar"
            aria-valuenow={totalLevelsInStage}
            aria-valuemin={0}
            aria-valuemax={unlockThreshold}
          >
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
          <div className={styles.progressLabel}>
            {totalLevelsInStage} / {unlockThreshold} levels in stage
          </div>
          <button
            type="button"
            className={styles.grow}
            disabled={!canGrow}
            onClick={canGrow ? onGrow : undefined}
          >
            Grow into {nextStageName}
          </button>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/tree/StagePanel.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-4);
  border: var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--bg-1);
}

.title {
  font-family: var(--serif);
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-0);
}

.chips {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  list-style: none;
  margin: 0;
  padding: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}

.chip[data-active="true"] {
  color: var(--inspi);
  border-color: var(--inspi);
  background: var(--bg-3);
}

.arrow {
  margin-left: var(--s-2);
  color: var(--ink-3);
}

.progress {
  height: 6px;
  border-radius: 3px;
  background: var(--bg-stone-d);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--inspi);
  box-shadow: var(--inspi-glow);
  transition: width 200ms ease;
}

.progressLabel {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}

.grow {
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink-0);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--inspi-d);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  transition: background-color 120ms ease;
}

.grow:hover:not(:disabled) {
  background: var(--inspi-d);
}

.grow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/tree/StagePanel"`
Expected: 7 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 383 + 7 = 390 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/tree/StagePanel.tsx src/components/tree/StagePanel.module.css tests/components/tree/StagePanel.test.tsx
git commit -m "v2(tree): add <StagePanel> right-rail stage progress

Title 'Current → Next' (or 'Current · Final stage'). Stage chip row
of 3 (Seed/Sapling/Tree) with current marked data-active='true'.
Progress bar + level count + 'Grow into …' CTA. Disabled when canGrow
is false; calls onGrow when clicked. 7 RTL tests cover chip activation,
progress label, grow button enabled/disabled paths."
```

---

# Phase C — Inspi overlay

---

### Task 4: `<InspiReadout>` — top-left scene overlay

Big inspi-purple `+X.X inspi/s` (Cinzel 28px, glow) with mono `Stage · {name}` subtext.

**Files:**
- Create: `src/components/tree/InspiReadout.tsx`
- Create: `src/components/tree/InspiReadout.module.css`
- Create: `tests/components/tree/InspiReadout.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/tree/InspiReadout.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InspiReadout } from "@/components/tree/InspiReadout";

describe("<InspiReadout />", () => {
  it("renders the rate with a leading +", () => {
    render(<InspiReadout rate="3.2" stageName="Sapling" />);
    expect(screen.getByText(/\+3\.2 inspi\/s/i)).toBeInTheDocument();
  });

  it("renders the stage subtext 'Stage · {name}'", () => {
    render(<InspiReadout rate="3.2" stageName="Sapling" />);
    expect(screen.getByText(/Stage · Sapling/i)).toBeInTheDocument();
  });

  it("works at 0 rate", () => {
    render(<InspiReadout rate="0" stageName="Seed" />);
    expect(screen.getByText(/\+0 inspi\/s/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage · Seed/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/tree/InspiReadout"`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/tree/InspiReadout.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./InspiReadout.module.css";

interface Props {
  rate: string;        // formatted rate (e.g., "3.2", "1.23K"), already stringified by caller
  stageName: string;
}

/**
 * Top-left overlay on the TreeScene: large inspi-purple per-second readout
 * + mono stage subtext. Caller formats the rate (typically via `formatBig`).
 */
export function InspiReadout({ rate, stageName }: Props): JSX.Element {
  return (
    <div className={styles.readout}>
      <div className={styles.rate}>+{rate} inspi/s</div>
      <div className={styles.subtext}>Stage · {stageName}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/tree/InspiReadout.module.css`:

```css
.readout {
  position: absolute;
  top: var(--s-5);
  left: var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  pointer-events: none;
  user-select: none;
}

.rate {
  font-family: var(--serif);
  font-weight: 700;
  font-size: 28px;
  letter-spacing: 0.04em;
  color: var(--inspi);
  text-shadow: var(--inspi-glow);
}

.subtext {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-2);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/tree/InspiReadout"`
Expected: 3 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 390 + 3 = 393 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/tree/InspiReadout.tsx src/components/tree/InspiReadout.module.css tests/components/tree/InspiReadout.test.tsx
git commit -m "v2(tree): add <InspiReadout> top-left scene overlay

Big inspi-purple +X.X inspi/s (Cinzel 28px, glow) with mono
'Stage · {name}' subtext. Absolutely positioned over the scene;
pointer-events:none so the SVG underneath stays interactive (motes,
fireflies are decorative — no events). 3 RTL tests cover rate
formatting and stage subtext."
```

---

# Phase D — Wire it all into TreeRoute

---

### Task 5: Replace TreeRoute body with new layout

Replace the existing TreeRoute (post-Round-0 stripped HomeView) with the new layout: CSS Grid `1fr 340px`, scene + InspiReadout overlay on the left, StagePanel + UpgradeList on the right.

**Files:**
- Modify: `src/routes/TreeRoute.tsx` (full rewrite)
- Create: `src/routes/TreeRoute.module.css`
- Create: `tests/routes/TreeRoute.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/routes/TreeRoute.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TreeRoute } from "@/routes/TreeRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderTreeRoute() {
  return render(
    <MemoryRouter>
      <TreeRoute />
    </MemoryRouter>,
  );
}

describe("TreeRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.getState().resetRunCurrencies();
  });

  it("renders the scene SVG", () => {
    const { container } = renderTreeRoute();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders InspiReadout with stage name", () => {
    renderTreeRoute();
    expect(screen.getByText(/Stage · Seed/i)).toBeInTheDocument();
  });

  it("renders 3 stage chips in the right rail", () => {
    renderTreeRoute();
    expect(screen.getAllByTestId(/stage-chip-/)).toHaveLength(3);
  });

  it("renders upgrade rows for the parts visible at the current stage", () => {
    renderTreeRoute();
    // At currentStage=0 (Seed), 2 parts visible: spark + bud.
    expect(screen.getByTestId("upgrade-buy-spark")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-buy-bud")).toBeInTheDocument();
  });

  it("buy button is disabled when player has 0 gold", () => {
    renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-spark")).toBeDisabled();
  });

  it("buy button is enabled when player has enough gold", () => {
    useGameStore.setState({ gold: big(1000) });
    renderTreeRoute();
    expect(screen.getByTestId("upgrade-buy-spark")).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "routes/TreeRoute"`
Expected: FAIL — TreeRoute still has the old (post-T9 stripped) structure.

- [ ] **Step 3: Replace `src/routes/TreeRoute.tsx`**

Replace the entire file:

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
import { TreeScene } from "@/components/tree/TreeScene";
import { InspiReadout } from "@/components/tree/InspiReadout";
import { StagePanel } from "@/components/tree/StagePanel";
import { UpgradeRow } from "@/components/tree/UpgradeRow";
import styles from "./TreeRoute.module.css";

export function TreeRoute(): JSX.Element {
  const currentStage = useGameStore((s) => s.currentStage);
  const partLevels = useGameStore((s) => s.partLevels);
  const gold = useGameStore((s) => s.gold);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyPartLevel = useGameStore((s) => s.buyPartLevel);
  const growSapling = useGameStore((s) => s.growSapling);

  const helperState = {
    currentStage,
    partLevels,
    equippedItems,
    purchasedNodes,
  } as unknown as GameStore;

  const rate = inspiPerSec(getProducingParts(helperState), getInspiMultiplier(helperState));
  const canGrow = canGrowSapling(helperState);
  const stageConfig = TREE_STAGES[currentStage];
  const stageName = stageConfig?.name ?? "?";
  const nextStageConfig = TREE_STAGES[currentStage + 1];
  const totalLevels = getTotalLevelsInStage(helperState, currentStage);

  // Visible parts: every part of stages 0..currentStage.
  const visibleParts = TREE_STAGES.slice(0, currentStage + 1).flatMap((stage) => stage.parts);

  return (
    <div className={styles.layout}>
      <div className={styles.scene}>
        <TreeScene stage={currentStage} />
        <InspiReadout rate={formatBig(rate)} stageName={stageName} />
      </div>

      <aside className={styles.rail}>
        <StagePanel
          currentStageIndex={currentStage}
          currentStageName={stageName}
          nextStageName={nextStageConfig?.name}
          totalLevelsInStage={totalLevels}
          unlockThreshold={nextStageConfig?.unlockThreshold ?? 0}
          canGrow={canGrow}
          onGrow={growSapling}
        />

        <section className={styles.upgrades} aria-label="Upgrades">
          <header className={styles.upgradesHeader}>Upgrades · spend gold</header>
          <ul className={styles.upgradeList}>
            {visibleParts.map((part) => {
              const level = partLevels[part.id] ?? 0;
              const cost = treePartCost(level, part.baseCost);
              const canAfford = gold.gte(cost);
              return (
                <UpgradeRow
                  key={part.id}
                  partId={part.id}
                  name={part.name}
                  level={level}
                  rate={part.rate}
                  cost={formatBig(cost)}
                  canAfford={canAfford}
                  onBuy={() => buyPartLevel(part.id)}
                />
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Create the route's CSS Module**

`src/routes/TreeRoute.module.css`:

```css
.layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--s-5);
  height: 100%;
  padding: var(--s-5);
}

.scene {
  position: relative;
  height: 100%;
  min-height: 320px;
}

.rail {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  overflow-y: auto;
}

.upgrades {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.upgradesHeader {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}

.upgradeList {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "routes/TreeRoute"`
Expected: 6 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 393 + 6 = 399 passing.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean (or only the pre-existing main.tsx warning).

- [ ] **Step 8: Commit**

```bash
git add src/routes/TreeRoute.tsx src/routes/TreeRoute.module.css tests/routes/TreeRoute.test.tsx
git commit -m "v2(tree): rebuild TreeRoute with new layout + components

CSS Grid 1fr 340px (scene + right rail). Scene = TreeScene SVG +
InspiReadout overlay. Rail = StagePanel + Upgrades list of UpgradeRow
components. Existing v1.1 mechanics preserved: 3 stages, 2-6 visible
parts, buyPartLevel + growSapling actions wired through.
6 RTL tests verify layout, stage display, upgrade row presence,
and afford/disabled gating."
```

---

# Phase E — Verify + ship

---

### Task 6: Final verify + smoke + commit checkpoint

This task does NOT make code changes. Verification gate before declaring Round 1 complete.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Capture exact pass count. Expected: ~399.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean (or only pre-existing main.tsx warning).

- [ ] **Step 3: Production build**

Run: `npm run build`
Capture gzipped sizes. Bundle should still be under 250 KB.

- [ ] **Step 4: Smoke check**

```bash
npm run preview
```

Open the URL. Manual checklist:

1. Navigate to `/tree` (or just `/` — redirects).
2. The scene fills the left side; right rail visible.
3. Inspi readout in top-left shows `+X.X inspi/s` and `Stage · Seed` (initial).
4. Stage panel shows `Seed → Sapling`, 3 chips with Seed highlighted, progress bar at 0/10, "Grow into Sapling" disabled.
5. Upgrade rows show Spark and Bud (Seed parts).
6. Set gold via DevTools (or wait for it to accumulate via canvas — but canvas isn't usable on Tree route directly; use DevTools): click Buy on Spark. Level increments, gold drops. Inspi/s readout updates.
7. Buy Spark + Bud to combined level 10 → "Grow into Sapling" enables.
8. Click Grow → currentStage=1; tree visual changes (sapling); stage chip moves; new parts (Leaf, Branch) appear in upgrade list.
9. Refresh page. State persists.

Stop preview server.

- [ ] **Step 5: Update HANDOVER.md**

Open `docs/HANDOVER.md`. Find the v2.0 Round 0 section. Add a new sub-section ABOVE that one (most recent first):

```markdown
## v2.0 Round 1 — Tree route (in progress on `feat/v2-redesign`)

**Status:** Round 1 complete. Round 2 (Painting) pending.

### What landed

- New `src/components/tree/` directory:
  - `<TreeScene>` — pixel-art landscape SVG with sky/mountains/hills/pond/ground + 3-stage tree variant + 7 animated motes + 3 rising fireflies.
  - `<InspiReadout>` — Cinzel 28px inspi-purple rate readout overlay (top-left of scene) with mono `Stage · {name}` subtext.
  - `<StagePanel>` — right-rail top: title `Current → Next`, 3 stage chips (Seed/Sapling/Tree, current highlighted), progress bar, `Grow into …` CTA.
  - `<UpgradeRow>` — bordered rows with monogram tile + serif name + mono meta + gold cost pill.
- `src/routes/TreeRoute.tsx` rebuilt: CSS Grid `1fr 340px` layout (scene + right rail). All v1.1 tree mechanics preserved (3 stages × 2 parts; `buyPartLevel`/`growSapling` actions; `canGrowSapling` gate).

### Visual state

- Tree route: matches handoff aesthetic (pixel landscape + Cinzel/mono typography + inspi-glow + 3-stage tree visual).
- Painting / Ascension / Constellation: still degraded post-T9; Rounds 2-4 rebuild.

### Tests + build

- {NN} tests passing.
- tsc clean. Lint clean.
- Bundle: {NN} KB gzipped.

### Next

Round 2: Painting route. Per spec §8 Round 2.
```

(Replace `{NN}` with actual values.)

- [ ] **Step 6: Commit + tag checkpoint**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): v2.0 Round 1 (Tree) complete on branch"
git tag -a v2.0-round-1 -m "v2.0 Round 1 — Tree route complete"
```

DO NOT push or merge. Round 2-5 + final v2.0 tag come later.

- [ ] **Step 7: Report**

- Status: DONE
- Test count
- Bundle size
- HEAD SHA + tag
- Smoke results

## Spec coverage check (self-review of this plan)

| Spec section (v2.0 design) | Task |
|---|---|
| §8 Round 1 — TreeScene SVG (sky/mountains/hills/pond/tree/motes/fireflies) | Task 1 |
| §8 Round 1 — Inspi top-left readout | Task 4 |
| §8 Round 1 — StagePanel (chips + progress + grow CTA) | Task 3 |
| §8 Round 1 — UpgradeRow list, monogram tile + serif name + mono meta + cost pill | Tasks 2 + 5 |
| §8 Round 1 — Existing tree mechanics preserved (3 stages, parts, growSapling) | Task 5 |

Documented deviation from spec §3.3 (handoff's 4 stages × 5 fixed upgrades): per the v2.0 spec's "pure adapt" rule, this round renders v1.1's 3-stage × 2-part structure in the handoff's visual language (3 stage chips, 2-6 visible upgrade rows). Deviation noted in plan §"Notes on visual deviations from handoff".

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders.
- ✅ Every test step has test code; every impl step has implementation code.
- ✅ Type signatures consistent: `<UpgradeRow>` props (partId/name/level/rate/cost/canAfford/onBuy) defined in T2, used in T5; `<StagePanel>` props defined in T3, used in T5.
- ✅ Test count math: 373 baseline + 5 (T1) + 5 (T2) + 7 (T3) + 3 (T4) + 6 (T5) = 399.
- ✅ Each task is bite-sized.

---

**End of plan.**
