# v2.0 Round 3 — Ascension Route Visual Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `AscensionRoute` with the handoff's visual language: cavern background with floating crystals, animated stone-arch portal in the center, right rail with threshold panel + fame preview + past runs ledger. Adds a small data field — `pastRuns: ReadonlyArray<PastRun>` on `metaSlice` — and a v6→v7 save migration so the ledger has real history. All existing v1.1 ascend mechanics preserved (palier, fame conversion, run reset).

**Architecture:** New components in `src/components/ascension/` (`Cavern`, `Portal`, `ThresholdPanel`, `FamePreviewCard`, `PastRunsLedger`). `AscensionRoute.tsx` becomes a layout coordinator: CSS Grid `1fr 360px` (cavern + right rail). The "Step Through" button shows an inline confirmation overlay before calling `performAscend`. `performAscendOrchestrator` records the ascend into the new `pastRuns` array.

**Tech Stack:** React 19 + TypeScript strict + Vite + Vitest + RTL. CSS Modules + tokens.css. Inline SVG for portal + crystals. Save migration v6 → v7.

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Data layer: pastRuns + migration | 1 |
| **B** | Scene components (cavern + portal) | 2, 3 |
| **C** | Right rail panels | 4 |
| **D** | Wire AscensionRoute (with confirm modal) | 5 |
| **E** | Verify + tag | 6 |

Each task: TDD cycle (test → fail → impl → pass → commit).

---

## Pre-flight checks (do once before Task 1)

- [ ] On `feat/v2-redesign`, working tree clean.
- [ ] HEAD at `7ab44c8` (v2.0-round-2 tag).
- [ ] Baseline tests pass: `npm test` reports 411/411.

---

## Existing data shape (preserved)

`metaSlice` from v1.1:
- `playerId: string` (UUID)
- `ascendCount: number` (default 0, incremented on each ascend)
- `incrementAscendCount()`, `_setPlayerId(id)`, `performAscend(): boolean`

`systems/ascend.ts`:
- `getEffectivePalier(state, count): Big` — palier × (1 - faster_strokes_reduction)
- `canAscend(state): boolean` — `inspiration.gte(palier)`
- `performAscendOrchestrator(set, get): boolean` — captures fame, resets gold/inspi/tree/canvas/workshop, credits fame, bumps ascendCount

`balance.ts`:
- `palierAscend(count): Big`
- `fameOnAscend(inspi: Big): number`

---

# Phase A — Data layer

---

### Task 1: Add `pastRuns` to metaSlice + migration v6→v7

Add a small history-tracking field that the orchestrator updates per ascend, plus a save migration so existing v6 saves get an empty `pastRuns: []` default.

**Files:**
- Modify: `src/store/metaSlice.ts` (add `pastRuns` state + `addPastRun` action)
- Modify: `src/systems/ascend.ts` (call `addPastRun` from orchestrator after a successful ascend)
- Modify: `src/store/index.ts` (bump SAVE_VERSION 6→7 + add v6→v7 migration)
- Modify: `tests/store/metaSlice.test.ts` (new tests for pastRuns)
- Modify: `tests/systems/ascend.test.ts` (assert pastRuns appended on ascend)
- Modify: `tests/store/persistence-integration.test.ts` (v6→v7 migration tests)

- [ ] **Step 1: Write the failing tests for pastRuns + migration**

Append to `tests/store/persistence-integration.test.ts` (find a good spot; the file already has earlier migration `describe` blocks):

```ts
describe("save migration v6 → v7 (add pastRuns)", () => {
  it("v6 save (no pastRuns) gets default empty array on migrate", () => {
    const v6State = {
      gold: { __big: "0" },
      inspiration: { __big: "0" },
      fame: { __big: "0" },
      ascendCount: 1,
      playerId: "test-id-v6",
      canvasTier: 1,
      paintMastery: { __big: "0" },
      lifetimeGold: { __big: "0" },
    };
    const migrated = migrate(v6State, 6) as unknown as Record<string, unknown>;
    expect(Array.isArray(migrated.pastRuns)).toBe(true);
    expect(migrated.pastRuns).toEqual([]);
    // playerId preserved.
    expect(migrated.playerId).toBe("test-id-v6");
  });

  it("full chain v1 → v7 produces all defaults including pastRuns", () => {
    const v1State = {
      gold: { __big: "0" },
      inventory: [],
      equippedItems: [],
      playerId: "v1-test",
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((migrated.lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
    expect(migrated.pastRuns).toEqual([]);
  });
});
```

Append to `tests/store/metaSlice.test.ts`:

```ts
describe("metaSlice — pastRuns (v2.0 Round 3)", () => {
  beforeEach(() => {
    // Reset pastRuns by force-setting to [].
    useGameStore.setState({ pastRuns: [] });
  });

  it("initial pastRuns is an empty array", () => {
    expect(useGameStore.getState().pastRuns).toEqual([]);
  });

  it("addPastRun appends a new entry with fame and ascendedAt", () => {
    useGameStore.getState().addPastRun({ fame: 12, ascendedAt: 1234567890 });
    const runs = useGameStore.getState().pastRuns;
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual({ fame: 12, ascendedAt: 1234567890 });
  });

  it("addPastRun preserves prior entries (chronological append)", () => {
    useGameStore.getState().addPastRun({ fame: 1, ascendedAt: 1 });
    useGameStore.getState().addPastRun({ fame: 2, ascendedAt: 2 });
    useGameStore.getState().addPastRun({ fame: 3, ascendedAt: 3 });
    expect(useGameStore.getState().pastRuns).toHaveLength(3);
    expect(useGameStore.getState().pastRuns[2].fame).toBe(3);
  });
});
```

Append to `tests/systems/ascend.test.ts`:

