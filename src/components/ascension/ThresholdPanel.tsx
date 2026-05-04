import type { JSX } from "react";
import styles from "./ThresholdPanel.module.css";

interface Props {
  currentInspi: string;
  thresholdInspi: string;
  progressPct: number;
}

export function ThresholdPanel({ currentInspi, thresholdInspi, progressPct }: Props): JSX.Element {
  const pct = Math.max(0, Math.min(100, progressPct * 100));
  const pctText = pct.toFixed(0);
  return (
    <section className={styles.panel} aria-label="Threshold">
      <div className={styles.subhead}>Current inspiration</div>
      <div className={styles.value}>{currentInspi}</div>
      <div className={styles.bar}>
        <div className={styles.fill} data-testid="threshold-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.caption}>
        {pctText}% to threshold · {thresholdInspi} inspi
      </div>
    </section>
  );
}
