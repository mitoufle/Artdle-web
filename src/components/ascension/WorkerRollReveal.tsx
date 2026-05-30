import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store";
import {
  WORKER_STAT_KEYS,
  WORKER_STAT_LABELS,
  formatWorkerStatAbsolute,
  formatWorkerStatDeltaShort,
} from "@/components/painting/workerStatDisplay";
import { WORKER_AVATARS } from "@/components/painting/workerAvatarMap";
import styles from "./WorkerRollReveal.module.css";

interface Props {
  /** When true, jump straight to the fully-revealed end state. */
  skip: boolean;
  /** Fired once when the reveal finishes (or immediately when there is no roll). */
  onComplete: () => void;
}

const STEP_MS = 400;
const STEPS = WORKER_STAT_KEYS.length;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Post-ascend reveal of worker level-ups inside the cinematic blackout. One card
 * per leveled-up worker (avatar + name from the live roster by id, `Lv a→b`, and
 * the 5-stat sheet starting at the *before* values). A single shared step walks
 * the stats 0→5 at 400ms each, in sync across cards: an increased stat flips to
 * its after value (teal) with a `+#` chip; unchanged stats stay white. `skip` or
 * prefers-reduced-motion jumps to the end. Renders nothing for an office-less /
 * no-level-up ascend (and still calls `onComplete`).
 */
export function WorkerRollReveal({ skip, onComplete }: Props): JSX.Element | null {
  const roll = useGameStore((s) => s.lastAscendRoll);
  const roster = useGameStore((s) => s.roster);
  const hasRoll = !!roll && roll.length > 0;

  const [revealed, setRevealed] = useState(0);
  const completedRef = useRef(false);

  const complete = (): void => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  };

  useEffect(() => {
    if (!hasRoll) complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoll]);

  useEffect(() => {
    if (!hasRoll) return;
    if (skip || prefersReducedMotion()) {
      setRevealed(STEPS);
      return;
    }
    const id = window.setInterval(() => {
      setRevealed((r) => {
        const next = Math.min(STEPS, r + 1);
        if (next >= STEPS) window.clearInterval(id);
        return next;
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [hasRoll, skip]);

  useEffect(() => {
    if (hasRoll && revealed >= STEPS) complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoll, revealed]);

  if (!hasRoll) return null;

  return (
    <div className={styles.reveal} data-testid="worker-roll-reveal">
      {roll!.map((entry) => {
        const w = roster.find((r) => r.id === entry.id);
        const name = w?.name ?? "Painter";
        const avatar = w?.avatar ?? 1;
        return (
          <div key={entry.id} className={styles.card} data-testid="worker-roll-card">
            <img
              className={styles.avatar}
              src={WORKER_AVATARS[avatar - 1]}
              alt=""
              aria-hidden="true"
              data-testid="worker-portrait-roll"
            />
            <div className={styles.name}>{name}</div>
            <div className={styles.level}>
              Lv {entry.levelBefore} <span className={styles.arrow}>→</span> {entry.levelAfter}
            </div>
            <ul className={styles.stats}>
              {WORKER_STAT_KEYS.map((key, k) => {
                const before = entry.statsBefore[key];
                const after = entry.statsAfter[key];
                const isRevealed = k < revealed;
                const up = isRevealed && after > before;
                const delta = up ? formatWorkerStatDeltaShort(key, before, after) : null;
                return (
                  <li key={key} className={styles.statRow} data-testid={`worker-roll-stat-${key}`}>
                    <span className={styles.statLabel}>{WORKER_STAT_LABELS[key]}</span>
                    {delta ? <span className={styles.delta}>{delta}</span> : null}
                    <span
                      className={`${styles.statValue} ${up ? styles.up : ""}`}
                      data-testid={`worker-roll-value-${key}`}
                      data-up={up ? "true" : "false"}
                    >
                      {formatWorkerStatAbsolute(key, up ? after : before)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
