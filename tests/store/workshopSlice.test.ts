import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import {
  getCurrentSlotCount,
  getEquippedContribution,
  getUnlockedSlotKinds,
  getFusionTarget,
  getFuseCost,
} from "@/store/workshopSlice";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import type { Item } from "@/store/workshopSlice";

function freshState() {
  useGameStore.setState({
    inventory: [],
    equipped: {},
    workshopLevel: 1,
    workshopXp: 0,
    purchasedNodes: {},
    gold: big(0),
    autoCraftTimer: 0,
  });
}

const sampleBrush: Item = {
  id: "test-brush-1",
  slot: "brush",
  tier: "magic",
  affixes: [
    { kind: "+sell_price%", magnitude: 12 },
    { kind: "+speed%", magnitude: 8 },
  ],
  fuseCount: 0,
};

describe("workshopSlice — selectors", () => {
  beforeEach(freshState);

  it("getUnlockedSlotKinds: only 'brush' by default", () => {
    expect(getUnlockedSlotKinds(useGameStore.getState())).toEqual(["brush"]);
  });

  it("getUnlockedSlotKinds: includes 'palette' when gear_up purchased", () => {
    useGameStore.setState({ purchasedNodes: { gear_up: 1 } });
    expect(getUnlockedSlotKinds(useGameStore.getState())).toEqual(["brush", "palette"]);
  });

  it("getUnlockedSlotKinds: includes 'easel' when forget_pain purchased", () => {
    useGameStore.setState({ purchasedNodes: { gear_up: 1, forget_pain: 1 } });
    expect(getUnlockedSlotKinds(useGameStore.getState())).toEqual(["brush", "palette", "easel"]);
  });

  it("getUnlockedSlotKinds: includes 'hat' when painters_hat purchased", () => {
    useGameStore.setState({ purchasedNodes: { painters_hat: 1 } });
    expect(getUnlockedSlotKinds(useGameStore.getState())).toContain("hat");
  });

  it("getUnlockedSlotKinds: includes 'apron' when painters_apron purchased", () => {
    useGameStore.setState({ purchasedNodes: { painters_apron: 1 } });
    expect(getUnlockedSlotKinds(useGameStore.getState())).toContain("apron");
  });

  it("getUnlockedSlotKinds: includes 'boots' when painters_boots purchased", () => {
    useGameStore.setState({ purchasedNodes: { painters_boots: 1 } });
    expect(getUnlockedSlotKinds(useGameStore.getState())).toContain("boots");
  });

  it("getCurrentSlotCount: total of unlocked kinds", () => {
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(1);
    useGameStore.setState({ purchasedNodes: { gear_up: 1 } });
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(2);
  });

  it("getMaxInventorySlots: base 3, +2 per chest", async () => {
    const { getMaxInventorySlots } = await import("@/store/workshopSlice");
    expect(getMaxInventorySlots(useGameStore.getState())).toBe(3);
    useGameStore.setState({ purchasedNodes: { wooden_chest: 1 } });
    expect(getMaxInventorySlots(useGameStore.getState())).toBe(5);
    useGameStore.setState({ purchasedNodes: { wooden_chest: 1, steel_chest: 1 } });
    expect(getMaxInventorySlots(useGameStore.getState())).toBe(7);
  });

  it("getEquippedContribution: sums affixes of matching kind across all equipped items", () => {
    useGameStore.setState({ equipped: { brush: sampleBrush } });
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.12, 5);
    expect(getEquippedContribution(useGameStore.getState(), "+speed%")).toBeCloseTo(0.08, 5);
  });

  it("getEquippedContribution: returns 0 when nothing equipped", () => {
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBe(0);
  });

  it("getEquippedContribution: works across multiple slot kinds", () => {
    const palette: Item = {
      id: "test-palette-1",
      slot: "palette",
      tier: "rare",
      affixes: [
        { kind: "+sell_price%", magnitude: 7 },
      ],
      fuseCount: 0,
    };
    useGameStore.setState({ equipped: { brush: sampleBrush, palette } });
    // brush has +12% canvas gold + palette has +7% = 0.19
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.19, 5);
  });

  it("getEquippedContribution: handles duplicate affix kinds on a single item", () => {
    const itemWithDupes: Item = {
      id: "test-dupes",
      slot: "brush",
      tier: "rare",
      affixes: [
        { kind: "+sell_price%", magnitude: 10 },
        { kind: "+sell_price%", magnitude: 5 },
        { kind: "+speed%", magnitude: 6 },
      ],
      fuseCount: 0,
    };
    useGameStore.setState({ equipped: { brush: itemWithDupes } });
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.15, 5);
  });

  it("getEquippedContribution: socks × 1.5 on boots slot only", () => {
    const boots: Item = {
      id: "test-boots-1",
      slot: "boots",
      tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 20 }],
      fuseCount: 0,
    };
    const brush: Item = {
      id: "test-brush-socks",
      slot: "brush",
      tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    // Without socks: brush 0.10 + boots 0.20 = 0.30
    useGameStore.setState({ equipped: { boots, brush }, purchasedNodes: {} });
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.30, 5);
    // With socks: brush 0.10 + boots 0.20 × 1.5 = 0.10 + 0.30 = 0.40
    useGameStore.setState({ purchasedNodes: { socks: 1 } });
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.40, 5);
  });
});

