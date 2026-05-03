import type { JSX } from "react";
import styles from "./MetaChip.module.css";

const VERSION = "v2.0-dev";

export function MetaChip(): JSX.Element {
  return (
    <div className={styles.chip} aria-label="App version">
      <span>{VERSION}</span>
    </div>
  );
}
