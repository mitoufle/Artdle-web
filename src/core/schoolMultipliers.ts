import { SCHOOL_TIERS } from "@/config/schoolResearches";
import type { GameStore } from "@/store";

export const getSchoolBonus = (
  state: Pick<GameStore, "completedResearches">,
  kind: string,
): number => {
  let total = 0;
  for (const tier of SCHOOL_TIERS) {
    for (const research of tier.researches) {
      if (state.completedResearches[research.id]) {
        for (const effect of research.effects) {
          if (effect.kind === kind) {
            total += effect.value;
          }
        }
      }
    }
  }
  return total;
};
