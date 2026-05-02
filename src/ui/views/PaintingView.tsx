import type { JSX } from "react";
import { useGameStore } from "@/store";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";
import { getPaintTimeMultiplier } from "@/core/multipliers";

export function PaintingView(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const fullState = useGameStore.getState();
  const paintTime = PAINT_TIME_BASE_SECONDS / getPaintTimeMultiplier(fullState);
  const stateLabel = canvasProgress > 0 ? "Painting" : "Idle";

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Canvas</div>
        <div className="text-lg font-semibold">{stateLabel}</div>
        <div className="text-sm">
          {canvasProgress.toFixed(1)} / {paintTime.toFixed(1)}s
        </div>
      </section>

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

      <button
        type="button"
        disabled
        className="self-start rounded bg-app-panel px-4 py-2 text-sm opacity-40"
        title="Workshop popup arrives in Phase 5"
      >
        Workshop (coming soon)
      </button>
    </div>
  );
}
