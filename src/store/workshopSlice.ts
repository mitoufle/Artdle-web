import type { StateCreator } from "zustand";
import {
  MAX_INVENTORY_SLOTS,
  FUSE_MAGNITUDE_PCT_RANGE,
  type AffixKind,
  type SlotKind,
} from "@/config/workshopAffixes";
import { craftCost } from "@/core/balance";
import type { Big } from "@/core/bigNumber";
import { rng } from "@/core/rng";
import type { ItemTier, Affix } from "@/core/workshopRoll";
import { rollAffixes } from "@/core/workshopRoll";
import type { GameStore } from "@/store";
import { getNodeLevel, countCapability } from "@/store/skillTreeSlice";
import {
  getAffixMagnitudeBonus,
  getSchoolAffixMagnitudeMultiplier,
  getSkillAffixMagnitudeMultiplier,
} from "@/core/multipliers";
import { performCraftPure, workshopTickPure } from "@/core/workshopTickPure";

export type { AffixKind, SlotKind } from "@/config/workshopAffixes";
export type { ItemTier, Affix } from "@/core/workshopRoll";
export { TIER_XP } from "@/core/workshopRoll";

const STORAGE_PER_CHEST = 2;

let _itemCounter = 0;
export function nextItemId(): string {
  _itemCounter += 1;
  return `it-${Date.now().toString(36)}-${_itemCounter}`;
}

export interface Item {
  readonly id: string;
  readonly slot: SlotKind;
  readonly tier: ItemTier;
  readonly affixes: ReadonlyArray<Affix>;
  readonly fuseCount: number;
}

export interface WorkshopState {
  readonly workshopLevel: number;
  readonly workshopXp: number;
  readonly inventory: ReadonlyArray<Item>;
  readonly equipped: Partial<Record<SlotKind, Item>>;
  /** Seconds since the last Taylorism auto-craft. Wraps every TAYLORISM_INTERVAL_S. */
  readonly autoCraftTimer: number;
  /** Tiers set to true are protected: they cannot be auto-kicked when inventory is full. */
  readonly protectedTiers: Partial<Record<ItemTier, boolean>>;
  /** Whether Taylorism auto-crafting is active. Toggled by the player. */
  readonly autoCraftEnabled: boolean;
}

export const initialWorkshopState: WorkshopState = Object.freeze({
  workshopLevel: 1,
  workshopXp: 0,
  inventory: Object.freeze([]) as ReadonlyArray<Item>,
  equipped: Object.freeze({}) as Partial<Record<SlotKind, Item>>,
  autoCraftTimer: 0,
  protectedTiers: Object.freeze({}) as Partial<Record<ItemTier, boolean>>,
  autoCraftEnabled: true,
}) as WorkshopState;

export interface WorkshopSlice extends WorkshopState {
  craft: () => boolean;
  equipItem: (itemId: string) => boolean;
  unequipSlot: (slot: SlotKind) => boolean;
  discard: (itemId: string) => boolean;
  fuseItem: (dropId: string) => boolean;
  toggleProtected: (tier: ItemTier) => void;
  toggleAutoCraft: () => void;
  workshopTick: (deltaSeconds: number) => void;
  resetWorkshop: () => void;
}

// ============================================================================
// Selectors — pure functions over GameStore.
// ============================================================================

/**
 * List of slot kinds the player has unlocked. Always includes "brush".
 * Skill-tree wiring:
 *   - gear_up          → palette
 *   - forget_pain      → easel
 *   - painters_hat     → hat
 *   - painters_apron   → apron
 *   - painters_boots   → boots
 */
export const getUnlockedSlotKinds = (state: Pick<GameStore, "purchasedNodes">): ReadonlyArray<SlotKind> => {
  const out: SlotKind[] = ["brush"];
  if (getNodeLevel(state, "gear_up") > 0)       out.push("palette");
  if (getNodeLevel(state, "forget_pain") > 0)    out.push("easel");
  if (getNodeLevel(state, "painters_hat") > 0)   out.push("hat");
  if (getNodeLevel(state, "painters_apron") > 0) out.push("apron");
  if (getNodeLevel(state, "painters_boots") > 0) out.push("boots");
  return out;
};

