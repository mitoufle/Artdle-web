# Painting Stage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the canvas (overlay the upgrade cards on it) and rebuild the worker avatars as larger, canvas-flanking portraits with a gold stroke-cycle ring, a teal XP bar, and a shake+tilt on each stroke.

**Architecture:** CSS-grid change drops the upgrades row so the aspect-locked canvas grows; the upgrade strip becomes an absolute overlay inside the stage. `WorkerAvatars` (already a per-tick, `pointer-events:none` overlay self-subscribed to `roster`+`painterClocks`) is rebuilt into two absolute flanking columns; each portrait gets a conic-gradient ring driven by `clock/interval`, a teal XP bar driven by `xp/workerXpToNext(level)`, and a stroke-proc animation that replays via a remount-`key` nonce when the worker's clock drops.

**Tech Stack:** React 19 + TS strict, CSS Modules, Vitest + Testing Library, `@/` = `src/`. CSS custom property `--fill` set inline; conic-gradient + radial mask for the ring.

**Spec:** `docs/superpowers/specs/2026-05-30-painting-stage-redesign-design.md`

---

## File Structure

- `src/routes/PaintingRoute.tsx` — move the upgrades strip into `.stageArea` (overlay); remove `.upgradesArea`.
- `src/routes/PaintingRoute.module.css` — grid: drop upgrades row; add `.upgradesOverlay`.
- `src/components/painting/CanvasStage.module.css` — raise `.progress`/`.bottomRow` so the canvas HUD clears the overlay.
- `src/styles/tokens.css` — add `--teal`.
- `src/components/painting/WorkerAvatars.tsx` — flanking columns, ring, teal XP bar, stroke-proc.
- `src/components/painting/WorkerAvatars.module.css` — full restyle.
- `tests/components/painting/WorkerAvatars.test.tsx` — new column-split / XP-fill / stroke-proc tests.

CSS-only/layout tasks (Task 1) have no meaningful unit test; they are gated by "existing painting tests stay green" + the Task 4 eyeball. The testable logic (column split, XP fill, stroke-proc detection) is in Tasks 2–3.

---

## Task 1: Widen canvas + overlay the upgrade cards

**Files:**
- Modify: `src/routes/PaintingRoute.tsx` (the returned JSX, ~lines 72–143)
- Modify: `src/routes/PaintingRoute.module.css`
- Modify: `src/components/painting/CanvasStage.module.css` (`.progress` ~line 190, `.bottomRow` ~line 209)

- [ ] **Step 1: Move the upgrades strip into the stage as an overlay**

In `src/routes/PaintingRoute.tsx`, replace the two sibling blocks (the `<div className={styles.stageArea}>…</div>` AND the following `<div className={styles.upgradesArea}>…</div>`) with a single stage block that contains the upgrades overlay. The 4 `TrackCard`/`BoundSpeedTrackCard` children are unchanged — only their wrapper moves. Result:

```tsx
      <div className={styles.stageArea}>
        <BoundCanvasStage
          canvasTier={canvasTier}
          chunkInterval={interval}
          baseGold={baseGold}
          chunkCount={chunkCount}
        />
        <WorkerAvatars />
        <div className={styles.upgradesOverlay}>
          <CanvasUpgradesStrip>
            <TrackCard
              trackId="sell_price"
              label="Sell Price"
              affixKind="+sell_price%"
              level={sellPriceLevel}
              effectLine={`+${fmtPct(SELL_PRICE_PER_LEVEL, 0)} gold/level`}
              costLabel={`${formatBig(sellCost)}`}
              canAfford={gold.gte(sellCost)}
              locked={false}
              onUpgrade={upgradeSellPrice}
            />
            <BoundSpeedTrackCard
              level={speedLevel}
              effectLine={`+${fmtPct(SPEED_PER_LEVEL, 0)} speed/level`}
              chunkInterval={interval}
              costLabel={`${formatBig(speedCost)}`}
              canAfford={gold.gte(speedCost)}
              onUpgrade={upgradeSpeed}
            />
            <TrackCard
              trackId="crit"
              label="Crit Chance"
              iconOverride="✦"
              colorOverride="#e85c5c"
              level={critLevel}
              maxLevel={MAX_CRIT_LEVEL}
              effectLine={critLocked ? "—" : `+${fmtPct(CRIT_PER_LEVEL, 0)} crit chance/level (max L${MAX_CRIT_LEVEL})`}
              costLabel={critLocked ? "—" : `${formatBig(critCost)}`}
              canAfford={gold.gte(critCost)}
              locked={critLocked}
              onUpgrade={upgradeCrit}
            />
            <TrackCard
              trackId="combo"
              label="Combo"
              affixKind="+combo_chance%"
              level={comboLevel}
              effectLine={comboLocked ? "—" : `+${fmtPct(COMBO_PER_LEVEL, 0)} chain chance/level`}
              costLabel={comboLocked ? "—" : `${formatBig(comboCost)}`}
              canAfford={gold.gte(comboCost)}
              locked={comboLocked}
              onUpgrade={upgradeCombo}
            />
          </CanvasUpgradesStrip>
        </div>
      </div>
```

