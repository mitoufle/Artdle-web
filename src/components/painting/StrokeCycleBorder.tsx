import type { JSX, CSSProperties } from "react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import styles from "./StrokeCycleBorder.module.css";

interface Props {
  /** Player seconds-per-stroke (chunkInterval(speedMult)). Low-frequency. */
  interval: number;
}

/**
 * Golden border around the upgrade panel that sweeps clockwise with the PLAYER's
 * stroke cycle. SELF-SUBSCRIBES to the player's `painterClocks` entry (high-freq)
 * so the panel + pills don't re-render every tick. Decorative + click-through.
 */
export function StrokeCycleBorder({ interval }: Props): JSX.Element {
  const clock = useGameStore((s) => s.painterClocks[PLAYER_ID] ?? 0);
  const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;
  return (
    <div
      className={styles.border}
      data-testid="stroke-cycle-border"
      aria-hidden="true"
      style={{ "--fill": fillPct } as CSSProperties}
    />
  );
}
