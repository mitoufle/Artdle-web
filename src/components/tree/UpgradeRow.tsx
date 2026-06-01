import type { JSX } from "react";
import styles from "./UpgradeRow.module.css";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";
import { useGameStore } from "@/store";
import { getInspiMultiplier } from "@/core/multipliers";
import { getPartMilestoneMultiplier, getNextPartMilestone, isApproachingMilestone, PART_MILESTONES, PART_MILESTONE_FACTORS } from "@/core/balance";
import { formatShort } from "@/core/formatter";

interface Props {
  partId: string;
  name: string;
  level: number;
  rate: number;
  cost: string;
  canAfford: boolean;
  onBuy: () => void;
}

function rowHoverBody(level: number, contribution: number, cost: string): JSX.Element {
  const nextMilestone = getNextPartMilestone(level);
  const nextFactor = nextMilestone !== null ? PART_MILESTONE_FACTORS[PART_MILESTONES.indexOf(nextMilestone)] : null;
  return (
    <>
      <div>Level: {level}</div>
      <div>Next cost: {cost} g</div>
      <div>───</div>
      <div>Contribution: +{formatShort(contribution)} inspi/sec</div>
      {nextMilestone !== null && nextFactor != null && (
        <div>Next milestone: Lv {nextMilestone} (×{nextFactor})</div>
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
  const inspiMult = useGameStore(getInspiMultiplier);
  const milestoneMult = getPartMilestoneMultiplier(level);
  const contribution = level * rate * milestoneMult * inspiMult;
  const approaching = isApproachingMilestone(level);
  const nextMilestone = getNextPartMilestone(level);
  const nextFactor = nextMilestone !== null ? PART_MILESTONE_FACTORS[PART_MILESTONES.indexOf(nextMilestone)] : null;
  return (
    <li className={styles.row} data-part-id={partId}>
      <span className={styles.monogram} aria-hidden="true">
        {monogram}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          Lv {level} · +{formatShort(contribution)} inspi/s
          {milestoneMult > 1 && (
            <span className={styles.milestoneBadge}>×{milestoneMult}</span>
          )}
        </span>
        {nextMilestone !== null && nextFactor != null && (
          <span className={styles.milestone}>next ×{nextFactor} at Lv {nextMilestone}</span>
        )}
      </span>
      <Hoverable
        title={name}
        body={() => rowHoverBody(level, contribution, cost)}
        footer="Inspi/sec scales with the global inspi multiplier."
      >
        <button
          type="button"
          className={`${styles.cost}${approaching ? ` ${styles.costGlowing}` : ""}`}
          disabled={!canAfford}
          onClick={canAfford ? onBuy : undefined}
          data-testid={`upgrade-buy-${partId}`}
        >
          <CurrencyAmount kind="gold" value={cost} />
        </button>
      </Hoverable>
    </li>
  );
}
