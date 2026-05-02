/** Persisted affix identifier. Renames require a save migration. */
export type AffixKind = "+canvas_gold%" | "-paint_time%" | "+inspiration_rate%";

export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+canvas_gold%",
  "-paint_time%",
  "+inspiration_rate%",
];

/** Inclusive lower bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MIN_PCT = 5;

/** Inclusive upper bound on rolled magnitude (integer percent). */
export const MAGNITUDE_MAX_PCT = 15;

/** Skill node "Better Brush" shifts both magnitude bounds by this many percentage points. */
export const BETTER_BRUSH_BONUS_PCT = 1;

/** Inventory cap. Locked at 3 for v1 (spec D3). */
export const MAX_INVENTORY_SLOTS = 3;

/** Flat cost in gold per craft. PORT_PLAN.md §1.3 default; no scaling in v1. */
export const CRAFT_COST_GOLD = 100;
