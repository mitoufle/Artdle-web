import type { JSX } from "react";
import { useGameStore } from "@/store";
import styles from "./InfoPanel.module.css";

/**
 * Info strip rendered between PaintingView/etc. and the BottomBar.
 * Pulls live hover-info state from `hoverInfoSlice` (existing). Title in
 * Cinzel, body and footer in mono. When no hover is active, renders a
 * placeholder div so layout doesn't shift (handoff §IA: fixed-height strip).
 */
export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);

  return (
    <aside className={styles.panel} role="complementary">
      {title && <div className={styles.title}>{title}</div>}
      {body && <div className={styles.body}>{body}</div>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </aside>
  );
}
