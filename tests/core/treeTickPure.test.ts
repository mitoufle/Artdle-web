import { describe, expect, it } from "vitest";
import { treeTickPure } from "@/core/treeTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";

describe("treeTickPure", () => {
  it("no-op on delta=0", () => {
    const draft = { ...useGameStore.getState() } as any;
    const beforeInspi = draft.inspiration.toNumber();
    const beforeStage = draft.currentStage;
    treeTickPure(draft, 0);
    expect(draft.inspiration.toNumber()).toBe(beforeInspi);
    expect(draft.currentStage).toBe(beforeStage);
  });

  it("credits inspiration for producing parts", () => {
    // stage 0 — u1 (Cotyledon) at level 5, rate 0.1/level → 0.5 inspi/sec.
    // 5 levels is below the tier-2 threshold (5/s), so no auto-advance fires.
    const draft = { ...useGameStore.getState() } as any;
    draft.currentStage = 0;
    draft.partLevels = { ...draft.partLevels, u1: 5 };
    draft.inspiration = big(0);
    draft.lifetimeInspiration = big(0);
    treeTickPure(draft, 1);
    // No auto-advance (0.5/s < 5/s threshold); inspiration credited from producing set:
    // 5 * 0.1 * 1 = 0.5 inspi.
    expect(draft.inspiration.toNumber()).toBeCloseTo(0.5, 6);
    expect(draft.lifetimeInspiration.toNumber()).toBeCloseTo(draft.inspiration.toNumber(), 6);
  });

  it("auto-advances stage if inspi/sec threshold met", () => {
    // tier-2 unlockInspiPerSec = 5/s. Seed u1 @ 25 levels: 25 * 0.1 * 4 = 10/s >= 5/s.
    const draft = { ...useGameStore.getState() } as any;
    draft.currentStage = 0;
    draft.partLevels = { ...draft.partLevels, u1: 25 };
    treeTickPure(draft, 0.001);
    expect(draft.currentStage).toBe(1);
  });
});
