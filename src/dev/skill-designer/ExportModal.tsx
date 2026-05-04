import type { JSX } from "react";
import type { DesignFile } from "./types";
import styles from "./ExportModal.module.css";

interface Props {
  open: boolean;
  design: DesignFile;
  onClose: () => void;
}

export function ExportModal({ open, design, onClose }: Props): JSX.Element | null {
  if (!open) return null;
  const json = JSON.stringify(design, null, 2);
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Export design as JSON">
      <div className={styles.modal}>
        <h3 className={styles.title}>Export design as JSON</h3>
        <label className={styles.label}>
          <span className={styles.labelText}>JSON</span>
          <textarea
            className={styles.textarea}
            readOnly
            value={json}
            rows={20}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </label>
        <div className={styles.footer}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
