import { describe, expect, it } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";

describe("canvasTickPure", () => {
  it("no-op on delta=0", () => {
    const draft = { ...useGameStore.getState() } as any;
    const beforeGold = draft.gold;
    canvasTickPure(draft, 0);
    expect(draft.gold.eq(beforeGold)).toBe(true);
  });

  it("produces gold on a tick large enough to complete one canvas", () => {
    const base = useGameStore.getState();
    const draft = {
      ...base,
      gold: big(0),
      lifetimeGold: big(0),
      canvasProgress: 0,
      sellPriceLevel: 1,
      speedLevel: 1,
      sizeLevel: 0,
      critLevel: 0,
      comboLevel: 0,
      comboChain: 0,
      isCritThisCanvas: false,
      statsLifetime: { ...base.statsLifetime, canvasesSold: 0 },
      statsRun: { ...base.statsRun, canvasesSold: 0, currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0, goldEarned: big(0) },
    } as any;
    canvasTickPure(draft, 100); // 100s is much more than one paint cycle
    expect(draft.gold.gt(0)).toBe(true);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThanOrEqual(1);
  });

  it("produces many sales on a long delta (multi-completion correctness)", () => {
    const base = useGameStore.getState();
    const draft = {
      ...base,
      gold: big(0), lifetimeGold: big(0),
      canvasProgress: 0,
      sellPriceLevel: 1, speedLevel: 1, sizeLevel: 0, critLevel: 0, comboLevel: 0,
      isCritThisCanvas: false, comboChain: 0,
      statsLifetime: { ...base.statsLifetime, canvasesSold: 0 },
      statsRun: { ...base.statsRun, canvasesSold: 0, currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0, goldEarned: big(0) },
    } as any;
    canvasTickPure(draft, 600);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThan(1);
  });
});
