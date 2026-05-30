import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getRosterCap, type Worker } from "@/store/officeSlice";
import { WORKER_STAT_KEYS, WORKER_STAT_LABELS, formatWorkerStatAbsolute } from "./workerStatDisplay";
import styles from "./OfficeRoom.module.css";

function WorkerStatCard({ worker }: { worker: Worker }): JSX.Element {
  return (
    <li className={styles.card} data-testid="worker-stat-card">
      <header className={styles.cardHeader}>
        <span className={styles.cardName}>Painter</span>
        <span className={styles.cardLevel}>Level {worker.level}</span>
      </header>
      <div className={styles.cardClass}>{worker.classId}</div>
      <ul className={styles.statList}>
        {WORKER_STAT_KEYS.map((k) => (
          <li key={k} className={styles.statRow}>
            <span className={styles.statLabel}>{WORKER_STAT_LABELS[k]}</span>
            <span className={styles.statValue}>{formatWorkerStatAbsolute(k, worker.stats[k])}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * The Painter's Office tab: a read-only roster of worker stat sheets. Workers
 * level only at ascend (the reveal happens on the post-ascend roll screen).
 * Class switching is deferred to the class-content spec — `classId` is shown
 * as text only.
 */
export function OfficeRoom(): JSX.Element {
  const roster = useGameStore((s) => s.roster);
  const rosterCap = useGameStore(getRosterCap);

  return (
    <section className={styles.room} aria-label="Painter's Office">
      <section className={styles.section}>
        <div className={styles.subhead}>
          Roster <span className={styles.count}>{roster.length} / {rosterCap}</span>
        </div>
        {roster.length === 0 ? (
          <div className={styles.empty}>No painters yet — unlock a roster slot in the skill tree.</div>
        ) : (
          <ul className={styles.cardList}>
            {roster.map((w) => (
              <WorkerStatCard key={w.id} worker={w} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
