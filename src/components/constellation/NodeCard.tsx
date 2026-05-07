import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { Hoverable } from "@/ui/widgets/Hoverable";
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

interface NodeCardHoverProps {
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  nextCost: number | null;
  prereqMet: boolean;
  affordable: boolean;
}

function nodeCardHoverBody(p: NodeCardHoverProps): JSX.Element {
  const maxed = p.currentLevel >= p.maxLevel;
  if (maxed) return <div>{p.name} is fully upgraded.</div>;
  const lockedHint = !p.prereqMet
    ? "Locked: prerequisites not met."
    : !p.affordable
      ? "Need more fame."
      : null;
  return (
    <>
      <div>Cost: {p.nextCost ?? "?"} fame</div>
      <div>Level: {p.currentLevel} / {p.maxLevel}</div>
      <div>───</div>
      <div>{p.description}</div>
      {lockedHint && <div>{lockedHint}</div>}
    </>
  );
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

  const hoverTitle = (): string => {
    if (currentLevel >= maxLevel) return `${name} (Maxed)`;
    if (currentLevel > 0) return `Upgrade ${name}`;
    return `Acquire ${name}`;
  };

  return (
    <aside className={styles.card} aria-label={`Node detail · ${name}`} data-node-id={nodeId}>
      <h3 className={styles.title}>{name}</h3>
      <div className={styles.meta}>
        {levelLabel} · {prereqText}
      </div>
      <p className={styles.effect}>{numericEffect}</p>
      <p className={styles.description}>{description}</p>
      <Hoverable
        title={hoverTitle}
        body={() => nodeCardHoverBody({ name, description, currentLevel, maxLevel, nextCost, prereqMet, affordable })}
        footer={numericEffect}
      >
        <button
          type="button"
          className={styles.acquireBtn}
          disabled={!canAcquire}
          onClick={canAcquire ? onAcquire : undefined}
          data-testid={`node-acquire-${nodeId}`}
        >
          {buttonLabel}
        </button>
      </Hoverable>
    </aside>
  );
}
