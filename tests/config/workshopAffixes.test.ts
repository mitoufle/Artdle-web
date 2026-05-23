import { describe, it, expect } from "vitest";
import {
  AFFIX_KINDS,
  AFFIX_MAGNITUDE_RANGE,
  MAX_INVENTORY_SLOTS,
} from "@/config/workshopAffixes";
import { ALL_ITEM_TIERS } from "@/core/workshopRoll";

describe("workshopAffixes config", () => {
  it("AFFIX_KINDS has exactly 5 entries (painting-only pool: sell_price, speed, crit, combo, size)", () => {
    expect(AFFIX_KINDS).toHaveLength(5);
  });

  it("the affix kinds are unique", () => {
    expect(new Set(AFFIX_KINDS).size).toBe(AFFIX_KINDS.length);
  });

  it("the affix kinds are all painting-related (no tree-mechanic affixes)", () => {
    // v1 design constraint: items only boost painting mechanics. Tree-side
    // bonuses live on skill-tree nodes. See workshopAffixes.ts JSDoc.
    const treeMechanicAffixes = ["+inspiration_rate%", "+tree_part_cost_reduction%"];
    for (const kind of AFFIX_KINDS) {
      expect(treeMechanicAffixes).not.toContain(kind);
    }
  });

  it("AFFIX_MAGNITUDE_RANGE: every tier has all 5 kinds with valid bounds (min < max, all > 0)", () => {
    for (const tier of ALL_ITEM_TIERS) {
      for (const kind of AFFIX_KINDS) {
        const range = AFFIX_MAGNITUDE_RANGE[tier][kind];
        expect(range).toBeDefined();
        expect(range.min).toBeGreaterThan(0);
        expect(range.max).toBeGreaterThan(0);
        expect(range.min).toBeLessThan(range.max);
      }
    }
  });

  it("AFFIX_MAGNITUDE_RANGE: normal tier matches base ranges", () => {
    expect(AFFIX_MAGNITUDE_RANGE.normal["+sell_price%"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+speed%"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+size%"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+crit_chance%"]).toEqual({ min: 2, max: 8 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+combo_chance%"]).toEqual({ min: 5, max: 20 });
  });

  it("AFFIX_MAGNITUDE_RANGE: each tier has strictly higher bounds than the previous tier", () => {
    const tiers = ALL_ITEM_TIERS;
    for (let i = 1; i < tiers.length; i++) {
      for (const kind of AFFIX_KINDS) {
        expect(AFFIX_MAGNITUDE_RANGE[tiers[i]!][kind].min)
          .toBeGreaterThan(AFFIX_MAGNITUDE_RANGE[tiers[i - 1]!][kind].min);
        expect(AFFIX_MAGNITUDE_RANGE[tiers[i]!][kind].max)
          .toBeGreaterThan(AFFIX_MAGNITUDE_RANGE[tiers[i - 1]!][kind].max);
      }
    }
  });

  it("AFFIX_MAGNITUDE_RANGE: legendary sell_price range matches spec (48–66)", () => {
    expect(AFFIX_MAGNITUDE_RANGE.legendary["+sell_price%"]).toEqual({ min: 48, max: 66 });
  });

  it("all numeric constants are positive", () => {
    expect(MAX_INVENTORY_SLOTS).toBeGreaterThan(0);
  });

  it("MAX_INVENTORY_SLOTS === 3 (pin v1 contract)", () => {
    expect(MAX_INVENTORY_SLOTS).toBe(3);
  });
});
