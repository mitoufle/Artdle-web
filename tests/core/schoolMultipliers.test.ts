import { describe, it, expect } from "vitest";
import { getSchoolBonus } from "@/core/schoolMultipliers";
import type { GameStore } from "@/store";

describe("getSchoolBonus", () => {
  it("returns 0 when no researches completed", () => {
    const state = { completedResearches: {} } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBe(0);
  });

  it("sums value of completed researches matching the kind", () => {
    // color_theory_basics: +0.15 canvas_gold_pct
    // brushwork_basics: +0.10 canvas_gold_pct
    const state = {
      completedResearches: {
        color_theory_basics: true,
        brushwork_basics: true,
      },
    } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBeCloseTo(0.25, 5);
  });

  it("ignores completed researches of a different kind", () => {
    // light_and_shadow: +0.08 speed_pct (not canvas_gold_pct)
    const state = {
      completedResearches: { light_and_shadow: true },
    } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBe(0);
    expect(getSchoolBonus(state, "speed_pct")).toBeCloseTo(0.08, 5);
  });

  it("sums across tiers", () => {
    // tier 1: color_theory_basics +0.15
    // tier 2: composition +0.12
    const state = {
      completedResearches: {
        color_theory_basics: true,
        composition: true,
      },
    } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBeCloseTo(0.27, 5);
  });
});
