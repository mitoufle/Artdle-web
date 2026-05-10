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

const STORAGE_PER_CHEST = 2;
const TAYLORISM_INTERVAL_S = 10;

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
  /** Seconds since the last Taylorism auto-craft. Wraps every TAYLORISM_INTERVAL_S. */
  readonly autoCraftTimer: number;
}

export const initialWorkshopState: WorkshopState = Object.freeze({
  workshopLevel: 1,
  workshopXp: 0,
  inventory: Object.freeze([]) as ReadonlyArray<Item>,
  equipped: Object.freeze({}) as Partial<Record<SlotKind, Item>>,
  autoCraftTimer: 0,
}) as WorkshopState;

export interface WorkshopSlice extends WorkshopState {
  craft: () => boolean;
  equipItem: (itemId: string) => boolean;
  unequipSlot: (slot: SlotKind) => boolean;
  discard: (itemId: string) => boolean;
  workshopTick: (deltaSeconds: number) => void;
  resetWorkshop: () => void;
}

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/**
 * List of slot kinds the player has unlocked. Always includes "brush".
 * Skill-tree wiring:
 *   - gear_up        → palette
 *   - forget_pain    → easel
 */
export const getUnlockedSlotKinds = (state: GameStore): ReadonlyArray<SlotKind> => {
  const out: SlotKind[] = ["brush"];
  if (getNodeLevel(state, "gear_up") > 0) out.push("palette");
  if (getNodeLevel(state, "forget_pain") > 0) out.push("easel");
  return out;
};

/** Total equip-slot capacity = number of unlocked slot kinds. */
export const getCurrentSlotCount = (state: GameStore): number =>
  getUnlockedSlotKinds(state).length;

/**
 * Maximum inventory size. Base 3 + 2 per chest node (wooden + steel).
 */
export const getMaxInventorySlots = (state: GameStore): number => {
  let cap = MAX_INVENTORY_SLOTS;
  if (getNodeLevel(state, "wooden_chest") > 0) cap += STORAGE_PER_CHEST;
  if (getNodeLevel(state, "steel_chest") > 0) cap += STORAGE_PER_CHEST;
  return cap;
};

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
// Helpers
// ============================================================================

/**
 * Run one craft attempt: spend gold, roll item, push to inventory, award XP,
 * level up if threshold crossed. Returns false if cost can't be paid OR the
 * inventory is full and shredder isn't unlocked.
 *
 * Shredder note: when inventory is full AND shredder ≥ 1, we drop the OLDEST
 * (index 0) inventory item before pushing the new one (keeps inventory bounded).
 */
function performCraft(state: GameStore, set: (fn: (s: GameStore) => Partial<GameStore>) => void): boolean {
  const cap = getMaxInventorySlots(state);
  const hasShredder = getNodeLevel(state, "shredder") > 0;
  if (state.inventory.length >= cap && !hasShredder) return false;

  const cost = craftCost(state.workshopLevel);
  if (!state.spend("gold", cost)) return false;

  const unlocked = getUnlockedSlotKinds(state);
  const slot = rngPick(unlocked);
  const tier = rollTier(state.workshopLevel);
  const magnitudeBonus = getNodeLevel(state, "craftsmanship");
  const affixes = rollAffixes(tier, state, magnitudeBonus);
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
    // If full + shredder, drop oldest before pushing new.
    const trimmed = s.inventory.length >= cap ? s.inventory.slice(1) : s.inventory;
    return {
      inventory: [...trimmed, item],
      workshopLevel: newLevel,
      workshopXp: newXp,
    };
  });
  return true;
}

// ============================================================================
// Slice
// ============================================================================

export const createWorkshopSlice: StateCreator<GameStore, [], [], WorkshopSlice> = (set, get) => ({
  ...initialWorkshopState,

  craft: () => performCraft(get(), set),

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
    if (state.inventory.length >= getMaxInventorySlots(state)) return false;
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

  workshopTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const state = get();
    const taylorismLevel = getNodeLevel(state, "taylorsim");
    if (taylorismLevel === 0) return;

    const next = state.autoCraftTimer + deltaSeconds;
    const grants = Math.floor(next / TAYLORISM_INTERVAL_S);
    if (grants > 0) {
      // Attempt one craft per interval crossed. If a craft fails (no gold,
      // full + no shredder, etc.), keep the timer accumulated for the next try.
      for (let i = 0; i < grants; i++) {
        const ok = performCraft(get(), set);
        if (!ok) break;
      }
    }
    set({ autoCraftTimer: next - grants * TAYLORISM_INTERVAL_S });
  },

  resetWorkshop: () =>
    set((s) => ({
      // Inventory + equipped wiped (run-state). Workshop level + XP survive ascend.
      inventory: [],
      equipped: {},
      autoCraftTimer: 0,
      workshopLevel: s.workshopLevel,
      workshopXp: 0,
    })),
});