(The `.roomArea` and `.railArea` blocks below are unchanged.)

- [ ] **Step 2: Update the grid + add the overlay style**

Replace the entire contents of `src/routes/PaintingRoute.module.css` with:

```css
.layout {
  display: grid;
  grid-template-columns: 1fr 368px 64px;
  grid-template-rows: 1fr;
  grid-template-areas: "stage room rail";
  gap: var(--s-4);
  height: 100%;
  padding: var(--s-4);
}

.stageArea {
  grid-area: stage;
  position: relative;
  min-height: 320px;
}

.upgradesOverlay {
  position: absolute;
  left: 50%;
  bottom: var(--s-3);
  transform: translateX(-50%);
  z-index: 4;
  max-width: calc(100% - 220px);
  background: rgba(10, 8, 14, 0.62);
  border: var(--border-subtle);
  border-radius: var(--r-md);
  padding: var(--s-2);
  backdrop-filter: blur(2px);
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

- [ ] **Step 3: Lift the canvas HUD so it clears the overlay**

In `src/components/painting/CanvasStage.module.css`, change the `bottom` of `.progress` from `34px` to `118px`, and the `bottom` of `.bottomRow` from `var(--s-3)` to `96px`:

```css
.progress {
  position: absolute;
  left: var(--s-5);
  right: var(--s-5);
  bottom: 118px;
  z-index: 2;
  height: 3px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 2px;
  overflow: hidden;
}
```
```css
.bottomRow {
  position: absolute;
  left: var(--s-5);
  right: var(--s-5);
  bottom: 96px;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--s-3);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-2);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}
```
(These two `bottom` values are eyeball-tuned in Task 4 — the goal is "HUD sits just above the upgrades overlay".)

- [ ] **Step 4: Verify no regression in painting component tests**

Run: `npx vitest run tests/components/painting/`
Expected: PASS (this task is layout-only; the visual result is checked in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/routes/PaintingRoute.tsx src/routes/PaintingRoute.module.css src/components/painting/CanvasStage.module.css
git commit -m "ui(painting): widen canvas, overlay upgrade cards on the stage"
```

---

## Task 2: Flanking worker columns + gold ring + teal XP bar

**Files:**
- Modify: `src/styles/tokens.css` (add `--teal` near `--inspi-d`, ~line 26)
- Rewrite: `src/components/painting/WorkerAvatars.tsx`
- Rewrite: `src/components/painting/WorkerAvatars.module.css`
- Modify: `tests/components/painting/WorkerAvatars.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `tests/components/painting/WorkerAvatars.test.tsx`, update the imports line to add `within` and `big` + `workerXpToNext`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { WorkerAvatars } from "@/components/painting/WorkerAvatars";
import { big } from "@/core/bigNumber";
import { workerXpToNext } from "@/core/balance";
```

Add these two tests inside `describe("WorkerAvatars", …)`:

