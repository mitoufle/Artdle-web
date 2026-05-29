import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getRosterCap } from "@/store/officeSlice";
import styles from "./OfficeRoom.module.css";

/**
 * Minimal Phase-A2 office panel: a read-only roster list. The full office UI
 * (post-ascend roll screen, on-canvas avatars, class management) lands in
 * Phase D. Workers contribute nothing to the canvas yet (Phase B).
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
              <li key={w.id} className={styles.empty}>
                Painter · Level {w.level} · {w.classId}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
