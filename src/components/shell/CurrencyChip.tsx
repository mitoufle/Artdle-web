import type { JSX } from "react";
import styles from "./CurrencyChip.module.css";

export type CurrencyKind = "gold" | "inspi" | "fame" | "pm";

interface Props {
  kind: CurrencyKind;
  label: string;
  value: string;
  rate?: string;
  dimmed?: boolean;
}

/**
 * Single currency chip: pixel icon + Cinzel label + mono value (+ optional rate).
 *
 * The `dimmed` prop signals "irrelevant for current route" — chip stays visible
 * but at 28% opacity + 0.4 saturation per handoff §IA. Container components
 * (e.g., BottomBar) compute dimmed-ness from the active route.
 */
export function CurrencyChip({ kind, label, value, rate, dimmed }: Props): JSX.Element {
  return (
    <div
      className={styles.chip}
      data-testid={`currency-chip-${kind}`}
      data-kind={kind}
      data-dimmed={dimmed ? "true" : undefined}
    >
      <span className={styles.icon} data-icon={kind} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {rate && <span className={styles.rate}>{rate}</span>}
    </div>
  );
}
