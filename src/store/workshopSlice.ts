import type { StateCreator } from "zustand";
import {
  AFFIX_KINDS,
  MAGNITUDE_MIN_PCT,
  MAGNITUDE_MAX_PCT,
  BETTER_BRUSH_BONUS_PCT,
  MAX_INVENTORY_SLOTS,
  CRAFT_COST_GOLD,
  type AffixKind,
} from "@/config/workshopAffixes";
import { big } from "@/core/bigNumber";
import { rngPick, rngInt } from "@/core/rng";
import type { GameStore } from "@/store";

export interface Item {
  /** Affix produced by this craft. */
  readonly kind: AffixKind;
  /** Integer percent magnitude (e.g., 12 means +12% / -12%). */
  readonly magnitude: number;
}

export interface WorkshopState {
  /** Crafted-but-unequipped items. Bounded by MAX_INVENTORY_SLOTS = 3. */
  inventory: ReadonlyArray<Item>;
  /** Currently-equipped items. Bounded by getCurrentSlotCount(state) (1 or 2). */
  equippedItems: ReadonlyArray<Item>;
}

export const initialWorkshopState: WorkshopState = Object.freeze({
  inventory: Object.freeze([]) as ReadonlyArray<Item>,
  equippedItems: Object.freeze([]) as ReadonlyArray<Item>,
}) as WorkshopState;

export interface WorkshopSlice extends WorkshopState {
  craft: () => boolean;
  equip: (invIdx: number) => boolean;
  unequip: (equipIdx: number) => boolean;
  swap: (invIdx: number, equipIdx: number) => boolean;
  discard: (invIdx: number) => boolean;
  resetWorkshop: () => void;
}

// ============================================================================
// Selectors — pure functions over GameStore.
// Defined before createWorkshopSlice so they can be referenced in action bodies
// (const closures capture by reference, but defining them first avoids any
// potential TDZ issues if the module is ever analyzed statically).
// ============================================================================

/** 1 (default) or 2 (after Second Slot). */
export const getCurrentSlotCount = (state: GameStore): number =>
  state.purchasedNodes.second_slot ? 2 : 1;

/**
 * Sum the magnitude (as fraction) of equipped items matching the given affix kind.
 * Used by core/multipliers.ts for the additive (gold, inspi) cases.
 * NOT used for paint-time (which needs per-item v/(1-v) conversion — see multipliers.ts).
 */
export const getEquippedContribution = (state: GameStore, kind: AffixKind): number =>
  state.equippedItems
    .filter((i) => i.kind === kind)
    .reduce((sum, i) => sum + i.magnitude / 100, 0);

export const createWorkshopSlice: StateCreator<GameStore, [], [], WorkshopSlice> = (set, get) => ({
  ...initialWorkshopState,

  craft: () => {
    const state = get();
    if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
    if (!state.spend("gold", big(CRAFT_COST_GOLD))) return false;
    const kind = rngPick(AFFIX_KINDS);
    const brushBonus = state.purchasedNodes.better_brush ? BETTER_BRUSH_BONUS_PCT : 0;
    const magnitude = rngInt(MAGNITUDE_MIN_PCT + brushBonus, MAGNITUDE_MAX_PCT + brushBonus);
    set((s) => ({ inventory: [...s.inventory, { kind, magnitude }] }));
    return true;
  },

  equip: (invIdx) => {
    const state = get();
    if (invIdx < 0 || invIdx >= state.inventory.length) return false;
    const slotCount = getCurrentSlotCount(state);
    if (state.equippedItems.length >= slotCount) return false;
    const item = state.inventory[invIdx]!;
    set((s) => ({
      inventory: s.inventory.filter((_, i) => i !== invIdx),
      equippedItems: [...s.equippedItems, item],
    }));
    return true;
  },

  unequip: (equipIdx) => {
    const state = get();
    if (equipIdx < 0 || equipIdx >= state.equippedItems.length) return false;
    if (state.inventory.length >= MAX_INVENTORY_SLOTS) return false;
    const item = state.equippedItems[equipIdx]!;
    set((s) => ({
      equippedItems: s.equippedItems.filter((_, i) => i !== equipIdx),
      inventory: [...s.inventory, item],
    }));
    return true;
  },

  swap: (invIdx, equipIdx) => {
    const state = get();
    if (invIdx < 0 || invIdx >= state.inventory.length) return false;
    if (equipIdx < 0 || equipIdx >= state.equippedItems.length) return false;
    const invItem = state.inventory[invIdx]!;
    const equipItem = state.equippedItems[equipIdx]!;
    set((s) => ({
      inventory: s.inventory.map((it, i) => (i === invIdx ? equipItem : it)),
      equippedItems: s.equippedItems.map((it, i) => (i === equipIdx ? invItem : it)),
    }));
    return true;
  },

  discard: (invIdx) => {
    const state = get();
    if (invIdx < 0 || invIdx >= state.inventory.length) return false;
    set((s) => ({ inventory: s.inventory.filter((_, i) => i !== invIdx) }));
    return true;
  },

  resetWorkshop: () => set(initialWorkshopState),
});
