import type { JSX } from "react";
import { useGameStore } from "@/store";
import { canAscend, getEffectivePalier } from "@/systems/ascend";
import { fameOnAscend } from "@/core/balance";
import { formatBig } from "@/core/formatter";

export function AscensionView(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const performAscend = useGameStore((s) => s.performAscend);
  const fullState = useGameStore.getState();
  const palier = getEffectivePalier(fullState, ascendCount);
  const canDo = canAscend(fullState);
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

      <button
        type="button"
        disabled={!canDo}
        onClick={() => performAscend()}
        className="self-start rounded bg-fame/30 px-4 py-2 text-sm font-semibold disabled:opacity-40"
      >
        Ascend
      </button>
    </div>
  );
}
