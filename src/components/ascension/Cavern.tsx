import type { JSX, ReactNode } from "react";
import { useEffect, useRef } from "react";
import styles from "./Cavern.module.css";
import gateLoopVideo from "@/assets/images/ascend gate/gate_animated.mp4";
import gateOpeningVideo from "@/assets/images/ascend gate/gate_opening_animated.mp4";

export type CavernPhase = "idle" | "opening";

interface Props {
  /** "idle" loops the closed-gate video; "opening" plays the gate-opening video once. */
  phase?: CavernPhase;
  /** Fires when the gate-opening video reaches its natural end (only in "opening" phase). */
  onOpeningEnded?: () => void;
  children?: ReactNode;
}

/**
 * Ascension scene container. Renders one of two gate videos as a full-area
 * looping muted backdrop. `phase` selects which video — `idle` loops the
 * closed-gate animation; `opening` plays the gate-opening animation once and
 * fires `onOpeningEnded` on completion. Children render on top (typically the
 * Step Through CTA). Pauses on `prefers-reduced-motion`.
 */
export function Cavern({ phase = "idle", onOpeningEnded, children }: Props): JSX.Element {
  const isOpening = phase === "opening";
  const src = isOpening ? gateOpeningVideo : gateLoopVideo;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) videoRef.current?.pause();
  }, [phase]);

  return (
    <div className={styles.cavern}>
      <video
        // key={src} forces a remount when the phase changes so the new video
        // plays cleanly from frame 0 with the right loop/onEnded wiring.
        key={src}
        ref={videoRef}
        className={styles.video}
        src={src}
        autoPlay
        loop={!isOpening}
        muted
        playsInline
        aria-label={isOpening ? "Gate opening" : "Ascension gate"}
        data-testid="cavern-video"
        data-phase={phase}
        onEnded={isOpening ? onOpeningEnded : undefined}
      />
      {children}
    </div>
  );
}