describe("workshopSlice — craft", () => {
  beforeEach(() => {
    freshState();
    setSeed(42);
  });

  it("returns false when inventory is full", () => {
    useGameStore.setState({
      inventory: Array.from({ length: 3 }, (_, i) => ({
        id: `pre-${i}`,
        slot: "brush" as const,
        tier: "normal" as const,
        affixes: [{ kind: "+sell_price%" as const, magnitude: 10 }],
        fuseCount: 0,
      })),
      gold: big(1_000_000),
    });
    expect(useGameStore.getState().craft()).toBe(false);
  });

  it("returns false when not enough gold", () => {
    useGameStore.setState({ gold: big(50) });
    expect(useGameStore.getState().craft()).toBe(false);
  });

  it("on success: spends craftCost(1)=100, adds 1 item, grants 1 XP", () => {
    useGameStore.setState({ gold: big(100) });
    expect(useGameStore.getState().craft()).toBe(true);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    expect(useGameStore.getState().inventory.length).toBe(1);
    expect(useGameStore.getState().workshopXp).toBe(1);
  });

  it("crafted item has slot from unlocked kinds, tier from rollTier, affixes per tier", () => {
    useGameStore.setState({ gold: big(100) });
    useGameStore.getState().craft();
    const item = useGameStore.getState().inventory[0]!;
    expect(["brush"]).toContain(item.slot); // only brush unlocked
    expect(["normal", "magic", "rare", "epic", "legendary"]).toContain(item.tier);
    expect(item.affixes.length).toBeGreaterThanOrEqual(1);
  });

  it("Craftsmanship Lv 5 shifts affix magnitudes by +25 pp (regression — was passing raw level)", () => {
    // With craftsmanship 5, getAffixMagnitudeBonus = 5 × 5 = 25 pp.
    // For any kind, rolled magnitude must land in [min+25, max+25].
    useGameStore.setState({ gold: big(100), purchasedNodes: { craftsmanship: 5 } });
    useGameStore.getState().craft();
    const item = useGameStore.getState().inventory[0]!;
    for (const affix of item.affixes) {
      // Sanity: smallest possible min across kinds is +crit_chance% [2,8] → shifted to [27,33].
      // So every rolled magnitude must be >= 27 (the smallest shifted min).
      expect(affix.magnitude).toBeGreaterThanOrEqual(27);
    }
  });

  it("levels up when XP threshold reached: e.g., 8 XP = L1 → L2", () => {
    useGameStore.setState({ gold: big(10_000), workshopXp: 7 });
    expect(useGameStore.getState().workshopLevel).toBe(1);
    useGameStore.getState().craft();
    expect(useGameStore.getState().workshopLevel).toBe(2);
    expect(useGameStore.getState().workshopXp).toBe(0); // 7 + 1 - 8 = 0
  });

  it("does not level up past MAX_WORKSHOP_LEVEL (100)", () => {
    useGameStore.setState({ gold: big(1e15), workshopLevel: 100, workshopXp: 0 });
    useGameStore.getState().craft();
    expect(useGameStore.getState().workshopLevel).toBe(100);
  });

  it("shredder: when inventory full, oldest item is dropped on craft", () => {
    const fullInv = Array.from({ length: 3 }, (_, i) => ({
      id: `pre-${i}`,
      slot: "brush" as const,
      tier: "normal" as const,
      affixes: [{ kind: "+sell_price%" as const, magnitude: 10 }],
      fuseCount: 0,
    }));
    useGameStore.setState({
      gold: big(1_000),
      inventory: fullInv,
      purchasedNodes: { shredder: 1 },
    });
    expect(useGameStore.getState().craft()).toBe(true);
    const inv = useGameStore.getState().inventory;
    expect(inv.length).toBe(3);
    // Oldest (pre-0) is gone; pre-1 + pre-2 remain + new item.
    expect(inv.find((i) => i.id === "pre-0")).toBeUndefined();
    expect(inv.find((i) => i.id === "pre-1")).toBeDefined();
    expect(inv.find((i) => i.id === "pre-2")).toBeDefined();
  });

  it("no shredder + full inventory: craft returns false", () => {
    const fullInv = Array.from({ length: 3 }, (_, i) => ({
      id: `pre-${i}`,
      slot: "brush" as const,
      tier: "normal" as const,
      affixes: [{ kind: "+sell_price%" as const, magnitude: 10 }],
      fuseCount: 0,
    }));
    useGameStore.setState({ gold: big(1_000), inventory: fullInv });
    expect(useGameStore.getState().craft()).toBe(false);
  });
});

