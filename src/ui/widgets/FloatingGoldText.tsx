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
  return (
    <motion.div
      data-testid="floating-gold-text"
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: targetY, opacity: 0 }}
      transition={{ duration, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      style={{ pointerEvents: "none", position: "absolute", right: "0.75rem", top: "0.75rem" }}
    >
      +{formatBig(amount)}g
    </motion.div>
  );
}
