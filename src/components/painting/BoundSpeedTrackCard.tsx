import type { JSX } from "react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
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
 * Subscribes to the PLAYER's entry in `painterClocks` (seconds accumulated
 * toward the player's next stroke — a per-tick high-frequency field since the
 * Phase B multi-painter rework) so the background fill animates 0%→100% over
 * each stroke cycle, then snaps back when the player strokes. (It used to read
 * `canvasProgress`, but that became an integer chunk-count in Phase B, so the
 * fill froze at 0% — the player's sub-stroke timing now lives in painterClocks.)
 * The subscription is scoped to this component so PaintingRoute's body stays
 * unaffected (matching the BoundCanvasStage isolation pattern).
 *
 * Rate display is derived from `chunkInterval`: strokes/sec = 1 / interval.
 */
export function BoundSpeedTrackCard({
  level, costLabel, canAfford, onUpgrade, effectLine, chunkInterval,
}: Props): JSX.Element {
  const playerClock = useGameStore((s) => s.painterClocks[PLAYER_ID] ?? 0);
  const cycleProgressPct = chunkInterval > 0 ? playerClock / chunkInterval : 0;
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
