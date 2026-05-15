import type { JSX } from "react";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { TREE_STAGES } from "@/config/treeStages";
import styles from "./StagePanel.module.css";

interface Props {
  currentStageIndex: number;
  currentStageName: string;
  nextStageName: string | undefined;
  totalLevelsInStage: number;
  unlockThreshold: number;
}

function stagePanelHoverBody(
  isFinal: boolean,
  totalLevels: number,
  threshold: number,
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
  const thresholdMet = need === 0;
  return (
    <>
      <div>Levels in stage: {totalLevels} / {threshold}</div>
      <div>Progress: {pct.toFixed(0)}%</div>
      <div>───</div>
      <div>{thresholdMet ? "Threshold reached — advancing!" : `Need ${need} more levels.`}</div>
    </>
  );
}

/**
 * Top-of-right-rail stage progress panel. Stage advancement is automatic
 * (see treeSlice.buyPartLevel + treeTick); this panel is informational only.
 */
export function StagePanel({
  currentStageIndex,
  currentStageName,
  nextStageName,
  totalLevelsInStage,
  unlockThreshold,
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
      body={() => stagePanelHoverBody(isFinal, totalLevelsInStage, unlockThreshold)}
      footer={() => (isFinal ? "" : "Stage advances automatically when threshold is reached.")}
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
          {TREE_STAGES.slice(currentStageIndex, currentStageIndex + 2).map((stage, i) => {
            const idx = currentStageIndex + i;
            return (
              <li
                key={stage.id}
                className={styles.chip}
                data-testid={`stage-chip-${idx}`}
                data-active={idx === currentStageIndex ? "true" : undefined}
              >
                <span>{stage.name}</span>
                {i === 0 && !isFinal && (
                  <span className={styles.arrow} aria-hidden="true">→</span>
                )}
              </li>
            );
          })}
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
          </>
        )}
      </section>
    </Hoverable>
  );
}
