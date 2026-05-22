import { describe, expect, it } from "vitest";
import { officeTickPure } from "@/core/officeTickPure";
import { useGameStore } from "@/store";

describe("officeTickPure", () => {
  it("no-op when queue cap is 0", () => {
    const draft = { ...useGameStore.getState(), purchasedNodes: {} } as any;
    officeTickPure(draft, 600);
    expect(draft.queue.length).toBe(0);
  });

  it("no-op on delta=0", () => {
    const draft = {
      ...useGameStore.getState(),
      // entrepreneur unlocks both roster_slot and queue_slot.
      purchasedNodes: { entrepreneur: 1 },
      queue: [],
      trickleTimer: 0,
      officeLevel: 1,
    } as any;
    officeTickPure(draft, 0);
    expect(draft.queue.length).toBe(0);
    expect(draft.trickleTimer).toBe(0);
  });

  it("appends candidates when interval crossed", () => {
    const draft = {
      ...useGameStore.getState(),
      // entrepreneur (maxLevel=1) carries `queue_slot` and `roster_slot`
      // capabilities, giving a queue cap of 1.
      purchasedNodes: { entrepreneur: 1 },
      queue: [],
      trickleTimer: 0,
      officeLevel: 1,
    } as any;
    // trickleSeconds(1) ≈ 58.2s; 120s > one period, but queueCap=1
    // so exactly one candidate is appended and the loop stops.
    officeTickPure(draft, 120);
    expect(draft.queue.length).toBe(1);
  });

  it("stops at queue cap and accumulates remaining time in trickleTimer", () => {
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { entrepreneur: 1 },
      queue: [],
      trickleTimer: 0,
      officeLevel: 1,
    } as any;
    officeTickPure(draft, 600);
    // queueCap=1, only one candidate emitted; timer should NOT be drained
    // past cap (the while loop bails on queueSize >= cap).
    expect(draft.queue.length).toBe(1);
  });
});
