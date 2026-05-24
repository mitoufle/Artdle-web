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

  it("AFFIX_MAGNITUDE_RANGE: every tier has all 5 kinds with valid bounds (min >= 1, max >= min)", () => {
    for (const tier of ALL_ITEM_TIERS) {
      for (const kind of AFFIX_KINDS) {
        const range = AFFIX_MAGNITUDE_RANGE[tier][kind];
        expect(range).toBeDefined();
        expect(range.min).toBeGreaterThanOrEqual(1);
        expect(range.max).toBeGreaterThanOrEqual(range.min);
      }
    }
  });

  it("AFFIX_MAGNITUDE_RANGE: normal tier matches base ranges", () => {
    expect(AFFIX_MAGNITUDE_RANGE.normal["+sell_price%"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+speed%"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+size%"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+crit_chunks"]).toEqual({ min: 1, max: 1 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+combo_chance%"]).toEqual({ min: 5, max: 20 });
  });

  it("AFFIX_MAGNITUDE_RANGE: each tier has non-decreasing bounds vs the previous tier (crit_chunks: max strictly increases)", () => {
    const tiers = ALL_ITEM_TIERS;
    for (let i = 1; i < tiers.length; i++) {
      for (const kind of AFFIX_KINDS) {
        if (kind === "+crit_chunks") {
          // crit_chunks uses raw integer chunk counts; min is not strictly monotone
          // (normal→magic both have min=1), but max is always strictly increasing.
          expect(AFFIX_MAGNITUDE_RANGE[tiers[i]!][kind].max)
            .toBeGreaterThan(AFFIX_MAGNITUDE_RANGE[tiers[i - 1]!][kind].max);
        } else {
          expect(AFFIX_MAGNITUDE_RANGE[tiers[i]!][kind].min)
            .toBeGreaterThan(AFFIX_MAGNITUDE_RANGE[tiers[i - 1]!][kind].min);
          expect(AFFIX_MAGNITUDE_RANGE[tiers[i]!][kind].max)
            .toBeGreaterThan(AFFIX_MAGNITUDE_RANGE[tiers[i - 1]!][kind].max);
        }
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

import {
  AFFIX_SYMBOL, AFFIX_COLOR, AFFIX_SYMBOL_SCALE,
} from "@/config/workshopAffixes";

describe("workshopAffixes — crit_chunks replaces crit_chance", () => {
  it("AFFIX_KINDS no longer contains +crit_chance%", () => {
    expect(AFFIX_KINDS).not.toContain("+crit_chance%");
  });

  it("AFFIX_KINDS contains +crit_chunks", () => {
    expect(AFFIX_KINDS).toContain("+crit_chunks");
  });

  it("+crit_chunks has lightning-bolt symbol and warm-gold color", () => {
    expect(AFFIX_SYMBOL["+crit_chunks"]).toBe("⚡");
    expect(AFFIX_COLOR["+crit_chunks"]).toBe("#ffaf3a");
  });

  it("+crit_chunks magnitude ranges are small integer chunk counts per tier", () => {
    expect(AFFIX_MAGNITUDE_RANGE.normal["+crit_chunks"]).toEqual({ min: 1, max: 1 });
    expect(AFFIX_MAGNITUDE_RANGE.magic["+crit_chunks"]).toEqual({ min: 1, max: 2 });
    expect(AFFIX_MAGNITUDE_RANGE.rare["+crit_chunks"]).toEqual({ min: 2, max: 3 });
    expect(AFFIX_MAGNITUDE_RANGE.epic["+crit_chunks"]).toEqual({ min: 2, max: 4 });
    expect(AFFIX_MAGNITUDE_RANGE.legendary["+crit_chunks"]).toEqual({ min: 3, max: 5 });
  });
});
