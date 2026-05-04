import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canvasGold, canvasTime, tierUpgradeCost, MAX_TIER } from "@/core/balance";
import { getCanvasGoldMultiplier, getPaintTimeMultiplier, getPmMultiplier } from "@/core/multipliers";
import { formatBig } from "@/core/formatter";
import { big } from "@/core/bigNumber";
import { CanvasStage } from "@/components/painting/CanvasStage";
import { TierCard } from "@/components/painting/TierCard";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";
import { RoomRail } from "@/components/painting/RoomRail";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import styles from "./PaintingRoute.module.css";

export function PaintingRoute(): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const canvasTier = useGameStore((s) => s.canvasTier);
  const gold = useGameStore((s) => s.gold);
  const equippedItems = useGameStore((s) => s.equippedItems);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const paintMastery = useGameStore((s) => s.paintMastery);
  const upgradeTier = useGameStore((s) => s.upgradeTier);
  const lastSale = useGameStore((s) => s.lastSale);
  const clearLastSale = useGameStore((s) => s.clearLastSale);

  const helperState = {
    equippedItems,
    purchasedNodes,
    paintMastery,
  } as unknown as GameStore;

  const baseTime = canvasTime(canvasTier);
  const paintTimeSec = baseTime / getPaintTimeMultiplier(helperState);
  const progressPct = paintTimeSec > 0 ? canvasProgress / paintTimeSec : 0;
  const goldMult = getCanvasGoldMultiplier(helperState) * getPmMultiplier(helperState);
  const nextSaleGold = canvasGold(canvasTier, goldMult);

  const isMax = canvasTier >= MAX_TIER;
  const upgradeCost = isMax ? big(0) : tierUpgradeCost(canvasTier);
  const canAffordUpgrade = !isMax && gold.gte(upgradeCost);

  return (
    <div className={styles.layout}>
      <div className={styles.stageArea}>
        <CanvasStage
          tier={canvasTier}
          progressPct={progressPct}
          timeRemaining={(paintTimeSec - canvasProgress).toFixed(1)}
          timeTotal={paintTimeSec.toFixed(1)}
          nextSaleGold={formatBig(nextSaleGold)}
        />
        {lastSale && (
          <FloatingGoldText
            key={lastSale.id}
            amount={lastSale.amount}
            onComplete={clearLastSale}
          />
        )}
      </div>

      <div className={styles.upgradesArea}>
        <CanvasUpgradesStrip>
          <TierCard
            tier={canvasTier}
            cost={formatBig(upgradeCost)}
            canAfford={canAffordUpgrade}
            isMax={isMax}
            onUpgrade={upgradeTier}
          />
        </CanvasUpgradesStrip>
      </div>

      <aside className={styles.roomArea}>
        <WorkshopRoom />
      </aside>

      <aside className={styles.railArea}>
        <RoomRail />
      </aside>
    </div>
  );
}