```ts
describe("performAscendOrchestrator — pastRuns ledger (v2.0 Round 3)", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.setState({ ascendCount: 0, fame: big(0), pastRuns: [] });
  });

  it("appends a pastRun entry on successful ascend with the captured fame gain", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    const before = useGameStore.getState().pastRuns.length;
    const ok = useGameStore.getState().performAscend();
    expect(ok).toBe(true);
    const runs = useGameStore.getState().pastRuns;
    expect(runs.length).toBe(before + 1);
    expect(runs[runs.length - 1].fame).toBeGreaterThan(0);
    expect(typeof runs[runs.length - 1].ascendedAt).toBe("number");
  });

  it("does NOT append on failed ascend (below palier)", () => {
    useGameStore.setState({ inspiration: big(0) });
    const before = useGameStore.getState().pastRuns.length;
    const ok = useGameStore.getState().performAscend();
    expect(ok).toBe(false);
    expect(useGameStore.getState().pastRuns.length).toBe(before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "persistence-integration|metaSlice|systems/ascend"`
Expected: FAIL — `pastRuns` and `addPastRun` don't exist; orchestrator doesn't append.

- [ ] **Step 3: Update `src/store/metaSlice.ts`**

Read the current file (small, ~30 lines). Add `pastRuns` to state and `addPastRun` action. Replace the file with:

```ts
import type { StateCreator } from "zustand";
import { newPlayerId } from "@/core/playerId";
import { performAscendOrchestrator } from "@/systems/ascend";
import type { GameStore } from "@/store";

export interface PastRun {
  /** Fame gained on this ascend. */
  readonly fame: number;
  /** Date.now() at the moment the orchestrator captured the ascend. */
  readonly ascendedAt: number;
}

export interface MetaSlice {
  playerId: string;
  ascendCount: number;
  /**
   * Append-only chronological log of past ascends. Persists across reloads.
   * Populated by the ascend orchestrator (`performAscendOrchestrator`).
   * UI-only consumer is the AscensionRoute's PastRunsLedger panel.
   */
  pastRuns: ReadonlyArray<PastRun>;

  /** Bumped on each successful ascend. */
  incrementAscendCount: () => void;
  /** Append a single past run entry. Called by the orchestrator. */
  addPastRun: (run: PastRun) => void;
  /** Test/debug helper — overwrite the playerId. Not used in production. */
  _setPlayerId: (id: string) => void;
  /**
   * Atomic ascend. Validates via canAscend(state); if true, runs the orchestrator
   * (resets gold/inspi/tree/canvas/workshop, credits fame, increments ascendCount,
   * appends a pastRun entry). Returns true on success; false if canAscend is false.
   */
  performAscend: () => boolean;
}

export const createMetaSlice: StateCreator<GameStore, [], [], MetaSlice> = (set, get) => ({
  playerId: newPlayerId(),
  ascendCount: 0,
  pastRuns: [],

  incrementAscendCount: () => set((s) => ({ ascendCount: s.ascendCount + 1 })),
  addPastRun: (run) =>
    set((s) => ({ pastRuns: [...s.pastRuns, run] as ReadonlyArray<PastRun> })),
  _setPlayerId: (id) => set({ playerId: id }),
  performAscend: () => performAscendOrchestrator(set, get),
});
```

- [ ] **Step 4: Update `src/systems/ascend.ts`** — orchestrator appends pastRun

Read the current file. After Step 4 (`state.incrementAscendCount()`), add a new step 5 to append to pastRuns:

Replace the orchestrator function with:

```ts
export const performAscendOrchestrator = (
  set: StoreApi<GameStore>["setState"],
  get: StoreApi<GameStore>["getState"],
): boolean => {
  const state = get();
  if (!canAscend(state)) return false;

  // 1. Capture fame gain BEFORE inspiration is reset.
  const fameGain = fameOnAscend(state.inspiration);

  // 2. Reset run state via existing slice actions.
  state.resetRunCurrencies();
  state.resetTree();
  state.resetCanvas();
  state.resetWorkshop();

  // 3. Credit fame (after reset; fame survived resetRunCurrencies).
  if (fameGain > 0) {
    state.add("fame", big(fameGain));
  }

  // 4. Bump ascendCount.
  state.incrementAscendCount();

  // 5. Append to past-runs ledger (v2.0 Round 3).
  state.addPastRun({ fame: fameGain, ascendedAt: Date.now() });

  // `set` parameter retained for future cross-slice writes.
  void set;

  return true;
};
```

(Keep the existing `getEffectivePalier`, `canAscend`, and imports unchanged — only the orchestrator body changes.)

- [ ] **Step 5: Update `src/store/index.ts`** — bump SAVE_VERSION + add v6→v7 migration

Read the file. Make these changes:
1. Bump the constant: `const SAVE_VERSION = 7;` (was 6).
2. Add the new migration block in the `migrate` function, after the existing `if (fromVersion < 6)` block:

```ts
  if (fromVersion < 7) {
    // v6 → v7 (2026-05-04): v2.0 Round 3 adds pastRuns ledger to metaSlice.
    state = {
      ...state,
      pastRuns: [],
    };
  }
```

3. Update the JSDoc above `migrate` to mention the new step.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: 411 + 3 (metaSlice) + 2 (orchestrator) + 2 (migration) = 418 passing.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "store(meta): add pastRuns ledger; SAVE_VERSION 6→7

v2.0 Round 3 needs a short history of past ascends for the AscensionRoute's
PastRunsLedger panel. metaSlice gains:
  - pastRuns: ReadonlyArray<PastRun> (default [])
  - addPastRun(run) action (orchestrator-only consumer)

performAscendOrchestrator now appends one PastRun entry on each successful
ascend (after the existing fame credit + ascendCount bump). Captures
{ fame: fameGain, ascendedAt: Date.now() }.

