import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canvasTime } from "@/core/balance";
import { getPaintTimeMultiplier } from "@/core/multipliers";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import { TierUpgradeButton } from "@/ui/widgets/TierUpgradeButton";
import { MAX_INVENTORY_SLOTS } from "@/config/workshopAffixes";

export function PaintingRoute(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const canvasTier = useGameStore((s) => s.canvasTier);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const openWorkshopPopup = useGameStore((s) => s.openWorkshopPopup);
  const lastSale = useGameStore((s) => s.lastSale);
  const clearLastSale = useGameStore((s) => s.clearLastSale);

  // Helpers expect a GameStore; pass the field they actually read.
  // Cast is intentional and safe — see docs/agent_docs/ui-patterns.md.
  const helperState = { equippedItems } as unknown as GameStore;
  const paintTime = canvasTime(canvasTier) / getPaintTimeMultiplier(helperState);
  const stateLabel = canvasProgress > 0 ? "Painting" : "Idle";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>
      <section style={{ position: "relative" }}>
        <div>Canvas — Tier {canvasTier}</div>
        <div>{stateLabel}</div>
        <div>
          {canvasProgress.toFixed(1)} / {paintTime.toFixed(1)}s
        </div>
        {lastSale && (
          <FloatingGoldText
            key={lastSale.id}
            amount={lastSale.amount}
            onComplete={clearLastSale}
          />
        )}
      </section>

      <TierUpgradeButton />

      <section>
        <div>Equipped</div>
        {equippedItems.length === 0 ? (
          <div>No item equipped</div>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {equippedItems.map((item, idx) => (
              <li key={idx}>
                {item.kind} {item.magnitude}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Hoverable
        title="Workshop"
        body="Craft items with random affixes. Equip them to boost canvas/tree."
        footer={() =>
          `Inventory: ${useGameStore.getState().inventory.length}/${MAX_INVENTORY_SLOTS}`
        }
      >
        <button
          type="button"
          onClick={() => openWorkshopPopup()}
        >
          Workshop
        </button>
      </Hoverable>
    </div>
  );
}
