import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react";
import styles from "./CanvasStage.module.css";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";
import { canvasGold, SELL_PRICE_PER_LEVEL, COMBO_PER_LINK } from "@/core/balance";
import { getCanvasGoldMultiplier, getCanvasSize, getOfficeContribution } from "@/core/multipliers";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";
import paintingScreen from "@/assets/images/Painting_screen_full.png";
import { getSketchUrl, getCellRevealOrder, getSketchGridDim } from "./canvasArt";
import { useRevealQueue } from "./useRevealQueue";

/**
 * Module-level cache: each unique sketch URL is decoded at most once across
 * the lifetime of the page. Lets the per-cell draw effect call drawImage
 * synchronously after the first cell of a canvas lands.
 */
const sketchImageCache = new Map<string, HTMLImageElement>();

function getCachedSketchImage(url: string): HTMLImageElement {
  let img = sketchImageCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    sketchImageCache.set(url, img);
  }
  return img;
}

/**
 * Composes one cell of the sketch into the settled canvas via drawImage.
 * Defers itself to the image's load event if the source isn't decoded yet —
 * the next call after decode will draw immediately from the cache.
 */
function drawCellIntoCanvas(
  ctx: CanvasRenderingContext2D,
  cellIndex: number,
  gridDim: number,
  sketchUrl: string,
  canvasW: number,
  canvasH: number,
): void {
  const img = getCachedSketchImage(sketchUrl);
  if (!img.complete || img.naturalWidth === 0) {
    const onLoad = (): void => {
      img.removeEventListener("load", onLoad);
      drawCellIntoCanvas(ctx, cellIndex, gridDim, sketchUrl, canvasW, canvasH);
    };
    img.addEventListener("load", onLoad);
    return;
  }
  const col = cellIndex % gridDim;
  const row = Math.floor(cellIndex / gridDim);
  const sx = (img.width / gridDim) * col;
  const sy = (img.height / gridDim) * row;
  const sw = img.width / gridDim;
  const sh = img.height / gridDim;
  const dx = (canvasW / gridDim) * col;
  const dy = (canvasH / gridDim) * row;
  const dw = canvasW / gridDim;
  const dh = canvasH / gridDim;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function sellHoverBody(_sizeLevel: number, comboChain: number): JSX.Element {
  const state = useGameStore.getState();
  const size = getCanvasSize(state);
  const goldMult = getCanvasGoldMultiplier(state);
  const itemBonus = getEquippedContribution(state, "+sell_price%");
  const workerBonus = getOfficeContribution(state, "+sell_price%").toNumber();
  const rainbowLvl = getNodeLevel(state, "rainbow");
  const rainbowFactor = 1 + 0.50 * rainbowLvl;
  const sellPriceContribution = SELL_PRICE_PER_LEVEL * state.sellPriceLevel;
  const additiveTotal = goldMult / rainbowFactor - 1;
  const colorSum = additiveTotal - itemBonus - workerBonus - sellPriceContribution;
  const baseGold = 10 * size * size;
  const total = canvasGold(size, goldMult, state.canvasTier).mul(1 + COMBO_PER_LINK * comboChain);
  return (
    <>
      <div>Base × size² = 10 × {size.toFixed(2)}² = {baseGold.toFixed(1)}</div>
      <div>───</div>
      <div>Sell Price (Lv {state.sellPriceLevel}): ×{(1 + sellPriceContribution).toFixed(2)}</div>
      <div>Items (sell):  ×{(1 + itemBonus).toFixed(2)}</div>
      <div>Workers:       ×{(1 + workerBonus).toFixed(2)}</div>
      <div>Colors:        ×{(1 + colorSum).toFixed(2)}</div>
      <div>Rainbow:       ×{rainbowFactor.toFixed(2)}</div>
      {comboChain > 0 ? <div>Combo:        ×{(1 + COMBO_PER_LINK * comboChain).toFixed(2)}</div> : null}
      <div>───</div>
      <div>Total: {formatBig(total)} g per canvas</div>
    </>
  );
}

interface Props {
  sizeLevel: number;
  canvasTier: number;
  progressPct: number;       // 0..1, drives the paint-fill overlay height
  timeElapsed: string;       // formatted seconds elapsed, e.g., "1.5"
  timeTotal: string;         // formatted seconds, e.g., "6.0"
  nextSaleGold: string;      // formatted gold preview, e.g., "184" or "1.2K"
  /** T14: combo chain depth for badge display. */
  comboChain?: number;
  /** Set of chunk indices in the current canvas painted by a crit. Cells in
   *  this set get the gold-flash modifier. */
  critChunks?: Record<number, true>;
  /** Canvas number (= lastSale.id) — keys fill elements so React re-mounts on sale,
   *  resetting CSS transition baseline to avoid the rubberband-down effect. */
  canvasNumber?: number;
  /** Click-to-paint: invoked when the player clicks the easel area. Advances
   *  canvas progress by one chunk (1/25 of total paint time). Optional — when
   *  omitted, the easel is not interactive. */
  onChunkClick?: () => void;
}

const STAGE_NAMES: Record<number, string> = {
  1: "Sketch",
  2: "Apprentice",
  3: "Journeyman",
  4: "Adept",
  5: "Skilled",
  6: "Masterpiece",
  7: "Virtuoso",
  8: "Master",
  9: "Grandmaster",
  10: "Legendary",
  11: "Mythic",
};

/**
 * The vignetted canvas stage: dark room + gilded picture frame + pixel landscape
 * + animated paint-fill overlay (driven by progressPct) + easel cap.
 *
 * Title row top-center: "— Tier {N} · {Name} —" (Cinzel).
 * Below: thin gold progress bar.
 * Bottom row: "Painting · {remaining}s / {total}s" (left), "+{gold}g on next sale"
 * (gold-glowing center), tier label (right, decorative — actual upgrade UI is
 * the TrackCards in the upgrades strip below).
 */
export function CanvasStage({
  sizeLevel,
  canvasTier,
  progressPct,
  timeElapsed,
  timeTotal,
  nextSaleGold,
  comboChain,
  critChunks = {},
  canvasNumber = 0,
  onChunkClick,
}: Props): JSX.Element {
  const stageName = STAGE_NAMES[canvasTier] ?? `Tier ${canvasTier}`;
  const barWidth = `${Math.max(0, Math.min(100, progressPct * 100))}%`;
  void sizeLevel;

  // Chunk count doubles (approx) per tier: 5x5, 7x7, 10x10, 14x14, 20x20, ...
  const gridDim = getSketchGridDim(canvasTier);
  const totalCells = gridDim * gridDim;

  // Sketch + reveal-order are stable for a given canvasNumber so re-renders
  // (every frame's progress update) don't reshuffle the chunks.
  const sketchUrl = useMemo(
    () => getSketchUrl(canvasTier, canvasNumber),
    [canvasTier, canvasNumber],
  );
  const cellOrder = useMemo(
    () => getCellRevealOrder(canvasNumber, totalCells),
    [canvasNumber, totalCells],
  );
  const cellsRevealed = Math.floor(
    Math.max(0, Math.min(1, progressPct)) * totalCells,
  );

  // Two-canvas hybrid: a long-lived <canvas> holds all settled pixels, and a
  // small grid overlay holds only the ~8 cells currently popping in. The
  // queue decouples the engine's reveal signal from the per-frame DOM cost.
  const settledCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const committedRef = useRef<Set<number>>(new Set());
  const { inFlight, settled } = useRevealQueue({
    targetRevealed: cellsRevealed,
    cellOrder,
    canvasNumber,
    critCells: critChunks,
  });

  // Commit newly-settled cells into the long-lived canvas. useLayoutEffect
  // fires before browser paint so the canvas pixel lands in the same frame
  // the in-flight DOM cell is removed — no one-frame flash of nothing.
  // Each cell is drawn at most once; committedRef guards against re-draws
  // if `settled` re-references an already-drawn index after subsequent ticks.
  useLayoutEffect(() => {
    const canvas = settledCanvasRef.current;
    if (!canvas || !sketchUrl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (const cellIndex of settled) {
      if (committedRef.current.has(cellIndex)) continue;
      drawCellIntoCanvas(
        ctx,
        cellIndex,
        gridDim,
        sketchUrl,
        canvas.width,
        canvas.height,
      );
      committedRef.current.add(cellIndex);
    }
  }, [settled, sketchUrl, gridDim]);

  // Reset the settled canvas + committed-cells set whenever the canvas
  // identity changes (sale completes, new canvas starts).
  useLayoutEffect(() => {
    const canvas = settledCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    committedRef.current = new Set();
  }, [canvasNumber]);

  // When a canvas sells (canvasNumber increments), briefly hold the previous
  // sketch as a fading overlay so the player sees what they painted before
  // the next canvas starts. Keyed by the just-completed canvasNumber so each
  // flash gets a fresh DOM node and its CSS animation re-runs from start.
  const prevCanvasNumberRef = useRef(canvasNumber);
  const [flashEntry, setFlashEntry] = useState<{ key: number; url: string } | null>(null);
  useEffect(() => {
    const prev = prevCanvasNumberRef.current;
    if (canvasNumber !== prev) {
      const prevUrl = getSketchUrl(canvasTier, prev);
      if (prevUrl) {
        setFlashEntry({ key: prev, url: prevUrl });
        const t = setTimeout(() => setFlashEntry(null), 600);
        prevCanvasNumberRef.current = canvasNumber;
        return () => clearTimeout(t);
      }
      prevCanvasNumberRef.current = canvasNumber;
    }
  }, [canvasNumber, canvasTier]);

  return (
    <section className={styles.stage} aria-label="Canvas stage">
      {comboChain !== undefined && comboChain > 0 && (
        <div className={styles.comboBadge} data-testid="combo-badge">
          🔥 ×{comboChain}  +{(comboChain * 10)}%
        </div>
      )}

      <div className={styles.title}>
        — Tier {canvasTier} · {stageName} —
      </div>
      <div className={styles.frame}>
        <div
          className={`${styles.imageContainer}${onChunkClick ? ` ${styles.imageContainerClickable}` : ""}`}
          onClick={onChunkClick}
          role={onChunkClick ? "button" : undefined}
          aria-label={onChunkClick ? "Paint a chunk" : undefined}
        >
          <img
            src={paintingScreen}
            className={styles.canvasArt}
            alt="Artist's workshop scene with central easel"
            draggable={false}
          />
          {sketchUrl && (
            <>
              <canvas
                ref={settledCanvasRef}
                key={`settled-${canvasNumber}`}
                className={styles.sketchOverlaySettled}
                width={400}
                height={400}
                data-testid="sketch-overlay"
                aria-hidden="true"
              />
              <div
                key={`in-flight-${canvasNumber}`}
                className={styles.sketchOverlayInFlight}
                data-testid="sketch-overlay-in-flight"
                aria-hidden="true"
                style={{
                  gridTemplateColumns: `repeat(${gridDim}, 1fr)`,
                  gridTemplateRows: `repeat(${gridDim}, 1fr)`,
                }}
              >
                {inFlight.map(({ cellIndex, isCrit, startedAt }) => {
                  const col = cellIndex % gridDim;
                  const row = Math.floor(cellIndex / gridDim);
                  const denom = Math.max(1, gridDim - 1);
                  return (
                    <div
                      key={`${cellIndex}-${startedAt}`}
                      className={`${styles.sketchCellInFlight} ${isCrit ? styles.sketchCellCrit : ""}`}
                      data-revealed="true"
                      data-cell-index={cellIndex}
                      style={{
                        gridColumn: col + 1,
                        gridRow: row + 1,
                        backgroundImage: `url(${sketchUrl})`,
                        backgroundSize: `${gridDim * 100}% ${gridDim * 100}%`,
                        backgroundPosition: `${(col / denom) * 100}% ${(row / denom) * 100}%`,
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}
          {flashEntry && (
            <div
              key={`flash-${flashEntry.key}`}
              className={styles.completedFlash}
              style={{ backgroundImage: `url(${flashEntry.url})` }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Thin gold progress bar */}
      <div
        className={styles.progress}
        role="progressbar"
        aria-valuenow={Math.round(progressPct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div key={`bar-${canvasNumber}`} className={styles.progressFill} style={{ width: barWidth }} />
      </div>

      {/* Bottom info row */}
      <div className={styles.bottomRow}>
        <span className={styles.painting}>
          Painting · {timeElapsed}s / {timeTotal}s
        </span>
        <Hoverable
          title="Sell Canvas"
          body={() => sellHoverBody(sizeLevel, comboChain ?? 0)}
          footer="Auto-sells when paint progress reaches 100%."
        >
          <span className={styles.goldPreview} data-testid="canvas-sell-preview">+{nextSaleGold}g on next sale</span>
        </Hoverable>
        <span className={styles.tierBadge}>Tier {canvasTier}</span>
      </div>
    </section>
  );
}
