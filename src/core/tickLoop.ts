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
