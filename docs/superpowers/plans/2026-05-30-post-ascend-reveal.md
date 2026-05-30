# Post-Ascend Worker Level-Up Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the post-ascend `WorkerRollReveal` into side-by-side worker cards (avatar · name · `Lv a→b` · stat sheet) whose increased stats animate one-by-one to teal with a `+#`, and make the blackout overlay's first click skip to the end and the second dismiss.

**Architecture:** `WorkerRollReveal` self-drives a shared per-stat step (400 ms, all cards in sync) from `lastAscendRoll`, looking up name/avatar from the roster by id; it takes a `skip` prop and fires `onComplete`. `AscendCinematicOverlay` holds `skip`/`revealDone`: a click skips while animating, dismisses once done.

**Tech Stack:** React 19 + TS strict, CSS Modules, Zustand selectors, Vitest + Testing Library. `@/` = `src/`.

**Spec:** `docs/superpowers/specs/2026-05-30-post-ascend-reveal-design.md`

---

## File Structure

- `src/components/painting/workerStatDisplay.ts` — add `formatWorkerStatDeltaShort` (modify).
- `src/components/ascension/WorkerRollReveal.tsx` + `.module.css` — rewrite to cards + step machine.
- `src/components/ascension/AscendCinematicOverlay.tsx` — `skip`/`revealDone` coordination + hint.
- Tests: `tests/components/painting/workerStatDisplay.test.ts` (or new) for the short delta;
  rewrite `tests/components/ascension/WorkerRollReveal.test.tsx`; new
  `tests/components/ascension/AscendCinematicOverlay.test.tsx`; update one test in
  `tests/routes/AscensionRoute.test.tsx`.

---

## Task 1: `formatWorkerStatDeltaShort`

**Files:**
- Modify: `src/components/painting/workerStatDisplay.ts`
- Test: `tests/components/painting/workerStatDisplay.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/components/painting/workerStatDisplay.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatWorkerStatDeltaShort } from "@/components/painting/workerStatDisplay";

describe("formatWorkerStatDeltaShort", () => {
  it("formats fractional-stat increments as whole percent points", () => {
    expect(formatWorkerStatDeltaShort("goldPct", 0.05, 0.08)).toBe("+3%");
    expect(formatWorkerStatDeltaShort("speed", 1, 1.05)).toBe("+5%");
  });
  it("formats strokesPerCrit as a plain integer delta", () => {
    expect(formatWorkerStatDeltaShort("strokesPerCrit", 1, 3)).toBe("+2");
  });
  it("returns null when the stat did not change", () => {
    expect(formatWorkerStatDeltaShort("comboChance", 0.02, 0.02)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/painting/workerStatDisplay.test.ts`
Expected: FAIL — `formatWorkerStatDeltaShort` is not exported.

- [ ] **Step 3: Add the function**

Append to `src/components/painting/workerStatDisplay.ts`:

```ts
/** Compact level-up delta for a chip beside the (already-labeled) stat: "+3%", "+1".
 *  Null when unchanged. Fractional stats roll in whole percentage points. */
export function formatWorkerStatDeltaShort(key: WorkerStatKey, before: number, after: number): string | null {
  if (after === before) return null;
  if (key === "strokesPerCrit") return `+${after - before}`;
  return `+${Math.round((after - before) * 100)}%`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/painting/workerStatDisplay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/workerStatDisplay.ts tests/components/painting/workerStatDisplay.test.ts
git commit -m "core(office): add compact worker stat-delta formatter"
```

---

## Task 2: Rewrite `WorkerRollReveal`

**Files:**
- Rewrite: `src/components/ascension/WorkerRollReveal.tsx`, `src/components/ascension/WorkerRollReveal.module.css`
- Rewrite: `tests/components/ascension/WorkerRollReveal.test.tsx`

- [ ] **Step 1: Replace the test (drives the new card + step API)**

Replace the ENTIRE `tests/components/ascension/WorkerRollReveal.test.tsx` with:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { WorkerRollReveal } from "@/components/ascension/WorkerRollReveal";

afterEach(cleanup);

