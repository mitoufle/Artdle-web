import { describe, it, expect, afterEach } from "vitest";
import { startTickLoop, stopTickLoop, _testing } from "@/core/tickLoop";

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
