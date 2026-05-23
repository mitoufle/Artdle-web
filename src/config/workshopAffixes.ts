import type { ItemTier } from "@/core/workshopRoll";

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

/** Single-character symbol for each affix kind, used in compact item displays. */
export const AFFIX_SYMBOL: Record<AffixKind, string> = {
  "+sell_price%":   "$",
  "+speed%":        "»",
  "+crit_chance%":  "✦",
  "+combo_chance%": "∞",
  "+size%":         "⊕",
};

/** Accent color for each affix symbol. */
export const AFFIX_COLOR: Record<AffixKind, string> = {
  "+sell_price%":   "#f0b847",
  "+speed%":        "#4fc3e8",
  "+crit_chance%":  "#e85c5c",
  "+combo_chance%": "#b06ee8",
  "+size%":         "#4cb87a",
};

/** Font-size scale factor to compensate for glyphs with different optical sizes. */
export const AFFIX_SYMBOL_SCALE: Record<AffixKind, number> = {
  "+sell_price%":   1.0,
  "+speed%":        1.0,
  "+crit_chance%":  1.3,
  "+combo_chance%": 1.2,
  "+size%":         1.15,
};

/**
 * Per-tier, per-affix-kind magnitude range. Bounds are integer percent (inclusive).
 *
 * Different kinds have wildly different gameplay impact at the same magnitude,
 * so each gets its own range. Higher tiers always roll strictly higher bounds
 * than lower tiers, giving legendary items both more affixes AND stronger ones:
 *   - sell_price / speed / size: normal 15..25 → legendary 48..66
 *   - crit_chance: normal 2..8 → legendary 21..34 (smaller pp; compounds non-linearly)
 *   - combo_chance: normal 5..20 → legendary 36..56 (wider pp; weaker per chance %)
 *
 * Craftsmanship skill-tree node still shifts BOTH bounds equally
 * (via `getAffixMagnitudeBonus(state)`).
 */
export const AFFIX_MAGNITUDE_RANGE: Record<ItemTier, Record<AffixKind, { min: number; max: number }>> = {
  normal: {
    "+sell_price%": { min: 15, max: 25 },
    "+speed%":      { min: 15, max: 25 },
    "+size%":       { min: 15, max: 25 },
    "+crit_chance%":  { min: 2,  max: 8  },
    "+combo_chance%": { min: 5,  max: 20 },
  },
  magic: {
    "+sell_price%": { min: 20, max: 30 },
    "+speed%":      { min: 20, max: 30 },
    "+size%":       { min: 20, max: 30 },
    "+crit_chance%":  { min: 5,  max: 12 },
    "+combo_chance%": { min: 10, max: 25 },
  },
  rare: {
    "+sell_price%": { min: 26, max: 38 },
    "+speed%":      { min: 26, max: 38 },
    "+size%":       { min: 26, max: 38 },
    "+crit_chance%":  { min: 9,  max: 17 },
    "+combo_chance%": { min: 16, max: 32 },
  },
  epic: {
    "+sell_price%": { min: 35, max: 50 },
    "+speed%":      { min: 35, max: 50 },
    "+size%":       { min: 35, max: 50 },
    "+crit_chance%":  { min: 14, max: 24 },
    "+combo_chance%": { min: 24, max: 42 },
  },
  legendary: {
    "+sell_price%": { min: 48, max: 66 },
    "+speed%":      { min: 48, max: 66 },
    "+size%":       { min: 48, max: 66 },
    "+crit_chance%":  { min: 21, max: 34 },
    "+combo_chance%": { min: 36, max: 56 },
  },
};

/** Inventory cap. Locked at 3 for v1. */
export const MAX_INVENTORY_SLOTS = 3;

/** Slot kind — distinct equipment families. Each unlocked kind = one equipped slot. */
export type SlotKind = "brush" | "palette" | "easel" | "hat" | "apron" | "boots";

export const ALL_SLOT_KINDS: ReadonlyArray<SlotKind> = [
  "brush", "palette", "easel", "hat", "apron", "boots",
];
