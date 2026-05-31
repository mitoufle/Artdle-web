/**
 * Equipped-item icons. Each tier ships ONE sprite sheet — a 3×2 grid of circular
 * icons (row 0: palette, brush, easel · row 1: apron, hat, boots) — so a slot's
 * icon is a background-sprite slice keyed by (tier, slot).
 *
 * Filenames are case-sensitive on the deploy host: Items_Epic / Items_Legendary
 * are capitalised, the rest lower-case. Keep these imports byte-exact.
 */
import type { ItemTier } from "@/core/workshopRoll";
import type { SlotKind } from "@/config/workshopAffixes";
import normalSheet from "@/assets/images/items/Items_normal.png";
import magicSheet from "@/assets/images/items/Items_magic.png";
import rareSheet from "@/assets/images/items/Items_rare.png";
import epicSheet from "@/assets/images/items/Items_Epic.png";
import legendarySheet from "@/assets/images/items/Items_Legendary.png";

const TIER_SHEET: Record<ItemTier, string> = {
  normal: normalSheet,
  magic: magicSheet,
  rare: rareSheet,
  epic: epicSheet,
  legendary: legendarySheet,
};

/**
 * background-position per slot within the 3-column × 2-row grid. With
 * background-size 300% 200%, a column maps to 0% / 50% / 100% and a row to
 * 0% / 100%.
 */
const SLOT_POSITION: Record<SlotKind, string> = {
  palette: "0% 0%",
  brush:   "50% 0%",
  easel:   "100% 0%",
  apron:   "0% 100%",
  hat:     "50% 100%",
  boots:   "100% 100%",
};

export interface ItemSpriteStyle {
  readonly backgroundImage: string;
  readonly backgroundSize: string;
  readonly backgroundPosition: string;
}

/** Inline style that renders the (tier, slot) icon from its tier sheet. */
export function getItemSpriteStyle(slot: SlotKind, tier: ItemTier): ItemSpriteStyle {
  return {
    backgroundImage: `url(${TIER_SHEET[tier]})`,
    backgroundSize: "300% 200%",
    backgroundPosition: SLOT_POSITION[slot],
  };
}
