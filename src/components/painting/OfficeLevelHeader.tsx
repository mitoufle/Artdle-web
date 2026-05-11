import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getOfficeTierCap } from "@/store/officeSlice";
import { officeXpToNext, trickleSeconds, OFFICE_TIER_UNLOCK_LEVEL, ALL_WORKER_TIERS } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";
import styles from "./OfficeRoom.module.css";

const TIER_LABEL: Record<string, string> = {
  common: "Common",
  magic: "Magic",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

function levelHoverBody(): JSX.Element {
  const s = useGameStore.getState();
  const lvl = s.officeLevel;
  const xp = s.officeXp;
  const nextCost = officeXpToNext(lvl);
  return (
    <>
      <div>XP: {formatBig(xp)} / {formatBig(nextCost)}</div>
      <div>───</div>
      <div>Tier unlocks:</div>
      {ALL_WORKER_TIERS.filter((t) => t !== "common").map((t) => {
        const unlock = OFFICE_TIER_UNLOCK_LEVEL[t];
        return (
          <div key={t}>
            {TIER_LABEL[t]} at Lv {unlock}{lvl >= unlock ? " ✓" : ""}
          </div>
        );
      })}
    </>
  );
}

export function OfficeLevelHeader(): JSX.Element {
  const officeLevel = useGameStore((s) => s.officeLevel);
  const officeXp = useGameStore((s) => s.officeXp);
  const tierCap = useGameStore(getOfficeTierCap);

  const nextLevelCost = officeXpToNext(officeLevel);
  const xpPct = Math.min(100, officeXp.div(nextLevelCost).toNumber() * 100);
  const trickle = trickleSeconds(officeLevel);

  return (
    <Hoverable
      as="div"
      title={() => `Office Lv ${useGameStore.getState().officeLevel}`}
      body={() => levelHoverBody()}
      footer="XP awarded from canvas sales, split across all workers."
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Office</h2>
        <div className={styles.levelStrip}>
          <span className={styles.levelLabel}>Lv {officeLevel}</span>
          <div className={styles.xpBar}>
            <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
          </div>
          <span className={styles.xpReadout}>
            {formatBig(officeXp)} / {formatBig(nextLevelCost)}
          </span>
        </div>
        <div className={styles.meta}>
          <span>Up to {TIER_LABEL[tierCap]}</span>
          <span>~{trickle.toFixed(1)}s / candidate</span>
        </div>
      </header>
    </Hoverable>
  );
}
