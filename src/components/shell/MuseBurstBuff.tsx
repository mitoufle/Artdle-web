import type { JSX } from "react";
import { useGameStore } from "@/store";
import { MUSE_BURST_DURATION_S, MUSE_BURST_INSPI_MULT } from "@/core/skillTreeTickPure";
import styles from "./MuseBurstBuff.module.css";

/**
 * Transient buff pill shown while Muse Burst is active (museBurstTimer > 0).
 * Lives in the BottomBar next to the currency chips so it's visible on every
 * route. Subscribes only to museBurstTimer — which the tick stops writing once
 * it hits 0 — so this re-renders each frame only while the buff is running.
 */
export function MuseBurstBuff(): JSX.Element | null {
  const timer = useGameStore((s) => s.museBurstTimer);
  if (timer <= 0) return null;

  const remaining = Math.ceil(timer);
  const fraction = Math.max(0, Math.min(1, timer / MUSE_BURST_DURATION_S));

  return (
    <div
      className={styles.buff}
      data-testid="muse-burst-buff"
      role="status"
      aria-label={`Muse Burst active: ×${MUSE_BURST_INSPI_MULT} inspiration, ${remaining} seconds remaining`}
    >
      <span className={styles.mult}>×{MUSE_BURST_INSPI_MULT}</span>
      <span className={styles.label}>Muse Burst</span>
      <span className={styles.time}>{remaining}s</span>
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: `${fraction * 100}%` }} />
      </span>
    </div>
  );
}
