import type { JSX } from "react";
import styles from "./ClusterList.module.css";

export interface ClusterRow {
  id: string;
  name: string;
  owned: number;
  total: number;
  complete: boolean;
}

interface Props {
  rows: ReadonlyArray<ClusterRow>;
}

export function ClusterList({ rows }: Props): JSX.Element {
  return (
    <section className={styles.panel} aria-label="Clusters">
      <div className={styles.subhead}>Constellations</div>
      <ul className={styles.list}>
        {rows.map((r) => (
          <li
            key={r.id}
            className={styles.row}
            data-testid={`cluster-row-${r.id}`}
            data-complete={r.complete ? "true" : "false"}
          >
            <span className={styles.name}>
              <span>{r.name}</span>
              {r.complete ? <span aria-label="complete"> ★</span> : null}
            </span>
            <span className={styles.count}>
              {r.owned} / {r.total}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
