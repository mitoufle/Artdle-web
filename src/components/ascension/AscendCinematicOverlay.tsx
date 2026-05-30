import type { JSX } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatShort } from "@/core/formatter";
import { WorkerRollReveal } from "./WorkerRollReveal";
import styles from "./AscendCinematicOverlay.module.css";

export type CinematicPhase = "opening" | "blackout";

interface Props {
  phase: CinematicPhase | null;
  fameGain: number;
  quote: string;
  onDismiss: () => void;
}

export function AscendCinematicOverlay({
  phase,
  fameGain,
  quote,
  onDismiss,
}: Props): JSX.Element | null {
  const [skip, setSkip] = useState(false);
  const [revealDone, setRevealDone] = useState(false);

  // Reset before each blackout (during the opening / idle phases, when the
  // reveal is not mounted, so the child's onComplete can't race the reset).
  useEffect(() => {
    if (phase !== "blackout") {
      setSkip(false);
      setRevealDone(false);
    }
  }, [phase]);

  if (phase === null) return null;

  const isBlackout = phase === "blackout";
  const className = `${styles.root} ${isBlackout ? styles.blackout : styles.opening}`;

  const handleClick = (): void => {
    if (!isBlackout) return;
    if (!revealDone) setSkip(true); // 1st click: skip the animation to the end
    else onDismiss(); // 2nd click (or no level-ups): leave
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
          <WorkerRollReveal skip={skip} onComplete={() => setRevealDone(true)} />
          <p className={styles.hint} data-testid="ascend-cinematic-hint">
            {revealDone ? "— click to continue —" : "— click to skip —"}
          </p>
        </>
      )}
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
