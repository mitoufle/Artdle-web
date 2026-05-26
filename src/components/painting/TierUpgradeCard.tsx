import type { JSX } from "react";
import { useGameStore } from "@/store";
import { tierUpgradeCost } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import sharedStyles from "@/styles/rainbowBorderAffordable.module.css";
import styles from "./TierUpgradeCard.module.css";

export function TierUpgradeCard(): JSX.Element {
  const canvasTier = useGameStore((s) => s.canvasTier);
  const gold = useGameStore((s) => s.gold);
  const tierUp = useGameStore((s) => s.tierUp);

  const cost = tierUpgradeCost(canvasTier);
  const affordable = gold.gte(cost);

  return (
    <button
      type="button"
      className={`${styles.card} ${affordable ? sharedStyles.rainbowBorder : ""}`}
      data-affordable={affordable ? "true" : "false"}
      onClick={() => tierUp()}
      disabled={!affordable}
      aria-label={`Advance to Tier ${canvasTier + 1} for ${formatBig(cost)} gold`}
    >
      <div className={styles.eyebrow}>Tier upgrade</div>
      <div className={styles.body}>
        <div className={styles.tierLine}>
          <span className={styles.tierFrom}>Tier {canvasTier}</span>
          <span className={styles.tierArrow}>→</span>
          <span className={styles.tierTo}>Tier {canvasTier + 1}</span>
        </div>
        <div className={styles.cost}>{formatBig(cost)} gold</div>
      </div>
    </button>
  );
}
