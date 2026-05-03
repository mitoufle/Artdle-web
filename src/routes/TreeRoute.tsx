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
import { TreeScene } from "@/components/tree/TreeScene";
import { InspiReadout } from "@/components/tree/InspiReadout";
import { StagePanel } from "@/components/tree/StagePanel";
import { UpgradeRow } from "@/components/tree/UpgradeRow";
import styles from "./TreeRoute.module.css";

export function TreeRoute(): JSX.Element {
  const currentStage = useGameStore((s) => s.currentStage);
  const partLevels = useGameStore((s) => s.partLevels);
  const gold = useGameStore((s) => s.gold);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyPartLevel = useGameStore((s) => s.buyPartLevel);
  const growSapling = useGameStore((s) => s.growSapling);

  const helperState = {
    currentStage,
    partLevels,
    equippedItems,
    purchasedNodes,
  } as unknown as GameStore;

  const rate = inspiPerSec(getProducingParts(helperState), getInspiMultiplier(helperState));
  const canGrow = canGrowSapling(helperState);
  const stageConfig = TREE_STAGES[currentStage];
  const stageName = stageConfig?.name ?? "?";
  const nextStageConfig = TREE_STAGES[currentStage + 1];
  const totalLevels = getTotalLevelsInStage(helperState, currentStage);

  // Visible parts: every part of stages 0..currentStage.
  const visibleParts = TREE_STAGES.slice(0, currentStage + 1).flatMap((stage) => stage.parts);

  return (
    <div className={styles.layout}>
      <div className={styles.scene}>
        <TreeScene stage={currentStage} />
        <InspiReadout rate={formatBig(rate)} stageName={stageName} />
      </div>

      <aside className={styles.rail}>
        <StagePanel
          currentStageIndex={currentStage}
          currentStageName={stageName}
          nextStageName={nextStageConfig?.name}
          totalLevelsInStage={totalLevels}
          unlockThreshold={nextStageConfig?.unlockThreshold ?? 0}
          canGrow={canGrow}
          onGrow={growSapling}
        />

        <section className={styles.upgrades} aria-label="Upgrades">
          <header className={styles.upgradesHeader}>Upgrades · spend gold</header>
          <ul className={styles.upgradeList}>
            {visibleParts.map((part) => {
              const level = partLevels[part.id] ?? 0;
              const cost = treePartCost(level, part.baseCost);
              const canAfford = gold.gte(cost);
              return (
                <UpgradeRow
                  key={part.id}
                  partId={part.id}
                  name={part.name}
                  level={level}
                  rate={part.rate}
                  cost={formatBig(cost)}
                  canAfford={canAfford}
                  onBuy={() => buyPartLevel(part.id)}
                />
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
