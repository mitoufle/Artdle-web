import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import type { Item } from "@/store/workshopSlice";

/**
 * End-to-end wiring for the 2026-05-31 achievement submission against the REAL
 * ACHIEVEMENTS table (the slice unit test mocks the config). Covers the new
 * resolver alias, the one-time fame reward, and the synthetic-stat unlocks.
 */
function reset() {
  useGameStore.setState((s) => ({
    completedAchievements: {},
    activeNotification: null,
    notificationQueue: [],
    ascendCount: 0,
    fame: big(0),
    equipped: {},
    inventory: [],
    statsLifetime: { ...s.statsLifetime, fameSpent: 0, logoClicks: 0, fPresses: 0 },
  }));
}

describe("achievement wiring — ascension + secret achievements", () => {
  beforeEach(reset);

  it("Portaled: first ascend unlocks it and grants +10 fame, once (idempotent)", () => {
    useGameStore.setState({ ascendCount: 1, fame: big(0) });
    useGameStore.getState().evaluateAchievements();
    expect(useGameStore.getState().completedAchievements.Portaled).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(10);
    // Re-evaluating must NOT grant again (completedAchievements guard).
    useGameStore.getState().evaluateAchievements();
    expect(useGameStore.getState().fame.toNumber()).toBe(10);
  });

  it("Spotlight unlocks once 1000 lifetime fame has been spent", () => {
    useGameStore.setState((s) => ({ statsLifetime: { ...s.statsLifetime, fameSpent: 1000 } }));
    useGameStore.getState().evaluateAchievements();
    expect(useGameStore.getState().completedAchievements.Spotlight).toBe(true);
  });

  it("Random Clicker unlocks on the first logo click", () => {
    useGameStore.setState((s) => ({ statsLifetime: { ...s.statsLifetime, logoClicks: 1 } }));
    useGameStore.getState().evaluateAchievements();
    expect(useGameStore.getState().completedAchievements.Random_clicker).toBe(true);
  });

  it("Pay Respect unlocks on the first F press", () => {
    useGameStore.setState((s) => ({ statsLifetime: { ...s.statsLifetime, fPresses: 1 } }));
    useGameStore.getState().evaluateAchievements();
    expect(useGameStore.getState().completedAchievements.Pay_respect).toBe(true);
  });

  it("Materialist unlocks when a legendary item is equipped", () => {
    const legendary: Item = { id: "leg-brush", slot: "brush", tier: "legendary", affixes: [], fuseCount: 0 };
    useGameStore.setState({ completedAchievements: {}, inventory: [legendary], equipped: {} });
    expect(useGameStore.getState().equipItem("leg-brush")).toBe(true);
    expect(useGameStore.getState().completedAchievements.Materialist).toBe(true);
  });

  it("does NOT unlock Materialist for a non-legendary equip", () => {
    const rare: Item = { id: "rare-brush", slot: "brush", tier: "rare", affixes: [], fuseCount: 0 };
    useGameStore.setState({ completedAchievements: {}, inventory: [rare], equipped: {} });
    expect(useGameStore.getState().equipItem("rare-brush")).toBe(true);
    expect(useGameStore.getState().completedAchievements.Materialist).toBeUndefined();
  });

  it("buyNode accumulates lifetime fameSpent (drives Spotlight)", () => {
    useGameStore.setState((s) => ({
      purchasedNodes: {},
      fame: big(100),
      devFreeNodes: false,
      statsLifetime: { ...s.statsLifetime, fameSpent: 0 },
    }));
    expect(useGameStore.getState().buyNode("get_inspired")).toBe(true);
    // get_inspired level-1 cost is 1 fame.
    expect(useGameStore.getState().statsLifetime.fameSpent).toBe(1);
  });
});
