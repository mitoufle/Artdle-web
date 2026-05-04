# v2.0 Round 4 — Constellation Route Visual Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `ConstellationRoute` with the handoff's visual language: star-map canvas with twinkling stars + 5 v1.1 skill nodes plotted as a chain rising from a FAME hub at the bottom-center, with edges (solid gold for owned, dashed dark for locked). Right rail shows fame-to-spend + a static minimap + a single-cluster sidebar. Selected node opens a floating detail card with an "Acquire" button. All v1.1 skill-tree mechanics preserved (5-node linear chain, `buyNode` action, `canBuyNode` selector).

**Architecture:** New components in `src/components/constellation/` (`StarCanvas`, `NodeCard`, `MiniMap`, `ClusterList`). The 5 v1.1 nodes (goldsmith → patient_eye → second_slot → faster_strokes → better_brush) get a fixed 2D layout in `NODE_POSITIONS`. Selection state (`selectedNodeId: SkillNodeId | null`) lives in `ConstellationRoute` and is passed to `<StarCanvas>` (highlight) + `<NodeCard>` (detail). **No pan/zoom in v2.0** — 5 nodes fit comfortably in a single 600×600 viewBox; pan/zoom lands when a future wave grows the node count past one screen.

**Tech Stack:** React 19 + TypeScript strict + Vite + Vitest + RTL. CSS Modules + tokens.css. Inline SVG for the star canvas + minimap. `lucide-react` (already installed) is not needed for this round (the star map is pure SVG).

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Star canvas with nodes + edges | 1 |
| **B** | Selected-node detail card | 2 |
| **C** | Right rail panels (minimap + cluster list) | 3 |
| **D** | Wire ConstellationRoute layout + selection state | 4 |
| **E** | Verify + tag | 5 |

Each task: TDD cycle (test → fail → impl → pass → commit).

---

## Pre-flight checks (do once before Task 1)

- [ ] On `feat/v2-redesign`, working tree clean.
- [ ] HEAD at `f3dfa4d` (v2.0-round-3 tag).
- [ ] Baseline tests pass: `npm test` reports 442/442.

---

## Existing data shape (preserved)

`skillTreeSlice` from v1.1:
- `purchasedNodes: Partial<Record<SkillNodeId, true>>`
- `buyNode(id): boolean` — atomic spend + purchase

Selectors from `skillTreeSlice.ts`:
- `hasNode(state, id): boolean`
- `canBuyNode(state, id): boolean`

Config from `src/config/skillTreeNodes.ts`:
- `SKILL_NODES: ReadonlyArray<SkillNodeConfig>` — 5 nodes:

| id | name | cost (fame) | prereq |
|---|---|---|---|
| goldsmith | Goldsmith | 1 | null |
| patient_eye | Patient Eye | 3 | goldsmith |
| second_slot | Second Slot | 10 | patient_eye |
| faster_strokes | Faster Strokes | 30 | second_slot |
| better_brush | Better Brush | 100 | faster_strokes |

---

## Node layout (locked for this round)

Fixed 2D positions inside a 600×600 viewBox. FAME hub at bottom-center; chain rises diagonally to top-left.

```ts
// src/components/constellation/nodeLayout.ts
import type { SkillNodeId } from "@/config/skillTreeNodes";

export interface Point { x: number; y: number; }

export const FAME_HUB: Point = { x: 300, y: 510 };

export const NODE_POSITIONS: Record<SkillNodeId, Point> = {
  goldsmith:      { x: 200, y: 400 },
  patient_eye:    { x: 400, y: 400 },
  second_slot:    { x: 470, y: 290 },
  faster_strokes: { x: 360, y: 180 },
  better_brush:   { x: 250, y:  80 },
};

/**
 * Edges: from-id → to-id. Each edge is solid gold when its FROM-side node
 * is purchased (or, for the FAME-hub edge, always solid because the player
 * always "has" fame as the root). Otherwise dashed dark.
 *
 * "fame" is the synthetic root id; treat it as always purchased.
 */
export type EdgeFrom = SkillNodeId | "fame";

export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> = [
  { from: "fame",           to: "goldsmith" },
  { from: "goldsmith",      to: "patient_eye" },
  { from: "patient_eye",    to: "second_slot" },
  { from: "second_slot",    to: "faster_strokes" },
  { from: "faster_strokes", to: "better_brush" },
];
```

This file is part of Task 1's deliverables.

---

# Phase A — Star canvas with nodes + edges

---

### Task 1: `<StarCanvas>` — star-map background + 5 nodes + 5 edges

The big SVG holding the star-twinkle background, FAME hub, 5 skill nodes, and 5 connecting edges. Selection is driven by props (`selectedId`, `onSelect`) so `ConstellationRoute` owns selection state.

