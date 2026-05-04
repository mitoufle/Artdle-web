import type { JSX, ReactNode } from "react";
import styles from "./Cavern.module.css";

interface Props {
  children?: ReactNode;
}

const CRYSTAL_POSITIONS: ReadonlyArray<{ top: string; left: string; delay: string; size: number }> = [
  { top: "12%", left: "8%",  delay: "0s",   size: 18 },
  { top: "20%", left: "82%", delay: "0.6s", size: 14 },
  { top: "50%", left: "5%",  delay: "1.2s", size: 22 },
  { top: "70%", left: "78%", delay: "1.8s", size: 16 },
  { top: "85%", left: "20%", delay: "2.4s", size: 12 },
];

/**
 * Cavern backdrop for the AscensionRoute. Radial violet→black gradient +
 * repeating stone-block grid pattern + 5 floating purple-diamond crystals
 * (CSS clip-path) with staggered 3s opacity pulse animations.
 *
 * Children render inside the cavern (typically the Portal + overlays).
 */
export function Cavern({ children }: Props): JSX.Element {
  return (
    <div className={styles.cavern} aria-hidden="false">
      {CRYSTAL_POSITIONS.map((pos, idx) => (
        <div
          key={idx}
          className={styles.crystal}
          data-testid={`crystal-${idx}`}
          style={{
            top: pos.top,
            left: pos.left,
            width: `${pos.size}px`,
            height: `${pos.size * 1.4}px`,
            animationDelay: pos.delay,
          }}
        />
      ))}
      {children}
    </div>
  );
}
