import { describe, it, expect, vi } from "vitest";

// Decouple from the mutable design config (edited via the achievement designer).
vi.mock("@/config/achievementConfig", () => ({
  ACHIEVEMENTS: [
    { id: "first_canvas", name: "", description: "", icon: "", category: "canvas",
      condition: { stat: "lifetime.canvasesSold", op: ">=", value: 1 },
      effects: [{ kind: "canvas_gold_pct", value: 0.10 }] },
    { id: "canvas_thousand", name: "", description: "", icon: "", category: "canvas",
      condition: { stat: "lifetime.canvasesSold", op: ">=", value: 1000 },
      effects: [{ kind: "canvas_gold_pct", value: 0.05 }] },
    { id: "craft_fifty", name: "", description: "", icon: "", category: "workshop",
      condition: { stat: "lifetime.workshopItemsCrafted", op: ">=", value: 50 },
      effects: [{ kind: "canvas_gold_pct", value: 0.05 }] },
  ],
}));

import { getAchievementBonus } from "@/core/achievementMultipliers";

const baseState = {
  completedAchievements: {} as Record<string, true>,
};

describe("getAchievementBonus", () => {
  it("returns 0 when no achievements completed", () => {
    expect(getAchievementBonus(baseState, "canvas_gold_pct")).toBe(0);
  });

  it("sums effects of the given kind across completed achievements", () => {
    // canvas_thousand gives canvas_gold_pct: 0.05
    // craft_fifty gives canvas_gold_pct: 0.05
    const state = { completedAchievements: { canvas_thousand: true as const, craft_fifty: true as const } };
    expect(getAchievementBonus(state, "canvas_gold_pct")).toBeCloseTo(0.10);
  });

  it("ignores effects of other kinds", () => {
    const state = { completedAchievements: { canvas_thousand: true as const } };
    expect(getAchievementBonus(state, "speed_pct")).toBe(0);
  });

});
