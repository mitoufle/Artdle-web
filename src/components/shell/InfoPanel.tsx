import type { JSX } from "react";
import { motion } from "motion/react";
import { useGameStore } from "@/store";
import styles from "./InfoPanel.module.css";

export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);
  const notification = useGameStore((s) => s.activeNotification);

  const idle = !notification && !title && !body && !footer;

  if (notification) {
    const rewardText = notification.effects
      .map((e) => {
        if (e.kind === "paint_mastery_flat") return `+${e.value} PM`;
        if (e.kind === "canvas_gold_pct") return `+${Math.round(e.value * 100)}% gold`;
        if (e.kind === "speed_pct") return `+${Math.round(e.value * 100)}% speed`;
        if (e.kind === "inspi_pct") return `+${Math.round(e.value * 100)}% inspi`;
        return `+${e.value} ${e.kind}`;
      })
      .join(" · ");

    return (
      <aside className={styles.panel} role="complementary">
        <div className={styles.titleZone}>
          <span className={`${styles.title} ${styles.notificationTitle}`}>
            {notification.icon} {notification.name}
          </span>
        </div>
        <motion.div
          className={styles.bodyZone}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
        >
          {rewardText}
        </motion.div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel} role="complementary">
      {idle ? (
        <div className={styles.idle}>hover items to inspect</div>
      ) : (
        <>
          {title && (
            <div className={styles.titleZone}>
              <span className={styles.title}>{title}</span>
            </div>
          )}
          <div className={styles.bodyZone} data-testid="info-panel-hover">
            {body}
          </div>
          {footer && (
            <div className={styles.footerZone}>{footer}</div>
          )}
        </>
      )}
    </aside>
  );
}