**Files:**
- Create: `src/components/constellation/nodeLayout.ts` (data only — no React)
- Create: `src/components/constellation/StarCanvas.tsx`
- Create: `src/components/constellation/StarCanvas.module.css`
- Create: `tests/components/constellation/StarCanvas.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// tests/components/constellation/StarCanvas.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarCanvas } from "@/components/constellation/StarCanvas";

const NODE_STATES = {
  goldsmith:      { owned: false, available: true,  affordable: true  },
  patient_eye:    { owned: false, available: false, affordable: false },
  second_slot:    { owned: false, available: false, affordable: false },
  faster_strokes: { owned: false, available: false, affordable: false },
  better_brush:   { owned: false, available: false, affordable: false },
} as const;

describe("<StarCanvas />", () => {
  it("renders an SVG", () => {
    const { container } = render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
    expect(screen.getByText("FAME")).toBeInTheDocument();
  });

  it("renders all 5 nodes by id", () => {
    render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("node-goldsmith")).toBeInTheDocument();
    expect(screen.getByTestId("node-patient_eye")).toBeInTheDocument();
    expect(screen.getByTestId("node-second_slot")).toBeInTheDocument();
    expect(screen.getByTestId("node-faster_strokes")).toBeInTheDocument();
    expect(screen.getByTestId("node-better_brush")).toBeInTheDocument();
  });

  it("renders 5 edges by from→to id pair", () => {
    render(
      <StarCanvas selectedId={null} onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("edge-fame-goldsmith")).toBeInTheDocument();
    expect(screen.getByTestId("edge-goldsmith-patient_eye")).toBeInTheDocument();
    expect(screen.getByTestId("edge-patient_eye-second_slot")).toBeInTheDocument();
    expect(screen.getByTestId("edge-second_slot-faster_strokes")).toBeInTheDocument();
    expect(screen.getByTestId("edge-faster_strokes-better_brush")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with that id", () => {
    const onSelect = vi.fn();
    render(
      <StarCanvas selectedId={null} onSelect={onSelect} nodeStates={NODE_STATES} />,
    );
    fireEvent.click(screen.getByTestId("node-goldsmith"));
    expect(onSelect).toHaveBeenCalledWith("goldsmith");
  });

  it("selected node has data-selected='true'", () => {
    render(
      <StarCanvas selectedId="goldsmith" onSelect={() => {}} nodeStates={NODE_STATES} />,
    );
    expect(screen.getByTestId("node-goldsmith")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("node-patient_eye")).not.toHaveAttribute("data-selected", "true");
  });

  it("owned node has data-state='owned'; locked has data-state='locked'; available has data-state='available'", () => {
    const states = {
      goldsmith:      { owned: true,  available: false, affordable: false },
      patient_eye:    { owned: false, available: true,  affordable: true  },
      second_slot:    { owned: false, available: false, affordable: false },
      faster_strokes: { owned: false, available: false, affordable: false },
      better_brush:   { owned: false, available: false, affordable: false },
    } as const;
    render(<StarCanvas selectedId={null} onSelect={() => {}} nodeStates={states} />);
    expect(screen.getByTestId("node-goldsmith")).toHaveAttribute("data-state", "owned");
    expect(screen.getByTestId("node-patient_eye")).toHaveAttribute("data-state", "available");
    expect(screen.getByTestId("node-second_slot")).toHaveAttribute("data-state", "locked");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/constellation/StarCanvas"`
Expected: FAIL.

- [ ] **Step 3: Create the layout data file**

`src/components/constellation/nodeLayout.ts`:

```ts
import type { SkillNodeId } from "@/config/skillTreeNodes";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const FAME_HUB: Point = { x: 300, y: 510 };

export const NODE_POSITIONS: Record<SkillNodeId, Point> = {
  goldsmith:      { x: 200, y: 400 },
  patient_eye:    { x: 400, y: 400 },
  second_slot:    { x: 470, y: 290 },
  faster_strokes: { x: 360, y: 180 },
  better_brush:   { x: 250, y:  80 },
};

export type EdgeFrom = SkillNodeId | "fame";

export const EDGES: ReadonlyArray<{ from: EdgeFrom; to: SkillNodeId }> = [
  { from: "fame",           to: "goldsmith" },
  { from: "goldsmith",      to: "patient_eye" },
  { from: "patient_eye",    to: "second_slot" },
  { from: "second_slot",    to: "faster_strokes" },
  { from: "faster_strokes", to: "better_brush" },
];

export const VIEWBOX = { width: 600, height: 600 };
```

- [ ] **Step 4: Create the component**

`src/components/constellation/StarCanvas.tsx`:

