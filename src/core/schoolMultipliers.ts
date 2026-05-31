import { SCHOOL_TIERS } from "@/config/schoolResearches";
import { hasCapability } from "@/store/skillTreeSlice";
import type { GameStore } from "@/store";

/** Mentorship node (`mentorship_research_boost`): +30% to all research effects. */
const MENTORSHIP_RESEARCH_BOOST = 0.30;

export const getSchoolBonus = (
  state: Pick<GameStore, "completedResearches" | "purchasedNodes">,
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
  // Mentorship scales every completed-research numeric benefit. Guard against a
  // partial state (no purchasedNodes) so callers passing only completedResearches
  // don't crash — that simply means no Mentorship node is owned.
  const mentorshipFactor =
    state.purchasedNodes && hasCapability(state, "mentorship_research_boost")
      ? 1 + MENTORSHIP_RESEARCH_BOOST
      : 1;
  return total * mentorshipFactor;
};
