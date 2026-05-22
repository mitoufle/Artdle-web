import { useEffect } from "react";
import type { JSX } from "react";
import { motion } from "motion/react";
import { formatBig } from "@/core/formatter";
import { formatElapsed } from "@/core/formatElapsed";
import type { CatchupResult } from "@/systems/catchup";
import styles from "./CatchupToast.module.css";

const HOLD_MS = 6000;

export function CatchupToast({
  result,
  onDismiss,
}: {
  result: CatchupResult;
  onDismiss: () => void;
}): JSX.Element {
  useEffect(() => {
    const t = setTimeout(onDismiss, HOLD_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      className={styles.toast}
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", stiffness: 250, damping: 28 }}
      role="status"
      aria-live="polite"
    >
      <div className={styles.title}>
        ⏱ Welcome back ({formatElapsed(result.elapsedSeconds)} away)
      </div>
      <div className={styles.body}>
        +{formatBig(result.goldGained)} gold · +{formatBig(result.inspiGained)} inspi · {result.canvasesSold} canvases
      </div>
    </motion.div>
  );
}
