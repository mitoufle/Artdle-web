import type { JSX, CSSProperties } from "react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import styles from "./StrokeCycleBorder.module.css";

interface Props {
  /** Player seconds-per-stroke (chunkInterval(speedMult)). Low-frequency. */
  interval: number;
}

/**
 * Golden border around the upgrade panel that grows UNIFORMLY clockwise along
 * the perimeter with the PLAYER's stroke cycle, then snaps back on each stroke.
 *
 * Uses an SVG rect stroke with `pathLength={1}` + `stroke-dasharray={`${fill} 1`}`,
 * so the visible arc is exactly `fill` of the perimeter and advances at constant
 * speed regardless of the panel's aspect ratio. (A conic-gradient maps the angle
 * to direction-from-center, which races the long edges and crawls the corners —
 * that's the "non-linear / weird" motion we're replacing.)
 *
 * SELF-SUBSCRIBES to the player's `painterClocks` entry (high-freq) so the panel
 * + pills don't re-render every tick. Decorative + click-through.
 */
export function StrokeCycleBorder({ interval }: Props): JSX.Element {
  const clock = useGameStore((s) => s.painterClocks[PLAYER_ID] ?? 0);
  const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;
  return (
    <svg
      className={styles.svg}
      data-testid="stroke-cycle-border"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <rect className={styles.track} x="0" y="0" width="100%" height="100%" rx="3" />
      <rect
        className={styles.progress}
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx="3"
        pathLength={1}
        data-testid="stroke-cycle-fill"
        data-fill={fillPct}
        style={{ strokeDasharray: `${fillPct} 1` } as CSSProperties}
      />
    </svg>
  );
}
