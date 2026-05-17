import { describe, it, expect } from "vitest";
import { create } from "zustand";
import { createStatsSlice, type StatsSlice, initialStatsLifetime, initialStatsRun } from "@/store/statsSlice";
import { big } from "@/core/bigNumber";

function makeStore() {
  return create<StatsSlice>()((set, get, store) => ({
    ...createStatsSlice(set as never, get as never, store as never),
  }));
}

describe("statsSlice", () => {
  it("initialises with zero lifetime counters", () => {
    const s = makeStore().getState();
    expect(s.statsLifetime.canvasesSold).toBe(0);
    expect(s.statsLifetime.critsLanded).toBe(0);
    expect(s.statsLifetime.workshopItemsCrafted).toBe(0);
  });

  it("initialises with zero run counters", () => {
    const s = makeStore().getState();
    expect(s.statsRun.canvasesSold).toBe(0);
    expect(s.statsRun.currentCritStreak).toBe(0);
    expect(s.statsRun.goldEarned.eq(0)).toBe(true);
  });

  it("incrementStat lifetime adds to existing value", () => {
    const store = makeStore();
    store.getState().incrementStat("lifetime", "canvasesSold", 5);
    store.getState().incrementStat("lifetime", "canvasesSold", 3);
    expect(store.getState().statsLifetime.canvasesSold).toBe(8);
  });

  it("incrementStat run defaults to by=1", () => {
    const store = makeStore();
    store.getState().incrementStat("run", "canvasesSold");
    expect(store.getState().statsRun.canvasesSold).toBe(1);
  });

  it("patchRunStats sets specific run fields to exact values", () => {
    const store = makeStore();
    store.getState().patchRunStats({ currentCritStreak: 7, maxCritStreak: 7 });
    expect(store.getState().statsRun.currentCritStreak).toBe(7);
    expect(store.getState().statsRun.maxCritStreak).toBe(7);
    // other fields untouched
    expect(store.getState().statsRun.canvasesSold).toBe(0);
  });

  it("patchRunStats with goldEarned (Big)", () => {
    const store = makeStore();
    store.getState().patchRunStats({ goldEarned: big("1000000") });
    expect(store.getState().statsRun.goldEarned.eq("1000000")).toBe(true);
  });

  it("resetRunStats resets run to zero, preserves lifetime", () => {
    const store = makeStore();
    store.getState().incrementStat("lifetime", "canvasesSold", 10);
    store.getState().incrementStat("run", "canvasesSold", 5);
    store.getState().resetRunStats();
    expect(store.getState().statsRun.canvasesSold).toBe(0);
    expect(store.getState().statsLifetime.canvasesSold).toBe(10);
  });
});
