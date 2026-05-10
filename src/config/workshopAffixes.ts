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

/**
 * Per-affix-kind magnitude range. Bounds are integer percent (inclusive).
 *
 * Different kinds have wildly different gameplay impact at the same magnitude,
 * so each gets its own range:
 *   - sell_price / speed / size: 5..15 — direct % effect, baseline impact
 *   - crit_chance: 2..8 — smaller pp; crit's 10× speed-on-hit compounds non-linearly at high stack
 *   - combo_chance: 5..20 — wider pp; combo's fixed +10%-per-link bonus is weaker per chance %
 *
 * Craftsmanship skill-tree node still shifts BOTH bounds equally
 * (via `getAffixMagnitudeBonus(state)`).
 */
export const AFFIX_MAGNITUDE_RANGE: Record<AffixKind, { min: number; max: number }> = {
  "+sell_price%": { min: 5, max: 15 },
  "+speed%": { min: 5, max: 15 },
  "+size%": { min: 5, max: 15 },
  "+crit_chance%": { min: 2, max: 8 },
  "+combo_chance%": { min: 5, max: 20 },
};

/** Inventory cap. Locked at 3 for v1. */
export const MAX_INVENTORY_SLOTS = 3;

/** Slot kind — distinct equipment families. Each unlocked kind = one equipped slot. */
export type SlotKind = "brush" | "palette" | "easel";

export const ALL_SLOT_KINDS: ReadonlyArray<SlotKind> = ["brush", "palette", "easel"];
