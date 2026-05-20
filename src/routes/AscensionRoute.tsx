import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import { canAscend } from "@/systems/ascend";
import { fameOnAscend } from "@/core/balance";
import { getAscendThresholdReduction } from "@/core/multipliers";
import { formatBig, formatShort } from "@/core/formatter";
import { Cavern, type CavernPhase } from "@/components/ascension/Cavern";
import { ThresholdPanel } from "@/components/ascension/ThresholdPanel";
import { FamePreviewCard } from "@/components/ascension/FamePreviewCard";
import { PastRunsLedger } from "@/components/ascension/PastRunsLedger";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";
import styles from "./AscensionRoute.module.css";

function ascendHoverBody(): JSX.Element {
  const state = useGameStore.getState();
  if (!canAscend(state)) {
    return <div>Need 10,000 inspiration to gain your first fame point.</div>;
  }
  const gain = fameOnAscend(state.inspiration, getAscendThresholdReduction(state));
  return (
    <>
      <div>Current inspi: {formatBig(state.inspiration)}</div>
      <div>Fame gain: +{formatShort(gain)}</div>
      <div>───</div>
      <div>Formula: max(1, ⌊(log₁₀(inspi)−4)⁵ × 3.2⌋)</div>
      <div>Milestones:</div>
      <div>  100k inspi → 3 fame</div>
      <div>  1M inspi → 102 fame</div>
      <div>  1B inspi → 10,000 fame</div>
    </>
  );
}

export function AscensionRoute(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const pastRuns = useGameStore((s) => s.pastRuns);
  const performAscend = useGameStore((s) => s.performAscend);

  const canDo = canAscend({ inspiration, purchasedNodes });
  const fameGain = fameOnAscend(inspiration, getAscendThresholdReduction({ purchasedNodes }));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phase, setPhase] = useState<CavernPhase>("idle");

  const onStepThroughClick = () => {
    if (!canDo || phase !== "idle") return;
    setConfirmOpen(true);
  };

  const onConfirmAscend = () => {
    setConfirmOpen(false);
    // Reduced-motion users would never see the opening video finish, so skip
    // straight to the ascend rather than leaving them stuck on a paused frame.
    if (
      typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      performAscend();
      return;
    }
    setPhase("opening");
  };

  const onOpeningEnded = () => {
    performAscend();
    setPhase("idle");
  };

  return (
    <div className={styles.layout}>
      <div className={styles.cavernArea}>
        <Cavern phase={phase} onOpeningEnded={onOpeningEnded}>
          {phase === "idle" && (
            <div className={styles.cta}>
              <Hoverable
                title="Ascend"
                body={() => ascendHoverBody()}
                footer="Ascending resets gold, inspi, tree, canvas, workshop. Fame and skill tree persist."
              >
                <button
                  type="button"
                  className={styles.stepThroughBtn}
                  disabled={!canDo}
                  onClick={onStepThroughClick}
                  data-testid="step-through-btn"
                >
                  {canDo
                    ? <>✦ Step Through · <CurrencyAmount kind="fame" value={formatShort(fameGain)} size={18} /> ✦</>
                    : "✦ Step Through · need 10,000 inspiration ✦"}
                </button>
              </Hoverable>
            </div>
          )}
        </Cavern>
      </div>

      <aside className={styles.rail}>
        <ThresholdPanel currentInspi={formatBig(inspiration)} />
        <FamePreviewCard fameGain={fameGain} />
        <PastRunsLedger runs={pastRuns} totalFame={pastRuns.reduce((acc, r) => acc + r.fame, 0)} />
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
                Ascend · <CurrencyAmount kind="fame" value={formatShort(fameGain)} size={16} /> ✦
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
