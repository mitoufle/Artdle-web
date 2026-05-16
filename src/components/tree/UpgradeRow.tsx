import type { JSX } from "react";
import styles from "./UpgradeRow.module.css";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";
import { getInspiMultiplier } from "@/core/multipliers";
import { getPartMilestoneMultiplier, getNextPartMilestone, isApproachingMilestone } from "@/core/balance";

interface Props {
  partId: string;
  name: string;
  level: number;
  rate: number;
  cost: string;
  canAfford: boolean;
  onBuy: () => void;
}

function rowHoverBody(level: number, rate: number, cost: string): JSX.Element {
  const inspiMult = getInspiMultiplier(useGameStore.getState());
  const milestoneMult = getPartMilestoneMultiplier(level);
  const contribution = level * rate * milestoneMult * inspiMult;
  const nextMilestone = getNextPartMilestone(level);
  return (
    <>
      <div>Level: {level}</div>
      <div>Next cost: {cost} g</div>
      <div>───</div>
      <div>Contribution: +{contribution.toFixed(1)} inspi/sec</div>
      {nextMilestone !== null && (
        <div>Next milestone: Lv {nextMilestone} (×{milestoneMult * 2})</div>
      )}
    </>
  );
}

/**
 * Stylized upgrade row for the Tree route's right rail.
 * Layout: [28×28 monogram tile] [name + meta] [cost pill button].
 * Disabled state when player can't afford. Hover styling lives in the
 * module.css :hover rules.
 */
export function UpgradeRow({
  partId,
  name,
  level,
  rate,
  cost,
  canAfford,
  onBuy,
}: Props): JSX.Element {
  const monogram = name.charAt(0).toUpperCase();
  const milestoneMult = getPartMilestoneMultiplier(level);
  const approaching = isApproachingMilestone(level);
  return (
    <li className={styles.row} data-part-id={partId}>
      <span className={styles.monogram} aria-hidden="true">
        {monogram}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          Lv {level} · +{rate.toFixed(1)} inspi/s
          {milestoneMult > 1 && (
            <span className={styles.milestoneBadge}>×{milestoneMult}</span>
          )}
        </span>
      </span>
      <Hoverable
        title={name}
        body={() => rowHoverBody(level, rate, cost)}
        footer="Inspi/sec scales with the global inspi multiplier."
      >
        <button
          type="button"
          className={`${styles.cost}${approaching ? ` ${styles.costGlowing}` : ""}`}
          disabled={!canAfford}
          onClick={canAfford ? onBuy : undefined}
          data-testid={`upgrade-buy-${partId}`}
        >
          ⬢ {cost} <img src="/assets/artdle/Currency/coin.png" width={13} height={13} aria-hidden="true" style={{ imageRendering: "pixelated", verticalAlign: "middle" }} />
        </button>
      </Hoverable>
    </li>
  );
}
