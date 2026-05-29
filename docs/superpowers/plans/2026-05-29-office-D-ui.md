# Office Redesign — Phase D: UI (roll screen, on-canvas avatars, office tab)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For the visual components, ALSO use the **frontend-design** skill — but see the "Visual language" constraint below: match the existing painting-room aesthetic, don't invent a new one.

**Goal:** Surface the autonomous-painter office the player can finally *see*: a post-ascend reveal of each worker's level-ups, on-canvas worker avatars with next-stroke timing indicators, and an Office tab showing each worker's stat sheet. This is the final phase — when it lands, the office is complete and the branch is ready to merge.

**Architecture:** Pure UI/presentation — **no engine changes** (both deferred engine decisions are resolved as won't-fix: worker crits stay player-only; the multi-painter catch-up tolerance is accepted). Three read-only views over data the earlier phases already produce: `lastAscendRoll` (Phase C, per-worker before/after snapshot), `roster` + `painterClocks` (Phases A2/B), and `Worker.stats`. A shared worker-stat display helper keeps the three views consistent.

**Tech Stack:** React 19 + TS strict, Zustand 5 (selector subscriptions), Motion (animations), Vitest + @testing-library/react, CSS modules.

**Spec:** `docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md` §4.2 (post-ascend roll screen), §9 (display: avatars + next-stroke indicators).

**Builds on:** A2 (`roster`, minimal `OfficeRoom`), B (`painterClocks` per-painter timing, isolation pattern via `BoundCanvasStage`), C (`lastAscendRoll: ReadonlyArray<AscendRollEntry> | null`, `clearAscendRoll()`, `applyAscendXp`). `AscendRollEntry = {id, levelBefore, levelAfter, statsBefore: WorkerStats, statsAfter: WorkerStats}` (exported from `@/store/officeSlice`). `WorkerStats = {goldPct, speed, critChance, strokesPerCrit, comboChance}`.

---

## Green bar (every task)
- `npx vitest run` fully green.
- `npx vite build` clean.
- NOT `tsc` (~25 pre-existing baseline test-file errors per HANDOVER; don't chase, don't add NEW dangling imports).

## LOCKED decisions (do not let an implementer drift):

### 1. Office-less ascend shows NO roll reveal (LOCKED, Task 2)
Until this branch merges, *every* production player ascends with no office, so `applyAscendXp` sets `lastAscendRoll = null`. `WorkerRollReveal` MUST render **nothing — null, zero DOM, no empty wrapper, no animation root, no layout shift** — when `lastAscendRoll` is null/empty. A stray container would regress the blackout (fame + quote) screen for everyone. This is the Phase-D analog of B's solo gate / C's empty-roster gate — a named test, because a render test on the populated case won't catch a regression to the empty case.

Also: a worker that gained XP but **no level** is absent from `lastAscendRoll` (C only pushes entries where `levelAfter > levelBefore`). The reveal naturally omits it — assert that, so nobody "fixes" it into rendering 0-level entries.

**Conscious behavior (do NOT "fix"):** an ascend where you HAVE an office but **no worker leveled this run** yields `lastAscendRoll === null` → the reveal shows nothing, indistinguishable from an office-less ascend. That's acceptable for Phase D (spec §4.2 is about revealing level-ups). Do NOT add a "your painters trained but didn't level up" message — out of scope.

### 2. `WorkerAvatars` self-subscribes — never prop-drill from `PaintingRoute` (LOCKED, Task 3)
`WorkerAvatars` reads `roster` + `painterClocks` via its OWN `useGameStore` selectors. Do NOT have `PaintingRoute` read them and pass as props — that re-subscribes `PaintingRoute` to per-tick state and re-renders the whole route every frame, silently undoing A2's removal of the `roster` subscription and the `BoundCanvasStage` isolation (see the repo's painting-route-tick-subscription-isolation work). Guarded by extending the existing `BoundCanvasStage.test.tsx` re-render-count assertion.

### 3. Avatar layer is `pointer-events: none` + verified in the running app (LOCKED, Task 3)
The avatar overlay sits over the stage area, which includes the easel that handles `onChunkClick` (click-to-paint). An absolutely-positioned layer would silently eat those clicks. The avatar layer MUST set `pointer-events: none` (avatars are read-only). A render test passes while click-to-paint is dead, so Task 3 includes a REQUIRED manual verification in the running app (avatars show next-stroke fills AND the easel still paints on click).

