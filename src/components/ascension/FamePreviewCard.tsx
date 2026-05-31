import type { JSX } from "react";
import { formatShort } from "@/core/formatter";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";
import styles from "./FamePreviewCard.module.css";

interface Props {
  fameGain: number;
  /** Total levels the worker roster would gain from this ascend's XP pool.
   *  Omitted/0 (no office, or no level-ups) hides the line. */
  workerLevelGain?: number;
}

export function FamePreviewCard({ fameGain, workerLevelGain = 0 }: Props): JSX.Element {
  return (
    <section className={styles.card} aria-label="Fame preview">
      <div className={styles.subhead}>If you ascend now</div>
      <div className={styles.value}>
        <CurrencyAmount kind="fame" value={formatShort(fameGain)} size={28} />
      </div>
      {workerLevelGain > 0 && (
        <div className={styles.workerLevels} data-testid="worker-level-preview">
          +{workerLevelGain} worker level{workerLevelGain === 1 ? "" : "s"}
        </div>
      )}
      <div className={styles.caption}>
        Fame is permanent · spent in the constellation.
      </div>
    </section>
  );
}