describe("WorkerRollReveal", () => {
  it("renders nothing and completes when the roll is empty", () => {
    const onComplete = vi.fn();
    useGameStore.setState({ lastAscendRoll: null, roster: [] });
    const { container } = render(<WorkerRollReveal skip={false} onComplete={onComplete} />);
    expect(container.firstChild).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("shows a card with the roster name/avatar, level transition, and revealed stats (skip)", () => {
    const w = { ...createWorker(), name: "Frida", avatar: 3 };
    const before = { ...createBaseStats(), goldPct: 0.05 };
    const after = { ...before, goldPct: 0.08, strokesPerCrit: before.strokesPerCrit + 1 };
    useGameStore.setState({
      roster: [w],
      lastAscendRoll: [{ id: w.id, levelBefore: 4, levelAfter: 6, statsBefore: before, statsAfter: after }],
    });
    const onComplete = vi.fn();
    render(<WorkerRollReveal skip onComplete={onComplete} />);

    const card = screen.getByTestId("worker-roll-card");
    expect(within(card).getByText("Frida")).toBeInTheDocument();
    expect(within(card).getByText(/4.*6/)).toBeInTheDocument(); // Lv 4 → 6
    expect(within(card).getByTestId("worker-portrait-roll").getAttribute("src")).toMatch(/worker_3/);

    // Increased gold stat: after value + teal flag + "+3%" delta chip.
    const goldVal = screen.getByTestId("worker-roll-value-goldPct");
    expect(goldVal.textContent).toBe("+8%");
    expect(goldVal.getAttribute("data-up")).toBe("true");
    expect(within(screen.getByTestId("worker-roll-stat-goldPct")).getByText("+3%")).toBeInTheDocument();

    // Unchanged combo stat: before value, not teal, no delta chip.
    const comboVal = screen.getByTestId("worker-roll-value-comboChance");
    expect(comboVal.getAttribute("data-up")).toBe("false");

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("advances one stat per 400ms and completes after the last", () => {
    vi.useFakeTimers();
    const w = { ...createWorker(), name: "Vincent", avatar: 1 };
    const before = createBaseStats();
    const after = { ...before, goldPct: 0.03 };
    useGameStore.setState({
      roster: [w],
      lastAscendRoll: [{ id: w.id, levelBefore: 1, levelAfter: 2, statsBefore: before, statsAfter: after }],
    });
    const onComplete = vi.fn();
    render(<WorkerRollReveal skip={false} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    // 5 stat steps × 400ms.
    vi.advanceTimersByTime(5 * 400 + 10);
    expect(onComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ascension/WorkerRollReveal.test.tsx`
Expected: FAIL — new testids/props not present yet.

- [ ] **Step 3: Rewrite `WorkerRollReveal.tsx`**

Replace the ENTIRE file with:

```tsx
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store";
import {
  WORKER_STAT_KEYS,
  WORKER_STAT_LABELS,
  formatWorkerStatAbsolute,
  formatWorkerStatDeltaShort,
} from "@/components/painting/workerStatDisplay";
import { WORKER_AVATARS } from "@/components/painting/workerAvatarMap";
import styles from "./WorkerRollReveal.module.css";

interface Props {
  /** When true, jump straight to the fully-revealed end state. */
  skip: boolean;
  /** Fired once when the reveal finishes (or immediately when there is no roll). */
  onComplete: () => void;
}

const STEP_MS = 400;
const STEPS = WORKER_STAT_KEYS.length;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Post-ascend reveal of worker level-ups inside the cinematic blackout. One card
 * per leveled-up worker (avatar + name from the live roster by id, `Lv a→b`, and
 * the 5-stat sheet starting at the *before* values). A single shared step walks
 * the stats 0→5 at 400ms each, in sync across cards: an increased stat flips to
 * its after value (teal) with a `+#` chip; unchanged stats stay white. `skip` or
 * prefers-reduced-motion jumps to the end. Renders nothing for an office-less /
 * no-level-up ascend (and still calls `onComplete`).
 */
export function WorkerRollReveal({ skip, onComplete }: Props): JSX.Element | null {
  const roll = useGameStore((s) => s.lastAscendRoll);
  const roster = useGameStore((s) => s.roster);
  const hasRoll = !!roll && roll.length > 0;

  const [revealed, setRevealed] = useState(0);
  const completedRef = useRef(false);

  const complete = (): void => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  };

  // No roll → finish immediately.
  useEffect(() => {
    if (!hasRoll) complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoll]);

  // Drive the reveal, or jump to the end on skip / reduced motion.
  useEffect(() => {
    if (!hasRoll) return;
    if (skip || prefersReducedMotion()) {
      setRevealed(STEPS);
      return;
    }
    const id = window.setInterval(() => {
      setRevealed((r) => {
        const next = Math.min(STEPS, r + 1);
        if (next >= STEPS) window.clearInterval(id);
        return next;
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [hasRoll, skip]);

  // Fire onComplete once fully revealed.
  useEffect(() => {
    if (hasRoll && revealed >= STEPS) complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoll, revealed]);

  if (!hasRoll) return null;

  return (
    <div className={styles.reveal} data-testid="worker-roll-reveal">
      {roll!.map((entry) => {
        const w = roster.find((r) => r.id === entry.id);
        const name = w?.name ?? "Painter";
        const avatar = w?.avatar ?? 1;
        return (
          <div key={entry.id} className={styles.card} data-testid="worker-roll-card">
            <img
              className={styles.avatar}
              src={WORKER_AVATARS[avatar - 1]}
              alt=""
              aria-hidden="true"
              data-testid="worker-portrait-roll"
            />
            <div className={styles.name}>{name}</div>
            <div className={styles.level}>
              Lv {entry.levelBefore} <span className={styles.arrow}>→</span> {entry.levelAfter}
            </div>
            <ul className={styles.stats}>
              {WORKER_STAT_KEYS.map((key, k) => {
                const before = entry.statsBefore[key];
                const after = entry.statsAfter[key];
                const isRevealed = k < revealed;
                const up = isRevealed && after > before;
                const delta = up ? formatWorkerStatDeltaShort(key, before, after) : null;
                return (
                  <li key={key} className={styles.statRow} data-testid={`worker-roll-stat-${key}`}>
                    <span className={styles.statLabel}>{WORKER_STAT_LABELS[key]}</span>
                    {delta ? <span className={styles.delta}>{delta}</span> : null}
                    <span
                      className={`${styles.statValue} ${up ? styles.up : ""}`}
                      data-testid={`worker-roll-value-${key}`}
                      data-up={up ? "true" : "false"}
                    >
                      {formatWorkerStatAbsolute(key, up ? after : before)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `WorkerRollReveal.module.css`**

Replace the ENTIRE file with:

```css
/* Post-ascend worker cards on the cinematic blackout: avatar + name + level +
 * a 5-stat sheet. Increased stats flip to teal with a "+#" chip as the shared
 * step advances. Cards sit side by side. */
.reveal {
  margin: var(--s-5) 0 0 0;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
  gap: var(--s-5);
  max-width: 92vw;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--s-3);
  min-width: 168px;
}

.avatar {
  width: 64px;
  height: 64px;
  object-fit: contain;
  object-position: bottom center;
  image-rendering: pixelated;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.7));
}

.name {
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ink-0);
}

.level {
  font-family: var(--serif);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--gold);
  text-shadow: var(--gold-glow);
  white-space: nowrap;
}

.arrow {
  color: var(--gold-d);
  margin: 0 0.15em;
}

.stats {
  list-style: none;
  margin: var(--s-2) 0 0 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.statRow {
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  font-family: var(--mono);
  font-size: 12px;
}

.statLabel {
  color: var(--ink-2);
}

.delta {
  color: var(--teal);
  font-weight: 700;
  font-size: 11px;
}

/* pushed to the right edge; white until its stat is revealed-and-increased */
.statValue {
  margin-left: auto;
  color: #fff;
  font-weight: 600;
  transition: color 200ms ease;
}

.up {
  color: var(--teal);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/ascension/WorkerRollReveal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ascension/WorkerRollReveal.tsx src/components/ascension/WorkerRollReveal.module.css tests/components/ascension/WorkerRollReveal.test.tsx
git commit -m "ui(ascend): worker level-up cards with stat-by-stat teal reveal"
```

---

## Task 3: `AscendCinematicOverlay` two-stage click

**Files:**
- Modify: `src/components/ascension/AscendCinematicOverlay.tsx`
- Test: `tests/components/ascension/AscendCinematicOverlay.test.tsx` (create)
- Modify: `tests/routes/AscensionRoute.test.tsx` (the "hint after 4s" test)

- [ ] **Step 1: Write the failing overlay test**

Create `tests/components/ascension/AscendCinematicOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { AscendCinematicOverlay } from "@/components/ascension/AscendCinematicOverlay";

afterEach(cleanup);

function renderBlackout(onDismiss: () => void) {
  return render(
    <AscendCinematicOverlay phase="blackout" fameGain={100} quote="q" onDismiss={onDismiss} />,
  );
}

describe("AscendCinematicOverlay — two-stage click", () => {
  it("with no level-ups, the first click dismisses", () => {
    useGameStore.setState({ lastAscendRoll: null, roster: [] });
    const onDismiss = vi.fn();
    renderBlackout(onDismiss);
    fireEvent.click(screen.getByTestId("ascend-cinematic-overlay"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("with level-ups, the first click skips (no dismiss) and the second dismisses", () => {
    const w = { ...createWorker(), name: "Frida", avatar: 2 };
    const before = createBaseStats();
    const after = { ...before, goldPct: 0.03 };
    useGameStore.setState({
      roster: [w],
      lastAscendRoll: [{ id: w.id, levelBefore: 1, levelAfter: 2, statsBefore: before, statsAfter: after }],
    });
    const onDismiss = vi.fn();
    renderBlackout(onDismiss);
    const overlay = screen.getByTestId("ascend-cinematic-overlay");

    act(() => { fireEvent.click(overlay); }); // skip
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { fireEvent.click(overlay); }); // dismiss
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ascension/AscendCinematicOverlay.test.tsx`
Expected: FAIL — the second test fails (today's overlay dismisses on the FIRST click regardless of a roll).

- [ ] **Step 3: Update `AscendCinematicOverlay.tsx`**

Replace the body of the component (the `useState(hintVisible)` + its effect + `handleClick` + the `WorkerRollReveal` render + hint render) so the file reads:

```tsx
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatShort } from "@/core/formatter";
import { WorkerRollReveal } from "./WorkerRollReveal";
import styles from "./AscendCinematicOverlay.module.css";

export type CinematicPhase = "opening" | "blackout";

interface Props {
  phase: CinematicPhase | null;
  fameGain: number;
  quote: string;
  onDismiss: () => void;
}

export function AscendCinematicOverlay({
  phase,
  fameGain,
  quote,
  onDismiss,
}: Props): JSX.Element | null {
  const [skip, setSkip] = useState(false);
  const [revealDone, setRevealDone] = useState(false);

  // Reset before each blackout (during the opening / idle phases, when the
  // reveal is not mounted, so the child's onComplete can't race the reset).
  useEffect(() => {
    if (phase !== "blackout") {
      setSkip(false);
      setRevealDone(false);
    }
  }, [phase]);

  if (phase === null) return null;

  const isBlackout = phase === "blackout";
  const className = `${styles.root} ${isBlackout ? styles.blackout : styles.opening}`;

  const handleClick = (): void => {
    if (!isBlackout) return;
    if (!revealDone) setSkip(true); // 1st click: skip the animation to the end
    else onDismiss(); // 2nd click (or no level-ups): leave
  };

  const node = (
    <div
      className={className}
      onClick={handleClick}
      data-testid="ascend-cinematic-overlay"
      data-phase={phase}
      role={isBlackout ? "button" : undefined}
      aria-label={isBlackout ? "Continue past ascension summary" : undefined}
    >
      {isBlackout && (
        <>
          <p className={styles.gain} data-testid="ascend-cinematic-gain">
            +{formatShort(fameGain)} fame gained
          </p>
          <p className={styles.quote} data-testid="ascend-cinematic-quote">
            {quote}
          </p>
          <WorkerRollReveal skip={skip} onComplete={() => setRevealDone(true)} />
          <p className={styles.hint} data-testid="ascend-cinematic-hint">
            {revealDone ? "— click to continue —" : "— click to skip —"}
          </p>
        </>
      )}
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
```

- [ ] **Step 4: Run the overlay test to verify it passes**

Run: `npx vitest run tests/components/ascension/AscendCinematicOverlay.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Update the AscensionRoute "hint" test**

In `tests/routes/AscensionRoute.test.tsx`, replace the test
`it("'click to continue' hint appears only after 4 seconds in the blackout phase", …)`
(it relied on the removed 4 s timer) with — these ascends have no office workers, so the
reveal completes immediately and the hint is the "continue" variant from the start:

```tsx
  it("shows the 'click to continue' hint in the blackout when no workers leveled up", () => {
    useGameStore.setState({ inspiration: big(12_000) });
    const { container } = renderAscensionRoute();
    fireEvent.click(screen.getByRole("button", { name: /step through/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Ascend/i }));
    const video = container.querySelector<HTMLVideoElement>('[data-testid="cavern-video"]');
    fireEvent.ended(video!);
    const hint = screen.getByTestId("ascend-cinematic-hint");
    expect(hint.textContent).toMatch(/continue/i);
  });
```

- [ ] **Step 6: Run the AscensionRoute suite**

Run: `npx vitest run tests/routes/AscensionRoute.test.tsx`
Expected: PASS — including the unchanged "clicking the blackout overlay dismisses it" test
(no workers → reveal completes immediately → first click dismisses).

- [ ] **Step 7: Commit**

```bash
git add src/components/ascension/AscendCinematicOverlay.tsx tests/components/ascension/AscendCinematicOverlay.test.tsx tests/routes/AscensionRoute.test.tsx
git commit -m "ui(ascend): blackout click skips the reveal, then dismisses"
```

---

## Task 4: Full verification + eyeball

**Files:** none (verification only)

- [ ] **Step 1: Run the ascension + painting suites**

Run: `npx vitest run tests/components/ascension/ tests/components/painting/ tests/routes/AscensionRoute.test.tsx`
Expected: PASS (all).

- [ ] **Step 2: Eyeball on the dev server (`localhost:5173`)**

Hire a worker or two (skill tree → roster slot), build inspiration to the ascend threshold,
and Ascend. Confirm: the blackout shows `+fame`, the quote, then worker cards side by side
(avatar + name + `Lv a→b`); each card's increased stats tick to teal one-by-one (≈400 ms
apart) with a `+#` next to the label; the first click jumps everything to the final state and
the hint switches to "— click to continue —"; the second click returns to the game.

- [ ] **Step 3: Final confirmation**

No commit (task steps committed their own work). Report results; deploy is user-approved.

---

## Self-Review

- **Spec coverage:** compact delta (T1) ✓; cards with avatar/name/level from roster-by-id (T2) ✓;
  before-values white → per-stat teal + `+#` at 400 ms, in sync across cards (T2) ✓; reduced-motion
  + skip jump-to-end (T2) ✓; two-stage click + hint text + no-roll instant dismiss (T3) ✓; tests
  (T1–T3) + eyeball (T4) ✓.
- **Placeholders:** none — every step has concrete code/commands.
- **Type consistency:** `WorkerRollReveal` props `{ skip: boolean; onComplete: () => void }` defined
  T2, consumed T3; `formatWorkerStatDeltaShort(key, before, after)` defined T1, used T2; testids
  `worker-roll-card` / `worker-roll-stat-${key}` / `worker-roll-value-${key}` / `worker-portrait-roll`
  consistent between component (T2) and tests (T2/T3); `AscendCinematicOverlay` keeps its existing
  `ascend-cinematic-*` testids and `CinematicPhase` export.
- **Race safety:** the overlay resets `skip`/`revealDone` only on non-blackout phases, so the child's
  `onComplete` (which sets `revealDone`) can't be clobbered by the reset during blackout.
