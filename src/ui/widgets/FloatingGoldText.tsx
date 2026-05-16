import type { JSX } from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatBig } from "@/core/formatter";
import type { Big } from "@/core/bigNumber";

interface Props {
  amount: Big;
  onComplete: () => void;
}

const ANIM_DURATION_S = 0.8;
const REDUCED_DURATION_S = 0.01;
const RISE_DISTANCE_PX = 40;
// log10 value at which size and color reach maximum intensity (1 million gold)
const MAX_LOG = 6;

function goldIntensity(amount: Big): number {
  if (!amount.gt(0)) return 0;
  return Math.min(1, Math.max(0, amount.log10().toNumber()) / MAX_LOG);
}

/**
 * One-shot floating "+Ng" text that rises and fades on canvas sale.
 *
 * @invariant Designed as a single-mount component — caller controls lifetime
 * via React keys (mount = animation start). When the animation completes,
 * `onComplete` fires; caller is expected to unmount this component (typically
 * by clearing the trigger state). prefers-reduced-motion suppresses the rise
 * + extends opacity decay across REDUCED_DURATION_S so onComplete still fires
 * promptly.
 */
export function FloatingGoldText({ amount, onComplete }: Props): JSX.Element {
  const reduce = useReducedMotion();
  const duration = reduce ? REDUCED_DURATION_S : ANIM_DURATION_S;
  const targetY = reduce ? 0 : -RISE_DISTANCE_PX;

  const t = goldIntensity(amount);
  // 0.875rem → 2.5rem
  const fontSize = `${(0.875 + t * 1.625).toFixed(3)}rem`;
  // white (hsl 0,0%,100%) → red (hsl 0,85%,60%)
  const saturation = Math.round(t * 85);
  const lightness = Math.round(100 - t * 40);
  const color = `hsl(0, ${saturation}%, ${lightness}%)`;

  return (
    <motion.div
      data-testid="floating-gold-text"
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: targetY, opacity: 0 }}
      transition={{ duration, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      style={{
        pointerEvents: "none",
        position: "absolute",
        right: "0.75rem",
        top: "0.75rem",
        fontSize,
        color,
        fontWeight: "bold",
        textShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }}
    >
      +{formatBig(amount)}g
    </motion.div>
  );
}
