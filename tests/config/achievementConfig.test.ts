import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS } from "@/config/achievementConfig";

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

describe("gold-milestone achievement ladder", () => {
  // Piggy Bank → … → Octillionaire: threshold ×1000, gold bonus +5% per rung.
  const rungs: ReadonlyArray<[string, number, number]> = [
    ["Piggy_bank", 1e3, 0.15],
    ["Millionaire", 1e6, 0.2],
    ["Nerbard_alnaurt", 1e9, 0.25],
    ["Trillionaire", 1e12, 0.3],
    ["Quadrillionaire", 1e15, 0.35],
    ["Quintillionaire", 1e18, 0.4],
    ["Sextillionaire", 1e21, 0.45],
    ["Septillionaire", 1e24, 0.5],
    ["Octillionaire", 1e27, 0.55],
  ];

  it.each(rungs)("%s gates lifetime.goldgain >= %d and grants +%f gold", (id, threshold, bonus) => {
    const a = byId.get(id);
    expect(a, id).toBeDefined();
    expect(a!.condition.stat).toBe("lifetime.goldgain");
    expect(a!.condition.op).toBe(">=");
    expect(a!.condition.value).toBe(threshold);
    const eff = a!.effects.find((e) => e.kind === "canvas_gold_pct");
    expect(eff?.value).toBeCloseTo(bonus, 5);
  });
});

describe("tree-tier achievement ladder", () => {
  it("has T2..T10 gating tree.tier >= N with a canvas-gold effect", () => {
    for (let n = 2; n <= 10; n++) {
      const a = byId.get(`T${n}`);
      expect(a, `T${n}`).toBeDefined();
      expect(a!.condition.stat).toBe("tree.tier");
      expect(a!.condition.op).toBe(">=");
      expect(a!.condition.value).toBe(n);
      expect(a!.effects.some((e) => e.kind === "canvas_gold_pct")).toBe(true);
    }
  });
});
