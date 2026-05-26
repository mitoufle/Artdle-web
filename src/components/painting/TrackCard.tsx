import type { JSX } from "react";
import styles from "./TrackCard.module.css";
import type { CanvasTrackId } from "@/store/skillTreeSlice";
import type { AffixKind } from "@/config/workshopAffixes";
import { AFFIX_SYMBOL, AFFIX_COLOR, AFFIX_SYMBOL_SCALE } from "@/config/workshopAffixes";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";

interface Props {
  trackId: CanvasTrackId;
  label: string;
  /** If iconOverride is set, affixKind is ignored for icon/color lookup. */
  affixKind?: AffixKind;
  iconOverride?: string;
  colorOverride?: string;
  level: number;
  /** If set, the button shows "MAX" and is disabled when level >= maxLevel. */
  maxLevel?: number;
  effectLine: string;
  /** Optional secondary line below effectLine — e.g. live rate display. */
  rateLine?: string;
  /**
   * 0..1 sub-stroke cycle progress. When defined, renders a background fill
   * that wipes left→right as the cycle advances and snaps back when the
   * stroke completes. Used by the Speed track to show next-stroke ETA.
   */
  cycleProgressPct?: number;
  costLabel: string;
  canAfford: boolean;
  locked: boolean;
  onUpgrade: () => void;
}

export function TrackCard({
  trackId, label, affixKind, iconOverride, colorOverride,
  level, maxLevel, effectLine, rateLine, cycleProgressPct,
  costLabel, canAfford, locked, onUpgrade,
}: Props): JSX.Element {
  const isMaxed = typeof maxLevel === "number" && level >= maxLevel;
  const disabled = locked || !canAfford || isMaxed;
  const symbol = iconOverride ?? (affixKind ? AFFIX_SYMBOL[affixKind] : "?");
  const color = colorOverride ?? (affixKind ? AFFIX_COLOR[affixKind] : "var(--ink-2)");
  const scale = affixKind ? AFFIX_SYMBOL_SCALE[affixKind] : 1.0;
  const coinIcon = <CurrencyAmount kind="gold" value={costLabel} />;
  const fillPct = typeof cycleProgressPct === "number"
    ? Math.max(0, Math.min(1, cycleProgressPct)) * 100
    : null;
  return (
    <div
      className={`${styles.card} ${locked ? styles.locked : ""}`}
      data-track-id={trackId}
    >
      {fillPct !== null && (
        <div
          className={styles.cycleFill}
          style={{ width: `${fillPct}%` }}
          aria-hidden="true"
          data-testid={`track-card-cycle-fill-${trackId}`}
        />
      )}
      <div className={styles.label}>
        <span className={styles.symbol} style={{ color, fontSize: `${20 * scale}px` }}>{symbol}</span>
        {label}
      </div>
      <div className={styles.level}>Level {level}</div>
      <div className={styles.effect}>{effectLine}</div>
      {rateLine && <div className={styles.rate} data-testid={`track-card-rate-${trackId}`}>{rateLine}</div>}
      <Hoverable
        as="div"
        title={() => locked ? `${label} — Locked` : isMaxed ? `${label} — MAX` : `${label} — Level ${level}`}
        body={() => (
          locked ? (
            <div>Unlocks via the canvas skill-tree node.</div>
          ) : isMaxed ? (
            <div>This track is at the level cap ({maxLevel}).</div>
          ) : (
            <>
              <div>Current effect:  {effectLine}</div>
              <div>Next-level cost: <CurrencyAmount kind="gold" value={costLabel} size={13} /></div>
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
          {locked ? "Locked" : isMaxed ? "MAX" : coinIcon}
        </button>
      </Hoverable>
    </div>
  );
}