/** Total equip-slot capacity = number of unlocked slot kinds. */
export const getCurrentSlotCount = (state: Pick<GameStore, "purchasedNodes">): number =>
  getUnlockedSlotKinds(state).length;

/**
 * Maximum inventory size. Base 3 + 2 per chest node (wooden + steel).
 */
export const getMaxInventorySlots = (state: Pick<GameStore, "purchasedNodes">): number => {
  let cap = MAX_INVENTORY_SLOTS;
  if (getNodeLevel(state, "wooden_chest") > 0) cap += STORAGE_PER_CHEST;
  if (getNodeLevel(state, "steel_chest") > 0) cap += STORAGE_PER_CHEST;
  return cap;
};

/**
 * Sum the magnitude (as fraction) of equipped affixes matching the given kind,
 * walking every equipped item across all slot kinds.
 * Socks skill-tree node (×1.5 on boots slot only).
 */
export const getEquippedContribution = (
  state: Pick<GameStore, "equipped" | "purchasedNodes">,
  kind: AffixKind,
): number => {
  const hasSocks = getNodeLevel(state, "socks") > 0;
  let total = 0;
  for (const [slot, item] of Object.entries(state.equipped) as Array<[SlotKind, Item | undefined]>) {
    if (!item) continue;
    const mult = hasSocks && slot === "boots" ? 1.5 : 1.0;
    for (const affix of item.affixes) {
      if (affix.kind === kind) total += (affix.magnitude / 100) * mult;
    }
  }
  return total;
};

/**
 * Returns the equipped item that can fuse with the inventory item.
 *
 * Default rule: same slot kind, same tier, AND same affix-kind multiset.
 *
 * `cross_affix_fusion` capability (M&A specialist node) relaxes the affix-kind
 * multiset check for epic and legendary tiers — same slot + same tier is
 * sufficient. The caller (`fuseItem`) detects the mismatch and rerolls the
 * target's affixes instead of bumping them.
 */
export function getFusionTarget(
  invItem: Item,
  equipped: Partial<Record<SlotKind, Item>>,
  state: Pick<GameStore, "purchasedNodes">,
): Item | null {
  const eq = equipped[invItem.slot];
  if (!eq) return null;
  if (eq.tier !== invItem.tier) return null;
  if (eq.affixes.length !== invItem.affixes.length) return null;
  const invKinds = invItem.affixes.map((a) => a.kind).sort().join(",");
  const eqKinds  = eq.affixes.map((a) => a.kind).sort().join(",");
  if (invKinds === eqKinds) return eq;
  if (
    (eq.tier === "epic" || eq.tier === "legendary") &&
    countCapability(state, "cross_affix_fusion") > 0
  ) {
    return eq;
  }
  return null;
}

/** True iff the drop and equipped item differ on their affix-kind multiset. */
export function isCrossAffixFusion(invItem: Item, equippedItem: Item): boolean {
  const invKinds = invItem.affixes.map((a) => a.kind).sort().join(",");
  const eqKinds  = equippedItem.affixes.map((a) => a.kind).sort().join(",");
  return invKinds !== eqKinds;
}

/**
 * Gold cost to fuse a drop into an equipped item.
 * `craftCost(workshopLevel) × 2^equippedItem.fuseCount × 0.5^quantitative_easing_levels`
 *
 * Quantitative easing (skill-tree node, capability `fuse_cost_halving`) halves
 * the fuse cost once per level — multiplicative, so L5 cuts cost to 1/32 of
 * the pre-QE price.
 */
export const getFuseCost = (
  equippedItem: Item,
  workshopLevel: number,
  state: Pick<GameStore, "purchasedNodes">,
): Big =>
  craftCost(workshopLevel)
    .mul(Math.pow(2, equippedItem.fuseCount))
    .mul(Math.pow(0.5, countCapability(state, "fuse_cost_halving")));

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
 *
 * Wraps `performCraftPure` — single source of truth for the craft logic so the
 * offline-progress sim and the live tick share semantics.
 */
function performCraft(
  set: (fn: (s: GameStore) => Partial<GameStore>) => void,
  get: () => GameStore,
): boolean {
  let ok = false;
  set((s) => {
    const draft = { ...s } as GameStore;
    ok = performCraftPure(draft);
    if (!ok) return {};
    return {
      gold: draft.gold,
      inventory: draft.inventory,
      workshopLevel: draft.workshopLevel,
      workshopXp: draft.workshopXp,
      statsLifetime: draft.statsLifetime,
      statsRun: draft.statsRun,
    };
  });
  if (ok) get().evaluateAchievements();
  return ok;
}

