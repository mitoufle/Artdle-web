import type { JSX } from "react";
import { useGameStore } from "@/store";
import { tierUpgradeCost } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import sharedStyles from "@/styles/rainbowBorderAffordable.module.css";
import styles from "./TierUpgradeCard.module.css";

interface Props {
  /** Stage name appended to the current tier display (e.g. "Watercolor"). Optional. */
  stageName?: string;
}

export function TierUpgradeCard({ stageName }: Props = {}): JSX.Element {
  const canvasTier = useGameStore((s) => s.canvasTier);
  const gold = useGameStore((s) => s.gold);
  const tierUp = useGameStore((s) => s.tierUp);

  const cost = tierUpgradeCost(canvasTier);
  const affordable = gold.gte(cost);
  const currentLabel = stageName ? `Tier ${canvasTier} · ${stageName}` : `Tier ${canvasTier}`;

  return (
    <button
      type="button"
      className={`${styles.card} ${affordable ? sharedStyles.rainbowBorder : ""}`}
      data-affordable={affordable ? "true" : "false"}
      onClick={(e) => {
        e.stopPropagation();
        tierUp();
      }}
      disabled={!affordable}
      aria-label={`Advance to Tier ${canvasTier + 1} for ${formatBig(cost)} gold`}
    >
      <span className={styles.tierFrom}>{currentLabel}</span>
      <span className={styles.tierArrow}>→</span>
      <span className={styles.tierTo}>Tier {canvasTier + 1}</span>
      <span className={styles.cost}>{formatBig(cost)} gold</span>
    </button>
  );
}
