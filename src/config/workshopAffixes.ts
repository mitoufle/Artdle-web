import type { ItemTier } from "@/core/workshopRoll";

/**
 * Persisted affix identifier. Renames require a save migration.
 *
 * Items come from the Workshop. Each kind contributes additively to one
 * canvas-derived multiplier:
 *   +sell_price%   → getCanvasGoldMultiplier
 *   +speed%        → getCanvasSpeedMultiplier
 *   +crit_chunks   → getCritChunks         (gated by unlock_canvas_crit; magnitude read as a PERCENT scaling base crit chunks)
 *   +combo_chance% → getComboBaseChance    (gated by unlock_canvas_combo)
 */
export type AffixKind =
  | "+sell_price%"
  | "+speed%"
  | "+crit_chunks"
  | "+combo_chance%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+sell_price%",
  "+speed%",
  "+crit_chunks",
  "+combo_chance%",
];

/** Single-character symbol for each affix kind, used in compact item displays. */
export const AFFIX_SYMBOL: Record<AffixKind, string> = {
  "+sell_price%":   "$",
  "+speed%":        "»",
  "+crit_chunks":   "⚡",
  "+combo_chance%": "∞",
};

/** Accent color for each affix symbol. */
export const AFFIX_COLOR: Record<AffixKind, string> = {
  "+sell_price%":   "#f0b847",
  "+speed%":        "#4fc3e8",
  "+crit_chunks":   "#ffaf3a",
  "+combo_chance%": "#b06ee8",
};

/** Font-size scale factor to compensate for glyphs with different optical sizes. */
export const AFFIX_SYMBOL_SCALE: Record<AffixKind, number> = {
  "+sell_price%":   1.0,
  "+speed%":        1.0,
  "+crit_chunks":   1.0,
  "+combo_chance%": 1.2,
};

/**
 * Per-tier, per-affix-kind magnitude range. Bounds are integer percent (inclusive).
 *
 * Different kinds have wildly different gameplay impact at the same magnitude,
 * so each gets its own range. Higher tiers always roll strictly higher bounds
 * than lower tiers, giving legendary items both more affixes AND stronger ones:
 *   - sell_price / speed / crit_chunks: normal 15..25 → legendary 48..66
 *     (crit_chunks is consumed as a PERCENT scaling base crit chunks, e.g.
 *      magnitude 50 → +50%, so it shares the main percent scale — harmonized
 *      with the other affixes rather than the old tiny 1..5 integer counts,
 *      which floored to no effect; see GitHub issue #6)
 *   - combo_chance: normal 5..20 → legendary 36..56 (wider pp; weaker per chance %)
 *
 * Craftsmanship skill-tree node still shifts BOTH bounds equally
 * (via `getAffixMagnitudeBonus(state)`).
 */
export const AFFIX_MAGNITUDE_RANGE: Record<ItemTier, Record<AffixKind, { min: number; max: number }>> = {
  normal: {
    "+sell_price%": { min: 15, max: 25 },
    "+speed%":      { min: 15, max: 25 },
    "+crit_chunks":   { min: 15, max: 25 },
    "+combo_chance%": { min: 5,  max: 20 },
  },
  magic: {
    "+sell_price%": { min: 20, max: 30 },
    "+speed%":      { min: 20, max: 30 },
    "+crit_chunks":   { min: 20, max: 30 },
    "+combo_chance%": { min: 10, max: 25 },
  },
  rare: {
    "+sell_price%": { min: 26, max: 38 },
    "+speed%":      { min: 26, max: 38 },
    "+crit_chunks":   { min: 26, max: 38 },
    "+combo_chance%": { min: 16, max: 32 },
  },
  epic: {
    "+sell_price%": { min: 35, max: 50 },
    "+speed%":      { min: 35, max: 50 },
    "+crit_chunks":   { min: 35, max: 50 },
    "+combo_chance%": { min: 24, max: 42 },
  },
  legendary: {
    "+sell_price%": { min: 48, max: 66 },
    "+speed%":      { min: 48, max: 66 },
    "+crit_chunks":   { min: 48, max: 66 },
    "+combo_chance%": { min: 36, max: 56 },
  },
};

/**
 * Per-tier fusion gain range. When fusing a drop into an equipped item, each
 * matching affix gains `round(dropMagnitude × pct)`, where `pct` is rolled
 * uniformly in this tier's `[min, max)` band. Higher tiers transfer a larger
 * slice of the drop, so late-game fusion of strong items feels meaningful
 * (the old flat 5%–50% band made high-magnitude legendary fuses underwhelming).
 *
 * Note: pct multiplies the DROP's magnitude, not the target's — so fusing
 * comparable items raises the target by ~this band, but fusing a weak drop into
 * a strong item stays weak (no compounding runaway).
 */
export const FUSE_MAGNITUDE_PCT_RANGE: Record<ItemTier, { min: number; max: number }> = {
  normal:    { min: 0.10, max: 0.25 },
  magic:     { min: 0.15, max: 0.30 },
  rare:      { min: 0.20, max: 0.35 },
  epic:      { min: 0.25, max: 0.40 },
  legendary: { min: 0.30, max: 0.45 },
};

/** Inventory cap. Locked at 3 for v1. */
export const MAX_INVENTORY_SLOTS = 3;

/** Slot kind — distinct equipment families. Each unlocked kind = one equipped slot. */
export type SlotKind = "brush" | "palette" | "easel" | "hat" | "apron" | "boots";

export const ALL_SLOT_KINDS: ReadonlyArray<SlotKind> = [
  "brush", "palette", "easel", "hat", "apron", "boots",
];