```tsx
import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { EDGES, FAME_HUB, NODE_POSITIONS, VIEWBOX, type EdgeFrom } from "./nodeLayout";
import styles from "./StarCanvas.module.css";

export interface NodeState {
  owned: boolean;
  available: boolean;     // prereqs met (regardless of fame affordability)
  affordable: boolean;
}

interface Props {
  selectedId: SkillNodeId | null;
  onSelect: (id: SkillNodeId) => void;
  nodeStates: Record<SkillNodeId, NodeState>;
}

const TWINKLES: ReadonlyArray<{ x: number; y: number; r: number; dur: string }> = [
  { x: 80,  y: 100, r: 1.5, dur: "2.5s" },
  { x: 540, y: 80,  r: 2,   dur: "3s"   },
  { x: 120, y: 240, r: 1,   dur: "3.5s" },
  { x: 460, y: 360, r: 1.5, dur: "2.8s" },
  { x: 520, y: 480, r: 2,   dur: "4s"   },
  { x: 80,  y: 470, r: 1,   dur: "3.2s" },
  { x: 280, y: 30,  r: 1.5, dur: "3.7s" },
];

function nodeStateOf(state: NodeState): "owned" | "available" | "locked" {
  if (state.owned) return "owned";
  if (state.available) return "available";
  return "locked";
}

function pointFor(id: EdgeFrom): { x: number; y: number } {
  if (id === "fame") return FAME_HUB;
  return NODE_POSITIONS[id];
}

/**
 * Star-map canvas: bg-0 + warm radial glow + 32px grid + 7 twinkling stars +
 * FAME hub + 5 skill nodes + 5 edges.
 *
 * Selection is prop-driven: parent owns `selectedId`, passes it in, and
 * gets `onSelect(id)` callbacks from node clicks.
 *
 * Node states (owned / available / locked) are computed by the parent
 * route (using the `hasNode` / `canBuyNode` selectors) and passed in via
 * `nodeStates`. This keeps the canvas presentational.
 */
export function StarCanvas({ selectedId, onSelect, nodeStates }: Props): JSX.Element {
  return (
    <div className={styles.canvas}>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="Constellation skill tree"
      >
        <defs>
          <pattern id="cs-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          <radialGradient id="cs-warm" cx="0.5" cy="1" r="0.6">
            <stop offset="0"   stopColor="rgba(255,216,106,0.06)" />
            <stop offset="0.4" stopColor="rgba(255,216,106,0.02)" />
            <stop offset="1"   stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Background layers */}
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="var(--bg-0)" />
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#cs-warm)" />
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#cs-grid)" />

        {/* Twinkling stars */}
        <g>
          {TWINKLES.map((t, idx) => (
            <circle key={idx} cx={t.x} cy={t.y} r={t.r} fill="#9b6cd6">
              <animate
                attributeName="opacity"
                values="0.2;0.9;0.2"
                dur={t.dur}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {/* Edges (drawn first so nodes overlap on top) */}
        <g>
          {EDGES.map(({ from, to }) => {
            const a = pointFor(from);
            const b = pointFor(to);
            const fromOwned = from === "fame" ? true : nodeStates[from].owned;
            return (
              <line
                key={`${from}-${to}`}
                data-testid={`edge-${from}-${to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={fromOwned ? "var(--gold)" : "var(--ink-line)"}
                strokeWidth={fromOwned ? 2 : 1.5}
                strokeDasharray={fromOwned ? undefined : "6 4"}
                opacity={fromOwned ? 0.85 : 0.55}
              />
            );
          })}
        </g>

        {/* FAME hub */}
        <g data-testid="fame-hub">
          <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="32" fill="rgba(255,216,106,0.12)" />
          <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="20" fill="var(--fame)" />
          <text
            x={FAME_HUB.x}
            y={FAME_HUB.y + 50}
            textAnchor="middle"
            fontFamily="serif"
            fontSize="14"
            fontWeight="700"
            letterSpacing="0.18em"
            fill="var(--fame)"
            style={{ filter: "drop-shadow(0 0 6px rgba(255,216,106,0.6))" }}
          >
            FAME
          </text>
        </g>

        {/* Skill nodes */}
        <g>
          {(Object.keys(NODE_POSITIONS) as SkillNodeId[]).map((id) => {
            const pos = NODE_POSITIONS[id];
            const state = nodeStates[id];
            const stateName = nodeStateOf(state);
            const isSelected = selectedId === id;
            const r = isSelected ? 14 : 11;

            return (
              <g
                key={id}
                data-testid={`node-${id}`}
                data-state={stateName}
                data-selected={isSelected ? "true" : undefined}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(id)}
              >
                {/* Halo for owned + selected states */}
                {(stateName === "owned" || isSelected) && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 8}
                    fill={isSelected ? "rgba(155,108,214,0.25)" : "rgba(255,216,106,0.18)"}
                  />
                )}
                {/* The node itself */}
                {stateName === "owned" ? (
                  <circle cx={pos.x} cy={pos.y} r={r} fill="var(--gold)" stroke="var(--gold-d)" strokeWidth="1.5" />
                ) : stateName === "available" ? (
                  <>
                    <circle cx={pos.x} cy={pos.y} r={r} fill="var(--bg-1)" stroke="var(--gold)" strokeWidth="2" />
                    {isSelected && (
                      <circle cx={pos.x} cy={pos.y} r={r * 0.45} fill="var(--inspi)" />
                    )}
                  </>
                ) : (
                  // locked
                  <circle cx={pos.x} cy={pos.y} r={r * 0.7} fill="var(--bg-2)" stroke="var(--ink-line)" strokeWidth="1" />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Create the CSS module**

`src/components/constellation/StarCanvas.module.css`:

```css
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--bg-0);
}

.svg {
  display: block;
  width: 100%;
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .svg :global(animate) {
    animation: none !important;
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- "components/constellation/StarCanvas"`
Expected: 7 passing.

- [ ] **Step 7: Run full suite**

Run: `npm test`
Expected: 442 + 7 = 449 passing.

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/constellation/nodeLayout.ts src/components/constellation/StarCanvas.tsx src/components/constellation/StarCanvas.module.css tests/components/constellation/StarCanvas.test.tsx
git commit -m "v2(constellation): add <StarCanvas> star-map with nodes + edges

Inline SVG: bg-0 + warm radial glow + 32px grid + 7 animated twinkles +
FAME hub (gold disc + halo + 'FAME' Cinzel label) + 5 skill nodes
laid out per nodeLayout.ts + 5 edges (solid gold from owned-side,
dashed ink-line from locked-side). Node states (owned/available/locked)
prop-driven via nodeStates record. Click → onSelect(id). Selected node
gets 14r + purple halo + (for available) inner inspi dot.
7 RTL tests cover SVG render, FAME hub, 5 nodes by id, 5 edges by
from-to pair, click selection, data-selected attr, data-state per
ownership."
```

---

# Phase B — Selected-node detail card

---

### Task 2: `<NodeCard>` — floating selected-node detail

A 240px floating card (top-right of the canvas area) showing the selected node's title, status meta, description, and Acquire button. Wired to `buyNode`.

**Files:**
- Create: `src/components/constellation/NodeCard.tsx`
- Create: `src/components/constellation/NodeCard.module.css`
- Create: `tests/components/constellation/NodeCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// tests/components/constellation/NodeCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeCard } from "@/components/constellation/NodeCard";

describe("<NodeCard />", () => {
  it("renders node name as title", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="+10% gold from canvas sales."
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: /Goldsmith/i })).toBeInTheDocument();
  });

  it("renders the description body", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="+10% gold from canvas sales."
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByText(/\+10% gold from canvas sales/i)).toBeInTheDocument();
  });

  it("renders the cost meta line", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={3}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByText(/3 fame/i)).toBeInTheDocument();
  });

  it("Acquire button is enabled when prereqMet + affordable + not owned", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /acquire/i })).not.toBeDisabled();
  });

  it("Acquire button is disabled when owned", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={true}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /acquired|owned/i })).toBeDisabled();
  });

  it("Acquire button is disabled when cannot afford", () => {
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={100}
        prereqMet={true}
        affordable={false}
        owned={false}
        description="x"
        onAcquire={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /acquire/i })).toBeDisabled();
  });

  it("clicking Acquire calls onAcquire", () => {
    const onAcquire = vi.fn();
    render(
      <NodeCard
        nodeId="goldsmith"
        name="Goldsmith"
        cost={1}
        prereqMet={true}
        affordable={true}
        owned={false}
        description="x"
        onAcquire={onAcquire}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /acquire/i }));
    expect(onAcquire).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/constellation/NodeCard"`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`src/components/constellation/NodeCard.tsx`:

