import type { JSX } from "react";
import type { DesignCluster } from "./types";
import styles from "./NodeListRail.module.css";

interface Props {
  clusters: ReadonlyArray<DesignCluster>;
  selectedClusterId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ClusterListRail({ clusters, selectedClusterId, onSelect, onAdd }: Props): JSX.Element {
  return (
    <aside className={styles.rail} aria-label="Cluster list">
      <button type="button" className={styles.addBtn} data-testid="add-cluster" onClick={onAdd}>
        + Add Cluster
      </button>
      <ul className={styles.list}>
        {clusters.map((c) => (
          <li
            key={c.id}
            className={styles.row}
            data-testid={`cluster-list-row-${c.id}`}
            data-selected={selectedClusterId === c.id ? "true" : undefined}
            onClick={() => onSelect(c.id)}
          >
            <span className={styles.name}>{c.name}</span>
            <span className={styles.pill}>{c.id}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
