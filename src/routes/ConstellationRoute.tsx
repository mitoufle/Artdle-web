import type { JSX } from "react";
import { useGameStore } from "@/store";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";

type Status = "purchased" | "available" | "locked";

const STATUS_LABEL: Record<Status, string> = {
  purchased: "Purchased",
  available: "Available",
  locked: "Locked",
};

const EFFECT_DESCRIPTIONS: Record<SkillNodeId, string> = {
  goldsmith: "+10% gold from canvas sales.",
  patient_eye: "+15% inspiration generation rate.",
  second_slot: "Workshop equipment slots: 1 → 2.",
  faster_strokes: "Ascend palier reduced 10%.",
  better_brush:
    "+1 magnitude on workshop item affixes (e.g., 5–15% → 6–16%).",
};

/**
 * Gating logic mirrors `canBuyNode` / `hasNode` in `skillTreeSlice.ts`.
 * Inlined here so the route subscribes to `purchasedNodes` (and `fame`) directly
 * via the bindings below — clicking Buy mutates `purchasedNodes`, which must
 * trigger a re-render so the next node flips Locked → Available.
 */
export function ConstellationRoute(): JSX.Element {
  const fame = useGameStore((s) => s.fame);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyNode = useGameStore((s) => s.buyNode);

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="text-sm opacity-70">Fame: {formatBig(fame)}</header>
      <ul className="flex flex-col gap-2">
        {SKILL_NODES.map((node) => {
          const owned = purchasedNodes[node.id] === true;
          const prereqMet =
            node.prereq === null || purchasedNodes[node.prereq] === true;
          const affordable = fame.gte(big(node.cost));
          const status: Status = owned
            ? "purchased"
            : prereqMet && affordable
              ? "available"
              : "locked";
          const canBuy = !owned && prereqMet && affordable;
          return (
            <li
              key={node.id}
              className="flex items-center justify-between rounded bg-app-panel px-3 py-2"
            >
              <span>
                <strong>{node.name}</strong>{" "}
                <span className="opacity-60">
                  ({STATUS_LABEL[status]} · {node.cost} fame)
                </span>
              </span>
              <Hoverable
                title={node.name}
                body={() => {
                  const s = useGameStore.getState();
                  const ownedNow = s.purchasedNodes[node.id] === true;
                  const prereqMetNow =
                    node.prereq === null || s.purchasedNodes[node.prereq] === true;
                  const affordableNow = s.fame.gte(big(node.cost));
                  const liveStatus: Status = ownedNow
                    ? "purchased"
                    : prereqMetNow && affordableNow
                      ? "available"
                      : "locked";
                  return `${EFFECT_DESCRIPTIONS[node.id]} Status: ${STATUS_LABEL[liveStatus]}.`;
                }}
                footer={`Cost: ${node.cost} fame`}
              >
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => buyNode(node.id)}
                  className="rounded bg-fame/20 px-3 py-1 text-sm disabled:opacity-40"
                >
                  Buy
                </button>
              </Hoverable>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
