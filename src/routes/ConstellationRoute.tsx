import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { hasNode, canBuyNode } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";
import { NodeCard } from "@/components/constellation/NodeCard";
import { MiniMap } from "@/components/constellation/MiniMap";
import { ClusterList } from "@/components/constellation/ClusterList";
import styles from "./ConstellationRoute.module.css";

const EFFECT_DESCRIPTIONS: Record<SkillNodeId, string> = {
  goldsmith: "+10% gold from canvas sales.",
  patient_eye: "+15% inspiration generation rate.",
  second_slot: "Workshop equipment slots: 1 → 2.",
  faster_strokes: "Ascend palier reduced 10%.",
  better_brush: "+1 magnitude on workshop item affixes (e.g. 5–15% → 6–16%).",
};

export function ConstellationRoute(): JSX.Element {
  const fame = useGameStore((s) => s.fame);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyNode = useGameStore((s) => s.buyNode);

  const [selectedId, setSelectedId] = useState<SkillNodeId | null>(null);

  const helperState = { fame, purchasedNodes } as unknown as GameStore;
  const nodeStates = SKILL_NODES.reduce(
    (acc, node) => {
      const owned = hasNode(helperState, node.id);
      const prereqMet = node.prereq === null || hasNode(helperState, node.prereq);
      const affordable = fame.gte(big(node.cost));
      acc[node.id] = { owned, available: prereqMet, affordable };
      return acc;
    },
    {} as Record<SkillNodeId, NodeState>,
  );

  const ownedById = SKILL_NODES.reduce(
    (acc, node) => {
      acc[node.id] = nodeStates[node.id].owned;
      return acc;
    },
    {} as Record<SkillNodeId, boolean>,
  );

  const ownedCount = Object.values(ownedById).filter(Boolean).length;

  const selectedNode = selectedId !== null
    ? SKILL_NODES.find((n) => n.id === selectedId)
    : null;
  const selectedState = selectedId !== null ? nodeStates[selectedId] : null;

  return (
    <div className={styles.layout}>
      <div className={styles.canvasArea}>
        <StarCanvas
          selectedId={selectedId}
          onSelect={setSelectedId}
          nodeStates={nodeStates}
        />
        {selectedNode && selectedState && (
          <div className={styles.cardSlot}>
            <NodeCard
              nodeId={selectedNode.id}
              name={selectedNode.name}
              cost={selectedNode.cost}
              prereqMet={selectedState.available}
              affordable={selectedState.affordable}
              owned={selectedState.owned}
              description={EFFECT_DESCRIPTIONS[selectedNode.id]}
              onAcquire={() => {
                if (canBuyNode(helperState, selectedNode.id)) {
                  buyNode(selectedNode.id);
                }
              }}
            />
          </div>
        )}
      </div>

      <aside className={styles.rail}>
        <section className={styles.fameDisplay} aria-label="Fame to spend">
          <div className={styles.fameLabel}>Fame to spend</div>
          <div className={styles.fameValue}>{formatBig(fame)}</div>
        </section>
        <MiniMap ownedById={ownedById} selectedId={selectedId} />
        <ClusterList ownedCount={ownedCount} totalCount={SKILL_NODES.length} />
      </aside>
    </div>
  );
}
