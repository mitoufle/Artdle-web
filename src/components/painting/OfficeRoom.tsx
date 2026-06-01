import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getRosterCap, getWorkerXpGrowth, getWorkerBaseStatBonuses, type Worker } from "@/store/officeSlice";
import { applyBaseStatBonuses, type WorkerBaseStatBonuses } from "@/core/workerModel";
import { workerXpToNext } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { WORKER_STAT_KEYS, WORKER_STAT_LABELS, formatWorkerStatAbsolute } from "./workerStatDisplay";
import { WORKER_AVATARS } from "./workerAvatarMap";
import styles from "./OfficeRoom.module.css";

function WorkerStatCard({ worker, xpGrowth, baseBonuses }: { worker: Worker; xpGrowth: number; baseBonuses: WorkerBaseStatBonuses }): JSX.Element {
  const xpToNext = workerXpToNext(worker.level, xpGrowth);
  const xpFrac = Math.max(0, Math.min(1, worker.xp.div(xpToNext).toNumber()));
  // Effective stats = intrinsic (base + level rolls) + live Office node bonuses.
  const stats = applyBaseStatBonuses(worker.stats, baseBonuses);
  return (
    <li className={styles.card} data-testid="worker-stat-card">
      <header className={styles.cardHeader}>
        <img
          className={styles.cardAvatar}
          src={WORKER_AVATARS[worker.avatar - 1]}
          alt=""
          aria-hidden="true"
          data-testid="worker-avatar-img"
        />
        <span className={styles.cardName}>{worker.name}</span>
        <span className={styles.cardLevel}>Level {worker.level}</span>
      </header>
      <div className={styles.workerXpStrip}>
        <div className={styles.workerXpBar}>
          <div className={styles.workerXpFill} style={{ width: `${xpFrac * 100}%` }} />
        </div>
        <span data-testid="worker-xp-readout">
          {formatBig(worker.xp)} / {formatBig(xpToNext)} xp
        </span>
      </div>
      <div className={styles.cardClass}>{worker.classId}</div>
      <ul className={styles.statList}>
        {WORKER_STAT_KEYS.map((k) => (
          <li key={k} className={styles.statRow}>
            <span className={styles.statLabel}>{WORKER_STAT_LABELS[k]}</span>
            <span className={styles.statValue}>{formatWorkerStatAbsolute(k, stats[k])}</span>
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
  const xpGrowth = useGameStore(getWorkerXpGrowth);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const baseBonuses = getWorkerBaseStatBonuses({ purchasedNodes });

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
              <WorkerStatCard key={w.id} worker={w} xpGrowth={xpGrowth} baseBonuses={baseBonuses} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
