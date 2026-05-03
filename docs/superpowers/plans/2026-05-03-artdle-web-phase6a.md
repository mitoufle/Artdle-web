# Artdle Web — Phase 6a Implementation Plan: Motion Polish + Persistence Polish + v1.0-RC Ship

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all of Phase 6a per the spec at `docs/superpowers/specs/2026-05-03-phase6-ship-design.md`: 4 Motion polish targets, 3 persistence polish carry-overs (telemetry hook + lifecycle consolidation + flush-error routing), README write-up with screenshots, deploy-ready production build verification, and push to `origin/main`. Repo ends Phase 6a in v1.0-RC state — feature-complete, polished, deploy-ready, with the `v1.0` tag still pending the post-playtest 6b plan.

**Architecture:** A new `src/systems/telemetry.ts` (function-export with module-level mutable default; `reportError`, `setErrorReporter`, `resetErrorReporter`) provides the error-routing seam. `src/core/tickLoop.ts` is refactored to expose `pauseTickLoop()` / `resumeTickLoop()` separately from `startTickLoop()` / `stopTickLoop()`, removing its internal `visibilitychange` listener. `src/systems/lifecycle.ts` (new) installs the single `visibilitychange` + `beforeunload` listener pair via `installLifecycle(hooks)` (orchestrator-shape; testable in isolation) and ships `defaultLifecycleHooks` that wire `pauseTickLoop` + `persistedAdapter.flush().catch(reportError)` together. `src/main.tsx` swaps its two inline `useEffect` listeners for one `installLifecycle(defaultLifecycleHooks)` call. `canvasSlice` adds a `lastSale: { id: number; amount: Big } | null` transient field (set on sale, cleared after the floating-text animation completes; stripped from `partialize` so rehydrate doesn't replay an animation). A new `<FloatingGoldText>` widget subscribes to `lastSale` via `<motion.div>` keyed on `lastSale.id`; `onAnimationComplete` calls `clearLastSale()`. Tree stage transitions, fame pulse, and Workshop popup mount/unmount each get small `<AnimatePresence>` / `<motion.div>` wrappers honoring `prefers-reduced-motion` via Motion's `useReducedMotion()` hook.

**Tech Stack:** React 19 + TypeScript 6 strict + Vite 8 + Tailwind 4 (CSS-first) + Zustand 5 + `motion` 12 + `@testing-library/react` 16 + `@testing-library/user-event` 14 + Vitest 4 + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-03-phase6-ship-design.md` is the authoritative design.

**Predecessor handover:** `docs/HANDOVER.md` (post-Phase-5 state, freshly updated 2026-05-03).

---

## Pre-flight (read once before starting Task 1)

### Locked design decisions (resolved here from spec §6 open questions)

1. **FloatingGoldText event source = `lastSale: { id: number; amount: Big } | null` on `canvasSlice`.** Counter-as-key pattern (not timestamp) — avoids clock-skew weirdness; the `id` increments on each sale and serves as the `<motion.div>`'s `key`. `amount` carries the actual gold-gained value for the floating text. `clearLastSale()` action zeros it after `onAnimationComplete`. Stripped from `partialize` so rehydrate doesn't replay an animation.

2. **`prefers-reduced-motion` = per-component `useReducedMotion()` hook from `motion/react`.** Motion's JS-driven animations don't honor CSS-level `@media (prefers-reduced-motion)`, so the per-component hook is the only correct path. Each animated component reads the hook and short-circuits to a near-zero duration (`0.01s`) plus suppressed motion params. One-line per component.

3. **Telemetry hook API = function-export with module-level mutable default + reset helper.** `reportError(err, context)` is the call-site API; `setErrorReporter(fn)` swaps the default for tests / future v2.0 sinks; `resetErrorReporter()` restores the default. The default is a captured closure (`_defaultOnError`) so reset doesn't depend on the call site re-typing the implementation.

4. **`lifecycle.ts` owns BOTH `visibilitychange` AND `beforeunload`.** Same problem (lifecycle event), same orchestrator. `installLifecycle({onHide, onShow, onUnload})` wires both. `defaultLifecycleHooks` ship the production wiring (pause+flush on hide; resume on show; flush on unload). main.tsx's two prior `useEffect` listeners collapse into one `installLifecycle(defaultLifecycleHooks)` call.

5. **`tickLoop.ts` exposes `pauseTickLoop()` and `resumeTickLoop()` separately from `start`/`stop`.** Internal `_visibilityHandler` is removed — visibility orchestration now lives in `lifecycle.ts`. Existing tickLoop tests that assert visibility-pause behavior move (logically) to the new lifecycle.test.ts.

6. **WorkshopPopup motion wrapping touches the inner card only.** Backdrop stays plain CSS (no motion). The inner card gets `<motion.div data-testid="workshop-popup-card">` (testid moved from the plain `<div>`) inside `<AnimatePresence>` keyed on `open`. C-1 ensured the test selector is testid-based, so no test changes needed for this swap.

### Phase 0–5 lessons baked into this plan

- **Literal-union types** for compile-time typo protection (no new ones in Phase 6a).
- **Save-format JSDoc** above persisted literal-unions — `lastSale.id` is a number, no rename risk; `lastSale` itself is non-persisted, JSDoc warns about that.
- **`Object.freeze` on initial-state constants** — `initialCanvasState` already exists; the `lastSale: null` extension keeps it frozen.
- **Selectors only; never `useGameStore()` no-arg** in components.
- **`useGameStore.getState()` in render is forbidden** (I-1 / `docs/agent_docs/ui-patterns.md`). Acceptable in event handlers (mouseEnter, onClick, `onAnimationComplete`) and inside Hoverable factory bodies.
- **Helpers like `getCurrentSlotCount(state)` take `GameStore`** — view callers construct narrow helper-state via `as unknown as GameStore` cast.
- **`partialize` MUST strip `lastSale`** alongside the other transients (`hoverTitle`, `hoverBody`, `hoverFooter`, `workshopPopupOpen`).
- **RTL 16 + Vitest globals auto-cleanup** between tests. Do NOT add `afterEach(cleanup)` blocks. Do NOT import `cleanup`.
- **`@testing-library/jest-dom` matchers** are auto-loaded by `vitest.setup.ts`.
- **Big assertions use `toBeCloseTo`** when the value flows through `Big.pow`.
- **Conventional commit prefixes only:** `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `core:`, `store:`, `ui:`, `config:`, `chore:`.

### Run commands cheat sheet

| Action | Command |
|---|---|
| Run all tests | `npm test` |
| Run one test file | `npm test -- tests/path/to/file.test.tsx` |
| Run typecheck | `npx tsc -b --noEmit` |
| Run lint | `npm run lint` |
| Dev server (manual smoke) | `npm run dev` |
| Production build | `npm run build` |
| Production preview | `npm run preview` |

### Standard test scaffolding

UI tests follow the Phase 4/5 pattern:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

beforeEach(() => {
  useGameStore.setState({ /* relevant fields */ });
});
```

**Do NOT add `afterEach(cleanup)`** — RTL 16 + Vitest globals auto-cleanup.

For tests that swap module-level state (telemetry reporter, jsdom `document.hidden`), restore in `afterEach`:

```ts
import { afterEach } from "vitest";
import { resetErrorReporter } from "@/systems/telemetry";

afterEach(() => {
  resetErrorReporter();
});
```

---

## File structure

### New files

```
src/systems/telemetry.ts                       Task 1
src/systems/lifecycle.ts                       Task 3
src/store/canvasSlice.ts                       (extended in Task 4 — not new)
src/ui/widgets/FloatingGoldText.tsx            Task 5
README.md                                      Task 9 (root)
docs/screenshots/home-tree.png                 Task 9
docs/screenshots/painting-canvas.png           Task 9
docs/screenshots/ascension-ready.png           Task 9

tests/systems/telemetry.test.ts                Task 1
tests/systems/lifecycle.test.ts                Task 3
tests/ui/widgets/FloatingGoldText.test.tsx     Task 5
```

### Edited files

```
src/core/tickLoop.ts                           Task 2 (extract pause/resume; drop internal visibility handler)
tests/core/tickLoop.test.ts                    Task 2 (update existing visibility-handler tests; add pause/resume tests)
src/main.tsx                                   Task 3 (replace 2 useEffect listeners with installLifecycle)
src/store/canvasSlice.ts                       Task 4 (add lastSale field + clearLastSale action; set lastSale on sale)
src/store/index.ts                             Task 4 (add lastSale to partialize strip + Omit type)
tests/store/canvasSlice.test.ts                Task 4 (add lastSale assertions to existing sale-fires tests + new clearLastSale test)
tests/store/persistence-integration.test.ts    Task 4 (assert lastSale stripped) + Task 3 (flush-rejection routes through reportError)
src/ui/views/PaintingView.tsx                  Task 5 (mount FloatingGoldText keyed on lastSale.id; section becomes relative)
src/ui/views/HomeView.tsx                      Task 6 (wrap stage header in AnimatePresence keyed on currentStage)
src/ui/widgets/CurrencyDisplay.tsx             Task 7 (fame pulse decoration via useReducedMotion + className toggle)
tests/ui/widgets/BottomBar.test.tsx            Task 7 (add fame-pulse-toggles test)
src/ui/popups/WorkshopPopup.tsx                Task 8 (wrap inner card in motion.div + AnimatePresence)
README.md                                      Task 9 (write content)
```

### Module boundary contract

- `src/systems/telemetry.ts`: zero dependencies on app code. Exports `reportError`, `setErrorReporter`, `resetErrorReporter`.
- `src/systems/lifecycle.ts`: imports `persistedAdapter` (from `./persistence`), `reportError` (from `./telemetry`), `pauseTickLoop` + `resumeTickLoop` (from `@/core/tickLoop`). Exports `LifecycleHooks` interface, `installLifecycle`, `defaultLifecycleHooks`. NO React imports.
- `src/core/tickLoop.ts`: zero new imports. Exports gain `pauseTickLoop`, `resumeTickLoop`. Existing `_visibilityHandler` deleted.
- `src/main.tsx`: drops `persistedAdapter` direct import (now reached via `defaultLifecycleHooks`); imports `installLifecycle`, `defaultLifecycleHooks` from `@/systems/lifecycle`.
- `src/store/canvasSlice.ts`: imports gain `Big` type from `@/core/bigNumber` (for the `lastSale.amount` field type).
- `src/store/index.ts`: partialize destructure adds `lastSale: _ls`; `Omit<>` type-arg list adds `"lastSale"`.
- `src/ui/widgets/FloatingGoldText.tsx`: imports `motion`, `useReducedMotion` from `motion/react`; `formatBig` from `@/core/formatter`; `Big` type from `@/core/bigNumber`.
- `src/ui/views/PaintingView.tsx`: imports gain `FloatingGoldText`. Subscribes to `lastSale`, `clearLastSale`. The first `<section>` (canvas state label/progress) gains `relative` to its className so the absolute-positioned floating text is constrained.
- `src/ui/views/HomeView.tsx`: imports gain `motion`, `AnimatePresence`, `useReducedMotion` from `motion/react`. Stage header `<h2>` is wrapped in `<AnimatePresence mode="wait">` with the inner content in a `<motion.div>` keyed on `currentStage`.
- `src/ui/widgets/CurrencyDisplay.tsx`: imports gain `useEffect`, `useState`, `useRef` from `react`; `useReducedMotion` from `motion/react`. Adds a `data-pulsing` attribute or `className` toggle on the value `<span>`.
- `src/ui/popups/WorkshopPopup.tsx`: imports gain `motion`, `AnimatePresence`, `useReducedMotion` from `motion/react`. The inner card `<div>` becomes a `<motion.div>`; `<AnimatePresence>` wraps the conditional render.

---

## Task 1: Telemetry hook scaffold

**Files:**
- Create: `src/systems/telemetry.ts`
- Test: `tests/systems/telemetry.test.ts`

**Goal:** Exposes `reportError(err, context)` as the central error-reporting seam. Default sink is `console.error` with a `[context]` prefix. `setErrorReporter(fn)` and `resetErrorReporter()` allow tests + future v2.0 backends to swap the sink without touching call sites.

- [ ] **Step 1: Write the failing test**

Create `tests/systems/telemetry.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  reportError,
  setErrorReporter,
  resetErrorReporter,
} from "@/systems/telemetry";

