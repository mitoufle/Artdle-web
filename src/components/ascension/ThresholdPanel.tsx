import type { JSX } from "react";
import styles from "./ThresholdPanel.module.css";

interface Props {
  currentInspi: string;
}

/**
 * Right-rail readout of the current inspiration. There is no fixed palier;
 * players ascend whenever they want and the fame formula determines reward.
 */
export function ThresholdPanel({ currentInspi }: Props): JSX.Element {
  return (
    <section className={styles.panel} aria-label="Inspiration">
      <div className={styles.subhead}>Current inspiration</div>
      <div className={styles.value}>{currentInspi}</div>
    </section>
  );
}
