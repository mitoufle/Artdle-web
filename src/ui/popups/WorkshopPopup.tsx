import type { JSX } from "react";
import { useEffect } from "react";
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
 * @invariant The popup is reachable only from PaintingView and self-closes
 * when `currentView !== "painting"` (see auto-close `useEffect` below). If a
 * future entry point opens the Workshop from a non-painting view, that effect
 * will fire on mount and immediately close. Before adding such an entry point,
 * relax the predicate — e.g., capture the view-at-open in a ref and only close
 * when `currentView` differs from that captured value.
 */
export function WorkshopPopup(): JSX.Element | null {
  const open = useGameStore((s) => s.workshopPopupOpen);
  const close = useGameStore((s) => s.closeWorkshopPopup);
  const inventory = useGameStore((s) => s.inventory);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const gold = useGameStore((s) => s.gold);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const currentView = useGameStore((s) => s.currentView);
  const craft = useGameStore((s) => s.craft);
  const equip = useGameStore((s) => s.equip);
  const unequip = useGameStore((s) => s.unequip);
  const discard = useGameStore((s) => s.discard);

  // Esc dismiss — listener mounts/unmounts with `open`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Auto-close when navigating away from PaintingView. See @invariant above.
  useEffect(() => {
    if (open && currentView !== "painting") close();
  }, [open, currentView, close]);

  if (!open) return null;

  // Helper expects GameStore; pass the field it actually reads.
  // Cast pattern per docs/agent_docs/ui-patterns.md.
  const helperState = { purchasedNodes } as unknown as GameStore;
  const slotCount = getCurrentSlotCount(helperState);
  const canCraft =
    gold.gte(big(CRAFT_COST_GOLD)) && inventory.length < MAX_INVENTORY_SLOTS;
  const canEquipMore = equippedItems.length < slotCount;
  const canUnequip = inventory.length < MAX_INVENTORY_SLOTS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workshop-popup-title"
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/60"
      onClick={close}
    >
      <div
        data-testid="workshop-popup-card"
        className="w-[min(720px,90%)] max-h-[90%] overflow-auto rounded-lg bg-app-bg border border-app-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-app-panel px-4 py-2">
          <h2 id="workshop-popup-title" className="text-lg font-semibold">
            Workshop
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close workshop"
            className="rounded px-2 py-1 text-sm hover:bg-app-panel"
          >
            ✕
          </button>
        </header>

        <div className="flex items-center gap-3 border-b border-app-panel px-4 py-2">
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
              className="rounded bg-gold/20 px-3 py-1 text-sm disabled:opacity-40"
            >
              Craft
            </button>
          </Hoverable>
          <span className="text-sm opacity-70">{CRAFT_COST_GOLD} gold</span>
          <span className="text-sm opacity-70">
            Inventory: {inventory.length}/{MAX_INVENTORY_SLOTS}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4">
          <section>
            <h3 className="mb-2 text-sm opacity-70">Inventory</h3>
            {inventory.length === 0 && (
              <div className="text-sm opacity-60">
                Empty — click Craft to roll an item.
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {inventory.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
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
                      className="flex-1 rounded bg-app-panel px-3 py-2 text-left text-sm disabled:opacity-40"
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
                      className="rounded bg-app-panel px-2 py-2 text-sm hover:bg-red-900/40"
                    >
                      ✕
                    </button>
                  </Hoverable>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm opacity-70">
              Equipped {equippedItems.length}/{slotCount}
            </h3>
            {equippedItems.length === 0 && (
              <div className="text-sm opacity-60">No items equipped.</div>
            )}
            <ul className="flex flex-col gap-2">
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
                      className="w-full rounded bg-app-panel px-3 py-2 text-left text-sm disabled:opacity-40"
                    >
                      {item.kind} {item.magnitude}%
                    </button>
                  </Hoverable>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
