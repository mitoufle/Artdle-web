import type { JSX } from "react";
import { useGameStore } from "@/store";
import { WORKER_STAT_KEYS, formatWorkerStatDelta } from "@/components/painting/workerStatDisplay";
import styles from "./WorkerRollReveal.module.css";

/**
 * Post-ascend reveal of worker level-ups, rendered inside the cinematic
 * blackout. Reads `lastAscendRoll` (Phase C: per-worker before/after for
 * workers that gained ≥1 level). Renders NOTHING when there is no roll — an
 * office-less ascend must not perturb the blackout fame/quote screen.
 */
export function WorkerRollReveal(): JSX.Element | null {
  const roll = useGameStore((s) => s.lastAscendRoll);
  if (!roll || roll.length === 0) return null;

  return (
    <ul className={styles.reveal} data-testid="worker-roll-reveal">
      {roll.map((entry, i) => {
        const deltas = WORKER_STAT_KEYS
          .map((k) => formatWorkerStatDelta(k, entry.statsBefore[k], entry.statsAfter[k]))
          .filter((d): d is string => d !== null);
        return (
          <li
            key={entry.id}
            className={styles.worker}
            style={{ animationDelay: `${1100 + i * 220}ms` }}
          >
            <span className={styles.level}>
              Lv {entry.levelBefore} <span className={styles.arrow}>→</span> {entry.levelAfter}
            </span>
            <span className={styles.deltas}>{deltas.join(" · ")}</span>
          </li>
        );
      })}
    </ul>
  );
}
