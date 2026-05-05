import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import styles from "./NodeCard.module.css";

interface Props {
  nodeId: SkillNodeId;
  name: string;
  description: string;
  numericEffect: string;
  currentLevel: number;
  maxLevel: number;
  /** Cost of buying the next level. null when maxed. */
  nextCost: number | null;
  prereqMet: boolean;
  affordable: boolean;
  onAcquire: () => void;
}

export function NodeCard({
  nodeId,
  name,
  description,
  numericEffect,
  currentLevel,
  maxLevel,
  nextCost,
  prereqMet,
  affordable,
  onAcquire,
}: Props): JSX.Element {
  const owned = currentLevel > 0;
  const maxed = currentLevel >= maxLevel;
  const canAcquire = !maxed && prereqMet && affordable;

  const levelLabel = maxLevel > 1 ? `Level ${currentLevel} / ${maxLevel}` : (owned ? "Owned" : "Not owned");

  let prereqText: string;
  if (maxed) prereqText = "maxed ✓";
  else if (!prereqMet) prereqText = "prereq locked";
  else if (!affordable) prereqText = "insufficient fame";
  else prereqText = "ready";

  let buttonLabel: string;
  if (maxed) buttonLabel = "✦ Maxed";
  else if (currentLevel === 0) buttonLabel = `✦ Acquire · ${nextCost ?? "?"} fame`;
  else buttonLabel = `✦ Upgrade · ${nextCost ?? "?"} fame`;

  return (
    <aside className={styles.card} aria-label={`Node detail · ${name}`} data-node-id={nodeId}>
      <h3 className={styles.title}>{name}</h3>
      <div className={styles.meta}>
        {levelLabel} · {prereqText}
      </div>
      <p className={styles.effect}>{numericEffect}</p>
      <p className={styles.description}>{description}</p>
      <button
        type="button"
        className={styles.acquireBtn}
        disabled={!canAcquire}
        onClick={canAcquire ? onAcquire : undefined}
        data-testid={`node-acquire-${nodeId}`}
      >
        {buttonLabel}
      </button>
    </aside>
  );
}
