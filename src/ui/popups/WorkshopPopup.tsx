import type { JSX } from "react";
import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useLocation } from "react-router-dom";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { Hoverable } from "@/ui/widgets/Hoverable";
import {
  CRAFT_COST_GOLD,
  MAX_INVENTORY_SLOTS,
} from "@/config/workshopAffixes";
import { getCurrentSlotCount } from "@/store/workshopSlice";

/**
 * @invariant The popup is reachable only from /painting and self-closes
 * when the user navigates away (see auto-close `useEffect` below). If a
 * future entry point opens the Workshop from a non-painting route, that effect
 * will fire on mount and immediately close. Before adding such an entry point,
 * relax the predicate — e.g., capture the route-at-open in a ref and only close
 * when the route differs from that captured value.
 */
export function WorkshopPopup(): JSX.Element {
  const { pathname } = useLocation();
  const open = useGameStore((s) => s.workshopPopupOpen);
  const close = useGameStore((s) => s.closeWorkshopPopup);
  const inventory = useGameStore((s) => s.inventory);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const gold = useGameStore((s) => s.gold);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const craft = useGameStore((s) => s.craft);
  const equip = useGameStore((s) => s.equip);
  const unequip = useGameStore((s) => s.unequip);
  const discard = useGameStore((s) => s.discard);
  const reduce = useReducedMotion();

  // Esc dismiss — listener mounts/unmounts with `open`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Auto-close when navigating away from /painting. See @invariant above.
  useEffect(() => {
    if (open && pathname !== "/painting") close();
  }, [open, pathname, close]);

  // Helper expects GameStore; pass the field it actually reads.
  // Cast pattern per docs/agent_docs/ui-patterns.md.
  const helperState = { purchasedNodes } as unknown as GameStore;
  const slotCount = getCurrentSlotCount(helperState);
  const canCraft =
    gold.gte(big(CRAFT_COST_GOLD)) && inventory.length < MAX_INVENTORY_SLOTS;
  const canEquipMore = equippedItems.length < slotCount;
  const canUnequip = inventory.length < MAX_INVENTORY_SLOTS;

  const fadeDuration = reduce ? 0.01 : 0.2;

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workshop-popup-title"
          style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={close}
        >
          <motion.div
            data-testid="workshop-popup-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: fadeDuration, ease: "easeOut" }}
            style={{ width: "min(720px, 90%)", maxHeight: "90%", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 id="workshop-popup-title">
                Workshop
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close workshop"
              >
                ✕
              </button>
            </header>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Hoverable
                title="Craft"
                body="Spend gold to roll one item with one random affix (5–15% magnitude, +1 with Better Brush)."
                footer={() =>
                  `Cost: ${CRAFT_COST_GOLD} gold · Inventory: ${
                    useGameStore.getState().inventory.length
                  }/${MAX_INVENTORY_SLOTS}`
                }
              >
                <button
                  type="button"
                  disabled={!canCraft}
                  onClick={() => craft()}
                >
                  Craft
                </button>
              </Hoverable>
              <span>{CRAFT_COST_GOLD} gold</span>
              <span>
                Inventory: {inventory.length}/{MAX_INVENTORY_SLOTS}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "1rem" }}>
              <section>
                <h3>Inventory</h3>
                {inventory.length === 0 && (
                  <div>
                    Empty — click Craft to roll an item.
                  </div>
                )}
                <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {inventory.map((item, idx) => (
                    <li key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Hoverable
                        title={`${item.kind} ${item.magnitude}%`}
                        body={
                          canEquipMore
                            ? "Click to equip."
                            : "Equipped slots full — unequip an item first."
                        }
                      >
                        <button
                          type="button"
                          disabled={!canEquipMore}
                          onClick={() => equip(idx)}
                          style={{ flex: "1 1 0%" }}
                        >
                          {item.kind} {item.magnitude}%
                        </button>
                      </Hoverable>
                      <Hoverable
                        title="Discard"
                        body="Remove this item from inventory."
                      >
                        <button
                          type="button"
                          onClick={() => discard(idx)}
                          aria-label={`Discard ${item.kind} ${item.magnitude}%`}
                        >
                          ✕
                        </button>
                      </Hoverable>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>
                  Equipped {equippedItems.length}/{slotCount}
                </h3>
                {equippedItems.length === 0 && (
                  <div>No items equipped.</div>
                )}
                <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {equippedItems.map((item, idx) => (
                    <li key={idx}>
                      <Hoverable
                        title={`${item.kind} ${item.magnitude}%`}
                        body={
                          canUnequip
                            ? "Currently equipped. Click to unequip (returns to inventory)."
                            : "Currently equipped. Inventory is full — discard or equip-elsewhere first."
                        }
                      >
                        <button
                          type="button"
                          disabled={!canUnequip}
                          onClick={() => unequip(idx)}
                          style={{ width: "100%" }}
                        >
                          {item.kind} {item.magnitude}%
                        </button>
                      </Hoverable>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
