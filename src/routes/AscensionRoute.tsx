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
    <div className="flex flex-col gap-4 p-4">
      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Palier (threshold)</div>
        <div className="text-lg font-semibold">{formatBig(palier)} inspi</div>
      </section>

      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">Current inspiration</div>
        <div className="text-lg">{formatBig(inspiration)}</div>
      </section>

      <section className="rounded bg-app-panel p-3">
        <div className="text-sm opacity-70">If you ascend now</div>
        <div className="text-lg text-fame">+{fameGain} fame</div>
      </section>

      <section className="rounded bg-app-panel p-3 text-sm opacity-80">
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
          className="self-start rounded bg-fame/30 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Ascend
        </button>
      </Hoverable>
    </div>
  );
}
