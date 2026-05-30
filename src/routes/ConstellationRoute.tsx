import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { canBuyNode, getNodeLevel, getNextCost, clusterComplete } from "@/store/skillTreeSlice";
import { SKILL_CLUSTERS, getClusterNodes } from "@/config/skillClusters";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { StarCanvas, type NodeState } from "@/components/constellation/StarCanvas";
import { NodeCard } from "@/components/constellation/NodeCard";
import { MiniMap } from "@/components/constellation/MiniMap";
import { ClusterList } from "@/components/constellation/ClusterList";
import { DEFAULT_VIEWPORT, centerOn, type ViewportState } from "@/components/constellation/viewport";
import styles from "./ConstellationRoute.module.css";

export function ConstellationRoute(): JSX.Element {
  const fame = useGameStore((s) => s.fame);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyNode = useGameStore((s) => s.buyNode);
  const devFreeNodes = useGameStore((s) => s.devFreeNodes);
  const toggleDevFreeNodes = useGameStore((s) => s.toggleDevFreeNodes);

  const [selectedId, setSelectedId] = useState<SkillNodeId | null>(null);
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);
  const jumpTo = (svgX: number, svgY: number): void => {
    setViewport((current) => centerOn(current, svgX, svgY));
  };

  const helperState = { fame, purchasedNodes, devFreeNodes };

  const nodeStates = SKILL_NODES.reduce(
    (acc, node) => {
      const level = getNodeLevel(helperState, node.id);
      const prereqMet =
        node.parentIds.length === 0 ||
        node.parentIds.every((p) => getNodeLevel(helperState, p) > 0);
      const nextCost = getNextCost(helperState, node.id);
      const affordable = devFreeNodes
        ? prereqMet && nextCost !== null
        : nextCost !== null && fame.gte(big(nextCost));
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

  const completedClusterIds = new Set(
    SKILL_CLUSTERS.filter((c) => clusterComplete({ purchasedNodes }, c.id)).map((c) => c.id),
  );

  const clusterRows = SKILL_CLUSTERS.map((c) => {
    const members = getClusterNodes(c.id);
    const owned = members.filter((n) => (purchasedNodes[n.id] ?? 0) > 0).length;
    return {
      id: c.id,
      name: c.name,
      owned,
      total: members.length,
      complete: completedClusterIds.has(c.id),
    };
  });

  const selectedNode = selectedId !== null
    ? SKILL_NODES.find((n) => n.id === selectedId) ?? null
    : null;
  const selectedState = selectedId !== null ? nodeStates[selectedId] : null;
  const rawNextCost = selectedId !== null ? getNextCost(helperState, selectedId) : null;
  const selectedNextCost = devFreeNodes && rawNextCost !== null ? 0 : rawNextCost;

  return (
    <div className={styles.layout}>
      <div className={styles.canvasArea}>
        <StarCanvas
          selectedId={selectedId}
          onSelect={setSelectedId}
          nodeStates={nodeStates}
          viewport={viewport}
          onViewportChange={setViewport}
          completedClusterIds={completedClusterIds}
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
        <MiniMap ownedById={ownedById} selectedId={selectedId} viewport={viewport} onJump={jumpTo} />
        <ClusterList rows={clusterRows} />
        <button
          type="button"
          className={`${styles.devToggle}${devFreeNodes ? ` ${styles.devToggleOn}` : ""}`}
          onClick={toggleDevFreeNodes}
        >
          [DEV] Free nodes: {devFreeNodes ? "ON" : "OFF"}
        </button>
      </aside>
    </div>
  );
}
