import { describe, expect, it } from "vitest";
import { skillTreeTickPure, crossedSaleMilestone } from "@/core/skillTreeTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";

describe("crossedSaleMilestone", () => {
  it("true only when a multiple of the interval is crossed", () => {
    expect(crossedSaleMilestone(99, 100, 100)).toBe(true);
    expect(crossedSaleMilestone(0, 100, 100)).toBe(true);
    expect(crossedSaleMilestone(150, 260, 100)).toBe(true); // crossed 200
    expect(crossedSaleMilestone(100, 101, 100)).toBe(false);
    expect(crossedSaleMilestone(50, 99, 100)).toBe(false);
    expect(crossedSaleMilestone(100, 100, 100)).toBe(false); // no new sale
  });
});

describe("skillTreeTickPure — Muse Burst timer", () => {
  it("decrements museBurstTimer by delta, even when poke_tree is not owned", () => {
    const draft = { ...useGameStore.getState(), purchasedNodes: {}, pokeTreeTimer: 0, museBurstTimer: 42 } as any;
    skillTreeTickPure(draft, 1);
    expect(draft.museBurstTimer).toBe(41);
  });

  it("floors museBurstTimer at 0 (never negative)", () => {
    const draft = { ...useGameStore.getState(), purchasedNodes: {}, museBurstTimer: 0.5 } as any;
    skillTreeTickPure(draft, 1);
    expect(draft.museBurstTimer).toBe(0);
  });
});

describe("skillTreeTickPure", () => {
  it("no-op when poke_tree not purchased", () => {
    const draft = { ...useGameStore.getState(), purchasedNodes: {}, pokeTreeTimer: 0 } as any;
    skillTreeTickPure(draft, 60);
    expect(draft.pokeTreeTimer).toBe(0);
  });

  it("no-op on delta=0", () => {
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { poke_tree: 1 },
      pokeTreeTimer: 5,
      inspiration: big(0),
      lifetimeInspiration: big(0),
    } as any;
    skillTreeTickPure(draft, 0);
    expect(draft.pokeTreeTimer).toBe(5);
    expect(draft.inspiration.toNumber()).toBe(0);
  });

  it("grants inspiration when interval crossed at level 1", () => {
    // POKE_TREE_INTERVAL_S = 10, POKE_TREE_BASE_INSPI = 100.
    // 31 seconds → floor(31/10) = 3 grants × 100 = 300 inspi, leftover 1s.
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { poke_tree: 1 },
      pokeTreeTimer: 0,
      inspiration: big(0),
      lifetimeInspiration: big(0),
    } as any;
    skillTreeTickPure(draft, 31);
    expect(draft.inspiration.toNumber()).toBe(300);
    expect(draft.lifetimeInspiration.toNumber()).toBe(300);
    expect(draft.pokeTreeTimer).toBe(1);
  });

  it("doubles inspi per tick per additional level (L3 → 400/grant)", () => {
    // L3: 100 × 2^(3-1) = 400 per grant. 25s + initial 5s = 30s → 3 grants × 400 = 1200.
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { poke_tree: 3 },
      pokeTreeTimer: 5,
      inspiration: big(0),
      lifetimeInspiration: big(0),
    } as any;
    skillTreeTickPure(draft, 25);
    expect(draft.inspiration.toNumber()).toBe(1200);
    expect(draft.lifetimeInspiration.toNumber()).toBe(1200);
    expect(draft.pokeTreeTimer).toBe(0);
  });
});
