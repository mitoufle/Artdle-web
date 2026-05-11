import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getRosterCap, getQueueCap } from "@/store/officeSlice";
import { OfficeLevelHeader } from "./OfficeLevelHeader";
import { QueueCard } from "./QueueCard";
import { WorkerCard } from "./WorkerCard";
import styles from "./OfficeRoom.module.css";

export function OfficeRoom(): JSX.Element {
  const queue = useGameStore((s) => s.queue);
  const roster = useGameStore((s) => s.roster);
  const rosterCap = useGameStore(getRosterCap);
  const queueCap = useGameStore(getQueueCap);

  return (
    <section className={styles.room} aria-label="Painter's Office">
      <OfficeLevelHeader />

      <section className={styles.section}>
        <div className={styles.subhead}>
          Queue <span className={styles.count}>{queue.length} / {queueCap}</span>
        </div>
        {queue.length === 0 ? (
          <div className={styles.empty}>No candidates yet — waiting for trickle.</div>
        ) : (
          <ul className={styles.cardList}>
            {queue.map((c) => (
              <QueueCard key={c.id} candidate={c} />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Roster <span className={styles.count}>{roster.length} / {rosterCap}</span>
        </div>
        {roster.length === 0 ? (
          <div className={styles.empty}>No workers hired — hire from the queue above.</div>
        ) : (
          <ul className={styles.cardList}>
            {roster.map((w) => (
              <WorkerCard key={w.id} worker={w} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
