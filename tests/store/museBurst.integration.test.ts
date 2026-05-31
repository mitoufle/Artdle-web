import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { MUSE_BURST_DURATION_S } from "@/core/skillTreeTickPure";

/**
 * End-to-end coverage of the Muse Burst trigger: the only new code path that
 * unit tests (crossedSaleMilestone, the ×7 multiplier) stand in for but don't
 * actually exercise. Drives the real canvasTick so a crossed 100-sale milestone
 * arms museBurstTimer.
 */
describe("Muse Burst trigger (canvasTick integration)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.setState({ purchasedNodes: {}, museBurstTimer: 0 });
    useGameStore.getState().patchRunStats({ canvasesSold: 0 });
  });

  it("arms the ×7 buff when a 100-sale milestone is crossed while muse_burst is owned", () => {
    useGameStore.setState({ purchasedNodes: { muse_burst: 1 } });
    useGameStore.getState().patchRunStats({ canvasesSold: 99 });
    // A large delta sells many canvases this tick, crossing the 100 milestone.
    useGameStore.getState().canvasTick(100_000);
    expect(useGameStore.getState().statsRun.canvasesSold).toBeGreaterThanOrEqual(100);
    expect(useGameStore.getState().museBurstTimer).toBe(MUSE_BURST_DURATION_S);
  });

  it("does NOT arm the buff when muse_burst is not owned", () => {
    useGameStore.getState().patchRunStats({ canvasesSold: 99 });
    useGameStore.getState().canvasTick(100_000);
    expect(useGameStore.getState().statsRun.canvasesSold).toBeGreaterThanOrEqual(100);
    expect(useGameStore.getState().museBurstTimer).toBe(0);
  });
});
