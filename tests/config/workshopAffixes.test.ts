import { describe, it, expect } from "vitest";
import {
  AFFIX_KINDS,
  AFFIX_MAGNITUDE_RANGE,
  MAX_INVENTORY_SLOTS,
} from "@/config/workshopAffixes";

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

  it("AFFIX_MAGNITUDE_RANGE has all 5 kinds with valid bounds (min < max, all > 0)", () => {
    for (const kind of AFFIX_KINDS) {
      expect(AFFIX_MAGNITUDE_RANGE[kind]).toBeDefined();
      const { min, max } = AFFIX_MAGNITUDE_RANGE[kind];
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(0);
      expect(min).toBeLessThan(max);
    }
  });

  it("AFFIX_MAGNITUDE_RANGE has the spec bounds", () => {
    expect(AFFIX_MAGNITUDE_RANGE["+sell_price%"]).toEqual({ min: 5, max: 15 });
    expect(AFFIX_MAGNITUDE_RANGE["+speed%"]).toEqual({ min: 5, max: 15 });
    expect(AFFIX_MAGNITUDE_RANGE["+size%"]).toEqual({ min: 5, max: 15 });
    expect(AFFIX_MAGNITUDE_RANGE["+crit_chance%"]).toEqual({ min: 2, max: 8 });
    expect(AFFIX_MAGNITUDE_RANGE["+combo_chance%"]).toEqual({ min: 5, max: 20 });
  });

  it("all numeric constants are positive", () => {
    expect(MAX_INVENTORY_SLOTS).toBeGreaterThan(0);
  });

  it("MAX_INVENTORY_SLOTS === 3 (pin v1 contract)", () => {
    expect(MAX_INVENTORY_SLOTS).toBe(3);
  });
});
