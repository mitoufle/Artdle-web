/**
 * RAF-driven tick loop with visibility pause.
 * v1 explicitly has NO offline catch-up: tab hidden = no ticking; tab visible = resume from now.
 *
 * The 24h F-style hybrid catch-up arrives in v2.0.
 */

const MAX_FRAME_DELTA_SECONDS = 1.0; // cap per-frame delta to avoid spirals

type TickFn = (deltaSeconds: number) => void;

let _last = 0;
let _rafId = 0;
let _running = false;
let _onTick: TickFn | null = null;
let _visibilityHandler: (() => void) | null = null;

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

  _visibilityHandler = () => {
    if (document.hidden) {
      _running = false;
      cancelAnimationFrame(_rafId);
    } else {
      if (_onTick) {
        _last = performance.now(); // reset; v1 ignores elapsed offline time
        _running = true;
        _rafId = requestAnimationFrame(step);
      }
    }
  };
  document.addEventListener("visibilitychange", _visibilityHandler);
}

export function stopTickLoop(): void {
  _running = false;
  cancelAnimationFrame(_rafId);
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
    _visibilityHandler = null;
  }
  _onTick = null;
}

export const _testing = {
  get running() { return _running; },
  setLast(t: number) { _last = t; },
  callStep(now: number) { step(now); },
  MAX_FRAME_DELTA_SECONDS,
};
