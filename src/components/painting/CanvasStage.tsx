import type { JSX } from "react";
import styles from "./CanvasStage.module.css";

interface Props {
  tier: number;
  progressPct: number;       // 0..1, drives the paint-fill overlay height
  timeRemaining: string;     // formatted seconds, e.g., "3.7"
  timeTotal: string;         // formatted seconds, e.g., "6.0"
  nextSaleGold: string;      // formatted gold preview, e.g., "184" or "1.2K"
}

const STAGE_NAMES: Record<number, string> = {
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
 * the TierCard in the upgrades strip below).
 */
export function CanvasStage({
  tier,
  progressPct,
  timeRemaining,
  timeTotal,
  nextSaleGold,
}: Props): JSX.Element {
  const stageName = STAGE_NAMES[tier] ?? `Tier ${tier}`;
  const fillHeight = `${Math.max(0, Math.min(100, progressPct * 100))}%`;
  const barWidth = `${Math.max(0, Math.min(100, progressPct * 100))}%`;

  return (
    <section className={styles.stage} aria-label="Canvas stage">
      <div className={styles.title}>
        — Tier {tier} · {stageName} —
      </div>
      <div className={styles.frame}>
        {/* Pixel landscape inside the frame */}
        <svg
          viewBox="0 0 200 140"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          className={styles.canvasArt}
          aria-label={`Tier ${tier} pixel landscape`}
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
        <div className={styles.progressFill} style={{ width: barWidth }} />
      </div>

      {/* Bottom info row */}
      <div className={styles.bottomRow}>
        <span className={styles.painting}>
          Painting · {timeRemaining}s / {timeTotal}s
        </span>
        <span className={styles.goldPreview}>+{nextSaleGold}g on next sale</span>
        <span className={styles.tierBadge}>Tier {tier}</span>
      </div>
    </section>
  );
}
