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
  /** If set, the pill shows "MAX" and is disabled when level >= maxLevel. */
  maxLevel?: number;
  effectLine: string;
  /** Optional live-rate string (e.g. "0.40 strokes/s") — shown in the hover body only. */
  rateLine?: string;
  costLabel: string;
  canAfford: boolean;
  locked: boolean;
  onUpgrade: () => void;
}

/**
 * Compact upgrade pill: the whole pill is the buy button (icon · name · level ·
 * cost). Effect / next-level cost / live rate live in the hover breakdown
 * (InfoPanel via Hoverable). The stroke-cycle indicator lives on the panel
 * border now (StrokeCycleBorder), not here.
 */
export function TrackCard({
  trackId, label, affixKind, iconOverride, colorOverride,
  level, maxLevel, effectLine, rateLine,
  costLabel, canAfford, locked, onUpgrade,
}: Props): JSX.Element {
  const isMaxed = typeof maxLevel === "number" && level >= maxLevel;
  const disabled = locked || !canAfford || isMaxed;
  const symbol = iconOverride ?? (affixKind ? AFFIX_SYMBOL[affixKind] : "?");
  const color = colorOverride ?? (affixKind ? AFFIX_COLOR[affixKind] : "var(--ink-2)");
  const scale = affixKind ? AFFIX_SYMBOL_SCALE[affixKind] : 1.0;
  return (
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
            {rateLine ? <div>Rate: {rateLine}</div> : null}
          </>
        )
      )}
      footer={() => locked ? "Visit the constellation to purchase the unlock node." : ""}
    >
      <button
        type="button"
        className={`${styles.pill} ${locked ? styles.locked : ""}`}
        data-track-id={trackId}
        disabled={disabled}
        onClick={!disabled ? onUpgrade : undefined}
        data-testid={`track-card-upgrade-${trackId}`}
      >
        <span className={styles.symbol} style={{ color, fontSize: `${16 * scale}px` }}>{symbol}</span>
        <span className={styles.name}>{label}</span>
        <span className={styles.level}>L{level}</span>
        <span className={styles.cost}>
          {locked ? "Locked" : isMaxed ? "MAX" : <CurrencyAmount kind="gold" value={costLabel} />}
        </span>
      </button>
    </Hoverable>
  );
}
