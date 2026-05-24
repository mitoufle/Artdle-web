import { useMemo, type JSX } from "react";
import styles from "./CanvasStage.module.css";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";
import { canvasGold, SELL_PRICE_PER_LEVEL, COMBO_PER_LINK } from "@/core/balance";
import { getCanvasGoldMultiplier, getCanvasSize, getOfficeContribution } from "@/core/multipliers";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";
import paintingScreen from "@/assets/images/Painting_screen.png";
import paintingScreenAnim from "@/assets/images/painting_screen_anim.mp4";
import { getSketchUrl, getCellRevealOrder, getSketchGridDim } from "./canvasArt";

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
  /** T14: whether the current canvas is a crit. */
  isCrit?: boolean;
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
  isCrit,
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

  return (
    <section className={styles.stage} aria-label="Canvas stage">
      {isCrit && (
        <div className={styles.critIndicator} data-testid="crit-indicator">CRIT</div>
      )}

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
          <video
            src={paintingScreenAnim}
            poster={paintingScreen}
            className={styles.canvasArt}
            autoPlay
            loop
            muted
            playsInline
            aria-label="Artist's workshop scene with central easel"
          />
          {sketchUrl && (
            <div
              key={`sketch-${canvasNumber}`}
              className={styles.sketchOverlay}
              data-testid="sketch-overlay"
              aria-hidden="true"
              style={{
                gridTemplateColumns: `repeat(${gridDim}, 1fr)`,
                gridTemplateRows: `repeat(${gridDim}, 1fr)`,
              }}
            >
              {Array.from({ length: totalCells }, (_, i) => {
                const col = i % gridDim;
                const row = Math.floor(i / gridDim);
                const revealRank = cellOrder.indexOf(i);
                const visible = revealRank < cellsRevealed;
                const denom = gridDim - 1;
                return (
                  <div
                    key={i}
                    className={styles.sketchCell}
                    style={{
                      backgroundImage: `url(${sketchUrl})`,
                      backgroundSize: `${gridDim * 100}% ${gridDim * 100}%`,
                      backgroundPosition: `${(col / denom) * 100}% ${(row / denom) * 100}%`,
                      opacity: visible ? 1 : 0,
                      transform: visible ? "scale(1)" : "scale(0.4)",
                    }}
                  />
                );
              })}
            </div>
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
