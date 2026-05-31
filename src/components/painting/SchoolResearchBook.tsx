import type { JSX } from "react";
import { useGameStore } from "@/store";
import { hasCapability } from "@/store/skillTreeSlice";
import { getResearchById, getResearchName } from "@/config/schoolResearches";
import { getSchoolBonus } from "@/core/schoolMultipliers";
import bookImg from "@/assets/images/Book.png";
import styles from "./SchoolResearchBook.module.css";

/**
 * Progress bar for the active research. Split into its own component so the
 * per-tick `remainingSeconds` update only re-renders this small fill div — the
 * book image and title stay stable (re-rendering the <img> every tick caused a
 * visible flicker).
 */
function ResearchProgress({ researchId }: { researchId: string }): JSX.Element {
  const remaining = useGameStore((s) => s.activeResearch?.remainingSeconds ?? 0);
  // Stable while a research runs (only one is active at a time), so this matches
  // the duration it was started with → exact progress.
  const reductionMin = useGameStore((s) => getSchoolBonus(s, "School Research flat reduction (mnt)"));
  const research = getResearchById(researchId);
  const total = research ? Math.max(60, research.durationSeconds - reductionMin * 60) : 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
  return (
    <div
      className={styles.progress}
      data-testid="school-research-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
    </div>
  );
}

/**
 * Top-right canvas overlay showing the currently assigned School research on an
 * open-book sprite. Hidden until the School is unlocked (`school_access`). When
 * no research is assigned the book breathes (glow in/out) to nudge the player to
 * assign one; while one runs it shows the name + a progress bar.
 */
export function SchoolResearchBook(): JSX.Element | null {
  const unlocked = useGameStore((s) => hasCapability(s, "school_access"));
  const activeId = useGameStore((s) => s.activeResearch?.id ?? null);
  if (!unlocked) return null;

  const idle = activeId === null;
  const label = idle ? "Assign a\nresearch" : getResearchName(activeId);

  return (
    <div
      className={`${styles.book}${idle ? ` ${styles.idle}` : ""}`}
      data-testid="school-research-book"
      data-idle={idle ? "true" : undefined}
      role="status"
      aria-label={idle ? "No school research assigned" : `Researching: ${label}`}
    >
      <img src={bookImg} alt="" className={styles.bookImg} aria-hidden="true" />
      <span className={styles.text}>{label}</span>
      {!idle && <ResearchProgress researchId={activeId} />}
    </div>
  );
}
