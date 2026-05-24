import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import {
  canvasGold, canvasTime,
  sellPriceUpgradeCost, speedUpgradeCost,
  sizeUpgradeCost, critUpgradeCost, comboUpgradeCost,
  SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL,
  SIZE_PER_LEVEL,
  CRIT_PER_LEVEL, COMBO_PER_LEVEL, COMBO_PER_LINK,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getCanvasSize,
  type CanvasMultiplierInputs,
} from "@/core/multipliers";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";
import { CanvasStage } from "@/components/painting/CanvasStage";
import { getSketchGridDim } from "@/components/painting/canvasArt";
import { TrackCard } from "@/components/painting/TrackCard";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";
import { RoomRail, type RoomId } from "@/components/painting/RoomRail";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { OfficeRoom } from "@/components/painting/OfficeRoom";
import { StatsRoom } from "@/components/painting/StatsRoom";
import { SchoolRoom } from "@/components/painting/SchoolRoom";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";
import styles from "./PaintingRoute.module.css";

export function PaintingRoute(): JSX.Element {
  const [activeRoom, setActiveRoom] = useState<RoomId>("workshop");

  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const sellPriceLevel = useGameStore((s) => s.sellPriceLevel);
  const speedLevel = useGameStore((s) => s.speedLevel);
  const sizeLevel = useGameStore((s) => s.sizeLevel);
  const critLevel = useGameStore((s) => s.critLevel);
  const comboLevel = useGameStore((s) => s.comboLevel);
  const comboChain = useGameStore((s) => s.comboChain);
  const critChunks = useGameStore((s) => s.critChunks);
  const gold = useGameStore((s) => s.gold);
  const equipped = useGameStore((s) => s.equipped);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const roster = useGameStore((s) => s.roster);
  const canvasTier = useGameStore((s) => s.canvasTier);
  const completedResearches = useGameStore((s) => s.completedResearches);
  const completedAchievements = useGameStore((s) => s.completedAchievements);
  const upgradeSellPrice = useGameStore((s) => s.upgradeSellPrice);
  const upgradeSpeed = useGameStore((s) => s.upgradeSpeed);
  const upgradeSize = useGameStore((s) => s.upgradeSize);
  const upgradeCrit = useGameStore((s) => s.upgradeCrit);
  const upgradeCombo = useGameStore((s) => s.upgradeCombo);
  const lastSale = useGameStore((s) => s.lastSale);
  const canvasesSold = useGameStore((s) => s.statsRun.canvasesSold);
  const clearLastSale = useGameStore((s) => s.clearLastSale);
  const canvasTick = useGameStore((s) => s.canvasTick);

  const helperState: CanvasMultiplierInputs = {
    equipped, purchasedNodes, roster, canvasTier,
    sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel,
    completedResearches,
    completedAchievements,
  };

  const size = getCanvasSize(helperState);
  const baseTime = canvasTime(size, canvasTier);
  const speedMult = getCanvasSpeedMultiplier(helperState);
  const paintTimeSec = baseTime / speedMult;
  const progressPct = paintTimeSec > 0 ? canvasProgress / paintTimeSec : 0;
  const goldMult = getCanvasGoldMultiplier(helperState);
  const baseGold = canvasGold(size, goldMult, canvasTier);
  const comboFactor = 1 + COMBO_PER_LINK * comboChain;
  const nextSaleGold = baseGold.mul(comboFactor);

  const sizeLocked = !getCanvasTrackUnlocked(helperState, "size");
  const critLocked = !getCanvasTrackUnlocked(helperState, "crit");
  const comboLocked = !getCanvasTrackUnlocked(helperState, "combo");

  const chunkCount = getSketchGridDim(canvasTier) ** 2;

  const sellCost = sellPriceUpgradeCost(sellPriceLevel, canvasTier);
  const speedCost = speedUpgradeCost(speedLevel, canvasTier);
  const sizeCost = sizeUpgradeCost(sizeLevel, canvasTier);
  const critCost = critUpgradeCost(critLevel, canvasTier);
  const comboCost = comboUpgradeCost(comboLevel, canvasTier);

  const fmtPct = (x: number, frac = 0): string => `${(x * 100).toFixed(frac)}%`;

  return (
    <div className={styles.layout}>
      <div className={styles.stageArea}>
        <CanvasStage
          sizeLevel={sizeLevel}
          canvasTier={canvasTier}
          progressPct={progressPct}
          timeElapsed={canvasProgress.toFixed(1)}
          timeTotal={paintTimeSec.toFixed(1)}
          nextSaleGold={formatBig(nextSaleGold)}
          comboChain={comboChain}
          critChunks={critChunks}
          canvasNumber={canvasesSold}
          onChunkClick={() => canvasTick(paintTimeSec / chunkCount)}
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
          <TrackCard
            trackId="sell_price"
            label="Sell Price"
            affixKind="+sell_price%"
            level={sellPriceLevel}
            effectLine={`+${fmtPct(SELL_PRICE_PER_LEVEL, 0)} gold/level`}
            costLabel={`${formatBig(sellCost)}`}
            canAfford={gold.gte(sellCost)}
            locked={false}
            onUpgrade={upgradeSellPrice}
          />
          <TrackCard
            trackId="speed"
            label="Speed"
            affixKind="+speed%"
            level={speedLevel}
            effectLine={`+${fmtPct(SPEED_PER_LEVEL, 0)} speed/level`}
            costLabel={`${formatBig(speedCost)}`}
            canAfford={gold.gte(speedCost)}
            locked={false}
            onUpgrade={upgradeSpeed}
          />
          <TrackCard
            trackId="size"
            label="Size"
            affixKind="+size%"
            level={sizeLevel}
            effectLine={sizeLocked ? "—" : `+${fmtPct(SIZE_PER_LEVEL, 0)} size / level (gold = size², time = size)`}
            costLabel={sizeLocked ? "—" : `${formatBig(sizeCost)}`}
            canAfford={gold.gte(sizeCost)}
            locked={sizeLocked}
            onUpgrade={upgradeSize}
          />
          <TrackCard
            trackId="crit"
            label="Crit"
            affixKind="+crit_chunks"
            level={critLevel}
            effectLine={critLocked ? "—" : `+${fmtPct(CRIT_PER_LEVEL, 0)} crit chance/level (90% faster on hit)`}
            costLabel={critLocked ? "—" : `${formatBig(critCost)}`}
            canAfford={gold.gte(critCost)}
            locked={critLocked}
            onUpgrade={upgradeCrit}
          />
          <TrackCard
            trackId="combo"
            label="Combo"
            affixKind="+combo_chance%"
            level={comboLevel}
            effectLine={comboLocked ? "—" : `+${fmtPct(COMBO_PER_LEVEL, 0)} chain chance/level`}
            costLabel={comboLocked ? "—" : `${formatBig(comboCost)}`}
            canAfford={gold.gte(comboCost)}
            locked={comboLocked}
            onUpgrade={upgradeCombo}
          />
        </CanvasUpgradesStrip>
      </div>

      <aside className={styles.roomArea}>
        {activeRoom === "workshop" && <WorkshopRoom />}
        {activeRoom === "office" && <OfficeRoom />}
        {activeRoom === "stats" && <StatsRoom />}
        {activeRoom === "school" && <SchoolRoom />}
      </aside>

      <aside className={styles.railArea}>
        <RoomRail activeRoom={activeRoom} onSelect={setActiveRoom} />
      </aside>
    </div>
  );
}
