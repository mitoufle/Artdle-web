import type { JSX } from "react";
import { useGameStore } from "@/store";
import { SKILL_NODES } from "@/config/skillTreeNodes";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";

type Status = "purchased" | "available" | "locked";

const STATUS_LABEL: Record<Status, string> = {
  purchased: "Purchased",
  available: "Available",
  locked: "Locked",
};

/**
 * Gating logic mirrors `canBuyNode` / `hasNode` in `skillTreeSlice.ts`.
 * Inlined here so the view subscribes to `purchasedNodes` (and `fame`) directly
 * via the bindings below — clicking Buy mutates `purchasedNodes`, which must
 * trigger a re-render so the next node flips Locked → Available.
 */
export function SkillTreeView(): JSX.Element {
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
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => buyNode(node.id)}
                className="rounded bg-fame/20 px-3 py-1 text-sm disabled:opacity-40"
              >
                Buy
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
