import type { JSX } from "react";
import type { DesignCluster, DesignNode } from "./types";
import styles from "./NodeForm.module.css";

interface Props {
  cluster: DesignCluster | null;
  members: ReadonlyArray<DesignNode>;
  onChange: (id: string, patch: Partial<DesignCluster>) => void;
  onDelete: (id: string) => void;
}

export function ClusterForm({ cluster, members, onChange, onDelete }: Props): JSX.Element {
  if (cluster === null) {
    return (
      <aside className={styles.form} aria-label="Cluster form">
        <p className={styles.placeholder}>Select a cluster or click + Add Cluster</p>
      </aside>
    );
  }

  const patch = (p: Partial<DesignCluster>) => onChange(cluster.id, p);

  return (
    <aside className={styles.form} aria-label="Cluster form">
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          type="text"
          value={cluster.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>ID (slug)</span>
        <input
          className={styles.input}
          type="text"
          value={cluster.id}
          disabled
          readOnly
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Theme</span>
        <input
          className={styles.input}
          type="text"
          value={cluster.theme}
          onChange={(e) => patch({ theme: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Cluster root</span>
        <select
          className={styles.input}
          aria-label="Cluster root"
          value={cluster.rootNodeId}
          onChange={(e) => patch({ rootNodeId: e.target.value })}
        >
          <option value="">— pick a root —</option>
          {members.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({n.id})
            </option>
          ))}
        </select>
        <span className={styles.subLabel}>
          The root must be the cluster&apos;s only node with no parents.
        </span>
      </label>

      <button
        type="button"
        className={styles.dangerBtn}
        onClick={() => {
          if (window.confirm(`Delete cluster "${cluster.name}"? Its nodes move to another cluster.`)) {
            onDelete(cluster.id);
          }
        }}
      >
        Delete cluster
      </button>
    </aside>
  );
}
