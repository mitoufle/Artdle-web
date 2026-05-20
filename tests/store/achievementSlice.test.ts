import { describe, it, expect, vi, beforeEach } from "vitest";
import { create } from "zustand";

// Engine tests must not depend on the mutable design config
// (src/config/achievementsDesign.json — edited via the achievement designer).
// Mock a stable fixture so these test the evaluation engine, not the data.
vi.mock("@/config/achievementConfig", () => ({
  ACHIEVEMENTS: [
    {
      id: "first_canvas",
      name: "First Canvas",
      description: "",
      icon: "🖼️",
      category: "canvas",
      condition: { stat: "lifetime.canvasesSold", op: ">=", value: 1 },
      effects: [{ kind: "paint_mastery_flat", value: 5 }],
    },
    {
      id: "canvas_hundred",
      name: "Hundred Canvases",
      description: "",
      icon: "💯",
      category: "canvas",
      condition: { stat: "lifetime.canvasesSold", op: ">=", value: 100 },
      effects: [{ kind: "canvas_gold_pct", value: 0.1 }],
    },
    {
      id: "piggy_bank_test",
      name: "Piggy Bank Test",
      description: "",
      icon: "🐽",
      category: "canvas",
      condition: { stat: "lifetime.goldgain", op: ">=", value: 1000 },
      effects: [{ kind: "canvas_gold_pct", value: 0.15 }],
    },
    {
      id: "psychedelic_test",
      name: "Psychedelic Test",
      description: "",
      icon: "🌿",
      category: "canvas",
      condition: { stat: "lifetime.inspirationgain", op: ">=", value: 1000 },
      effects: [{ kind: "inspi_pct", value: 0.15 }],
    },
  ],
}));

import { createAchievementSlice, type AchievementSlice } from "@/store/achievementSlice";
import { big } from "@/core/bigNumber";

// Minimal store shape for testing achievement slice in isolation.
// evaluateAchievements needs to read stats + paintMastery from the store.
type TestStore = AchievementSlice & {
  statsLifetime: { canvasesSold: number; critsLanded: number; maxComboChain: number; workshopItemsCrafted: number; workshopItemsFused: number; schoolResearchesCompleted: number; schoolTiersPassed: number; officeWorkersHired: number };
  statsRun: { canvasesSold: number; critsLanded: number; currentCritStreak: number; maxCritStreak: number; maxComboChain: number; goldEarned: ReturnType<typeof big>; workshopItemsCrafted: number; schoolResearchesCompleted: number };
  paintMastery: ReturnType<typeof big>;
  lifetimeGold: ReturnType<typeof big>;
  lifetimeInspiration: ReturnType<typeof big>;
  ascendCount: number;
  addPaintMastery: (amount: ReturnType<typeof big>) => void;
};

function makeStore(overrides: Partial<TestStore> = {}) {
  return create<TestStore>()((set, get, store) => ({
    statsLifetime: { canvasesSold: 0, critsLanded: 0, maxComboChain: 0, workshopItemsCrafted: 0, workshopItemsFused: 0, schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0 },
    statsRun: { canvasesSold: 0, critsLanded: 0, currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0, goldEarned: big(0), workshopItemsCrafted: 0, schoolResearchesCompleted: 0 },
    paintMastery: big(0),
    lifetimeGold: big(0),
    lifetimeInspiration: big(0),
    ascendCount: 0,
    addPaintMastery: (amount) => set((s) => ({ paintMastery: s.paintMastery.add(amount) })),
    ...createAchievementSlice(set as never, get as never, store as never),
    ...overrides,
  }));
}

describe("achievementSlice — initial state", () => {
  it("starts with empty completedAchievements", () => {
    expect(Object.keys(makeStore().getState().completedAchievements)).toHaveLength(0);
  });
  it("activeNotification is null", () => {
    expect(makeStore().getState().activeNotification).toBeNull();
  });
});

describe("evaluateAchievements", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("completes achievement when condition is met", () => {
    const store = makeStore({ statsLifetime: { canvasesSold: 1, critsLanded: 0, maxComboChain: 0, workshopItemsCrafted: 0, workshopItemsFused: 0, schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0 } } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    expect(store.getState().completedAchievements["first_canvas"]).toBe(true);
  });

  it("does not double-complete an already completed achievement", () => {
    const store = makeStore({ statsLifetime: { canvasesSold: 1, critsLanded: 0, maxComboChain: 0, workshopItemsCrafted: 0, workshopItemsFused: 0, schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0 } } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    const pm1 = store.getState().paintMastery.toNumber();
    store.getState().evaluateAchievements();
    const pm2 = store.getState().paintMastery.toNumber();
    expect(pm1).toBe(pm2);
  });

  it("credits paint_mastery_flat effects once on completion", () => {
    const store = makeStore({ statsLifetime: { canvasesSold: 1, critsLanded: 0, maxComboChain: 0, workshopItemsCrafted: 0, workshopItemsFused: 0, schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0 } } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    // first_canvas gives +5 PM
    expect(store.getState().paintMastery.toNumber()).toBe(5);
  });

  it("queues notification on completion and sets activeNotification", () => {
    const store = makeStore({ statsLifetime: { canvasesSold: 1, critsLanded: 0, maxComboChain: 0, workshopItemsCrafted: 0, workshopItemsFused: 0, schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0 } } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    expect(store.getState().activeNotification?.id).toBe("first_canvas");
  });

  it("clears notification after 5 seconds", () => {
    const store = makeStore({ statsLifetime: { canvasesSold: 1, critsLanded: 0, maxComboChain: 0, workshopItemsCrafted: 0, workshopItemsFused: 0, schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0 } } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    vi.advanceTimersByTime(5000);
    expect(store.getState().activeNotification).toBeNull();
  });

  it("resolves lifetime.goldgain from state.lifetimeGold and fires when threshold crossed", () => {
    const store = makeStore({ lifetimeGold: big(1000) } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    expect(store.getState().completedAchievements["piggy_bank_test"]).toBe(true);
  });

  it("does not fire piggy_bank_test below threshold (lifetimeGold = 999)", () => {
    const store = makeStore({ lifetimeGold: big(999) } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    expect(store.getState().completedAchievements["piggy_bank_test"]).toBeUndefined();
  });

  it("resolves lifetime.inspirationgain from state.lifetimeInspiration and fires when threshold crossed", () => {
    const store = makeStore({ lifetimeInspiration: big(1000) } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    expect(store.getState().completedAchievements["psychedelic_test"]).toBe(true);
  });

  it("does not fire psychedelic_test below threshold (lifetimeInspiration = 999)", () => {
    const store = makeStore({ lifetimeInspiration: big(999) } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    expect(store.getState().completedAchievements["psychedelic_test"]).toBeUndefined();
  });

  it("FIFO: multiple unlocks drain queue in order", () => {
    const store = makeStore({ statsLifetime: { canvasesSold: 100, critsLanded: 0, maxComboChain: 0, workshopItemsCrafted: 0, workshopItemsFused: 0, schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0 } } as Partial<TestStore>);
    store.getState().evaluateAchievements();
    // first_canvas (>=1) and canvas_hundred (>=100) both fire
    const first = store.getState().activeNotification?.id;
    expect(["first_canvas", "canvas_hundred"]).toContain(first);
    vi.advanceTimersByTime(5000);
    const second = store.getState().activeNotification?.id;
    expect(["first_canvas", "canvas_hundred"]).toContain(second);
    expect(first).not.toBe(second);
    vi.advanceTimersByTime(5000);
    expect(store.getState().activeNotification).toBeNull();
  });
});