describe("workshopSlice — workshopTick (Taylorism)", () => {
  beforeEach(() => {
    freshState();
    setSeed(42);
  });

  it("no taylorism: tick is a no-op", () => {
    useGameStore.getState().workshopTick(15);
    expect(useGameStore.getState().inventory).toEqual([]);
    expect(useGameStore.getState().autoCraftTimer).toBe(0);
  });

  it("taylorism owned + 10s tick + enough gold: auto-crafts one item", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1 },
    });
    useGameStore.getState().workshopTick(10);
    expect(useGameStore.getState().inventory.length).toBe(1);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(0, 5);
  });

  it("taylorism + 5s tick: no auto-craft yet, timer accumulates", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1 },
    });
    useGameStore.getState().workshopTick(5);
    expect(useGameStore.getState().inventory.length).toBe(0);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(5, 5);
  });

  it("third_hand L1: autocraft fires at 9 s (10% faster interval)", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1, third_hand: 1 },
    });
    // interval = 10 × (1 − 0.10 × 1) = 9 s
    useGameStore.getState().workshopTick(9);
    expect(useGameStore.getState().inventory.length).toBe(1);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(0, 5);
  });

  it("third_hand L1: 8 s tick does not fire (interval = 9 s)", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1, third_hand: 1 },
    });
    useGameStore.getState().workshopTick(8);
    expect(useGameStore.getState().inventory.length).toBe(0);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(8, 5);
  });

  it("third_hand L5: autocraft fires at 5 s (50% faster interval)", () => {
    useGameStore.setState({
      gold: big(1_000),
      purchasedNodes: { taylorsim: 1, third_hand: 5 },
    });
    // interval = 10 × (1 − 0.10 × 5) = 5 s
    useGameStore.getState().workshopTick(5);
    expect(useGameStore.getState().inventory.length).toBe(1);
    expect(useGameStore.getState().autoCraftTimer).toBeCloseTo(0, 5);
  });
});

