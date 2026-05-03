import type { JSX } from "react";
import styles from "./InspiReadout.module.css";

interface Props {
  rate: string;        // formatted rate (e.g., "3.2", "1.23K"), already stringified by caller
  stageName: string;
}

/**
 * Top-left overlay on the TreeScene: large inspi-purple per-second readout
 * + mono stage subtext. Caller formats the rate (typically via `formatBig`).
 */
export function InspiReadout({ rate, stageName }: Props): JSX.Element {
  return (
    <div className={styles.readout}>
      <div className={styles.rate}>+{rate} inspi/s</div>
      <div className={styles.subtext}>Stage · {stageName}</div>
    </div>
  );
}
