import type { JSX } from "react";
import { formatElapsed } from "@/core/formatElapsed";
import styles from "./CatchupLoadingScene.module.css";

export function CatchupLoadingScene({
  elapsedSeconds,
  progress,
}: {
  elapsedSeconds: number;
  progress: number;
}): JSX.Element {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <div className={styles.scene}>
      <img src="/artdle_logo.png" alt="Artdle" className={styles.logo} />
      <div className={styles.title}>Catching up on {formatElapsed(elapsedSeconds)} away…</div>
      <div
        className={styles.barOuter}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.barInner} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
