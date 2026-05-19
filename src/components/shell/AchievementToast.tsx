import type { JSX } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "@/store";
import type { AchievementCategory } from "@/config/achievementConfig";
import styles from "./AchievementToast.module.css";

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  canvas: "Canvas",
  workshop: "Workshop",
  ascension: "Ascension",
  school_office: "School & Office",
  secret: "Secret",
};

export function AchievementToast(): JSX.Element {
  const notification = useGameStore((s) => s.activeNotification);

  return (
    <div className={styles.anchor} aria-live="polite">
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification.id}
            className={styles.card}
            initial={{ y: "-130%", scale: 0.7, opacity: 0 }}
            animate={{
              y: 0,
              scale: 1,
              opacity: 1,
              transition: { type: "spring", stiffness: 420, damping: 22, mass: 0.8 },
            }}
            exit={{
              scaleX: 0.04,
              scaleY: 0.04,
              x: "60%",
              y: "-40%",
              rotate: 8,
              opacity: 0,
              transition: { duration: 0.45, ease: [0.55, 0, 1, 0.45] },
            }}
            style={{ transformOrigin: "top right" }}
            role="status"
          >
            <span className={styles.eyebrow}>✦ Achievement Unlocked ✦</span>
            <div className={styles.row}>
              <motion.span
                className={styles.icon}
                initial={{ scale: 0, rotate: -45 }}
                animate={{
                  scale: 1,
                  rotate: 0,
                  transition: { delay: 0.12, type: "spring", stiffness: 500, damping: 14 },
                }}
              >
                {notification.icon}
              </motion.span>
              <div className={styles.text}>
                <span className={styles.name}>{notification.name}</span>
                <span className={styles.category}>
                  {CATEGORY_LABEL[notification.category]}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
