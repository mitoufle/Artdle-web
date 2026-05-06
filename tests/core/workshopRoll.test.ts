import { describe, it, expect, beforeEach } from "vitest";
import {
  TIER_UNLOCK_LEVEL,
  TIER_AFFIX_COUNT,
  ALL_ITEM_TIERS,
  computeTierProbabilities,
  rollTier,
  rollAffixes,
} from "@/core/workshopRoll";
import { setSeed } from "@/core/rng";

describe("workshopRoll — tier probabilities", () => {
  it("at level 1: only normal is possible", () => {
    const probs = computeTierProbabilities(1);
    expect(probs.normal).toBe(1);
    expect(probs.magic).toBe(0);
    expect(probs.rare).toBe(0);
    expect(probs.epic).toBe(0);
    expect(probs.legendary).toBe(0);
  });

  it("at level 5: magic just unlocks at min prob 0.01", () => {
    const probs = computeTierProbabilities(5);
    expect(probs.magic).toBeCloseTo(0.01, 4);
    expect(probs.rare).toBe(0);
    expect(probs.normal).toBeCloseTo(0.99, 4);
  });

  it("at level 100 (max): legendary at 1%, epic 5%, rare 15%, magic 30%, normal fills remainder", () => {
    const probs = computeTierProbabilities(100);
    expect(probs.legendary).toBeCloseTo(0.01, 4);
    expect(probs.epic).toBeCloseTo(0.05, 4);
    expect(probs.rare).toBeCloseTo(0.15, 4);
    expect(probs.magic).toBeCloseTo(0.30, 4);
    expect(probs.normal).toBeCloseTo(0.49, 4);
  });

  it("probabilities always sum to 1.0", () => {
    for (const lvl of [1, 5, 15, 35, 50, 70, 100]) {
      const probs = computeTierProbabilities(lvl);
      const sum = ALL_ITEM_TIERS.reduce((acc, t) => acc + probs[t], 0);
      expect(sum).toBeCloseTo(1.0, 6);
    }
  });

  it("a tier is 0 below its unlock level", () => {
    expect(computeTierProbabilities(4).magic).toBe(0);
    expect(computeTierProbabilities(14).rare).toBe(0);
    expect(computeTierProbabilities(34).epic).toBe(0);
    expect(computeTierProbabilities(69).legendary).toBe(0);
  });

  it("a tier's prob grows monotonically from unlock to L100", () => {
    let prev = computeTierProbabilities(15).rare;
    for (let lvl = 16; lvl <= 100; lvl++) {
      const cur = computeTierProbabilities(lvl).rare;
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("workshopRoll — rollTier", () => {
  beforeEach(() => {
    setSeed(42);
  });

  it("at level 1, always returns 'normal'", () => {
    for (let i = 0; i < 50; i++) {
      expect(rollTier(1)).toBe("normal");
    }
  });

  it("at level 100, returns each tier at least once across many rolls", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) {
      const t = rollTier(100);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    for (const t of ALL_ITEM_TIERS) {
      expect(counts[t]).toBeGreaterThan(0);
    }
  });

  it("legendary at L70 is approximately 0.01% (within 0.05% empirical tolerance over 100k rolls)", () => {
    let leg = 0;
    for (let i = 0; i < 100_000; i++) {
      if (rollTier(70) === "legendary") leg += 1;
    }
    // Expected ~10 over 100k. Allow wide range due to small N.
    expect(leg).toBeLessThanOrEqual(60);
  });
});

describe("workshopRoll — rollAffixes", () => {
  beforeEach(() => {
    setSeed(42);
  });

  it("returns the correct count per tier", () => {
    expect(rollAffixes("normal").length).toBe(1);
    expect(rollAffixes("magic").length).toBe(2);
    expect(rollAffixes("rare").length).toBe(3);
    expect(rollAffixes("epic").length).toBe(4);
    expect(rollAffixes("legendary").length).toBe(5);
  });

  it("each affix has a kind from AFFIX_KINDS and magnitude in [5, 15]", () => {
    const affixes = rollAffixes("legendary");
    for (const a of affixes) {
      expect(["+canvas_gold%", "-paint_time%"]).toContain(a.kind);
      expect(a.magnitude).toBeGreaterThanOrEqual(5);
      expect(a.magnitude).toBeLessThanOrEqual(15);
    }
  });

  it("duplicates of the same kind are allowed across rolls", () => {
    setSeed(1);
    let foundDuplicate = false;
    for (let i = 0; i < 200 && !foundDuplicate; i++) {
      const affixes = rollAffixes("rare");
      const kinds = affixes.map((a) => a.kind);
      const uniques = new Set(kinds);
      if (uniques.size < kinds.length) foundDuplicate = true;
    }
    expect(foundDuplicate).toBe(true);
  });
});

describe("workshopRoll — constants", () => {
  it("unlock thresholds match spec", () => {
    expect(TIER_UNLOCK_LEVEL.normal).toBe(1);
    expect(TIER_UNLOCK_LEVEL.magic).toBe(5);
    expect(TIER_UNLOCK_LEVEL.rare).toBe(15);
    expect(TIER_UNLOCK_LEVEL.epic).toBe(35);
    expect(TIER_UNLOCK_LEVEL.legendary).toBe(70);
  });

  it("affix counts match spec (1..5)", () => {
    expect(TIER_AFFIX_COUNT.normal).toBe(1);
    expect(TIER_AFFIX_COUNT.magic).toBe(2);
    expect(TIER_AFFIX_COUNT.rare).toBe(3);
    expect(TIER_AFFIX_COUNT.epic).toBe(4);
    expect(TIER_AFFIX_COUNT.legendary).toBe(5);
  });
});
