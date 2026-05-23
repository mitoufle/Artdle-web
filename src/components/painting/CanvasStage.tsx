import type { JSX } from "react";
import styles from "./CanvasStage.module.css";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";
import { canvasGold, SELL_PRICE_PER_LEVEL, COMBO_PER_LINK } from "@/core/balance";
import { getCanvasGoldMultiplier, getCanvasSize, getOfficeContribution } from "@/core/multipliers";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";
import paintingScreen from "@/assets/images/Painting_screen.png";

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
}: Props): JSX.Element {
  const stageName = STAGE_NAMES[canvasTier] ?? `Tier ${canvasTier}`;
  const barWidth = `${Math.max(0, Math.min(100, progressPct * 100))}%`;
  // sizeLevel is currently informational (used only for the image alt text).
  // The transparent canvas-area bbox inside Painting_screen.png is
  // left=39.17%, top=19.40%, width=21.58%, height=39.19% — preserved here
  // for future overlays (e.g., rendering the in-progress painting in that spot).
  void sizeLevel;

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
        <img
          src={paintingScreen}
          className={styles.canvasArt}
          alt="Artist's workshop scene with central easel"
        />
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
