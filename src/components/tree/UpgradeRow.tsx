import type { JSX } from "react";
import styles from "./UpgradeRow.module.css";

interface Props {
  partId: string;
  name: string;
  level: number;
  rate: number;
  cost: string;
  canAfford: boolean;
  onBuy: () => void;
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
  return (
    <li className={styles.row} data-part-id={partId}>
      <span className={styles.monogram} aria-hidden="true">
        {monogram}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          Lv {level} · +{rate.toFixed(1)} inspi/s
        </span>
      </span>
      <button
        type="button"
        className={styles.cost}
        disabled={!canAfford}
        onClick={canAfford ? onBuy : undefined}
        data-testid={`upgrade-buy-${partId}`}
      >
        ⬢ {cost}g
      </button>
    </li>
  );
}
