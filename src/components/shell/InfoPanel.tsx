import type { JSX } from "react";
import { useGameStore } from "@/store";
import { ScalingMathPanel } from "./ScalingMathPanel";
import styles from "./InfoPanel.module.css";

/**
 * Info strip rendered between PaintingView/etc. and the BottomBar.
 *
 * Left column (`hoverColumn`) pulls live hover-info state from `hoverInfoSlice`.
 * Title in Cinzel, body and footer in mono. When no hover is active, renders an
 * empty placeholder so layout doesn't shift (handoff §IA: fixed-height strip).
 *
 * Right column is a persistent `<ScalingMathPanel />` cheat sheet of the key
 * formulas and current scaling values.
 */
export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);

  return (
    <aside className={styles.panel} role="complementary">
      <div className={styles.hoverColumn} data-testid="info-panel-hover">
        {title && <div className={styles.title}>{title}</div>}
        {body && <div className={styles.body}>{body}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      <ScalingMathPanel />
    </aside>
  );
}
