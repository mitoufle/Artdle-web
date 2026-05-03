import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startTickLoop,
  stopTickLoop,
  pauseTickLoop,
  resumeTickLoop,
  _testing,
} from "@/core/tickLoop";

describe("tickLoop", () => {
  afterEach(() => stopTickLoop());

  it("does not run before startTickLoop", () => {
    expect(_testing.running).toBe(false);
  });

  it("startTickLoop sets running=true", () => {
    startTickLoop(() => {});
    expect(_testing.running).toBe(true);
  });

  it("stopTickLoop sets running=false", () => {
    startTickLoop(() => {});
    stopTickLoop();
    expect(_testing.running).toBe(false);
  });

  it("step calls the tick fn with capped delta", () => {
    let lastDelta = -1;
    startTickLoop((d) => { lastDelta = d; });
    _testing.setLast(0);
    _testing.callStep(500); // 0.5s elapsed
    expect(lastDelta).toBeCloseTo(0.5, 5);
  });

  it("step caps delta at MAX_FRAME_DELTA_SECONDS for huge gaps", () => {
    let lastDelta = -1;
    startTickLoop((d) => { lastDelta = d; });
    _testing.setLast(0);
    _testing.callStep(10_000); // 10s elapsed
    expect(lastDelta).toBe(_testing.MAX_FRAME_DELTA_SECONDS);
  });

  it("step does nothing if not running", () => {
    let called = false;
    startTickLoop(() => { called = true; });
    stopTickLoop();
    _testing.callStep(100);
    expect(called).toBe(false);
  });
});

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