```tsx
import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import styles from "./NodeCard.module.css";

interface Props {
  nodeId: SkillNodeId;
  name: string;
  cost: number;
  prereqMet: boolean;
  affordable: boolean;
  owned: boolean;
  description: string;
  onAcquire: () => void;
}

/**
 * Floating selected-node detail card. Shown when ConstellationRoute has a
 * selectedId set. Title (fame-tinted serif), meta line ("Tier · N fame ·
 * prereq met"), description, and full-width Acquire button.
 */
export function NodeCard({
  nodeId,
  name,
  cost,
  prereqMet,
  affordable,
  owned,
  description,
  onAcquire,
}: Props): JSX.Element {
  const canAcquire = prereqMet && affordable && !owned;

  let prereqText: string;
  if (owned) {
    prereqText = "owned ✓";
  } else if (prereqMet) {
    prereqText = "prereq met ✓";
  } else {
    prereqText = "prereq locked";
  }

  let buttonLabel: string;
  if (owned) {
    buttonLabel = "✦ Acquired";
  } else {
    buttonLabel = `✦ Acquire · ${cost} fame`;
  }

  return (
    <aside className={styles.card} aria-label={`Node detail · ${name}`} data-node-id={nodeId}>
      <h3 className={styles.title}>{name}</h3>
      <div className={styles.meta}>
        {cost} fame · {prereqText}
      </div>
      <p className={styles.description}>{description}</p>
      <button
        type="button"
        className={styles.acquireBtn}
        disabled={!canAcquire}
        onClick={canAcquire ? onAcquire : undefined}
        data-testid={`node-acquire-${nodeId}`}
      >
        {buttonLabel}
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/constellation/NodeCard.module.css`:

```css
.card {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-4);
  border: 2px solid var(--fame-d);
  border-radius: var(--r-md);
  background: var(--bg-1);
  box-shadow: var(--fame-glow), var(--shadow-card);
}

.title {
  margin: 0;
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--fame);
  text-shadow: var(--fame-glow);
}

.meta {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.description {
  margin: 0;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.5;
}

.acquireBtn {
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--bg-0);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--fame);
  border-radius: var(--r-sm);
  background: var(--fame);
  box-shadow: var(--fame-glow);
  transition: background-color 120ms ease;
}

.acquireBtn:hover:not(:disabled) {
  background: var(--fame-d);
}

.acquireBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--bg-2);
  color: var(--ink-3);
  border-color: var(--ink-line);
  box-shadow: none;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/constellation/NodeCard"`
Expected: 7 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 449 + 7 = 456 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/constellation/NodeCard.tsx src/components/constellation/NodeCard.module.css tests/components/constellation/NodeCard.test.tsx
git commit -m "v2(constellation): add <NodeCard> selected-node detail panel