```ts
  it("splits avatars 2 & 3 to the left column and 1 & 4 to the right", () => {
    const w1 = { ...createWorker(), avatar: 1 };
    const w2 = { ...createWorker(), avatar: 2 };
    const w3 = { ...createWorker(), avatar: 3 };
    const w4 = { ...createWorker(), avatar: 4 };
    useGameStore.setState({ roster: [w1, w2, w3, w4], painterClocks: {} });
    render(<WorkerAvatars />);
    const left = within(screen.getByTestId("worker-column-left")).getAllByTestId("worker-portrait");
    const right = within(screen.getByTestId("worker-column-right")).getAllByTestId("worker-portrait");
    expect(left.map((p) => p.style.backgroundImage).join()).toMatch(/worker_2/);
    expect(left.map((p) => p.style.backgroundImage).join()).toMatch(/worker_3/);
    expect(right.map((p) => p.style.backgroundImage).join()).toMatch(/worker_1/);
    expect(right.map((p) => p.style.backgroundImage).join()).toMatch(/worker_4/);
  });

  it("drives the XP bar from xp / workerXpToNext(level)", () => {
    const lvl = 1;
    const half = workerXpToNext(lvl).div(2); // 1500 at level 1 (cost 3000)
    const w = { ...createWorker(), avatar: 1, level: lvl, xp: half };
    useGameStore.setState({ roster: [w], painterClocks: {} });
    render(<WorkerAvatars />);
    expect(screen.getByTestId("worker-xp-fill").style.width).toBe("50%");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx`
Expected: FAIL — no `worker-column-left` / `worker-xp-fill` test ids yet.

- [ ] **Step 3: Add the `--teal` token**

In `src/styles/tokens.css`, add this line immediately after the `--inspi-d:` line in the semantic/currency block:

```css
  --teal:        #2dd4bf;  /* worker XP bar */
```

- [ ] **Step 4: Rewrite `WorkerAvatars.tsx`**

Replace the entire file with:

```tsx
import type { JSX, CSSProperties } from "react";
import { useGameStore } from "@/store";
import { chunkInterval, workerXpToNext } from "@/core/balance";
import type { Worker } from "@/store/officeSlice";
import { WORKER_AVATARS } from "./workerAvatarMap";
import styles from "./WorkerAvatars.module.css";

/** Avatars 2 & 3 flank the canvas on the left; 1 & 4 on the right. */
const LEFT_AVATARS = new Set([2, 3]);

/**
 * Read-only overlay of worker avatars flanking the canvas. SELF-SUBSCRIBES to
 * `roster` + `painterClocks` (do NOT prop-drill — that re-renders the whole
 * route every tick). `pointer-events:none` so it never eats click-to-paint.
 * Each portrait shows a gold stroke-cycle ring (clock/interval) and a teal XP
 * bar (xp / workerXpToNext(level)).
 */
export function WorkerAvatars(): JSX.Element | null {
  const roster = useGameStore((s) => s.roster);
  const painterClocks = useGameStore((s) => s.painterClocks);
  if (roster.length === 0) return null;

  const left = roster.filter((w) => LEFT_AVATARS.has(w.avatar));
  const right = roster.filter((w) => !LEFT_AVATARS.has(w.avatar));

  const renderAvatar = (w: Worker): JSX.Element => {
    const interval = chunkInterval(w.stats.speed);
    const clock = painterClocks[w.id] ?? 0;
    const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;
    const xpToNext = workerXpToNext(w.level);
    const xpFrac = Math.max(0, Math.min(1, w.xp.div(xpToNext).toNumber()));
    return (
      <div key={w.id} className={styles.avatar} data-testid="worker-avatar">
        <div className={styles.ringWrap} data-testid="worker-ringwrap">
          <div className={styles.ring} style={{ "--fill": fillPct } as CSSProperties} />
          <div
            className={styles.portrait}
            data-testid="worker-portrait"
            style={{ backgroundImage: `url(${WORKER_AVATARS[w.avatar - 1]})` }}
          />
        </div>
        <div className={styles.xpBar}>
          <div
            className={styles.xpFill}
            data-testid="worker-xp-fill"
            style={{ width: `${xpFrac * 100}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.layer}
      style={{ pointerEvents: "none" }}
      data-testid="worker-avatar-layer"
      aria-hidden="true"
    >
      <div className={styles.columnLeft} data-testid="worker-column-left">
        {left.map(renderAvatar)}
      </div>
      <div className={styles.columnRight} data-testid="worker-column-right">
        {right.map(renderAvatar)}
      </div>
    </div>
  );
}
```

(The `as CSSProperties` cast lets TS accept the `--fill` custom property in the inline `style`; `CSSProperties` is imported as a type alongside `JSX`.)

- [ ] **Step 5: Rewrite `WorkerAvatars.module.css`**

Replace the entire file with:

```css
/**
 * On-canvas worker avatars flanking the easel: avatars 2 & 3 stack on the left
 * edge, 1 & 4 on the right. Purely decorative + click-through (the component
 * also sets pointer-events:none inline). Re-renders every tick — kept light:
 * the gold ring is a masked conic-gradient (no JS), the XP bar a width transition.
 */
.layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.columnLeft,
.columnRight {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-4);
}
.columnLeft { left: var(--s-3); }
.columnRight { right: var(--s-3); }

.avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 88px;
}

.ringWrap {
  position: relative;
  width: 80px;
  height: 80px;
  transform-origin: center bottom;
}

.portrait {
  position: absolute;
  inset: 7px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: bottom center;
  image-rendering: pixelated;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.65));
}

/* Gold stroke-cycle ring: conic sweep (clockwise from 12 o'clock) masked to a
 * thin annulus. --fill (0..1) set inline per tick; no transition so it advances
 * like the old cooldown fill and snaps to 0 on stroke. */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(var(--gold) calc(var(--fill, 0) * 1turn), rgba(168, 127, 58, 0.18) 0);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
          mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  filter: drop-shadow(0 0 3px rgba(232, 176, 58, 0.5));
}

.xpBar {
  width: 64px;
  height: 4px;
  border-radius: 2px;
  background: rgba(45, 212, 191, 0.18);
  overflow: hidden;
}

.xpFill {
  height: 100%;
  background: var(--teal);
  transition: width 200ms ease;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx`
Expected: PASS — including the unchanged "renders nothing", "one avatar per worker", "pointer-events none", and "paints each worker's own avatar" tests (left column renders first in the DOM, so portraits stay in `worker_2`, `worker_4` order for that test).

- [ ] **Step 7: Commit**

```bash
git add src/styles/tokens.css src/components/painting/WorkerAvatars.tsx src/components/painting/WorkerAvatars.module.css tests/components/painting/WorkerAvatars.test.tsx
git commit -m "ui(painting): flank canvas with larger worker avatars, gold ring + teal XP bar"
```

---

## Task 3: Shake + tilt on stroke

**Files:**
- Modify: `src/components/painting/WorkerAvatars.tsx` (add proc refs; add `key`/`data-proc` to `.ringWrap`)
- Modify: `src/components/painting/WorkerAvatars.module.css` (add `animation` to `.ringWrap` + keyframe)
- Modify: `tests/components/painting/WorkerAvatars.test.tsx`

- [ ] **Step 1: Write the failing test**

Add inside `describe("WorkerAvatars", …)` in `tests/components/painting/WorkerAvatars.test.tsx`:

```ts
  it("increments the stroke-proc counter when a worker's clock drops", () => {
    const w = { ...createWorker(), avatar: 1 };
    useGameStore.setState({ roster: [w], painterClocks: { [w.id]: 4 } });
    render(<WorkerAvatars />);
    expect(screen.getByTestId("worker-ringwrap").getAttribute("data-proc")).toBe("0");
    // clock drops (worker just strokes) → proc fires once
    act(() => useGameStore.setState({ painterClocks: { [w.id]: 0.1 } }));
    expect(screen.getByTestId("worker-ringwrap").getAttribute("data-proc")).toBe("1");
    // clock keeps climbing → no new proc
    act(() => useGameStore.setState({ painterClocks: { [w.id]: 0.2 } }));
    expect(screen.getByTestId("worker-ringwrap").getAttribute("data-proc")).toBe("1");
  });
```

Add `act` to the testing-library import:

```ts
import { render, screen, within, cleanup, act } from "@testing-library/react";
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx`
Expected: FAIL — `data-proc` attribute is absent (returns `null`, not `"0"`).

- [ ] **Step 3: Add proc detection to `WorkerAvatars.tsx`**

Add `useRef` to the React import at the top:

```tsx
import { useRef } from "react";
```

Inside `WorkerAvatars`, just after the `painterClocks` selector and BEFORE the `if (roster.length === 0)` guard, add the proc refs:

```tsx
  // Per-worker previous clock + a monotonic "stroke happened" nonce. A worker
  // strokes exactly when its clock DROPS (resets toward 0). Updating prev within
  // the same render makes this idempotent under StrictMode's double-invoke.
  const prevClocks = useRef<Record<string, number>>({});
  const procNonce = useRef<Record<string, number>>({});
```

In `renderAvatar`, after the `const clock = …` line, compute the nonce:

```tsx
    const prev = prevClocks.current[w.id] ?? 0;
    if (clock < prev) procNonce.current[w.id] = (procNonce.current[w.id] ?? 0) + 1;
    prevClocks.current[w.id] = clock;
    const nonce = procNonce.current[w.id] ?? 0;
```

Change the `.ringWrap` div to carry the nonce as both its remount `key` and a `data-proc` attribute (remounting replays the CSS animation):

```tsx
        <div
          key={`rw-${nonce}`}
          className={styles.ringWrap}
          data-testid="worker-ringwrap"
          data-proc={nonce}
        >
```

- [ ] **Step 4: Add the shake+tilt keyframe**

In `src/components/painting/WorkerAvatars.module.css`, add `animation: strokeProc 360ms ease-out;` to the existing `.ringWrap` rule, then append the keyframe at the end of the file:

```css
.ringWrap {
  position: relative;
  width: 80px;
  height: 80px;
  transform-origin: center bottom;
  animation: strokeProc 360ms ease-out;
}

@keyframes strokeProc {
  0%   { transform: rotate(0deg) translateX(0); }
  20%  { transform: rotate(-6deg) translateX(-2px); }
  45%  { transform: rotate(5deg) translateX(2px); }
  70%  { transform: rotate(-3deg) translateX(-1px); }
  100% { transform: rotate(0deg) translateX(0); }
}
```

(The animation also plays once on first mount — harmless.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx`
Expected: PASS (all, including the new proc test and the earlier column/XP tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/WorkerAvatars.tsx src/components/painting/WorkerAvatars.module.css tests/components/painting/WorkerAvatars.test.tsx
git commit -m "ui(painting): shake + tilt worker avatar on each stroke"
```

---

## Task 4: Full verification + eyeball

**Files:** possibly `src/components/painting/CanvasStage.module.css` (tune HUD `bottom` values)

- [ ] **Step 1: Run the painting test suite**

Run: `npx vitest run tests/components/painting/`
Expected: PASS (all painting component tests).

- [ ] **Step 2: Eyeball on the dev server (`localhost:5173`, route `/painting`)**

Confirm:
- Canvas is visibly larger/wider; the 4 upgrade cards float at the bottom-center over it; the canvas's progress bar + gold/tier row sit just above the overlay (not hidden behind it). If they overlap, tune `.progress`/`.bottomRow` `bottom` in `CanvasStage.module.css` and re-check.
- Worker avatars are larger and flank the canvas — avatars 2 & 3 on the left, 1 & 4 on the right.
- Each portrait has a thin gold ring that fills clockwise toward the next stroke and snaps back on stroke.
- The bar under each avatar is teal and reflects XP toward the next level.
- A shake+tilt fires on each worker's stroke.

- [ ] **Step 3: If HUD clearances were tuned, commit**

```bash
git add src/components/painting/CanvasStage.module.css
git commit -m "ui(painting): tune canvas HUD clearance under the upgrades overlay"
```

(Skip if no tuning was needed.)

---

## Self-Review

- **Spec coverage:** widen canvas (T1) ✓; overlay upgrades (T1) ✓; flanking columns 2&3 left / 1&4 right (T2) ✓; larger portraits (T2, 80px) ✓; teal XP bar wired to xp/xpToNext (T2) ✓; gold clockwise ring from clock/interval (T2) ✓; shake+tilt on stroke (T3) ✓; `--teal` token (T2) ✓; tests (T2/T3) + eyeball (T4) ✓.
- **Placeholders:** none — every step has concrete code. HUD `bottom` pixel values are concrete (118/96) with a noted eyeball-tune step.
- **Type consistency:** `--fill` set inline in T2 and consumed by `.ring` CSS; `data-proc`/`key` nonce added in T3 to the T2 `.ringWrap`; `worker-column-left/right`, `worker-xp-fill`, `worker-ringwrap`, `worker-portrait` test ids are consistent across component and tests; `workerXpToNext`/`chunkInterval` imported from `@/core/balance`; `Worker` type from `@/store/officeSlice`.
- **StrictMode safety:** the proc nonce updates `prevClocks.current` within the same render, so React's dev double-invoke nets +1 (not +2) per stroke — verified by the T3 test expectation.
