import type { JSX } from "react";
import type { SkillNodeId } from "@/config/skillTreeNodes";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { FAME_HUB, NODE_POSITIONS, VIEWBOX } from "./nodeLayout";
import styles from "./MiniMap.module.css";

interface Props {
  ownedById: Record<SkillNodeId, boolean>;
  selectedId: SkillNodeId | null;
}

export function MiniMap({ ownedById, selectedId }: Props): JSX.Element {
  const ownedCount = Object.values(ownedById).filter(Boolean).length;
  const totalCount = SKILL_NODES.length;

  return (
    <section className={styles.panel} aria-label="Constellation mini-map">
      <div className={styles.subhead}>Mini-map</div>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="Constellation overview"
      >
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="var(--bg-stone-d)" />
        <circle cx={FAME_HUB.x} cy={FAME_HUB.y} r="8" fill="var(--fame)" opacity="0.8" />
        {(Object.keys(NODE_POSITIONS) as SkillNodeId[]).map((id) => {
          const pos = NODE_POSITIONS[id];
          const owned = ownedById[id];
          const isSelected = selectedId === id;
          const fill = owned ? "var(--gold)" : "var(--inspi-d)";
          return (
            <g
              key={id}
              data-testid={`mini-node-${id}`}
              data-state={owned ? "owned" : "locked"}
              data-selected={isSelected ? "true" : undefined}
            >
              {isSelected && <circle cx={pos.x} cy={pos.y} r="14" fill="rgba(155,108,214,0.4)" />}
              <circle cx={pos.x} cy={pos.y} r={isSelected ? 8 : 6} fill={fill} opacity={owned ? 1 : 0.55} />
            </g>
          );
        })}
      </svg>
      <div className={styles.caption}>
        {ownedCount} / {totalCount} owned · zoom out for more
      </div>
    </section>
  );
}
