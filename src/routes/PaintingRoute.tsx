import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import {
  canvasGold, chunksPerCanvas, chunkInterval,
  sellPriceUpgradeCost, speedUpgradeCost,
  critUpgradeCost, comboUpgradeCost,
  SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL,
  CRIT_PER_LEVEL, COMBO_PER_LEVEL,
  MAX_CRIT_LEVEL,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  type CanvasMultiplierInputs,
} from "@/core/multipliers";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";
import { BoundCanvasStage } from "@/components/painting/BoundCanvasStage";
import { TrackCard } from "@/components/painting/TrackCard";
import { BoundSpeedTrackCard } from "@/components/painting/BoundSpeedTrackCard";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";
import { RoomRail, type RoomId } from "@/components/painting/RoomRail";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { OfficeRoom } from "@/components/painting/OfficeRoom";
import { StatsRoom } from "@/components/painting/StatsRoom";
import { SchoolRoom } from "@/components/painting/SchoolRoom";
import styles from "./PaintingRoute.module.css";

export function PaintingRoute(): JSX.Element {
  const [activeRoom, setActiveRoom] = useState<RoomId>("workshop");

  const sellPriceLevel = useGameStore((s) => s.sellPriceLevel);
  const speedLevel = useGameStore((s) => s.speedLevel);
  const critLevel = useGameStore((s) => s.critLevel);
  const comboLevel = useGameStore((s) => s.comboLevel);
  const gold = useGameStore((s) => s.gold);
  const equipped = useGameStore((s) => s.equipped);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const canvasTier = useGameStore((s) => s.canvasTier);
  const completedResearches = useGameStore((s) => s.completedResearches);
  const completedAchievements = useGameStore((s) => s.completedAchievements);
  const upgradeSellPrice = useGameStore((s) => s.upgradeSellPrice);
  const upgradeSpeed = useGameStore((s) => s.upgradeSpeed);
  const upgradeCrit = useGameStore((s) => s.upgradeCrit);
  const upgradeCombo = useGameStore((s) => s.upgradeCombo);

  const helperState: CanvasMultiplierInputs = {
    equipped, purchasedNodes, canvasTier,
    sellPriceLevel, speedLevel, critLevel, comboLevel,
    completedResearches,
    completedAchievements,
  };

  const chunkCount = chunksPerCanvas(canvasTier);
  const speedMult = getCanvasSpeedMultiplier(helperState);
  const interval = chunkInterval(speedMult);
  const goldMult = getCanvasGoldMultiplier(helperState);
  const baseGold = canvasGold(goldMult, canvasTier);

  const critLocked = !getCanvasTrackUnlocked(helperState, "crit");
  const comboLocked = !getCanvasTrackUnlocked(helperState, "combo");

  const sellCost = sellPriceUpgradeCost(sellPriceLevel);
  const speedCost = speedUpgradeCost(speedLevel);
  const critCost = critUpgradeCost(critLevel);
  const comboCost = comboUpgradeCost(comboLevel);

  const fmtPct = (x: number, frac = 0): string => `${(x * 100).toFixed(frac)}%`;

  return (
    <div className={styles.layout}>
      <div className={styles.stageArea}>
        <BoundCanvasStage
          canvasTier={canvasTier}
          chunkInterval={interval}
          baseGold={baseGold}
          chunkCount={chunkCount}
        />
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
          <BoundSpeedTrackCard
            level={speedLevel}
            effectLine={`+${fmtPct(SPEED_PER_LEVEL, 0)} speed/level`}
            chunkInterval={interval}
            costLabel={`${formatBig(speedCost)}`}
            canAfford={gold.gte(speedCost)}
            onUpgrade={upgradeSpeed}
          />
          <TrackCard
            trackId="crit"
            label="Crit Chance"
            iconOverride="✦"
            colorOverride="#e85c5c"
            level={critLevel}
            maxLevel={MAX_CRIT_LEVEL}
            effectLine={critLocked ? "—" : `+${fmtPct(CRIT_PER_LEVEL, 0)} crit chance/level (max L${MAX_CRIT_LEVEL})`}
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
