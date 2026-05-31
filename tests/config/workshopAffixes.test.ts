import { describe, it, expect } from "vitest";
import {
  AFFIX_KINDS,
  AFFIX_MAGNITUDE_RANGE,
  FUSE_MAGNITUDE_PCT_RANGE,
  MAX_INVENTORY_SLOTS,
} from "@/config/workshopAffixes";
import { ALL_ITEM_TIERS } from "@/core/workshopRoll";

describe("workshopAffixes config", () => {
  it("AFFIX_KINDS has exactly 4 entries (painting-only pool: sell_price, speed, crit, combo)", () => {
    expect(AFFIX_KINDS).toHaveLength(4);
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

  it("AFFIX_MAGNITUDE_RANGE: every tier has all 4 kinds with valid bounds (min >= 1, max >= min)", () => {
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
    expect(AFFIX_MAGNITUDE_RANGE.normal["+crit_chunks"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.normal["+combo_chance%"]).toEqual({ min: 5, max: 20 });
  });

  it("AFFIX_MAGNITUDE_RANGE: each tier has strictly increasing bounds vs the previous tier", () => {
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

describe("FUSE_MAGNITUDE_PCT_RANGE", () => {
  it("matches the per-tier fusion bands", () => {
    expect(FUSE_MAGNITUDE_PCT_RANGE.normal).toEqual({ min: 0.10, max: 0.25 });
    expect(FUSE_MAGNITUDE_PCT_RANGE.magic).toEqual({ min: 0.15, max: 0.30 });
    expect(FUSE_MAGNITUDE_PCT_RANGE.rare).toEqual({ min: 0.20, max: 0.35 });
    expect(FUSE_MAGNITUDE_PCT_RANGE.epic).toEqual({ min: 0.25, max: 0.40 });
    expect(FUSE_MAGNITUDE_PCT_RANGE.legendary).toEqual({ min: 0.30, max: 0.45 });
  });

  it("every tier band is valid (0 < min < max) and floors rise with tier", () => {
    const tiers = ALL_ITEM_TIERS;
    for (let i = 0; i < tiers.length; i++) {
      const band = FUSE_MAGNITUDE_PCT_RANGE[tiers[i]!];
      expect(band.min).toBeGreaterThan(0);
      expect(band.max).toBeGreaterThan(band.min);
      if (i > 0) {
        expect(band.min).toBeGreaterThan(FUSE_MAGNITUDE_PCT_RANGE[tiers[i - 1]!].min);
      }
    }
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

  it("+crit_chunks magnitude ranges are harmonized with the percent-scale affixes (issue #6)", () => {
    // crit_chunks magnitude is consumed as a PERCENT of base crit chunks, so it
    // shares the sell_price%/speed% scale; the old 1..5 integer counts floored
    // to no effect and displayed out of line with the other affix values.
    expect(AFFIX_MAGNITUDE_RANGE.normal["+crit_chunks"]).toEqual({ min: 15, max: 25 });
    expect(AFFIX_MAGNITUDE_RANGE.magic["+crit_chunks"]).toEqual({ min: 20, max: 30 });
    expect(AFFIX_MAGNITUDE_RANGE.rare["+crit_chunks"]).toEqual({ min: 26, max: 38 });
    expect(AFFIX_MAGNITUDE_RANGE.epic["+crit_chunks"]).toEqual({ min: 35, max: 50 });
    expect(AFFIX_MAGNITUDE_RANGE.legendary["+crit_chunks"]).toEqual({ min: 48, max: 66 });
  });
});
