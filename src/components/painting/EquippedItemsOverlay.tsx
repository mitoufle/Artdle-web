import { useMemo, type JSX } from "react";
import { useGameStore } from "@/store";
import {
  getUnlockedSlotKinds,
  getFusionTarget,
  getFuseCost,
} from "@/store/workshopSlice";
import type { Item } from "@/store/workshopSlice";
import type { SlotKind } from "@/config/workshopAffixes";
import { getItemSpriteStyle } from "./itemSprites";
import styles from "./EquippedItemsOverlay.module.css";

/** Brush / palette / easel on the left of the upgrade panel; the rest on the right. */
const LEFT_SLOTS: ReadonlyArray<SlotKind> = ["brush", "palette", "easel"];
const RIGHT_SLOTS: ReadonlyArray<SlotKind> = ["hat", "apron", "boots"];

interface SlotProps {
  slot: SlotKind;
  item: Item | undefined;
  unlocked: boolean;
  fusable: boolean;
}

function ItemSlot({ slot, item, unlocked, fusable }: SlotProps): JSX.Element {
  const state = !unlocked ? "locked" : item ? "equipped" : "empty";
  const cls = `${styles.slot}${fusable ? ` ${styles.fusion}` : ""}`;
  return (
    <div
      className={cls}
      data-slot={slot}
      data-state={state}
      data-fusable={fusable ? "true" : "false"}
      data-tier={item?.tier}
      title={
        state === "locked"
          ? `${slot} — locked`
          : state === "empty"
            ? `${slot} — empty`
            : `${item!.tier} ${slot}${fusable ? " — fusion ready" : ""}`
      }
      aria-label={
        state === "equipped" ? `${slot}: ${item!.tier}` : `${slot} (${state})`
      }
    >
      <div
        className={`${styles.disc} ${state === "equipped" ? "" : styles.discPlaceholder}`}
        style={state === "equipped" ? getItemSpriteStyle(slot, item!.tier) : undefined}
      >
        {state === "locked" && <span className={styles.lock} aria-hidden="true">🔒</span>}
      </div>
    </div>
  );
}

/**
 * Equipped-gear display flanking the canvas upgrade panel. Two columns of three
 * slots pinned to the bottom corners of the stage. Mirrors the Workshop's slot
 * logic: locked slots show a lock, empty slots a dark disc, equipped slots the
 * tier icon, and a fusion-ready (and affordable) slot gets the rainbow ring.
 */
export function EquippedItemsOverlay(): JSX.Element {
  const equipped = useGameStore((s) => s.equipped);
  const inventory = useGameStore((s) => s.inventory);
  const gold = useGameStore((s) => s.gold);
  const workshopLevel = useGameStore((s) => s.workshopLevel);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);

  const unlocked = useMemo(
    () => new Set(getUnlockedSlotKinds({ purchasedNodes })),
    [purchasedNodes],
  );

  // Slots whose equipped item has an affordable fusion-ready inventory candidate
  // — same condition that lights the Workshop row's rainbow caterpillar.
  const fusableSlots = useMemo(() => {
    const set = new Set<SlotKind>();
    for (const inv of inventory) {
      const target = getFusionTarget(inv, equipped, { purchasedNodes });
      if (target && gold.gte(getFuseCost(target, workshopLevel, { purchasedNodes }))) {
        set.add(inv.slot);
      }
    }
    return set;
  }, [inventory, equipped, gold, workshopLevel, purchasedNodes]);

  const renderSlot = (slot: SlotKind): JSX.Element => (
    <ItemSlot
      key={slot}
      slot={slot}
      item={equipped[slot]}
      unlocked={unlocked.has(slot)}
      fusable={fusableSlots.has(slot)}
    />
  );

  return (
    <>
      <div className={`${styles.flank} ${styles.flankLeft}`} aria-label="Equipped items (left)">
        {LEFT_SLOTS.map(renderSlot)}
      </div>
      <div className={`${styles.flank} ${styles.flankRight}`} aria-label="Equipped items (right)">
        {RIGHT_SLOTS.map(renderSlot)}
      </div>
    </>
  );
}
