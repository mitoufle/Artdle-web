import type { JSX } from "react";
import styles from "@/components/catchup/CatchupLoadingScene.module.css";

export function LoadingScreen(): JSX.Element {
  return (
    <div className={styles.scene}>
      <img src="/artdle_logo.png" alt="Artdle" className={styles.logo} />
    </div>
  );
}
