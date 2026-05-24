import type { JSX } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatShort } from "@/core/formatter";
import styles from "./AscendCinematicOverlay.module.css";

export type CinematicPhase = "opening" | "blackout";

interface Props {
  /**
   * `"opening"` renders a transparent full-viewport click blocker so the gate
   * video plays without the player navigating away. `"blackout"` fades the
   * screen to black and shows the fame gain + quote, dismissible by click.
   * `null` renders nothing.
   */
  phase: CinematicPhase | null;
  fameGain: number;
  quote: string;
  onDismiss: () => void;
}

const HINT_DELAY_MS = 4000;

export function AscendCinematicOverlay({
  phase,
  fameGain,
  quote,
  onDismiss,
}: Props): JSX.Element | null {
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (phase !== "blackout") {
      setHintVisible(false);
      return;
    }
    const t = window.setTimeout(() => setHintVisible(true), HINT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === null) return null;

  const isBlackout = phase === "blackout";
  const className = `${styles.root} ${isBlackout ? styles.blackout : styles.opening}`;

  const handleClick = () => {
    if (isBlackout) onDismiss();
  };

  const node = (
    <div
      className={className}
      onClick={handleClick}
      data-testid="ascend-cinematic-overlay"
      data-phase={phase}
      role={isBlackout ? "button" : undefined}
      aria-label={isBlackout ? "Continue past ascension summary" : undefined}
    >
      {isBlackout && (
        <>
          <p className={styles.gain} data-testid="ascend-cinematic-gain">
            +{formatShort(fameGain)} fame gained
          </p>
          <p className={styles.quote} data-testid="ascend-cinematic-quote">
            {quote}
          </p>
          {hintVisible && (
            <p className={styles.hint} data-testid="ascend-cinematic-hint">
              — click to continue —
            </p>
          )}
        </>
      )}
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
