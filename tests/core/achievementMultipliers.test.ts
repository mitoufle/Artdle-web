import { describe, it, expect } from "vitest";
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

  it("does not include paint_mastery_flat in multiplier bonus (that is one-shot)", () => {
    const state = { completedAchievements: { first_canvas: true as const } };
    expect(getAchievementBonus(state, "paint_mastery_flat")).toBe(5); // still returned if queried
    // The caller (multipliers.ts) simply never queries paint_mastery_flat via this fn.
  });
});
