import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import {
  getCurrentSlotCount,
  getEquippedContribution,
  getUnlockedSlotKinds,
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
    };
    useGameStore.setState({ equipped: { brush: itemWithDupes } });
    expect(getEquippedContribution(useGameStore.getState(), "+sell_price%")).toBeCloseTo(0.15, 5);
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
