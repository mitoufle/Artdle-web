import type { JSX } from "react";
import { useGameStore } from "@/store";
import { SCHOOL_TIERS } from "@/config/schoolResearches";
import { big } from "@/core/bigNumber";
import { Hoverable } from "@/ui/widgets/Hoverable";
import styles from "./SchoolRoom.module.css";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function effectSummary(effects: ReadonlyArray<{ kind: string; value: number }>): string {
  return effects
    .map((e) => `+${(e.value * 100).toFixed(0)}% ${e.kind.replace(/_pct$/, "").replace(/_/g, " ")}`)
    .join(", ");
}

export function SchoolRoom(): JSX.Element {
  const completedResearches = useGameStore((s) => s.completedResearches);
  const currentTier = useGameStore((s) => s.currentTier);
  const activeResearch = useGameStore((s) => s.activeResearch);
  const researchProgress = useGameStore((s) => s.researchProgress);
  const fame = useGameStore((s) => s.fame);
  const startResearch = useGameStore((s) => s.startResearch);
  const pauseResearch = useGameStore((s) => s.pauseResearch);
  const passExam = useGameStore((s) => s.passExam);

  const tierDef = SCHOOL_TIERS.find((t) => t.tier === currentTier);
  if (!tierDef) return <div className={styles.room}>School unavailable</div>;

  const totalResearches = tierDef.researches.length;
  const completedCount = tierDef.researches.filter((r) => completedResearches[r.id]).length;
  const allComplete = completedCount === totalResearches;
  const isLastTier = !SCHOOL_TIERS.some((t) => t.tier === currentTier + 1);
  const canPassExam = allComplete && !isLastTier && fame.gte(big(tierDef.examCost));

  const activeResearchDef = activeResearch
    ? SCHOOL_TIERS.flatMap((t) => t.researches).find((r) => r.id === activeResearch.id)
    : null;
  const activeProgress = activeResearch && activeResearchDef
    ? 1 - activeResearch.remainingSeconds / activeResearchDef.durationSeconds
    : 0;

  return (
    <div className={styles.room}>
      <div className={styles.header}>
        <span className={styles.title}>Painting School</span>
        <span className={styles.tierBadge}>Tier {currentTier}/{SCHOOL_TIERS.length}</span>
      </div>

      <div className={styles.tierProgress}>
        <div className={styles.tierProgressRow}>
          <span className={styles.tierLabel}>{tierDef.label}</span>
          <span className={styles.tierCount}>{completedCount} / {totalResearches}</span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(completedCount / Math.max(1, totalResearches)) * 100}%` }}
          />
        </div>
      </div>

      {activeResearch && activeResearchDef && (
        <div className={styles.activeCard}>
          <div className={styles.activeHeader}>
            <span className={styles.activeName}>{activeResearchDef.name}</span>
            <span className={styles.activeTimer}>
              {formatDuration(Math.max(0, activeResearch.remainingSeconds))}
            </span>
          </div>
          <div className={styles.activeEffect}>{effectSummary(activeResearchDef.effects)}</div>
          <div className={styles.progressBar}>
            <div
              className={styles.activeProgressFill}
              style={{ width: `${activeProgress * 100}%` }}
            />
          </div>
          <button className={styles.cancelBtn} onClick={pauseResearch} type="button">
            Pause
          </button>
        </div>
      )}

      <div className={styles.grid}>
        {tierDef.researches.map((research) => {
          const done = !!completedResearches[research.id];
          const isActive = activeResearch?.id === research.id;
          const banked = researchProgress[research.id];
          const isPaused = !done && !isActive && banked !== undefined;
          const summary = effectSummary(research.effects);

          return (
            <Hoverable
              key={research.id}
              as="div"
              title={research.name}
              body={summary}
              footer={
                done
                  ? "Completed"
                  : isActive
                  ? `${formatDuration(Math.max(0, activeResearch!.remainingSeconds))} remaining`
                  : isPaused
                  ? `Paused — ${formatDuration(banked)} left (click to resume)`
                  : `${formatDuration(research.durationSeconds)} to complete`
              }
            >
              <div
                className={done ? styles.cardDone : isActive ? styles.cardActive : styles.cardAvailable}
                onClick={() => {
                  if (done || isActive) return;
                  // Clicking another research stops the ongoing one (banking its
                  // progress) and starts/resumes the clicked one.
                  if (activeResearch) pauseResearch();
                  startResearch(research.id);
                }}
              >
                <div className={styles.cardName}>
                  {done ? "✓ " : isActive ? "⏳ " : isPaused ? "⏸ " : "○ "}
                  {research.name}
                </div>
                <div className={styles.cardEffect}>{summary}</div>
                {!done && !isActive && (
                  <div className={styles.cardDuration}>
                    {isPaused ? `⏸ ${formatDuration(banked)} left` : formatDuration(research.durationSeconds)}
                  </div>
                )}
              </div>
            </Hoverable>
          );
        })}
      </div>

      <div className={styles.examGate}>
        <div>
          <div className={styles.examTitle}>Tier Exam</div>
          {isLastTier && allComplete && (
            <div className={styles.examHint}>Max tier reached</div>
          )}
          {!isLastTier && !allComplete && (
            <div className={styles.examHint}>{totalResearches - completedCount} more to go</div>
          )}
          {!isLastTier && allComplete && fame.lt(big(tierDef.examCost)) && (
            <div className={styles.examHint}>Need {tierDef.examCost} ⭐</div>
          )}
        </div>
        <button
          className={styles.examBtn}
          disabled={!canPassExam}
          onClick={() => passExam()}
          type="button"
        >
          {tierDef.examCost} ⭐
        </button>
      </div>
    </div>
  );
}
