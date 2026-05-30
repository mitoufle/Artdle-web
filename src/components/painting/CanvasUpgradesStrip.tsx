import type { JSX, ReactNode } from "react";
import styles from "./CanvasUpgradesStrip.module.css";

interface Props {
  children?: ReactNode;
}

/**
 * Frameless 2-column grid that holds the four upgrade pills (Sell Price, Speed,
 * Crit Chance, Combo). All four always render — locked tracks show as disabled
 * "Locked" pills. The surrounding `.upgradesOverlay` panel (PaintingRoute.module.css)
 * is the only frame, and carries the sweeping StrokeCycleBorder.
 */
export function CanvasUpgradesStrip({ children }: Props): JSX.Element {
  return (
    <section
      className={styles.strip}
      role="group"
      aria-label="Canvas upgrades"
      data-cols="2"
    >
      {children}
    </section>
  );
}
