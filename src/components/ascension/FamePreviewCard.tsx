import type { JSX } from "react";
import { formatShort } from "@/core/formatter";
import styles from "./FamePreviewCard.module.css";

interface Props {
  fameGain: number;
}

export function FamePreviewCard({ fameGain }: Props): JSX.Element {
  return (
    <section className={styles.card} aria-label="Fame preview">
      <div className={styles.subhead}>If you ascend now</div>
      <div className={styles.value}>
        {formatShort(fameGain)}
        <img src="/assets/artdle/Currency/fame.png" width={28} height={28} aria-hidden="true" style={{ imageRendering: "pixelated" }} />
      </div>
      <div className={styles.caption}>
        Fame is permanent · spent in the constellation.
      </div>
    </section>
  );
}