SAVE_VERSION bumped 6→7. v6→v7 migration adds default pastRuns:[] to
existing saves. 7 new tests across persistence-integration, metaSlice,
and ascend systems."
```

---

# Phase B — Scene components

---

### Task 2: `<Cavern>` — radial bg + stone-block grid + 5 floating crystals

The atmospheric backdrop. CSS gradient + repeating-linear-gradient for the stone pattern + 5 inline SVG crystals (purple diamond clip-path, animated opacity pulse staggered 3s).

**Files:**
- Create: `src/components/ascension/Cavern.tsx`
- Create: `src/components/ascension/Cavern.module.css`
- Create: `tests/components/ascension/Cavern.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/ascension/Cavern.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cavern } from "@/components/ascension/Cavern";

describe("<Cavern />", () => {
  it("renders the cavern container", () => {
    const { container } = render(<Cavern />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders 5 crystals", () => {
    const { container } = render(<Cavern />);
    const crystals = container.querySelectorAll('[data-testid^="crystal-"]');
    expect(crystals).toHaveLength(5);
  });

  it("each crystal has data-testid='crystal-{N}'", () => {
    render(<Cavern />);
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`crystal-${i}`)).toBeInTheDocument();
    }
  });

  it("renders children inside the cavern", () => {
    render(
      <Cavern>
        <div data-testid="cavern-child">child</div>
      </Cavern>,
    );
    expect(screen.getByTestId("cavern-child")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/ascension/Cavern"`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

`src/components/ascension/Cavern.tsx`:

```tsx
import type { JSX, ReactNode } from "react";
import styles from "./Cavern.module.css";

interface Props {
  children?: ReactNode;
}

const CRYSTAL_POSITIONS: ReadonlyArray<{ top: string; left: string; delay: string; size: number }> = [
  { top: "12%", left: "8%",  delay: "0s",   size: 18 },
  { top: "20%", left: "82%", delay: "0.6s", size: 14 },
  { top: "50%", left: "5%",  delay: "1.2s", size: 22 },
  { top: "70%", left: "78%", delay: "1.8s", size: 16 },
  { top: "85%", left: "20%", delay: "2.4s", size: 12 },
];

/**
 * Cavern backdrop for the AscensionRoute. Radial violet→black gradient +
 * repeating stone-block grid pattern + 5 floating purple-diamond crystals
 * (CSS clip-path) with staggered 3s opacity pulse animations.
 *
 * Children render inside the cavern (typically the Portal + overlays).
 */
export function Cavern({ children }: Props): JSX.Element {
  return (
    <div className={styles.cavern} aria-hidden="false">
      {CRYSTAL_POSITIONS.map((pos, idx) => (
        <div
          key={idx}
          className={styles.crystal}
          data-testid={`crystal-${idx}`}
          style={{
            top: pos.top,
            left: pos.left,
            width: `${pos.size}px`,
            height: `${pos.size * 1.4}px`,
            animationDelay: pos.delay,
          }}
        />
      ))}
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/ascension/Cavern.module.css`:

```css
.cavern {
  position: relative;
  height: 100%;
  width: 100%;
  border-radius: var(--r-md);
  overflow: hidden;
  background:
    radial-gradient(ellipse at center, rgba(74, 40, 110, 0.6) 0%, var(--bg-stone-d) 75%),
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 13px,
      rgba(255, 255, 255, 0.02) 13px,
      rgba(255, 255, 255, 0.02) 14px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 27px,
      rgba(255, 255, 255, 0.02) 27px,
      rgba(255, 255, 255, 0.02) 28px
    ),
    var(--bg-stone-d);
}

@keyframes crystal-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}

.crystal {
  position: absolute;
  background: var(--inspi);
  clip-path: polygon(50% 0%, 100% 30%, 80% 100%, 20% 100%, 0% 30%);
  filter: drop-shadow(0 0 6px rgba(155, 108, 214, 0.6));
  animation: crystal-pulse 3s ease-in-out infinite;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .crystal {
    animation: none;
    opacity: 0.7;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/ascension/Cavern"`
Expected: 4 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 418 + 4 = 422 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/ascension/Cavern.tsx src/components/ascension/Cavern.module.css tests/components/ascension/Cavern.test.tsx
git commit -m "v2(ascension): add <Cavern> backdrop with floating crystals

Radial violet→black gradient + repeating stone-block grid pattern.
5 purple diamond crystals (CSS clip-path) with staggered 3s opacity
pulse (delays 0/0.6/1.2/1.8/2.4s). Reduced-motion fallback freezes
the pulse at opacity 0.7. Children render inside (typically Portal
+ overlays). 4 RTL tests cover container + 5 crystal data-testids +
children passthrough."
```

---

### Task 3: `<Portal>` — animated stone arch

The centerpiece. Inline SVG: outer arch (bricked stone gradient + thin dark joints), inner glowing radial gradient, keystone with gold ✦ rune, 6 purple runes flanking left/right. Animated `float` (translateY ±6px, 6s ease) + `shimmer` (drop-shadow brightness pulse, 4s).

**Files:**
- Create: `src/components/ascension/Portal.tsx`
- Create: `src/components/ascension/Portal.module.css`
- Create: `tests/components/ascension/Portal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/ascension/Portal.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Portal } from "@/components/ascension/Portal";

describe("<Portal />", () => {
  it("renders the portal SVG", () => {
    const { container } = render(<Portal />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the keystone rune", () => {
    const { container } = render(<Portal />);
    expect(container.querySelector('[data-testid="portal-keystone"]')).toBeInTheDocument();
  });

  it("renders 6 flanking runes", () => {
    const { container } = render(<Portal />);
    const runes = container.querySelectorAll('[data-testid="portal-rune"]');
    expect(runes).toHaveLength(6);
  });

  it("renders the inner glow gradient circle", () => {
    const { container } = render(<Portal />);
    expect(container.querySelector('[data-testid="portal-glow"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/ascension/Portal"`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`src/components/ascension/Portal.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./Portal.module.css";

/**
 * Animated stone-arch portal. ~380px wide on a typical screen (sized by parent).
 * Outer arch: bricked stone gradient + thin dark joint lines.
 * Inside: radial lavender→violet→black glow + keystone with gold ✦ rune.
 * 6 purple runes flank L/R (3 each). Whole block animates `float` (±6px Y, 6s
 * ease) + `shimmer` (drop-shadow pulse, 4s ease).
 */
export function Portal(): JSX.Element {
  // Position the 6 flanking runes (3 left, 3 right of the arch).
  const RUNES: ReadonlyArray<{ x: number; y: number }> = [
    { x: 30,  y: 100 },
    { x: 30,  y: 170 },
    { x: 30,  y: 240 },
    { x: 350, y: 100 },
    { x: 350, y: 170 },
    { x: 350, y: 240 },
  ];

  return (
    <div className={styles.portalWrap}>
      <svg
        viewBox="0 0 380 360"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.portal}
        aria-label="Stone arch portal"
      >
        <defs>
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a2855" />
            <stop offset="1" stopColor="#2a1238" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0"   stopColor="#c9b8ff" />
            <stop offset="0.5" stopColor="#6b4cb8" />
            <stop offset="1"   stopColor="#0a0814" />
          </radialGradient>
        </defs>

        {/* Outer arch — rectangle base + half-circle top, all in stone gradient */}
        <path
          d="M 70,340 L 70,150 A 120,120 0 0 1 310,150 L 310,340 Z"
          fill="url(#stone)"
        />

        {/* Stone-joint lines (decorative thin dark strokes) */}
        <g stroke="#1a0822" strokeWidth="1.5" fill="none" opacity="0.7">
          <line x1="70"  y1="200" x2="310" y2="200" />
          <line x1="70"  y1="260" x2="310" y2="260" />
          <line x1="190" y1="150" x2="190" y2="340" />
          <line x1="130" y1="200" x2="130" y2="340" />
          <line x1="250" y1="200" x2="250" y2="340" />
        </g>

        {/* Inner radial glow circle */}
        <ellipse
          cx="190"
          cy="190"
          rx="100"
          ry="120"
          fill="url(#glow)"
          data-testid="portal-glow"
        />

        {/* Keystone at top with gold ✦ rune */}
        <g data-testid="portal-keystone">
          <rect x="180" y="100" width="20" height="32" fill="#3a2e5a" stroke="#a87f3a" strokeWidth="1.5" />
          <text
            x="190" y="124"
            textAnchor="middle"
            fontSize="14"
            fill="#e6b667"
            fontFamily="serif"
            style={{ filter: "drop-shadow(0 0 4px rgba(230,182,103,0.6))" }}
          >
            ✦
          </text>
        </g>

        {/* 6 flanking purple runes */}
        <g>
          {RUNES.map((r, idx) => (
            <text
              key={idx}
              x={r.x} y={r.y}
              textAnchor="middle"
              fontSize="18"
              fill="#9b6cd6"
              fontFamily="serif"
              data-testid="portal-rune"
              style={{ filter: "drop-shadow(0 0 4px rgba(155,108,214,0.5))" }}
            >
              ✦
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Create the CSS module**

`src/components/ascension/Portal.module.css`:

```css
.portalWrap {
  display: inline-block;
  animation: portal-float 6s ease-in-out infinite;
}

.portal {
  width: 380px;
  max-width: 100%;
  height: auto;
  display: block;
  animation: portal-shimmer 4s ease-in-out infinite;
}

@keyframes portal-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

@keyframes portal-shimmer {
  0%, 100% { filter: drop-shadow(0 0 24px rgba(155, 108, 214, 0.55)) drop-shadow(0 0 48px rgba(107, 76, 184, 0.30)); }
  50%      { filter: drop-shadow(0 0 36px rgba(155, 108, 214, 0.75)) drop-shadow(0 0 64px rgba(107, 76, 184, 0.45)); }
}

@media (prefers-reduced-motion: reduce) {
  .portalWrap, .portal {
    animation: none;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "components/ascension/Portal"`
Expected: 4 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 422 + 4 = 426 passing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/ascension/Portal.tsx src/components/ascension/Portal.module.css tests/components/ascension/Portal.test.tsx
git commit -m "v2(ascension): add <Portal> animated stone-arch SVG

Inline SVG: outer arch (stone gradient #5a2855→#2a1238) + thin dark
joint lines + inner radial glow (lavender→violet→black) + keystone
with gold ✦ rune + 6 purple flanking runes.
CSS animations: portal-float (translateY ±6px, 6s ease) + portal-
shimmer (drop-shadow pulse, 4s ease). Reduced-motion fallback halts
both. 4 RTL tests cover SVG presence, keystone, 6 rune count, glow."
```

---

# Phase C — Right rail panels

---

### Task 4: `<ThresholdPanel>` + `<FamePreviewCard>` + `<PastRunsLedger>`

Three small panels in the right rail. Combined into a single task because each is small and their layout sibling-relationship makes them natural to land together.

**Files:**
- Create: `src/components/ascension/ThresholdPanel.tsx`
- Create: `src/components/ascension/ThresholdPanel.module.css`
- Create: `src/components/ascension/FamePreviewCard.tsx`
- Create: `src/components/ascension/FamePreviewCard.module.css`
- Create: `src/components/ascension/PastRunsLedger.tsx`
- Create: `src/components/ascension/PastRunsLedger.module.css`
- Create: `tests/components/ascension/ThresholdPanel.test.tsx`
- Create: `tests/components/ascension/FamePreviewCard.test.tsx`
- Create: `tests/components/ascension/PastRunsLedger.test.tsx`

- [ ] **Step 1: Write the failing tests**

`tests/components/ascension/ThresholdPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThresholdPanel } from "@/components/ascension/ThresholdPanel";

describe("<ThresholdPanel />", () => {
  it("renders current inspiration as a big mono number", () => {
    render(
      <ThresholdPanel currentInspi="847,000" thresholdInspi="1.20M" progressPct={0.7} />,
    );
    expect(screen.getByText("847,000")).toBeInTheDocument();
  });

  it("renders the threshold caption '{N}% to threshold'", () => {
    render(
      <ThresholdPanel currentInspi="847K" thresholdInspi="1.2M" progressPct={0.7} />,
    );
    expect(screen.getByText(/70% to threshold/i)).toBeInTheDocument();
  });

  it("progress bar reflects progressPct via inline width", () => {
    const { container } = render(
      <ThresholdPanel currentInspi="50" thresholdInspi="100" progressPct={0.5} />,
    );
    const fill = container.querySelector('[data-testid="threshold-fill"]') as HTMLElement;
    expect(fill?.style.width).toBe("50%");
  });
});
```

`tests/components/ascension/FamePreviewCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FamePreviewCard } from "@/components/ascension/FamePreviewCard";

describe("<FamePreviewCard />", () => {
  it("renders 'If you ascend now' header", () => {
    render(<FamePreviewCard fameGain={12} />);
    expect(screen.getByText(/If you ascend now/i)).toBeInTheDocument();
  });

  it("renders the fame gain with a leading +", () => {
    render(<FamePreviewCard fameGain={12} />);
    expect(screen.getByText(/\+12/)).toBeInTheDocument();
  });

  it("renders the permanence caption", () => {
    render(<FamePreviewCard fameGain={5} />);
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
  });
});
```

`tests/components/ascension/PastRunsLedger.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PastRunsLedger } from "@/components/ascension/PastRunsLedger";

describe("<PastRunsLedger />", () => {
  it("renders 'No past ascends' when runs array is empty", () => {
    render(<PastRunsLedger runs={[]} totalFame={0} />);
    expect(screen.getByText(/No past ascends/i)).toBeInTheDocument();
  });

  it("renders rows for each past run (most recent last)", () => {
    const runs = [
      { fame: 3, ascendedAt: 1 },
      { fame: 5, ascendedAt: 2 },
    ];
    render(<PastRunsLedger runs={runs} totalFame={8} />);
    expect(screen.getByText(/Run 01.*\+3/i)).toBeInTheDocument();
    expect(screen.getByText(/Run 02.*\+5/i)).toBeInTheDocument();
  });

  it("renders the total-fame footer", () => {
    const runs = [{ fame: 12, ascendedAt: 1 }];
    render(<PastRunsLedger runs={runs} totalFame={12} />);
    expect(screen.getByText(/Total.*12/i)).toBeInTheDocument();
  });

  it("limits the rendered row count to 4 (most recent kept; older trimmed)", () => {
    const runs = [
      { fame: 1, ascendedAt: 1 },
      { fame: 2, ascendedAt: 2 },
      { fame: 3, ascendedAt: 3 },
      { fame: 4, ascendedAt: 4 },
      { fame: 5, ascendedAt: 5 },
      { fame: 6, ascendedAt: 6 },
    ];
    render(<PastRunsLedger runs={runs} totalFame={21} />);
    // The 4 most recent are runs index 2..5 (Run 03..06).
    expect(screen.queryByText(/Run 01/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run 02/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Run 03/i)).toBeInTheDocument();
    expect(screen.getByText(/Run 06/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "components/ascension/(ThresholdPanel|FamePreviewCard|PastRunsLedger)"`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Create `<ThresholdPanel>`**

`src/components/ascension/ThresholdPanel.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./ThresholdPanel.module.css";

interface Props {
  currentInspi: string;     // formatted, e.g., "847,000" or "847K"
  thresholdInspi: string;   // formatted, e.g., "1.20M"
  progressPct: number;      // 0..1
}

export function ThresholdPanel({ currentInspi, thresholdInspi, progressPct }: Props): JSX.Element {
  const pct = Math.max(0, Math.min(100, progressPct * 100));
  const pctText = pct.toFixed(0);
  return (
    <section className={styles.panel} aria-label="Threshold">
      <div className={styles.subhead}>Current inspiration</div>
      <div className={styles.value}>{currentInspi}</div>
      <div className={styles.bar}>
        <div className={styles.fill} data-testid="threshold-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.caption}>
        {pctText}% to threshold · {thresholdInspi} inspi
      </div>
    </section>
  );
}
```

`src/components/ascension/ThresholdPanel.module.css`:

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

.value {
  font-family: var(--mono);
  font-size: 28px;
  font-weight: 600;
  color: var(--inspi);
  text-shadow: var(--inspi-glow);
}

.bar {
  height: 6px;
  border-radius: 3px;
  background: var(--bg-stone-d);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--inspi);
  box-shadow: var(--inspi-glow);
  transition: width 200ms ease;
}

.caption {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}
```

- [ ] **Step 4: Create `<FamePreviewCard>`**

`src/components/ascension/FamePreviewCard.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./FamePreviewCard.module.css";

interface Props {
  fameGain: number;
}

export function FamePreviewCard({ fameGain }: Props): JSX.Element {
  return (
    <section className={styles.card} aria-label="Fame preview">
      <div className={styles.subhead}>If you ascend now</div>
      <div className={styles.value}>+{fameGain}</div>
      <div className={styles.caption}>
        Fame is permanent · spent in the constellation.
      </div>
    </section>
  );
}
```

`src/components/ascension/FamePreviewCard.module.css`:

```css
.card {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-4);
  border: 1px solid var(--fame-d);
  border-radius: var(--r-md);
  background: var(--bg-1);
  box-shadow: var(--fame-glow);
}

.subhead {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.value {
  font-family: var(--serif);
  font-size: 36px;
  font-weight: 700;
  color: var(--fame);
  text-shadow: var(--fame-glow);
  line-height: 1;
}

.caption {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-2);
}
```

- [ ] **Step 5: Create `<PastRunsLedger>`**

`src/components/ascension/PastRunsLedger.tsx`:

```tsx
import type { JSX } from "react";
import styles from "./PastRunsLedger.module.css";

interface PastRun {
  fame: number;
  ascendedAt: number;
}

interface Props {
  runs: ReadonlyArray<PastRun>;
  totalFame: number;
}

const VISIBLE = 4;

/**
 * Renders the 4 most-recent ascends (older entries trimmed for compactness)
 * in a mono table format: "Run NN +N / {ascendedAt}". The total fame footer
 * sums ALL runs (not just the visible 4).
 */
export function PastRunsLedger({ runs, totalFame }: Props): JSX.Element {
  if (runs.length === 0) {
    return (
      <section className={styles.panel} aria-label="Past runs ledger">
        <div className={styles.subhead}>Past ascensions</div>
        <div className={styles.empty}>No past ascends — Step Through to begin your ledger.</div>
      </section>
    );
  }

  // Show last `VISIBLE` runs (most recent at the bottom).
  const startIdx = Math.max(0, runs.length - VISIBLE);
  const visible = runs.slice(startIdx);

  return (
    <section className={styles.panel} aria-label="Past runs ledger">
      <div className={styles.subhead}>Past ascensions</div>
      <ol className={styles.list} start={startIdx + 1}>
        {visible.map((run, i) => {
          const runNum = (startIdx + i + 1).toString().padStart(2, "0");
          const date = new Date(run.ascendedAt).toLocaleDateString();
          return (
            <li key={startIdx + i} className={styles.row}>
              <span className={styles.runLabel}>Run {runNum}</span>
              <span className={styles.fame}>+{run.fame}</span>
              <span className={styles.date}>{date}</span>
            </li>
          );
        })}
      </ol>
      <div className={styles.footer}>
        ✦ Total · {totalFame} fame ✦
      </div>
    </section>
  );
}
```

`src/components/ascension/PastRunsLedger.module.css`:

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
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--s-2);
  align-items: baseline;
  font-family: var(--mono);
  font-size: 12px;
}

.runLabel { color: var(--ink-2); }
.fame { color: var(--fame); text-shadow: var(--fame-glow); }
.date { color: var(--ink-3); font-size: 11px; }

.footer {
  margin-top: var(--s-2);
  text-align: center;
  font-family: var(--serif);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fame);
  text-shadow: var(--fame-glow);
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- "components/ascension/(ThresholdPanel|FamePreviewCard|PastRunsLedger)"`
Expected: 3 + 3 + 4 = 10 passing.

- [ ] **Step 7: Run full suite**

Run: `npm test`
Expected: 426 + 10 = 436 passing.

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/ascension/ThresholdPanel.tsx src/components/ascension/ThresholdPanel.module.css src/components/ascension/FamePreviewCard.tsx src/components/ascension/FamePreviewCard.module.css src/components/ascension/PastRunsLedger.tsx src/components/ascension/PastRunsLedger.module.css tests/components/ascension/ThresholdPanel.test.tsx tests/components/ascension/FamePreviewCard.test.tsx tests/components/ascension/PastRunsLedger.test.tsx
git commit -m "v2(ascension): add right-rail panels (Threshold, Fame preview, Past runs ledger)

ThresholdPanel — 28px mono current inspi + inspi-glow progress bar +
'X% to threshold · Y inspi' caption.
FamePreviewCard — fame-bordered + glow, 36px serif '+N' fame gain +
permanence caption.
PastRunsLedger — empty state when runs=[], else 4-most-recent rows
'Run NN +N {date}' + total fame footer ('✦ Total · N fame ✦').

10 RTL tests cover content render, progress fill width, fame gain
formatting, empty state, multi-run rows, total footer, 4-row trim."
```

---

# Phase D — Wire AscensionRoute (with confirm modal)

---

### Task 5: Replace AscensionRoute with new layout + inline confirmation modal

Rewrite `AscensionRoute.tsx` with the handoff's CSS Grid layout: cavern + portal on the left, right rail with the 3 panels. The "Step Through" CTA shows an inline overlay confirming the irreversible action; only on confirm does it call `performAscend`.

**Files:**
- Modify: `src/routes/AscensionRoute.tsx` (full rewrite)
- Create: `src/routes/AscensionRoute.module.css`
- Modify: `tests/routes/AscensionRoute.test.tsx` (existing tests; rewrite for new layout)

(There is an existing `tests/routes/AscensionRoute.test.tsx` from earlier work; we replace its content with v2-shaped tests.)

- [ ] **Step 1: Read existing `tests/routes/AscensionRoute.test.tsx`** to understand current shape

```bash
cat tests/routes/AscensionRoute.test.tsx
```

If you find existing assertions about layout / structure that would conflict with the new layout, those will need to be replaced. For new content, write fresh tests.

- [ ] **Step 2: Rewrite the test file**

Replace `tests/routes/AscensionRoute.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

function renderAscensionRoute() {
  return render(
    <MemoryRouter>
      <AscensionRoute />
    </MemoryRouter>,
  );
}

describe("AscensionRoute (v2 visual)", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.setState({
      ascendCount: 0,
      fame: big(0),
      pastRuns: [],
      purchasedNodes: {},
    });
  });

  it("renders the cavern with crystals", () => {
    renderAscensionRoute();
    expect(screen.getByTestId("crystal-0")).toBeInTheDocument();
  });

  it("renders the portal SVG", () => {
    const { container } = renderAscensionRoute();
    expect(container.querySelector('[data-testid="portal-keystone"]')).toBeInTheDocument();
  });

  it("renders the right-rail panels (threshold + fame preview + past runs)", () => {
    renderAscensionRoute();
    expect(screen.getByText(/Current inspiration/i)).toBeInTheDocument();
    expect(screen.getByText(/If you ascend now/i)).toBeInTheDocument();
    expect(screen.getByText(/Past ascensions/i)).toBeInTheDocument();
  });

  it("Step Through button is disabled below palier", () => {
    useGameStore.setState({ inspiration: big(0) });
    renderAscensionRoute();
    expect(screen.getByRole("button", { name: /step through/i })).toBeDisabled();
  });

  it("Step Through button is enabled at-or-above palier", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    expect(screen.getByRole("button", { name: /step through/i })).not.toBeDisabled();
  });

  it("clicking Step Through shows the confirmation modal", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("confirmation Cancel button closes the modal without ascending", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Did NOT ascend.
    expect(useGameStore.getState().ascendCount).toBe(0);
  });

  it("confirmation Ascend button performs the ascend", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    // Click the confirming Ascend button (inside the modal).
    fireEvent.click(screen.getByRole("button", { name: /^Ascend\s+\+/i }));
    expect(useGameStore.getState().ascendCount).toBe(1);
  });

  it("ledger reflects past ascends after performing one", () => {
    useGameStore.setState({ inspiration: big(2_000) });
    renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend\s+\+/i }));
    // Modal closes. Re-query the ledger.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // After ascend, the ledger should NOT show "No past ascends".
    expect(screen.queryByText(/No past ascends/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- "routes/AscensionRoute"`
Expected: FAIL — old AscensionRoute structure doesn't have the new components.

- [ ] **Step 4: Replace `src/routes/AscensionRoute.tsx`**

```tsx
import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canAscend, getEffectivePalier } from "@/systems/ascend";
import { fameOnAscend } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { Cavern } from "@/components/ascension/Cavern";
import { Portal } from "@/components/ascension/Portal";
import { ThresholdPanel } from "@/components/ascension/ThresholdPanel";
import { FamePreviewCard } from "@/components/ascension/FamePreviewCard";
import { PastRunsLedger } from "@/components/ascension/PastRunsLedger";
import styles from "./AscensionRoute.module.css";

export function AscensionRoute(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const pastRuns = useGameStore((s) => s.pastRuns);
  const performAscend = useGameStore((s) => s.performAscend);

  const helperState = {
    inspiration,
    ascendCount,
    purchasedNodes,
  } as unknown as GameStore;

  const palier = getEffectivePalier(helperState, ascendCount);
  const canDo = canAscend(helperState);
  const fameGain = fameOnAscend(inspiration);
  const progressPct = palier.gt(0)
    ? Math.min(1, inspiration.toNumber() / palier.toNumber())
    : 0;

  const [confirmOpen, setConfirmOpen] = useState(false);

  const onStepThroughClick = () => {
    if (!canDo) return;
    setConfirmOpen(true);
  };

  const onConfirmAscend = () => {
    setConfirmOpen(false);
    performAscend();
  };

  return (
    <div className={styles.layout}>
      <div className={styles.cavernArea}>
        <Cavern>
          <div className={styles.portalCenter}>
            <Portal />
          </div>
          <div className={styles.cta}>
            <div className={styles.ctaLabel}>— Step Through —</div>
            <button
              type="button"
              className={styles.stepThroughBtn}
              disabled={!canDo}
              onClick={onStepThroughClick}
            >
              ✦ Step Through · +{fameGain} fame ✦
            </button>
          </div>
        </Cavern>
      </div>

      <aside className={styles.rail}>
        <ThresholdPanel
          currentInspi={formatBig(inspiration)}
          thresholdInspi={formatBig(palier)}
          progressPct={progressPct}
        />
        <FamePreviewCard fameGain={fameGain} />
        <PastRunsLedger runs={pastRuns} totalFame={fame.toNumber()} />
      </aside>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ascend-confirm-title"
          className={styles.modalOverlay}
          onClick={() => setConfirmOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 id="ascend-confirm-title" className={styles.modalTitle}>
              Step Through the Portal?
            </h2>
            <p className={styles.modalBody}>
              Your run resets — gold, inspiration, tree, canvas, and workshop are
              wiped. Fame is permanent and spent in the constellation.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={onConfirmAscend}
              >
                ✦ Ascend · +{fameGain} fame ✦
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/routes/AscensionRoute.module.css`**

```css
.layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: var(--s-5);
  height: 100%;
  padding: var(--s-5);
}

.cavernArea {
  position: relative;
}

.portalCenter {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -55%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cta {
  position: absolute;
  bottom: var(--s-6);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-3);
}

.ctaLabel {
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--fame);
  text-shadow: var(--fame-glow);
}

.stepThroughBtn {
  font-family: var(--serif);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--bg-0);
  padding: var(--s-3) var(--s-6);
  border: 2px solid var(--fame);
  border-radius: var(--r-md);
  background: var(--fame);
  box-shadow: var(--fame-glow);
  transition: background-color 120ms ease, transform 120ms ease;
}

.stepThroughBtn:hover:not(:disabled) {
  background: var(--fame-d);
  transform: translateY(-1px);
}

.stepThroughBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--bg-2);
  color: var(--ink-3);
  border-color: var(--ink-line);
  box-shadow: none;
}

.rail {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  overflow-y: auto;
}

.modalOverlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal {
  width: min(440px, 90%);
  padding: var(--s-6);
  background: var(--bg-1);
  border: 2px solid var(--fame-d);
  border-radius: var(--r-md);
  box-shadow: var(--fame-glow), var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}

.modalTitle {
  margin: 0;
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--fame);
  text-shadow: var(--fame-glow);
}

.modalBody {
  margin: 0;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink-2);
}

.modalActions {
  display: flex;
  gap: var(--s-3);
  justify-content: flex-end;
}

.cancelBtn {
  font-family: var(--mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  padding: var(--s-2) var(--s-4);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  transition: color 120ms ease, border-color 120ms ease;
}

.cancelBtn:hover {
  color: var(--ink-0);
  border-color: var(--ink-2);
}

.confirmBtn {
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--bg-0);
  padding: var(--s-2) var(--s-4);
  border: 1px solid var(--fame);
  border-radius: var(--r-sm);
  background: var(--fame);
  box-shadow: var(--fame-glow);
}

.confirmBtn:hover {
  background: var(--fame-d);
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: 436 + (number of NEW route tests minus the OLD tests that were replaced) = ~440-445.

If a test fails because an old test referenced something specific (e.g., the old "ascend preserves paintMastery" pattern), examine and fix individually.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean (or only pre-existing main.tsx warning).

- [ ] **Step 8: Commit**

```bash
git add src/routes/AscensionRoute.tsx src/routes/AscensionRoute.module.css tests/routes/AscensionRoute.test.tsx
git commit -m "v2(ascension): rebuild AscensionRoute with new layout

CSS Grid 1fr 360px (cavern + right rail). Cavern hosts the Portal
centered + 'Step Through' CTA below it. Right rail: ThresholdPanel +
FamePreviewCard + PastRunsLedger. 'Step Through' opens an inline
confirmation modal (role=dialog, aria-modal); confirm calls
performAscend, cancel closes the modal. v1.1 ascend mechanics
preserved (palier gating, fame conversion, run reset).
9 RTL tests cover crystals + portal + rail panels + step-through
gating + modal flow + ledger updates after ascend."
```

---

# Phase E — Verify + tag

---

### Task 6: Final verify + smoke + HANDOVER + checkpoint tag

This task does NOT make code changes (except HANDOVER). Verification gate before declaring Round 3 complete.

**IMPORTANT:** Do NOT push, do NOT merge. Local-only branch + tag.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Capture exact pass count. Expected: ~440-445.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Capture gzipped sizes. Bundle should still be under 250 KB.

- [ ] **Step 4: Smoke check via curl**

```bash
npm run preview &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/ 2>&1 | tail -1
kill %1 2>/dev/null || true
```

Expected: HTTP 200.

- [ ] **Step 5: Update `docs/HANDOVER.md`**

Open `docs/HANDOVER.md`. Find the v2.0 Round 2 section. Add a NEW sub-section ABOVE it:

```markdown
## v2.0 Round 3 — Ascension route (in progress on `feat/v2-redesign`)

**Status:** Round 3 complete. Round 4 (Constellation) pending.

### What landed

- New `src/components/ascension/` directory:
  - `<Cavern>` — radial violet→black gradient + repeating stone-block grid + 5 floating purple-diamond crystals (CSS clip-path) with staggered 3s opacity pulse.
  - `<Portal>` — animated stone-arch SVG (bricked stone gradient + thin joint lines + inner radial glow + keystone with gold ✦ rune + 6 purple flanking runes). CSS `portal-float` (±6px Y, 6s) + `portal-shimmer` (drop-shadow pulse, 4s).
  - `<ThresholdPanel>` — current inspi (28px mono inspi-glow) + progress bar to threshold + caption.
  - `<FamePreviewCard>` — fame-bordered + glow card with big serif "+N" fame gain + permanence caption.
  - `<PastRunsLedger>` — 4 most-recent runs in mono table format + total fame footer. Empty state for first-time players.
- `src/routes/AscensionRoute.tsx` rebuilt: CSS Grid `1fr 360px` (cavern + right rail). Inline confirmation modal (role=dialog, aria-modal) for the irreversible Step Through action.

### Data layer

- New persisted field: `pastRuns: ReadonlyArray<PastRun>` on `metaSlice`. Each entry: `{ fame: number; ascendedAt: number }`.
- New action: `metaSlice.addPastRun(run)` (orchestrator-only consumer).
- `performAscendOrchestrator` now appends one entry per successful ascend after fame credit + ascendCount bump.
- Save migration v6 → v7 adds default `pastRuns: []` to existing v6 saves.

### Visual state

- Ascension route: matches handoff aesthetic (cavern + animated portal + right-rail panels + irreversible-action modal).
- Tree (R1) + Painting (R2): complete from prior rounds.
- Constellation: still degraded; Round 4 rebuilds.

### Tests + build

- {NN} tests passing.
- tsc clean. Lint clean.
- Bundle: {NN} KB gzipped JS / {NN} KB gzipped CSS / ~{NN} KB total.

### Next

Round 4: Constellation (skill tree). Per spec §8 Round 4.
```

(Replace `{NN}` placeholders with actual values.)

- [ ] **Step 6: Commit + tag checkpoint**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): v2.0 Round 3 (Ascension) complete on branch"
git tag -a v2.0-round-3 -m "v2.0 Round 3 — Ascension route complete"
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
| §8 Round 3 — Cavern (radial bg + stone grid + 5 crystals) | Task 2 |
| §8 Round 3 — Portal (stone arch + animations) | Task 3 |
| §8 Round 3 — ThresholdPanel | Task 4 |
| §8 Round 3 — FamePreviewCard | Task 4 |
| §8 Round 3 — PastRunsLedger | Task 4 |
| §8 Round 3 — Step Through CTA + confirmation modal | Task 5 |
| §8 Round 3 — pastRuns data + migration v6→v7 | Task 1 |
| §9 State model addition (PastRun + addPastRun) | Task 1 |

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders.
- ✅ Test code given for every TDD step; impl code given for every implementation step.
- ✅ Type signatures consistent: `PastRun = { fame: number; ascendedAt: number }` defined in T1, used in T4/T5.
- ✅ Test count math: 411 baseline + 7 (T1: 3 metaSlice + 2 ascend + 2 migration) + 4 (T2) + 4 (T3) + 10 (T4) + 9 (T5 net — replaces existing) = ~440-445.
- ✅ Each task is bite-sized.

---

**End of plan.**
