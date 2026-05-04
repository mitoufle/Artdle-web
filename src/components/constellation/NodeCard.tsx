import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import styles from "./NodeCard.module.css";

interface Props {
  nodeId: SkillNodeId;
  name: string;
  cost: number;
  prereqMet: boolean;
  affordable: boolean;
  owned: boolean;
  description: string;
  onAcquire: () => void;
}

export function NodeCard({
  nodeId,
  name,
  cost,
  prereqMet,
  affordable,
  owned,
  description,
  onAcquire,
}: Props): JSX.Element {
  const canAcquire = prereqMet && affordable && !owned;

  let prereqText: string;
  if (owned) {
    prereqText = "owned ✓";
  } else if (prereqMet) {
    prereqText = "prereq met ✓";
  } else {
    prereqText = "prereq locked";
  }

  let buttonLabel: string;
  if (owned) {
    buttonLabel = "✦ Acquired";
  } else {
    buttonLabel = `✦ Acquire · ${cost} fame`;
  }

  return (
    <aside className={styles.card} aria-label={`Node detail · ${name}`} data-node-id={nodeId}>
      <h3 className={styles.title}>{name}</h3>
      <div className={styles.meta}>
        {cost} fame · {prereqText}
      </div>
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
