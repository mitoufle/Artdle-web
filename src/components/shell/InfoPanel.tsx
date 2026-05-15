import type { JSX } from "react";
import { useGameStore } from "@/store";
import styles from "./InfoPanel.module.css";

export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);
  const idle = !title && !body && !footer;

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
