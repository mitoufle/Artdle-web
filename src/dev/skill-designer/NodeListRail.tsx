import type { JSX } from "react";
import { useState } from "react";
import type { DesignNode } from "./types";
import styles from "./NodeListRail.module.css";

interface Props {
  nodes: ReadonlyArray<DesignNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function NodeListRail({ nodes, selectedId, onSelect, onAdd }: Props): JSX.Element {
  const [filter, setFilter] = useState("");
  const filtered = nodes.filter((n) =>
    n.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <aside className={styles.rail} aria-label="Node list">
      <button type="button" className={styles.addBtn} onClick={onAdd}>
        + Add Node
      </button>
      <input
        className={styles.search}
        type="text"
        placeholder="Search…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className={styles.list}>
        {filtered.map((node) => (
          <li
            key={node.id}
            className={styles.row}
            data-testid={`node-row-${node.id}`}
            data-selected={selectedId === node.id ? "true" : undefined}
            onClick={() => onSelect(node.id)}
          >
            <span className={styles.name}>{node.name}</span>
            <span className={styles.pill}>
              {node.maxLevel} {node.maxLevel === 1 ? "lvl" : "lvls"}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
