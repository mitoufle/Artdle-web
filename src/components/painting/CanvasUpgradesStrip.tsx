import type { JSX, ReactNode } from "react";
import styles from "./CanvasUpgradesStrip.module.css";

interface Props {
  children?: ReactNode;
}

/**
 * Always-visible horizontal strip beneath the canvas.
 * 5-column CSS grid. Each cell holds one TrackCard; remaining cells
 * stay empty until unlocked (no fake placeholders per the v2.0 "pure adapt" rule).
 *
 * Children are placed in the first cells in document order; remaining
 * cells stay empty.
 */
export function CanvasUpgradesStrip({ children }: Props): JSX.Element {
  return (
    <section
      className={styles.strip}
      role="group"
      aria-label="Canvas upgrades"
      data-cells="5"
    >
      {children}
    </section>
  );
}
