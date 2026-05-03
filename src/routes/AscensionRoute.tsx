import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { canAscend, getEffectivePalier } from "@/systems/ascend";
import { fameOnAscend } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";

export function AscensionRoute(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const performAscend = useGameStore((s) => s.performAscend);

  // Helpers expect a GameStore; pass the fields they actually read.
  // Cast is intentional and safe — see docs/agent_docs/ui-patterns.md.
  const helperState = {
    inspiration,
    ascendCount,
    purchasedNodes,
  } as unknown as GameStore;
  const palier = getEffectivePalier(helperState, ascendCount);
  const canDo = canAscend(helperState);
  const fameGain = fameOnAscend(inspiration);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>
      <section>
        <div>Palier (threshold)</div>
        <div>{formatBig(palier)} inspi</div>
      </section>

      <section>
        <div>Current inspiration</div>
        <div>{formatBig(inspiration)}</div>
      </section>

      <section>
        <div>If you ascend now</div>
        <div>+{fameGain} fame</div>
      </section>

      <section>
        Ascends so far: {ascendCount} · Total fame: {formatBig(fame)}
      </section>

      <Hoverable
        title="Ascend"
        body={() => {
          const s = useGameStore.getState();
          const liveGain = fameOnAscend(s.inspiration);
          return `Reset the run for permanent fame. Currently gain +${liveGain} fame.`;
        }}
        footer={() => {
          const s = useGameStore.getState();
          const hs = {
            inspiration: s.inspiration,
            ascendCount: s.ascendCount,
            purchasedNodes: s.purchasedNodes,
          } as unknown as GameStore;
          const livePalier = getEffectivePalier(hs, s.ascendCount);
          return `Palier: ${formatBig(s.inspiration)} / ${formatBig(livePalier)} inspi`;
        }}
      >
        <button
          type="button"
          disabled={!canDo}
          onClick={() => performAscend()}
        >
          Ascend
        </button>
      </Hoverable>
    </div>
  );
}
