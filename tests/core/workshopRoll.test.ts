import { describe, it, expect, beforeEach } from "vitest";
import {
  TIER_UNLOCK_LEVEL,
  TIER_AFFIX_COUNT,
  TIER_XP,
  ALL_ITEM_TIERS,
  computeTierProbabilities,
  rollTier,
  rollAffixes,
} from "@/core/workshopRoll";
import { AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";
import { setSeed } from "@/core/rng";
import type { GameStore } from "@/store";

function baseStub(over: Partial<GameStore> = {}): GameStore {
  return { purchasedNodes: {}, ...over } as GameStore;
}

describe("workshopRoll — tier probabilities", () => {
  it("at level 1: only normal is possible", () => {
    const probs = computeTierProbabilities(1);
    expect(probs.normal).toBe(1);
    expect(probs.magic).toBe(0);
    expect(probs.rare).toBe(0);
    expect(probs.epic).toBe(0);
    expect(probs.legendary).toBe(0);
  });

  it("at level 3: magic just unlocks at min prob 0.01", () => {
    const probs = computeTierProbabilities(3);
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
    expect(computeTierProbabilities(2).magic).toBe(0);
    expect(computeTierProbabilities(7).rare).toBe(0);
    expect(computeTierProbabilities(19).epic).toBe(0);
    expect(computeTierProbabilities(39).legendary).toBe(0);
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

  it("at L40 (legendary first unlock) prob is ~0.01%; at L70 prob is much higher", () => {
    setSeed(42);
    let legAt40 = 0;
    let legAt70 = 0;
    for (let i = 0; i < 100_000; i++) {
      if (rollTier(40) === "legendary") legAt40++;
      if (rollTier(70) === "legendary") legAt70++;
    }
    expect(legAt40).toBeLessThanOrEqual(100);
    expect(legAt70).toBeGreaterThan(100);
  });
});

describe("workshopRoll — rollAffixes", () => {
  beforeEach(() => {
    setSeed(42);
  });

  it("returns the correct count per tier", () => {
    const s = baseStub();
    expect(rollAffixes("normal", s).length).toBe(1);
    expect(rollAffixes("magic", s).length).toBe(2);
    expect(rollAffixes("rare", s).length).toBe(3);
    expect(rollAffixes("epic", s).length).toBe(4);
    expect(rollAffixes("legendary", s).length).toBe(5);
  });

  it("each affix has a kind from AFFIX_KINDS and magnitude within that kind's range", () => {
    const affixes = rollAffixes("legendary", baseStub());
    for (const a of affixes) {
      expect(["+sell_price%", "+speed%", "+crit_chance%", "+combo_chance%", "+size%"]).toContain(a.kind);
      const range = AFFIX_MAGNITUDE_RANGE[a.kind];
      expect(a.magnitude).toBeGreaterThanOrEqual(range.min);
      expect(a.magnitude).toBeLessThanOrEqual(range.max);
    }
  });

  it("duplicates of the same kind are allowed across rolls", () => {
    setSeed(1);
    const s = baseStub({ purchasedNodes: { size_matters: 1, genius_episode: 1, unrelentless: 1 } });
    let foundDuplicate = false;
    for (let i = 0; i < 200 && !foundDuplicate; i++) {
      const affixes = rollAffixes("rare", s);
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
    expect(TIER_UNLOCK_LEVEL.magic).toBe(3);
    expect(TIER_UNLOCK_LEVEL.rare).toBe(8);
    expect(TIER_UNLOCK_LEVEL.epic).toBe(20);
    expect(TIER_UNLOCK_LEVEL.legendary).toBe(40);
  });

  it("TIER_XP has correct values per tier", () => {
    expect(TIER_XP.normal).toBe(1);
    expect(TIER_XP.magic).toBe(2);
    expect(TIER_XP.rare).toBe(3);
    expect(TIER_XP.epic).toBe(4);
    expect(TIER_XP.legendary).toBe(5);
  });

  it("affix counts match spec (1..5)", () => {
    expect(TIER_AFFIX_COUNT.normal).toBe(1);
    expect(TIER_AFFIX_COUNT.magic).toBe(2);
    expect(TIER_AFFIX_COUNT.rare).toBe(3);
    expect(TIER_AFFIX_COUNT.epic).toBe(4);
    expect(TIER_AFFIX_COUNT.legendary).toBe(5);
  });
});

describe("rollAffixes — skill-tree gating", () => {
  it("with no track unlocks, only sell_price + speed roll", () => {
    setSeed(1);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const affixes = rollAffixes("legendary", baseStub());
      for (const a of affixes) seen.add(a.kind);
    }
    expect(seen.has("+sell_price%")).toBe(true);
    expect(seen.has("+speed%")).toBe(true);
    expect(seen.has("+crit_chance%")).toBe(false);
    expect(seen.has("+combo_chance%")).toBe(false);
    expect(seen.has("+size%")).toBe(false);
  });

  it("with genius_episode owned (unlocks canvas_crit), +crit_chance% can roll", () => {
    setSeed(1);
    const state = baseStub({ purchasedNodes: { genius_episode: 1 } });
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const affixes = rollAffixes("legendary", state);
      for (const a of affixes) seen.add(a.kind);
    }
    expect(seen.has("+crit_chance%")).toBe(true);
    expect(seen.has("+combo_chance%")).toBe(false);
  });

  it("with all 3 unlocks owned, all 5 kinds can roll", () => {
    setSeed(1);
    const state = baseStub({
      purchasedNodes: {
        size_matters: 1,
        genius_episode: 1,
        unrelentless: 1,
      },
    });
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const affixes = rollAffixes("legendary", state);
      for (const a of affixes) seen.add(a.kind);
    }
    expect(seen.size).toBe(5);
  });
});
