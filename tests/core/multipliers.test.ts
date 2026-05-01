import { describe, it, expect } from "vitest";
import {
  getInspiMultiplier,
  getCanvasGoldMultiplier,
  getPaintTimeMultiplier,
} from "@/core/multipliers";
import type { GameStore } from "@/store";

// A minimal GameStore-shaped stub. Only the type signature matters; the
// Phase-2 functions don't read any fields.
const stubState = {} as GameStore;

describe("multipliers (Phase 2 — empty aggregators)", () => {
  it("getInspiMultiplier returns 1 with no contributors", () => {
    expect(getInspiMultiplier(stubState)).toBe(1);
  });

  it("getCanvasGoldMultiplier returns 1 with no contributors", () => {
    expect(getCanvasGoldMultiplier(stubState)).toBe(1);
  });

  it("getPaintTimeMultiplier returns 1 with no contributors", () => {
    expect(getPaintTimeMultiplier(stubState)).toBe(1);
  });

  it("convention: each multiplier follows 1 + sum(contributions); Phase 2 has 0 contributors so all return 1", () => {
    // Documentation test. Phase 3 will read item affixes and skill-tree nodes,
    // adding `bonus += affix.value` lines, then `return 1 + bonus`.
    // This test pins the formula intent so Phase 3 starts from the right shape.
    const contributions = 0;
    const expected = 1 + contributions;
    expect(getInspiMultiplier(stubState)).toBe(expected);
    expect(getCanvasGoldMultiplier(stubState)).toBe(expected);
    expect(getPaintTimeMultiplier(stubState)).toBe(expected);
  });
});