240px fame-bordered + glow card. Title (fame Cinzel) + meta ('N fame ·
prereq met/locked/owned') + description + full-width Acquire button.
Button label: '✦ Acquire · N fame' or '✦ Acquired' (when owned);
disabled when owned OR cannot afford OR prereq unmet. 7 RTL tests."
```

---

# Phase C — Right rail panels

---

### Task 3: `<MiniMap>` + `<ClusterList>` — right-rail panels

Two panels in one task:
- `<MiniMap>` — small SVG showing the constellation shape from above; gold dots for owned, dim purple for locked, larger purple for selected. (Static viewport rect not needed in v2.0 since there's no pan/zoom.)
- `<ClusterList>` — single cluster only: "Starters · X/5". No fake clusters per v2.0 "pure adapt" rule.

**Files:**
- Create: `src/components/constellation/MiniMap.tsx`
- Create: `src/components/constellation/MiniMap.module.css`
- Create: `src/components/constellation/ClusterList.tsx`
- Create: `src/components/constellation/ClusterList.module.css`
- Create: `tests/components/constellation/MiniMap.test.tsx`
- Create: `tests/components/constellation/ClusterList.test.tsx`

- [ ] **Step 1: Write failing tests**

`tests/components/constellation/MiniMap.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiniMap } from "@/components/constellation/MiniMap";

const ALL_LOCKED = {
  goldsmith: false,
  patient_eye: false,
  second_slot: false,
  faster_strokes: false,
  better_brush: false,
} as const;

describe("<MiniMap />", () => {
  it("renders an SVG", () => {
    const { container } = render(<MiniMap ownedById={ALL_LOCKED} selectedId={null} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders 5 mini-nodes by data-testid='mini-node-{id}'", () => {
    render(<MiniMap ownedById={ALL_LOCKED} selectedId={null} />);
    expect(screen.getByTestId("mini-node-goldsmith")).toBeInTheDocument();
    expect(screen.getByTestId("mini-node-better_brush")).toBeInTheDocument();
  });

  it("owned node has data-state='owned'", () => {
    const owned = { ...ALL_LOCKED, goldsmith: true } as const;
    render(<MiniMap ownedById={owned} selectedId={null} />);
    expect(screen.getByTestId("mini-node-goldsmith")).toHaveAttribute("data-state", "owned");
  });

  it("selected node has data-selected='true'", () => {
    render(<MiniMap ownedById={ALL_LOCKED} selectedId="patient_eye" />);
    expect(screen.getByTestId("mini-node-patient_eye")).toHaveAttribute("data-selected", "true");
  });

  it("renders a caption with owned/total counts", () => {
    const owned = { ...ALL_LOCKED, goldsmith: true, patient_eye: true } as const;
    render(<MiniMap ownedById={owned} selectedId={null} />);
    expect(screen.getByText(/2 \/ 5 owned/i)).toBeInTheDocument();
  });
});
```

`tests/components/constellation/ClusterList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClusterList } from "@/components/constellation/ClusterList";

