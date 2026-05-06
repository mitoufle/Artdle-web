/**
 * Persisted affix identifier. Renames require a save migration.
 *
 * Items come from the Workshop and only boost painting-related mechanics.
 */
export type AffixKind = "+canvas_gold%" | "-paint_time%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+canvas_gold%",
  "-paint_time%",
];

/** Inclusive lower bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MIN_PCT = 5;

/** Inclusive upper bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MAX_PCT = 15;

/** Inventory cap. Locked at 3 for v1. */
export const MAX_INVENTORY_SLOTS = 3;

/** Slot kind — distinct equipment families. Each unlocked kind = one equipped slot. */
export type SlotKind = "brush" | "palette" | "easel";

export const ALL_SLOT_KINDS: ReadonlyArray<SlotKind> = ["brush", "palette", "easel"];
