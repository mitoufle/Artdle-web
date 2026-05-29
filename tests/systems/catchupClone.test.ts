import { describe, expect, it } from "vitest";
import { cloneGameState } from "@/systems/catchupClone";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("cloneGameState", () => {
  it("mutating clone.gold does not affect source", () => {
    const src = useGameStore.getState();
    const clone = cloneGameState(src);
    clone.gold = clone.gold.add(big(100));
    expect(src.gold.eq(clone.gold)).toBe(false);
  });

  it("mutating clone.partLevels does not affect source", () => {
    const src = { ...useGameStore.getState(), partLevels: { p1: 5 } } as any;
    const clone = cloneGameState(src);
    clone.partLevels.p1 = 99;
    expect(src.partLevels.p1).toBe(5);
  });

  it("mutating clone.inventory item affixes does not affect source", () => {
    const src = {
      ...useGameStore.getState(),
      inventory: [{ id: "i1", slot: "brush", tier: "normal", affixes: [{ kind: "$", magnitude: 10 }], fuseCount: 0 }],
    } as any;
    const clone = cloneGameState(src);
    clone.inventory[0].affixes[0].magnitude = 999;
    expect((src.inventory[0] as any).affixes[0].magnitude).toBe(10);
  });

  it("mutating clone.completedAchievements does not affect source", () => {
    const src = { ...useGameStore.getState(), completedAchievements: { a1: true as const } } as any;
    const clone = cloneGameState(src);
    clone.completedAchievements.a2 = true;
    expect((src.completedAchievements as any).a2).toBeUndefined();
  });

  it("clone.gold.add() returns a new Big without mutating source", () => {
    const src = { ...useGameStore.getState(), gold: big(100) } as any;
    const clone = cloneGameState(src);
    const next = clone.gold.add(big(50));
    expect(src.gold.toNumber()).toBe(100);
    expect(next.toNumber()).toBe(150);
  });

  it("deep-copies painterClocks (mutating the clone doesn't touch the source)", () => {
    const src = { ...useGameStore.getState(), painterClocks: { player: 2.5, w1: 1.0 } } as any;
    const clone = cloneGameState(src);
    clone.painterClocks.player = 999;
    expect(src.painterClocks.player).toBe(2.5);
  });
});
