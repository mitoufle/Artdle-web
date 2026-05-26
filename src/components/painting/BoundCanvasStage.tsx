import type { JSX } from "react";
import { useGameStore } from "@/store";
import { COMBO_PER_LINK } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { type Big } from "@/core/bigNumber";
import { CanvasStage } from "./CanvasStage";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";

interface Props {
  /** Static-ish — recomputed by PaintingRoute on low-freq state changes. */
  canvasTier: number;
  /** Seconds per chunk, derived from `chunkInterval(speedMultiplier)`. Click-to-paint
   *  feeds this exact value into `canvasTick` to advance one chunk. */
  chunkInterval: number;
  baseGold: Big;
  chunkCount: number;
}

/**
 * Owns the tick-frequency subscriptions (`canvasProgress`, `comboChain`,
 * `critChunks`, `lastSale`, `canvasesSold`) and renders the canvas. Splitting
 * this out of PaintingRoute means the upgrades strip, rooms, and rail stop
 * re-rendering ~60 times per second — they only re-render when one of their
 * own low-frequency subscriptions (levels, gold, items, etc.) changes.
 *
 * Why this matters: when the user navigates away from /painting, the high-
 * frequency stream of `canvasProgress` updates (via Zustand's
 * useSyncExternalStore, which produces urgent updates that bypass React
 * transitions) was preempting any in-progress concurrent render of the new
 * route. The new route's render kept restarting; on a heavier route like
 * `/constellation` (~150 SVG elements, ~10ms per render attempt) the
 * navigation never committed for ~5 seconds. After this isolation,
 * PaintingRoute's subscribers don't include `canvasProgress` etc., so the
 * tick loop's notifications no longer trigger PaintingRoute re-renders.
 * BoundCanvasStage still re-renders per tick, but it's a small subtree —
 * and once PaintingRoute unmounts during navigation, BoundCanvasStage
 * unmounts with it, leaving no tick-frequency subscribers behind.
 *
 * Diagnostic: `tests/components/painting/BoundCanvasStage.test.tsx` asserts
 * PaintingRoute's body re-renders ≤ 1 time when only canvasProgress changes.
 * Before this fix that count was ~30/sec.
 */
export function BoundCanvasStage({
  canvasTier,
  chunkInterval,
  baseGold,
  chunkCount,
}: Props): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const comboChain = useGameStore((s) => s.comboChain);
  const critChunks = useGameStore((s) => s.critChunks);
  const lastSale = useGameStore((s) => s.lastSale);
  const canvasesSold = useGameStore((s) => s.statsRun.canvasesSold);
  const clearLastSale = useGameStore((s) => s.clearLastSale);
  const canvasTick = useGameStore((s) => s.canvasTick);

  // Chunk-domain: canvasProgress is a float in [0, chunkCount). Bar fill is
  // DISCRETE — floored to whole completed chunks — so it visibly jumps one
  // step per chunk completion rather than oozing continuously. Label is in
  // chunks ("5 / 10"), not seconds.
  const completedChunks = Math.floor(canvasProgress);
  const progressPct = chunkCount > 0 ? completedChunks / chunkCount : 0;
  const comboFactor = 1 + COMBO_PER_LINK * comboChain;
  const nextSaleGold = baseGold.mul(comboFactor);

  return (
    <>
      <CanvasStage
        canvasTier={canvasTier}
        progressPct={progressPct}
        timeElapsed={`${completedChunks}`}
        timeTotal={`${chunkCount}`}
        nextSaleGold={formatBig(nextSaleGold)}
        comboChain={comboChain}
        critChunks={critChunks}
        canvasNumber={canvasesSold}
        onChunkClick={() => canvasTick(chunkInterval)}
      />
      {lastSale && (
        <FloatingGoldText
          key={lastSale.id}
          amount={lastSale.amount}
          onComplete={clearLastSale}
        />
      )}
    </>
  );
}
