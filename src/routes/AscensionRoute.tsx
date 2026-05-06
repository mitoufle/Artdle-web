import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canAscend } from "@/systems/ascend";
import { fameOnAscend } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { Cavern } from "@/components/ascension/Cavern";
import { Portal } from "@/components/ascension/Portal";
import { ThresholdPanel } from "@/components/ascension/ThresholdPanel";
import { FamePreviewCard } from "@/components/ascension/FamePreviewCard";
import { PastRunsLedger } from "@/components/ascension/PastRunsLedger";
import styles from "./AscensionRoute.module.css";

export function AscensionRoute(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const pastRuns = useGameStore((s) => s.pastRuns);
  const performAscend = useGameStore((s) => s.performAscend);

  const helperState = {
    inspiration,
    ascendCount,
    purchasedNodes,
  } as unknown as GameStore;

  const canDo = canAscend(helperState);
  const fameGain = fameOnAscend(inspiration);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const onStepThroughClick = () => {
    if (!canDo) return;
    setConfirmOpen(true);
  };

  const onConfirmAscend = () => {
    setConfirmOpen(false);
    performAscend();
  };

  return (
    <div className={styles.layout}>
      <div className={styles.cavernArea}>
        <Cavern>
          <div className={styles.portalCenter}>
            <Portal />
          </div>
          <div className={styles.cta}>
            <div className={styles.ctaLabel}>— Step Through —</div>
            <button
              type="button"
              className={styles.stepThroughBtn}
              disabled={!canDo}
              onClick={onStepThroughClick}
            >
              ✦ Step Through · +{fameGain} fame ✦
            </button>
          </div>
        </Cavern>
      </div>

      <aside className={styles.rail}>
        <ThresholdPanel currentInspi={formatBig(inspiration)} />
        <FamePreviewCard fameGain={fameGain} />
        <PastRunsLedger runs={pastRuns} totalFame={fame.toNumber()} />
      </aside>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ascend-confirm-title"
          className={styles.modalOverlay}
          onClick={() => setConfirmOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 id="ascend-confirm-title" className={styles.modalTitle}>
              Step Through the Portal?
            </h2>
            <p className={styles.modalBody}>
              Your run resets — gold, inspiration, tree, canvas, and workshop are
              wiped. Fame is permanent and spent in the constellation.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={onConfirmAscend}
              >
                Ascend  +{fameGain} fame ✦
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
