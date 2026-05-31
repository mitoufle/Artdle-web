import { describe, it, expect } from "vitest";
import { migrate } from "@/store";

const item = (affixes: Array<{ kind: string; magnitude: number }>) => ({
  id: "it-1", slot: "brush", tier: "legendary", affixes, fuseCount: 2,
});

describe("migrate v29 → v30 (aggregate item affixes)", () => {
  it("sums duplicate sell_price/speed affixes on inventory items into one entry", () => {
    const result = migrate(
      { inventory: [item([
        { kind: "+sell_price%", magnitude: 50 },
        { kind: "+sell_price%", magnitude: 55 },
        { kind: "+speed%", magnitude: 20 },
      ])] },
      29,
    );
    const affixes = result.inventory[0]!.affixes;
    expect(affixes).toEqual([
      { kind: "+sell_price%", magnitude: 105 },
      { kind: "+speed%", magnitude: 20 },
    ]);
  });

  it("caps duplicate crit/combo on equipped items to the single largest value", () => {
    const result = migrate(
      { equipped: { brush: item([
        { kind: "+combo_chance%", magnitude: 40 },
        { kind: "+combo_chance%", magnitude: 52 },
        { kind: "+crit_chunks", magnitude: 18 },
        { kind: "+crit_chunks", magnitude: 30 },
      ]) } },
      29,
    );
    const affixes = result.equipped.brush!.affixes;
    expect(affixes).toContainEqual({ kind: "+crit_chunks", magnitude: 30 });
    expect(affixes).toContainEqual({ kind: "+combo_chance%", magnitude: 52 });
    expect(affixes).toHaveLength(2);
  });

  it("preserves non-affix item fields and is a no-op for already-unique affixes", () => {
    const result = migrate(
      { inventory: [item([{ kind: "+sell_price%", magnitude: 60 }])] },
      29,
    );
    const it = result.inventory[0]!;
    expect(it.fuseCount).toBe(2);
    expect(it.tier).toBe("legendary");
    expect(it.affixes).toEqual([{ kind: "+sell_price%", magnitude: 60 }]);
  });

  it("tolerates missing inventory/equipped", () => {
    expect(() => migrate({}, 29)).not.toThrow();
  });
});
