import { describe, it, expect, beforeEach } from "vitest";
import { setSeed } from "@/core/rng";
import { createBaseStats, applyStatLevelUp, type WorkerStats } from "@/core/workerModel";
import { WORKER_BASE_STATS, WORKER_CRIT_CHANCE_CAP } from "@/core/balance";

describe("workerModel", () => {
  beforeEach(() => setSeed(1));

  it("createBaseStats returns a fresh mutable copy of the base stats", () => {
    const s = createBaseStats();
    expect(s).toEqual(WORKER_BASE_STATS);
    s.goldPct += 0.01;
    expect(WORKER_BASE_STATS.goldPct).toBe(0);
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
