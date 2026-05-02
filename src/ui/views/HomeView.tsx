import type { JSX } from "react";
import { useGameStore } from "@/store";
import { TREE_STAGES } from "@/config/treeStages";
import { treePartCost, inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
import { getProducingParts, canGrowSapling } from "@/store/treeSlice";
import { formatBig } from "@/core/formatter";

export function HomeView(): JSX.Element {
  const currentStage = useGameStore((s) => s.currentStage);
  const partLevels = useGameStore((s) => s.partLevels);
  const gold = useGameStore((s) => s.gold);
  const buyPartLevel = useGameStore((s) => s.buyPartLevel);
  const growSapling = useGameStore((s) => s.growSapling);

  // Compute live inspi/sec the same way treeTick does.
  const fullState = useGameStore.getState();
  const rate = inspiPerSec(getProducingParts(fullState), getInspiMultiplier(fullState));
  const canGrow = canGrowSapling(fullState);

  const stageName = TREE_STAGES[currentStage]?.name ?? "?";

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h2 className="text-xl font-semibold">{stageName}</h2>
        <p className="text-sm opacity-70">{formatBig(rate)} inspi/sec</p>
      </header>

      <ul className="flex flex-col gap-2">
        {TREE_STAGES.slice(0, currentStage + 1).flatMap((stage) =>
          stage.parts.map((part) => {
            const level = partLevels[part.id] ?? 0;
            const cost = treePartCost(level, part.baseCost);
            const canAfford = gold.gte(cost);
            return (
              <li
                key={part.id}
                className="flex items-center justify-between rounded bg-app-panel px-3 py-2"
              >
                <span>
                  <strong>{part.name}</strong>{" "}
                  <span className="opacity-60">Lv {level}</span>
                </span>
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => buyPartLevel(part.id)}
                  className="rounded bg-gold/20 px-3 py-1 text-sm disabled:opacity-40"
                >
                  Buy ({formatBig(cost)} gold)
                </button>
              </li>
            );
          }),
        )}
      </ul>

      {canGrow && (
        <button
          type="button"
          onClick={() => growSapling()}
          className="self-start rounded bg-inspiration/20 px-4 py-2 text-sm"
        >
          Grow next stage
        </button>
      )}
    </div>
  );
}
