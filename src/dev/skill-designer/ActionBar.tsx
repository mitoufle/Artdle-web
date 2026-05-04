import type { JSX } from "react";
import styles from "./ActionBar.module.css";

export type ActionBarStatus = "saved" | "dirty" | "saving";

interface Props {
  status: ActionBarStatus;
  issueCount: number;
  onSave: () => void;
  onExport: () => void;
  onReset: () => void;
}

export function ActionBar({ status, issueCount, onSave, onExport, onReset }: Props): JSX.Element {
  function handleReset() {
    if (window.confirm("Reset the entire design? This cannot be undone.")) {
      onReset();
    }
  }

  let statusEl: JSX.Element;
  if (status === "saving") {
    statusEl = <span className={styles.statusSaving}>Saving…</span>;
  } else if (status === "dirty") {
    statusEl = <span className={styles.statusDirty}>● Unsaved changes</span>;
  } else {
    statusEl = <span className={styles.statusSaved}>✓ Saved</span>;
  }

  return (
    <header className={styles.bar}>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onSave}>
          Save to file
        </button>
        <button type="button" className={styles.secondary} onClick={onExport}>
          Export JSON
        </button>
        <button type="button" className={styles.danger} onClick={handleReset}>
          Reset
        </button>
      </div>
      <div className={styles.status}>
        {statusEl}
        {issueCount > 0 && (
          <span className={styles.issues}>⚠ {issueCount} issue{issueCount === 1 ? "" : "s"}</span>
        )}
      </div>
    </header>
  );
}
