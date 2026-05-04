import type { JSX } from "react";
import styles from "./ClusterList.module.css";

interface Props {
  ownedCount: number;
  totalCount: number;
}

export function ClusterList({ ownedCount, totalCount }: Props): JSX.Element {
  return (
    <section className={styles.panel} aria-label="Clusters">
      <div className={styles.subhead}>Jump to cluster</div>
      <ul className={styles.list}>
        <li className={styles.row}>
          <span className={styles.name}>Starters</span>
          <span className={styles.count}>
            {ownedCount} / {totalCount}
          </span>
        </li>
      </ul>
    </section>
  );
}
