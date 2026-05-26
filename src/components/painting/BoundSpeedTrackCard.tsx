import type { JSX } from "react";
import { useGameStore } from "@/store";
import { TrackCard } from "./TrackCard";

interface Props {
  level: number;
  costLabel: string;
  canAfford: boolean;
  onUpgrade: () => void;
  effectLine: string;
  /** Seconds per stroke at current speed multiplier. From PaintingRoute
   *  (chunkInterval(speedMult)). Low-freq — changes only when speed levels
   *  or other speed sources change, not per-tick. */
  chunkInterval: number;
}

/**
 * Speed track card with a live sub-stroke cycle fill + rate readout.
 *
 * Subscribes to `canvasProgress` (a per-tick high-frequency store field) so
 * the background fill can animate from 0%→100% over each stroke cycle, then
 * snap back when a stroke completes. The subscription is scoped to this
 * component so PaintingRoute's body stays unaffected (matching the
 * BoundCanvasStage isolation pattern from the 2026-05-25 nav-perf fix).
 *
 * Rate display is derived from `chunkInterval`: strokes/sec = 1 / interval.
 */
export function BoundSpeedTrackCard({
  level, costLabel, canAfford, onUpgrade, effectLine, chunkInterval,
}: Props): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const cycleProgressPct = canvasProgress - Math.floor(canvasProgress);
  const strokesPerSec = chunkInterval > 0 ? 1 / chunkInterval : 0;
  const rateLine = `${strokesPerSec.toFixed(2)} strokes/s`;

  return (
    <TrackCard
      trackId="speed"
      label="Speed"
      affixKind="+speed%"
      level={level}
      effectLine={effectLine}
      rateLine={rateLine}
      cycleProgressPct={cycleProgressPct}
      costLabel={costLabel}
      canAfford={canAfford}
      locked={false}
      onUpgrade={onUpgrade}
    />
  );
}