describe("workshopSlice — equip / unequip", () => {
  beforeEach(freshState);

  it("equipItem: unknown id returns false", () => {
    expect(useGameStore.getState().equipItem("nonexistent")).toBe(false);
  });

  it("equipItem: locked slot kind returns false", () => {
    const palette: Item = {
      id: "p1",
      slot: "palette",
      tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    useGameStore.setState({ inventory: [palette] });
    // palette slot not unlocked
    expect(useGameStore.getState().equipItem("p1")).toBe(false);
  });

  it("equipItem: success moves item from inventory to equipped[slot]", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    expect(useGameStore.getState().equipItem(sampleBrush.id)).toBe(true);
    expect(useGameStore.getState().inventory).toEqual([]);
    expect(useGameStore.getState().equipped.brush?.id).toBe(sampleBrush.id);
  });

  it("equipItem: replacing slot occupant returns previous to inventory", () => {
    const newBrush: Item = {
      id: "b2",
      slot: "brush",
      tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 9 }],
      fuseCount: 0,
    };
    useGameStore.setState({
      inventory: [newBrush],
      equipped: { brush: sampleBrush },
    });
    expect(useGameStore.getState().equipItem("b2")).toBe(true);
    expect(useGameStore.getState().equipped.brush?.id).toBe("b2");
    // sampleBrush returned to inventory
    expect(useGameStore.getState().inventory.find((i) => i.id === sampleBrush.id)).toBeDefined();
  });

  it("unequipSlot: empty slot returns false", () => {
    expect(useGameStore.getState().unequipSlot("brush")).toBe(false);
  });

  it("unequipSlot: full inventory returns false", () => {
    useGameStore.setState({
      inventory: Array.from({ length: 3 }, (_, i) => ({
        id: `inv-${i}`,
        slot: "brush" as const,
        tier: "normal" as const,
        affixes: [{ kind: "+sell_price%" as const, magnitude: 10 }],
        fuseCount: 0,
      })),
      equipped: { brush: sampleBrush },
    });
    expect(useGameStore.getState().unequipSlot("brush")).toBe(false);
  });

  it("unequipSlot: success moves item from equipped to inventory", () => {
    useGameStore.setState({ equipped: { brush: sampleBrush } });
    expect(useGameStore.getState().unequipSlot("brush")).toBe(true);
    expect(useGameStore.getState().equipped.brush).toBeUndefined();
    expect(useGameStore.getState().inventory[0]?.id).toBe(sampleBrush.id);
  });
});

describe("workshopSlice — discard", () => {
  beforeEach(freshState);

  it("discard removes the item from inventory by id", () => {
    useGameStore.setState({ inventory: [sampleBrush] });
    expect(useGameStore.getState().discard(sampleBrush.id)).toBe(true);
    expect(useGameStore.getState().inventory).toEqual([]);
  });

  it("discard returns false for unknown id", () => {
    expect(useGameStore.getState().discard("nonexistent")).toBe(false);
  });
});

describe("workshopSlice — resetWorkshop", () => {
  beforeEach(freshState);

  it("resets inventory + equipped + workshopXp to initial state, preserves workshopLevel", () => {
    useGameStore.setState({
      inventory: [sampleBrush],
      equipped: { brush: sampleBrush },
      workshopLevel: 25,
      workshopXp: 50,
    });
    useGameStore.getState().resetWorkshop();
    expect(useGameStore.getState().inventory).toEqual([]);
    expect(useGameStore.getState().equipped).toEqual({});
    // Workshop level survives ascend (it's a long-tail achievement, like skill tree).
    expect(useGameStore.getState().workshopLevel).toBe(25);
    expect(useGameStore.getState().workshopXp).toBe(0);
  });
});

