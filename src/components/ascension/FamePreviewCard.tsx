import type { JSX } from "react";
import styles from "./FamePreviewCard.module.css";

interface Props {
  fameGain: number;
}

export function FamePreviewCard({ fameGain }: Props): JSX.Element {
  return (
    <section className={styles.card} aria-label="Fame preview">
      <div className={styles.subhead}>If you ascend now</div>
      <div className={styles.value}>+{fameGain}</div>
      <div className={styles.caption}>
        Fame is permanent · spent in the constellation.
      </div>
    </section>
  );
}
