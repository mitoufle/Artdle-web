import type { JSX } from "react";
import styles from "./CanvasStage.module.css";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";
import { canvasGold, SELL_PRICE_PER_LEVEL, COMBO_PER_LINK } from "@/core/balance";
import { getCanvasGoldMultiplier, getPmMultiplier, getCanvasSize, getOfficeContribution } from "@/core/multipliers";
import { getEquippedContribution } from "@/store/workshopSlice";
import { getNodeLevel } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";

function sellHoverBody(_sizeLevel: number, comboChain: number): JSX.Element {
  const state = useGameStore.getState();
  const size = getCanvasSize(state);
  const goldMult = getCanvasGoldMultiplier(state);
  const pmMult = getPmMultiplier(state);
  const itemBonus = getEquippedContribution(state, "+sell_price%");
  const workerBonus = getOfficeContribution(state, "+sell_price%").toNumber();
  const rainbowLvl = getNodeLevel(state, "rainbow");
  const rainbowFactor = 1 + 0.50 * rainbowLvl;
  const sellPriceContribution = SELL_PRICE_PER_LEVEL * state.sellPriceLevel;
  const additiveTotal = goldMult / rainbowFactor - 1;
  const colorSum = additiveTotal - itemBonus - workerBonus - sellPriceContribution;
  const baseGold = 10 * size * size;
  const total = canvasGold(size, goldMult * pmMult).mul(1 + COMBO_PER_LINK * comboChain);
  return (
    <>
      <div>Base × size² = 10 × {size.toFixed(2)}² = {baseGold.toFixed(1)}</div>
      <div>───</div>
      <div>Sell Price (Lv {state.sellPriceLevel}): ×{(1 + sellPriceContribution).toFixed(2)}</div>
      <div>Items (sell):  ×{(1 + itemBonus).toFixed(2)}</div>
      <div>Workers:       ×{(1 + workerBonus).toFixed(2)}</div>
      <div>Colors:        ×{(1 + colorSum).toFixed(2)}</div>
      <div>Rainbow:       ×{rainbowFactor.toFixed(2)}</div>
      <div>Paint Mastery: ×{pmMult.toFixed(2)}</div>
      {comboChain > 0 ? <div>Combo:        ×{(1 + COMBO_PER_LINK * comboChain).toFixed(2)}</div> : null}
      <div>───</div>
      <div>Total: {formatBig(total)} g per canvas</div>
    </>
  );
}

interface Props {
  sizeLevel: number;
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
  0: "Sketch",
  1: "Apprentice",
  2: "Journeyman",
  3: "Adept",
  4: "Skilled",
  5: "Masterpiece",
  6: "Virtuoso",
  7: "Master",
  8: "Grandmaster",
  9: "Legendary",
  10: "Mythic",
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
  progressPct,
  timeElapsed,
  timeTotal,
  nextSaleGold,
  comboChain,
  isCrit,
  canvasNumber = 0,
}: Props): JSX.Element {
  const stageName = STAGE_NAMES[sizeLevel] ?? `Tier ${sizeLevel}`;
  const fillHeight = `${Math.max(0, Math.min(100, progressPct * 100))}%`;
  const barWidth = `${Math.max(0, Math.min(100, progressPct * 100))}%`;

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
        — Tier {sizeLevel} · {stageName} —
      </div>
      <div className={styles.frame}>
        {/* Pixel landscape inside the frame */}
        <svg
          viewBox="0 0 200 140"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          className={styles.canvasArt}
          aria-label={`Tier ${sizeLevel} pixel landscape`}
        >
          <defs>
            <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5a4a82" />
              <stop offset="1" stopColor="#a89cd6" />
            </linearGradient>
          </defs>
          <rect width="200" height="100" fill="url(#cs-sky)" />
          <polygon points="0,90 60,60 100,80 160,55 200,75 200,100 0,100" fill="#3a2e5a" />
          <rect width="200" height="40" y="100" fill="#2e4a3a" />
          <rect x="80" y="70" width="6" height="30" fill="#5a3a22" />
          <ellipse cx="83" cy="68" rx="14" ry="10" fill="#3a6a3a" />
          <ellipse cx="83" cy="65" rx="9" ry="6" fill="#5a8a4a" />
        </svg>

        {/* Paint-fill overlay — height controlled by progressPct */}
        <div
          key={`fill-${canvasNumber}`}
          className={styles.fill}
          data-testid="canvas-fill"
          style={{ height: fillHeight }}
          aria-hidden="true"
        />

        {/* Easel cap peeking from below (decorative trapezoid) */}
        <div className={styles.easel} aria-hidden="true" />
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
        <span className={styles.tierBadge}>Tier {sizeLevel}</span>
      </div>
    </section>
  );
}
