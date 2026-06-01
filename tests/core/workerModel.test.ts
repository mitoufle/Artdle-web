import { describe, it, expect, beforeEach } from "vitest";
import { setSeed } from "@/core/rng";
import { createBaseStats, createSpawnStats, applyStatLevelUp, type WorkerStats } from "@/core/workerModel";
import { WORKER_BASE_STATS, WORKER_CRIT_CHANCE_CAP } from "@/core/balance";

describe("workerModel", () => {
  beforeEach(() => setSeed(1));

  it("createBaseStats returns a fresh mutable copy of the base stats", () => {
    const s = createBaseStats();
    expect(s).toEqual(WORKER_BASE_STATS);
    s.goldPct += 0.01;
    expect(WORKER_BASE_STATS.goldPct).toBe(0);
  });

  it("createSpawnStats with no bonuses equals the base stats", () => {
    expect(createSpawnStats()).toEqual(WORKER_BASE_STATS);
  });

  it("food_regulation adds +1 native step to every base stat", () => {
    const s = createSpawnStats({ foodRegulation: 1, robinHoodLevels: 0, bluryHandLevels: 0 });
    expect(s.goldPct).toBeCloseTo(0.01, 9);       // +1 percentage point
    expect(s.speed).toBeCloseTo(1.01, 9);         // base 1 + 0.01
    expect(s.critChance).toBeCloseTo(0.02, 9);    // base 0.01 + 0.01 (=2%)
    expect(s.strokesPerCrit).toBe(2);             // base 1 + 1
    expect(s.comboChance).toBeCloseTo(0.01, 9);
  });

  it("robin_hood adds +7% goldPct base per level; blury_hand adds +10% speed base", () => {
    const s = createSpawnStats({ foodRegulation: 0, robinHoodLevels: 3, bluryHandLevels: 1 });
    expect(s.goldPct).toBeCloseTo(0.21, 9);  // 3 × 0.07
    expect(s.speed).toBeCloseTo(1.10, 9);    // base 1 + 0.10
  });

  it("stacks food_regulation + robin_hood on goldPct and clamps crit at the cap", () => {
    const s = createSpawnStats({ foodRegulation: 1, robinHoodLevels: 5, bluryHandLevels: 0 });
    expect(s.goldPct).toBeCloseTo(0.01 + 0.35, 9); // food step + 5 × 0.07
    expect(s.critChance).toBeLessThanOrEqual(WORKER_CRIT_CHANCE_CAP);
  });

  it("applyStatLevelUp only increases stats, within allowed increments", () => {
    let s = createBaseStats();
    for (let i = 0; i < 50; i++) {
      const before = s;
      s = applyStatLevelUp(s);
      expect(s.goldPct).toBeGreaterThanOrEqual(before.goldPct);
      expect(s.speed).toBeGreaterThanOrEqual(before.speed);
      expect(s.comboChance).toBeGreaterThanOrEqual(before.comboChance);
      expect(s.goldPct - before.goldPct).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(s.strokesPerCrit - before.strokesPerCrit).toBeLessThanOrEqual(1);
      expect(Number.isInteger(s.strokesPerCrit)).toBe(true);
    }
  });

  it("crit chance never exceeds the cap", () => {
    let s = createBaseStats();
    for (let i = 0; i < 1000; i++) s = applyStatLevelUp(s);
    expect(s.critChance).toBeLessThanOrEqual(WORKER_CRIT_CHANCE_CAP);
  });

  it("is deterministic under a fixed seed", () => {
    setSeed(42); let a = createBaseStats(); for (let i = 0; i < 20; i++) a = applyStatLevelUp(a);
    setSeed(42); let b = createBaseStats(); for (let i = 0; i < 20; i++) b = applyStatLevelUp(b);
    expect(a).toEqual(b);
  });
});
