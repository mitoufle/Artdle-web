import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canvasTime } from "@/core/balance";
import { getPaintTimeMultiplier } from "@/core/multipliers";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import { TierUpgradeButton } from "@/ui/widgets/TierUpgradeButton";
import { MAX_INVENTORY_SLOTS } from "@/config/workshopAffixes";

export function PaintingView(): JSX.Element {
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
    <div className="flex flex-col gap-4 p-4">
      <section className="relative rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Canvas — Tier {canvasTier}</div>
        <div className="text-lg font-semibold">{stateLabel}</div>
        <div className="text-sm">
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

      <section className="rounded bg-app-panel p-3">
        <div className="mb-2 text-sm opacity-70">Equipped</div>
        {equippedItems.length === 0 ? (
          <div className="text-sm opacity-60">No item equipped</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {equippedItems.map((item, idx) => (
              <li key={idx} className="text-sm">
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
          className="self-start rounded bg-app-panel px-4 py-2 text-sm hover:bg-app-panel/80"
        >
          Workshop
        </button>
      </Hoverable>
    </div>
  );
}
