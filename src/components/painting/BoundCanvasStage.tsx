import type { JSX } from "react";
import { useGameStore } from "@/store";
import { COMBO_PER_LINK } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { type Big } from "@/core/bigNumber";
import { CanvasStage } from "./CanvasStage";
import { FloatingGoldText } from "@/ui/widgets/FloatingGoldText";

interface Props {
  /** Static-ish — recomputed by PaintingRoute on low-freq state changes. */
  sizeLevel: number;
  canvasTier: number;
  paintTimeSec: number;
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
  sizeLevel,
  canvasTier,
  paintTimeSec,
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

  const progressPct = paintTimeSec > 0 ? canvasProgress / paintTimeSec : 0;
  const comboFactor = 1 + COMBO_PER_LINK * comboChain;
  const nextSaleGold = baseGold.mul(comboFactor);

  return (
    <>
      <CanvasStage
        sizeLevel={sizeLevel}
        canvasTier={canvasTier}
        progressPct={progressPct}
        timeElapsed={canvasProgress.toFixed(1)}
        timeTotal={paintTimeSec.toFixed(1)}
        nextSaleGold={formatBig(nextSaleGold)}
        comboChain={comboChain}
        critChunks={critChunks}
        canvasNumber={canvasesSold}
        onChunkClick={() => canvasTick(paintTimeSec / chunkCount)}
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