describe("telemetry", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resetErrorReporter();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    resetErrorReporter();
  });

  it("default reporter calls console.error with [context] prefix", () => {
    const err = new Error("boom");
    reportError(err, "test.context");
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe("[test.context]");
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toBe(err);
  });

  it("setErrorReporter swaps the default sink", () => {
    const customSink = vi.fn();
    setErrorReporter(customSink);
    const err = new Error("boom");
    reportError(err, "swapped");
    expect(customSink).toHaveBeenCalledOnce();
    expect(customSink).toHaveBeenCalledWith(err, "swapped");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("resetErrorReporter restores the default sink", () => {
    setErrorReporter(vi.fn());
    resetErrorReporter();
    const err = new Error("after reset");
    reportError(err, "ctx");
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe("[ctx]");
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toBe(err);
  });

  it("multiple reportError calls all reach the configured sink", () => {
    const customSink = vi.fn();
    setErrorReporter(customSink);
    reportError(new Error("a"), "ctx.a");
    reportError(new Error("b"), "ctx.b");
    reportError(new Error("c"), "ctx.c");
    expect(customSink).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/systems/telemetry.test.ts`
Expected: FAIL with module-not-found error on `@/systems/telemetry`.

- [ ] **Step 3: Write minimal implementation**

Create `src/systems/telemetry.ts`:

```ts
/**
 * Central error-reporting seam. Call sites use `reportError(err, context)`.
 * Tests and v2.0+ telemetry backends swap the default `console.error` sink
 * via `setErrorReporter(fn)`; `resetErrorReporter()` restores the default.
 *
 * The default is captured in `_defaultOnError` so reset doesn't depend on
 * the caller re-typing the implementation.
 */
type ErrorReporter = (err: Error, context: string) => void;

const _defaultOnError: ErrorReporter = (err, context) => {
  console.error(`[${context}]`, err);
};

let _onError: ErrorReporter = _defaultOnError;

export function reportError(err: Error, context: string): void {
  _onError(err, context);
}

export function setErrorReporter(fn: ErrorReporter): void {
  _onError = fn;
}

export function resetErrorReporter(): void {
  _onError = _defaultOnError;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/systems/telemetry.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run typecheck and lint**

Run: `npx tsc -b --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: 1 pre-existing warning, no new ones.

- [ ] **Step 6: Commit**

```bash
git add src/systems/telemetry.ts tests/systems/telemetry.test.ts
git commit -m "feat(telemetry): error-reporter seam with swappable default sink

Phase 6a task 1. New src/systems/telemetry.ts exposes reportError(err,
context) as the central error-routing API. Default sink is console.error
with a [context] prefix. setErrorReporter(fn) swaps for tests and v2.0+
backends; resetErrorReporter() restores the captured default.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: tickLoop refactor — expose pauseTickLoop / resumeTickLoop

**Files:**
- Modify: `src/core/tickLoop.ts`
- Modify: `tests/core/tickLoop.test.ts`

**Goal:** Decouple tickLoop from the `visibilitychange` event. The new `pauseTickLoop()` / `resumeTickLoop()` API lets `lifecycle.ts` (Task 3) drive pause/resume on visibility changes externally. Existing internal `_visibilityHandler` is deleted; `startTickLoop()` no longer registers a `visibilitychange` listener.

- [ ] **Step 1: Read the existing tickLoop test file**

Run: `cat tests/core/tickLoop.test.ts`

Identify which tests currently exercise the internal `visibilitychange` handler — they will be replaced by tests in Task 3's `lifecycle.test.ts`.

- [ ] **Step 2: Write the failing tests for the new API**

Edit `tests/core/tickLoop.test.ts` — add this describe block (alongside whatever already exists):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  startTickLoop,
  stopTickLoop,
  pauseTickLoop,
  resumeTickLoop,
  _testing,
} from "@/core/tickLoop";

describe("tickLoop pause/resume API", () => {
  beforeEach(() => {
    stopTickLoop();
  });

  it("pauseTickLoop() while running halts step execution", () => {
    const ticks: number[] = [];
    startTickLoop((delta) => ticks.push(delta));
    expect(_testing.running).toBe(true);
    pauseTickLoop();
    expect(_testing.running).toBe(false);
    stopTickLoop();
  });

  it("resumeTickLoop() after pause restarts step execution and resets _last", () => {
    const ticks: number[] = [];
    startTickLoop((delta) => ticks.push(delta));
    pauseTickLoop();
    expect(_testing.running).toBe(false);
    resumeTickLoop();
    expect(_testing.running).toBe(true);
    stopTickLoop();
  });

  it("pauseTickLoop() is idempotent when already paused", () => {
    const ticks: number[] = [];
    startTickLoop((delta) => ticks.push(delta));
    pauseTickLoop();
    pauseTickLoop(); // second call must not throw or corrupt state
    expect(_testing.running).toBe(false);
    stopTickLoop();
  });

  it("resumeTickLoop() with no onTick installed is a no-op (does not start)", () => {
    // Without start having been called, _onTick is null; resume must early-return.
    resumeTickLoop();
    expect(_testing.running).toBe(false);
  });

  it("startTickLoop does NOT register a visibilitychange listener", () => {
    // Spy-based check: replace document.addEventListener for the duration of the call.
    const spy = vi.spyOn(document, "addEventListener");
    startTickLoop((d) => void d);
    const visListenerCalls = spy.mock.calls.filter(
      ([type]) => type === "visibilitychange",
    );
    expect(visListenerCalls.length).toBe(0);
    stopTickLoop();
    spy.mockRestore();
  });
});
```

If the existing test file has an old `describe("tickLoop visibility handler", ...)` block (or similar) that asserts the internal `_visibilityHandler` behavior, **delete that block entirely** — the visibility responsibility is moving to `lifecycle.ts` and re-tested there in Task 3. (Read the file first to see what exists; the typical pattern was to fire `document.dispatchEvent(new Event("visibilitychange"))` and assert `_running` toggles.)

Also add the `vi` import if missing:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/core/tickLoop.test.ts`
Expected: FAIL — `pauseTickLoop` / `resumeTickLoop` are not exported.

- [ ] **Step 4: Refactor tickLoop.ts**

Rewrite `src/core/tickLoop.ts`:

```ts
/**
 * RAF-driven tick loop with explicit pause/resume.
 * v1 explicitly has NO offline catch-up: when paused, no ticking; on resume,
 * `_last` resets to `now` so the first post-resume frame is delta=0.
 *
 * The 24h F-style hybrid catch-up arrives in v2.0.
 *
 * Lifecycle integration (visibilitychange/beforeunload) lives in
 * `src/systems/lifecycle.ts`. tickLoop is intentionally agnostic — callers
 * drive `pauseTickLoop()` / `resumeTickLoop()` in response to whatever events
 * they care about.
 */

const MAX_FRAME_DELTA_SECONDS = 1.0; // cap per-frame delta to avoid spirals

type TickFn = (deltaSeconds: number) => void;

let _last = 0;
let _rafId = 0;
let _running = false;
let _onTick: TickFn | null = null;

function step(now: number): void {
  if (!_running || !_onTick) return;
  const deltaSeconds = Math.min((now - _last) / 1000, MAX_FRAME_DELTA_SECONDS);
  _last = now;
  _onTick(deltaSeconds);
  _rafId = requestAnimationFrame(step);
}

export function startTickLoop(onTick: TickFn): void {
  if (_running) return;
  _onTick = onTick;
  _last = performance.now();
  _running = true;
  _rafId = requestAnimationFrame(step);
}

export function stopTickLoop(): void {
  _running = false;
  cancelAnimationFrame(_rafId);
  _onTick = null;
}

/**
 * Pause the running tick loop. Does NOT clear `_onTick` — a subsequent
 * `resumeTickLoop()` resumes ticking against the same callback.
 * Idempotent (no-op if already paused).
 */
export function pauseTickLoop(): void {
  if (!_running) return;
  _running = false;
  cancelAnimationFrame(_rafId);
}

/**
 * Resume a paused tick loop. No-op if `_onTick` is null (start was never
 * called, or stopTickLoop cleared it). Resets `_last` to `now` so the first
 * post-resume frame has delta ≈ 0 — v1 ignores elapsed paused time.
 */
export function resumeTickLoop(): void {
  if (_running) return;
  if (!_onTick) return;
  _last = performance.now();
  _running = true;
  _rafId = requestAnimationFrame(step);
}

export const _testing = {
  get running() { return _running; },
  setLast(t: number) { _last = t; },
  callStep(now: number) { step(now); },
  MAX_FRAME_DELTA_SECONDS,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/core/tickLoop.test.ts`
Expected: PASS — both old (start/stop/step) and new (pause/resume) test blocks green.

- [ ] **Step 6: Run typecheck and full test suite**

Run: `npx tsc -b --noEmit`
Expected: clean. (`main.tsx` still works because it only imports `startTickLoop`/`stopTickLoop`, which haven't changed signature.)

Run: `npm test`
Expected: PASS — 239 + (the few new ones added) = ~243-244. No regressions.

- [ ] **Step 7: Commit**

```bash
git add src/core/tickLoop.ts tests/core/tickLoop.test.ts
git commit -m "refactor(core): extract pauseTickLoop/resumeTickLoop from tickLoop visibility handler

Phase 6a task 2. Removes the internal _visibilityHandler. tickLoop is now
agnostic to lifecycle events — callers drive pause/resume externally.
Lifecycle integration moves to src/systems/lifecycle.ts (Task 3).

main.tsx is unchanged in this commit (still calls only start/stop). Task 3
swaps its inline visibility wiring for installLifecycle().

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Lifecycle orchestrator + main.tsx integration

**Files:**
- Create: `src/systems/lifecycle.ts`
- Create: `tests/systems/lifecycle.test.ts`
- Modify: `src/main.tsx`
- Modify: `tests/store/persistence-integration.test.ts` (1 new test for flush-rejection routing)

**Goal:** A single orchestrator owns the `visibilitychange` + `beforeunload` listener pair. `installLifecycle({onHide, onShow, onUnload})` is the testable injection-shape. `defaultLifecycleHooks` ships the production wiring (pause+flush on hide, resume on show, flush on unload) with errors routed through `reportError`. main.tsx swaps its 2 prior `useEffect` listeners for one `installLifecycle(defaultLifecycleHooks)` call.

- [ ] **Step 1: Write the failing tests for installLifecycle**

Create `tests/systems/lifecycle.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installLifecycle, defaultLifecycleHooks } from "@/systems/lifecycle";
import { setErrorReporter, resetErrorReporter } from "@/systems/telemetry";
import { persistedAdapter } from "@/systems/persistence";
import * as tickLoop from "@/core/tickLoop";

describe("installLifecycle()", () => {
  let cleanup: () => void = () => {};
  let hiddenSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    cleanup = () => {};
  });

  afterEach(() => {
    cleanup();
    if (hiddenSpy) {
      hiddenSpy.mockRestore();
      hiddenSpy = null;
    }
  });

  function setHidden(value: boolean): void {
    hiddenSpy?.mockRestore();
    hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(value);
  }

  it("fires onHide when visibilitychange and document.hidden is true", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hooks.onHide).toHaveBeenCalledOnce();
    expect(hooks.onShow).not.toHaveBeenCalled();
  });

  it("fires onShow when visibilitychange and document.hidden is false", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hooks.onShow).toHaveBeenCalledOnce();
    expect(hooks.onHide).not.toHaveBeenCalled();
  });

  it("fires onUnload on beforeunload", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    window.dispatchEvent(new Event("beforeunload"));
    expect(hooks.onUnload).toHaveBeenCalledOnce();
  });

  it("cleanup() removes both listeners", () => {
    const hooks = { onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() };
    cleanup = installLifecycle(hooks);
    cleanup();
    cleanup = () => {};
    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("beforeunload"));
    expect(hooks.onHide).not.toHaveBeenCalled();
    expect(hooks.onUnload).not.toHaveBeenCalled();
  });
});

