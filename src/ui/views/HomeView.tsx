import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { TREE_STAGES } from "@/config/treeStages";
import { treePartCost, inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
import {
  getProducingParts,
  canGrowSapling,
  getTotalLevelsInStage,
} from "@/store/treeSlice";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";

export function HomeView(): JSX.Element {
  const currentStage = useGameStore((s) => s.currentStage);
  const partLevels = useGameStore((s) => s.partLevels);
  const gold = useGameStore((s) => s.gold);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyPartLevel = useGameStore((s) => s.buyPartLevel);
  const growSapling = useGameStore((s) => s.growSapling);

  // Helpers expect a GameStore; pass the fields they actually read.
  // Cast is intentional and safe — see docs/agent_docs/ui-patterns.md.
  const helperState = {
    currentStage,
    partLevels,
    equippedItems,
    purchasedNodes,
  } as unknown as GameStore;
  const rate = inspiPerSec(getProducingParts(helperState), getInspiMultiplier(helperState));
  const canGrow = canGrowSapling(helperState);

  const stageName = TREE_STAGES[currentStage]?.name ?? "?";
  const nextStage = TREE_STAGES[currentStage + 1];
  const growThreshold = nextStage?.unlockThreshold ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <Hoverable
          as="div"
          title={() => TREE_STAGES[useGameStore.getState().currentStage]?.name ?? "?"}
          body="Current tree stage. Each part on this stage produces inspiration."
        >
          <h2 className="text-xl font-semibold">{stageName}</h2>
        </Hoverable>
        <Hoverable
          as="div"
          title="Inspiration / sec"
          body={() => {
            const s = useGameStore.getState();
            const hs = {
              currentStage: s.currentStage,
              partLevels: s.partLevels,
              equippedItems: s.equippedItems,
              purchasedNodes: s.purchasedNodes,
            } as unknown as GameStore;
            const mult = getInspiMultiplier(hs);
            return `Sum of all part levels × rate, then × multipliers (currently ×${mult.toFixed(2)}).`;
          }}
        >
          <p className="text-sm opacity-70">{formatBig(rate)} inspi/sec</p>
        </Hoverable>
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
                <Hoverable
                  title={() => {
                    const lvl = useGameStore.getState().partLevels[part.id] ?? 0;
                    return `${part.name} (Lv ${lvl})`;
                  }}
                  body={() => {
                    const lvl = useGameStore.getState().partLevels[part.id] ?? 0;
                    const live = part.rate * lvl;
                    return `Adds ${part.rate} inspi/sec per level (currently +${live.toFixed(2)} inspi/sec).`;
                  }}
                  footer={() => {
                    const lvl = useGameStore.getState().partLevels[part.id] ?? 0;
                    const nextCost = treePartCost(lvl, part.baseCost);
                    return `Cost: ${formatBig(nextCost)} gold`;
                  }}
                >
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => buyPartLevel(part.id)}
                    className="rounded bg-gold/20 px-3 py-1 text-sm disabled:opacity-40"
                  >
                    Buy ({formatBig(cost)} gold)
                  </button>
                </Hoverable>
              </li>
            );
          }),
        )}
      </ul>

      {canGrow && (
        <Hoverable
          title="Grow next stage"
          body={() => {
            const s = useGameStore.getState();
            const hs = {
              currentStage: s.currentStage,
              partLevels: s.partLevels,
            } as unknown as GameStore;
            const total = getTotalLevelsInStage(hs, s.currentStage);
            return `Levels in current stage: ${total}/${growThreshold}. Click to advance.`;
          }}
        >
          <button
            type="button"
            onClick={() => growSapling()}
            className="self-start rounded bg-inspiration/20 px-4 py-2 text-sm"
          >
            Grow next stage
          </button>
        </Hoverable>
      )}
    </div>
  );
}
