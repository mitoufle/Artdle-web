import { describe, it, expect } from "vitest";
import { formatWorkerStatAbsolute, formatWorkerStatDelta, WORKER_STAT_KEYS } from "@/components/painting/workerStatDisplay";
import { createBaseStats } from "@/core/workerModel";

describe("formatWorkerStatAbsolute", () => {
  it("formats each base stat for display", () => {
    const s = createBaseStats(); // goldPct 0, speed 1, critChance 0.01, strokesPerCrit 1, comboChance 0
    expect(formatWorkerStatAbsolute("goldPct", s.goldPct)).toBe("+0%");
    expect(formatWorkerStatAbsolute("speed", s.speed)).toBe("×1.00");
    expect(formatWorkerStatAbsolute("critChance", s.critChance)).toBe("1.0%");
    expect(formatWorkerStatAbsolute("strokesPerCrit", s.strokesPerCrit)).toBe("1");
    expect(formatWorkerStatAbsolute("comboChance", s.comboChance)).toBe("0.0%");
  });

  it("formats grown stats", () => {
    expect(formatWorkerStatAbsolute("goldPct", 0.23)).toBe("+23%");
    expect(formatWorkerStatAbsolute("speed", 1.15)).toBe("×1.15");
    expect(formatWorkerStatAbsolute("critChance", 0.105)).toBe("10.5%");
    expect(formatWorkerStatAbsolute("strokesPerCrit", 3)).toBe("3");
  });
});

describe("formatWorkerStatDelta", () => {
  it("returns null when a stat did not change", () => {
    expect(formatWorkerStatDelta("goldPct", 0.10, 0.10)).toBeNull();
    expect(formatWorkerStatDelta("strokesPerCrit", 2, 2)).toBeNull();
  });

  it("formats a positive percent-point delta", () => {
    expect(formatWorkerStatDelta("goldPct", 0.10, 0.13)).toBe("+3% gold");
    expect(formatWorkerStatDelta("speed", 1.00, 1.04)).toBe("+4% speed");
    expect(formatWorkerStatDelta("critChance", 0.01, 0.03)).toBe("+2% crit");
    expect(formatWorkerStatDelta("comboChance", 0, 0.05)).toBe("+5% combo");
  });

  it("formats a strokes-per-crit delta as an integer", () => {
    expect(formatWorkerStatDelta("strokesPerCrit", 1, 2)).toBe("+1 stroke/crit");
  });

  it("WORKER_STAT_KEYS lists all five stats in display order", () => {
    expect(WORKER_STAT_KEYS).toEqual(["goldPct", "speed", "critChance", "strokesPerCrit", "comboChance"]);
  });
});
