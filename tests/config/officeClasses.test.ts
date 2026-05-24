import { describe, it, expect } from "vitest";
import { OFFICE_CLASSES, GENERALIST_CLASS_WEIGHT, SPECIALIST_CLASS_WEIGHT } from "@/config/officeClasses";

describe("officeClasses config", () => {
  it("exposes generalist, goldsmith, speedrunner", () => {
    expect(OFFICE_CLASSES.generalist).toBeDefined();
    expect(OFFICE_CLASSES.goldsmith).toBeDefined();
    expect(OFFICE_CLASSES.speedrunner).toBeDefined();
  });

  it("generalist has no capability gate", () => {
    expect(OFFICE_CLASSES.generalist.capability).toBeNull();
  });

  it("goldsmith and speedrunner each have a capability gate", () => {
    expect(OFFICE_CLASSES.goldsmith.capability).toBe("class_goldsmith");
    expect(OFFICE_CLASSES.speedrunner.capability).toBe("class_speedrunner");
  });

  it("generalist weight ranges are [0, 4] for percent kinds, [0, 1] for crit_chunks", () => {
    const w = OFFICE_CLASSES.generalist.weightRanges;
    for (const kind of ["+sell_price%", "+speed%", "+size%", "+combo_chance%"] as const) {
      expect(w[kind]).toEqual({ min: 0, max: 4 });
    }
    expect(w["+crit_chunks"]).toEqual({ min: 0, max: 1 });
  });

  it("goldsmith is gold-heavy (sell + combo [3,7]; speed [0,2]; crit_chunks [0,1]; size [1,3])", () => {
    const w = OFFICE_CLASSES.goldsmith.weightRanges;
    expect(w["+sell_price%"]).toEqual({ min: 3, max: 7 });
    expect(w["+combo_chance%"]).toEqual({ min: 3, max: 7 });
    expect(w["+speed%"]).toEqual({ min: 0, max: 2 });
    expect(w["+crit_chunks"]).toEqual({ min: 0, max: 1 });
    expect(w["+size%"]).toEqual({ min: 1, max: 3 });
  });

  it("speedrunner is speed-heavy (speed [3,7]; crit_chunks [1,2])", () => {
    const w = OFFICE_CLASSES.speedrunner.weightRanges;
    expect(w["+speed%"]).toEqual({ min: 3, max: 7 });
    expect(w["+crit_chunks"]).toEqual({ min: 1, max: 2 });
    expect(w["+sell_price%"]).toEqual({ min: 0, max: 2 });
    expect(w["+combo_chance%"]).toEqual({ min: 0, max: 2 });
    expect(w["+size%"]).toEqual({ min: 1, max: 3 });
  });

  it("generalist class roll weight is 3; specialists are 1", () => {
    expect(GENERALIST_CLASS_WEIGHT).toBe(3);
    expect(SPECIALIST_CLASS_WEIGHT).toBe(1);
  });
});
