import type { JSX } from "react";
import { useGameStore } from "@/store";
import styles from "./TrackCard.module.css";

interface Props {
  sellPriceLevel: number;
  speedLevel: number;
  canvasTier: number;
}

const GATE_LEVEL = 15;

/**
 * Tier-up button card. Same visual footprint as a TrackCard, but exposes a
 * single "advance to next tier" action gated by `sellPriceLevel >= 15 &&
 * speedLevel >= 15`. Calls the `tierUp` slice action on click when ready.
 *
 * Two visible states: locked (gate not met) and ready (gate met). Both states
 * are visible — the locked state acts as a teaser so the player knows the
 * tier-up exists from T1.
 */
export function TierUpCard({ sellPriceLevel, speedLevel, canvasTier }: Props): JSX.Element {
  const ready = sellPriceLevel >= GATE_LEVEL && speedLevel >= GATE_LEVEL;
  const tierUp = useGameStore((s) => s.tierUp);

  const handleClick = (): void => {
    if (!ready) return;
    tierUp();
  };

  return (
    <button
      type="button"
      className={`${styles.card} ${ready ? "" : styles.locked}`}
      data-testid="tier-up-card"
      data-state={ready ? "ready" : "locked"}
      onClick={handleClick}
      disabled={!ready}
    >
      <div className={styles.label}>Tier Up</div>
      <div className={styles.level}>{ready ? "Ready!" : `T${canvasTier}`}</div>
      {ready ? (
        <div className={styles.effect}>
          → Tier {canvasTier + 1} · ×10 base gold · ×2 paint time
        </div>
      ) : (
        <div className={styles.effect}>
          Reach sell_price L{GATE_LEVEL} + speed L{GATE_LEVEL}
        </div>
      )}
      <div className={styles.upgradeBtn} aria-hidden>
        {ready ? "Free" : "—"}
      </div>
    </button>
  );
}
