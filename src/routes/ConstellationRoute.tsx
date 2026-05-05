import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { canBuyNode, getNodeLevel, getNextCost } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";
import { NodeCard } from "@/components/constellation/NodeCard";
import { MiniMap } from "@/components/constellation/MiniMap";
import { ClusterList } from "@/components/constellation/ClusterList";
import styles from "./ConstellationRoute.module.css";

export function ConstellationRoute(): JSX.Element {
  const fame = useGameStore((s) => s.fame);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyNode = useGameStore((s) => s.buyNode);

  const [selectedId, setSelectedId] = useState<SkillNodeId | null>(null);

  const helperState = { fame, purchasedNodes } as unknown as GameStore;

  const nodeStates = SKILL_NODES.reduce(
    (acc, node) => {
      const level = getNodeLevel(helperState, node.id);
      const prereqMet =
        node.parentIds.length === 0 ||
        node.parentIds.every((p) => getNodeLevel(helperState, p) > 0);
      const nextCost = getNextCost(helperState, node.id);
      const affordable = nextCost === null ? false : fame.gte(big(nextCost));
      acc[node.id] = {
        level,
        maxLevel: node.maxLevel,
        available: prereqMet,
        affordable,
      };
      return acc;
    },
    {} as Record<SkillNodeId, NodeState>,
  );

  const ownedById = SKILL_NODES.reduce(
    (acc, node) => {
      acc[node.id] = (nodeStates[node.id]?.level ?? 0) > 0;
      return acc;
    },
    {} as Record<SkillNodeId, boolean>,
  );

  const ownedCount = Object.values(ownedById).filter(Boolean).length;

  const selectedNode = selectedId !== null
    ? SKILL_NODES.find((n) => n.id === selectedId) ?? null
    : null;
  const selectedState = selectedId !== null ? nodeStates[selectedId] : null;
  const selectedNextCost = selectedId !== null ? getNextCost(helperState, selectedId) : null;

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
              description={selectedNode.description}
              numericEffect={selectedNode.numericEffect}
              currentLevel={selectedState.level}
              maxLevel={selectedNode.maxLevel}
              nextCost={selectedNextCost}
              prereqMet={selectedState.available}
              affordable={selectedState.affordable}
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
