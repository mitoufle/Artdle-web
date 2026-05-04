import type { JSX } from "react";
import styles from "./TierCard.module.css";

interface Props {
  tier: number;
  cost: string;       // formatted gold cost, e.g., "100" or "1.2K"
  canAfford: boolean;
  isMax: boolean;     // tier === MAX_TIER
  onUpgrade: () => void;
}

const ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
  6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
};

/**
 * Primary tile in the canvas upgrades strip. Gold border + gold glow.
 * Layout: small "Canvas Tier" label + big serif current → next tier
 * (roman numerals) + full-width Upgrade button.
 *
 * isMax → label becomes "Tier MAX"; button is disabled and shows no cost.
 */
export function TierCard({ tier, cost, canAfford, isMax, onUpgrade }: Props): JSX.Element {
  const currentRoman = ROMAN[tier] ?? String(tier);
  const nextRoman = ROMAN[tier + 1] ?? "?";
  const disabled = isMax || !canAfford;
  const buttonLabel = isMax ? "Tier MAX" : `Upgrade · ${cost}g`;

  return (
    <div className={styles.card}>
      <div className={styles.label}>Canvas Tier</div>
      <div className={styles.numerals}>
        {isMax ? (
          <span>Tier MAX</span>
        ) : (
          <>
            <span>{currentRoman}</span>
            <span className={styles.arrow} aria-hidden="true">→</span>
            <span>{nextRoman}</span>
          </>
        )}
      </div>
      <button
        type="button"
        className={styles.upgradeBtn}
        disabled={disabled}
        onClick={!disabled ? onUpgrade : undefined}
        data-testid="tier-card-upgrade"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
