import type { JSX } from "react";
import type { DesignNode } from "./types";
import styles from "./NodeForm.module.css";

interface Props {
  node: DesignNode | null;
  allNodes: ReadonlyArray<DesignNode>;
  onChange: (id: string, patch: Partial<DesignNode>) => void;
  onDelete: (id: string) => void;
}

export function NodeForm({ node, allNodes, onChange, onDelete }: Props): JSX.Element {
  if (node === null) {
    return (
      <aside className={styles.form} aria-label="Node form">
        <p className={styles.placeholder}>Select a node or click + Add Node</p>
      </aside>
    );
  }

  function patch(p: Partial<DesignNode>) {
    onChange(node!.id, p);
  }

  function changeMaxLevel(newMax: number) {
    if (newMax < 1 || newMax > 10) return;
    const oldCosts = node!.costs;
    let newCosts: number[];
    if (newMax > oldCosts.length) {
      newCosts = [...oldCosts, ...Array(newMax - oldCosts.length).fill(0)];
    } else {
      newCosts = oldCosts.slice(0, newMax);
    }
    patch({ maxLevel: newMax, costs: newCosts });
  }

  function changeCost(level: number, value: number) {
    const newCosts = [...node!.costs];
    newCosts[level] = value;
    patch({ costs: newCosts });
  }

  return (
    <aside className={styles.form} aria-label="Node form">
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          type="text"
          value={node.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>ID (slug)</span>
        <input
          className={styles.input}
          type="text"
          value={node.id}
          onChange={(e) => patch({ id: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Parent</span>
        <select
          className={styles.input}
          value={node.parentId ?? ""}
          onChange={(e) => patch({ parentId: e.target.value === "" ? null : e.target.value })}
        >
          <option value="">(FAME root)</option>
          {allNodes
            .filter((n) => n.id !== node.id)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.id})
              </option>
            ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Max level</span>
        <input
          className={styles.input}
          type="number"
          min={1}
          max={10}
          value={node.maxLevel}
          onChange={(e) => changeMaxLevel(parseInt(e.target.value, 10) || 1)}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Costs (per level)</span>
        {node.costs.map((cost, i) => (
          <label key={i} className={styles.subField}>
            <span className={styles.subLabel}>Lvl {i + 1} cost</span>
            <input
              className={styles.input}
              type="number"
              value={cost}
              onChange={(e) => changeCost(i, parseInt(e.target.value, 10) || 0)}
            />
          </label>
        ))}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Numeric effect</span>
        <input
          className={styles.input}
          type="text"
          value={node.numericEffect}
          onChange={(e) => patch({ numericEffect: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <textarea
          className={styles.textarea}
          rows={4}
          value={node.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Position</span>
        {node.position !== null ? (
          <>
            <span className={styles.posReadout}>
              x: {Math.round(node.position.x)} · y: {Math.round(node.position.y)}
            </span>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => patch({ position: null })}
            >
              Reset position
            </button>
          </>
        ) : (
          <span className={styles.posReadout}>auto</span>
        )}
      </div>

      <button
        type="button"
        className={styles.dangerBtn}
        onClick={() => {
          if (window.confirm(`Delete "${node.name}"? Children become roots.`)) {
            onDelete(node.id);
          }
        }}
      >
        Delete node
      </button>
    </aside>
  );
}
