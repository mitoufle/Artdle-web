import type { JSX, CSSProperties } from "react";
import { useGameStore } from "@/store";
import { chunkInterval, workerXpToNext } from "@/core/balance";
import type { Worker } from "@/store/officeSlice";
import { WORKER_AVATARS } from "./workerAvatarMap";
import styles from "./WorkerAvatars.module.css";

/** Avatars 2 & 3 flank the canvas on the left; 1 & 4 on the right. */
const LEFT_AVATARS = new Set([2, 3]);

/**
 * Read-only overlay of worker avatars flanking the canvas. SELF-SUBSCRIBES to
 * `roster` + `painterClocks` (do NOT prop-drill — that re-renders the whole
 * route every tick). `pointer-events:none` so it never eats click-to-paint.
 * Each portrait shows a gold stroke-cycle ring (clock/interval) and a teal XP
 * bar (xp / workerXpToNext(level)).
 */
export function WorkerAvatars(): JSX.Element | null {
  const roster = useGameStore((s) => s.roster);
  const painterClocks = useGameStore((s) => s.painterClocks);
  if (roster.length === 0) return null;

  const left = roster.filter((w) => LEFT_AVATARS.has(w.avatar));
  const right = roster.filter((w) => !LEFT_AVATARS.has(w.avatar));

  const renderAvatar = (w: Worker): JSX.Element => {
    const interval = chunkInterval(w.stats.speed);
    const clock = painterClocks[w.id] ?? 0;
    const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;
    const xpToNext = workerXpToNext(w.level);
    const xpFrac = Math.max(0, Math.min(1, w.xp.div(xpToNext).toNumber()));
    return (
      <div key={w.id} className={styles.avatar} data-testid="worker-avatar">
        <div className={styles.ringWrap} data-testid="worker-ringwrap">
          <div className={styles.ring} style={{ "--fill": fillPct } as CSSProperties} />
          <div
            className={styles.portrait}
            data-testid="worker-portrait"
            style={{ backgroundImage: `url(${WORKER_AVATARS[w.avatar - 1]})` }}
          />
        </div>
        <div className={styles.xpBar}>
          <div
            className={styles.xpFill}
            data-testid="worker-xp-fill"
            style={{ width: `${xpFrac * 100}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.layer}
      style={{ pointerEvents: "none" }}
      data-testid="worker-avatar-layer"
      aria-hidden="true"
    >
      <div className={styles.columnLeft} data-testid="worker-column-left">
        {left.map(renderAvatar)}
      </div>
      <div className={styles.columnRight} data-testid="worker-column-right">
        {right.map(renderAvatar)}
      </div>
    </div>
  );
}