// ============================================================================
// Slice
// ============================================================================

export const createWorkshopSlice: StateCreator<GameStore, [], [], WorkshopSlice> = (set, get) => ({
  ...initialWorkshopState,

  craft: () => performCraft(set, get),

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
    // Equipping a legendary unlocks the Materialist achievement (equipped.hasLegendary).
    get().evaluateAchievements();
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

  fuseItem: (dropId) => {
    const state = get();
    const drop = state.inventory.find((i) => i.id === dropId);
    if (!drop) return false;

    const target = getFusionTarget(drop, state.equipped, state);
    if (!target) return false;

    const fuseCost = getFuseCost(target, state.workshopLevel, state);
    if (!state.spend("gold", fuseCost)) return false;

    const targetSlot = (
      Object.entries(state.equipped) as Array<[SlotKind, Item | undefined]>
    ).find(([, eq]) => eq?.id === target.id)?.[0];
    if (!targetSlot) return false;

    let newAffixes: ReadonlyArray<{ kind: AffixKind; magnitude: number }>;
    if (isCrossAffixFusion(drop, target)) {
      // M&A specialist path: discard both old affix multisets and reroll
      // fresh affixes for the equipped item at its current tier.
      newAffixes = rollAffixes(
        target.tier,
        state,
        getAffixMagnitudeBonus(state),
        getSchoolAffixMagnitudeMultiplier(state) * getSkillAffixMagnitudeMultiplier(state),
      );
    } else {
      // Sum the drop's magnitude per kind. Items are unique-kind after affix
      // aggregation, but summing (rather than the old last-wins Map) keeps the
      // transfer correct even for a legacy/duplicate-kind drop — no magnitude
      // is silently discarded.
      const dropKindMap = new Map<AffixKind, number>();
      for (const a of drop.affixes) {
        dropKindMap.set(a.kind, (dropKindMap.get(a.kind) ?? 0) + a.magnitude);
      }
      // Per-tier gain band: each affix absorbs round(dropMag × pct) of the drop,
      // pct ∈ [min, max) for the item's tier. drop.tier === target.tier (enforced
      // by getFusionTarget), so target.tier picks the band.
      const range = FUSE_MAGNITUDE_PCT_RANGE[target.tier];
      newAffixes = target.affixes.map((a) => {
        const dropMag = dropKindMap.get(a.kind) ?? 0;
        const pct = range.min + rng() * (range.max - range.min);
        // Math.round: gain can be 0 for very low magnitudes. Intentional.
        const gain = Math.round(dropMag * pct);
        return { kind: a.kind, magnitude: a.magnitude + gain };
      });
    }

    const fusedItem: Item = {
      ...target,
      affixes: newAffixes,
      fuseCount: target.fuseCount + 1,
    };

    set((s) => ({
      inventory: s.inventory.filter((i) => i.id !== dropId),
      equipped: { ...s.equipped, [targetSlot]: fusedItem },
    }));
    get().incrementStat("lifetime", "workshopItemsFused");
    get().evaluateAchievements();
    return true;
  },

  toggleProtected: (tier) => {
    set((s) => ({
      protectedTiers: {
        ...s.protectedTiers,
        [tier]: !s.protectedTiers[tier],
      },
    }));
  },

  toggleAutoCraft: () => {
    set((s) => ({ autoCraftEnabled: !s.autoCraftEnabled }));
  },

  workshopTick: (deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    let crafted = false;
    set((state) => {
      const before = state.statsRun.workshopItemsCrafted;
      const draft = { ...state } as GameStore;
      workshopTickPure(draft, deltaSeconds);
      crafted = draft.statsRun.workshopItemsCrafted !== before;
      return {
        autoCraftTimer: draft.autoCraftTimer,
        gold: draft.gold,
        inventory: draft.inventory,
        workshopLevel: draft.workshopLevel,
        workshopXp: draft.workshopXp,
        statsLifetime: draft.statsLifetime,
        statsRun: draft.statsRun,
      };
    });
    if (crafted) get().evaluateAchievements();
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
