import { describe, it, expect } from "vitest";
import {
  AFFIX_KINDS,
  MAGNITUDE_MIN_PCT,
  MAGNITUDE_MAX_PCT,
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

  it("MAGNITUDE_MIN_PCT < MAGNITUDE_MAX_PCT", () => {
    expect(MAGNITUDE_MIN_PCT).toBeLessThan(MAGNITUDE_MAX_PCT);
  });

  it("all numeric constants are positive", () => {
    expect(MAGNITUDE_MIN_PCT).toBeGreaterThan(0);
    expect(MAGNITUDE_MAX_PCT).toBeGreaterThan(0);
    expect(MAX_INVENTORY_SLOTS).toBeGreaterThan(0);
  });

  it("MAX_INVENTORY_SLOTS === 3 (pin v1 contract)", () => {
    expect(MAX_INVENTORY_SLOTS).toBe(3);
  });
});
