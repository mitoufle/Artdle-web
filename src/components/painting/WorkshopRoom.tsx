import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { CRAFT_COST_GOLD, MAX_INVENTORY_SLOTS } from "@/config/workshopAffixes";
import { getCurrentSlotCount } from "@/store/workshopSlice";
import styles from "./WorkshopRoom.module.css";

/**
 * 340px right panel — Workshop room content. Replaces the legacy WorkshopPopup
 * modal: same craft / equip / unequip / discard logic, restyled per handoff
 * aesthetic. Always visible alongside CanvasStage on the painting route in v2.0
 * (no popup state, no auto-close).
 */
export function WorkshopRoom(): JSX.Element {
  const inventory = useGameStore((s) => s.inventory);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const gold = useGameStore((s) => s.gold);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const craft = useGameStore((s) => s.craft);
  const equip = useGameStore((s) => s.equip);
  const unequip = useGameStore((s) => s.unequip);
  const discard = useGameStore((s) => s.discard);

  const helperState = { purchasedNodes } as unknown as GameStore;
  const slotCount = getCurrentSlotCount(helperState);
  const canCraft = gold.gte(big(CRAFT_COST_GOLD)) && inventory.length < MAX_INVENTORY_SLOTS;
  const canEquipMore = equippedItems.length < slotCount;
  const canUnequip = inventory.length < MAX_INVENTORY_SLOTS;

  return (
    <section className={styles.room} aria-label="Workshop room">
      <header className={styles.header}>
        <h2 className={styles.title}>Workshop</h2>
        <span className={styles.crumb}>Craft · Equip</span>
      </header>

      <section className={styles.craftStation}>
        <div className={styles.subhead}>Craft station</div>
        <div className={styles.craftMeta}>
          Roll an item · Random affix · 5–15% magnitude
        </div>
        <button
          type="button"
          className={styles.craftBtn}
          disabled={!canCraft}
          onClick={() => craft()}
          data-testid="craft-button"
        >
          Craft · {CRAFT_COST_GOLD}g
        </button>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Equipped <span className={styles.count}>{equippedItems.length}/{slotCount}</span>
        </div>
        {equippedItems.length === 0 ? (
          <div className={styles.empty}>No items in slots.</div>
        ) : (
          <ul className={styles.list}>
            {equippedItems.map((item, idx) => (
              <li key={idx} className={styles.row}>
                <button
                  type="button"
                  className={styles.itemBtn}
                  disabled={!canUnequip}
                  onClick={() => unequip(idx)}
                  data-testid={`equipped-item-${idx}`}
                >
                  {item.kind} {item.magnitude}%
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Inventory <span className={styles.count}>{inventory.length}/{MAX_INVENTORY_SLOTS}</span>
        </div>
        {inventory.length === 0 ? (
          <div className={styles.empty}>Empty — click Craft to roll an item.</div>
        ) : (
          <ul className={styles.list}>
            {inventory.map((item, idx) => (
              <li key={idx} className={styles.row}>
                <button
                  type="button"
                  className={styles.itemBtn}
                  disabled={!canEquipMore}
                  onClick={() => equip(idx)}
                  data-testid={`inventory-item-${idx}`}
                >
                  {item.kind} {item.magnitude}%
                </button>
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => discard(idx)}
                  aria-label={`Remove item ${idx + 1} from inventory`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