describe("<ClusterList />", () => {
  it("renders the Starters cluster heading", () => {
    render(<ClusterList ownedCount={0} totalCount={5} />);
    expect(screen.getByText(/Starters/i)).toBeInTheDocument();
  });

  it("shows owned/total ratio", () => {
    render(<ClusterList ownedCount={2} totalCount={5} />);
    expect(screen.getByText(/2 \/ 5/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/constellation/(MiniMap|ClusterList)"`
Expected: FAIL.

- [ ] **Step 3: Create `<MiniMap>`**

`src/components/constellation/MiniMap.tsx`:

```tsx
import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { FAME_HUB, NODE_POSITIONS, VIEWBOX } from "./nodeLayout";
import styles from "./MiniMap.module.css";

interface Props {
  ownedById: Record<SkillNodeId, boolean>;
  selectedId: SkillNodeId | null;
}

/**
 * Small SVG overview of the constellation. Same node positions as StarCanvas
 * but rendered at 1/4 scale. Owned nodes are gold dots; locked are dim
 * purple; selected gets a slightly larger purple ring. No edges drawn —
 * the shape alone reads.
 */
export function MiniMap({ ownedById, selectedId }: Props): JSX.Element {
  const ownedCount = Object.values(ownedById).filter(Boolean).length;
  const totalCount = SKILL_NODES.length;

  return (
    <section className={styles.panel} aria-label="Constellation mini-map">
      <div className={styles.subhead}>Mini-map</div>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="Constellation overview"
      >
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="var(--bg-stone-d)" />
        {/* FAME hub */}
        <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="8" fill="var(--fame)" opacity="0.8" />
        {/* Skill nodes */}
        {(Object.keys(NODE_POSITIONS) as SkillNodeId[]).map((id) => {
          const pos = NODE_POSITIONS[id];
          const owned = ownedById[id];
          const isSelected = selectedId === id;
          const fill = owned ? "var(--gold)" : "var(--inspi-d)";
          return (
            <g
              key={id}
              data-testid={`mini-node-${id}`}
              data-state={owned ? "owned" : "locked"}
              data-selected={isSelected ? "true" : undefined}
            >
              {isSelected && <circle cx={pos.x} cy={pos.y} r="14" fill="rgba(155,108,214,0.4)" />}
              <circle cx={pos.x} cy={pos.y} r={isSelected ? 8 : 6} fill={fill} opacity={owned ? 1 : 0.55} />
            </g>
          );
        })}
      </svg>
      <div className={styles.caption}>
        {ownedCount} / {totalCount} owned · zoom out for more
      </div>
    </section>
  );
}
```

`src/components/constellation/MiniMap.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-4);
  border: var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--bg-1);
}

.subhead {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.svg {
  width: 100%;
  height: 160px;
  border-radius: var(--r-sm);
  background: var(--bg-stone-d);
}

.caption {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}
```

- [ ] **Step 4: Create `<ClusterList>`**

`src/components/constellation/ClusterList.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./ClusterList.module.css";

interface Props {
  ownedCount: number;
  totalCount: number;
}

/**
 * Right-rail cluster sidebar. v2.0 ships with one cluster only — "Starters"
 * (the 5 v1.1 nodes). Future waves add real clusters as new branches ship.
 * No fake placeholder clusters per v2.0 "pure adapt" rule.
 */
export function ClusterList({ ownedCount, totalCount }: Props): JSX.Element {
  return (
    <section className={styles.panel} aria-label="Clusters">
      <div className={styles.subhead}>Jump to cluster</div>
      <ul className={styles.list}>
        <li className={styles.row}>
          <span className={styles.name}>Starters</span>
          <span className={styles.count}>
            {ownedCount} / {totalCount}
          </span>
        </li>
      </ul>
    </section>
  );
}
```

`src/components/constellation/ClusterList.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-4);
  border: var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--bg-1);
}

.subhead {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
}

.name {
  font-family: var(--mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-1);
}

.count {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-3);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/constellation/(MiniMap|ClusterList)"`
Expected: 5 + 2 = 7 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 456 + 7 = 463 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/constellation/MiniMap.tsx src/components/constellation/MiniMap.module.css src/components/constellation/ClusterList.tsx src/components/constellation/ClusterList.module.css tests/components/constellation/MiniMap.test.tsx tests/components/constellation/ClusterList.test.tsx
git commit -m "v2(constellation): add <MiniMap> + <ClusterList>

MiniMap — small SVG overview of the same 5-node layout used by StarCanvas
(scaled to 160px height). Owned = gold dots, locked = dim purple, selected
gets a halo. Caption shows N/5 owned. No viewport rect (no pan/zoom in v2.0).
ClusterList — single 'Starters · N/5' row. No fake clusters per v2.0 'pure
adapt' rule.
7 RTL tests cover SVG presence, mini-node testids, owned/selected states,
caption ratios, cluster heading + ratio."
```

---

# Phase D — Wire ConstellationRoute layout + selection state

---

### Task 4: Replace ConstellationRoute with new layout + selection state

Rewrite `ConstellationRoute.tsx` with the handoff's CSS Grid layout (`1fr 280px`), mount the 4 new components, and own the selection state. Compute per-node states (owned/available/locked) using existing `hasNode` + `canBuyNode` selectors.

**Files:**
- Modify: `src/routes/ConstellationRoute.tsx` (full rewrite)
- Create: `src/routes/ConstellationRoute.module.css`
- Create: `tests/routes/ConstellationRoute.test.tsx` (file may not exist yet)

- [ ] **Step 1: Write failing tests**

```tsx
// tests/routes/ConstellationRoute.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConstellationRoute } from "@/routes/ConstellationRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderConstellationRoute() {
  return render(
    <MemoryRouter>
      <ConstellationRoute />
    </MemoryRouter>,
  );
}

describe("ConstellationRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.setState({
      fame: big(0),
      purchasedNodes: {},
    });
  });

  it("renders the star canvas SVG", () => {
    const { container } = renderConstellationRoute();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    renderConstellationRoute();
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
  });

  it("renders all 5 skill nodes in the canvas", () => {
    renderConstellationRoute();
    expect(screen.getByTestId("node-goldsmith")).toBeInTheDocument();
    expect(screen.getByTestId("node-better_brush")).toBeInTheDocument();
  });

  it("renders the right-rail Mini-map and ClusterList", () => {
    renderConstellationRoute();
    expect(screen.getByText(/Mini-map/i)).toBeInTheDocument();
    expect(screen.getByText(/Starters/i)).toBeInTheDocument();
  });

  it("clicking a skill node opens the NodeCard with that node's name", () => {
    renderConstellationRoute();
    fireEvent.click(screen.getByTestId("node-goldsmith"));
    // Goldsmith name should appear in the card heading.
    expect(screen.getByRole("heading", { name: /Goldsmith/i })).toBeInTheDocument();
  });

  it("clicking Acquire on a selected affordable node calls buyNode", () => {
    useGameStore.setState({ fame: big(10) });
    renderConstellationRoute();
    fireEvent.click(screen.getByTestId("node-goldsmith"));
    fireEvent.click(screen.getByTestId("node-acquire-goldsmith"));
    expect(useGameStore.getState().purchasedNodes.goldsmith).toBe(true);
  });

  it("renders the Fame to spend display in the right rail", () => {
    useGameStore.setState({ fame: big(12) });
    renderConstellationRoute();
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText(/Fame to spend/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "routes/ConstellationRoute"`
Expected: FAIL — old route doesn't have the new elements.

- [ ] **Step 3: Replace `src/routes/ConstellationRoute.tsx`**

```tsx
import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { hasNode, canBuyNode } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";
import { NodeCard } from "@/components/constellation/NodeCard";
import { MiniMap } from "@/components/constellation/MiniMap";
import { ClusterList } from "@/components/constellation/ClusterList";
import styles from "./ConstellationRoute.module.css";

const EFFECT_DESCRIPTIONS: Record<SkillNodeId, string> = {
  goldsmith: "+10% gold from canvas sales.",
  patient_eye: "+15% inspiration generation rate.",
  second_slot: "Workshop equipment slots: 1 → 2.",
  faster_strokes: "Ascend palier reduced 10%.",
  better_brush: "+1 magnitude on workshop item affixes (e.g. 5–15% → 6–16%).",
};

export function ConstellationRoute(): JSX.Element {
  const fame = useGameStore((s) => s.fame);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyNode = useGameStore((s) => s.buyNode);

  const [selectedId, setSelectedId] = useState<SkillNodeId | null>(null);

  // Compute per-node states (owned / available / locked) using existing selectors.
  const helperState = { fame, purchasedNodes } as unknown as GameStore;
  const nodeStates = SKILL_NODES.reduce(
    (acc, node) => {
      const owned = hasNode(helperState, node.id);
      const prereqMet = node.prereq === null || hasNode(helperState, node.prereq);
      const affordable = fame.gte(big(node.cost));
      acc[node.id] = { owned, available: prereqMet, affordable };
      return acc;
    },
    {} as Record<SkillNodeId, NodeState>,
  );

  const ownedById = SKILL_NODES.reduce(
    (acc, node) => {
      acc[node.id] = nodeStates[node.id].owned;
      return acc;
    },
    {} as Record<SkillNodeId, boolean>,
  );

  const ownedCount = Object.values(ownedById).filter(Boolean).length;

  const selectedNode = selectedId !== null
    ? SKILL_NODES.find((n) => n.id === selectedId)
    : null;
  const selectedState = selectedId !== null ? nodeStates[selectedId] : null;

  return (
    <div className={styles.layout}>
      <div className={styles.canvasArea}>
        <StarCanvas
          selectedId={selectedId}
          onSelect={setSelectedId}
          nodeStates={nodeStates}
        />
        {selectedNode && selectedState && (
          <div className={styles.cardSlot}>
            <NodeCard
              nodeId={selectedNode.id}
              name={selectedNode.name}
              cost={selectedNode.cost}
              prereqMet={selectedState.available}
              affordable={selectedState.affordable}
              owned={selectedState.owned}
              description={EFFECT_DESCRIPTIONS[selectedNode.id]}
              onAcquire={() => {
                if (canBuyNode(helperState, selectedNode.id)) {
                  buyNode(selectedNode.id);
                }
              }}
            />
          </div>
        )}
      </div>

      <aside className={styles.rail}>
        <section className={styles.fameDisplay} aria-label="Fame to spend">
          <div className={styles.fameLabel}>Fame to spend</div>
          <div className={styles.fameValue}>{formatBig(fame)}</div>
        </section>
        <MiniMap ownedById={ownedById} selectedId={selectedId} />
        <ClusterList ownedCount={ownedCount} totalCount={SKILL_NODES.length} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/routes/ConstellationRoute.module.css`**

```css
.layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--s-5);
  height: 100%;
  padding: var(--s-5);
}

.canvasArea {
  position: relative;
  min-height: 480px;
}

.cardSlot {
  position: absolute;
  top: var(--s-4);
  right: var(--s-4);
  z-index: 1;
}

.rail {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  overflow-y: auto;
}

.fameDisplay {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  padding: var(--s-4);
  border: 2px solid var(--fame-d);
  border-radius: var(--r-md);
  background: var(--bg-1);
  box-shadow: var(--fame-glow);
  text-align: center;
}

.fameLabel {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.fameValue {
  font-family: var(--serif);
  font-size: 42px;
  font-weight: 700;
  color: var(--fame);
  text-shadow: var(--fame-glow);
  line-height: 1;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "routes/ConstellationRoute"`
Expected: 7 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 463 + 7 = 470 passing (some old tests may need updates if they referenced the old list-based UI; check failures).

If any pre-existing tests fail, investigate. Likely candidate: tests that asserted the old "Buy" button label or list structure. Update them OR delete them (the new component tests cover the same behaviors).

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean (or only pre-existing main.tsx warning).

- [ ] **Step 8: Commit**

```bash
git add src/routes/ConstellationRoute.tsx src/routes/ConstellationRoute.module.css tests/routes/ConstellationRoute.test.tsx
git commit -m "v2(constellation): rebuild ConstellationRoute with new layout

CSS Grid 1fr 280px (canvas + right rail). Selection state owned at the
route level (selectedId: SkillNodeId | null). nodeStates record computed
from hasNode + canBuyNode selectors, passed to StarCanvas + NodeCard.
NodeCard floats top-right of the canvas when a node is selected.
Right rail: 42px serif Fame to spend display + MiniMap + ClusterList.
v1.1 mechanics preserved (5-node linear chain, buyNode action).
7 RTL tests cover canvas + FAME hub + nodes + rail panels + click
selection + Acquire flow + fame display."
```

---

# Phase E — Verify + tag

---

### Task 5: Final verify + smoke + HANDOVER + checkpoint tag

This task does NOT make code changes (except HANDOVER). Verification gate before declaring Round 4 complete.

**IMPORTANT:** Do NOT push, do NOT merge. Local-only branch + tag.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Capture exact pass count. Expected: ~470.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Capture gzipped sizes. Expected: still under 250 KB.

- [ ] **Step 4: Smoke check via curl**

```bash
npm run preview &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/ 2>&1 | tail -1
kill %1 2>/dev/null || true
```

Expected: HTTP 200.

- [ ] **Step 5: Update `docs/HANDOVER.md`**

Open `docs/HANDOVER.md`. Find the v2.0 Round 3 section. Add a NEW sub-section ABOVE it (newest-first):

```markdown
## v2.0 Round 4 — Constellation route (in progress on `feat/v2-redesign`)

**Status:** Round 4 complete. Polish pass + v2.0 tag pending.

### What landed

- New `src/components/constellation/` directory:
  - `<StarCanvas>` — bg-0 + warm radial glow + 32px grid + 7 animated star twinkles + FAME hub (gold disc + halo + Cinzel "FAME" label) + 5 skill nodes laid out per `nodeLayout.ts` + 5 edges. Click → onSelect callback. Selected node gets purple halo + (for available) inner inspi dot.
  - `<NodeCard>` — 240px fame-bordered + glow card. Shown when ConstellationRoute has a selectedId. Title (fame Cinzel) + meta + description + Acquire button.
  - `<MiniMap>` — small SVG overview using same node positions, scaled. Caption shows N/5 owned. (No viewport rect — no pan/zoom in v2.0.)
  - `<ClusterList>` — single "Starters · N/5" row. No fake clusters per "pure adapt" rule.
  - `nodeLayout.ts` — fixed 2D positions for the 5 nodes + 5 edges. The data layer the 2 SVG components share.
- `src/routes/ConstellationRoute.tsx` rebuilt: CSS Grid `1fr 280px` (canvas + right rail). Selection state at the route. Right rail panels: 42px-serif Fame to spend display + MiniMap + ClusterList.

### Visual deviations from handoff (per v2.0 "pure adapt" rule)

- 5 nodes only (v1.1's Goldsmith / Patient Eye / Second Slot / Faster Strokes / Better Brush). No fake locked future-nodes.
- 1 cluster only ("Starters"). No fake clusters in the cluster list.
- No pan/zoom interaction. With 5 nodes the entire chain fits in a single 600×600 viewBox; pan/zoom lands when a future wave grows the node count past one screen.

### Visual state

- All 4 routes — Tree (R1) + Painting (R2) + Ascension (R3) + Constellation (R4) — now match handoff aesthetic.

### Tests + build

- {NN} tests passing.
- tsc clean. Lint clean.
- Bundle: {NN} KB gzipped JS / {NN} KB gzipped CSS / ~{NN} KB total.

### Next

Polish round (animations + reduced-motion + final HANDOVER + v2.0 tag), then v2.0 ships.
```

Replace `{NN}` placeholders with actual values.

- [ ] **Step 6: Commit + tag checkpoint**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): v2.0 Round 4 (Constellation) complete on branch"
git tag -a v2.0-round-4 -m "v2.0 Round 4 — Constellation route complete"
```

DO NOT push.

- [ ] **Step 7: Report**

- Status: DONE
- Test count
- Bundle sizes
- HEAD SHA + Tag SHA
- Smoke curl result

## Spec coverage check (self-review of this plan)

| Spec section (v2.0 design) | Task |
|---|---|
| §8 Round 4 — StarCanvas (bg + grid + twinkles + nodes + edges) | Task 1 |
| §8 Round 4 — 5 v1.1 nodes plotted | Task 1 (via nodeLayout.ts) |
| §8 Round 4 — Connection edges (solid gold owned, dashed locked) | Task 1 |
| §8 Round 4 — Node states (owned / available / selected / locked) | Task 1 |
| §8 Round 4 — NodeCard floating top-right | Task 2 + Task 4 layout |
| §8 Round 4 — Acquire button → buyNode | Task 2 + Task 4 |
| §8 Round 4 — Fame-to-spend display | Task 4 (in-route) |
| §8 Round 4 — MiniMap | Task 3 |
| §8 Round 4 — ClusterList ("Starters · X/5") | Task 3 |
| §4 deviation #5 — 5 nodes only, no fake locked future-nodes | Task 1 + Task 4 |
| §4 deviation — pan/zoom deferred (no v2.0 need) | Task 1 (no interaction code) |

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders.
- ✅ Test code given for every TDD step; impl code given for every implementation step.
- ✅ Type signatures consistent: `NodeState` interface in T1, used by T4. `Point` and `EdgeFrom` in nodeLayout.ts shared by StarCanvas + MiniMap.
- ✅ Test count math: 442 baseline + 7 (T1) + 7 (T2) + 5+2 (T3) + 7 (T4) = +28; possibly minus a few from old ConstellationRoute tests — net ~+25-28. End count ~467-470.
- ✅ Each task is bite-sized.

---

**End of plan.**
