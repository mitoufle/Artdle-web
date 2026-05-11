import { useState, type JSX } from "react";
import { useGameStore } from "@/store";
import { workerXpToNext, levelScale } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import type { AffixKind } from "@/config/workshopAffixes";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { FireConfirmModal } from "./FireConfirmModal";
import type { Worker } from "@/store/officeSlice";
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
}

function workerHoverBody(worker: Worker): JSX.Element {
  const scale = levelScale(worker.level).toNumber();
  const nextCost = workerXpToNext(worker.level);
  return (
    <>
      <div>Lv {worker.level} — scale ×{scale.toFixed(2)}</div>
      <div>XP: {formatBig(worker.xp)} / {formatBig(nextCost)}</div>
      <div>───</div>
      {worker.affixes.map((a, i) => {
        const scaled = (a.magnitude * scale).toFixed(1);
        return (
          <div key={i}>
            {AFFIX_LABEL[a.kind](a.magnitude)} → {scaled}% at this level
          </div>
        );
      })}
    </>
  );
}

export function WorkerCard({ worker }: Props): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const fire = useGameStore((s) => s.fireWorker);

  const nextLevelCost = workerXpToNext(worker.level);
  const xpPct = Math.min(100, worker.xp.div(nextLevelCost).toNumber() * 100);
  const scale = levelScale(worker.level).toNumber();

  return (
    <li>
      <Hoverable
        as="div"
        title={() => `${TIER_LABEL[worker.tier]} ${worker.class} — Lv ${worker.level}`}
        body={() => workerHoverBody(worker)}
        footer="Workers level up as you sell canvases."
      >
        <article className={styles.card} data-tier={worker.tier}>
          <div className={styles.cardHeader}>
            <span className={styles.className}>{worker.class}</span>
            <span className={styles.tierTag}>{TIER_LABEL[worker.tier]}</span>
            <span className={styles.levelBadge}>Lv {worker.level}</span>
          </div>
          <div className={styles.workerXpStrip}>
            <div className={styles.workerXpBar}>
              <div className={styles.workerXpFill} style={{ width: `${xpPct}%` }} />
            </div>
            <span>{formatBig(worker.xp)} / {formatBig(nextLevelCost)}</span>
          </div>
          <ul className={styles.affixList}>
            {worker.affixes.map((a, i) => (
              <li key={i} className={styles.affixRow}>
                {AFFIX_LABEL[a.kind](parseFloat((a.magnitude * scale).toFixed(1)))}
              </li>
            ))}
          </ul>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.fireBtn}
              onClick={() => setConfirming(true)}
            >
              Fire
            </button>
          </div>
        </article>
      </Hoverable>
      {confirming && (
        <FireConfirmModal
          worker={worker}
          onConfirm={() => { fire(worker.id); setConfirming(false); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
