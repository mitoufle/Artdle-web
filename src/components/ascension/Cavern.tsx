import type { JSX, ReactNode } from "react";
import { useEffect, useRef } from "react";
import styles from "./Cavern.module.css";
import gateVideo from "@/assets/images/ascend gate/gate_animated.mp4";

interface Props {
  children?: ReactNode;
}

/**
 * Ascension scene container. Renders the gate animation (cavern + arch +
 * floating crystals — all in the video) as a looping muted backdrop that
 * fills the layout area. Children render on top (typically the Step Through
 * CTA). Pauses the video when `prefers-reduced-motion` is set.
 */
export function Cavern({ children }: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) videoRef.current?.pause();
  }, []);

  return (
    <div className={styles.cavern}>
      <video
        ref={videoRef}
        className={styles.video}
        src={gateVideo}
        autoPlay
        loop
        muted
        playsInline
        aria-label="Ascension gate"
        data-testid="cavern-video"
      />
      {children}
    </div>
  );
}
