import { useMemo, type JSX } from "react";
import { useGameStore } from "@/store";
import { getHireCost, getRosterCap } from "@/store/officeSlice";
import { formatBig } from "@/core/formatter";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";
import type { AffixKind } from "@/config/workshopAffixes";
import { AFFIX_SYMBOL, AFFIX_COLOR, AFFIX_SYMBOL_SCALE } from "@/config/workshopAffixes";
import { Hoverable } from "@/ui/widgets/Hoverable";
import type { Candidate } from "@/core/officeRoll";
import styles from "./OfficeRoom.module.css";

const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+sell_price%": (m) => `+${m}% sell price`,
  "+speed%": (m) => `+${m}% speed`,
  "+crit_chunks": (m) => `+${m} crit chunks`,
  "+combo_chance%": (m) => `+${m}% combo chance`,
};

const TIER_LABEL: Record<string, string> = {
  common: "Common",
  magic: "Magic",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

interface Props {
  readonly candidate: Candidate;
}

function candidateHoverBody(candidate: Candidate): JSX.Element {
  const s = useGameStore.getState();
  const cost = getHireCost(s, candidate);
  return (
    <>
      <div>{TIER_LABEL[candidate.tier]} {candidate.class}</div>
      <div>───</div>
      {candidate.affixes.map((a, i) => (
        <div key={i}>{AFFIX_LABEL[a.kind](a.magnitude)}</div>
      ))}
      <div>───</div>
      <div>Cost: {formatBig(cost)} g</div>
    </>
  );
}

export function QueueCard({ candidate }: Props): JSX.Element {
  const officeLevel = useGameStore((s) => s.officeLevel);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const cost = useMemo(
    () => getHireCost({ officeLevel, purchasedNodes }, candidate),
    [officeLevel, purchasedNodes, candidate],
  );
  const gold = useGameStore((s) => s.gold);
  const rosterLen = useGameStore((s) => s.roster.length);
  const rosterCap = useGameStore(getRosterCap);
  const hire = useGameStore((s) => s.hireFromQueue);
  const reject = useGameStore((s) => s.rejectFromQueue);

  const canAffordCost = gold.gte(cost);
  const hasSlot = rosterLen < rosterCap;

  return (
    <li>
      <Hoverable
        as="div"
        title={() => `${TIER_LABEL[candidate.tier]} ${candidate.class}`}
        body={() => candidateHoverBody(candidate)}
        footer={!canAffordCost ? "Not enough gold." : !hasSlot ? "Roster is full." : "Hire to add to roster."}
      >
        <article className={styles.card} data-tier={candidate.tier}>
          <div className={styles.cardHeader}>
            <span className={styles.className}>{candidate.class}</span>
            <span className={styles.tierTag}>{TIER_LABEL[candidate.tier]}</span>
          </div>
          <ul className={styles.affixList}>
            {candidate.affixes.map((a, i) => (
              <li key={i} className={styles.affixRow}>
                <span style={{ color: AFFIX_COLOR[a.kind], fontSize: `${11 * AFFIX_SYMBOL_SCALE[a.kind]}px` }}>{AFFIX_SYMBOL[a.kind]}</span>{" "}
                {AFFIX_LABEL[a.kind](a.magnitude)}
              </li>
            ))}
          </ul>
          <span className={styles.cost}><CurrencyAmount kind="gold" value={formatBig(cost)} /></span>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.hireBtn}
              disabled={!canAffordCost || !hasSlot}
              onClick={() => hire(candidate.id)}
            >
              Hire
            </button>
            <button
              type="button"
              className={styles.rejectBtn}
              onClick={() => reject(candidate.id)}
            >
              Reject
            </button>
          </div>
        </article>
      </Hoverable>
    </li>
  );
}
