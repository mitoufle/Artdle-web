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
    // stage 0 — cotyledon at level 5, rate 0.1/level → 0.5 inspi/sec.
    const draft = { ...useGameStore.getState() } as any;
    draft.currentStage = 0;
    draft.partLevels = { ...draft.partLevels, cotyledon: 5 };
    draft.inspiration = big(0);
    draft.lifetimeInspiration = big(0);
    treeTickPure(draft, 1);
    // The auto-advance fires (5 levels meets stage-1 unlockThreshold=5)
    // but inspiration is credited from the pre-advance producing set, so
    // we expect 5 * 0.1 * 1 = 0.5 inspi.
    expect(draft.inspiration.toNumber()).toBeCloseTo(0.5, 6);
    expect(draft.lifetimeInspiration.toNumber()).toBeCloseTo(draft.inspiration.toNumber(), 6);
  });

  it("auto-advances stage if threshold met", () => {
    // stage 1 unlockThreshold = 5. Seed cotyledon @ 5 levels in stage 0.
    const draft = { ...useGameStore.getState() } as any;
    draft.currentStage = 0;
    draft.partLevels = { ...draft.partLevels, cotyledon: 5 };
    treeTickPure(draft, 0.001);
    expect(draft.currentStage).toBe(1);
  });
});