describe("fusion — getFusionTarget", () => {
  const noNodes = { purchasedNodes: {} };
  const withMA = { purchasedNodes: { ma_specialist: 1 } };

  it("returns null when no equipped items", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }, { kind: "+speed%", magnitude: 8 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, {}, noNodes)).toBeNull();
  });

  it("returns null when kinds match but count differs", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 8 }, { kind: "+speed%", magnitude: 5 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, noNodes)).toBeNull();
  });

  it("returns equipped item when slot, tier, and affix kinds all match (order irrelevant)", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+speed%", magnitude: 10 }, { kind: "+sell_price%", magnitude: 8 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }, { kind: "+speed%", magnitude: 7 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, noNodes)).toBe(eq);
  });

  it("returns null when affix kinds match but tiers differ", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 8 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, noNodes)).toBeNull();
  });

  it("returns null when slot kinds differ even if tier and affix kinds match", () => {
    const inv: Item = {
      id: "inv-1", slot: "hat", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, noNodes)).toBeNull();
  });

  it("ma_specialist allows cross-affix fusion at epic tier", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+sell_price%", magnitude: 25 }, { kind: "+speed%", magnitude: 25 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+crit_chance%", magnitude: 14 }, { kind: "+combo_chance%", magnitude: 24 }],
      fuseCount: 0,
    };
    // Without ma_specialist: cross-affix is rejected.
    expect(getFusionTarget(inv, { brush: eq }, noNodes)).toBeNull();
    // With ma_specialist: cross-affix at epic is allowed.
    expect(getFusionTarget(inv, { brush: eq }, withMA)).toBe(eq);
  });

  it("ma_specialist allows cross-affix fusion at legendary tier", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "legendary",
      affixes: [{ kind: "+sell_price%", magnitude: 40 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "legendary",
      affixes: [{ kind: "+size%", magnitude: 40 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, withMA)).toBe(eq);
  });

  it("ma_specialist does NOT allow cross-affix fusion below epic", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+sell_price%", magnitude: 20 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "rare",
      affixes: [{ kind: "+speed%", magnitude: 20 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, withMA)).toBeNull();
  });

  it("ma_specialist still requires matching slot kind", () => {
    const inv: Item = {
      id: "inv-1", slot: "hat", tier: "epic",
      affixes: [{ kind: "+sell_price%", magnitude: 25 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+speed%", magnitude: 25 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, withMA)).toBeNull();
  });

  it("ma_specialist still requires matching tier", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+sell_price%", magnitude: 25 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "legendary",
      affixes: [{ kind: "+speed%", magnitude: 40 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, withMA)).toBeNull();
  });

  it("ma_specialist still requires matching affix count", () => {
    const inv: Item = {
      id: "inv-1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+sell_price%", magnitude: 25 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "epic",
      affixes: [{ kind: "+speed%", magnitude: 25 }, { kind: "+size%", magnitude: 25 }],
      fuseCount: 0,
    };
    expect(getFusionTarget(inv, { brush: eq }, withMA)).toBeNull();
  });
});