describe("defaultLifecycleHooks", () => {
  let pauseSpy: ReturnType<typeof vi.spyOn>;
  let resumeSpy: ReturnType<typeof vi.spyOn>;
  let flushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pauseSpy = vi.spyOn(tickLoop, "pauseTickLoop").mockImplementation(() => {});
    resumeSpy = vi.spyOn(tickLoop, "resumeTickLoop").mockImplementation(() => {});
    flushSpy = vi.spyOn(persistedAdapter, "flush").mockResolvedValue();
    resetErrorReporter();
  });

  afterEach(() => {
    pauseSpy.mockRestore();
    resumeSpy.mockRestore();
    flushSpy.mockRestore();
    resetErrorReporter();
  });

  it("onHide pauses tickLoop AND triggers persist flush", () => {
    defaultLifecycleHooks.onHide();
    expect(pauseSpy).toHaveBeenCalledOnce();
    expect(flushSpy).toHaveBeenCalledOnce();
  });

  it("onShow resumes tickLoop only (no flush)", () => {
    defaultLifecycleHooks.onShow();
    expect(resumeSpy).toHaveBeenCalledOnce();
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it("onUnload triggers persist flush only (no pause)", () => {
    defaultLifecycleHooks.onUnload();
    expect(flushSpy).toHaveBeenCalledOnce();
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it("onHide flush rejection is routed through reportError", async () => {
    const errorSink = vi.fn();
    setErrorReporter(errorSink);
    flushSpy.mockRejectedValueOnce(new Error("hide-flush-boom"));

    defaultLifecycleHooks.onHide();
    // Allow the promise + .catch to settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(errorSink).toHaveBeenCalledOnce();
    const [err, ctx] = errorSink.mock.calls[0]!;
    expect((err as Error).message).toBe("hide-flush-boom");
    expect(ctx).toBe("persist.flush.visibilitychange");
  });

  it("onUnload flush rejection is routed through reportError", async () => {
    const errorSink = vi.fn();
    setErrorReporter(errorSink);
    flushSpy.mockRejectedValueOnce(new Error("unload-flush-boom"));

    defaultLifecycleHooks.onUnload();
    await new Promise((r) => setTimeout(r, 0));

    expect(errorSink).toHaveBeenCalledOnce();
    const [err, ctx] = errorSink.mock.calls[0]!;
    expect((err as Error).message).toBe("unload-flush-boom");
    expect(ctx).toBe("persist.flush.beforeunload");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/systems/lifecycle.test.ts`
Expected: FAIL with module-not-found on `@/systems/lifecycle`.

- [ ] **Step 3: Write the lifecycle.ts implementation**

Create `src/systems/lifecycle.ts`:

```ts
import { persistedAdapter } from "./persistence";
import { reportError } from "./telemetry";
import { pauseTickLoop, resumeTickLoop } from "@/core/tickLoop";

/**
 * Hooks injected into `installLifecycle`. The orchestrator stays agnostic;
 * production wiring lives in `defaultLifecycleHooks` below.
 */
export interface LifecycleHooks {
  /** Tab/page becoming hidden (visibilitychange + document.hidden=true). */
  onHide: () => void;
  /** Tab/page becoming visible (visibilitychange + document.hidden=false). */
  onShow: () => void;
  /** Page about to unload (beforeunload). */
  onUnload: () => void;
}

/**
 * Install the single visibilitychange + beforeunload listener pair.
 * Returns a cleanup function that removes both. Designed to be called once
 * after rehydration completes (see `src/main.tsx`).
 */
export function installLifecycle(hooks: LifecycleHooks): () => void {
  const onVisChange = (): void => {
    if (document.hidden) hooks.onHide();
    else hooks.onShow();
  };
  document.addEventListener("visibilitychange", onVisChange);
  window.addEventListener("beforeunload", hooks.onUnload);
  return (): void => {
    document.removeEventListener("visibilitychange", onVisChange);
    window.removeEventListener("beforeunload", hooks.onUnload);
  };
}

/**
 * Production hooks: pause+flush on hide, resume on show, flush on unload.
 * Flush rejections are routed through `reportError` so background save
 * failures are observable instead of becoming UnhandledPromiseRejections.
 */
export const defaultLifecycleHooks: LifecycleHooks = {
  onHide: (): void => {
    pauseTickLoop();
    void persistedAdapter.flush().catch((err: unknown) =>
      reportError(err as Error, "persist.flush.visibilitychange"),
    );
  },
  onShow: (): void => {
    resumeTickLoop();
  },
  onUnload: (): void => {
    void persistedAdapter.flush().catch((err: unknown) =>
      reportError(err as Error, "persist.flush.beforeunload"),
    );
  },
};
```

- [ ] **Step 4: Run lifecycle tests to verify they pass**

Run: `npm test -- tests/systems/lifecycle.test.ts`
Expected: PASS — 9 tests (4 installLifecycle + 5 defaultLifecycleHooks).

- [ ] **Step 5: Refactor main.tsx**

Edit `src/main.tsx`. Replace the imports of `persistedAdapter` and the two `useEffect` listener blocks with a single `installLifecycle(defaultLifecycleHooks)` call:

```ts
import { StrictMode, useEffect, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { useGameStore } from "@/store";
import { LoadingScreen } from "@/ui/widgets/LoadingScreen";
import { App } from "@/App";
import { startTickLoop, stopTickLoop } from "@/core/tickLoop";
import { installLifecycle, defaultLifecycleHooks } from "@/systems/lifecycle";
import { big } from "@/core/bigNumber";
import "./index.css";

// Dev-only: expose store + helpers on window for DevTools console smoke tests.
// Stripped from production builds via the import.meta.env.DEV check.
if (import.meta.env.DEV) {
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).useGameStore =
    useGameStore;
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).big = big;
}

function Bootstrap(): JSX.Element {
  const [hydrated, setHydrated] = useState<boolean>(useGameStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  // Start the RAF tick loop after hydration. tickLoop.startTickLoop guards
  // against double-start (StrictMode dev mounts effects twice).
  useEffect(() => {
    if (!hydrated) return;
    startTickLoop((delta) => useGameStore.getState().tickAll(delta));
    return () => stopTickLoop();
  }, [hydrated]);

  // Single lifecycle install: visibilitychange (pause+flush / resume) +
  // beforeunload (flush). Both routes go through `reportError` on flush
  // rejection. See `src/systems/lifecycle.ts`.
  useEffect(() => {
    if (!hydrated) return;
    return installLifecycle(defaultLifecycleHooks);
  }, [hydrated]);

  if (!hydrated) return <LoadingScreen />;
  return <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found in index.html");

createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
```

- [ ] **Step 6: Add persistence-integration test for end-to-end routing**

Edit `tests/store/persistence-integration.test.ts`. Append a new describe block at the bottom (do not modify existing blocks):

```ts
import { defaultLifecycleHooks } from "@/systems/lifecycle";
import { setErrorReporter, resetErrorReporter } from "@/systems/telemetry";

describe("persistence integration — flush error routing through telemetry", () => {
  beforeEach(() => {
    resetErrorReporter();
  });

  afterEach(() => {
    resetErrorReporter();
    vi.restoreAllMocks();
  });

  it("defaultLifecycleHooks.onUnload routes flush rejection to the configured reporter", async () => {
    const errorSink = vi.fn();
    setErrorReporter(errorSink);
    vi.spyOn(persistedAdapter, "flush").mockRejectedValueOnce(new Error("integration-boom"));

    defaultLifecycleHooks.onUnload();
    await new Promise((r) => setTimeout(r, 0));

    expect(errorSink).toHaveBeenCalledOnce();
    const [err, ctx] = errorSink.mock.calls[0]!;
    expect((err as Error).message).toBe("integration-boom");
    expect(ctx).toBe("persist.flush.beforeunload");
  });
});
```

Make sure `vi` is imported at the top of the file:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
```

(If `afterEach` was missing previously, add it.)

- [ ] **Step 7: Run all tests + typecheck**

Run: `npm test`
Expected: PASS — 239 + ~14 new = ~253. No regressions.

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 8: Manual smoke check (optional but recommended)**

Run: `npm run dev`. In the browser, open DevTools console. Switch tabs and back; observe no errors. Hard-reload; observe no errors. Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add src/systems/lifecycle.ts tests/systems/lifecycle.test.ts src/main.tsx tests/store/persistence-integration.test.ts
git commit -m "feat(systems): consolidate lifecycle listeners into installLifecycle

Phase 6a task 3. New src/systems/lifecycle.ts owns the single
visibilitychange + beforeunload listener pair. defaultLifecycleHooks
wires pauseTickLoop+flush on hide, resumeTickLoop on show, flush on
unload. All flush rejections route through reportError (Task 1).

main.tsx collapses two prior useEffect listener blocks into one
installLifecycle(defaultLifecycleHooks) call. persistence-integration
gains an end-to-end test asserting flush rejection reaches the reporter.

Polish carry-overs from Phase 2 final review #1, #2, #5 — all addressed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: canvasSlice gains `lastSale` transient field + `clearLastSale` action

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Modify: `src/store/index.ts`
- Modify: `tests/store/canvasSlice.test.ts`
- Modify: `tests/store/persistence-integration.test.ts`

**Goal:** Carry the floating-text trigger from canvas-sale events to the UI without polling. Each sale increments `lastSale.id` and captures `lastSale.amount`. The component (Task 5) keys on `lastSale.id` so each sale starts a fresh animation; on completion it calls `clearLastSale()` which sets the field to `null`. The field is stripped from `partialize` so rehydrate doesn't replay an animation.

- [ ] **Step 1: Write the failing tests**

Edit `tests/store/canvasSlice.test.ts`. Add a new describe block at the bottom:

```ts
describe("canvasSlice — lastSale animation trigger", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
  });

  it("initializes with lastSale = null", () => {
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("a sale sets lastSale to {id: 1, amount: CANVAS_GOLD_BASE big}", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    const ls = useGameStore.getState().lastSale;
    expect(ls).not.toBeNull();
    expect(ls!.id).toBe(1);
    expect(ls!.amount.toNumber()).toBe(CANVAS_GOLD_BASE);
  });

  it("two sales increment lastSale.id from 1 to 2", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale!.id).toBe(2);
  });

  it("clearLastSale() resets lastSale to null", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("clearLastSale() does not affect canvasProgress or gold", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS + 0.5);
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progressBefore = useGameStore.getState().canvasProgress;
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progressBefore);
  });

  it("a no-op tick (delta=0) does not advance lastSale", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS); // first sale → id=1
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
  });

  it("resetCanvas() clears lastSale alongside progress", () => {
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().lastSale).toBeNull();
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });
});
```

Then edit `tests/store/persistence-integration.test.ts`. Add this to the existing partialize-strip describe (or alongside the hoverInfo strip test):

```ts
it("lastSale transient is partialized OUT of the save", async () => {
  // Trigger a sale to make lastSale non-null.
  useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
  expect(useGameStore.getState().lastSale).not.toBeNull();
  await persistedAdapter.flush();

  const raw = await idbAdapter.getItem("artdle-save");
  const parsed = JSON.parse(raw!);
  expect("lastSale" in parsed.state).toBe(false);
});
```

Make sure the import of `PAINT_TIME_BASE_SECONDS` exists at the top:

```ts
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";
```

(Add if missing.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/store/canvasSlice.test.ts tests/store/persistence-integration.test.ts`
Expected: FAIL — `lastSale` and `clearLastSale` don't exist yet.

- [ ] **Step 3: Modify `src/store/canvasSlice.ts`**

Replace the file contents with:

```ts
import type { StateCreator } from "zustand";
import { PAINT_TIME_BASE_SECONDS, canvasGold } from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import type { GameStore } from "@/store";
import type { Big } from "@/core/bigNumber";

export interface CanvasState {
  /**
   * Seconds painted on the current canvas.
   * Invariant: 0 ≤ canvasProgress < effectivePaintTime.
   * On threshold-cross, a sale fires and progress resets (with optional carry).
   */
  canvasProgress: number;
  /**
   * Most recent sale event for animation triggering. The `id` increments on
   * each sale; consumers (e.g. `<FloatingGoldText>`) use it as an
   * AnimatePresence/motion key so each sale starts a fresh animation.
   * `amount` carries the gold gained for display.
   *
   * TRANSIENT — stripped from `partialize`. Rehydrate must not replay an
   * animation (set to `null` on reload). Cleared by `clearLastSale()`,
   * typically called from `onAnimationComplete`.
   */
  lastSale: { id: number; amount: Big } | null;
}

export const initialCanvasState: CanvasState = Object.freeze({
  canvasProgress: 0,
  lastSale: null,
}) as CanvasState;

export interface CanvasSlice extends CanvasState {
  /**
   * Per-frame canvas advance.
   * One-sale-per-tick rule: even if `delta ≥ paintTime`, exactly one sale fires.
   * Leftover is carried forward only when `< paintTime`; otherwise clamped to 0.
   * No-ops on `delta <= 0` (avoids spurious persist writes on idle frames).
   */
  canvasTick: (deltaSeconds: number) => void;
  /** For ascend orchestrator (Phase 3). */
  resetCanvas: () => void;
  /** Clear the lastSale animation trigger. Called from onAnimationComplete. */
  clearLastSale: () => void;
}

export const createCanvasSlice: StateCreator<GameStore, [], [], CanvasSlice> = (set, get) => ({
  ...initialCanvasState,

  canvasTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const state = get();
    const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(state);
    const newProgress = state.canvasProgress + deltaSeconds;

    if (newProgress < paintTime) {
      set({ canvasProgress: newProgress });
      return;
    }

    // Threshold crossed — exactly one sale per tick.
    const gain = canvasGold(getCanvasGoldMultiplier(state));
    state.add("gold", gain);
    const leftover = newProgress - paintTime;
    const prevId = state.lastSale?.id ?? 0;
    set({
      canvasProgress: leftover < paintTime ? leftover : 0,
      lastSale: { id: prevId + 1, amount: gain },
    });
  },

  resetCanvas: () => set(initialCanvasState),
  clearLastSale: () => set({ lastSale: null }),
});
```

- [ ] **Step 4: Modify `src/store/index.ts` to strip `lastSale` from partialize**

Edit the `partialize` function. Update the destructure and the `Omit` type:

```ts
      partialize: (s) => {
        // Exclude transient hover-info + UI + animation-trigger state, then pre-wrap Bigs as `{ __big: "..." }` markers.
        const {
          hoverTitle: _t,
          hoverBody: _b,
          hoverFooter: _f,
          workshopPopupOpen: _w,
          lastSale: _ls,
          ...rest
        } = s;
        return serializeBigs(rest) as unknown as Omit<
          GameStore,
          "hoverTitle" | "hoverBody" | "hoverFooter" | "workshopPopupOpen" | "lastSale"
        >;
      },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/store/canvasSlice.test.ts tests/store/persistence-integration.test.ts`
Expected: PASS — new tests green; existing canvasSlice tests still green.

Run: `npm test`
Expected: PASS — 239 + new = ~261. No regressions across the full suite.

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/canvasSlice.ts src/store/index.ts tests/store/canvasSlice.test.ts tests/store/persistence-integration.test.ts
git commit -m "store(canvas): add lastSale transient for floating-text animation trigger

Phase 6a task 4. New \`lastSale: { id: number; amount: Big } | null\`
field on canvasSlice. id increments on each sale; amount carries the
gold gained. clearLastSale() action zeros it (called from
onAnimationComplete in Task 5).

Stripped from partialize alongside hoverInfo + workshopPopupOpen so
rehydrate doesn't replay an animation. resetCanvas() clears it too.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: `<FloatingGoldText>` widget + PaintingView integration

**Files:**
- Create: `src/ui/widgets/FloatingGoldText.tsx`
- Create: `tests/ui/widgets/FloatingGoldText.test.tsx`
- Modify: `src/ui/views/PaintingView.tsx`

**Goal:** Render a one-shot "+Ng" text that floats up and fades when a canvas sale fires. Uses `motion/react`'s `<motion.div>` with `useReducedMotion()` for accessibility. PaintingView subscribes to `lastSale`, mounts the widget conditionally with `key={lastSale.id}` so each sale forces a fresh mount, and passes `onComplete={clearLastSale}` so the widget unmounts after its animation finishes.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/widgets/FloatingGoldText.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import { big } from "@/core/bigNumber";

describe("<FloatingGoldText />", () => {
  it("renders the formatted amount with a leading '+' and trailing 'g'", () => {
    render(<FloatingGoldText amount={big(15)} onComplete={vi.fn()} />);
    expect(screen.getByTestId("floating-gold-text")).toHaveTextContent("+15g");
  });

  it("formats large amounts via formatBig (1500 -> '+1.50Kg')", () => {
    render(<FloatingGoldText amount={big(1500)} onComplete={vi.fn()} />);
    expect(screen.getByTestId("floating-gold-text")).toHaveTextContent("+1.50Kg");
  });

  it("renders inside a positioned container without throwing", () => {
    // Smoke test — confirms motion/react import + useReducedMotion don't crash in jsdom.
    expect(() =>
      render(<FloatingGoldText amount={big(1)} onComplete={vi.fn()} />),
    ).not.toThrow();
    expect(screen.getByTestId("floating-gold-text")).toBeInTheDocument();
  });
});
```

(Note: we deliberately do NOT assert `onComplete` fires. Motion runs animations via RAF; jsdom + Vitest fake timers + Motion's internal scheduling make this brittle. The widget being rendered + the testid being present is the test surface for unit-level. The integration test in PaintingView.test (Step 4 below) will assert the widget is present on a sale event.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/widgets/FloatingGoldText.test.tsx`
Expected: FAIL — module-not-found on `@/ui/widgets/FloatingGoldText`.

- [ ] **Step 3: Write `FloatingGoldText.tsx`**

Create `src/ui/widgets/FloatingGoldText.tsx`:

```tsx
import type { JSX } from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatBig } from "@/core/formatter";
import type { Big } from "@/core/bigNumber";

interface Props {
  amount: Big;
  onComplete: () => void;
}

const ANIM_DURATION_S = 0.8;
const REDUCED_DURATION_S = 0.01;
const RISE_DISTANCE_PX = 40;

/**
 * One-shot floating "+Ng" text that rises and fades on canvas sale.
 *
 * @invariant Designed as a single-mount component — caller controls lifetime
 * via React keys (mount = animation start). When the animation completes,
 * `onComplete` fires; caller is expected to unmount this component (typically
 * by clearing the trigger state). prefers-reduced-motion suppresses the rise
 * + extends opacity decay across REDUCED_DURATION_S so onComplete still fires
 * promptly.
 */
export function FloatingGoldText({ amount, onComplete }: Props): JSX.Element {
  const reduce = useReducedMotion();
  const duration = reduce ? REDUCED_DURATION_S : ANIM_DURATION_S;
  const targetY = reduce ? 0 : -RISE_DISTANCE_PX;
  return (
    <motion.div
      data-testid="floating-gold-text"
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: targetY, opacity: 0 }}
      transition={{ duration, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className="pointer-events-none absolute right-3 top-3 text-gold font-semibold"
    >
      +{formatBig(amount)}g
    </motion.div>
  );
}
```

- [ ] **Step 4: Run widget tests to verify they pass**

Run: `npm test -- tests/ui/widgets/FloatingGoldText.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Wire FloatingGoldText into PaintingView**

Edit `src/ui/views/PaintingView.tsx`. Add subscriptions to `lastSale` and `clearLastSale`, add the `relative` class to the canvas section, and conditionally render the widget keyed on `lastSale.id`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";
import { getPaintTimeMultiplier } from "@/core/multipliers";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import { MAX_INVENTORY_SLOTS } from "@/config/workshopAffixes";

export function PaintingView(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const openWorkshopPopup = useGameStore((s) => s.openWorkshopPopup);
  const lastSale = useGameStore((s) => s.lastSale);
  const clearLastSale = useGameStore((s) => s.clearLastSale);

  // Helpers expect a GameStore; pass the field they actually read.
  // Cast is intentional and safe — see docs/agent_docs/ui-patterns.md.
  const helperState = { equippedItems } as unknown as GameStore;
  const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(helperState);
  const stateLabel = canvasProgress > 0 ? "Painting" : "Idle";

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="relative rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Canvas</div>
        <div className="text-lg font-semibold">{stateLabel}</div>
        <div className="text-sm">
          {canvasProgress.toFixed(1)} / {paintTime.toFixed(1)}s
        </div>
        {lastSale && (
          <FloatingGoldText
            key={lastSale.id}
            amount={lastSale.amount}
            onComplete={clearLastSale}
          />
        )}
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

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npm test`
Expected: PASS. No regressions. (No new PaintingView test added — this view has no test file currently, and adding one is out of scope for this task. The widget's testid + canvasSlice's lastSale tests are the assertion surface.)

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Manual smoke check**

Run: `npm run dev`. In the browser, navigate to PaintingView. Wait for the first canvas sale (~10s default paintTime). Observe a "+10g" text floating up + fading near the top-right of the canvas section. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/ui/widgets/FloatingGoldText.tsx tests/ui/widgets/FloatingGoldText.test.tsx src/ui/views/PaintingView.tsx
git commit -m "ui(painting): floating gold-text on canvas finish via Motion

Phase 6a task 5. New <FloatingGoldText> widget renders \"+Ng\" with a
y/opacity transition (800ms ease-out; 10ms when prefers-reduced-motion).
PaintingView mounts it inside the canvas <section> (which gains
\`relative\`), keyed on \`lastSale.id\` so each sale forces a fresh mount.
onAnimationComplete clears lastSale, unmounting the widget.

PORT_PLAN §5.13 motion target #1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Tree stage transition fade (HomeView)

**Files:**
- Modify: `src/ui/views/HomeView.tsx`

**Goal:** Wrap the HomeView stage header in `<AnimatePresence mode="wait">` keyed on `currentStage`. When the player advances stage (Seed → Sapling → Tree), the old header fades out (~300ms), then the new header fades in. `prefers-reduced-motion` skips the fade and swaps immediately. No new tests file — the transition is purely visual; existing HomeView UI tests (none today) would only assert presence/text, which already works.

There is no `tests/ui/views/HomeView.test.tsx` yet — adding one for this transition would be net-new test scaffolding for a purely-visual change. Skip the test scaffolding here; the existing AscensionView test pattern is the template if a future phase wants HomeView coverage.

- [ ] **Step 1: Edit `src/ui/views/HomeView.tsx`**

Replace the `<header>` block (lines 41-66 of the current file) with an AnimatePresence-wrapped variant. Add the imports at the top of the file:

```tsx
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
```

Inside the component body, just before the `return`, compute the transition config:

```tsx
  const reduce = useReducedMotion();
  const stageTransition = reduce
    ? { duration: 0.01 }
    : { duration: 0.3, ease: "easeInOut" as const };
```

Replace the existing `<header>` JSX (the block currently containing the two Hoverable-wrapped stage name + inspi/sec readout) with:

```tsx
      <AnimatePresence mode="wait">
        <motion.header
          key={currentStage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={stageTransition}
        >
          <Hoverable
            as="div"
            title={() => TREE_STAGES[useGameStore.getState().currentStage]?.name ?? "?"}
            body="Current tree stage. Each part on this stage produces inspiration."
          >
            <h2 className="text-xl font-semibold">{stageName}</h2>
          </Hoverable>
          <Hoverable
            as="div"
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
        </motion.header>
      </AnimatePresence>
```

- [ ] **Step 2: Run typecheck and full test suite**

Run: `npx tsc -b --noEmit`
Expected: clean.

Run: `npm test`
Expected: PASS. No regressions. (No HomeView tests exist; the change is non-breaking for everything else.)

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`. Navigate to HomeView (default). Buy enough parts in Seed to unlock Sapling, click Grow next stage. Observe the "Seed" header fading out and the "Sapling" header fading in (~300ms total). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/ui/views/HomeView.tsx
git commit -m "ui(home): tree stage transition fade via AnimatePresence

Phase 6a task 6. The stage header (Seed/Sapling/Tree name + inspi/sec
readout) is wrapped in <AnimatePresence mode=\"wait\"> keyed on
currentStage. ~300ms ease-in-out fade; prefers-reduced-motion skips to
10ms.

PORT_PLAN §5.13 motion target #2.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Fame increment pulse on ascend (CurrencyDisplay)

**Files:**
- Modify: `src/ui/widgets/CurrencyDisplay.tsx`
- Modify: `tests/ui/widgets/BottomBar.test.tsx`

**Goal:** When the fame value increases (which happens only on ascend in v1), the fame `<CurrencyDisplay>`'s value briefly pulses (scale 1 → 1.15 → 1, color flash via className toggle, ~500ms). `prefers-reduced-motion` skips the pulse entirely. Implementation: a `useEffect` watching the value detects an increase, toggles a `data-pulsing="true"` attribute for ~500ms; the className picks up the attribute via Tailwind's `data-[pulsing=true]:animate-fame-pulse` (or a CSS keyframe defined in `index.css`).

**Decision: use a CSS-keyframe-driven pulse, not a `<motion.div>`.** Reason: the pulse target is a `<span>` inline with other content; wrapping in a motion component would shift baselines. A CSS animation triggered by a `data-` attribute toggle is leaner and avoids layout-shift surprises. Motion is still the conceptual driver (Phase 6a's "Motion polish" bucket); the implementation just routes through CSS.

- [ ] **Step 1: Add the keyframe to `src/index.css`**

Read the current `src/index.css` to confirm the `@theme` block exists; then append (under `@theme inline { ... }` or at the bottom of the file as a regular `@layer utilities`):

```css
@keyframes fame-pulse {
  0%   { transform: scale(1);    color: var(--color-fame); }
  40%  { transform: scale(1.15); color: var(--color-gold); }
  100% { transform: scale(1);    color: var(--color-fame); }
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

(If the existing CSS uses `@theme` Tailwind 4 syntax for color tokens, the `var(--color-fame)` and `var(--color-gold)` references resolve to the same tokens declared in `@theme`. If those exact CSS variable names are different in this codebase, adjust to match — read the file to confirm.)

- [ ] **Step 2: Write the failing test**

Edit `tests/ui/widgets/BottomBar.test.tsx`. Add a new describe block at the bottom:

```tsx
describe("<BottomBar /> — fame pulse on increment", () => {
  it("toggles data-pulsing on the fame value when fame increases", async () => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(10) });
    render(<BottomBar />);
    const fameValue = screen.getByTestId("currency-fame");
    expect(fameValue).not.toHaveAttribute("data-pulsing", "true");

    // Trigger the increase via the React effect path.
    act(() => {
      useGameStore.setState({ fame: big(15) });
    });

    // After the store update, the useEffect should have toggled data-pulsing=true
    // synchronously (set inside the effect body).
    expect(fameValue).toHaveAttribute("data-pulsing", "true");
  });

  it("does NOT pulse on initial render (no prior value to compare)", () => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(10) });
    render(<BottomBar />);
    const fameValue = screen.getByTestId("currency-fame");
    expect(fameValue).not.toHaveAttribute("data-pulsing", "true");
  });

  it("does NOT pulse when fame stays the same", () => {
    useGameStore.setState({ gold: big(0), inspiration: big(0), fame: big(10) });
    render(<BottomBar />);
    const fameValue = screen.getByTestId("currency-fame");

    act(() => {
      useGameStore.setState({ fame: big(10) }); // same value
    });

    expect(fameValue).not.toHaveAttribute("data-pulsing", "true");
  });
});
```

Add the missing imports at the top of the file:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BottomBar } from "@/ui/widgets/BottomBar";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
```

(`act` is the new addition.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/ui/widgets/BottomBar.test.tsx`
Expected: FAIL — `data-pulsing` attribute doesn't exist on the fame `<span>`.

- [ ] **Step 4: Modify `src/ui/widgets/CurrencyDisplay.tsx`**

Add fame-specific pulse logic. Only the fame currency needs it; gold/inspiration tick continuously and would pulse forever.

```tsx
import { useEffect, useRef, useState, type JSX } from "react";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";
import type { Big } from "@/core/bigNumber";

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

const PULSE_DURATION_MS = 500;

interface Props {
  kind: CurrencyKind;
}

/**
 * @invariant Fame is the only currency that gets the increment pulse — gold
 * and inspiration tick continuously. Adding a pulse to a continuously-ticking
 * currency would mount-and-fire on every frame.
 */
export function CurrencyDisplay({ kind }: Props): JSX.Element {
  const value = useGameStore((s) => s[kind]);
  const [pulsing, setPulsing] = useState<boolean>(false);
  const prevRef = useRef<Big | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (kind !== "fame") return;
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === null) return; // first render — no comparison
    if (value.gt(prev)) {
      setPulsing(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setPulsing(false);
        timerRef.current = null;
      }, PULSE_DURATION_MS);
    }
  }, [value, kind]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

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
        <span
          data-testid={`currency-${kind}`}
          data-pulsing={pulsing ? "true" : undefined}
          className={pulsing ? "fame-pulse-anim inline-block" : "inline-block"}
        >
          {formatBig(value)}
        </span>
      </span>
    </Hoverable>
  );
}
```

(Note: `data-pulsing={pulsing ? "true" : undefined}` — when `pulsing` is false we omit the attribute entirely so `not.toHaveAttribute("data-pulsing", "true")` passes cleanly.)

- [ ] **Step 5: Run BottomBar tests to verify they pass**

Run: `npm test -- tests/ui/widgets/BottomBar.test.tsx`
Expected: PASS — 4 prior tests + 3 new tests = 7 green.

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npm test`
Expected: PASS — no regressions.

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Manual smoke check**

Run: `npm run dev`. Open the game, navigate to AscensionView (you may need to manually advance the store via DevTools console — `useGameStore.setState({ inspiration: big(1500) })`). Click Ascend. Observe the fame value briefly scaling up + flashing gold→fame in the BottomBar. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/index.css src/ui/widgets/CurrencyDisplay.tsx tests/ui/widgets/BottomBar.test.tsx
git commit -m "ui(currency): fame increment pulse on ascend via CSS keyframe

Phase 6a task 7. CurrencyDisplay tracks the previous fame value via a
useRef; on increase, toggles \`data-pulsing=true\` + .fame-pulse-anim
class for 500ms. CSS keyframe scales 1 → 1.15 → 1 + flashes color
gold→fame→fame. Fame is the only currency that gets this — gold and
inspiration tick continuously and would pulse perpetually.

prefers-reduced-motion media query suppresses the keyframe.

PORT_PLAN §5.13 motion target #3.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: WorkshopPopup mount/unmount fade

**Files:**
- Modify: `src/ui/popups/WorkshopPopup.tsx`

**Goal:** Wrap the inner card in `<motion.div>` inside `<AnimatePresence>` keyed on `open`. Backdrop stays plain CSS (no Motion). Fade duration ~200ms; `prefers-reduced-motion` snaps to 10ms. The existing 10 WorkshopPopup tests (which use `screen.getByTestId("workshop-popup-card")` per the C-1 fix) must continue to pass without modification.

- [ ] **Step 1: Read the current WorkshopPopup.tsx**

(Already in context from the prior read. Recap of relevant structure: outer `<div role="dialog">` is the backdrop; inner `<div data-testid="workshop-popup-card">` is what gets motion-wrapped.)

- [ ] **Step 2: Modify `src/ui/popups/WorkshopPopup.tsx`**

The conditional `if (!open) return null;` becomes "always render the AnimatePresence, conditionally render the children inside". Add the motion imports + restructure:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { Hoverable } from "@/ui/widgets/Hoverable";
import {
  CRAFT_COST_GOLD,
  MAX_INVENTORY_SLOTS,
} from "@/config/workshopAffixes";
import { getCurrentSlotCount } from "@/store/workshopSlice";

/**
 * @invariant The popup is reachable only from PaintingView and self-closes
 * when `currentView !== "painting"` (see auto-close `useEffect` below). If a
 * future entry point opens the Workshop from a non-painting view, that effect
 * will fire on mount and immediately close. Before adding such an entry point,
 * relax the predicate — e.g., capture the view-at-open in a ref and only close
 * when `currentView` differs from that captured value.
 */
export function WorkshopPopup(): JSX.Element {
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
  const reduce = useReducedMotion();

  // Esc dismiss — listener mounts/unmounts with `open`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Auto-close when navigating away from PaintingView. See @invariant above.
  useEffect(() => {
    if (open && currentView !== "painting") close();
  }, [open, currentView, close]);

  // Helper expects GameStore; pass the field it actually reads.
  // Cast pattern per docs/agent_docs/ui-patterns.md.
  const helperState = { purchasedNodes } as unknown as GameStore;
  const slotCount = getCurrentSlotCount(helperState);
  const canCraft =
    gold.gte(big(CRAFT_COST_GOLD)) && inventory.length < MAX_INVENTORY_SLOTS;
  const canEquipMore = equippedItems.length < slotCount;
  const canUnequip = inventory.length < MAX_INVENTORY_SLOTS;

  const fadeDuration = reduce ? 0.01 : 0.2;

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workshop-popup-title"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/60"
          onClick={close}
        >
          <motion.div
            data-testid="workshop-popup-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: fadeDuration, ease: "easeOut" }}
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

**Note the return-type change:** function now returns `JSX.Element` (always — the `<AnimatePresence>` wrapper is always rendered; only its children are conditional). The old `JSX.Element | null` is no longer needed.

The "renders nothing when workshopPopupOpen=false" test asserts `container.firstChild` is null. With AnimatePresence + conditional children, when `open=false`, AnimatePresence renders no DOM children (its first child is its empty fragment when there's nothing to animate). React's behavior: `container.firstChild` will be `null` because AnimatePresence with no visible children renders no DOM. **Verify this in step 4 below.**

If `container.firstChild` is unexpectedly non-null (e.g., AnimatePresence emits a wrapper element), update that one test to assert via `screen.queryByRole("dialog")` returning null instead.

- [ ] **Step 3: Run WorkshopPopup tests**

Run: `npm test -- tests/ui/popups/WorkshopPopup.test.tsx`
Expected: PASS — all 10 prior tests still green.

If the "renders nothing" test fails because AnimatePresence emits a host element when no children are present, edit that test:

```ts
it("renders nothing visible when workshopPopupOpen=false", () => {
  useGameStore.setState({ workshopPopupOpen: false });
  render(<WorkshopPopup />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
```

(Verify by running the tests; if AnimatePresence is "transparent" — typical for v12 — the original assertion still works and no edit is needed.)

- [ ] **Step 4: Run full test suite + typecheck**

Run: `npm test`
Expected: PASS.

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`. Navigate to PaintingView, click Workshop. Observe a brief opacity+scale fade-in (~200ms). Press Esc or click backdrop. Observe a brief fade-out. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/ui/popups/WorkshopPopup.tsx
git commit -m "ui(workshop-popup): mount/unmount fade via Motion + AnimatePresence

Phase 6a task 8. Inner card becomes a <motion.div> inside
<AnimatePresence> keyed on open. opacity 0→1 + scale 0.95→1 over 200ms
ease-out (10ms when prefers-reduced-motion). Backdrop stays plain CSS.

The C-1 testid swap (data-testid=\"workshop-popup-card\") shipped in the
Phase 6 opening carry-overs specifically so this Motion wrapping
landed without test changes — the existing 10 tests pass against the
testid selector unchanged.

PORT_PLAN §5.13 motion target #4 (the optional one).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: README write-up + screenshots

**Files:**
- Create: `README.md` (root)
- Create: `docs/screenshots/home-tree.png`
- Create: `docs/screenshots/painting-canvas.png`
- Create: `docs/screenshots/ascension-ready.png`

**Goal:** Player + dev README (~150 lines) per spec scope B. Sections: project description, tech stack, how to play, screenshots, dev setup, project map, wave roadmap pointer. Screenshots captured via `npm run dev` from a manually-progressed save state.

- [ ] **Step 1: Capture screenshots via dev server**

Run: `npm run dev` (in a background-friendly way; the dev server is long-running). Open the browser at the served URL.

Manually progress the game to capture three states:
- **`home-tree.png`**: HomeView with Sapling stage active and 1-2 parts upgraded. (Quickest path: open DevTools console, run `useGameStore.setState({ currentStage: 1, partLevels: { spark: 5, bud: 3, leaf: 1 } })`.)
- **`painting-canvas.png`**: PaintingView mid-paint with at least one equipped item. (`useGameStore.setState({ canvasProgress: 5, equippedItems: [{ kind: "+canvas_gold%", magnitude: 12 }] })`.)
- **`ascension-ready.png`**: AscensionView with inspiration above palier so the Ascend button is enabled. (`useGameStore.setState({ inspiration: big(1500), ascendCount: 0 })` — needs `big` exposed on window in dev mode, which `main.tsx` already does.)

Capture each via the OS's screenshot tool (Win+Shift+S on Windows). Crop to the viewport or game-window bounds. Save as PNG. Move the files to `docs/screenshots/`.

If you can't capture screenshots in this session (e.g., no display available), commit a `docs/screenshots/.gitkeep` placeholder + a TODO note in the README to swap them in. The user can take real screenshots later from a real play save.

- [ ] **Step 2: Stop the dev server**

Find and stop the background `npm run dev` process.

- [ ] **Step 3: Write `README.md`**

Create `README.md` at the repo root:

```markdown
# Artdle

An idle painting game. Grow an inspiration tree, paint canvases for gold, ascend at threshold to convert inspiration into permanent fame, then spend that fame in a skill tree.

This repo is the **web port** of an earlier Godot prototype. v1 ships the minimum playable loop; later waves add the Painter's Office, Painting School, Expositions, and other systems from the source design specs.

---

## How to play

The loop has four screens, accessible from the top bar:

- **Tree** — Grow the inspiration tree. Buy parts (each level costs gold and produces inspiration/sec). When you have enough levels in the current stage, click **Grow next stage** to advance Seed → Sapling → Tree.
- **Painting** — A canvas auto-paints over time and sells for gold. Open the **Workshop** popup to craft items with random affixes (e.g., +12% canvas gold). Equip them to boost your earnings.
- **Ascension** — When inspiration reaches the **palier**, ascend to convert inspiration into permanent **fame**. Run resets; fame and skill tree progress persist.
- **Skill Tree** — Spend fame on permanent unlocks (better starting parts, second equip slot, wider affix magnitude rolls, palier discount, paint-time discount).

Save persists locally (IndexedDB) — close the tab and come back; your tree and fame are still there. v1 has no offline progress: tab hidden = ticking pauses; tab visible = resume from now.

---

## Screenshots

![Tree growing in the Sapling stage](./docs/screenshots/home-tree.png)
*Tree view at the Sapling stage with parts being upgraded.*

![Canvas mid-paint with an equipped item](./docs/screenshots/painting-canvas.png)
*Painting view: canvas auto-paints, equipped items modify the gold reward.*

![Ascension threshold reached](./docs/screenshots/ascension-ready.png)
*Ascension view: inspiration past the palier, ready to convert to fame.*

---

## Tech stack

- **React 19** + **TypeScript 6** (strict, `verbatimModuleSyntax`).
- **Vite 8** for dev + production build.
- **Tailwind 4** (CSS-first config via `@theme` in `src/index.css`).
- **Zustand 5** as the single store, organised by slice. Persistence via the `persist` middleware over a custom **IndexedDB** adapter (`idb-keyval`), with throttled writes.
- **`break_eternity.js`** for big-number currencies (gold, inspiration, fame can grow past `Number.MAX_SAFE_INTEGER`).
- **Motion 12** for light animation polish (floating gold-text, stage transitions, fame pulse, popup fade).
- **Vitest 4** + `@testing-library/react` 16 + **jsdom** for ~250 tests.

---

## Dev setup

Requires Node 20+ and npm.

```bash
# Clone
git clone https://github.com/mitoufle/Artdle-web.git
cd Artdle-web

# Install
npm install

# Run dev server (opens at http://localhost:5173)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Production build (output: dist/)
npm run build

# Preview the production build locally
npm run preview

# Lint
npm run lint
```

The dev server exposes the Zustand store + `big` constructor on `window` for DevTools console debugging:

```js
useGameStore.getState();           // inspect
useGameStore.setState({ gold: big(1e6) });  // mutate
```

---

## Project map

The most useful documents to read first:

- **[`CLAUDE.md`](./CLAUDE.md)** — agent / contributor onboarding. Conventions, key pitfalls, project layout.
- **[`docs/HANDOVER.md`](./docs/HANDOVER.md)** — current state-of-the-project snapshot.
- **[`docs/PORT_PLAN.md`](./docs/PORT_PLAN.md)** — the v1 spec. Authoritative source for what's in v1 and what's deferred to later waves.
- **[`docs/specs/`](./docs/specs/)** — the four source design specs from the Godot prototype (reference for v1.1+ waves).
- **[`docs/superpowers/plans/`](./docs/superpowers/plans/)** — implementation plans by phase.

Codebase layout (`src/`):

```
src/
├── core/          # Pure utilities: bigNumber, formatter, balance, rng, tickLoop
├── config/        # Static data: tree stages, workshop affixes, skill nodes
├── store/         # Zustand slices + combined index
├── systems/       # Logic awkward inside slices: persistence, ascend, lifecycle, telemetry
└── ui/            # Views, popups, widgets
```

---

## Roadmap

v1.0 ships the minimum playable loop. Subsequent waves (per `docs/PORT_PLAN.md` §2.1) add:

- **v1.1** — Painter's Office + Painting School (the "between runs" meta loop).
- **v1.2** — Expositions (timed challenges).
- **v1.3** — Audio + achievements.
- **v1.5** — Drag-to-reorder equipped items, Workshop affix expansion.
- **v2.0** — Offline progress (24h hybrid catch-up), telemetry backend, possible accounts.

The 3-year long-term player-time target unlocks the full game once all waves are out. v1 itself plays in 1-3 hours.

---

## Status

v1.0 — see commit `v1.0` tag (when present). End-to-end playable loop, ~250 unit + integration tests, < 100 KB gzipped.

Built primarily with [Claude Code](https://claude.ai/code) using the [superpowers](https://github.com/anthropics/skills) plan-driven workflow. See `docs/superpowers/plans/` for the full phase-by-phase implementation history.
```

- [ ] **Step 4: Verify README renders**

Run: `cat README.md | head -30`
Expected: title + first paragraph + "How to play" header. No syntax errors visible.

(Optional: paste into a markdown previewer or run a markdown linter if available. The structure is GitHub-flavored markdown which renders without further tooling.)

- [ ] **Step 5: Commit**

If screenshots were captured:

```bash
git add README.md docs/screenshots/home-tree.png docs/screenshots/painting-canvas.png docs/screenshots/ascension-ready.png
git commit -m "docs: add v1.0 README + screenshots

Phase 6a task 9. Player + dev README (~150 lines) covering project
description, how to play, tech stack, dev setup, project map, and
wave roadmap. Three screenshots showing tree (Sapling), painting
(mid-paint with equipped item), and ascension (threshold ready).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

If screenshots couldn't be captured, commit just README.md and add a `.gitkeep` placeholder:

```bash
mkdir -p docs/screenshots
touch docs/screenshots/.gitkeep
git add README.md docs/screenshots/.gitkeep
git commit -m "docs: add v1.0 README (screenshots TBD)

Phase 6a task 9. Player + dev README (~150 lines). Screenshots
deferred — placeholder docs/screenshots/.gitkeep added. To swap in
real screenshots from a played save: capture three PNGs to
docs/screenshots/{home-tree,painting-canvas,ascension-ready}.png.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Deploy verification

**Files:** none modified — verification only.

**Goal:** Confirm `npm run build` produces a clean `dist/`, `npm run preview` serves it correctly, the v1.0 game loop works end-to-end in the production preview, and the bundle size is under the 250 KB DoD ceiling.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: clean tsc + Vite output. Final lines should look like:

```
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-XXXXXXXX.css   ~16.00 kB │ gzip:  ~4.00 kB
dist/assets/index-XXXXXXXX.js   ~290.00 kB │ gzip: ~88.00 kB
✓ built in <1s
```

(Numbers will vary slightly with Motion's Tree-shaken footprint. Pre-Phase-6a baseline was 82.77 KB JS gzipped; expect ~85-95 KB after Motion adds.)

If JS gzipped > 250 KB, STOP and report — bundle budget breached. Likely culprit: a non-tree-shaken Motion import. Check imports use `motion/react` (the slim entry) and not `motion` (the full library).

- [ ] **Step 2: Production preview**

Run: `npm run preview` (background process). It serves `dist/` at typically `http://localhost:4173`.

- [ ] **Step 3: Manual clickthrough**

Open the preview URL in a browser. Verify:
- App loads without console errors.
- LoadingScreen shows briefly, then the game.
- HomeView: tree displays. Buy a part. Verify gold deducted.
- TopBar: switch to Painting. Canvas progresses. After ~10s, gold credits + floating "+10g" text appears.
- TopBar: switch to Skills. Locked nodes display. (Won't have fame unless you ascend.)
- TopBar: switch back to Painting. Click Workshop. Popup fades in. Click Craft (need 100g). Item appears in Inventory. Click it to equip. Close popup (Esc or backdrop). Popup fades out.
- TopBar: switch to Ascension. (Without enough inspiration, button is disabled.)
- Reload the page. State persists (gold/parts retained).
- Switch tabs and back. Tick loop pauses + resumes (no fast-forward).

If any step fails, STOP and report.

- [ ] **Step 4: Stop the preview server**

Find and stop the background `npm run preview` process.

- [ ] **Step 5: Record build size in HANDOVER**

(No commit yet for HANDOVER — that's part of Phase 6b's closing. Just note the actual gzipped JS size for the final commit message in Task 11.)

- [ ] **Step 6: Commit**

There's nothing to commit for this task — verification only. No commit. Move to Task 11.

(If a small fix was needed during verification — e.g., a console error that surfaced in production but not dev — commit that fix as `fix(...)` with a clear message. Then retry verification.)

---

## Task 11: Push to origin/main

**Files:** none — git operation only.

**Goal:** Push the accumulated commits (24 prior + ~10-12 from Phase 6a) to `origin/main`. Repo ends Phase 6a in a v1.0-RC state on GitHub: feature-complete, polished, deploy-ready, but the `v1.0` tag is held back until the post-playtest 6b plan completes the balance pass.

- [ ] **Step 1: Confirm working tree is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean` (apart from `.claude/` which is gitignored).

- [ ] **Step 2: Confirm tests + build are green**

Run: `npm test`
Expected: PASS — ~250-260 tests.

Run: `npm run build`
Expected: clean. Note the final gzipped JS size.

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 3: Confirm we're on main and ahead of origin/main**

Run: `git log --oneline origin/main..HEAD | wc -l`
Expected: ~30+ (24 prior + ~10-12 Phase 6a).

Run: `git status -uno`
Expected: `Your branch is ahead of 'origin/main' by N commits.`

- [ ] **Step 4: Push**

Run: `git push origin main`
Expected: successful push, no force needed (we're fast-forwarding origin/main).

If push fails because origin/main has commits we don't have locally (someone else pushed), STOP and ask the user how to proceed — never force-push without explicit approval.

- [ ] **Step 5: Verify on GitHub**

Open https://github.com/mitoufle/Artdle-web in a browser. Verify:
- README renders with all sections.
- Screenshots render (or the .gitkeep placeholder is there if not captured).
- The latest commit shown is the most recent Phase 6a commit.
- The repo is no longer "N commits ahead of origin/main" locally.

- [ ] **Step 6: Final state report**

Compose a brief end-of-Phase-6a status report (no commit — this just goes in the response to the user when subagent-driven-development hands the chain back):

```
Phase 6a complete.

Test count: 239 → ~250-260 across ~28-29 files.
Bundle: 82.77 KB gzipped (pre-6a) → ~XX KB gzipped (post-6a).
Commits added: ~10-12.
Repo: pushed to origin/main. Working tree clean.

Next: playtest pause. Run a fresh save (clear IDB + reload) for ~30-60 min.
Capture in conversation:
  - Time to first ascend (target 5-15 min).
  - Time to second ascend (should be faster).
  - Affix variety feel (3-pool thin? expand to 4-5?).
  - Tree progression pacing.
  - Skill tree investment by ascend 5-10.
  - Any UI bug surfaced by playing for real.

Then: Phase 6b plan brainstorm + write + execute. Then v1.0 tag.
```

---

## Phase 6a Definition of Done

- [ ] All 11 tasks committed.
- [ ] Test count ~250-260 (up from 239).
- [ ] `npm run build` clean; `dist/` JS gzipped < 250 KB.
- [ ] `npm run preview` serves a working game; manual clickthrough succeeds.
- [ ] README renders correctly on GitHub after push.
- [ ] `prefers-reduced-motion` honored on all 4 Motion targets.
- [ ] All Phase 5 carry-over commits + all Phase 6a commits are on `origin/main`.
- [ ] No `v1.0` tag yet — that's a 6b deliverable.

---

## Phase 6b — sketch (NOT planned in this document)

Phase 6b will be planned in a separate document after the playtest pause completes. Per the spec §3, 6b will:

1. Tune `src/core/balance.ts` and/or `src/config/treeStages.ts` constants based on playtest findings. Each constant change updates its corresponding test in `tests/core/balance.test.ts` in tandem.
2. Decide on the affix pool: keep 3, or expand to 4-5 (`+ascend_palier_reduction%`, `+tree_part_cost_reduction%` per PORT_PLAN §1.3). If expanding: `src/config/workshopAffixes.ts`, `src/store/multipliers.ts`, related tests.
3. `git tag -a v1.0 -m "..."` + `git push --tags`.
4. Update `docs/HANDOVER.md` to v1.0-shipped state.

Phase 6b plan to be written at: `docs/superpowers/plans/2026-05-XX-artdle-web-phase6b.md` (date TBD post-playtest).

---

## Self-review checklist (filled in by writing-plans skill)

- [x] **Spec coverage:** all 4 Motion targets (tasks 5, 6, 7, 8) + all 3 polish carry-overs (#1, #2, #5 across tasks 1, 2, 3) + README + screenshots (task 9) + deploy verify (task 10) + push (task 11). Phase 6b sketch (spec §3) referenced but not planned, per instructions.
- [x] **Placeholder scan:** zero "TBD"/"TODO" inside task bodies. The README task includes a TBD-fallback path for screenshots if capture isn't possible — that's a deliberate degraded-mode branch, not a planning gap.
- [x] **Type consistency:** `pauseTickLoop` / `resumeTickLoop` used identically in tickLoop.ts (task 2), lifecycle.ts (task 3), tests (tasks 2 + 3). `reportError` / `setErrorReporter` / `resetErrorReporter` consistent across telemetry.ts (task 1), lifecycle.ts (task 3), tests. `lastSale` / `clearLastSale` consistent across canvasSlice.ts (task 4), FloatingGoldText.tsx (task 5), PaintingView.tsx (task 5).
- [x] **Ordering:** task 1 (telemetry) before tasks 3 + 4 (which use it). Task 2 (tickLoop refactor) before task 3 (lifecycle calls into it). Task 4 (canvasSlice lastSale) before task 5 (FloatingGoldText reads it). Tasks 6, 7, 8 are independent of each other and can run in any order. Tasks 9, 10, 11 are sequential closing steps.
