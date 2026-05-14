import type { JSX } from "react";
import type { Worker } from "@/store/officeSlice";
import type { AffixKind } from "@/config/workshopAffixes";
import { AFFIX_SYMBOL, AFFIX_COLOR } from "@/config/workshopAffixes";
import styles from "./OfficeRoom.module.css";

const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+sell_price%": (m) => `+${m}% sell price`,
  "+speed%": (m) => `+${m}% speed`,
  "+crit_chance%": (m) => `+${m}% crit chance`,
  "+combo_chance%": (m) => `+${m}% combo chance`,
  "+size%": (m) => `+${m}% size`,
};

const TIER_LABEL: Record<string, string> = {
  common: "Common",
  magic: "Magic",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

interface Props {
  readonly worker: Worker;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function FireConfirmModal({ worker, onConfirm, onCancel }: Props): JSX.Element {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalBody}>
        <h3 className={styles.modalTitle}>Fire this worker?</h3>
        <p className={styles.modalDesc}>
          {TIER_LABEL[worker.tier]} {worker.class} — Level {worker.level}
        </p>
        <ul className={styles.modalAffixes}>
          {worker.affixes.map((a, i) => (
            <li key={i} className={styles.modalAffixRow}>
              <span style={{ color: AFFIX_COLOR[a.kind] }}>{AFFIX_SYMBOL[a.kind]}</span>{" "}
              {AFFIX_LABEL[a.kind](a.magnitude)}
            </li>
          ))}
        </ul>
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.modalFireBtn} onClick={onConfirm}>
            Fire
          </button>
        </div>
      </div>
    </div>
  );
}
