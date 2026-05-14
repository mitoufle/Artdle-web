import type { JSX } from "react";
import styles from "./TrackCard.module.css";
import type { CanvasTrackId } from "@/store/skillTreeSlice";
import type { AffixKind } from "@/config/workshopAffixes";
import { AFFIX_SYMBOL, AFFIX_COLOR } from "@/config/workshopAffixes";
import { Hoverable } from "@/ui/widgets/Hoverable";

interface Props {
  trackId: CanvasTrackId;
  label: string;
  affixKind: AffixKind;
  level: number;
  effectLine: string;
  costLabel: string;
  canAfford: boolean;
  locked: boolean;
  onUpgrade: () => void;
}

export function TrackCard({
  trackId, label, affixKind, level, effectLine, costLabel, canAfford, locked, onUpgrade,
}: Props): JSX.Element {
  const disabled = locked || !canAfford;
  const buttonLabel = locked ? "Locked" : `Upgrade · ${costLabel}`;
  return (
    <div
      className={`${styles.card} ${locked ? styles.locked : ""}`}
      data-track-id={trackId}
    >
      <div className={styles.label}>
        <span style={{ color: AFFIX_COLOR[affixKind] }}>{AFFIX_SYMBOL[affixKind]}</span>{" "}{label}
      </div>
      <div className={styles.level}>Level {level}</div>
      <div className={styles.effect}>{effectLine}</div>
      <Hoverable
        as="div"
        title={() => locked ? `${label} — Locked` : `${label} — Level ${level}`}
        body={() => (
          locked ? (
            <div>Unlocks via the canvas skill-tree node.</div>
          ) : (
            <>
              <div>Current effect:  {effectLine}</div>
              <div>Next-level cost: {costLabel}</div>
            </>
          )
        )}
        footer={() => locked ? "Visit the constellation to purchase the unlock node." : ""}
      >
        <button
          type="button"
          className={styles.upgradeBtn}
          disabled={disabled}
          onClick={!disabled ? onUpgrade : undefined}
          data-testid={`track-card-upgrade-${trackId}`}
        >
          {buttonLabel}
        </button>
      </Hoverable>
    </div>
  );
}