describe("fusion — getFuseCost", () => {
  const noNodes = { purchasedNodes: {} };

  it("cost at fuseCount=0 equals craftCost(workshopLevel)", () => {
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const cost = getFuseCost(eq, 1, noNodes);
    // craftCost(1) = CRAFT_COST_BASE * 1.05^0 = 100; 100 * 2^0 = 100
    expect(cost.toNumber()).toBeCloseTo(100, 1);
  });

  it("cost doubles for each prior fuse", () => {
    const base: Item = {
      id: "eq-1", slot: "brush", tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const fused3: Item = { ...base, fuseCount: 3 };
    const costBase = getFuseCost(base, 1, noNodes).toNumber();
    const costFused3 = getFuseCost(fused3, 1, noNodes).toNumber();
    expect(costFused3).toBeCloseTo(costBase * 8, 1); // 2^3 = 8
  });

  it("quantitative_easing halves the cost per level (multiplicative)", () => {
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const baseCost = getFuseCost(eq, 1, noNodes).toNumber();
    expect(getFuseCost(eq, 1, { purchasedNodes: { quantitative_easing: 1 } }).toNumber())
      .toBeCloseTo(baseCost * 0.5, 5);
    expect(getFuseCost(eq, 1, { purchasedNodes: { quantitative_easing: 3 } }).toNumber())
      .toBeCloseTo(baseCost * 0.125, 5);
    expect(getFuseCost(eq, 1, { purchasedNodes: { quantitative_easing: 5 } }).toNumber())
      .toBeCloseTo(baseCost / 32, 5);
  });

  it("quantitative_easing composes with prior fuses", () => {
    const fused2: Item = {
      id: "eq-1", slot: "brush", tier: "normal",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 2,
    };
    const baseCost = getFuseCost(fused2, 1, noNodes).toNumber();  // 100 * 4 = 400
    expect(getFuseCost(fused2, 1, { purchasedNodes: { quantitative_easing: 2 } }).toNumber())
      .toBeCloseTo(baseCost * 0.25, 5);  // 400 * 0.25 = 100
  });
});

describe("fusion — fuseItem action", () => {
  beforeEach(() => {
    freshState();
    setSeed(42);
  });

  it("returns false when dropId not in inventory", () => {
    expect(useGameStore.getState().fuseItem("no-such-id")).toBe(false);
  });

  it("returns false when drop has no matching equipped item", () => {
    const drop: Item = {
      id: "drop-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    useGameStore.setState({ inventory: [drop], equipped: {}, gold: big(10_000) });
    expect(useGameStore.getState().fuseItem("drop-1")).toBe(false);
  });

  it("returns false when insufficient gold", () => {
    const drop: Item = {
      id: "drop-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 10 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }],
      fuseCount: 0,
    };
    useGameStore.setState({ inventory: [drop], equipped: { brush: eq }, gold: big(0) });
    expect(useGameStore.getState().fuseItem("drop-1")).toBe(false);
  });

  it("on success: removes drop, increments fuseCount, increases magnitude, spends gold", () => {
    const drop: Item = {
      id: "drop-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 20 }],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 12 }],
      fuseCount: 0,
    };
    useGameStore.setState({ inventory: [drop], equipped: { brush: eq }, gold: big(10_000), workshopLevel: 1 });
    expect(useGameStore.getState().fuseItem("drop-1")).toBe(true);

    const state = useGameStore.getState();
    // Drop consumed
    expect(state.inventory.find(i => i.id === "drop-1")).toBeUndefined();
    // Equipped item's fuseCount incremented
    expect(state.equipped.brush!.fuseCount).toBe(1);
    // Magnitude increased (absorbed 5%–50% of drop's 20 → added 1–10 to eq's 12)
    const newMag = state.equipped.brush!.affixes[0]!.magnitude;
    expect(newMag).toBeGreaterThan(12);
    expect(newMag).toBeLessThanOrEqual(22); // 12 + 50% of 20
    // Gold spent: craftCost(1) * 2^0 = 100
    expect(state.gold.toNumber()).toBeLessThan(10_000);
    expect(state.gold.toNumber()).toBeCloseTo(9_900, 0);
  });

  it("fuse cost doubles on second fuse of the same item", () => {
    const makeItem = (id: string, mag: number): Item => ({
      id, slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: mag }],
      fuseCount: 0,
    });
    const drop1: Item = makeItem("drop-1", 15);
    const drop2: Item = makeItem("drop-2", 15);
    const eq: Item = makeItem("eq-1", 10);

    useGameStore.setState({ inventory: [drop1, drop2], equipped: { brush: eq }, gold: big(10_000), workshopLevel: 1 });
    useGameStore.getState().fuseItem("drop-1");
    const goldAfterFirst = useGameStore.getState().gold.toNumber();

    // Patch drop2 into inventory (first fuse removed drop-1 and updated equip)
    const eqAfterFirst = useGameStore.getState().equipped.brush!;
    useGameStore.setState({ inventory: [drop2], equipped: { brush: eqAfterFirst } });
    useGameStore.getState().fuseItem("drop-2");
    const goldAfterSecond = useGameStore.getState().gold.toNumber();

    const firstFuseCost = 10_000 - goldAfterFirst;
    const secondFuseCost = goldAfterFirst - goldAfterSecond;
    expect(secondFuseCost).toBeCloseTo(firstFuseCost * 2, 0);
  });

  it("ma_specialist: cross-affix fusion at epic rerolls target affixes (does not bump)", () => {
    // Epic items have 4 affixes (TIER_AFFIX_COUNT.epic). Drop has 4 sell_price; equipped
    // has a mix of size/crit/combo. Same kinds AS A MULTISET would not match — without
    // ma_specialist this fusion would be rejected.
    const drop: Item = {
      id: "drop-1", slot: "brush", tier: "epic",
      affixes: [
        { kind: "+sell_price%", magnitude: 25 },
        { kind: "+sell_price%", magnitude: 30 },
        { kind: "+speed%", magnitude: 28 },
        { kind: "+speed%", magnitude: 32 },
      ],
      fuseCount: 0,
    };
    const eq: Item = {
      id: "eq-1", slot: "brush", tier: "epic",
      affixes: [
        { kind: "+crit_chance%", magnitude: 14 },
        { kind: "+combo_chance%", magnitude: 24 },
        { kind: "+size%", magnitude: 25 },
        { kind: "+sell_price%", magnitude: 25 },
      ],
      fuseCount: 0,
    };
    useGameStore.setState({
      inventory: [drop],
      equipped: { brush: eq },
      gold: big(100_000),
      workshopLevel: 1,
      purchasedNodes: {
        ma_specialist: 1,
        size_matters: 1, genius_episode: 1, unrelentless: 1,
      },
    });
    setSeed(0);
    expect(useGameStore.getState().fuseItem("drop-1")).toBe(true);

    const fused = useGameStore.getState().equipped.brush!;
    expect(fused.tier).toBe("epic");
    // Reroll produces TIER_AFFIX_COUNT[epic] = 4 affixes.
    expect(fused.affixes.length).toBe(4);
    expect(fused.fuseCount).toBe(1);
    // Each affix is freshly rolled within its epic per-kind range — no carry-over
    // from drop or eq magnitudes.
    for (const a of fused.affixes) {
      // Epic min across all kinds is 14 (crit). Epic max across all kinds is 42 (combo).
      expect(a.magnitude).toBeGreaterThanOrEqual(14);
      expect(a.magnitude).toBeLessThanOrEqual(42);
    }
  });

  it("absorbed gain per affix stays in [5%, 50%] of drop magnitude across many rolls", () => {
    const DROP_MAG = 100; // large magnitude so rounding doesn't obscure fractions
    const drop = (): Item => ({
      id: "drop-x", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: DROP_MAG }],
      fuseCount: 0,
    });
    const eqBase: Item = {
      id: "eq-x", slot: "brush", tier: "magic",
      affixes: [{ kind: "+sell_price%", magnitude: 0 }],
      fuseCount: 0,
    };

    let minGain = Infinity;
    let maxGain = -Infinity;
    for (let seed = 0; seed < 200; seed++) {
      setSeed(seed);
      useGameStore.setState({ inventory: [drop()], equipped: { brush: { ...eqBase } }, gold: big(1_000_000), workshopLevel: 1 });
      useGameStore.getState().fuseItem("drop-x");
      const gain = useGameStore.getState().equipped.brush!.affixes[0]!.magnitude;
      minGain = Math.min(minGain, gain);
      maxGain = Math.max(maxGain, gain);
    }
    // gain = round(100 * pct), pct ∈ [0.05, 0.50); round can produce up to 50
    expect(minGain).toBeGreaterThanOrEqual(5);
    expect(maxGain).toBeLessThanOrEqual(50);
    // Verify the range is actually spanned (not degenerate)
    expect(maxGain - minGain).toBeGreaterThan(20);
  });
});