## Visual language constraint (for frontend-design executors)
This is an established game: Cinzel display titles, gilded picture frame, dark vignetted room, gold accents. **Match it.** Reuse existing CSS-module classes and design tokens where they exist (`OfficeRoom.module.css`, `AscendCinematicOverlay.module.css`, the painting-room palette). Treat visual consistency as the constraint — do NOT introduce a novel/distinct aesthetic. "Polished but off-brand" is a failure here.

## Scope guard — NOT in Phase D:
- Class-switch UI / class roster (spec §6/§13 defer the class roster + unlock graph to a separate content spec; only the neutral `base` class exists, so there's nothing to switch to). The office tab shows `classId` as text but offers no switching.
- Any engine/scheduler change. Both deferred decisions are won't-fix (see Task 5 housekeeping).

---

## File structure
- `src/components/painting/workerStatDisplay.ts` — NEW. Shared pure helpers: labels + absolute/delta formatters for the 5 worker stats. Used by the roll reveal AND the office card (DRY).
- `src/components/ascension/WorkerRollReveal.tsx` (+ `.module.css`) — NEW. Reads `lastAscendRoll`; renders per-leveled-worker reveal. Renders null when empty.
- `src/components/ascension/AscendCinematicOverlay.tsx` — MODIFY. Render `<WorkerRollReveal/>` inside the blackout phase.
- `src/routes/AscensionRoute.tsx` — MODIFY. `clearAscendRoll()` on dismiss + on the reduced-motion path.
- `src/components/painting/WorkerAvatars.tsx` (+ `.module.css`) — NEW. Self-subscribing isolated overlay: one avatar per worker + next-stroke indicator. `pointer-events: none`.
- `src/routes/PaintingRoute.tsx` — MODIFY. Mount `<WorkerAvatars/>` in the stage area.
- `src/components/painting/OfficeRoom.tsx` (+ reuse `OfficeRoom.module.css`) — MODIFY. Rework into per-worker stat-sheet cards.
- `src/core/canvasTickPure.ts` — MODIFY (Task 5, one comment only). `tests/core/canvasTickPure.equivalence.test.ts` — MODIFY (Task 5, delete the skipped guard).

---

## Task 1: Shared worker-stat display helpers

A single source of truth for how the 5 worker stats render — absolute (office card) and as a level-up delta (roll reveal). Pure functions, fully unit-testable.

**Files:**
- Create: `src/components/painting/workerStatDisplay.ts`
- Test: `tests/components/painting/workerStatDisplay.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/painting/workerStatDisplay.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatWorkerStatAbsolute, formatWorkerStatDelta, WORKER_STAT_KEYS } from "@/components/painting/workerStatDisplay";
import { createBaseStats } from "@/core/workerModel";

describe("formatWorkerStatAbsolute", () => {
  it("formats each base stat for display", () => {
    const s = createBaseStats(); // goldPct 0, speed 1, critChance 0.01, strokesPerCrit 1, comboChance 0
    expect(formatWorkerStatAbsolute("goldPct", s.goldPct)).toBe("+0%");
    expect(formatWorkerStatAbsolute("speed", s.speed)).toBe("×1.00");
    expect(formatWorkerStatAbsolute("critChance", s.critChance)).toBe("1.0%");
    expect(formatWorkerStatAbsolute("strokesPerCrit", s.strokesPerCrit)).toBe("1");
    expect(formatWorkerStatAbsolute("comboChance", s.comboChance)).toBe("0.0%");
  });

  it("formats grown stats", () => {
    expect(formatWorkerStatAbsolute("goldPct", 0.23)).toBe("+23%");
    expect(formatWorkerStatAbsolute("speed", 1.15)).toBe("×1.15");
    expect(formatWorkerStatAbsolute("critChance", 0.105)).toBe("10.5%");
    expect(formatWorkerStatAbsolute("strokesPerCrit", 3)).toBe("3");
  });
});

describe("formatWorkerStatDelta", () => {
  it("returns null when a stat did not change", () => {
    expect(formatWorkerStatDelta("goldPct", 0.10, 0.10)).toBeNull();
    expect(formatWorkerStatDelta("strokesPerCrit", 2, 2)).toBeNull();
  });

  it("formats a positive percent-point delta", () => {
    expect(formatWorkerStatDelta("goldPct", 0.10, 0.13)).toBe("+3% gold");
    expect(formatWorkerStatDelta("speed", 1.00, 1.04)).toBe("+4% speed");
    expect(formatWorkerStatDelta("critChance", 0.01, 0.03)).toBe("+2% crit");
    expect(formatWorkerStatDelta("comboChance", 0, 0.05)).toBe("+5% combo");
  });

  it("formats a strokes-per-crit delta as an integer", () => {
    expect(formatWorkerStatDelta("strokesPerCrit", 1, 2)).toBe("+1 stroke/crit");
  });

  it("WORKER_STAT_KEYS lists all five stats in display order", () => {
    expect(WORKER_STAT_KEYS).toEqual(["goldPct", "speed", "critChance", "strokesPerCrit", "comboChance"]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/components/painting/workerStatDisplay.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/components/painting/workerStatDisplay.ts`**

```ts
import type { WorkerStats } from "@/core/workerModel";

/** The five worker stats, in the order they should display everywhere. */
export const WORKER_STAT_KEYS = ["goldPct", "speed", "critChance", "strokesPerCrit", "comboChance"] as const;
export type WorkerStatKey = (typeof WORKER_STAT_KEYS)[number];

/** Short human label per stat (used by the office card rows). */
export const WORKER_STAT_LABELS: Record<WorkerStatKey, string> = {
  goldPct: "Gold",
  speed: "Speed",
  critChance: "Crit",
  strokesPerCrit: "Strokes/crit",
  comboChance: "Combo",
};

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

/** Absolute display of a stat value (office stat sheet). */
export function formatWorkerStatAbsolute(key: WorkerStatKey, value: number): string {
  switch (key) {
    case "goldPct":
      return `+${Math.round(value * 100)}%`;       // additive gold bonus
    case "speed":
      return `×${value.toFixed(2)}`;                 // stroke-rate multiplier
    case "critChance":
    case "comboChance":
      return pct(value);                            // probabilities, 1 decimal
    case "strokesPerCrit":
      return `${value}`;                            // integer
  }
}

/** A level-up increment for one stat: e.g. "+3% gold", "+1 stroke/crit".
 *  Returns null when the stat did not change. */
export function formatWorkerStatDelta(key: WorkerStatKey, before: number, after: number): string | null {
  if (after === before) return null;
  if (key === "strokesPerCrit") {
    return `+${after - before} stroke/crit`;
  }
  // The four fractional stats roll in whole percentage points (WORKER_PCT_INCREMENTS).
  const pp = Math.round((after - before) * 100);
  const noun: Record<Exclude<WorkerStatKey, "strokesPerCrit">, string> = {
    goldPct: "gold", speed: "speed", critChance: "crit", comboChance: "combo",
  };
  return `+${pp}% ${noun[key as Exclude<WorkerStatKey, "strokesPerCrit">]}`;
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/components/painting/workerStatDisplay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/workerStatDisplay.ts tests/components/painting/workerStatDisplay.test.ts
git commit -m "ui(office): shared worker-stat display helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Post-ascend worker roll reveal

The payoff moment. After the ascend door animation, the blackout screen (fame + quote) also reveals each worker's level-up(s). Reads `lastAscendRoll` from the store (populated synchronously by `performAscend()` before blackout renders — no race).

**Files:**
- Create: `src/components/ascension/WorkerRollReveal.tsx`, `src/components/ascension/WorkerRollReveal.module.css`
- Modify: `src/components/ascension/AscendCinematicOverlay.tsx`, `src/routes/AscensionRoute.tsx`
- Test: `tests/components/ascension/WorkerRollReveal.test.tsx`; update `tests/routes/AscensionRoute.test.tsx`

- [ ] **Step 1: Write the failing tests (incl. the LOCKED null gate)**

Create `tests/components/ascension/WorkerRollReveal.test.tsx`:
```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { WorkerRollReveal } from "@/components/ascension/WorkerRollReveal";

afterEach(cleanup);

describe("WorkerRollReveal", () => {
  it("renders NOTHING (no DOM) when lastAscendRoll is null — office-less ascend", () => {
    useGameStore.setState({ lastAscendRoll: null });
    const { container } = render(<WorkerRollReveal />);
    expect(container.firstChild).toBeNull(); // zero DOM, no wrapper, no layout shift
  });

  it("renders NOTHING when the roll is an empty array", () => {
    useGameStore.setState({ lastAscendRoll: [] });
    const { container } = render(<WorkerRollReveal />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a worker's level transition and the stat increments it rolled", () => {
    const before = createBaseStats(); // goldPct 0, speed 1, crit 0.01, spc 1, combo 0
    const after = { ...before, goldPct: 0.03, strokesPerCrit: 2 }; // +3% gold, +1 stroke/crit
    useGameStore.setState({
      lastAscendRoll: [{ id: createWorker().id, levelBefore: 4, levelAfter: 6, statsBefore: before, statsAfter: after }],
    });
    render(<WorkerRollReveal />);
    // level transition (match flexibly — exact glyphs are styling)
    expect(screen.getByText(/4.*6/)).toBeInTheDocument();
    expect(screen.getByText(/\+3% gold/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 stroke\/crit/)).toBeInTheDocument();
    // stats that didn't change are NOT shown as +0
    expect(screen.queryByText(/\+0% speed/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/components/ascension/WorkerRollReveal.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `WorkerRollReveal.tsx`**

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { WORKER_STAT_KEYS, formatWorkerStatDelta } from "@/components/painting/workerStatDisplay";
import styles from "./WorkerRollReveal.module.css";

/**
 * Post-ascend reveal of worker level-ups, rendered inside the cinematic
 * blackout. Reads `lastAscendRoll` (Phase C: per-worker before/after for
 * workers that gained ≥1 level). Renders NOTHING when there is no roll — an
 * office-less ascend must not perturb the blackout fame/quote screen.
 */
export function WorkerRollReveal(): JSX.Element | null {
  const roll = useGameStore((s) => s.lastAscendRoll);
  if (!roll || roll.length === 0) return null;

  return (
    <ul className={styles.reveal} data-testid="worker-roll-reveal">
      {roll.map((entry) => {
        const deltas = WORKER_STAT_KEYS
          .map((k) => formatWorkerStatDelta(k, entry.statsBefore[k], entry.statsAfter[k]))
          .filter((d): d is string => d !== null);
        return (
          <li key={entry.id} className={styles.worker}>
            <span className={styles.level}>Lv {entry.levelBefore} → {entry.levelAfter}</span>
            <span className={styles.deltas}>{deltas.join(" · ")}</span>
          </li>
        );
      })}
    </ul>
  );
}
```
Create `WorkerRollReveal.module.css` with classes `reveal`, `worker`, `level`, `deltas` styled to match the blackout aesthetic (the `AscendCinematicOverlay.module.css` palette — gold text on the dark backdrop, Cinzel/serif for the level line). Use the **frontend-design** skill for the animated stagger (Motion is available; a simple fade/slide-in per worker matching the existing overlay feel). Keep it legible at a glance.

- [ ] **Step 4: Render it in the blackout phase**

In `src/components/ascension/AscendCinematicOverlay.tsx`, import `WorkerRollReveal` and render it inside the `isBlackout` block, after the quote (and before/around the hint):
```tsx
          <p className={styles.quote} data-testid="ascend-cinematic-quote">
            {quote}
          </p>
          <WorkerRollReveal />
```
(No prop threading — `WorkerRollReveal` reads the store itself. It renders null for office-less ascends, so the overlay is unchanged for them.)

- [ ] **Step 5: Clear the roll on dismiss + reduced-motion path**

In `src/routes/AscensionRoute.tsx`:
- Add the selector: `const clearAscendRoll = useGameStore((s) => s.clearAscendRoll);`
- In `onCinematicDismiss`, add `clearAscendRoll();` (before or after navigate — order doesn't matter; it's transient hygiene).
- In `onConfirmAscend`'s reduced-motion branch, after `performAscend();` add `clearAscendRoll();` (reduced-motion users skip the whole cinematic — they get the levels but not the show; clearing keeps no stale reveal around). Add a brief comment noting this is the conscious reduced-motion behavior.

- [ ] **Step 6: Update the AscensionRoute test**

In `tests/routes/AscensionRoute.test.tsx`, if any test drives a full ascend through the cinematic, confirm it still passes (the reveal renders null for an empty roster, so existing flows are unaffected). Add one case: with `lastAscendRoll` set before dismiss, `onCinematicDismiss` results in `lastAscendRoll === null` (clear-on-dismiss). If the existing test harness makes this awkward, assert it at the store level: set `lastAscendRoll`, call `useGameStore.getState().clearAscendRoll()` via the dismiss path, expect null. Keep it minimal and matching the file's existing style.

- [ ] **Step 7: Run + build**

Run: `npx vitest run tests/components/ascension/WorkerRollReveal.test.tsx tests/routes/AscensionRoute.test.tsx` then `npx vitest run` (full) then `npx vite build`.
Expected: green + clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "ui(office): post-ascend worker level-up roll reveal" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
> `git add -A` is safe here (all new files are intended). If `git status` shows pre-existing untracked items unrelated to this task (`.mcp.json`, other `docs/.../plans/*.md`, `src/assets/images/Workers/`), use `git add` with explicit paths instead.

---

## Task 3: On-canvas worker avatars + next-stroke indicators

A self-subscribing, isolated, click-through overlay near the canvas: one avatar per worker, each with a fill showing how close that worker is to its next stroke.

**Files:**
- Create: `src/components/painting/WorkerAvatars.tsx`, `src/components/painting/WorkerAvatars.module.css`
- Modify: `src/routes/PaintingRoute.tsx`
- Test: `tests/components/painting/WorkerAvatars.test.tsx`; extend `tests/components/painting/BoundCanvasStage.test.tsx` (re-render guard)

- [ ] **Step 1: Write the failing tests (incl. the LOCKED isolation guard)**

Create `tests/components/painting/WorkerAvatars.test.tsx`:
```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { WorkerAvatars } from "@/components/painting/WorkerAvatars";

afterEach(cleanup);

describe("WorkerAvatars", () => {
  it("renders nothing when the roster is empty", () => {
    useGameStore.setState({ roster: [], painterClocks: {} });
    const { container } = render(<WorkerAvatars />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one avatar per worker", () => {
    const a = createWorker();
    const b = createWorker();
    useGameStore.setState({ roster: [a, b], painterClocks: {} });
    const { getAllByTestId } = render(<WorkerAvatars />);
    expect(getAllByTestId("worker-avatar")).toHaveLength(2);
  });

  it("the avatar layer is click-through (pointer-events: none)", () => {
    const a = createWorker();
    useGameStore.setState({ roster: [a], painterClocks: {} });
    const { getByTestId } = render(<WorkerAvatars />);
    // The root layer must not capture pointer events (inline style or class).
    const layer = getByTestId("worker-avatar-layer");
    // jsdom doesn't compute CSS-module styles; assert the inline guarantee.
    expect(layer.style.pointerEvents).toBe("none");
  });
});
```
> The `pointer-events` assertion checks an INLINE style (`style={{ pointerEvents: "none" }}`) because jsdom does not resolve CSS-module class rules. Set it inline on the root layer (belt-and-suspenders with the CSS module).

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `WorkerAvatars.tsx`**

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { chunkInterval } from "@/core/balance";
import styles from "./WorkerAvatars.module.css";

/**
 * Read-only overlay of worker avatars near the canvas, each showing a
 * next-stroke fill. SELF-SUBSCRIBES to `roster` + `painterClocks` (do NOT
 * prop-drill from PaintingRoute — that would re-render the whole route every
 * tick; see the painting-route subscription-isolation work). Mounted as a leaf
 * sibling of BoundCanvasStage. `pointer-events: none` so it never eats the
 * easel's click-to-paint.
 */
export function WorkerAvatars(): JSX.Element | null {
  const roster = useGameStore((s) => s.roster);
  const painterClocks = useGameStore((s) => s.painterClocks);
  if (roster.length === 0) return null;

  return (
    <div
      className={styles.layer}
      style={{ pointerEvents: "none" }}
      data-testid="worker-avatar-layer"
      aria-hidden="true"
    >
      {roster.map((w) => {
        const interval = chunkInterval(w.stats.speed);
        const clock = painterClocks[w.id] ?? 0;
        const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;
        return (
          <div key={w.id} className={styles.avatar} data-testid="worker-avatar">
            <div className={styles.portrait}>{/* simple painter glyph/sprite */}</div>
            <div className={styles.cooldownTrack}>
              <div className={styles.cooldownFill} style={{ width: `${fillPct * 100}%` }} />
            </div>
            <div className={styles.level}>Lv {w.level}</div>
          </div>
        );
      })}
    </div>
  );
}
```
Create `WorkerAvatars.module.css` (`layer`, `avatar`, `portrait`, `cooldownTrack`, `cooldownFill`, `level`). The `layer` is `position: absolute` over the stage; ALSO set `pointer-events: none` in the CSS (the inline style is the test-checkable guarantee; the CSS keeps it correct if the inline is ever removed). Match the dark/gilded palette. Use the **frontend-design** skill for the avatar visual — small painter figures along the bottom/side of the canvas, a thin gold cooldown bar. There are worker images at `src/assets/images/Workers/` (currently untracked) — the executor may use them for the portrait if appropriate, or a simple styled glyph; keep it on-brand and lightweight (this re-renders every tick).

- [ ] **Step 4: Mount in `PaintingRoute.tsx` (no new subscriptions on the route)**

In `src/routes/PaintingRoute.tsx`, import `WorkerAvatars` and render it inside the `stageArea` div as a sibling of `<BoundCanvasStage/>`:
```tsx
      <div className={styles.stageArea}>
        <BoundCanvasStage
          canvasTier={canvasTier}
          chunkInterval={interval}
          baseGold={baseGold}
          chunkCount={chunkCount}
        />
        <WorkerAvatars />
      </div>
```
Do NOT add any `useGameStore((s) => s.roster)` / `painterClocks` selector to `PaintingRoute` — `WorkerAvatars` subscribes itself. (Ensure `styles.stageArea` is `position: relative` so the absolute avatar layer anchors to it; if it isn't already, add `position: relative` to `.stageArea` in `PaintingRoute.module.css`.)

- [ ] **Step 5: Extend the re-render-count guard (LOCKED isolation test)**

In `tests/components/painting/BoundCanvasStage.test.tsx`, there is a test asserting PaintingRoute's body re-renders ≤ 1 time when only `canvasProgress` changes. Add an analogous case: with `WorkerAvatars` mounted (i.e. a non-empty roster), PaintingRoute's body re-renders ≤ 1 time when only `painterClocks` changes. Mirror the existing test's harness (render-count ref / spy). This proves `WorkerAvatars` self-subscription does not leak per-tick re-renders into the route.
> If the existing test renders `PaintingRoute` and counts a body render, set a roster first (`useGameStore.setState({ roster: [createWorker()] })`), then mutate only `painterClocks` and assert the route body render count stays ≤ 1 while the avatar subtree updates.
> **The counter MUST stay on `PaintingRoute`'s body** (mirror the existing `canvasProgress` guard's placement). A counter accidentally placed on the `WorkerAvatars` subtree would pass vacuously and defeat the guard. The test must also confirm the tick actually propagated (the avatar subtree re-rendered / the fill changed) so it's not passing because nothing happened — i.e. it discriminates "isolated update" from "no update."

- [ ] **Step 6: Run + build**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx tests/components/painting/BoundCanvasStage.test.tsx` then `npx vitest run` (full) then `npx vite build`.
Expected: green + clean.

- [ ] **Step 7: REQUIRED manual verification in the running app (LOCKED — render tests can't prove this)**

Launch the app (use the **run** or **verify** skill, or `npm run dev`). With at least one worker in the roster (buy the `entrepreneur` node, or seed `useGameStore.setState({ roster: [createWorker()] })` in the dev console):
1. Confirm worker avatars appear near the canvas and their cooldown fills animate toward each next stroke.
2. **Confirm clicking the easel still paints** (click-to-paint advances the canvas) — i.e. the avatar overlay does NOT eat clicks.
If either fails, fix before committing (most likely `pointer-events: none` missing on the layer, or the layer covering the easel without it).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "ui(office): on-canvas worker avatars + next-stroke indicators" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
(Explicit paths if untracked items are present, per Task 2's note.)

---

## Task 4: Office tab — per-worker stat sheets

Rework the minimal A2 `OfficeRoom` (a plain text list) into proper per-worker cards showing level, class, and the five stats. Read-only; no class switch (content-deferred).

**Files:**
- Modify: `src/components/painting/OfficeRoom.tsx`, `src/components/painting/OfficeRoom.module.css`
- Test: `tests/components/painting/OfficeRoom.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/painting/OfficeRoom.test.tsx`:
```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { OfficeRoom } from "@/components/painting/OfficeRoom";

afterEach(cleanup);

describe("OfficeRoom", () => {
  it("shows the empty state when there are no workers", () => {
    useGameStore.setState({ roster: [], purchasedNodes: {} });
    render(<OfficeRoom />);
    expect(screen.getByText(/no painters yet/i)).toBeInTheDocument();
  });

  it("renders a stat card per worker showing level and the five stats", () => {
    const w = { ...createWorker(), level: 7 };
    useGameStore.setState({ roster: [w], purchasedNodes: { hire_manager: 1, entrepreneur: 1 } });
    render(<OfficeRoom />);
    expect(screen.getByText(/Level 7/i)).toBeInTheDocument();
    // five stat labels present — use EXACT string match (default exact:true),
    // NOT a regex: a regex `getByText(/Crit/i)` matches BOTH "Crit" and
    // "Strokes/crit" and throws on multiple matches. Exact full-string equality
    // resolves each label to its single row.
    for (const label of ["Gold", "Speed", "Crit", "Strokes/crit", "Combo"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // a base worker's gold reads +0%, speed ×1.00
    expect(screen.getByText("+0%")).toBeInTheDocument();
    expect(screen.getByText("×1.00")).toBeInTheDocument();
  });
});
```
> jest-dom matchers (`toBeInTheDocument`) are already wired via `vitest.setup.ts` (and `tsconfig.app.json` types) — mirror the imports of an existing component test like `tests/ui/widgets/FloatingGoldText.test.tsx`. The `getByText(label)` exact-match resolves the `"Crit"` vs `"Strokes/crit"` collision; do NOT switch it to a regex.

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/components/painting/OfficeRoom.test.tsx`
Expected: FAIL (current OfficeRoom renders a plain text list, no stat labels).

- [ ] **Step 3: Rework `OfficeRoom.tsx`**

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getRosterCap, type Worker } from "@/store/officeSlice";
import { WORKER_STAT_KEYS, WORKER_STAT_LABELS, formatWorkerStatAbsolute } from "./workerStatDisplay";
import styles from "./OfficeRoom.module.css";

function WorkerStatCard({ worker }: { worker: Worker }): JSX.Element {
  return (
    <li className={styles.card} data-testid="worker-stat-card">
      <header className={styles.cardHeader}>
        <span className={styles.cardName}>Painter</span>
        <span className={styles.cardLevel}>Level {worker.level}</span>
      </header>
      <div className={styles.cardClass}>{worker.classId}</div>
      <ul className={styles.statList}>
        {WORKER_STAT_KEYS.map((k) => (
          <li key={k} className={styles.statRow}>
            <span className={styles.statLabel}>{WORKER_STAT_LABELS[k]}</span>
            <span className={styles.statValue}>{formatWorkerStatAbsolute(k, worker.stats[k])}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * The Painter's Office tab: a read-only roster of worker stat sheets. Workers
 * level only at ascend (the reveal happens on the post-ascend roll screen).
 * Class switching is deferred to the class-content spec — `classId` is shown
 * as text only.
 */
export function OfficeRoom(): JSX.Element {
  const roster = useGameStore((s) => s.roster);
  const rosterCap = useGameStore(getRosterCap);

  return (
    <section className={styles.room} aria-label="Painter's Office">
      <section className={styles.section}>
        <div className={styles.subhead}>
          Roster <span className={styles.count}>{roster.length} / {rosterCap}</span>
        </div>
        {roster.length === 0 ? (
          <div className={styles.empty}>No painters yet — unlock a roster slot in the skill tree.</div>
        ) : (
          <ul className={styles.cardList}>
            {roster.map((w) => (
              <WorkerStatCard key={w.id} worker={w} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
```
Update `OfficeRoom.module.css`: keep the existing `room`/`section`/`subhead`/`count`/`empty`/`cardList` classes; ADD `card`, `cardHeader`, `cardName`, `cardLevel`, `cardClass`, `statList`, `statRow`, `statLabel`, `statValue`. Match the painting-room aesthetic (the existing module's palette; gilded card edges, gold values). Use **frontend-design** for the card layout, but reuse existing tokens/classes.

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/components/painting/OfficeRoom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run + build**

Run: `npx vitest run` (full) then `npx vite build`.
Expected: green + clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ui(office): office tab worker stat-sheet cards" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Housekeeping — close out the deferred decisions

Both deferred engine decisions are won't-fix. Make the codebase reflect that cleanly (no zombie skipped test), then verify the whole office is shippable.

**Files:**
- Modify: `tests/core/canvasTickPure.equivalence.test.ts`, `src/core/canvasTickPure.ts` (comment only)

- [ ] **Step 1: Delete the zombie skipped test**

In `tests/core/canvasTickPure.equivalence.test.ts`, DELETE the `describe("canvasTickPure — multi-painter step-invariance (KNOWN GAP, deferred to C/D)", ...)` block (the `it.skip` one) and its `multiDraft`/`runMulti` helpers if they're used only by it. The multi-painter step-invariance gap is an **accepted tolerance** (idle-game offline sim) — the record lives in `docs/HANDOVER.md`, not a permanently-skipped test. Keep the SOLO equivalence + step-invariance describes (those guarantee what we DO promise) untouched. Remove the now-unused `createWorker` import if it was only for the deleted block.

- [ ] **Step 2: Document the player-only stat decision (no behavior change)**

In `src/core/canvasTickPure.ts`, at the player-only stat gating (where worker strokes route to `workerStrokes` and only the player branch touches `critChunksThisTick`/`localCritStreak`/`localMaxCombo`), ensure the existing "Phase-B stat rule (LOCKED)" comment notes this is a **deliberate, accepted** decision (worker crits do not feed achievement stats), not a TODO. If the comment already says this (it should, from Phase B), leave it; if it implies a pending C/D revisit, soften it to "decided: kept player-only". (Comment-only — change no logic.)

- [ ] **Step 3: Run + build**

Run: `npx vitest run` (full — expect the skipped count to drop to 0 skipped) then `npx vite build`.
Expected: green (0 skipped now) + clean.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "office(cleanup): accept multi-painter catch-up tolerance; drop skipped guard" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Final office verification (manual)**

Launch the app (run/verify skill). End-to-end smoke of the whole office:
1. Buy `entrepreneur` (Office unlocks, worker #1 spawns) → avatar appears, office tab shows its stat card.
2. Let the canvas paint → worker avatars' cooldowns animate; gold reflects `workerGoldFactor`.
3. Ascend with enough fame → after the door, the blackout shows the worker's `Lv X→Y` + stat increments; dismiss clears it.
4. Confirm an ascend with NO office (fresh save / no roster) shows the normal blackout (fame + quote) with no reveal artifacts.
Report any visual/behavioral issues; fix before declaring the phase done.

---

## After all tasks: finish the branch
Phase D completes the office redesign (A1→A2→B→C→D all done). Use the **superpowers:finishing-a-development-branch** skill to integrate: the office is feature-complete, suite green, build clean. The branch `painter-office-redesign` is ready to merge to `master`, then deploy with `npx vercel --prod` (per CLAUDE.md; Vercel is not auto-deployed from push). Before merging, do a final feel-test pass — especially the worker-leveling curve (`WORKER_XP_GROWTH`) flagged in the Phase C handoff (veterans may flatline late-game).

---

## Self-Review

**Spec coverage:**
- §4.2 post-ascend roll screen (reveal each worker's level-ups + stat increments, appended to the cinematic) → Task 2 (`WorkerRollReveal` in the blackout). ✅
- §9 display: avatars overlaid near the canvas + next-stroke timing indicator, read-only → Task 3 (`WorkerAvatars`, cooldown fill from `painterClocks`/`chunkInterval`). ✅
- Office tab management view (roster + stats) → Task 4 (stat-sheet cards). Class switch explicitly deferred (spec §6/§13). ✅
- Shared stat display (DRY across reveal + office) → Task 1. ✅
- Resolve the two deferred C/D decisions → Task 5 (player-only kept; catch-up tolerance accepted, skipped test deleted). ✅

**Advisor must-haves baked in as named gates:** office-less ascend → no DOM (Task 2 Step 1 LOCKED test); `WorkerAvatars` self-subscription + re-render-count guard (Task 3 Step 5 LOCKED test); `pointer-events: none` + run-the-app click-through verify (Task 3 Steps 1/7 LOCKED); delete (not relabel) the skipped test (Task 5); one shared formatter (Task 1, used by Tasks 2+4); match existing visual language (constraint stated for all visual tasks).

**Placeholder scan:** concrete component bodies + tests throughout. The only non-code "fill in" is CSS styling craft, explicitly delegated to the frontend-design skill with a reuse-existing-tokens constraint and named CSS classes — not a placeholder for logic. Manual-verify steps (Task 3 Step 7, Task 5 Step 5) are intentional human gates, stated with exact pass criteria.

**Type consistency:** `WORKER_STAT_KEYS`/`WorkerStatKey`/`WORKER_STAT_LABELS`/`formatWorkerStatAbsolute`/`formatWorkerStatDelta` (Task 1) are consumed with matching signatures in Tasks 2 (`formatWorkerStatDelta`) and 4 (`formatWorkerStatAbsolute`, `WORKER_STAT_LABELS`, `WORKER_STAT_KEYS`). `AscendRollEntry`/`lastAscendRoll`/`clearAscendRoll` (Phase C) and `roster`/`painterClocks`/`Worker.stats`/`chunkInterval` (A2/B) are consumed as defined. `WorkerRollReveal`/`WorkerAvatars`/`OfficeRoom` are each self-subscribing components taking no props.

---

## Phase notes
- This is the LAST office phase. No follow-on plan — after Task 5 + branch finish, the office redesign is complete.
- The worker images at `src/assets/images/Workers/` are currently untracked; Task 3 may incorporate them (then they get added with that task's commit) or use a styled glyph. Either is fine; keep avatars lightweight (per-tick render).
- `skillTreeDesign.json` remains out of sync for the office branch (decoupled designer spec) — not a Phase D concern; mention to the user if they want it reconciled.
