import type { StateCreator } from "zustand";
import {
  MAX_INVENTORY_SLOTS,
  type AffixKind,
  type SlotKind,
} from "@/config/workshopAffixes";
import { craftCost, xpToNext, MAX_WORKSHOP_LEVEL, XP_PER_CRAFT } from "@/core/balance";
import { rngPick } from "@/core/rng";
import { rollTier, rollAffixes } from "@/core/workshopRoll";
import type { ItemTier } from "@/core/workshopRoll";
import type { Affix } from "@/core/workshopRoll";
import type { GameStore } from "@/store";
import { getNodeLevel } from "@/store/skillTreeSlice";

export type { AffixKind, SlotKind } from "@/config/workshopAffixes";
export type { ItemTier, Affix } from "@/core/workshopRoll";

let _itemCounter = 0;
function nextItemId(): string {
  _itemCounter += 1;
  return `it-${Date.now().toString(36)}-${_itemCounter}`;
}

export interface Item {
  readonly id: string;
  readonly slot: SlotKind;
  readonly tier: ItemTier;
  readonly affixes: ReadonlyArray<Affix>;
}

export interface WorkshopState {
  readonly workshopLevel: number;
  readonly workshopXp: number;
  readonly inventory: ReadonlyArray<Item>;
  readonly equipped: Partial<Record<SlotKind, Item>>;
}

export const initialWorkshopState: WorkshopState = Object.freeze({
  workshopLevel: 1,
  workshopXp: 0,
  inventory: Object.freeze([]) as ReadonlyArray<Item>,
  equipped: Object.freeze({}) as Partial<Record<SlotKind, Item>>,
}) as WorkshopState;

export interface WorkshopSlice extends WorkshopState {
  craft: () => boolean;
  equipItem: (itemId: string) => boolean;
  unequipSlot: (slot: SlotKind) => boolean;
  discard: (itemId: string) => boolean;
  resetWorkshop: () => void;
}

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/** List of slot kinds the player has unlocked. Always includes "brush". */
export const getUnlockedSlotKinds = (state: GameStore): ReadonlyArray<SlotKind> => {
  const out: SlotKind[] = ["brush"];
  if (getNodeLevel(state, "gear_up") > 0) out.push("palette");
  return out;
};

/** Total equip-slot capacity = number of unlocked slot kinds. */
export const getCurrentSlotCount = (state: GameStore): number =>
  getUnlockedSlotKinds(state).length;

/**
 * Sum the magnitude (as fraction) of equipped affixes matching the given kind,
 * walking every equipped item across all slot kinds.
 */
export const getEquippedContribution = (state: GameStore, kind: AffixKind): number => {
  let total = 0;
  for (const item of Object.values(state.equipped)) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.kind === kind) total += affix.magnitude / 100;
    }
  }
  return total;
};

// ============================================================================
// Slice
// ============================================================================

export const createWorkshopSlice: StateCreator<GameStore, [], [], WorkshopSlice> = (set, get) => ({
  ...initialWorkshopState,

  craft: () => {
    const state = get();
    if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
    const cost = craftCost(state.workshopLevel);
    if (!state.spend("gold", cost)) return false;

    const unlocked = getUnlockedSlotKinds(state);
    const slot = rngPick(unlocked);
    const tier = rollTier(state.workshopLevel);
    const affixes = rollAffixes(tier);
    const item: Item = {
      id: nextItemId(),
      slot,
      tier,
      affixes,
    };

    set((s) => {
      let newLevel = s.workshopLevel;
      let newXp = s.workshopXp + XP_PER_CRAFT;
      while (newLevel < MAX_WORKSHOP_LEVEL && newXp >= xpToNext(newLevel)) {
        newXp -= xpToNext(newLevel);
        newLevel += 1;
      }
      return {
        inventory: [...s.inventory, item],
        workshopLevel: newLevel,
        workshopXp: newXp,
      };
    });
    return true;
  },

  equipItem: (itemId) => {
    const state = get();
    const item = state.inventory.find((i) => i.id === itemId);
    if (!item) return false;
    if (!getUnlockedSlotKinds(state).includes(item.slot)) return false;

    set((s) => {
      const previous = s.equipped[item.slot];
      const inventory = s.inventory.filter((i) => i.id !== itemId);
      return {
        inventory: previous ? [...inventory, previous] : inventory,
        equipped: { ...s.equipped, [item.slot]: item },
      };
    });
    return true;
  },

  unequipSlot: (slot) => {
    const state = get();
    const item = state.equipped[slot];
    if (!item) return false;
    if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
    set((s) => {
      const { [slot]: _removed, ...rest } = s.equipped;
      void _removed;
      return {
        inventory: [...s.inventory, item],
        equipped: rest,
      };
    });
    return true;
  },

  discard: (itemId) => {
    const state = get();
    const exists = state.inventory.some((i) => i.id === itemId);
    if (!exists) return false;
    set((s) => ({
      inventory: s.inventory.filter((i) => i.id !== itemId),
    }));
    return true;
  },

  resetWorkshop: () =>
    set((s) => ({
      // Inventory + equipped wiped (run-state). Workshop level + XP survive ascend.
      inventory: [],
      equipped: {},
      workshopLevel: s.workshopLevel,
      workshopXp: 0,
    })),
});
