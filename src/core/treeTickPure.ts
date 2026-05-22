import { inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
import {
  addCurrency,
  trackInspirationGainPure,
  type DraftState,
} from "@/core/pureMutations";
import { canGrowSapling, getProducingParts } from "@/store/treeSlice";

const AUTO_GROW_MAX_ITER = 100;

export function treeTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  const producing = getProducingParts(draft);
  if (producing.length > 0) {
    const multiplier = getInspiMultiplier(draft);
    const rate = inspiPerSec(producing, multiplier);
    if (rate.gt(0)) {
      const gain = rate.mul(deltaSeconds);
      addCurrency(draft, "inspiration", gain);
      trackInspirationGainPure(draft, gain);
    }
  }
  for (let i = 0; i < AUTO_GROW_MAX_ITER && canGrowSapling(draft); i++) {
    draft.currentStage = draft.currentStage + 1;
  }
}
