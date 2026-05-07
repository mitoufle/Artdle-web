import type { JSX } from "react";
import { Hoverable } from "@/ui/widgets/Hoverable";
import styles from "./StagePanel.module.css";

const STAGE_NAMES = ["Seed", "Sapling", "Tree"] as const;

interface Props {
  currentStageIndex: number;
  currentStageName: string;
  nextStageName: string | undefined;
  totalLevelsInStage: number;
  unlockThreshold: number;
  canGrow: boolean;
  onGrow: () => void;
}

function stagePanelHoverBody(
  isFinal: boolean,
  totalLevels: number,
  threshold: number,
  canGrow: boolean,
): JSX.Element {
  if (isFinal) {
    return (
      <>
        <div>You've reached the final stage of the tree.</div>
        <div>Continue earning inspiration to ascend for fame.</div>
      </>
    );
  }
  const pct = threshold > 0 ? Math.min(100, (totalLevels / threshold) * 100) : 0;
  const need = Math.max(0, threshold - totalLevels);
  return (
    <>
      <div>Levels in stage: {totalLevels} / {threshold}</div>
      <div>Progress: {pct.toFixed(0)}%</div>
      <div>───</div>
      <div>{canGrow ? "Ready to grow!" : `Need ${need} more levels.`}</div>
    </>
  );
}

/**
 * Top-of-right-rail stage progress panel.
 * Renders: title `Current → Next` (or `Current · Final stage` at top stage),
 * stage chip row (3 chips, current highlighted), progress bar to next-stage
 * unlock, level count, grow CTA.
 */
export function StagePanel({
  currentStageIndex,
  currentStageName,
  nextStageName,
  totalLevelsInStage,
  unlockThreshold,
  canGrow,
  onGrow,
}: Props): JSX.Element {
  const isFinal = nextStageName === undefined;
  const progressPct =
    unlockThreshold > 0 ? Math.min(100, (totalLevelsInStage / unlockThreshold) * 100) : 0;

  return (
    <Hoverable
      as="div"
      title={() =>
        isFinal
          ? `${currentStageName} · Final stage`
          : `${currentStageName} → ${nextStageName}`
      }
      body={() =>
        stagePanelHoverBody(isFinal, totalLevelsInStage, unlockThreshold, canGrow)
      }
      footer={() => (isFinal ? "" : "Click 'Grow' to advance to the next stage.")}
    >
      <section
        className={styles.panel}
        aria-label="Stage progress"
        data-testid="stage-panel"
      >
        <header className={styles.title}>
          {isFinal ? (
            <span>{currentStageName} · Final stage</span>
          ) : (
            <span>
              {currentStageName} → {nextStageName}
            </span>
          )}
        </header>

        <ol className={styles.chips} aria-label="Stage chain">
          {STAGE_NAMES.map((name, idx) => (
            <li
              key={name}
              className={styles.chip}
              data-testid={`stage-chip-${idx}`}
              data-active={idx === currentStageIndex ? "true" : undefined}
            >
              <span>{name}</span>
              {idx < STAGE_NAMES.length - 1 && <span className={styles.arrow} aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>

        {!isFinal && (
          <>
            <div
              className={styles.progress}
              role="progressbar"
              aria-valuenow={totalLevelsInStage}
              aria-valuemin={0}
              aria-valuemax={unlockThreshold}
            >
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <div className={styles.progressLabel}>
              {totalLevelsInStage} / {unlockThreshold} levels in stage
            </div>
            <button
              type="button"
              className={styles.grow}
              disabled={!canGrow}
              onClick={canGrow ? onGrow : undefined}
            >
              Grow into {nextStageName}
            </button>
          </>
        )}
      </section>
    </Hoverable>
  );
}
