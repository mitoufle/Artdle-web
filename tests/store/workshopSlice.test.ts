import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { getCurrentSlotCount, getEquippedContribution } from "@/store/workshopSlice";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";
import {
  AFFIX_KINDS,
  MAGNITUDE_MIN_PCT,
  MAGNITUDE_MAX_PCT,
  CRAFT_COST_GOLD,
} from "@/config/workshopAffixes";

describe("workshopSlice", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {} });
    setSeed(42); // deterministic RNG for craft tests
  });

  it("initializes with empty inventory and equippedItems", () => {
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([]);
  });

  it("craft() with insufficient gold returns false; nothing changes", () => {
    expect(useGameStore.getState().craft()).toBe(false);
    const s = useGameStore.getState();
    expect(s.gold.toNumber()).toBe(0);
    expect(s.inventory).toEqual([]);
  });

  it("craft() with sufficient gold: gold deducted, inventory grows by 1, item has valid kind + magnitude in [5,15]", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    expect(useGameStore.getState().craft()).toBe(true);
    const s = useGameStore.getState();
    expect(s.gold.toNumber()).toBe(0);
    expect(s.inventory).toHaveLength(1);
    const item = s.inventory[0]!;
    expect(AFFIX_KINDS).toContain(item.kind);
    expect(item.magnitude).toBeGreaterThanOrEqual(MAGNITUDE_MIN_PCT);
    expect(item.magnitude).toBeLessThanOrEqual(MAGNITUDE_MAX_PCT);
  });

  it("craft() with setSeed(42) produces a deterministic (kind, magnitude)", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    const item = useGameStore.getState().inventory[0]!;
    expect(typeof item.kind).toBe("string");
    expect(AFFIX_KINDS).toContain(item.kind);
    expect(Number.isInteger(item.magnitude)).toBe(true);
    expect(item.magnitude).toBeGreaterThanOrEqual(MAGNITUDE_MIN_PCT);
    expect(item.magnitude).toBeLessThanOrEqual(MAGNITUDE_MAX_PCT);
    // Determinism: re-seed and re-craft should reproduce.
    useGameStore.getState().resetWorkshop();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    setSeed(42);
    useGameStore.getState().craft();
    const item2 = useGameStore.getState().inventory[0]!;
    expect(item2.kind).toBe(item.kind);
    expect(item2.magnitude).toBe(item.magnitude);
  });

  it("craft() with Better Brush purchased: magnitude is in [6, 16]", () => {
    useGameStore.setState({ purchasedNodes: { better_brush: true } });
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 50));
    for (let i = 0; i < 50; i++) {
      useGameStore.getState().craft();
    }
    const items = useGameStore.getState().inventory.slice();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.magnitude).toBeGreaterThanOrEqual(MAGNITUDE_MIN_PCT + 1);
      expect(item.magnitude).toBeLessThanOrEqual(MAGNITUDE_MAX_PCT + 1);
    }
  });

  it("craft() with full inventory returns false; gold NOT deducted (atomic)", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 4));
    for (let i = 0; i < 3; i++) {
      expect(useGameStore.getState().craft()).toBe(true);
    }
    const goldBefore = useGameStore.getState().gold.toNumber();
    expect(useGameStore.getState().craft()).toBe(false);
    const goldAfter = useGameStore.getState().gold.toNumber();
    expect(goldAfter).toBe(goldBefore);
    expect(useGameStore.getState().inventory).toHaveLength(3);
  });

  it("equip(0) from a 1-item inventory + 0 equipped: inventory becomes empty, equippedItems has 1 item", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    const item = useGameStore.getState().inventory[0]!;
    expect(useGameStore.getState().equip(0)).toBe(true);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([item]);
  });

  it("equip(invalidIdx) returns false", () => {
    expect(useGameStore.getState().equip(0)).toBe(false);
    expect(useGameStore.getState().equip(99)).toBe(false);
    expect(useGameStore.getState().equip(-1)).toBe(false);
  });

  it("equip(0) when equipped is full (slotCount=1, 1 item already equipped) returns false", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    useGameStore.getState().craft();
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(1);
    expect(useGameStore.getState().equip(0)).toBe(false);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(1);
  });

  it("equip(0) with Second Slot purchased + 1 item already equipped: succeeds", () => {
    useGameStore.setState({ purchasedNodes: { second_slot: true } });
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    useGameStore.getState().craft();
    expect(useGameStore.getState().equip(0)).toBe(true);
    expect(useGameStore.getState().equippedItems).toHaveLength(2);
    expect(useGameStore.getState().inventory).toHaveLength(0);
  });

  it("unequip(0) moves item back to inventory; equippedItems shrinks", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(0);
    expect(useGameStore.getState().unequip(0)).toBe(true);
    expect(useGameStore.getState().equippedItems).toHaveLength(0);
    expect(useGameStore.getState().inventory).toHaveLength(1);
  });

  it("unequip(0) when inventory is full returns false (item stays equipped)", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 4));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    for (let i = 0; i < 3; i++) useGameStore.getState().craft();
    expect(useGameStore.getState().inventory).toHaveLength(3);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().unequip(0)).toBe(false);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    expect(useGameStore.getState().inventory).toHaveLength(3);
  });

  it("swap(0, 0) exchanges inventory[0] and equippedItems[0]; counts unchanged", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    useGameStore.getState().craft();
    const inventoryItem = useGameStore.getState().inventory[0]!;
    const equippedItem = useGameStore.getState().equippedItems[0]!;
    expect(useGameStore.getState().swap(0, 0)).toBe(true);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([equippedItem]);
    expect(s.equippedItems).toEqual([inventoryItem]);
  });

  it("swap with invalid indices returns false", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    expect(useGameStore.getState().swap(0, 0)).toBe(false);
    expect(useGameStore.getState().swap(99, 0)).toBe(false);
    expect(useGameStore.getState().swap(0, 99)).toBe(false);
  });

  it("discard(0) removes inventory[0]; no gold refund", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD));
    useGameStore.getState().craft();
    expect(useGameStore.getState().inventory).toHaveLength(1);
    const goldBefore = useGameStore.getState().gold.toNumber();
    expect(useGameStore.getState().discard(0)).toBe(true);
    expect(useGameStore.getState().inventory).toHaveLength(0);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("discard(invalidIdx) returns false", () => {
    expect(useGameStore.getState().discard(0)).toBe(false);
    expect(useGameStore.getState().discard(99)).toBe(false);
  });

  it("getCurrentSlotCount returns 1 by default, 2 after Second Slot purchased", () => {
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(1);
    useGameStore.setState({ purchasedNodes: { second_slot: true } });
    expect(getCurrentSlotCount(useGameStore.getState())).toBe(2);
  });

  it("getEquippedContribution sums magnitude/100 across matching equipped items", () => {
    useGameStore.setState({
      equippedItems: [
        { kind: "+canvas_gold%", magnitude: 10 },
        { kind: "+canvas_gold%", magnitude: 5 },
        { kind: "-paint_time%", magnitude: 12 },
      ],
    });
    expect(getEquippedContribution(useGameStore.getState(), "+canvas_gold%")).toBeCloseTo(0.15, 6);
    expect(getEquippedContribution(useGameStore.getState(), "-paint_time%")).toBeCloseTo(0.12, 6);
  });

  it("resetWorkshop() restores initialWorkshopState", () => {
    useGameStore.getState().add("gold", big(CRAFT_COST_GOLD * 2));
    useGameStore.getState().craft();
    useGameStore.getState().equip(0);
    useGameStore.getState().craft();
    expect(useGameStore.getState().inventory).toHaveLength(1);
    expect(useGameStore.getState().equippedItems).toHaveLength(1);
    useGameStore.getState().resetWorkshop();
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equippedItems).toEqual([]);
  });
});
