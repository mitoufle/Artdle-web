/**
 * Persisted affix identifier. Renames require a save migration.
 *
 * Items come from the Workshop. Each kind contributes additively to one
 * canvas-derived multiplier:
 *   +sell_price%   → getCanvasGoldMultiplier
 *   +speed%        → getCanvasSpeedMultiplier
 *   +crit_chance%  → getCritChance         (gated by unlock_canvas_crit)
 *   +combo_chance% → getComboBaseChance    (gated by unlock_canvas_combo)
 *   +size%         → getSizeMultiplier     (gated by unlock_canvas_size)
 *                    Scales effective sizeLevel — applies to BOTH gold and time formulas.
 */
export type AffixKind =
  | "+sell_price%"
  | "+speed%"
  | "+crit_chance%"
  | "+combo_chance%"
  | "+size%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+sell_price%",
  "+speed%",
  "+crit_chance%",
  "+combo_chance%",
  "+size%",
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
