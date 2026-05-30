import type { JSX } from "react";
import { useGameStore } from "@/store";
import { chunkInterval } from "@/core/balance";
import styles from "./WorkerAvatars.module.css";

/**
 * Read-only overlay of worker avatars near the canvas, each showing a
 * next-stroke fill. SELF-SUBSCRIBES to `roster` + `painterClocks` (do NOT
 * prop-drill from PaintingRoute — that would re-render the whole route every
 * tick; see the painting-route subscription-isolation work). Mounted as a leaf
 * sibling of BoundCanvasStage. `pointer-events: none` so it never eats the
 * easel's click-to-paint.
 */
export function WorkerAvatars(): JSX.Element | null {
  const roster = useGameStore((s) => s.roster);
  const painterClocks = useGameStore((s) => s.painterClocks);
  if (roster.length === 0) return null;

  return (
    <div
      className={styles.layer}
      style={{ pointerEvents: "none" }}
      data-testid="worker-avatar-layer"
      aria-hidden="true"
    >
      {roster.map((w) => {
        const interval = chunkInterval(w.stats.speed);
        const clock = painterClocks[w.id] ?? 0;
        const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;
        return (
          <div key={w.id} className={styles.avatar} data-testid="worker-avatar">
            <div className={styles.portrait} />
            <div className={styles.cooldownTrack}>
              <div className={styles.cooldownFill} style={{ width: `${fillPct * 100}%` }} />
            </div>
            <div className={styles.level}>Lv {w.level}</div>
          </div>
        );
      })}
    </div>
  );
}
