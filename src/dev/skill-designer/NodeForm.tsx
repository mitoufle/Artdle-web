import type { JSX } from "react";
import type { DesignNode, NodeKind, StackingMode } from "./types";
import { SKILL_CLUSTERS } from "@/config/skillClusters";
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
        <span className={styles.label}>Cluster</span>
        <select
          className={styles.input}
          aria-label="Cluster"
          value={node.clusterId}
          onChange={(e) => patch({ clusterId: e.target.value })}
        >
          {SKILL_CLUSTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Parents (multi-select)</span>
        <div className={styles.parentList}>
          {allNodes
            .filter((n) => n.id !== node.id)
            .map((n) => {
              const isParent = node.parentIds.includes(n.id);
              return (
                <label key={n.id} className={styles.parentRow}>
                  <input
                    type="checkbox"
                    checked={isParent}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...node.parentIds, n.id]
                        : node.parentIds.filter((p) => p !== n.id);
                      patch({ parentIds: next });
                    }}
                  />
                  <span className={styles.parentLabel}>
                    {n.name} <span className={styles.subLabel}>({n.id})</span>
                  </span>
                </label>
              );
            })}
        </div>
        {node.parentIds.length === 0 && (
          <span className={styles.subLabel}>No parents — this node is its cluster's root.</span>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Stacking</span>
        <div className={styles.stackingRow}>
          <label className={styles.stackingOption}>
            <input
              type="radio"
              name={`stacking-${node.id}`}
              checked={node.stacking === "additive"}
              onChange={() => patch({ stacking: "additive" as StackingMode })}
            />
            <span>Additive</span>
          </label>
          <label className={styles.stackingOption}>
            <input
              type="radio"
              name={`stacking-${node.id}`}
              checked={node.stacking === "multiplicative"}
              onChange={() => patch({ stacking: "multiplicative" as StackingMode })}
            />
            <span>Multiplicative</span>
          </label>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Kind</span>
        <div className={styles.stackingRow}>
          <label className={styles.stackingOption}>
            <input
              type="radio"
              name={`kind-${node.id}`}
              checked={node.kind === "minor"}
              onChange={() => patch({ kind: "minor" as NodeKind })}
            />
            <span>Minor</span>
          </label>
          <label className={styles.stackingOption}>
            <input
              type="radio"
              name={`kind-${node.id}`}
              checked={node.kind === "major"}
              onChange={() => patch({ kind: "major" as NodeKind })}
            />
            <span>Major</span>
          </label>
        </div>
      </div>

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

      <div className={styles.field}>
        <span className={styles.label}>Unlocks (capability tags)</span>
        <input
          className={styles.input}
          type="text"
          placeholder="canvas_crit, canvas_combo, …"
          value={(node.unlocks ?? []).join(", ")}
          onChange={(e) => {
            const raw = e.target.value;
            const tags = raw
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            patch({ unlocks: tags });
          }}
        />
        <div className={styles.capabilityHints}>
          {(["canvas_crit", "canvas_combo", "palette_slot", "roster_slot", "queue_slot", "class_goldsmith", "class_speedrunner"] as const).map(
            (cap) => {
              const labels: Record<string, string> = {
                canvas_crit: "Canvas Crit",
                canvas_combo: "Canvas Combo",
                palette_slot: "Palette Slot",
                roster_slot: "Roster Slot",
                queue_slot: "Queue Slot",
                class_goldsmith: "Class: Goldsmith",
                class_speedrunner: "Class: Speedrunner",
              };
              return (
                <button
                  key={cap}
                  type="button"
                  className={styles.capabilityChip}
                  onClick={() => {
                    const current = node.unlocks ?? [];
                    if (!current.includes(cap)) {
                      patch({ unlocks: [...current, cap] });
                    }
                  }}
                >
                  {labels[cap]}
                </button>
              );
            },
          )}
        </div>
        <span className={styles.subLabel}>
          Comma-separated. Click a chip to add. Engine reads these, not node IDs.
        </span>
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
